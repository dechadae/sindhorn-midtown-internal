import { buildPushPayload } from '@block65/webcrypto-web-push';

const AIR_URL='https://stations.airbkk.com/api/web/data';
const AIR_STATIONS=['114','139','65'];
const HOTEL_LAT=13.74135;
const HOTEL_LON=100.54274;
const MAX_AIR_AGE_MS=12*60*60*1000;
const AIR_OUTAGE_ALERT_MS=60*60*1000;
const PREVIEW_ORIGIN=/^https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev$/i;

const AIR_LEVELS=[
  {en:'Very good',th:'ดีมาก',guidanceEn:'Normal outdoor activities can continue.',guidanceTh:'สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ'},
  {en:'Good',th:'ดี',guidanceEn:'Outdoor activities can continue as normal.',guidanceTh:'สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ'},
  {en:'Moderate',th:'ปานกลาง',guidanceEn:'Consider reducing strenuous outdoor activity.',guidanceTh:'ควรลดระยะเวลาทำกิจกรรมกลางแจ้งที่ใช้แรงมาก'},
  {en:'Health impact begins',th:'เริ่มมีผลกระทบต่อสุขภาพ',guidanceEn:'Limit outdoor activity and take protective measures.',guidanceTh:'ควรจำกัดกิจกรรมกลางแจ้งและป้องกันตนเอง'},
  {en:'Unhealthy',th:'มีผลกระทบต่อสุขภาพ',guidanceEn:'Avoid outdoor activity where possible.',guidanceTh:'ควรงดกิจกรรมกลางแจ้งเท่าที่ทำได้'}
];

function json(data,status=200,origin=''){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if(origin){headers['access-control-allow-origin']=origin;headers['vary']='Origin'}
  return new Response(JSON.stringify(data),{status,headers});
}
function allowedOrigin(origin,env){return origin===env.ALLOWED_ORIGIN||PREVIEW_ORIGIN.test(origin||'')}
function corsHeaders(origin){return{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600','vary':'Origin'}}
function finite(value,min,max){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function levelForPm(pm){if(pm<=15)return 0;if(pm<=25)return 1;if(pm<=37.5)return 2;if(pm<=75)return 3;return 4}
function calculatedAqi(pm){const ranges=[[0,15,0,25],[15.1,25,26,50],[25.1,37.5,51,100],[37.6,75,101,200],[75.1,500,201,500]],r=ranges[levelForPm(pm)];return Math.round(((r[3]-r[2])/(r[1]-r[0]))*(pm-r[0])+r[2])}
function parseBangkok(value){if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value))return null;const date=new Date(value.replace(' ','T')+'+07:00');return Number.isFinite(date.getTime())?date:null}
function validAirRow(row){const pm=finite(row?.['PM2.5'],0,500),date=parseBangkok(row?.DateTime);return pm!==null&&date&&Date.now()-date.getTime()>=-15*60*1000&&Date.now()-date.getTime()<=MAX_AIR_AGE_MS}
function airLevel(pm){const index=levelForPm(pm);return{index,...AIR_LEVELS[index]}}

async function ensureSchema(env){
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, expiration_time INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS monitor_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
}
async function stateGet(env,key){const row=await env.DB.prepare('SELECT value FROM monitor_state WHERE key=?').bind(key).first();if(!row?.value)return null;try{return JSON.parse(row.value)}catch(_){return null}}
async function stateSet(env,key,value){const now=new Date().toISOString();await env.DB.prepare('INSERT INTO monitor_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),now,now).run()}
async function stateDelete(env,key){await env.DB.prepare('DELETE FROM monitor_state WHERE key=?').bind(key).run()}

async function fetchAir(){
  const response=await fetch(AIR_URL,{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/plain, */*','origin':'https://official.airbkk.com','referer':'https://official.airbkk.com/'},body:JSON.stringify({message:'Request data'})});
  if(!response.ok)throw new Error('AirBKK '+response.status);
  const payload=await response.json();if(payload?.status!=='Success'||!Array.isArray(payload.message))throw new Error('Unexpected AirBKK response');
  let row=null;for(const id of AIR_STATIONS){row=payload.message.find(item=>String(item?.MeasIndex)===id&&validAirRow(item));if(row)break}
  if(!row)throw new Error('No valid AirBKK station reading');
  const pm=finite(row['PM2.5'],0,500),rawAqi=finite(row.aqi,0,500),observed=parseBangkok(row.DateTime),level=airLevel(pm);
  return{stationId:String(row.MeasIndex),pm,aqi:rawAqi===null?calculatedAqi(pm):Math.round(rawAqi),observedAt:observed.toISOString(),category:level.index,categoryEn:level.en,categoryTh:level.th,guidanceEn:level.guidanceEn,guidanceTh:level.guidanceTh};
}
function weatherSeverity(code,gust){
  const n=Number(code)||0,g=Number(gust)||0;if([95,96,99].includes(n))return 2;if([65,67,82].includes(n)||g>=60)return 1;return 0;
}
function weatherLabel(code){
  const n=Number(code)||0;if([95,96,99].includes(n))return{en:'Thunderstorm',th:'พายุฝนฟ้าคะนอง'};if([65,67,82].includes(n))return{en:'Heavy rain',th:'ฝนตกหนัก'};return{en:'Strong winds',th:'ลมแรง'};
}
async function fetchWeather(){
  const url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude',String(HOTEL_LAT));url.searchParams.set('longitude',String(HOTEL_LON));url.searchParams.set('current','weather_code,precipitation,rain,showers,cloud_cover,wind_speed_10m,wind_gusts_10m');url.searchParams.set('timezone','Asia/Bangkok');
  const response=await fetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error('Open-Meteo '+response.status);const data=await response.json(),current=data?.current;if(!current)throw new Error('Missing Open-Meteo current state');
  const code=Number(current.weather_code)||0,gust=Number(current.wind_gusts_10m)||0,severity=weatherSeverity(code,gust),label=weatherLabel(code);
  return{code,severity,labelEn:label.en,labelTh:label.th,precipitation:Number(current.precipitation)||0,rain:Number(current.rain)||0,showers:Number(current.showers)||0,cloudCover:Number(current.cloud_cover)||0,windSpeed:Number(current.wind_speed_10m)||0,windGusts:gust,observedAt:String(current.time||new Date().toISOString())};
}

function validSubscription(value){
  if(!value||typeof value!=='object')return null;let endpoint;try{endpoint=new URL(String(value.endpoint||''))}catch(_){return null}if(endpoint.protocol!=='https:')return null;
  const p256dh=String(value.keys?.p256dh||''),auth=String(value.keys?.auth||'');if(!p256dh||!auth||p256dh.length>512||auth.length>512||endpoint.href.length>4096)return null;
  const expiration=Number(value.expirationTime);return{endpoint:endpoint.href,p256dh,auth,expirationTime:Number.isFinite(expiration)?Math.round(expiration):null};
}
async function saveSubscription(env,subscription){const now=new Date().toISOString();await env.DB.prepare('INSERT INTO push_subscriptions(endpoint,p256dh,auth,expiration_time,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,expiration_time=excluded.expiration_time,updated_at=excluded.updated_at').bind(subscription.endpoint,subscription.p256dh,subscription.auth,subscription.expirationTime,now,now).run()}
async function deleteSubscription(env,endpoint){await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run()}

async function sendOne(env,row,payload){
  const subscription={endpoint:row.endpoint,expirationTime:row.expiration_time??null,keys:{p256dh:row.p256dh,auth:row.auth}};
  const vapid={subject:env.VAPID_SUBJECT,publicKey:env.VAPID_SERVER_PUBLIC_KEY,privateKey:env.VAPID_SERVER_PRIVATE_KEY};
  const request=await buildPushPayload({data:payload,options:{ttl:300,urgency:'high'}},subscription,vapid),response=await fetch(subscription.endpoint,request);
  if(response.status===404||response.status===410){await deleteSubscription(env,row.endpoint);return{expired:true,status:response.status}}
  if(!response.ok)throw new Error('Push service '+response.status);return{sent:true,status:response.status};
}
async function notifyAll(env,payload){
  if(!env.VAPID_SERVER_PUBLIC_KEY||!env.VAPID_SERVER_PRIVATE_KEY)return{sent:0,failed:0,expired:0,configured:false};
  const {results=[]}=await env.DB.prepare('SELECT endpoint,p256dh,auth,expiration_time FROM push_subscriptions').all();let sent=0,failed=0,expired=0;
  for(let i=0;i<results.length;i+=40){const batch=results.slice(i,i+40),outcomes=await Promise.allSettled(batch.map(row=>sendOne(env,row,payload)));for(const outcome of outcomes){if(outcome.status==='rejected'){failed++;continue}if(outcome.value?.expired)expired++;else if(outcome.value?.sent)sent++}}
  return{sent,failed,expired,configured:true};
}
function airWorsePayload(air){return{kind:'air-quality-worse',tag:'air-quality-alert',route:'/guidance',titleEn:'AIR QUALITY HAS WORSENED',titleTh:'คุณภาพอากาศแย่ลง',bodyEn:`PM2.5 ${air.pm.toFixed(1)} µg/m³ · Thai AQI ${air.aqi}. ${air.guidanceEn}`,bodyTh:`${air.categoryTh} · ${air.guidanceTh}`}}
function airBetterPayload(air){return{kind:'air-quality-better',tag:'air-quality-alert',route:'/guidance',titleEn:'AIR QUALITY HAS IMPROVED',titleTh:'คุณภาพอากาศดีขึ้น',bodyEn:`PM2.5 ${air.pm.toFixed(1)} µg/m³ · Thai AQI ${air.aqi}. Outdoor plans can be reassessed.`,bodyTh:`${air.categoryTh} · สามารถประเมินแผนกิจกรรมกลางแจ้งอีกครั้งได้`}}
function weatherPayload(weather){return{kind:'severe-weather',tag:'weather-alert',route:'/',titleEn:'WEATHER ALERT NEAR SINDHORN MIDTOWN',titleTh:'แจ้งเตือนสภาพอากาศใกล้สินธร มิดทาวน์',bodyEn:`${weather.labelEn}. Wind gusts ${Math.round(weather.windGusts)} km/h · precipitation ${weather.precipitation.toFixed(1)} mm.`,bodyTh:`${weather.labelTh} · ลมกระโชก ${Math.round(weather.windGusts)} กม./ชม.`}}
function outagePayload(){return{kind:'air-data-delay',tag:'air-data-alert',route:'/details',titleEn:'AIR QUALITY DATA DELAY',titleTh:'ข้อมูลคุณภาพอากาศล่าช้า',bodyEn:'AirBKK data has been unavailable for more than one hour. Check the app before making outdoor plans.',bodyTh:'ไม่สามารถรับข้อมูล AirBKK ได้นานกว่าหนึ่งชั่วโมง โปรดตรวจสอบแอปก่อนวางแผนกิจกรรมกลางแจ้ง'}}

async function evaluateAndNotify(env){
  await ensureSchema(env);const now=Date.now(),notifications=[];const [airResult,weatherResult]=await Promise.allSettled([fetchAir(),fetchWeather()]);
  if(airResult.status==='fulfilled'){
    const air=airResult.value,previous=await stateGet(env,'air');
    if(previous&&Number.isInteger(previous.category)){
      if(air.category>previous.category&&air.category>=2)notifications.push(await notifyAll(env,airWorsePayload(air)));
      else if(previous.category>=2&&air.category<=1)notifications.push(await notifyAll(env,airBetterPayload(air)));
    }
    await stateSet(env,'air',air);await stateDelete(env,'air_unavailable');
  }else{
    const unavailable=await stateGet(env,'air_unavailable');if(!unavailable){await stateSet(env,'air_unavailable',{since:now,notified:false})}else if(!unavailable.notified&&now-Number(unavailable.since||now)>=AIR_OUTAGE_ALERT_MS){notifications.push(await notifyAll(env,outagePayload()));await stateSet(env,'air_unavailable',{since:Number(unavailable.since)||now,notified:true})}
  }
  if(weatherResult.status==='fulfilled'){
    const weather=weatherResult.value,previous=await stateGet(env,'weather');if(previous&&Number.isInteger(previous.severity)&&weather.severity>previous.severity&&weather.severity>=1)notifications.push(await notifyAll(env,weatherPayload(weather)));await stateSet(env,'weather',weather);
  }
  const summary={checkedAt:new Date().toISOString(),airOk:airResult.status==='fulfilled',weatherOk:weatherResult.status==='fulfilled',notifications};await stateSet(env,'last_evaluation',summary);return summary;
}

async function handleFetch(request,env){
  await ensureSchema(env);const url=new URL(request.url),origin=request.headers.get('origin')||'';
  if(request.method==='OPTIONS'){if(!allowedOrigin(origin,env))return new Response(null,{status:403});return new Response(null,{status:204,headers:corsHeaders(origin)})}
  if(request.method==='GET'&&url.pathname==='/health'){
    const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first(),last=await stateGet(env,'last_evaluation');return json({ok:true,service:'sindhorn-midtown-alerts',subscriptions:Number(row?.count)||0,vapidConfigured:Boolean(env.VAPID_SERVER_PUBLIC_KEY&&env.VAPID_SERVER_PRIVATE_KEY),lastEvaluation:last},200,allowedOrigin(origin,env)?origin:'');
  }
  if(request.method==='GET'&&url.pathname==='/air-current'){
    if(!allowedOrigin(origin,env))return json({error:'origin_not_allowed'},403);
    try{return json(await fetchAir(),200,origin)}catch(error){console.error('air-current failed',error);return json({error:'air_unavailable'},503,origin)}
  }
  if(request.method==='GET'&&url.pathname==='/vapid-public-key'){
    if(!env.VAPID_SERVER_PUBLIC_KEY)return json({error:'vapid_unavailable'},503,allowedOrigin(origin,env)?origin:'');return json({publicKey:env.VAPID_SERVER_PUBLIC_KEY},200,allowedOrigin(origin,env)?origin:'');
  }
  if((url.pathname==='/subscribe')&&(request.method==='POST'||request.method==='DELETE')){
    if(!allowedOrigin(origin,env))return json({error:'origin_not_allowed'},403);
    let body;try{body=await request.json()}catch(_){return json({error:'invalid_json'},400,origin)}
    if(request.method==='POST'){
      const subscription=validSubscription(body);if(!subscription)return json({error:'invalid_subscription'},400,origin);await saveSubscription(env,subscription);return json({ok:true},200,origin);
    }
    let endpoint;try{endpoint=new URL(String(body?.endpoint||'')).href}catch(_){return json({error:'invalid_endpoint'},400,origin)}await deleteSubscription(env,endpoint);return json({ok:true},200,origin);
  }
  return json({error:'not_found'},404,allowedOrigin(origin,env)?origin:'');
}

export default{
  fetch(request,env){return handleFetch(request,env).catch(error=>{console.error(error);return json({error:'internal_error'},500)})},
  scheduled(_controller,env,ctx){ctx.waitUntil(evaluateAndNotify(env).catch(error=>console.error('scheduled evaluation failed',error)))}
};