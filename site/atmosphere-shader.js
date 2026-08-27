export const ATMOSPHERE_VERTEX_SHADER=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,1.0);}
`;

// Phase 8.2 shared cloud/sky renderer. The cloud field uses a small per-launch
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

  // 2) Mid broken cloud = broad bank mask × irregular rounded cells × edge breakup.
  // Rounded cells no longer become alpha blobs themselves: they gently perturb only
  // the low-frequency bank threshold/perimeter, while the interior remains one bank.
  if(uMidCoverage>.003&&uMidOpacity>.003){
    vec2 mp=(p+drift*.72)*vec2(.64,1.18)*max(.2,uMidScale);
    vec2 mpr=vec2(mp.x*.94+mp.y*.20,-mp.x*.16+mp.y*.94);
    vec4 m0=noise4(mp*.050+vec2(.173,.071));vec2 mWarp=(m0.ba-.5)*vec2(.24,.10);
    vec4 m1=noise4((mpr+mWarp)*(.140+.012*uMidDetail)+vec2(.419,.227));
    float midBankField=m0.r*.52+m0.g*.30+m0.a*.18;float mt=mix(.80,.37,sat(uMidCoverage));float edge=max(.016,uMidSoftness/max(.55,uCloudContrast));
    float midBank=smoothstep(mt-edge*1.45,mt+edge*1.20,midBankField);float midBankCore=smoothstep(mt+.070,mt+.185,midBankField);
    vec2 mCellA=fract(vec2(mp.x*22.0,mp.y*10.8)+(m0.rg-.5)*vec2(1.15,.75)+(m1.rg-.5)*vec2(.35,.30))-.5;mCellA+=(m1.rg-.5)*vec2(.14,.12);
    vec2 mCellAS=mCellA*vec2(.88,1.05);float mR0=.34+.11*m1.b;float mLobeA=1.0-smoothstep(mR0*mR0*.42,mR0*mR0,dot(mCellAS,mCellAS));
    vec2 mCellB=fract(vec2(mpr.x*18.0,mpr.y*8.8)+vec2(.37,.61)+(m1.ba-.5)*vec2(.85,.65))-.5;mCellB+=(m1.ba-.5)*vec2(.13,.11);
    vec2 mCellBS=mCellB*vec2(1.08,.92);float mR1=.30+.13*m0.b;float mLobeB=1.0-smoothstep(mR1*mR1*.40,mR1*mR1,dot(mCellBS,mCellBS));
    float midCells=smoothstep(.10,.86,max(mLobeA,mLobeB*.88));float midEdgeField=midCells*.60+m1.a*.24+m0.b*.16;float midEdgeBreakup=smoothstep(.27,.73,midEdgeField);
    float midCellBias=(midCells-.46)*.055+(m1.a-.5)*.030;float midShapeField=midBankField+midCellBias;
    float mid=smoothstep(mt-edge*1.45,mt+edge*1.20,midShapeField);float midEdgeZone=1.0-smoothstep(.040,.175,abs(midBankField-mt));
    mid*=1.0-midEdgeZone*(1.0-midEdgeBreakup)*.26;mid=max(mid,midBankCore*.92);mid=max(mid,midBank*.18);
    float connectedMid=smoothstep(.30,.59,midBankField)*uConnected;mid=max(mid,connectedMid*(.54+.42*uMidCoverage));
    float midDensity=sat(.67+m1.b*.17+midCells*.12);float midInner=sat(mid*(.68+.32*midDensity));float midRim=sat(mid*midEdgeZone*(.30+.70*midEdgeBreakup));float midUnder=sat((1.0-midDensity)*.20+horizon*.10);
    vec3 midCol=mix(uCloudBase,uCloudAmbient,sat(.22+midInner*.64));midCol*=1.0-midUnder*uBaseDarkness*.22;float midWarm=sat(lowSun*(.18+.82*sunWide)*uWarmLight);midCol=mix(midCol,uCloudWarm,sat(midWarm*(.08+.18*directional)));midCol+=uCloudWarm*midRim*uMidEdgeLight*lowSun*.30;midCol=mix(midCol,vec3(.075,.085,.115),night*.70);
    midA=sat(mid*uMidOpacity);c=mix(c,midCol,midA);
  }

  // 3) Low convective / monsoon = broad asymmetric bank × cauliflower crown cells
  // × controlled perimeter breakup. Cells sculpt the crown/perimeter but never replace
  // the broad body; connected weather still fills one dark tropical storm deck.
  if(uLowCoverage>.003&&uLowOpacity>.003){
    float lowBuildRound=sat((uLowBuild-1.0)/.8);
    vec2 lp=(p+drift*.44)*vec2(.55,1.12+.10*lowBuildRound)*max(.2,uLowScale);
    vec2 lpr=vec2(lp.x*.93-lp.y*.22,lp.x*.17+lp.y*.93);
    vec4 l0=noise4(lp*.046+vec2(.337,.149));vec2 lWarp=(l0.ar-.5)*vec2(.28,.11);
    vec4 l1=noise4((lpr+lWarp)*(.135+.018*lowBuildRound)+vec2(.097,.463));
    float lowBankField=l0.b*.48+l0.r*.30+l0.g*.22+horizon*.045*lowBuildRound;float lt=mix(.82,.33,sat(uLowCoverage))-uConnected*.12;float lowEdge=.095/max(.7,uCloudContrast);
    float lowBank=smoothstep(lt-lowEdge*1.45,lt+lowEdge*1.15,lowBankField);float lowBankCore=smoothstep(lt+.070,lt+.195,lowBankField);
    vec2 lCellA=fract(vec2(lp.x*22.0,lp.y*10.3)+(l0.rg-.5)*vec2(1.20,.72)+(l1.rg-.5)*vec2(.40,.30))-.5;lCellA+=(l1.rg-.5)*vec2(.15,.12);
    vec2 lCellAS=lCellA*vec2(.84,1.08);float lR0=.37+.12*l1.b;float lLobeA=1.0-smoothstep(lR0*lR0*.40,lR0*lR0,dot(lCellAS,lCellAS));
    vec2 lCellB=fract(vec2(lpr.x*17.0,lpr.y*8.2)+vec2(.43,.57)+(l1.ba-.5)*vec2(.92,.68))-.5;lCellB+=(l1.ba-.5)*vec2(.14,.11);
    vec2 lCellBS=lCellB*vec2(1.04,.90);float lR1=.34+.14*l0.a;float lLobeB=1.0-smoothstep(lR1*lR1*.38,lR1*lR1,dot(lCellBS,lCellBS));
    float lowCells=smoothstep(.09,.84,max(lLobeA,lLobeB*.90));float lowEdgeField=lowCells*.62+l1.a*.23+l0.g*.15;float lowEdgeBreakup=smoothstep(.25,.71,lowEdgeField);
    float lowCellBias=(lowCells-.46)*(.060+.015*lowBuildRound)+(l1.a-.5)*.032;float lowShapeField=lowBankField+lowCellBias;
    float low=smoothstep(lt-lowEdge*1.45,lt+lowEdge*1.15,lowShapeField);float lowEdgeZone=1.0-smoothstep(.045,.190,abs(lowBankField-lt));
    low*=1.0-lowEdgeZone*(1.0-lowEdgeBreakup)*.24;low=max(low,lowBankCore*.95);low=max(low,lowBank*.20);
    float connectedDeck=smoothstep(.28,.57,lowBankField)*uConnected*smoothstep(.18,.72,uLowCoverage);low=max(low,connectedDeck);
    float crown=sat(.55+l1.b*.18+lowCells*.18)*(.72+.28*lowBuildRound);float lowRim=sat(low*lowEdgeZone*(.28+.72*lowEdgeBreakup));float lowBottom=sat((1.0-uv.y)*.68+.20*(1.0-crown));
    vec3 lowCol=mix(uCloudBase*mix(1.0,.46,uBaseDarkness),uCloudAmbient,sat(.14+crown*.68));lowCol*=1.0-lowBottom*uBaseDarkness*.40;float leak=sunNear*lowSun*uLightLeaks*(1.0-uConnected*.58);lowCol=mix(lowCol,uCloudWarm,sat(leak*.62));lowCol+=uCloudWarm*lowRim*lowSun*uLightLeaks*.16;lowCol=mix(lowCol,vec3(.10,.11,.15),sat(uStorm*.82+night*.66));
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

function randomCloudSeed(){
  try{
    const entropy=new Uint32Array(1);globalThis.crypto?.getRandomValues?.(entropy);
    if(entropy[0])return entropy[0]>>>0;
  }catch(_){}
  return((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0)||0x2f6e2b1d;
}

export function createAtmosphereNoiseTexture(THREE,size=128){
  const data=new Uint8Array(size*size*4);let seed=randomCloudSeed();
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed>>>24)&255};
  for(let i=0;i<data.length;i++)data[i]=rand();
  const texture=new THREE.DataTexture(data,size,size*1,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
