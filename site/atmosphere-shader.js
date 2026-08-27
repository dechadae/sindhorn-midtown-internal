export const ATMOSPHERE_VERTEX_SHADER=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,1.0);}
`;

// Phase 8.2 shared cloud/sky renderer. The cloud field uses a small deterministic
// bilinear noise texture. Each active cloud family uses two shared RGBA samples;
// inactive families are skipped through uniform branches. This preserves all
// three morphology families at fixed DPR 2 while bounding fragment cost.
export const ATMOSPHERE_FRAGMENT_SHADER=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uNoise;
uniform vec2 uResolution,uSun,uMoon,uTilt,uTiltScale;
uniform vec3 uSkyTop,uSkyHorizon,uCloudAmbient,uCloudWarm,uCloudBase;
uniform float uTime,uSolarAltitude,uSolarAzimuth,uMoonAltitude,uMoonIllumination,uMoonPhase,uTemperature,uHumidity,uVisibility,uStorm,uFog,uHeat,uWind,uWindDirection,uPm25,uDust,uSmoke,uFlash;
uniform float uSeasonalStrength,uHaze,uWarmLight,uSunRadius,uSunGlow,uMoonRadius,uMoonGlow,uCelestialEnabled;
uniform float uHighCoverage,uHighOpacity,uHighScale,uHighStretch,uHighSpeed;
uniform float uMidCoverage,uMidOpacity,uMidScale,uMidDetail,uMidSoftness,uMidEdgeLight;
uniform float uLowCoverage,uLowOpacity,uLowScale,uLowBuild,uConnected,uBaseDarkness,uLightLeaks,uCloudContrast;
uniform float uStormScale,uFogScale,uPmScale;
float sat(float x){return clamp(x,0.0,1.0);}
vec4 noise4(vec2 p){return texture2D(uNoise,fract(p));}
vec3 saturation(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}
void main(){
  vec2 uv=vUv+uTilt*uTiltScale;
  float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.4,2.5);
  vec4 screenNoise=noise4(gl_FragCoord.xy/192.0+vec2(uTime*.0009,-uTime*.0006));
  float horizonBase=sat(1.0-uv.y);float horizon=horizonBase*horizonBase*(3.0-2.0*horizonBase);
  float shimmer=(screenNoise.r-.5)*.008*uHeat*horizon*horizon;uv.x+=shimmer;
  float y=smoothstep(.01,.97,uv.y);
  vec3 seasonal=mix(uSkyHorizon,uSkyTop,y);
  vec3 generic=mix(vec3(.72,.84,.91),vec3(.23,.48,.76),y);
  vec3 c=mix(generic,seasonal,sat(uSeasonalStrength));
  float day=smoothstep(-5.0,8.0,uSolarAltitude),night=1.0-smoothstep(-8.0,7.0,uSolarAltitude);
  c=mix(c,vec3(.13,.16,.21),sat(uStorm*uStormScale)*.42);
  c=mix(c,vec3(.72,.67,.61),sat(uHaze)*.10*horizon*day);

  float windAngle=radians(uWindDirection);vec2 flow=vec2(sin(windAngle),-cos(windAngle));vec2 p=vec2(uv.x*aspect,uv.y);
  float speed=.004+.00022*uWind;vec2 drift=flow*uTime*speed;
  vec2 sd=uv-uSun;sd.x*=aspect;float sunDist=length(sd);vec2 toSun=uSun-uv;toSun.x*=aspect;
  float lowSun=sat((12.0-uSolarAltitude)/16.0);float sunNear=1.0-smoothstep(.10,.62,sunDist);float sunWide=1.0-smoothstep(.12,.92,sunDist);
  float directional=sat(.5+.5*dot(normalize(toSun+vec2(.0001)),vec2(.937,.351)));

  float highA=0.0,midA=0.0,lowA=0.0;

  // 1) High veil / cirrus. Uniform branch skips all high-cloud samples when absent.
  if(uHighCoverage>.003&&uHighOpacity>.003){
    vec2 hp=(p+drift*(.45+uHighSpeed))*vec2(max(.2,uHighScale)*uHighStretch,max(.15,uHighScale*.58));
    vec4 h0=noise4(hp*.050+vec2(.071,.137));vec4 h1=noise4(hp*.108+vec2(.291,.417));
    float hn=h0.r*.54+h0.g*.18+h1.b*.28;float fiber=h0.b*.42+h1.r*.34+h1.a*.24;
    float hThresh=mix(.82,.35,sat(uHighCoverage));float high=smoothstep(hThresh-.105,hThresh+.105,hn);high*=smoothstep(.18,.70,fiber+.15);high*=smoothstep(.02,.20,uv.y)*smoothstep(1.04,.74,uv.y);
    vec3 highCol=mix(uCloudAmbient,uCloudWarm,sat(sunWide*lowSun*uWarmLight*.55+lowSun*.12));highCol=mix(highCol,vec3(.55,.50,.66),night*.10);
    highA=sat(high*uHighOpacity*.58);c=mix(c,highCol,highA);
  }

  // 2) Mid broken cloud. Wide, vertically compact sampling keeps bodies rounded and fluffy.
  if(uMidCoverage>.003&&uMidOpacity>.003){
    vec2 mp=(p+drift*.72)*vec2(.90,1.08)*max(.2,uMidScale);
    vec4 m0=noise4(mp*.052+vec2(.173,.071));vec4 m1=noise4(mp*(.112+.014*uMidDetail)+vec2(.419,.227));
    float mb=m0.r*.66+m0.g*.34;float ml=m0.b*.46+m1.g*.34+m1.a*.20;float mf=mb*.50+ml*.35+m1.r*.15;
    float mt=mix(.81,.38,sat(uMidCoverage));float edge=max(.016,uMidSoftness/max(.55,uCloudContrast));float mid=smoothstep(mt-edge,mt+edge,mf);
    float connectedMid=smoothstep(.34,.66,mb*.68+ml*.32)*uConnected;mid=max(mid,connectedMid*(.50+.44*uMidCoverage));
    float midInner=smoothstep(mt+.025,mt+.22,mf);float midRim=sat(mid-midInner);
    vec3 midCol=mix(uCloudBase,uCloudAmbient,sat(.34+midInner*.58));float midWarm=sat(lowSun*(.18+.82*sunWide)*uWarmLight);midCol=mix(midCol,uCloudWarm,sat(midWarm*(.28+.72*directional)));midCol+=uCloudWarm*midRim*uMidEdgeLight*lowSun*.30;midCol=mix(midCol,vec3(.075,.085,.115),night*.70);
    midA=sat(mid*uMidOpacity);c=mix(c,midCol,midA);
  }

  // 3) Low convective / monsoon. Build adds crown structure without vertically stretching the mass.
  if(uLowCoverage>.003&&uLowOpacity>.003){
    float lowBuildRound=sat((uLowBuild-1.0)/.8);
    vec2 lp=(p+drift*.44)*vec2(.72,.96+.10*lowBuildRound)*max(.2,uLowScale);
    vec4 l0=noise4(lp*.047+vec2(.337,.149));vec4 l1=noise4(lp*.103+vec2(.097,.463));
    float lb=l0.b*.68+l0.r*.32;float ll=l0.a*.44+l1.g*.36+l1.b*.20;float lf=lb*.58+ll*.32+l1.r*.10+horizon*.08*sat(uLowBuild-1.0);
    float lt=mix(.83,.34,sat(uLowCoverage))-uConnected*.13;float low=smoothstep(lt-.10/max(.7,uCloudContrast),lt+.10/max(.7,uCloudContrast),lf);
    float connectedDeck=smoothstep(.36,.72,lb*.68+ll*.32)*uConnected*smoothstep(.18,.72,uLowCoverage);low=max(low,connectedDeck);
    float crown=smoothstep(.48,.78,lf+.08*l1.r);float lowRim=sat(low-smoothstep(lt+.06,lt+.26,lf));float lowBottom=sat((1.0-uv.y)*.70+.28*(1.0-crown));
    vec3 lowCol=mix(uCloudBase*mix(1.0,.48,uBaseDarkness),uCloudAmbient,sat(crown*.72));lowCol*=1.0-lowBottom*uBaseDarkness*.34;float leak=sunNear*lowSun*uLightLeaks*(1.0-uConnected*.55);lowCol=mix(lowCol,uCloudWarm,sat(leak*.72));lowCol+=uCloudWarm*lowRim*lowSun*uLightLeaks*.18;lowCol=mix(lowCol,vec3(.10,.11,.15),sat(uStorm*.82+night*.66));
    lowA=sat(low*uLowOpacity);c=mix(c,lowCol,lowA);
  }

  float cloudOptical=1.0-(1.0-highA)*(1.0-midA)*(1.0-lowA);

  // Visible sun disc + halo. The disc is horizon-gated, then cloud-attenuated.
  float sunVisible=smoothstep(-1.0,-.12,uSolarAltitude)*uCelestialEnabled;float sunTransmission=mix(1.0,.025,cloudOptical),sunDiffuse=mix(1.0,.32,cloudOptical);
  float sunR=max(.006,uSunRadius);float sunDisc=1.0-smoothstep(sunR*.82,sunR,sunDist);float sunHalo=1.0-smoothstep(sunR*1.1,sunR*5.0,sunDist);float sunAura=1.0-smoothstep(sunR*3.0,sunR*11.0,sunDist);
  vec3 sunWarm=mix(vec3(1.0,.58,.28),vec3(1.0,.98,.86),smoothstep(5.0,38.0,uSolarAltitude));
  c+=sunWarm*(sunDisc*.94*sunTransmission+sunHalo*.20*sunDiffuse*uSunGlow+sunAura*.04*sunDiffuse*uSunGlow)*sunVisible*(1.0-uStorm*.48);

  // Moon stays physically positioned and is cloud/weather attenuated.
  if(uMoonAltitude>-.9&&uCelestialEnabled>.01){
    vec2 mdv=uv-uMoon;mdv.x*=aspect;float moonDist=length(mdv),moonR=max(.008,uMoonRadius);vec2 moonNormal=mdv/moonR;float moonRadius2=dot(moonNormal,moonNormal),moonSurfaceZ=sqrt(max(0.0,1.0-moonRadius2));
    float moonLimb=1.0-smoothstep(.91,1.0,sqrt(moonRadius2)),moonPhaseAngle=uMoonPhase*6.28318530718;vec2 moonLightDirection=vec2(sin(moonPhaseAngle),-cos(moonPhaseAngle));float moonTerminator=smoothstep(-.075,.075,dot(vec2(moonNormal.x,moonSurfaceZ),moonLightDirection));
    float moonAbove=smoothstep(-1.0,-.12,uMoonAltitude)*uCelestialEnabled,moonCloudTransmission=mix(1.0,.03,cloudOptical),moonNight=1.0-smoothstep(-7.0,8.0,uSolarAltitude),moonVisibility=moonAbove*moonCloudTransmission*(1.0-uStorm*.72)*(1.0-uFog*.78);
    float moonEarthshine=mix(.004,.026,moonNight)*(1.0-moonTerminator),moonLimbShade=sqrt(max(.0,moonSurfaceZ)),moonPhaseBrightness=mix(.68,1.0,uMoonIllumination),moonDayBrightness=mix(.20,1.0,moonNight);float moonDisc=moonLimb*(moonEarthshine+moonTerminator*moonLimbShade*moonPhaseBrightness)*moonVisibility*moonDayBrightness;float moonHalo=(1.0-smoothstep(moonR*1.1,moonR*6.0,moonDist))*(1.0-moonLimb)*(.018+.042*uMoonIllumination)*moonVisibility*uMoonGlow;c+=vec3(.82,.90,1.0)*(moonDisc*.92+moonHalo);
  }

  float fogVis=1.0-smoothstep(.5,18.0,uVisibility);float fog=max(uFog,fogVis*.55)*uFogScale;vec3 fogColor=mix(vec3(.70,.74,.76),vec3(.18,.20,.25),night);c=mix(c,fogColor,sat(fog*(.16+.72*horizon)));
  // AirBKK PM2.5 optics remain last: optics never create cloud geometry.
  float pm=sat(uPm25/220.0)*uPmScale,dust=sat(uDust),smoke=sat(uSmoke);c=saturation(c,1.0-pm*.58-smoke*.34);c=mix(c,vec3(.61,.56,.50),pm*(.05+.35*horizon));c=mix(c,vec3(.62,.49,.34),dust*(.08+.46*horizon));c=mix(c,vec3(.38,.40,.42),smoke*(.06+.42*horizon));c=mix(c,vec3(.66,.67,.66),horizon*horizon*uHumidity*.12);
  float stars=step(.9970,screenNoise.g)*(1.0-smoothstep(-14.0,-6.0,uSolarAltitude));c+=vec3(.65,.72,.88)*stars*.18*(1.0-cloudOptical);
  c+=vec3(.78,.86,1.0)*uFlash*(.22+.50*(1.0-uv.y));float vig=smoothstep(1.08,.28,length((uv-vec2(.5,.52))*vec2(aspect,1.0)));c*=mix(.90,1.0,vig);c+=(screenNoise.b-.5)/255.0;
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

export function createAtmosphereNoiseTexture(THREE,size=128){
  const data=new Uint8Array(size*size*4);let seed=0x2f6e2b1d;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed>>>24)&255};
  for(let i=0;i<data.length;i++)data[i]=rand();
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
