import {effectiveWeatherSnapshot,locationKey,resolveWeatherAuthority} from './weather-authority.js';

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const RAIN_NOW_ENDPOINT=`${SUPABASE_URL}/functions/v1/sindhorn-rain-now`;
const ACTIVE_POLL_MS=3*60*1000;
const RESUME_STALE_MS=2*60*1000;
const REQUEST_TIMEOUT_MS=4000;
let rainNow={ok:false,status:'unavailable',provider:'tomorrow-io',observedAt:null,fetchedAt:null};
let resolution=null,authorityMemory=null,currentLocationKey='unknown',lastFetchAt=0,timer=0,inflight=null,originalEnvironmentGetState=null,bridgeInstalled=false;

function rawEnvironmentState(){try{return originalEnvironmentGetState?originalEnvironmentGetState():window.SindhornEnvironment?.getState?.()||null}catch(_){return null}}
function openMeteoState(){return rawEnvironmentState()?.weather||{known:false,weatherCode:null,observedAt:null}}
function safeLocation(){const loc=window.SindhornLocation?.getState?.()||{};return{latitude:Number(loc.latitude),longitude:Number(loc.longitude),source:String(loc.source||'unknown'),updatedAt:loc.updatedAt||null}}
function locationSignature(loc=safeLocation()){return`${loc.source}:${locationKey(loc)}`}
function authHeaders(){const token=window.SindhornEmployeeAuth?.getAccessToken?.();return{'content-type':'application/json',apikey:SUPABASE_KEY,...(token?{authorization:`Bearer ${token}`}:{})}}
function sanitizeRainNow(value){
  if(!value||value.ok!==true)return{ok:false,status:'unavailable',provider:'tomorrow-io',observedAt:null,fetchedAt:new Date().toISOString()};
  const n=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
  return{ok:true,status:'ok',provider:'tomorrow-io',observedAt:value.observedAt||null,fetchedAt:value.fetchedAt||new Date().toISOString(),rainIntensityMmHr:Math.max(0,n(value.rainIntensityMmHr)),precipitationIntensityMmHr:Math.max(0,n(value.precipitationIntensityMmHr)),precipitationProbability:Math.max(0,n(value.precipitationProbability)),weatherCode:n(value.weatherCode,-1),providerLatencyMs:Math.max(0,n(value.providerLatencyMs))};
}
function effectiveWeather(){const base=rawEnvironmentState()?.weather||{};return resolution?effectiveWeatherSnapshot(base,resolution):base}
function installEnvironmentBridge(){
  const env=window.SindhornEnvironment;if(!env||bridgeInstalled||typeof env.getState!=='function')return false;
  originalEnvironmentGetState=env.getState.bind(env);env.getState=()=>{const snapshot=originalEnvironmentGetState(),weather=resolution?effectiveWeatherSnapshot(snapshot.weather,resolution):snapshot.weather;return{...snapshot,weather,rainNow:resolution?{active:resolution.active,state:resolution.precipitationState,label:resolution.label,authority:resolution.authority,confidence:resolution.confidence,fresh:resolution.rainNowFresh,stale:resolution.rainNowStale}:null}};bridgeInstalled=true;return true;
}
function applyLabel(){const node=document.getElementById('weatherConditionEn');if(node&&resolution?.label)node.textContent=resolution.label}
function updateDatasets(){if(!document.body||!resolution)return;document.body.dataset.rainAuthority=String(resolution.authority||'open-meteo');document.body.dataset.rainState=String(resolution.precipitationState||'dry');document.body.dataset.rainNow=resolution.rainNowFresh?'fresh':resolution.rainNowStale?'stale':'fallback'}
function dispatchResolvedWeather(){
  const weather=effectiveWeather();document.dispatchEvent(new CustomEvent('sindhorn:weather-updated',{detail:{rainAuthorityResolved:true,weatherCode:weather.weatherCode,cloudWeatherCode:weather.cloudWeatherCode??weather.weatherCode,precipitationMm:weather.precipitationMm,rainMm:weather.rainMm,precipitationActive:Boolean(weather.precipitationActive),precipitationState:weather.precipitationState||'dry',rainAuthority:weather.rainAuthority||'open-meteo'}}));
}
function recompute({wakeRain=true}={}){
  installEnvironmentBridge();const open=openMeteoState();currentLocationKey=locationSignature();resolution=resolveWeatherAuthority({openMeteo:open,rainNow,previous:authorityMemory,nowMs:Date.now(),locationKey:currentLocationKey});authorityMemory=resolution.state;applyLabel();updateDatasets();if(wakeRain)dispatchResolvedWeather();return resolution;
}
async function providerRequest(){
  const loc=safeLocation();if(!Number.isFinite(loc.latitude)||!Number.isFinite(loc.longitude))throw new Error('location_unavailable');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);try{
    const response=await fetch(RAIN_NOW_ENDPOINT,{method:'POST',cache:'no-store',credentials:'omit',headers:authHeaders(),body:JSON.stringify({latitude:loc.latitude,longitude:loc.longitude}),signal:controller.signal});
    if(response.status===401&&window.SindhornEmployeeAuth?.refresh){await window.SindhornEmployeeAuth.refresh({force:true});const retry=await fetch(RAIN_NOW_ENDPOINT,{method:'POST',cache:'no-store',credentials:'omit',headers:authHeaders(),body:JSON.stringify({latitude:loc.latitude,longitude:loc.longitude})});if(!retry.ok)throw new Error(`rain_now_${retry.status}`);return sanitizeRainNow(await retry.json())}
    if(!response.ok)throw new Error(`rain_now_${response.status}`);return sanitizeRainNow(await response.json());
  }finally{clearTimeout(timeout)}
}
async function refreshRainNow({force=false}={}){
  if(document.hidden&&!force)return resolution;if(inflight)return inflight;if(!force&&Date.now()-lastFetchAt<RESUME_STALE_MS)return recompute({wakeRain:false});
  inflight=(async()=>{lastFetchAt=Date.now();try{rainNow=await providerRequest()}catch(_){rainNow={ok:false,status:'unavailable',provider:'tomorrow-io',observedAt:null,fetchedAt:new Date().toISOString()}}return recompute()})().finally(()=>{inflight=null});return inflight;
}
function schedule(){clearInterval(timer);timer=window.setInterval(()=>{if(!document.hidden)refreshRainNow().catch(()=>{})},ACTIVE_POLL_MS)}
function locationChanged(event){const next=event?.detail||safeLocation(),signature=`${String(next.source||'unknown')}:${locationKey(next)}`;if(signature!==currentLocationKey){authorityMemory=null;currentLocationKey=signature;lastFetchAt=0;refreshRainNow({force:true}).catch(()=>{})}else recompute()}
function sanitizeDebug(){const debug=document.querySelector('.environment-debug');if(!debug)return;const current=String(debug.textContent||''),lines=current.split('\n'),next=lines.map(line=>/^location\s/i.test(line)&&!/precise coordinates hidden/i.test(line)?`location ${safeLocation().source} · precise coordinates hidden`:line).join('\n');if(next!==current)debug.textContent=next}
async function waitForRuntime(){
  const deadline=Date.now()+15000;while(Date.now()<deadline){if(window.SindhornLocation&&window.SindhornEnvironment&&window.SindhornEmployeeAuth){installEnvironmentBridge();return true}await new Promise(resolve=>setTimeout(resolve,50))}return false;
}
async function init(){
  if(!await waitForRuntime())return;await window.SindhornLocation.ready.catch(()=>{});currentLocationKey=locationSignature();recompute({wakeRain:false});
  document.addEventListener('sindhorn:weather-updated',event=>{if(event.detail?.rainAuthorityResolved)return;recompute()});document.addEventListener('sindhorn:location-updated',locationChanged);document.addEventListener('sindhorn:route-mounted',()=>{applyLabel();sanitizeDebug()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const loc=safeLocation(),age=Date.now()-Date.parse(String(loc.updatedAt||''));if(!Number.isFinite(age)||age>5*60*1000)window.SindhornLocation?.refresh?.().catch(()=>{});if(Date.now()-lastFetchAt>RESUME_STALE_MS)refreshRainNow({force:true}).catch(()=>{});applyLabel();sanitizeDebug()});
  const observer=new MutationObserver(sanitizeDebug);observer.observe(document.body,{subtree:true,childList:true,characterData:true});schedule();refreshRainNow({force:true}).catch(()=>{});
  window.SindhornRainNow={refresh:()=>refreshRainNow({force:true}),getState:()=>resolution?{active:resolution.active,state:resolution.precipitationState,label:resolution.label,authority:resolution.authority,confidence:resolution.confidence,rainNowFresh:resolution.rainNowFresh,rainNowStale:resolution.rainNowStale}:null};
}
init().catch(()=>{});
