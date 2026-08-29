(()=>{
'use strict';
// Device coordinates stay local to weather/astronomy requests. The UI never prints them.
// Production weather transport is TMD AWS + MET Norway via the authenticated Supabase weather core.

const FALLBACK={latitude:13.74135,longitude:100.54274,timezone:'Asia/Bangkok',source:'hotel',permission:'fallback',updatedAt:null,accuracy:null};
const STORAGE_KEY='sindhorn-midtown:user-location:v1';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const PROVIDER_MIGRATION_KEY='sindhorn-midtown:weather-provider:tmd-metno-v1';
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const WEATHER_CORE_ENDPOINT=`${SUPABASE_URL}/functions/v1/sindhorn-weather-core`;
const MAX_CACHE_AGE=6*60*60*1000;
const RESUME_REFRESH_AGE=5*60*1000;
const nativeFetch=window.fetch.bind(window);
let state=loadCached()||{...FALLBACK};
let initialReady=true,resolveReady;
const ready=new Promise(resolve=>{resolveReady=resolve});

function finite(value,min,max){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function cloneState(){return{...state}}
function setDataset(){if(!document.body)return;document.body.dataset.locationMode=state.source;document.body.dataset.locationPermission=state.permission}
function loadCached(){
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    const latitude=finite(value?.latitude,-90,90),longitude=finite(value?.longitude,-180,180),savedAt=Number(value?.savedAt),accuracy=Number(value?.accuracy);
    if(latitude===null||longitude===null||!Number.isFinite(savedAt)||Date.now()-savedAt>MAX_CACHE_AGE)return null;
    return{latitude,longitude,timezone:String(value.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok'),source:'cached',permission:'pending',accuracy:Number.isFinite(accuracy)?accuracy:null,updatedAt:new Date(savedAt).toISOString()};
  }catch(_){return null}
}
function saveDeviceLocation(next){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({latitude:next.latitude,longitude:next.longitude,timezone:next.timezone,accuracy:next.accuracy,savedAt:Date.now()}))}catch(_){ }
}
function clearSavedLocation(){try{localStorage.removeItem(STORAGE_KEY)}catch(_){ }}
function clearWeatherCache(){try{localStorage.removeItem(WEATHER_CACHE_KEY)}catch(_){ }}
function migrateWeatherProvider(){
  try{if(localStorage.getItem(PROVIDER_MIGRATION_KEY)==='1')return;clearWeatherCache();localStorage.setItem(PROVIDER_MIGRATION_KEY,'1')}catch(_){clearWeatherCache()}
}
function distanceMeters(a,b){
  if(!a||!b)return Infinity;const lat1=Number(a.latitude)*Math.PI/180,lat2=Number(b.latitude)*Math.PI/180,dLat=lat2-lat1,dLon=(Number(b.longitude)-Number(a.longitude))*Math.PI/180;
  if(!Number.isFinite(lat1)||!Number.isFinite(lat2)||!Number.isFinite(dLon))return Infinity;const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function movedEnough(a,b){
  if(!a||!b||a.source!==b.source)return true;const accuracy=Math.max(0,Number(a.accuracy)||0,Number(b.accuracy)||0),threshold=Math.max(250,Math.min(1000,accuracy));return distanceMeters(a,b)>=threshold;
}
function ensureWeatherLocation(){
  const host=document.getElementById('weatherNow');if(!host)return null;
  let row=document.getElementById('weatherLocation');
  if(!row){row=document.createElement('p');row.className='weather-location';row.id='weatherLocation';row.innerHTML='<span id="weatherLocationEn"></span>';const meta=host.querySelector('.weather-meta');if(meta)host.insertBefore(row,meta);else host.appendChild(row)}
  return row;
}
function updateWeatherLocation(){
  const row=ensureWeatherLocation();if(!row)return;const en=document.getElementById('weatherLocationEn');if(!en)return;
  if(state.source==='device'){en.textContent='Current device location';return}
  if(state.source==='cached'){en.textContent='Last known device location';return}
  en.textContent='Weather location · Sindhorn Midtown, Bangkok';
}
function dispatch(){setDataset();updateHeaderDate();updateWeatherLocation();document.dispatchEvent(new CustomEvent('sindhorn:location-updated',{detail:cloneState()}))}
function finish(next){const previous=state;if(movedEnough(previous,next))clearWeatherCache();state=next;dispatch();if(initialReady){initialReady=false;resolveReady?.(cloneState())}return cloneState()}
function deviceTimezone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(_){return'UTC'}}
function setTimezone(timezone){if(!timezone||timezone===state.timezone)return;state={...state,timezone:String(timezone)};if(state.source==='device'||state.source==='cached')saveDeviceLocation(state);dispatch()}
function englishDate(date,timezone){return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,day:'numeric',month:'short',year:'numeric'}).format(date)}
function updateHeaderDate(){const en=document.getElementById('todayEn');if(!en)return;const now=new Date(),timezone=state.timezone||deviceTimezone();try{en.textContent=englishDate(now,timezone)}catch(_){ }}
function useFallback(permission='fallback'){return finish({...FALLBACK,permission,updatedAt:new Date().toISOString()})}
function requestLocation(){
  return new Promise(resolve=>{
    if(!navigator.geolocation){resolve(useFallback('unavailable'));return}
    setDataset();navigator.geolocation.getCurrentPosition(position=>{
      const latitude=finite(position?.coords?.latitude,-90,90),longitude=finite(position?.coords?.longitude,-180,180);
      if(latitude===null||longitude===null){resolve(useFallback('unavailable'));return}
      const next={latitude:Number(latitude.toFixed(5)),longitude:Number(longitude.toFixed(5)),timezone:deviceTimezone(),source:'device',permission:'granted',accuracy:Number.isFinite(position.coords.accuracy)?Math.round(position.coords.accuracy):null,updatedAt:new Date().toISOString()};
      saveDeviceLocation(next);resolve(finish(next));
    },error=>{
      if(error?.code===1){clearSavedLocation();resolve(useFallback('denied'));return}
      if(state.source==='cached'||state.source==='device')resolve(finish({...state,permission:'temporarily-unavailable'}));else resolve(useFallback('unavailable'));
    },{enableHighAccuracy:true,timeout:8000,maximumAge:2*60*1000});
  });
}
function locationAge(){const time=Date.parse(String(state.updatedAt||''));return Number.isFinite(time)?Date.now()-time:Infinity}
function refreshIfStale(){if(document.hidden||locationAge()<RESUME_REFRESH_AGE)return;requestLocation().catch(()=>{})}
function weatherHeaders(){const token=window.SindhornEmployeeAuth?.getAccessToken?.();return{'content-type':'application/json',apikey:SUPABASE_KEY,...(token?{authorization:`Bearer ${token}`}:{})}}
async function weatherCoreRequest(){
  const body=JSON.stringify({latitude:state.latitude,longitude:state.longitude}),request=()=>nativeFetch(WEATHER_CORE_ENDPOINT,{method:'POST',cache:'no-store',credentials:'omit',headers:weatherHeaders(),body});
  let response=await request();if(response.status===401&&window.SindhornEmployeeAuth?.refresh){await window.SindhornEmployeeAuth.refresh({force:true});response=await request()}if(!response.ok)throw new Error(`weather_core_${response.status}`);return response.json();
}
function legacyWeatherPayload(core){
  const current=core?.current||{},n=(value,fallback=null)=>value===null||value===undefined||value===''?fallback:Number.isFinite(Number(value))?Number(value):fallback;
  return{latitude:state.latitude,longitude:state.longitude,timezone:state.timezone||'Asia/Bangkok',timezone_abbreviation:'GMT+7',utc_offset_seconds:25200,current:{time:current.observedAt||core?.fetchedAt||new Date().toISOString(),temperature_2m:n(current.temperatureC),apparent_temperature:n(current.apparentTemperatureC),relative_humidity_2m:n(current.humidityPct,68),precipitation:Math.max(0,n(current.precipitationMm,0)),rain:Math.max(0,n(current.rainMm,0)),showers:Math.max(0,n(current.showersMm,0)),snowfall:Math.max(0,n(current.snowfallCm,0)),weather_code:n(current.weatherCode,3),cloud_cover:n(current.cloudCoverPct,80),wind_speed_10m:Math.max(0,n(current.windSpeedKmh,4)),wind_direction_10m:n(current.windDirectionDeg,180),wind_gusts_10m:n(current.windGustKmh),visibility:Math.max(100,n(current.visibilityKm,20)*1000),is_day:null},sindhorn_provider:{current:current?.source?.current||current.provider||'tmd-aws',cloud:current?.source?.cloud||'met-no-locationforecast',forecast:current?.source?.forecast||'met-no-locationforecast',open_meteo_used:false,rain_now:core?.rainNow||null}};
}
function weatherResponse(core){return new Response(JSON.stringify(legacyWeatherPayload(core)),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-sindhorn-weather-provider':'tmd-aws+met-no'}})}

window.fetch=async function(input,init){
  let url;try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch(_){return nativeFetch(input,init)}
  // environment.js still asks through its legacy URL contract; this adapter replaces the transport completely.
  const legacyWeatherRequest=url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast';if(!legacyWeatherRequest)return nativeFetch(input,init);
  await ready;const core=await weatherCoreRequest();return weatherResponse(core);
};

window.SindhornLocation={ready,getState:cloneState,refresh:requestLocation,setTimezone,updateHeaderDate,updateWeatherLocation};
document.addEventListener('sindhorn:route-mounted',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:pack-updated',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:air-updated',updateHeaderDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateHeaderDate();updateWeatherLocation();refreshIfStale()}});
window.addEventListener('pageshow',()=>{updateHeaderDate();updateWeatherLocation();refreshIfStale()});
migrateWeatherProvider();setInterval(updateHeaderDate,60*1000);setDataset();requestLocation().catch(()=>{if(initialReady){initialReady=false;resolveReady?.(cloneState())}});
})();
