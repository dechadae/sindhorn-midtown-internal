import {effectiveWeatherSnapshot,locationKey,resolveWeatherAuthority} from './weather-authority.js?v=3';

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const WEATHER_CORE_ENDPOINT=`${SUPABASE_URL}/functions/v1/sindhorn-weather-core`;
const ACTIVE_POLL_MS=3*60*1000;
const RESUME_STALE_MS=2*60*1000;
const REQUEST_TIMEOUT_MS=6500;
let rainNow={ok:false,status:'unavailable',provider:'tmd-aws',observedAt:null,fetchedAt:null,rainNow:null};
let resolution=null,authorityMemory=null,currentLocationKey='unknown',lastFetchAt=0,timer=0,inflight=null,originalEnvironmentGetState=null,bridgeInstalled=false;

function rawEnvironmentState(){try{return originalEnvironmentGetState?originalEnvironmentGetState():window.SindhornEnvironment?.getState?.()||null}catch(_){return null}}
function baseWeatherState(){return rawEnvironmentState()?.weather||{known:false,weatherCode:null,observedAt:null}}
function safeLocation(){const loc=window.SindhornLocation?.getState?.()||{};return{latitude:Number(loc.latitude),longitude:Number(loc.longitude),source:String(loc.source||'unknown'),updatedAt:loc.updatedAt||null}}
function locationSignature(loc=safeLocation()){return`${loc.source}:${locationKey(loc)}`}
function authHeaders(){const token=window.SindhornEmployeeAuth?.getAccessToken?.();return{'content-type':'application/json',apikey:SUPABASE_KEY,...(token?{authorization:`Bearer ${token}`}:{})}}
function sanitizeRainNow(core){
  const value=core?.rainNow;if(!core?.ok||!value||value.available!==true)return{ok:false,status:'unavailable',provider:String(value?.provider||'tmd-aws'),observedAt:value?.observedAt||null,fetchedAt:core?.fetchedAt||new Date().toISOString(),rainNow:null};
  const n=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback,explicit=value.rainNow===true?true:value.rainNow===false?false:null;
  return{ok:true,status:'ok',available:true,provider:String(value.provider||'tmd-aws'),observedAt:value.observedAt||null,fetchedAt:core.fetchedAt||new Date().toISOString(),rainNow:explicit,rainIntensityMmHr:explicit===true?.4:0,precipitationIntensityMmHr:explicit===true?.4:0,precipitationProbability:explicit===true?100:0,weatherCode:n(value.weatherCode,-1),stationNameEn:String(value.stationNameEn||''),stationDistanceKm:Number.isFinite(Number(value.stationDistanceKm))?Number(value.stationDistanceKm):null,precip15MinsMm:Math.max(0,n(value.precip15MinsMm)),precip1HrMm:Math.max(0,n(value.precip1HrMm)),reason:String(value.reason||''),confidence:String(value.confidence||'unknown')};
}
function resolvedWeatherFrom(base={}){const weather=resolution?effectiveWeatherSnapshot(base,resolution):base;return resolution?.active?{...weather,known:true}:weather}
function effectiveWeather(){return resolvedWeatherFrom(rawEnvironmentState()?.weather||{})}
function installEnvironmentBridge(){
  const env=window.SindhornEnvironment;if(!env||bridgeInstalled||typeof env.getState!=='function')return false;
  originalEnvironmentGetState=env.getState.bind(env);env.getState=()=>{const snapshot=originalEnvironmentGetState(),weather=resolvedWeatherFrom(snapshot.weather);return{...snapshot,weather,rainNow:resolution?{active:resolution.active,state:resolution.precipitationState,label:resolution.label,authority:resolution.authority,confidence:resolution.confidence,fresh:resolution.rainNowFresh,stale:resolution.rainNowStale,rainRateMmHr:resolution.rainRateMmHr}:null}};bridgeInstalled=true;return true;
}
function applyLabel(){const node=document.getElementById('weatherConditionEn');if(node&&resolution?.label)node.textContent=resolution.label}
function updateDatasets(){if(!document.body||!resolution)return;document.body.dataset.rainAuthority=String(resolution.authority||'observed-weather');document.body.dataset.rainState=String(resolution.precipitationState||'dry');document.body.dataset.rainNow=resolution.rainNowFresh?'fresh':resolution.rainNowStale?'stale':'unknown'}
function dispatchResolvedWeather(){
  const weather=effectiveWeather(),detail={rainAuthorityResolved:true,weatherCode:weather.weatherCode,cloudWeatherCode:weather.cloudWeatherCode??weather.weatherCode,precipitationMm:weather.precipitationMm,rainMm:weather.rainMm,precipitationActive:Boolean(weather.precipitationActive),precipitationState:weather.precipitationState||'dry',rainAuthority:weather.rainAuthority||'observed-weather'};
  document.dispatchEvent(new CustomEvent('sindhorn:weather-updated',{detail}));document.dispatchEvent(new CustomEvent('sindhorn:rain-authority-updated',{detail:{...detail,label:resolution?.label||null,confidence:resolution?.confidence||null,rainRateMmHr:resolution?.rainRateMmHr||0}}));
}
function sanitizeDebug(){const debug=document.querySelector('.environment-debug');if(!debug)return;const current=String(debug.textContent||''),lines=current.split('\n'),next=lines.map(line=>/^location\s/i.test(line)&&!/precise coordinates hidden/i.test(line)?`location ${safeLocation().source} · precise coordinates hidden`:line).join('\n');if(next!==current)debug.textContent=next}
function recompute({wakeRain=true}={}){installEnvironmentBridge();const weather=baseWeatherState();currentLocationKey=locationSignature();resolution=resolveWeatherAuthority({weather,rainNow,previous:authorityMemory,nowMs:Date.now(),locationKey:currentLocationKey});authorityMemory=resolution.state;applyLabel();updateDatasets();sanitizeDebug();if(wakeRain)dispatchResolvedWeather();return resolution}
async function providerRequest(){
  const loc=safeLocation();if(!Number.isFinite(loc.latitude)||!Number.isFinite(loc.longitude))throw new Error('location_unavailable');const body=JSON.stringify({latitude:loc.latitude,longitude:loc.longitude}),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS),request=()=>fetch(WEATHER_CORE_ENDPOINT,{method:'POST',cache:'no-store',credentials:'omit',headers:authHeaders(),body,signal:controller.signal});
  try{let response=await request();if(response.status===401&&window.SindhornEmployeeAuth?.refresh){await window.SindhornEmployeeAuth.refresh({force:true});response=await request()}if(!response.ok)throw new Error(`weather_core_${response.status}`);return sanitizeRainNow(await response.json())}finally{clearTimeout(timeout)}
}
async function refreshRainNow({force=false}={}){if(document.hidden&&!force)return resolution;if(inflight)return inflight;if(!force&&Date.now()-lastFetchAt<RESUME_STALE_MS)return recompute({wakeRain:false});inflight=(async()=>{lastFetchAt=Date.now();try{rainNow=await providerRequest()}catch(_){rainNow={ok:false,status:'unavailable',provider:'tmd-aws',observedAt:null,fetchedAt:new Date().toISOString(),rainNow:null}}return recompute()})().finally(()=>{inflight=null});return inflight}
function schedule(){clearInterval(timer);timer=window.setInterval(()=>{if(!document.hidden)refreshRainNow().catch(()=>{})},ACTIVE_POLL_MS)}
function locationChanged(event){const next=event?.detail||safeLocation(),signature=`${String(next.source||'unknown')}:${locationKey(next)}`;if(signature!==currentLocationKey){authorityMemory=null;currentLocationKey=signature;lastFetchAt=0;refreshRainNow({force:true}).catch(()=>{})}else recompute()}
async function waitForRuntime(){const deadline=Date.now()+15000;while(Date.now()<deadline){if(window.SindhornLocation&&window.SindhornEnvironment&&window.SindhornEmployeeAuth){installEnvironmentBridge();return true}await new Promise(resolve=>setTimeout(resolve,50))}return false}
async function init(){
  if(!await waitForRuntime())return;await window.SindhornLocation.ready.catch(()=>{});currentLocationKey=locationSignature();recompute({wakeRain:false});window.SindhornRainNow={refresh:()=>refreshRainNow({force:true}),getState:()=>resolution?{active:resolution.active,state:resolution.precipitationState,label:resolution.label,authority:resolution.authority,confidence:resolution.confidence,rainRateMmHr:resolution.rainRateMmHr,rainNowFresh:resolution.rainNowFresh,rainNowStale:resolution.rainNowStale,provider:rainNow.provider,observedAt:rainNow.observedAt,stationNameEn:rainNow.stationNameEn||null,stationDistanceKm:rainNow.stationDistanceKm??null,precip15MinsMm:rainNow.precip15MinsMm??null,precip1HrMm:rainNow.precip1HrMm??null}:null};
  document.addEventListener('sindhorn:weather-updated',event=>{if(event.detail?.rainAuthorityResolved)return;recompute()});document.addEventListener('sindhorn:location-updated',locationChanged);document.addEventListener('sindhorn:route-mounted',()=>{applyLabel();sanitizeDebug()});document.addEventListener('sindhorn:air-updated',sanitizeDebug);document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const loc=safeLocation(),age=Date.now()-Date.parse(String(loc.updatedAt||''));if(!Number.isFinite(age)||age>5*60*1000)window.SindhornLocation?.refresh?.().catch(()=>{});if(Date.now()-lastFetchAt>RESUME_STALE_MS)refreshRainNow({force:true}).catch(()=>{});applyLabel();sanitizeDebug()});schedule();refreshRainNow({force:true}).catch(()=>{});
}
init().catch(()=>{});
