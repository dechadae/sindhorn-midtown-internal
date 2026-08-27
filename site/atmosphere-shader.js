export const ATMOSPHERE_VERTEX_SHADER=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,1.0);}
`;

// Phase 8.2 shared cloud/sky renderer. The cloud field is sampled from a small
// deterministic bilinear noise texture instead of recalculating multi-octave
// hash noise for every pixel. This preserves layered morphology while cutting
// the dominant fragment-shader arithmetic cost on DPR-2 mobile canvases.
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
float texNoise(vec2 p,float channel){
  vec2 q=fract(p*.047+vec2(channel*.173,channel*.317));
  vec4 n=texture2D(uNoise,q);
  if(channel<.5)return n.r;if(channel<1.5)return n.g;if(channel<2.5)return n.b;return n.a;
}
float layeredNoise(vec2 p,float channel){
  float a=texNoise(p,channel);
  float b=texNoise(p*2.07+vec2(7.1,13.7),channel+1.0);
  return a*.72+b*.28;
}
vec3 saturation(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}
vec3 toLinear(vec3 c){return c*c;}vec3 toDisplay(vec3 c){return sqrt(max(c,vec3(0.0)));}
void main(){
  vec2 uv=vUv+uTilt*uTiltScale;
  float aspect=clamp(uResolution.x/max(uResolution.y,1.0),.4,2.5);
  float horizon=pow(sat(1.0-uv.y),1.42);
  float shimmer=(texNoise(vec2(uv.y*105.0+uTime*1.5,uv.x*8.0),3.0)-.5)*.008*uHeat*pow(horizon,1.55);uv.x+=shimmer;
  float y=smoothstep(.01,.97,uv.y);
  vec3 seasonal=toDisplay(mix(toLinear(uSkyHorizon),toLinear(uSkyTop),y));
  vec3 generic=toDisplay(mix(toLinear(vec3(.72,.84,.91)),toLinear(vec3(.23,.48,.76)),y));
  vec3 c=mix(generic,seasonal,sat(uSeasonalStrength));
  float day=smoothstep(-5.0,8.0,uSolarAltitude),night=1.0-smoothstep(-8.0,7.0,uSolarAltitude);
  c=mix(c,vec3(.13,.16,.21),sat(uStorm*uStormScale)*.42);
  c=mix(c,vec3(.72,.67,.61),sat(uHaze)*.10*horizon*day);

  float windAngle=radians(uWindDirection);vec2 flow=vec2(sin(windAngle),-cos(windAngle));vec2 p=vec2(uv.x*aspect,uv.y);
  float speed=.004+.00022*uWind;vec2 drift=flow*uTime*speed;

  // 1) High veil / cirrus.
  vec2 hp=(p+drift*(.45+uHighSpeed))*vec2(max(.2,uHighScale)*uHighStretch,max(.15,uHighScale*.58));
  float hn=layeredNoise(hp+vec2(layeredNoise(hp*.42,1.0)*1.45,0.0),0.0);
  float hThresh=mix(.84,.36,sat(uHighCoverage));float high=smoothstep(hThresh-.10,hThresh+.10,hn);
  float highFib=layeredNoise(hp*vec2(1.9,.55)+vec2(4.2,19.0),2.0);high*=smoothstep(.20,.76,highFib+.24);high*=smoothstep(.02,.20,uv.y)*smoothstep(1.04,.74,uv.y);

  // 2) Mid broken cloud.
  vec2 mp=(p+drift*.72)*vec2(1.28,.82)*max(.2,uMidScale);
  float mb=layeredNoise(mp*.72,0.0);float ml=layeredNoise(mp*1.55+vec2(mb*.95,7.3),1.0);float md=layeredNoise(mp*(3.0+uMidDetail*1.6)+vec2(ml*.7,18.0),2.0);
  float mf=mb*.48+ml*.37+md*.15;float mt=mix(.82,.39,sat(uMidCoverage));float edge=max(.015,uMidSoftness/max(.55,uCloudContrast));float mid=smoothstep(mt-edge,mt+edge,mf);
  float connectedMid=smoothstep(.34,.66,mb*.68+ml*.32)*uConnected;mid=max(mid,connectedMid*(.50+.44*uMidCoverage));
  float midInner=smoothstep(mt+.02,mt+.23,mf);float midRim=sat(mid-midInner);

  // 3) Low convective / monsoon.
  vec2 lp=(p+drift*.44)*vec2(.78,1.02/max(.3,uLowBuild))*max(.2,uLowScale);
  float lb=layeredNoise(lp*.66,2.0);float ll=layeredNoise(lp*1.36+vec2(lb*1.25,11.0),0.0);float ld=layeredNoise(lp*2.8+vec2(ll*.8,27.0),1.0);
  float lf=lb*.58+ll*.32+ld*.10+horizon*.08*sat(uLowBuild-1.0);float lt=mix(.84,.35,sat(uLowCoverage));lt-=uConnected*.13;
  float low=smoothstep(lt-.10/max(.7,uCloudContrast),lt+.10/max(.7,uCloudContrast),lf);float connectedDeck=smoothstep(.36,.72,lb*.68+ll*.32)*uConnected*smoothstep(.18,.72,uLowCoverage);low=max(low,connectedDeck);
  float crown=smoothstep(.48,.78,lf+.08*ld);float lowRim=sat(low-smoothstep(lt+.06,lt+.26,lf));float lowBottom=sat((1.0-uv.y)*.70+.28*(1.0-crown));

  // Directional solar lighting from authoritative astronomy.
  vec2 sd=uv-uSun;sd.x*=aspect;float sunDist=length(sd);vec2 toSun=uSun-uv;toSun.x*=aspect;
  float lowSun=sat((12.0-uSolarAltitude)/16.0);float warmGeom=exp(-sunDist*sunDist*5.5)*lowSun*uWarmLight;
  float directional=sat(.5+.5*dot(normalize(toSun+vec2(.0001)),normalize(vec2(.75,.28))));
  vec3 highCol=mix(uCloudAmbient,uCloudWarm,sat(warmGeom*.72+lowSun*.13));highCol=mix(highCol,vec3(.55,.50,.66),night*.10);
  vec3 midCol=mix(uCloudBase,uCloudAmbient,sat(.34+midInner*.58));float midWarm=sat(lowSun*(.18+.82*exp(-sunDist*sunDist*2.3))*uWarmLight);midCol=mix(midCol,uCloudWarm,sat(midWarm*(.28+.72*directional)));midCol+=uCloudWarm*midRim*uMidEdgeLight*lowSun*.30;midCol=mix(midCol,vec3(.075,.085,.115),night*.70);
  vec3 lowCol=mix(uCloudBase*mix(1.0,.48,uBaseDarkness),uCloudAmbient,sat(crown*.72));lowCol*=1.0-lowBottom*uBaseDarkness*.34;float leak=exp(-sunDist*sunDist*5.0)*lowSun*uLightLeaks*(1.0-uConnected*.55);lowCol=mix(lowCol,uCloudWarm,sat(leak*.72));lowCol+=uCloudWarm*lowRim*lowSun*uLightLeaks*.18;lowCol=mix(lowCol,vec3(.10,.11,.15),sat(uStorm*.82+night*.66));
  float highA=sat(high*uHighOpacity*.58),midA=sat(mid*uMidOpacity),lowA=sat(low*uLowOpacity);c=mix(c,highCol,highA);c=mix(c,midCol,midA);c=mix(c,lowCol,lowA);float cloudOptical=1.0-(1.0-highA)*(1.0-midA)*(1.0-lowA);

  // Visible sun disc + halo. The disc is horizon-gated, then cloud-attenuated.
  float sunVisible=smoothstep(-1.0,-.12,uSolarAltitude)*uCelestialEnabled;float sunTransmission=mix(1.0,.025,cloudOptical);float sunDiffuse=mix(1.0,.32,cloudOptical);
  float sunR=max(.006,uSunRadius);float sunDisc=1.0-smoothstep(sunR*.82,sunR,sunDist);float sunHalo=exp(-sunDist*sunDist/(sunR*sunR*15.0));float sunAura=exp(-sunDist*sunDist/(sunR*sunR*80.0));
  vec3 sunWarm=mix(vec3(1.0,.58,.28),vec3(1.0,.98,.86),smoothstep(5.0,38.0,uSolarAltitude));
  c+=sunWarm*(sunDisc*.94*sunTransmission+sunHalo*.22*sunDiffuse*uSunGlow+sunAura*.045*sunDiffuse*uSunGlow)*sunVisible*(1.0-uStorm*.48);

  // Moon stays physically positioned and is cloud/weather attenuated.
  vec2 mdv=uv-uMoon;mdv.x*=aspect;float moonDist=length(mdv),moonR=max(.008,uMoonRadius);vec2 moonNormal=mdv/moonR;float moonRadius2=dot(moonNormal,moonNormal),moonSurfaceZ=sqrt(max(0.0,1.0-moonRadius2));
  float moonLimb=1.0-smoothstep(.91,1.0,sqrt(moonRadius2)),moonPhaseAngle=uMoonPhase*6.28318530718;vec2 moonLightDirection=vec2(sin(moonPhaseAngle),-cos(moonPhaseAngle));float moonTerminator=smoothstep(-.075,.075,dot(vec2(moonNormal.x,moonSurfaceZ),moonLightDirection));
  float moonAbove=smoothstep(-1.0,-.12,uMoonAltitude)*uCelestialEnabled,moonCloudTransmission=mix(1.0,.03,cloudOptical),moonNight=1.0-smoothstep(-7.0,8.0,uSolarAltitude),moonVisibility=moonAbove*moonCloudTransmission*(1.0-uStorm*.72)*(1.0-uFog*.78);
  float moonEarthshine=mix(.004,.026,moonNight)*(1.0-moonTerminator),moonLimbShade=pow(moonSurfaceZ,.24),moonPhaseBrightness=mix(.68,1.0,uMoonIllumination),moonDayBrightness=mix(.20,1.0,moonNight);float moonDisc=moonLimb*(moonEarthshine+moonTerminator*moonLimbShade*moonPhaseBrightness)*moonVisibility*moonDayBrightness;float moonHalo=exp(-moonDist*moonDist/(moonR*moonR*34.0))*(1.0-moonLimb)*(.018+.042*uMoonIllumination)*moonVisibility*uMoonGlow; c+=vec3(.82,.90,1.0)*(moonDisc*.92+moonHalo);

  float fogVis=1.0-smoothstep(.5,18.0,uVisibility);float fog=max(uFog,fogVis*.55)*uFogScale;vec3 fogColor=mix(vec3(.70,.74,.76),vec3(.18,.20,.25),night);c=mix(c,fogColor,sat(fog*(.16+.72*horizon)));
  // AirBKK PM2.5 optics remain last: optics never create cloud geometry.
  float pm=sat(uPm25/220.0)*uPmScale,dust=sat(uDust),smoke=sat(uSmoke);c=saturation(c,1.0-pm*.58-smoke*.34);c=mix(c,vec3(.61,.56,.50),pm*(.05+.35*horizon));c=mix(c,vec3(.62,.49,.34),dust*(.08+.46*horizon));c=mix(c,vec3(.38,.40,.42),smoke*(.06+.42*horizon));c=mix(c,vec3(.66,.67,.66),pow(horizon,1.6)*uHumidity*.12);
  float starNoise=texNoise(floor(uv*uResolution/3.0),3.0);float stars=step(.9968,starNoise)*(1.0-smoothstep(-14.0,-6.0,uSolarAltitude));c+=vec3(.65,.72,.88)*stars*.18*(1.0-cloudOptical);
  c+=vec3(.78,.86,1.0)*uFlash*(.22+.50*(1.0-uv.y));float vig=smoothstep(1.08,.28,length((uv-vec2(.5,.52))*vec2(aspect,1.0)));c*=mix(.90,1.0,vig);c+=(texNoise(gl_FragCoord.xy+vec2(uTime*11.0),2.0)-.5)/255.0;
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

export function createAtmosphereNoiseTexture(THREE,size=128){
  const data=new Uint8Array(size*size*4);let seed=0x2f6e2b1d;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed>>>24)&255};
  for(let i=0;i<data.length;i++)data[i]=rand();
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
