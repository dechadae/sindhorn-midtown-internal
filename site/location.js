(()=>{
'use strict';
// Device coordinates stay local to the weather/astronomy request path. The UI never prints them.

const FALLBACK={latitude:13.74135,longitude:100.54274,timezone:'Asia/Bangkok',source:'hotel',permission:'fallback',updatedAt:null,accuracy:null};
const STORAGE_KEY='sindhorn-midtown:user-location:v1';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
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

window.fetch=async function(input,init){
  let url;try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch(_){return nativeFetch(input,init)}
  const isWeather=url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast';if(!isWeather)return nativeFetch(input,init);
  await ready;
  if(state.source==='device'||state.source==='cached'){url.searchParams.set('latitude',String(state.latitude));url.searchParams.set('longitude',String(state.longitude));url.searchParams.set('timezone','auto')}
  const rewritten=input instanceof Request?new Request(url.toString(),input):url.toString(),response=await nativeFetch(rewritten,init);
  try{response.clone().json().then(value=>{if(value?.timezone)setTimezone(value.timezone)}).catch(()=>{})}catch(_){ }
  return response;
};

window.SindhornLocation={ready,getState:cloneState,refresh:requestLocation,setTimezone,updateHeaderDate,updateWeatherLocation};
document.addEventListener('sindhorn:route-mounted',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:pack-updated',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:air-updated',updateHeaderDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateHeaderDate();updateWeatherLocation();refreshIfStale()}});
window.addEventListener('pageshow',()=>{updateHeaderDate();updateWeatherLocation();refreshIfStale()});
setInterval(updateHeaderDate,60*1000);setDataset();requestLocation().catch(()=>{if(initialReady){initialReady=false;resolveReady?.(cloneState())}});
})();
