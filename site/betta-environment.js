import * as THREE from './vendor/three.module.js';
import {BETTA_PRESETS,DEFAULT_PRESET,clonePreset} from './betta-fin-presets.js';
import {BETTA_VERTEX_SHADER,BETTA_FRAGMENT_SHADER} from './betta-fin-shader.js';
import {startSatelliteStream,SATELLITE_SOURCE} from './betta-satellite.js';

const DPR=2;
const RADIAL_SEGMENTS=72;
const WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast?latitude=13.74135&longitude=100.54274&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,is_day&timezone=Asia%2FBangkok';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const WEATHER_CACHE_MAX_AGE=45*60*1000;
const BASELINE_KEYS=Object.freeze(Object.keys(BETTA_PRESETS));
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*t;

let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,raf=0,activeTime=0,previousNow=performance.now();
let activeKey=DEFAULT_PRESET,active=clonePreset(DEFAULT_PRESET),stopSatellite=null,pageVisible=!document.hidden;
let lifecycleState=pageVisible?'active':'suspended',webglContextLost=false,lastLifecycleReason='initial';
const meshes=[],materials=[];
const weather={known:false,cached:false,cloudCover:0,precipitationMm:0,rainMm:0,showersMm:0,snowfallCm:0,humidity:.68,windSpeedKmh:4,windDirectionDeg:180,windGustKmh:null,visibilityKm:20,temperatureC:null,apparentTemperatureC:null,weatherCode:null,isDay:null,observedAt:null};
const neutralDrivers={energy:.58,cloud:.35,cold:.35,cooling:0,texture:.32,vapor:.42,motion:[0,0],color:[.18,.23,.52],visible:0,fingerprint:[.5,.5,.5]};
const copyDrivers=source=>({energy:source.energy,cloud:source.cloud,cold:source.cold,cooling:source.cooling,texture:source.texture,vapor:source.vapor,motion:[...source.motion],color:[...source.color],visible:source.visible,fingerprint:[...source.fingerprint]});
const satellite={status:'loading',state:null,error:null,current:copyDrivers(neutralDrivers),target:copyDrivers(neutralDrivers),transitionBoost:0};

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
function makeGeometry(rayCount){const rays=Math.max(32,Math.min(80,Math.round(rayCount/4)*4)),count=(rays+1)*(RADIAL_SEGMENTS+1),positions=new Float32Array(count*3),aU=new Float32Array(count),aV=new Float32Array(count),aRayJitter=new Float32Array(count),indices=[],jitters=[];for(let j=0;j<=rays;j++){const v=j/rays,n=Math.sin((j+1)*12.9898+78.233)*43758.5453,m=Math.sin((j+7)*4.123+21.731)*15731.743;jitters[j]=((n-Math.floor(n))-.5)*1.4+((m-Math.floor(m))-.5)*.6;for(let i=0;i<=RADIAL_SEGMENTS;i++){const idx=j*(RADIAL_SEGMENTS+1)+i;aU[idx]=i/RADIAL_SEGMENTS;aV[idx]=v;aRayJitter[idx]=jitters[j]}}for(let j=0;j<rays;j++)for(let i=0;i<RADIAL_SEGMENTS;i++){const a=j*(RADIAL_SEGMENTS+1)+i,b=a+RADIAL_SEGMENTS+1;indices.push(a,b,a+1,b,b+1,a+1)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aU',new THREE.BufferAttribute(aU,1));geometry.setAttribute('aV',new THREE.BufferAttribute(aV,1));geometry.setAttribute('aRayJitter',new THREE.BufferAttribute(aRayJitter,1));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry}
function makeMaterial(layer,preset){const p=preset.params,s=satellite.current;return new THREE.ShaderMaterial({vertexShader:BETTA_VERTEX_SHADER,fragmentShader:BETTA_FRAGMENT_SHADER,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,uniforms:{uTime:{value:0},uSeed:{value:layer.seed},uPhase:{value:layer.phase||0},uSpread:{value:p.spread},uFoldDensity:{value:p.foldDensity},uCurl:{value:p.curl},uTwist:{value:p.twist},uEdgeFlutter:{value:p.edgeFlutter},uDepth:{value:p.depth},uCurrentStrength:{value:p.currentStrength},uMotionSpeed:{value:p.motionSpeed},uTurbulence:{value:p.turbulence},uMotionAmplitude:{value:p.motionAmplitude},uCurrent:{value:new THREE.Vector2(s.motion[0],s.motion[1])},uOpacity:{value:p.opacity},uTransmission:{value:p.transmission},uRimStrength:{value:p.rimStrength},uFoldHighlight:{value:p.foldHighlight},uIridescence:{value:p.iridescence},uBloom:{value:p.bloom},uSaturation:{value:p.saturation},uBrightness:{value:p.brightness},uGradientPosition:{value:p.gradientPosition},uLayerAlpha:{value:layer.alpha??1},uMorphMode:{value:preset.morphMode||0},uColor0:{value:color(preset.palette[0])},uColor1:{value:color(preset.palette[1])},uColor2:{value:color(preset.palette[2])},uColor3:{value:color(preset.palette[3])},uSatelliteEnergy:{value:s.energy},uSatelliteCloud:{value:s.cloud},uSatelliteCold:{value:s.cold},uSatelliteCooling:{value:s.cooling},uSatelliteTexture:{value:s.texture},uSatelliteVapor:{value:s.vapor},uSatelliteVisible:{value:s.visible},uSatelliteMotion:{value:new THREE.Vector2(s.motion[0],s.motion[1])},uSatelliteColor:{value:new THREE.Vector3(...s.color)},uSatelliteFingerprint:{value:new THREE.Vector3(...s.fingerprint)}}})}
function clearFins(){for(const mesh of meshes)scene.remove(mesh);for(const material of materials)material.dispose();meshes.length=0;materials.length=0}
function buildFins(){clearFins();sharedGeometry?.dispose();sharedGeometry=makeGeometry(active.params.rayCount);active.layers.forEach((layer,index)=>{const material=makeMaterial(layer,active),mesh=new THREE.Mesh(sharedGeometry,material),p=active.params,scale=p.scale*(layer.scale||1);mesh.scale.setScalar(scale);mesh.rotation.z=p.rotation+(layer.rotation||0);mesh.position.set(p.offsetX+(layer.offset?.[0]||0),p.offsetY+(layer.offset?.[1]||0),p.cameraDepth+(layer.offset?.[2]||0));mesh.renderOrder=index;mesh.frustumCulled=false;scene.add(mesh);meshes.push(mesh);materials.push(material)})}
function applySatelliteUniforms(){const s=satellite.current;for(const material of materials){const u=material.uniforms;u.uCurrent.value.set(s.motion[0],s.motion[1]);u.uSatelliteEnergy.value=s.energy;u.uSatelliteCloud.value=s.cloud;u.uSatelliteCold.value=s.cold;u.uSatelliteCooling.value=s.cooling;u.uSatelliteTexture.value=s.texture;u.uSatelliteVapor.value=s.vapor;u.uSatelliteVisible.value=s.visible;u.uSatelliteMotion.value.set(s.motion[0],s.motion[1]);u.uSatelliteColor.value.set(s.color[0],s.color[1],s.color[2]);u.uSatelliteFingerprint.value.set(s.fingerprint[0],s.fingerprint[1],s.fingerprint[2])}const base=color(active.background),tint=new THREE.Color(s.color[0],s.color[1],s.color[2]);scene.background=base.lerp(tint,.025+.025*s.cloud+.018*s.visible)}
function easeSatellite(deltaMs){const seconds=deltaMs*.001,boost=satellite.transitionBoost,response=1-Math.exp(-seconds*(.13+boost*.22)),c=satellite.current,t=satellite.target;for(const key of ['energy','cloud','cold','cooling','texture','vapor','visible'])c[key]=lerp(c[key],t[key],response);for(let i=0;i<2;i++)c.motion[i]=lerp(c.motion[i],t.motion[i],response);for(let i=0;i<3;i++){c.color[i]=lerp(c.color[i],t.color[i],response);c.fingerprint[i]=lerp(c.fingerprint[i],t.fingerprint[i],response)}satellite.transitionBoost=Math.max(0,boost-seconds*.055)}
function setBaseline(key){if(!BETTA_PRESETS[key])return false;activeKey=key;active=clonePreset(key);buildFins();applySatelliteUniforms();document.body.dataset.bettaBaseline=key;return true}
function resize(){if(!renderer||!stage||webglContextLost)return;const rect=stage.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width||innerWidth)),h=Math.max(1,Math.round(rect.height||innerHeight));renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=w/h<.7?10.4:9;camera.updateProjectionMatrix()}
function render(now){raf=0;if(!pageVisible||webglContextLost)return;const delta=Math.min(50,Math.max(0,now-previousNow));previousNow=now;activeTime+=delta*.001*(matchMedia('(prefers-reduced-motion: reduce)').matches?.35:1);easeSatellite(delta);applySatelliteUniforms();for(const material of materials)material.uniforms.uTime.value=activeTime;renderer.render(scene,camera);raf=requestAnimationFrame(render)}
function requestRender(){if(!raf&&pageVisible&&!webglContextLost){previousNow=performance.now();raf=requestAnimationFrame(render)}}
function stopRender(){if(raf){cancelAnimationFrame(raf);raf=0}}
function handleSatelliteState(state){const changed=satellite.state?.observedAt!==state.observedAt;satellite.status='live';satellite.error=null;satellite.state=state;satellite.target=copyDrivers(state.drivers);if(changed)satellite.transitionBoost=1;document.body.dataset.bettaSatellite='live'}
function handleSatelliteError(error){satellite.error=error?.message||String(error);if(!satellite.state)satellite.status='error';document.body.dataset.bettaSatellite=satellite.state?'stale':'retrying'}
function startSatellite(){if(stopSatellite)return;stopSatellite=startSatelliteStream({onState:handleSatelliteState,onError:handleSatelliteError})}
function pauseSatellite(){if(!stopSatellite)return;const stop=stopSatellite;stopSatellite=null;stop();if(satellite.state){satellite.status='stale';document.body.dataset.bettaSatellite='stale'}}
function setLifecycle(state,reason){lifecycleState=state;lastLifecycleReason=reason;document.body.dataset.bettaLifecycle=state;document.body.dataset.bettaLifecycleReason=reason}
function suspendEnvironment(reason='background'){pageVisible=false;setLifecycle(webglContextLost?'context-lost':'suspended',reason);stopRender();pauseSatellite()}
function resumeEnvironment(reason='foreground'){
  pageVisible=!document.hidden;
  if(!pageVisible){setLifecycle(webglContextLost?'context-lost':'suspended',reason);return}
  startSatellite();
  if(webglContextLost){setLifecycle('context-lost',reason);return}
  setLifecycle('active',reason);resize();requestRender();
}
function handleContextLost(event){event.preventDefault();webglContextLost=true;stopRender();setLifecycle('context-lost','webglcontextlost');document.body.dataset.bettaContext='lost'}
function handleContextRestored(){webglContextLost=false;document.body.dataset.bettaContext='restored';renderer?.resetState?.();buildFins();applySatelliteUniforms();resumeEnvironment('webglcontextrestored')}
function renderExport(w,h){return new Promise((resolve,reject)=>{try{const exportRenderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,precision:'highp'});exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.toneMapping=THREE.ACESFilmicToneMapping;exportRenderer.toneMappingExposure=1.05;exportRenderer.setPixelRatio(1);exportRenderer.setSize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),false);const exportCamera=camera.clone();exportCamera.aspect=Math.max(1,w)/Math.max(1,h);exportCamera.position.z=exportCamera.aspect<.7?10.4:9;exportCamera.updateProjectionMatrix();exportRenderer.render(scene,exportCamera);const data=exportRenderer.domElement.toDataURL('image/png',1);exportRenderer.dispose();resolve(data)}catch(error){reject(error)}})}

export async function initEnvironment(){
  if(initialized)return;
  initialized=true;
  stage=document.getElementById('environmentStage');canvas=document.getElementById('environmentCanvas');
  if(!stage||!canvas||!window.WebGLRenderingContext){document.body.dataset.environmentWeather='unavailable';return}
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,50);camera.position.set(0,0,9);
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',precision:'highp',preserveDrawingBuffer:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setPixelRatio(DPR);
  stage.hidden=false;resize();setBaseline(DEFAULT_PRESET);
  document.body.classList.add('environment-ready');document.body.dataset.environmentRenderer='sindhorn-betta-satellite-v1';document.body.dataset.environmentInput='satellite-only';document.body.dataset.bettaContext='active';setLifecycle(pageVisible?'active':'suspended','initial');
  new ResizeObserver(()=>resize()).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendEnvironment('visibilitychange');else resumeEnvironment('visibilitychange')});
  addEventListener('pagehide',()=>suspendEnvironment('pagehide'));
  addEventListener('pageshow',()=>resumeEnvironment('pageshow'));
  addEventListener('focus',()=>resumeEnvironment('focus'));
  document.addEventListener('freeze',()=>suspendEnvironment('freeze'));
  document.addEventListener('resume',()=>resumeEnvironment('resume'));
  canvas.addEventListener('webglcontextlost',handleContextLost,false);
  canvas.addEventListener('webglcontextrestored',handleContextRestored,false);
  document.addEventListener('sindhorn:route-mounted',renderWeather);
  document.addEventListener('sindhorn:location-updated',()=>fetchWeather().catch(()=>{}));
  startSatellite();
  window.SindhornEnvironment={refreshWeather:()=>fetchWeather().catch(()=>weather),renderExport,setBettaBaseline:setBaseline,getState:()=>({weather:{...weather,visual:normalizedWeather(weather)},air:{...(window.SindhornLiveData?.getState?.().air||{})},solar:null,lunar:null,location:{...(window.SindhornLocation?.getState?.()||{})},quality:DPR,config:null,seasonal:null,renderer:'sindhorn-betta-satellite-v1',inputMode:'satellite-only',betta:{baseline:activeKey,availableBaselines:[...BASELINE_KEYS],satelliteSource:SATELLITE_SOURCE,satelliteStatus:satellite.status,observedAt:satellite.state?.observedAt||null,metrics:satellite.state?.metrics?{...satellite.state.metrics}:null,lifecycle:lifecycleState,lifecycleReason:lastLifecycleReason,contextLost:webglContextLost,satelliteStreaming:Boolean(stopSatellite),rendering:Boolean(raf)}}),applyConfig:()=>{}};
  requestRender();fetchWeather().catch(()=>{});setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);
  setInterval(()=>{if(!document.hidden&&!webglContextLost&&!raf)resumeEnvironment('watchdog')},2000);
}
