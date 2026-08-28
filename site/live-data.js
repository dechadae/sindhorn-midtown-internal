import {PUSH_API_BASE} from './push-config.js';

const AIR_URL=PUSH_API_BASE+'/air-current';
const CACHE_KEY='sindhorn-midtown:pm25:last-good:v1';
const STATION_IDS=['114','139','65'];
const POLL_MS=15*60*1000;
const MAX_CACHE_AGE=12*60*60*1000;
const motionQuery=window.matchMedia?.('(prefers-reduced-motion:reduce)')||{matches:false};
const LEVELS=[
  {code:'very-good',en:'Very good',leadEn:'Air quality is suitable for normal outdoor activities.',allEn:'Enjoy your usual outdoor plans.',riskEn:'Continue your usual routine.'},
  {code:'good',en:'Good',leadEn:'Outdoor activities can continue as normal.',allEn:'Enjoy your usual outdoor plans.',riskEn:'Watch for unusual coughing, breathing difficulty or fatigue.'},
  {code:'moderate',en:'Moderate',leadEn:'Consider reducing strenuous outdoor activity.',allEn:'Reduce the duration of strenuous outdoor exercise.',riskEn:'Wear a PM2.5 mask outdoors and reduce strenuous activity.'},
  {code:'impact',en:'Health impact begins',leadEn:'Limit outdoor activity and take protective measures.',allEn:'Wear a PM2.5 mask outdoors and limit strenuous exercise.',riskEn:'Avoid strenuous outdoor activity. Move indoors if symptoms occur.'},
  {code:'unhealthy',en:'Unhealthy',leadEn:'Avoid outdoor activity where possible.',allEn:'Avoid outdoor exercise and wear a PM2.5 mask when outside.',riskEn:'Stay indoors where possible and seek medical advice if symptoms occur.'}
];
const STATIONS={
  '114':{en:'Lumpini Park · Pathum Wan',areaEn:'Rama IV Road, Wang Mai, Pathum Wan'},
  '139':{en:'Chulalongkorn Hospital · Pathum Wan',areaEn:'Rama IV Road, Pathum Wan'},
  '65':{en:'Samyan Mitrtown · Pathum Wan',areaEn:'Rama IV Road, Pathum Wan'}
};
let requestController=null,pollTimer=null,lastFetchAt=0,inFlight=null,state={air:null,delivery:'loading',error:null};
const metricAnimations=new Map(),el=id=>document.getElementById(id),set=(id,value)=>{const node=el(id);if(node)node.textContent=value};
function updateMetric(id,text){const node=el(id);if(!node)return;metricAnimations.get(id)?.cancel();if(node.textContent===text)return;node.textContent=text;if(motionQuery.matches||!node.animate)return;const animation=node.animate([{opacity:.28,transform:'translate3d(0,6px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});metricAnimations.set(id,animation);animation.onfinish=()=>metricAnimations.delete(id)}
function finite(value,min,max){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function parseBangkok(value){if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value))return null;const date=new Date(value.replace(' ','T')+'+07:00');return Number.isFinite(date.getTime())?date:null}
function recentObservation(value){const date=typeof value==='string'?(parseBangkok(value)||new Date(value)):new Date(value);if(!date||!Number.isFinite(date.getTime()))return null;const age=Date.now()-date.getTime();return age>=-15*60*1000&&age<=MAX_CACHE_AGE?date:null}
function levelFor(pm){if(pm<=15)return 0;if(pm<=25)return 1;if(pm<=37.5)return 2;if(pm<=75)return 3;return 4}
function calculatedAqi(pm){const ranges=[[0,15,0,25],[15.1,25,26,50],[25.1,37.5,51,100],[37.6,75,101,200],[75.1,500,201,500]],r=ranges[levelFor(pm)];return Math.round(((r[3]-r[2])/(r[1]-r[0]))*(pm-r[0])+r[2])}
function englishDate(date,withYear=true){const options={timeZone:'Asia/Bangkok',day:'numeric',month:'short'};if(withYear)options.year='numeric';return new Intl.DateTimeFormat('en-GB',options).format(date)}
function englishTime(date){return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',hour:'numeric',minute:'2-digit',hour12:true}).format(date).replace(/\s?(AM|PM)$/,(match,period)=>' '+period.toLowerCase())}
function updateToday(){const now=new Date();set('todayEn',englishDate(now,true));}
function normalize(payload){const id=String(payload?.stationId||''),pm=finite(payload?.pm,0,500),rawAqi=finite(payload?.aqi,0,500),observed=recentObservation(payload?.observedAt),names=STATIONS[id];if(!STATION_IDS.includes(id)||pm===null||!observed||!names)throw new Error('Unexpected AirBKK proxy response');return{stationId:id,stationEn:names.en,areaEn:names.areaEn,pm,aqi:rawAqi===null?calculatedAqi(pm):Math.round(rawAqi),observedAt:observed.toISOString(),fetchedAt:new Date().toISOString()}}
function validateCache(value){return value&&finite(value.pm,0,500)!==null&&finite(value.aqi,0,500)!==null&&recentObservation(value.observedAt)?value:null}
function save(value){try{localStorage.setItem(CACHE_KEY,JSON.stringify(value))}catch(_){}}
function load(){try{return validateCache(JSON.parse(localStorage.getItem(CACHE_KEY)||'null'))}catch(_){return null}}
function connection(status,en){const node=el('connection');if(node)node.dataset.state=status;set('connectionEn',en)}
function renderState(){
  updateToday();const value=state.air;
  if(!value){if(state.delivery==='unavailable'){connection('unavailable','Unavailable');updateMetric('pmValue','—');updateMetric('aqiValue','—');set('levelIndex','Air quality level unavailable');set('categoryEn','Data unavailable');set('guidanceEn','Please try refreshing in a few minutes.');set('everyoneEn','Check the report again before making outdoor plans.');set('sensitiveEn','Follow your usual health precautions until data returns.');const report=el('report');if(report)report.setAttribute('aria-busy','false')}return}
  const pm=finite(value.pm,0,500),index=levelFor(pm),level=LEVELS[index],observed=new Date(value.observedAt),delayed=Date.now()-observed.getTime()>3*60*60*1000;document.body.dataset.level=level.code;
  set('stationEn',value.stationEn);set('areaEn',value.areaEn);updateMetric('pmValue',pm.toFixed(1));updateMetric('aqiValue',String(Math.round(value.aqi)));el('pmValue')?.setAttribute('aria-label','PM2.5 '+pm.toFixed(1)+' micrograms per cubic metre');el('aqiValue')?.setAttribute('aria-label','Thai AQI '+Math.round(value.aqi));
  set('levelIndex','Level '+(index+1)+' / 5');set('categoryEn',level.en);set('guidanceEn',level.leadEn);set('everyoneEn',level.allEn);set('sensitiveEn',level.riskEn);set('observedEn',englishDate(observed,true)+' · '+englishTime(observed)+' · 24h avg');
  const marker=el('scaleMarker');if(marker){marker.style.opacity='1';marker.style.left=((index*20)+10)+'%'}document.querySelectorAll('.scale-labels [role=listitem]').forEach((item,itemIndex)=>item.toggleAttribute('aria-current',itemIndex===index));
  if(state.delivery==='cached')connection('offline','Last available');else if(delayed)connection('delayed','Delayed');else connection('live','Live');const report=el('report');if(report)report.setAttribute('aria-busy','false');
}
async function fetchReading(){requestController=new AbortController();const timeout=setTimeout(()=>requestController.abort(),12000);try{const response=await fetch(AIR_URL,{credentials:'omit',cache:'no-store',signal:requestController.signal});if(!response.ok)throw new Error('Air proxy '+response.status);return normalize(await response.json())}finally{clearTimeout(timeout);requestController=null}}
async function refresh(manual=false){if(inFlight)return inFlight;inFlight=(async()=>{lastFetchAt=Date.now();if(manual)connection('loading','Refreshing');const report=el('report');if(report)report.setAttribute('aria-busy','true');try{const value=await fetchReading();save(value);state={air:value,delivery:'live',error:null};renderState();document.dispatchEvent(new CustomEvent('sindhorn:air-updated',{detail:{...value,delivery:'live'}}));return value}catch(error){const cached=load();if(cached){state={air:cached,delivery:'cached',error};renderState();document.dispatchEvent(new CustomEvent('sindhorn:air-updated',{detail:{...cached,delivery:'cached'}}));return cached}state={air:null,delivery:'unavailable',error};renderState();document.dispatchEvent(new CustomEvent('sindhorn:air-updated',{detail:{pm:null,aqi:null,delivery:'unavailable'}}));throw error}finally{inFlight=null}})();return inFlight}
export async function initLiveData(){const cached=load();if(cached)state={air:cached,delivery:'cached',error:null};renderState();document.addEventListener('sindhorn:route-mounted',renderState);document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateToday();if(Date.now()-lastFetchAt>5*60*1000)refresh(false).catch(()=>{})}});window.addEventListener('online',()=>refresh(false).catch(()=>{}));window.addEventListener('pageshow',event=>{updateToday();if(event.persisted&&Date.now()-lastFetchAt>5*60*1000)refresh(false).catch(()=>{})});window.addEventListener('pagehide',event=>{if(event.persisted)return;if(requestController)requestController.abort()});pollTimer=setInterval(()=>{updateToday();if(!document.hidden)refresh(false).catch(()=>{})},POLL_MS);window.SindhornLiveData={refresh,getState:()=>({air:state.air?{...state.air}:null,delivery:state.delivery}),renderCurrent:renderState};refresh(false).catch(()=>{})}