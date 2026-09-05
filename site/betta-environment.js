import * as THREE from './vendor/three.module.js';
import {BETTA_PRESETS,DEFAULT_PRESET,clonePreset} from './betta-fin-presets.js';
import {BETTA_VERTEX_SHADER,BETTA_FRAGMENT_SHADER} from './betta-fin-shader.js';
import {startSatelliteStream,SATELLITE_SOURCE} from './betta-satellite.js';
import {BANGKOK_TIME_ZONE,BETTA_DAY_PERIODS,DAY_CYCLE_CHECK_MS,DAY_CYCLE_ROLLOVER_MS,DAY_CYCLE_CORRECTION_MS,easeDayCycle,periodForBangkokTime,periodForMinuteOfDay,periodByKey,bangkokClock} from './betta-day-periods.js';

const DPR=2;
const RADIAL_SEGMENTS=72;
const WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const STYLES_CACHE_KEY='sindhorn-midtown:betta-styles:v1';
const WEATHER_CACHE_MAX_AGE=45*60*1000;
const BASELINE_KEYS=Object.freeze(Object.keys(BETTA_PRESETS));
const MAX_RAYS=Math.max(...BASELINE_KEYS.map(key=>BETTA_PRESETS[key].params.rayCount));
const COMPOSITION_KEYS=Object.freeze(['offsetX','offsetY','cameraDepth','scale','rotationX','rotationY','rotation']);
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*t;
const lerpAngle=(a,b,t)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return a+d*t};

let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,backgroundMesh=null,backgroundMaterial=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false;
let activeKey=DEFAULT_PRESET,active=clonePreset(DEFAULT_PRESET),stopSatellite=null,pageVisible=!document.hidden;
let lifecycleState=pageVisible?'active':'suspended',webglContextLost=false,lastLifecycleReason='initial';
const meshes=[],materials=[];
/* Sky mode (r30) draws the period's own four colors as slow plumes over its
   sky, and no fish: the atmosphere for reduced motion (held still) and for a
   phone that cannot hold the fish (drifting). Same saved styles, same day
   cycle, same satellite drivers - only the fish is set aside. A phone is
   judged once from its own frame times after the first frame and remembered
   for a week; automation (navigator.webdriver) is never judged. Since r32b
   the employee's own choice in Settings › System (Automatic, Betta, Sky) is
   kept on the phone and outranks both, so the sky is never a trap. Plume
   intensity follows one rule, SKY_PLUME_ENERGY over the palette's summed
   luminance, so a bright fish blends as gently as a dark one. */
const SKY_MEMORY_KEY='sindhorn-midtown:betta-mode:v1',PREFERENCE_KEY='sindhorn-midtown:betta-preference:v1',SKY_MEMORY_MS=7*24*60*60*1000,SKY_PLUME_ENERGY=.42,SKY_PLUME_RANGE=[.12,.6],SKY_DRIFT_SECONDS=90,LOW_END_FRAME_MS=28,GOVERNOR_WARMUP_MS=600,GOVERNOR_WINDOW_MS=3000;
const reducedMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const mode={current:'betta',reason:'default',requested:'auto',skyTime:20,frameMs:null,governor:{startedAt:0,frames:[],done:false}};
const weather={known:false,cached:false,cloudCover:0,precipitationMm:0,rainMm:0,showersMm:0,snowfallCm:0,humidity:.68,windSpeedKmh:4,windDirectionDeg:180,windGustKmh:null,visibilityKm:20,temperatureC:null,apparentTemperatureC:null,weatherCode:null,isDay:null,observedAt:null};
const neutralDrivers={energy:.58,cloud:.35,cold:.35,cooling:0,texture:.32,vapor:.42,motion:[0,0],color:[.18,.23,.52],visible:0,fingerprint:[.5,.5,.5]};
const copyDrivers=source=>({energy:source.energy,cloud:source.cloud,cold:source.cold,cooling:source.cooling,texture:source.texture,vapor:source.vapor,motion:[...source.motion],color:[...source.color],visible:source.visible,fingerprint:[...source.fingerprint]});
const satellite={status:'loading',state:null,error:null,current:copyDrivers(neutralDrivers),target:copyDrivers(neutralDrivers),transitionBoost:0};
const dayCycle={mode:'live',period:null,targetPeriod:null,from:null,to:null,t0:0,duration:0,mix:1,rawMix:1,reason:'initial',pin:null,preview:null};
const tilt={supported:'DeviceOrientationEvent' in window,enabled:false,listening:false,permission:'unknown',calibrated:false,beta0:0,gamma0:0,targetX:0,targetY:0,currentX:0,currentY:0,lastAt:0};

const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const STORM_CODES=new Set([95,96,99]);
function weatherLabel(code){const c=Number(code);if(c===0)return'Clear';if(c===1)return'Mainly clear';if(c===2)return'Partly cloudy';if(c===3)return'Overcast';if([45,48].includes(c))return'Fog';if(DRIZZLE_CODES.has(c))return'Drizzle';if([61,63,65,66,67].includes(c))return'Rain';if([71,73,75,77].includes(c))return'Snow';if([80,81,82].includes(c))return'Rain showers';if([85,86].includes(c))return'Snow showers';if(STORM_CODES.has(c))return'Thunderstorm';return'Current weather'}
function windPoint(deg){const labels=['N','NE','E','SE','S','SW','W','NW'];return labels[Math.round(((((Number(deg)||0)%360)+360)%360)/45)%8]}
function normalizedWeather(w){const code=Number(w.weatherCode),cloud=clamp(w.cloudCover),mm=Math.max(0,Number(w.precipitationMm)||0),rainMm=Math.max(mm,Number(w.rainMm)||0,Number(w.showersMm)||0);return{cloud,rain:clamp(Math.max(RAIN_CODES.has(code)?.35:0,rainMm/8)),storm:STORM_CODES.has(code)?1:0,type:weatherLabel(code).toLowerCase().replaceAll(' ','-')}}
function renderWeather(){const host=document.getElementById('weatherNow');if(!host||!weather.known||!Number.isFinite(weather.temperatureC))return;const feels=Number.isFinite(weather.apparentTemperatureC)?Math.round(weather.apparentTemperatureC):Math.round(weather.temperatureC),set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};set('weatherTemp',`${Math.round(weather.temperatureC)}°`);set('weatherConditionEn',weatherLabel(weather.weatherCode));set('weatherMetaEn',`Feels ${feels}° · RH ${Math.round(weather.humidity*100)}% · Wind ${windPoint(weather.windDirectionDeg)} ${Math.round(weather.windSpeedKmh)} km/h`);host.hidden=false}
function cachedWeather(){try{const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');if(!cached||!cached.savedAt||Date.now()-cached.savedAt>WEATHER_CACHE_MAX_AGE)return null;return cached.value||null}catch(_){return null}}
function saveWeather(value){try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}))}catch(_){}}
async function fetchWeather(){const cached=cachedWeather();if(cached&&!weather.known){Object.assign(weather,cached,{known:true,cached:true});renderWeather()}const response=await fetch(WEATHER_ENDPOINT,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('weather '+response.status);const value=await response.json(),current=value.current||{},n=(x,fallback=null)=>Number.isFinite(Number(x))?Number(x):fallback;Object.assign(weather,{known:true,cached:false,cloudCover:clamp(n(current.cloud_cover,0)/100),precipitationMm:Math.max(0,n(current.precipitation,0)),rainMm:Math.max(0,n(current.rain,0)),showersMm:Math.max(0,n(current.showers,0)),snowfallCm:Math.max(0,n(current.snowfall,0)),humidity:clamp(n(current.relative_humidity_2m,68)/100),windSpeedKmh:Math.max(0,n(current.wind_speed_10m,4)),windDirectionDeg:((n(current.wind_direction_10m,180)%360)+360)%360,windGustKmh:n(current.wind_gusts_10m),visibilityKm:Math.max(.1,n(current.visibility,20000)/1000),temperatureC:n(current.temperature_2m),apparentTemperatureC:n(current.apparent_temperature),weatherCode:n(current.weather_code),isDay:n(current.is_day),observedAt:current.time||null});saveWeather(weather);renderWeather();document.dispatchEvent(new CustomEvent('sindhorn:weather-updated',{detail:{weatherCode:weather.weatherCode,precipitationMm:weather.precipitationMm}}));return weather}

function color(hex){return new THREE.Color(hex)}
const BACKGROUND_VERTEX_SHADER=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}
`;
const BACKGROUND_FRAGMENT_SHADER=`
precision highp float;
uniform vec3 uBg0From;uniform vec3 uBg1From;uniform vec3 uBg2From;
uniform vec3 uBg0To;uniform vec3 uBg1To;uniform vec3 uBg2To;
uniform float uMix;uniform vec3 uSatelliteColor;uniform float uSatelliteMix;
uniform float uSky;uniform float uTime;uniform float uPlume;uniform vec2 uAnchor;
uniform vec3 uP0From;uniform vec3 uP1From;uniform vec3 uP2From;uniform vec3 uP3From;
uniform vec3 uP0To;uniform vec3 uP1To;uniform vec3 uP2To;uniform vec3 uP3To;
uniform vec2 uSkyMotion;uniform float uSkyEnergy;uniform float uSkyCloud;uniform float uSkyVapor;uniform float uSkyCold;
varying vec2 vUv;
vec3 toDisplay(vec3 c){return pow(max(c,0.0),vec3(1.0/2.2));}
vec3 toLinear(vec3 c){return pow(max(c,0.0),vec3(2.2));}
float plume(vec2 p,vec2 c,vec2 r,float t,float s){vec2 q=p-c;q+=.045*vec2(sin(p.y*4.2+t*.9+s),cos(p.x*3.1-t*.7+s));q/=r;return exp(-dot(q,q));}
void main(){
  vec2 p=vUv;
  vec3 c0=mix(uBg0From,uBg0To,uMix),c1=mix(uBg1From,uBg1To,uMix),c2=mix(uBg2From,uBg2To,uMix);
  float radial=smoothstep(.06,1.0,length((p-vec2(.61,.36))*vec2(.82,1.04)));
  float sweep=smoothstep(.18,.94,p.x*.62+(1.0-p.y)*.38);
  vec3 bg=mix(c0,c1,clamp(radial*.74+p.y*.10,0.0,1.0));
  bg=mix(bg,c2,sweep*.48);
  if(uSky>.5){
    vec3 k0=toDisplay(mix(uP0From,uP0To,uMix)),k1=toDisplay(mix(uP1From,uP1To,uMix)),k2=toDisplay(mix(uP2From,uP2To,uMix)),k3=toDisplay(mix(uP3From,uP3To,uMix));
    vec3 cool=mix(vec3(1.0),vec3(.94,.98,1.04),uSkyCold*.6);k0*=cool;k1*=cool;k2*=cool;k3*=cool;
    float t=uTime*(6.2832/${SKY_DRIFT_SECONDS}.0);
    float breathe=.035+.05*uSkyEnergy,soft=1.0+.15*uSkyCloud+.10*uSkyVapor,dir=uAnchor.x<.5?1.0:-1.0;
    vec2 drift=uSkyMotion*.05;
    float w0=plume(p,uAnchor+drift+breathe*vec2(cos(t),sin(t*1.3)),vec2(.55,.50)*soft,t,0.0)/soft;
    float w1=plume(p,vec2(uAnchor.x+dir*.62,.78)+drift+breathe*vec2(sin(t*.8),cos(t)),vec2(.50,.36)*soft,t,2.1)/soft;
    float w2=plume(p,vec2(uAnchor.x+dir*.70,.30)+drift+breathe*vec2(cos(t*1.1+1.0),sin(t*.9)),vec2(.42,.40)*soft,t,4.2)/soft;
    float w3=plume(p,vec2(uAnchor.x+dir*.40,.58)+drift+breathe*vec2(sin(t*1.2),cos(t*.6)),vec2(.30,.26)*soft,t,1.0)/soft;
    vec3 sky=toDisplay(bg);
    sky=1.0-(1.0-sky)*(1.0-k0*w0*uPlume);
    sky=1.0-(1.0-sky)*(1.0-k1*w1*uPlume);
    sky=1.0-(1.0-sky)*(1.0-k2*w2*uPlume);
    sky=1.0-(1.0-sky)*(1.0-k3*w3*uPlume*.8);
    bg=toLinear(sky);
  }
  bg=mix(bg,bg*(.82+uSatelliteColor*.34),uSatelliteMix);
  float vignette=1.0-.16*smoothstep(.38,.92,length((p-.5)*vec2(.92,1.08)));
  gl_FragColor=vec4(bg*vignette,1.0);
  #include <colorspace_fragment>
}
`;
function srgbLuminance(hex){const c=color(hex);const s=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;return .2126*s(c.r)+.7152*s(c.g)+.0722*s(c.b)}
function plumeFor(preset){const sum=preset.palette.slice(0,4).reduce((total,hex)=>total+srgbLuminance(hex),0);return Math.min(SKY_PLUME_RANGE[1],Math.max(SKY_PLUME_RANGE[0],SKY_PLUME_ENERGY/Math.max(.05,sum)))}
function anchorFor(preset){const p=preset.params;return[Math.min(.92,Math.max(.08,.5+(p.offsetX||0)*.21)),Math.min(.55,Math.max(.30,.42+(p.offsetY||0)*.12))]}
function gradientFor(preset){const g=preset.backgroundGradient;return Array.isArray(g)&&g.length>=3?g:[preset.background,preset.background,preset.background]}
function buildBackground(preset){
  const g=gradientFor(preset),sat=satellite.current;
  backgroundMaterial=new THREE.ShaderMaterial({vertexShader:BACKGROUND_VERTEX_SHADER,fragmentShader:BACKGROUND_FRAGMENT_SHADER,depthTest:false,depthWrite:false,transparent:false,toneMapped:false,uniforms:{uBg0From:{value:color(g[0])},uBg1From:{value:color(g[1])},uBg2From:{value:color(g[2])},uBg0To:{value:color(g[0])},uBg1To:{value:color(g[1])},uBg2To:{value:color(g[2])},uMix:{value:1},uSatelliteColor:{value:new THREE.Vector3(...sat.color)},uSatelliteMix:{value:.025+.025*sat.cloud+.018*sat.visible},uSky:{value:mode.current==='sky'?1:0},uTime:{value:mode.skyTime},uPlume:{value:plumeFor(preset)},uAnchor:{value:new THREE.Vector2(...anchorFor(preset))},uP0From:{value:color(preset.palette[0])},uP1From:{value:color(preset.palette[1])},uP2From:{value:color(preset.palette[2])},uP3From:{value:color(preset.palette[3])},uP0To:{value:color(preset.palette[0])},uP1To:{value:color(preset.palette[1])},uP2To:{value:color(preset.palette[2])},uP3To:{value:color(preset.palette[3])},uSkyMotion:{value:new THREE.Vector2(sat.motion[0],sat.motion[1])},uSkyEnergy:{value:sat.energy},uSkyCloud:{value:sat.cloud},uSkyVapor:{value:sat.vapor},uSkyCold:{value:sat.cold}}});
  backgroundMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),backgroundMaterial);backgroundMesh.frustumCulled=false;backgroundMesh.renderOrder=-1000;scene.add(backgroundMesh);
}
function applyBackgroundFrame(from,to,e){if(!backgroundMaterial)return;const fg=gradientFor(from),tg=gradientFor(to),u=backgroundMaterial.uniforms;for(let i=0;i<3;i++){u['uBg'+i+'From'].value.copy(color(fg[i]));u['uBg'+i+'To'].value.copy(color(tg[i]))}for(let i=0;i<4;i++){u['uP'+i+'From'].value.copy(color(from.palette[i]));u['uP'+i+'To'].value.copy(color(to.palette[i]))}const fa=anchorFor(from),ta=anchorFor(to);u.uAnchor.value.set(lerp(fa[0],ta[0],e),lerp(fa[1],ta[1],e));u.uPlume.value=lerp(plumeFor(from),plumeFor(to),e);u.uMix.value=e}
function makeGeometry(rayCount){const rays=Math.max(32,Math.min(80,Math.round(rayCount/4)*4)),count=(rays+1)*(RADIAL_SEGMENTS+1),positions=new Float32Array(count*3),aU=new Float32Array(count),aV=new Float32Array(count),aRayJitter=new Float32Array(count),indices=[],jitters=[];for(let j=0;j<=rays;j++){const v=j/rays,n=Math.sin((j+1)*12.9898+78.233)*43758.5453,m=Math.sin((j+7)*4.123+21.731)*15731.743;jitters[j]=((n-Math.floor(n))-.5)*1.4+((m-Math.floor(m))-.5)*.6;for(let i=0;i<=RADIAL_SEGMENTS;i++){const idx=j*(RADIAL_SEGMENTS+1)+i;aU[idx]=i/RADIAL_SEGMENTS;aV[idx]=v;aRayJitter[idx]=jitters[j]}}for(let j=0;j<rays;j++)for(let i=0;i<RADIAL_SEGMENTS;i++){const a=j*(RADIAL_SEGMENTS+1)+i,b=a+RADIAL_SEGMENTS+1;indices.push(a,b,a+1,b,b+1,a+1)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aU',new THREE.BufferAttribute(aU,1));geometry.setAttribute('aV',new THREE.BufferAttribute(aV,1));geometry.setAttribute('aRayJitter',new THREE.BufferAttribute(aRayJitter,1));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry}
function normalizedLayer(preset,index){const source=preset.layers[index],fallback=preset.layers[0]||{};return source?{seed:source.seed??0,phase:source.phase||0,scale:source.scale||1,rotation:source.rotation||0,offset:[...(source.offset||[0,0,0])],alpha:source.alpha??1}:{seed:(fallback.seed||0)+13.37*(index+1),phase:(fallback.phase||0)+11.9*(index+1),scale:fallback.scale||1,rotation:fallback.rotation||0,offset:[...(fallback.offset||[0,0,0])],alpha:0}}
function setColorUniform(u,name,hex){u[name].value.copy(color(hex))}
function makeMaterial(index,preset){const p=preset.params,s=satellite.current,layer=normalizedLayer(preset,index);return new THREE.ShaderMaterial({vertexShader:BETTA_VERTEX_SHADER,fragmentShader:BETTA_FRAGMENT_SHADER,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,uniforms:{uTime:{value:0},uSeed:{value:layer.seed},uPhase:{value:layer.phase},uSpread:{value:p.spread},uFoldDensity:{value:p.foldDensity},uCurl:{value:p.curl},uTwist:{value:p.twist},uEdgeFlutter:{value:p.edgeFlutter},uDepth:{value:p.depth},uCurrentStrength:{value:p.currentStrength},uMotionSpeed:{value:p.motionSpeed},uTurbulence:{value:p.turbulence},uMotionAmplitude:{value:p.motionAmplitude},uCurrent:{value:new THREE.Vector2(s.motion[0],s.motion[1])},uOpacity:{value:p.opacity},uTransmission:{value:p.transmission},uRimStrength:{value:p.rimStrength},uFoldHighlight:{value:p.foldHighlight},uIridescence:{value:p.iridescence},uBloom:{value:p.bloom},uSaturation:{value:p.saturation},uBrightness:{value:p.brightness},uGradientPosition:{value:p.gradientPosition},uLayerAlpha:{value:layer.alpha},uMorphModeFrom:{value:preset.morphMode||0},uMorphModeTo:{value:preset.morphMode||0},uMorphTransition:{value:1},uColor0From:{value:color(preset.palette[0])},uColor1From:{value:color(preset.palette[1])},uColor2From:{value:color(preset.palette[2])},uColor3From:{value:color(preset.palette[3])},uColor0To:{value:color(preset.palette[0])},uColor1To:{value:color(preset.palette[1])},uColor2To:{value:color(preset.palette[2])},uColor3To:{value:color(preset.palette[3])},uSatelliteEnergy:{value:s.energy},uSatelliteCloud:{value:s.cloud},uSatelliteCold:{value:s.cold},uSatelliteCooling:{value:s.cooling},uSatelliteTexture:{value:s.texture},uSatelliteVapor:{value:s.vapor},uSatelliteVisible:{value:s.visible},uSatelliteMotion:{value:new THREE.Vector2(s.motion[0],s.motion[1])},uSatelliteColor:{value:new THREE.Vector3(...s.color)},uSatelliteFingerprint:{value:new THREE.Vector3(...s.fingerprint)}}})}
function clearFins(){for(const mesh of meshes)scene.remove(mesh);for(const material of materials)material.dispose();meshes.length=0;materials.length=0}
function buildFins(){clearFins();sharedGeometry?.dispose();sharedGeometry=makeGeometry(MAX_RAYS);for(let index=0;index<2;index++){const material=makeMaterial(index,active),mesh=new THREE.Mesh(sharedGeometry,material);mesh.renderOrder=index;mesh.frustumCulled=false;scene.add(mesh);meshes.push(mesh);materials.push(material)}applyPresetFrame(active,active,1)}
function blendParam(a,b,key,t){return lerp(a.params[key],b.params[key],t)}
function applyPresetFrame(from,to,t){
  const e=clamp(t);active=to;activeKey=e>=1?dayCycle.targetPeriod?.baseline||to.__key||activeKey:activeKey;applyBackgroundFrame(from,to,e);
  for(let index=0;index<materials.length;index++){
    const material=materials[index],mesh=meshes[index],u=material.uniforms,a=normalizedLayer(from,index),b=normalizedLayer(to,index);
    for(const key of ['spread','foldDensity','curl','twist','edgeFlutter','depth','currentStrength','motionSpeed','turbulence','motionAmplitude','opacity','transmission','rimStrength','foldHighlight','iridescence','bloom','saturation','brightness','gradientPosition'])u['u'+key[0].toUpperCase()+key.slice(1)].value=blendParam(from,to,key,e);
    u.uSeed.value=lerp(a.seed,b.seed,e);u.uPhase.value=lerp(a.phase,b.phase,e);u.uLayerAlpha.value=lerp(a.alpha,b.alpha,e);u.uMorphModeFrom.value=from.morphMode||0;u.uMorphModeTo.value=to.morphMode||0;u.uMorphTransition.value=e;
    for(let c=0;c<4;c++){setColorUniform(u,`uColor${c}From`,from.palette[c]);setColorUniform(u,`uColor${c}To`,to.palette[c])}
    const scale=lerp(from.params.scale*(a.scale||1),to.params.scale*(b.scale||1),e);mesh.scale.setScalar(scale);mesh.rotation.order='YXZ';mesh.userData.baseRotationX=lerpAngle(from.params.rotationX||0,to.params.rotationX||0,e);mesh.userData.baseRotationY=lerpAngle(from.params.rotationY||0,to.params.rotationY||0,e);mesh.userData.baseRotationZ=lerpAngle(from.params.rotation+(a.rotation||0),to.params.rotation+(b.rotation||0),e);mesh.userData.tiltStrength=lerp(from.params.tiltStrength||.16,to.params.tiltStrength||.16,e);mesh.rotation.set(mesh.userData.baseRotationX,mesh.userData.baseRotationY,mesh.userData.baseRotationZ,'YXZ');mesh.position.set(lerp(from.params.offsetX+(a.offset[0]||0),to.params.offsetX+(b.offset[0]||0),e),lerp(from.params.offsetY+(a.offset[1]||0),to.params.offsetY+(b.offset[1]||0),e),lerp(from.params.cameraDepth+(a.offset[2]||0),to.params.cameraDepth+(b.offset[2]||0),e));mesh.userData.baseZ=mesh.position.z;
  }
}
function applySatelliteUniforms(){const s=satellite.current;for(const material of materials){const u=material.uniforms;u.uCurrent.value.set(s.motion[0],s.motion[1]);u.uSatelliteEnergy.value=s.energy;u.uSatelliteCloud.value=s.cloud;u.uSatelliteCold.value=s.cold;u.uSatelliteCooling.value=s.cooling;u.uSatelliteTexture.value=s.texture;u.uSatelliteVapor.value=s.vapor;u.uSatelliteVisible.value=s.visible;u.uSatelliteMotion.value.set(s.motion[0],s.motion[1]);u.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);u.uSatelliteFingerprint.value.set(s.fingerprint[0],s.fingerprint[1],s.fingerprint[2])}if(backgroundMaterial){const u=backgroundMaterial.uniforms;u.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);u.uSatelliteMix.value=.025+.025*s.cloud+.018*s.visible;u.uSkyMotion.value.set(s.motion[0],s.motion[1]);u.uSkyEnergy.value=s.energy;u.uSkyCloud.value=s.cloud;u.uSkyVapor.value=s.vapor;u.uSkyCold.value=s.cold}}
function rememberedLowEnd(){try{const saved=JSON.parse(localStorage.getItem(SKY_MEMORY_KEY)||'null');return Boolean(saved&&saved.mode==='sky'&&Date.now()-Number(saved.at||0)<SKY_MEMORY_MS)}catch{return false}}
function rememberLowEnd(){try{localStorage.setItem(SKY_MEMORY_KEY,JSON.stringify({mode:'sky',at:Date.now()}))}catch{}}
/* The atmosphere the employee chose in Settings › System (r32b): Betta or
   Sky outranks reduced motion and the low-end memory; Automatic leaves the
   choice to them. Choosing Betta also forgets the low-end memory, so the
   fish comes back at once rather than in seven days. */
function readPreference(){try{const saved=localStorage.getItem(PREFERENCE_KEY);return saved==='sky'||saved==='betta'?saved:'auto'}catch{return'auto'}}
function setBettaPreference(preference='auto'){const next=preference==='sky'||preference==='betta'?preference:'auto';try{if(next==='auto')localStorage.removeItem(PREFERENCE_KEY);else localStorage.setItem(PREFERENCE_KEY,next);if(next==='betta')localStorage.removeItem(SKY_MEMORY_KEY)}catch{}syncMode();return mode.current}
function resolveMode(){if(mode.requested!=='auto')return[mode.requested,'requested'];const preferred=readPreference();if(preferred!=='auto')return[preferred,'preference'];if(reducedMotionQuery.matches)return['sky','reduced-motion'];if(rememberedLowEnd())return['sky','low-end'];return['betta','default']}
function applyMode(next,reason){const changed=next!==mode.current;mode.current=next;mode.reason=reason;document.body.dataset.bettaMode=next;document.body.dataset.bettaModeReason=reason;if(!scene)return;if(changed){if(next==='sky')clearFins();else buildFins()}if(backgroundMaterial)backgroundMaterial.uniforms.uSky.value=next==='sky'?1:0;requestRender()}
function syncMode(){const[next,reason]=resolveMode();if(next!==mode.current||reason!==mode.reason)applyMode(next,reason)}
function setBettaMode(requested='auto'){mode.requested=requested==='sky'||requested==='betta'?requested:'auto';syncMode();return mode.current}
function skyHeld(){return mode.current==='sky'&&reducedMotionQuery.matches}
/* The governor: median frame time over three seconds after the first frame,
   warm-up excluded; a phone under ~36fps with the fish gets the sky. */
function stepGovernor(now,delta){const g=mode.governor;if(g.done||mode.current!=='betta'||mode.requested!=='auto'||readPreference()!=='auto'||navigator.webdriver)return;if(!g.startedAt){g.startedAt=now;return}if(now-g.startedAt<GOVERNOR_WARMUP_MS)return;g.frames.push(delta);if(now-g.startedAt<GOVERNOR_WARMUP_MS+GOVERNOR_WINDOW_MS)return;g.done=true;const sorted=[...g.frames].sort((a,b)=>a-b);mode.frameMs=sorted[sorted.length>>1]||0;if(mode.frameMs>LOW_END_FRAME_MS){rememberLowEnd();applyMode('sky','low-end')}}
function easeSatellite(deltaMs){const seconds=deltaMs*.001,boost=satellite.transitionBoost,response=1-Math.exp(-seconds*(.13+boost*.22)),c=satellite.current,t=satellite.target;for(const key of ['energy','cloud','cold','cooling','texture','vapor','visible'])c[key]=lerp(c[key],t[key],response);for(let i=0;i<2;i++)c.motion[i]=lerp(c.motion[i],t.motion[i],response);for(let i=0;i<3;i++){c.color[i]=lerp(c.color[i],t.color[i],response);c.fingerprint[i]=lerp(c.fingerprint[i],t.fingerprint[i],response)}satellite.transitionBoost=Math.max(0,boost-seconds*.055)}
/* Styles override a period's colors and form - a generated Betta from
   betta-random.js, or one saved on the server - and never its camera: the
   composition keys, ray count and tilt stay the preset's own. Keyed by
   baseline, applied wherever a preset is read, so every transition, pin,
   preview and export sees the styled fish. */
const styles=new Map();
function styled(preset,style){
  if(!style)return preset;
  if(Array.isArray(style.palette)&&style.palette.length>=4)preset.palette=style.palette.slice(0,4).map(String);
  if(Array.isArray(style.backgroundGradient)&&style.backgroundGradient.length>=3){preset.backgroundGradient=style.backgroundGradient.slice(0,3).map(String);preset.background=String(style.background||style.backgroundGradient[0])}
  if(style.params&&typeof style.params==='object')for(const key of Object.keys(preset.params)){if(COMPOSITION_KEYS.includes(key)||key==='rayCount'||key==='tiltStrength')continue;const value=Number(style.params[key]);if(Number.isFinite(value))preset.params[key]=value}
  if(Array.isArray(style.layers)&&style.layers.length)preset.layers=style.layers.map((layer,index)=>{const base=preset.layers[index]||preset.layers[0]||{};return{...base,...layer,offset:[...(layer.offset||base.offset||[0,0,0])]}});
  preset.__seed=style.seed==null?null:String(style.seed);
  return preset;
}
function presetFor(key){const preset=styled(clonePreset(key),styles.get(key));preset.__key=key;return preset}
/* Re-aim the current period at its (re)styled preset with a cross-fade. */
function retarget(duration=DAY_CYCLE_CORRECTION_MS,reason='style'){
  const period=dayCycle.targetPeriod;if(!period||!BETTA_PRESETS[period.baseline])return false;
  const source=dayCycle.to||presetFor(activeKey),target=presetFor(period.baseline);
  dayCycle.from=source;dayCycle.to=target;dayCycle.period=period;dayCycle.t0=performance.now();dayCycle.duration=Math.max(0,duration);dayCycle.rawMix=duration>0?0:1;dayCycle.mix=dayCycle.rawMix;dayCycle.reason=reason;
  if(duration<=0)applyPresetFrame(target,target,1);
  requestRender();return true;
}
function setBettaStyle(periodKey,style,duration=DAY_CYCLE_CORRECTION_MS){const period=periodByKey(periodKey);if(!period)return false;if(style&&typeof style==='object')styles.set(period.baseline,style);else styles.delete(period.baseline);if(dayCycle.targetPeriod?.key===period.key)retarget(duration,'style');return true}
function setBettaStyles(map,duration=DAY_CYCLE_CORRECTION_MS){styles.clear();for(const [key,style] of Object.entries(map||{})){const period=periodByKey(key);if(period&&style&&typeof style==='object')styles.set(period.baseline,style)}if(dayCycle.targetPeriod)retarget(duration,'styles');return true}
function bettaStyleState(){return Object.fromEntries(BETTA_DAY_PERIODS.map(period=>[period.key,styles.get(period.baseline)||null]))}
/* Saved styles are the app's configuration (sindhorn_betta_periods, written
   by Settings › System › Readability Test); this device keeps a copy so the
   launch paints the saved fish before the first frame, not the bundled one
   and then a swap. The shell refreshes the copy from the server after boot
   and hands a changed map to setBettaStyles; saveBettaStyles writes the
   runtime's map, or the map it is given, to the copy. Styles are
   configuration, never a live input: the atmosphere still follows the
   satellite alone. */
function loadSavedStyles(){try{const saved=JSON.parse(localStorage.getItem(STYLES_CACHE_KEY)||'null');if(!saved||typeof saved!=='object')return;for(const [key,style] of Object.entries(saved)){const period=periodByKey(key);if(period&&style&&typeof style==='object')styles.set(period.baseline,style)}}catch(_){}}
function saveBettaStyles(map=bettaStyleState()){try{const kept=Object.fromEntries(Object.entries(map||{}).filter(([key,style])=>periodByKey(key)&&style&&typeof style==='object'));if(Object.keys(kept).length)localStorage.setItem(STYLES_CACHE_KEY,JSON.stringify(kept));else localStorage.removeItem(STYLES_CACHE_KEY);return true}catch(_){return false}}

/* A small second view of the same scene for measuring what the glass will
   show: the Readability Test reads its pixels. It is its own context so the
   page canvas is never read back, and it is dropped when the test closes. */
let sampler=null;
function sampleBettaFrame(width=64){
  if(!scene||!camera||webglContextLost)return null;
  try{
    const w=Math.max(8,Math.round(width)),h=Math.max(8,Math.round(w*(stage?.clientHeight||innerHeight)/Math.max(1,stage?.clientWidth||innerWidth)));
    if(!sampler){const r=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power',precision:'highp',preserveDrawingBuffer:true});r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;r.setPixelRatio(1);sampler={renderer:r,w:0,h:0}}
    if(sampler.w!==w||sampler.h!==h){sampler.renderer.setSize(w,h,false);sampler.w=w;sampler.h=h}
    sampler.renderer.render(scene,camera);
    const gl=sampler.renderer.getContext(),data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
    return{width:w,height:h,data};
  }catch(_){return null}
}
function disposeBettaSampler(){if(!sampler)return;try{sampler.renderer.dispose();sampler.renderer.forceContextLoss?.()}catch(_){}sampler=null}
function updateDayCycleDatasets(){document.body.dataset.bettaBaseline=dayCycle.targetPeriod?.baseline||activeKey;document.body.dataset.bettaPeriod=dayCycle.targetPeriod?.key||'';document.body.dataset.bettaCycleMode=dayCycle.mode}
function transitionToPeriod(period,duration=DAY_CYCLE_CORRECTION_MS,reason='correction'){
  if(!period||!BETTA_PRESETS[period.baseline])return false;
  const target=presetFor(period.baseline);const source=dayCycle.to||presetFor(activeKey);
  if(dayCycle.targetPeriod?.key===period.key&&dayCycle.to&&!dayCycle.preview)return true;
  dayCycle.from=source;dayCycle.to=target;dayCycle.period=dayCycle.targetPeriod||period;dayCycle.targetPeriod=period;dayCycle.t0=performance.now();dayCycle.duration=Math.max(0,duration);dayCycle.rawMix=duration>0?0:1;dayCycle.mix=duration>0?0:1;dayCycle.reason=reason;activeKey=period.baseline;updateDayCycleDatasets();
  if(duration<=0){dayCycle.from=target;dayCycle.to=target;dayCycle.period=period;applyPresetFrame(target,target,1)}
  return true;
}
function currentPeriodForMode(now=performance.now()){
  if(dayCycle.mode==='pin'&&dayCycle.pin)return dayCycle.pin;
  if(dayCycle.mode==='preview'&&dayCycle.preview){const elapsed=(now-dayCycle.preview.startedAt)%dayCycle.preview.durationMs,fraction=(elapsed+dayCycle.preview.durationMs)%dayCycle.preview.durationMs/dayCycle.preview.durationMs;return periodForMinuteOfDay(fraction*1440)}
  return periodForBangkokTime(new Date());
}
function syncDayCycle(now=performance.now(),force=false){const period=currentPeriodForMode(now);if(!period)return;if(dayCycle.targetPeriod?.key===period.key&&!force)return;const duration=dayCycle.mode==='preview'?Math.min(6000,dayCycle.preview.durationMs/8*.28):(force?DAY_CYCLE_CORRECTION_MS:DAY_CYCLE_ROLLOVER_MS);transitionToPeriod(period,duration,dayCycle.mode==='preview'?'preview':force?'correction':'rollover')}
function stepDayCycle(now){if(dayCycle.mode==='preview')syncDayCycle(now);if(!dayCycle.from||!dayCycle.to)return;const raw=dayCycle.duration<=0?1:clamp((now-dayCycle.t0)/dayCycle.duration);const eased=easeDayCycle(raw);dayCycle.rawMix=raw;dayCycle.mix=eased;applyPresetFrame(dayCycle.from,dayCycle.to,eased);if(raw>=1){dayCycle.from=dayCycle.to;dayCycle.period=dayCycle.targetPeriod;dayCycle.mix=1;dayCycle.rawMix=1}}
function setBettaPeriod(key){const period=periodByKey(key);if(!period)return false;dayCycle.mode='pin';dayCycle.pin=period;dayCycle.preview=null;return transitionToPeriod(period,DAY_CYCLE_CORRECTION_MS,'developer-pin')}
function useLiveBettaDayCycle(){dayCycle.mode='live';dayCycle.pin=null;dayCycle.preview=null;syncDayCycle(performance.now(),true);updateDayCycleDatasets();return true}
function previewBettaDayCycle(seconds=180){const durationMs=Math.max(30000,Number(seconds||180)*1000);dayCycle.mode='preview';dayCycle.pin=null;dayCycle.preview={startedAt:performance.now(),durationMs};syncDayCycle(performance.now(),true);updateDayCycleDatasets();return true}
function setBaseline(key){const period=BETTA_DAY_PERIODS.find(item=>item.baseline===key);if(period)return setBettaPeriod(period.key);if(!BETTA_PRESETS[key])return false;dayCycle.mode='manual';dayCycle.pin=null;dayCycle.preview=null;const pseudo={key:`manual-${key}`,name:BETTA_PRESETS[key].name,baseline:key};return transitionToPeriod(pseudo,DAY_CYCLE_CORRECTION_MS,'manual-baseline')}
function previewBettaComposition(periodKey,composition={}){
  const period=periodByKey(periodKey);if(!period||!BETTA_PRESETS[period.baseline]||dayCycle.targetPeriod?.key!==period.key)return false;
  const sourcePreset=BETTA_PRESETS[period.baseline],target=dayCycle.to||presetFor(period.baseline);
  for(const key of COMPOSITION_KEYS){const value=Number(composition[key]);if(!Number.isFinite(value))continue;sourcePreset.params[key]=value;target.params[key]=value;if(dayCycle.rawMix>=1&&dayCycle.from)dayCycle.from.params[key]=value}
  dayCycle.to=target;if(dayCycle.rawMix>=1){dayCycle.from=target;dayCycle.period=dayCycle.targetPeriod;dayCycle.mix=1;dayCycle.rawMix=1}
  applyPresetFrame(dayCycle.from||target,target,dayCycle.rawMix>=1?1:dayCycle.mix);requestRender();return true;
}
function handleDeviceOrientation(event){
  if(!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
  if(!tilt.calibrated){tilt.beta0=event.beta;tilt.gamma0=event.gamma;tilt.calibrated=true}
  tilt.targetX=clamp((event.beta-tilt.beta0)/24,-1,1);tilt.targetY=clamp((event.gamma-tilt.gamma0)/24,-1,1);tilt.lastAt=performance.now();tilt.enabled=true;document.body.dataset.bettaTilt='active';requestRender();
}
async function enableTilt(){
  if(!tilt.supported){tilt.permission='unsupported';document.body.dataset.bettaTilt='unsupported';return false}
  try{
    const permissionRequest=globalThis.DeviceOrientationEvent?.requestPermission;
    if(typeof permissionRequest==='function'){const result=await permissionRequest.call(globalThis.DeviceOrientationEvent);tilt.permission=result;if(result!=='granted'){document.body.dataset.bettaTilt='denied';return false}}
    else tilt.permission='granted';
    if(!tilt.listening){addEventListener('deviceorientation',handleDeviceOrientation,{passive:true});tilt.listening=true}
    tilt.calibrated=false;tilt.targetX=tilt.targetY=tilt.currentX=tilt.currentY=0;document.body.dataset.bettaTilt='ready';return true;
  }catch(error){tilt.permission='error';document.body.dataset.bettaTilt='error';return false}
}
function recenterTilt(){tilt.calibrated=false;tilt.targetX=tilt.targetY=0;return true}
function stepTilt(deltaMs){
  const response=1-Math.exp(-Math.max(0,deltaMs)*.010);tilt.currentX=lerp(tilt.currentX,tilt.targetX,response);tilt.currentY=lerp(tilt.currentY,tilt.targetY,response);
  for(let index=0;index<meshes.length;index++){const mesh=meshes[index],strength=Number(mesh.userData.tiltStrength)||.16,layer=index?0.82:1;mesh.rotation.x=(mesh.userData.baseRotationX||0)+tilt.currentX*strength*layer;mesh.rotation.y=(mesh.userData.baseRotationY||0)+tilt.currentY*strength*layer;mesh.rotation.z=(mesh.userData.baseRotationZ||0)+tilt.currentY*strength*.12*layer;mesh.position.z=(mesh.userData.baseZ||0)+tilt.currentX*strength*.18*layer}
}
function resize(){if(!renderer||!stage||webglContextLost)return;const rect=stage.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width||innerWidth)),h=Math.max(1,Math.round(rect.height||innerHeight));renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=w/h<.7?10.4:9;camera.updateProjectionMatrix()}
function markFirstFrame(){if(firstFrameRendered)return;firstFrameRendered=true;document.body.classList.add('environment-ready');document.body.dataset.bettaFirstFrame='ready';performance.mark?.('sindhorn-betta-first-frame');document.dispatchEvent(new CustomEvent('sindhorn:betta-first-frame'))}
function resumeAfterStartupEntrance(){if(document.documentElement.dataset.startupEnter!=='pending'||matchMedia('(prefers-reduced-motion: reduce)').matches){requestRender();return}const onEnd=event=>{if(event.propertyName!=='opacity')return;canvas.removeEventListener('transitionend',onEnd);requestRender()};canvas.addEventListener('transitionend',onEnd)}
function render(now){raf=0;if(!pageVisible||webglContextLost)return;const delta=Math.min(50,Math.max(0,now-previousNow));previousNow=now;activeTime+=delta*.001*(matchMedia('(prefers-reduced-motion: reduce)').matches?.35:1);easeSatellite(delta);applySatelliteUniforms();stepDayCycle(now);stepTilt(delta);for(const material of materials)material.uniforms.uTime.value=activeTime;if(mode.current==='sky'&&!skyHeld())mode.skyTime+=delta*.001*(.75+.5*satellite.current.energy);if(backgroundMaterial)backgroundMaterial.uniforms.uTime.value=mode.skyTime;renderer.render(scene,camera);if(!firstFrameRendered){markFirstFrame();resumeAfterStartupEntrance();return}stepGovernor(now,delta);raf=requestAnimationFrame(render)}
function requestRender(){if(!raf&&pageVisible&&!webglContextLost){previousNow=performance.now();raf=requestAnimationFrame(render)}}
function stopRender(){if(raf){cancelAnimationFrame(raf);raf=0}}
function handleSatelliteState(state){const changed=satellite.state?.observedAt!==state.observedAt;satellite.status='live';satellite.error=null;satellite.state=state;satellite.target=copyDrivers(state.drivers);if(changed)satellite.transitionBoost=1;document.body.dataset.bettaSatellite='live'}
function handleSatelliteError(error){satellite.error=error?.message||String(error);if(!satellite.state)satellite.status='error';document.body.dataset.bettaSatellite=satellite.state?'stale':'retrying'}
function startSatellite(){if(stopSatellite)return;stopSatellite=startSatelliteStream({onState:handleSatelliteState,onError:handleSatelliteError})}
function pauseSatellite(){if(!stopSatellite)return;const stop=stopSatellite;stopSatellite=null;stop();if(satellite.state){satellite.status='stale';document.body.dataset.bettaSatellite='stale'}}
function setLifecycle(state,reason){lifecycleState=state;lastLifecycleReason=reason;document.body.dataset.bettaLifecycle=state;document.body.dataset.bettaLifecycleReason=reason}
function suspendEnvironment(reason='background'){pageVisible=false;setLifecycle(webglContextLost?'context-lost':'suspended',reason);stopRender();pauseSatellite()}
function resumeEnvironment(reason='foreground'){pageVisible=!document.hidden;if(!pageVisible){setLifecycle(webglContextLost?'context-lost':'suspended',reason);return}startSatellite();if(dayCycle.mode==='live')syncDayCycle(performance.now(),true);if(webglContextLost){setLifecycle('context-lost',reason);return}setLifecycle('active',reason);resize();requestRender()}
function handleContextLost(event){event.preventDefault();webglContextLost=true;stopRender();setLifecycle('context-lost','webglcontextlost');document.body.dataset.bettaContext='lost'}
function handleContextRestored(){webglContextLost=false;document.body.dataset.bettaContext='restored';renderer?.resetState?.();if(mode.current==='betta')buildFins();resumeEnvironment('webglcontextrestored')}
function renderExport(w,h){return new Promise((resolve,reject)=>{try{const exportRenderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.toneMapping=THREE.ACESFilmicToneMapping;exportRenderer.toneMappingExposure=1.05;exportRenderer.setPixelRatio(1);exportRenderer.setSize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),false);const exportCamera=camera.clone();exportCamera.aspect=Math.max(1,w)/Math.max(1,h);exportCamera.position.z=exportCamera.aspect<.7?10.4:9;exportCamera.updateProjectionMatrix();exportRenderer.render(scene,exportCamera);const data=exportRenderer.domElement.toDataURL('image/png',1);exportRenderer.dispose();resolve(data)}catch(error){reject(error)}})}
function dayCycleState(){const clock=bangkokClock(new Date());return{mode:dayCycle.mode,timeZone:BANGKOK_TIME_ZONE,bangkokTime:clock.label,periodKey:dayCycle.period?.key||dayCycle.targetPeriod?.key||null,periodName:dayCycle.period?.name||dayCycle.targetPeriod?.name||null,targetPeriodKey:dayCycle.targetPeriod?.key||null,baseline:dayCycle.period?.baseline||activeKey,targetBaseline:dayCycle.targetPeriod?.baseline||activeKey,transitionMix:dayCycle.mix,transitionRaw:dayCycle.rawMix,transitionDurationMs:dayCycle.duration,reason:dayCycle.reason,rolloverMs:DAY_CYCLE_ROLLOVER_MS,correctionMs:DAY_CYCLE_CORRECTION_MS,checkMs:DAY_CYCLE_CHECK_MS,previewDurationMs:dayCycle.preview?.durationMs||null,periods:BETTA_DAY_PERIODS.map(p=>({...p}))}}

export async function initEnvironment(){
  if(initialized)return;initialized=true;stage=document.getElementById('environmentStage');canvas=document.getElementById('environmentCanvas');if(!stage||!canvas||!window.WebGLRenderingContext){document.body.dataset.environmentWeather='unavailable';return}
  loadSavedStyles();const initialPeriod=periodForBangkokTime(new Date());activeKey=initialPeriod.baseline;active=presetFor(activeKey);dayCycle.period=initialPeriod;dayCycle.targetPeriod=initialPeriod;dayCycle.from=active;dayCycle.to=active;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,50);camera.position.set(0,0,9);renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',precision:'highp',preserveDrawingBuffer:false});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setPixelRatio(DPR);
  const[initialMode,initialReason]=resolveMode();mode.current=initialMode;mode.reason=initialReason;document.body.dataset.bettaMode=initialMode;document.body.dataset.bettaModeReason=initialReason;reducedMotionQuery.addEventListener?.('change',syncMode);
  stage.hidden=false;resize();scene.background=color('#010103');buildBackground(active);if(mode.current==='betta')buildFins();updateDayCycleDatasets();document.body.dataset.bettaFirstFrame='pending';document.body.dataset.environmentRenderer='sindhorn-betta-satellite-v1';document.body.dataset.environmentInput='satellite-only';document.body.dataset.bettaBaselineAuthority='bangkok-day-cycle';document.body.dataset.bettaContext='active';document.body.dataset.bettaTilt=tilt.supported?'available':'unsupported';setLifecycle(pageVisible?'active':'suspended','initial');if(tilt.supported&&typeof globalThis.DeviceOrientationEvent?.requestPermission!=='function')enableTilt().catch(()=>{});
  new ResizeObserver(()=>resize()).observe(stage);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendEnvironment('visibilitychange');else resumeEnvironment('visibilitychange')});addEventListener('pagehide',()=>suspendEnvironment('pagehide'));addEventListener('pageshow',()=>resumeEnvironment('pageshow'));addEventListener('focus',()=>resumeEnvironment('focus'));document.addEventListener('freeze',()=>suspendEnvironment('freeze'));document.addEventListener('resume',()=>resumeEnvironment('resume'));canvas.addEventListener('webglcontextlost',handleContextLost,false);canvas.addEventListener('webglcontextrestored',handleContextRestored,false);document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:location-updated',()=>fetchWeather().catch(()=>{}));startSatellite();
  window.SindhornEnvironment={refreshWeather:()=>fetchWeather().catch(()=>weather),renderExport,setBettaBaseline:setBaseline,setBettaPeriod,useLiveBettaDayCycle,previewBettaDayCycle,previewBettaComposition,setBettaStyle,setBettaStyles,saveBettaStyles,sampleBettaFrame,disposeBettaSampler,setBettaMode,setBettaPreference,enableBettaTilt:enableTilt,recenterBettaTilt:recenterTilt,getState:()=>({weather:{...weather,visual:normalizedWeather(weather)},air:{...(window.SindhornLiveData?.getState?.().air||{})},solar:null,lunar:null,location:{...(window.SindhornLocation?.getState?.()||{})},quality:DPR,config:null,seasonal:null,renderer:'sindhorn-betta-satellite-v1',inputMode:'satellite-only',betta:{mode:mode.current,modeReason:mode.reason,modeRequested:mode.requested,preference:readPreference(),skyHeld:skyHeld(),frameMs:mode.frameMs,baseline:dayCycle.targetPeriod?.baseline||activeKey,baselineAuthority:'bangkok-day-cycle',availableBaselines:[...BASELINE_KEYS],dayCycle:dayCycleState(),styles:bettaStyleState(),satelliteSource:SATELLITE_SOURCE,satelliteStatus:satellite.status,observedAt:satellite.state?.observedAt||null,metrics:satellite.state?.metrics?{...satellite.state.metrics}:null,lifecycle:lifecycleState,lifecycleReason:lastLifecycleReason,contextLost:webglContextLost,satelliteStreaming:Boolean(stopSatellite),rendering:Boolean(raf),firstFrameRendered,tilt:{supported:tilt.supported,enabled:tilt.enabled,listening:tilt.listening,permission:tilt.permission,calibrated:tilt.calibrated,x:tilt.currentX,y:tilt.currentY}}}),applyConfig:()=>{}};
  requestRender();fetchWeather().catch(()=>{});setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);setInterval(()=>{if(dayCycle.mode==='live'&&!document.hidden)syncDayCycle(performance.now())},DAY_CYCLE_CHECK_MS);setInterval(()=>{if(!document.hidden&&!webglContextLost&&!raf)resumeEnvironment('watchdog')},2000);
}
