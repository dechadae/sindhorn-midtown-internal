(()=>{
'use strict';
// Current weather location is rendered from the same geolocation state used by Open-Meteo.

const FALLBACK={latitude:13.74135,longitude:100.54274,timezone:'Asia/Bangkok',source:'hotel',permission:'fallback',updatedAt:null};
const STORAGE_KEY='sindhorn-midtown:user-location:v1';
const WEATHER_CACHE_KEY='sindhorn-midtown:weather:v2';
const MAX_CACHE_AGE=24*60*60*1000;
const nativeFetch=window.fetch.bind(window);
let state=loadCached()||{...FALLBACK};
let resolveReady;
const ready=new Promise(resolve=>{resolveReady=resolve});

function finite(value,min,max){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function cloneState(){return{...state}}
function setDataset(){if(!document.body)return;document.body.dataset.locationMode=state.source;document.body.dataset.locationPermission=state.permission}
function loadCached(){
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    const latitude=finite(value?.latitude,-90,90),longitude=finite(value?.longitude,-180,180),savedAt=Number(value?.savedAt);
    if(latitude===null||longitude===null||!Number.isFinite(savedAt)||Date.now()-savedAt>MAX_CACHE_AGE)return null;
    return{latitude,longitude,timezone:String(value.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok'),source:'cached',permission:'pending',updatedAt:new Date(savedAt).toISOString()};
  }catch(_){return null}
}
function saveDeviceLocation(next){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({latitude:next.latitude,longitude:next.longitude,timezone:next.timezone,savedAt:Date.now()}))}catch(_){ }
}
function clearSavedLocation(){try{localStorage.removeItem(STORAGE_KEY)}catch(_){ }}
function clearWeatherCache(){try{localStorage.removeItem(WEATHER_CACHE_KEY)}catch(_){ }}
function movedEnough(a,b){return!a||!b||Math.abs(Number(a.latitude)-Number(b.latitude))>.01||Math.abs(Number(a.longitude)-Number(b.longitude))>.01||a.source!==b.source}
function coordinate(value,positive,negative){const n=Number(value);return`${Math.abs(n).toFixed(4)}° ${n>=0?positive:negative}`}
function ensureWeatherLocation(){
  const host=document.getElementById('weatherNow');if(!host)return null;
  let row=document.getElementById('weatherLocation');
  if(!row){
    row=document.createElement('p');row.className='weather-location';row.id='weatherLocation';
    row.innerHTML='<span id="weatherLocationEn"></span>';
    const meta=host.querySelector('.weather-meta');if(meta)host.insertBefore(row,meta);else host.appendChild(row);
  }
  return row;
}
function updateWeatherLocation(){
  const row=ensureWeatherLocation();if(!row)return;
  const en=document.getElementById('weatherLocationEn');
  if(state.source==='device'){
    const lat=coordinate(state.latitude,'N','S'),lon=coordinate(state.longitude,'E','W');
    if(en)en.textContent=`Current location · ${lat} · ${lon}`;
    return;
  }
  if(state.source==='cached'){
    const lat=coordinate(state.latitude,'N','S'),lon=coordinate(state.longitude,'E','W');
    if(en)en.textContent=`Last known location · ${lat} · ${lon}`;
    return;
  }
  if(en)en.textContent='Weather location · Sindhorn Midtown, Bangkok';
}
function dispatch(){setDataset();updateHeaderDate();updateWeatherLocation();document.dispatchEvent(new CustomEvent('sindhorn:location-updated',{detail:cloneState()}))}
function finish(next){const previous=state;if(movedEnough(previous,next))clearWeatherCache();state=next;dispatch();resolveReady?.(cloneState())}
function deviceTimezone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(_){return'UTC'}}
function setTimezone(timezone){
  if(!timezone||timezone===state.timezone)return;
  state={...state,timezone:String(timezone)};
  if(state.source==='device'||state.source==='cached')saveDeviceLocation(state);
  dispatch();
}
function englishDate(date,timezone){return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,day:'numeric',month:'short',year:'numeric'}).format(date)}
function thaiDate(date,timezone){return new Intl.DateTimeFormat('th-TH-u-ca-buddhist',{timeZone:timezone,day:'numeric',month:'short',year:'numeric'}).format(date)}
function updateHeaderDate(){
  const en=document.getElementById('todayEn');
  if(!en&&!th)return;
  const now=new Date(),timezone=state.timezone||deviceTimezone();
  try{if(en)en.textContent=englishDate(now,timezone);if(th)th.textContent=thaiDate(now,timezone)}catch(_){ }
}
function useFallback(permission='fallback'){
  finish({...FALLBACK,permission,updatedAt:new Date().toISOString()});
}
function requestLocation(){
  if(!navigator.geolocation){useFallback('unavailable');return}
  setDataset();
  navigator.geolocation.getCurrentPosition(position=>{
    const latitude=finite(position?.coords?.latitude,-90,90),longitude=finite(position?.coords?.longitude,-180,180);
    if(latitude===null||longitude===null){useFallback('unavailable');return}
    const next={latitude:Number(latitude.toFixed(5)),longitude:Number(longitude.toFixed(5)),timezone:deviceTimezone(),source:'device',permission:'granted',accuracy:Number.isFinite(position.coords.accuracy)?Math.round(position.coords.accuracy):null,updatedAt:new Date().toISOString()};
    saveDeviceLocation(next);finish(next);
  },error=>{
    if(error?.code===1){clearSavedLocation();useFallback('denied');return}
    if(state.source==='cached')finish({...state,permission:'temporarily-unavailable'});else useFallback('unavailable');
  },{enableHighAccuracy:false,timeout:9000,maximumAge:5*60*1000});
}

window.fetch=async function(input,init){
  let url;
  try{url=new URL(input instanceof Request?input.url:String(input),location.href)}catch(_){return nativeFetch(input,init)}
  const isWeather=url.hostname==='api.open-meteo.com'&&url.pathname==='/v1/forecast';
  if(!isWeather)return nativeFetch(input,init);
  await ready;
  if(state.source==='device'||state.source==='cached'){
    url.searchParams.set('latitude',String(state.latitude));
    url.searchParams.set('longitude',String(state.longitude));
    url.searchParams.set('timezone','auto');
  }
  const rewritten=input instanceof Request?new Request(url.toString(),input):url.toString();
  const response=await nativeFetch(rewritten,init);
  try{
    response.clone().json().then(value=>{
      if(value?.timezone)setTimezone(value.timezone);
    }).catch(()=>{});
  }catch(_){ }
  return response;
};

window.SindhornLocation={
  ready,
  getState:cloneState,
  refresh:()=>new Promise(resolve=>{
    resolveReady=resolve;requestLocation();
  }),
  setTimezone,
  updateHeaderDate,
  updateWeatherLocation
};

document.addEventListener('sindhorn:route-mounted',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:pack-updated',()=>{updateHeaderDate();updateWeatherLocation()});
document.addEventListener('sindhorn:air-updated',updateHeaderDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateHeaderDate();updateWeatherLocation()}});
window.addEventListener('pageshow',()=>{updateHeaderDate();updateWeatherLocation()});
setInterval(updateHeaderDate,60*1000);
setDataset();
requestLocation();
})();
