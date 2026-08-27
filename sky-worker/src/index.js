import { automatedCameras, publicCameraMetadata } from './cameras.js';
import { SKY_ANALYSIS_SCHEMA, chooseCameras, fuseObservations, solarPosition, validateObservation, clamp } from './calibration.js';

const MODEL='@cf/qwen/qwen3.8-27b';
const HOTEL_LAT=13.74135;
const HOTEL_LON=100.54274;
const PREVIEW_ORIGIN=/^https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev$/i;
const MAX_IMAGE_BYTES=4_500_000;
const MAX_ANALYSES_PER_RUN=3;
const REUSE_ANALYSIS_MS=12*60*60*1000;
const OPEN_METEO='https://api.open-meteo.com/v1/forecast';

function allowedOrigin(origin,env){return origin===env.ALLOWED_ORIGIN||PREVIEW_ORIGIN.test(origin||'')}
function cors(origin){return origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{}}
function json(value,status=200,origin=''){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(origin)}})}
function parseJson(value){if(value&&typeof value==='object')return value;if(typeof value!=='string')return null;try{return JSON.parse(value)}catch(_){const match=value.match(/\{[\s\S]*\}/);if(!match)return null;try{return JSON.parse(match[0])}catch(__){return null}}}
function normalizeAiResponse(value){if(!value)return null;if(value.skyVisible!==undefined)return value;if(value.response!==undefined)return parseJson(value.response);if(value.result!==undefined)return parseJson(value.result);const content=value?.choices?.[0]?.message?.content;if(content!==undefined)return parseJson(content);return parseJson(value)}
function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));return btoa(binary)}
async function sha256(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function prefix(env){return String(env.STATE_PREFIX||'prod').replace(/[^a-z0-9_-]/gi,'_')}
function stateKey(env,key){return `${prefix(env)}:${key}`}
function cameraKey(env,cameraId){return `${prefix(env)}:${cameraId}`}

async function ensureSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sky_camera_observations (
    camera_id TEXT PRIMARY KEY,
    frame_hash TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sky_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}
async function stateGet(env,key){const row=await env.DB.prepare('SELECT value FROM sky_state WHERE key=?').bind(stateKey(env,key)).first();if(!row?.value)return null;return parseJson(row.value)}
async function stateSet(env,key,value){const now=new Date().toISOString();await env.DB.prepare('INSERT INTO sky_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(stateKey(env,key),JSON.stringify(value),now).run()}
async function observationRow(env,cameraId){return env.DB.prepare('SELECT frame_hash,observed_at,analysis_json,updated_at FROM sky_camera_observations WHERE camera_id=?').bind(cameraKey(env,cameraId)).first()}
async function saveObservation(env,observation){const now=new Date().toISOString();await env.DB.prepare('INSERT INTO sky_camera_observations(camera_id,frame_hash,observed_at,analysis_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(camera_id) DO UPDATE SET frame_hash=excluded.frame_hash,observed_at=excluded.observed_at,analysis_json=excluded.analysis_json,updated_at=excluded.updated_at').bind(cameraKey(env,observation.id),observation.frameHash,observation.frameFetchedAt,JSON.stringify(observation),now).run()}

function decodeHtmlUrl(value){return String(value||'').replaceAll('\\/','/').replaceAll('&amp;','&')}
function resolveImageUrl(html){
  const normalized=decodeHtmlUrl(html);
  const direct=normalized.match(/https:\/\/images-webcams\.windy\.com\/[A-Za-z0-9_./?=&%-]+/i)?.[0];
  if(direct)return direct;
  const generic=normalized.match(/https:\/\/[^"'<>\s]+\.(?:jpe?g|png|webp)(?:\?[^"'<>\s]*)?/i)?.[0];
  return generic||null;
}
async function resolveCameraImage(camera){
  const page=await fetch(camera.sourcePage,{headers:{accept:'text/html','user-agent':'SindhornMidtownSkyCalibration/1.0'},redirect:'follow'});
  if(!page.ok)throw new Error(`camera page ${page.status}`);
  const html=await page.text(),url=resolveImageUrl(html);if(!url)throw new Error('camera image URL not found');
  return url;
}
async function fetchCameraFrame(camera){
  const imageUrl=await resolveCameraImage(camera),response=await fetch(imageUrl,{headers:{accept:'image/avif,image/webp,image/png,image/jpeg,*/*'},redirect:'follow',cache:'no-store'});
  if(!response.ok)throw new Error(`camera image ${response.status}`);
  const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!type.startsWith('image/'))throw new Error(`camera MIME ${type||'unknown'}`);
  const contentLength=Number(response.headers.get('content-length')||0);if(contentLength>MAX_IMAGE_BYTES)throw new Error('camera image too large');
  const buffer=await response.arrayBuffer();if(buffer.byteLength<1500||buffer.byteLength>MAX_IMAGE_BYTES)throw new Error('camera image size invalid');
  return{buffer,type,hash:await sha256(buffer),fetchedAt:new Date().toISOString()};
}

function analysisPrompt(camera,solar,weather){
  return `Analyze only the visible Bangkok sky and horizon in this public camera frame. Ignore people, vehicles, signs, buildings and any identifying detail. Camera direction: ${camera.facing}. Solar altitude ${solar.altitude.toFixed(1)} degrees, azimuth ${solar.azimuth.toFixed(1)} degrees. Local weather baseline: WMO ${weather?.code??'unknown'}, cloud cover ${Math.round((weather?.cloudCover??0)*100)}%, precipitation ${weather?.precipitation??0} mm. Return only the requested structured atmospheric values. RGB arrays represent observed zenith and horizon colors. Set skyVisible=false and low quality/confidence if too little sky is visible, the frame is badly exposed, obstructed, night-black without useful cloud evidence, or unsuitable for atmospheric calibration. Do not infer PM2.5 numbers.`;
}
async function analyzeFrame(env,camera,frame,solar,weather){
  if(!env.AI)throw new Error('Workers AI binding unavailable');
  const image=`data:${frame.type};base64,${bytesToBase64(new Uint8Array(frame.buffer))}`;
  const response=await env.AI.run(MODEL,{
    messages:[
      {role:'system',content:'You are a calibrated sky-observation sensor. Analyze atmospheric appearance only. Output strict JSON matching the supplied schema.'},
      {role:'user',content:analysisPrompt(camera,solar,weather)}
    ],
    image,
    response_format:{type:'json_schema',json_schema:{name:'bangkok_sky_observation',strict:true,schema:SKY_ANALYSIS_SCHEMA}},
    temperature:0,
    max_tokens:500
  });
  const raw=normalizeAiResponse(response);if(!raw)throw new Error('Workers AI returned no structured observation');
  return{...raw,frameFetchedAt:frame.fetchedAt,frameHash:frame.hash};
}

async function analyzeCamera(env,camera,solar,weather,now=Date.now()){
  const frame=await fetchCameraFrame(camera),existing=await observationRow(env,camera.id);
  if(existing?.frame_hash===frame.hash&&Date.parse(existing.updated_at||'')>=now-REUSE_ANALYSIS_MS){
    const previous=parseJson(existing.analysis_json),validated=validateObservation({...previous,frameFetchedAt:frame.fetchedAt,frameHash:frame.hash},camera,now);if(validated){await saveObservation(env,validated);return{observation:validated,reused:true}}
  }
  const raw=await analyzeFrame(env,camera,frame,solar,weather),validated=validateObservation(raw,camera,now);if(!validated)throw new Error('camera observation rejected by quality gate');
  await saveObservation(env,validated);return{observation:validated,reused:false};
}

async function fetchWeather(){
  const url=new URL(OPEN_METEO);url.searchParams.set('latitude',String(HOTEL_LAT));url.searchParams.set('longitude',String(HOTEL_LON));url.searchParams.set('current','weather_code,cloud_cover,precipitation,rain,showers,visibility,relative_humidity_2m');url.searchParams.set('timezone','Asia/Bangkok');
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error(`Open-Meteo ${response.status}`);const data=await response.json(),current=data?.current||{};
  return{code:Number(current.weather_code)||0,cloudCover:clamp((Number(current.cloud_cover)||0)/100),precipitation:Math.max(0,Number(current.precipitation)||0),rain:Math.max(0,Number(current.rain)||0),showers:Math.max(0,Number(current.showers)||0),visibilityKm:Math.max(.1,(Number(current.visibility)||20000)/1000),humidity:clamp((Number(current.relative_humidity_2m)||68)/100),observedAt:String(current.time||new Date().toISOString())};
}

function blendNumber(a,b,alpha){return Number((Number(a||0)+(Number(b||0)-Number(a||0))*alpha).toFixed(4))}
function blendRgb(a,b,alpha){if(!Array.isArray(a)||a.length!==3)return b;if(!Array.isArray(b)||b.length!==3)return a;return[0,1,2].map(index=>Math.round(a[index]+(b[index]-a[index])*alpha))}
function smooth(previous,next,weather){
  if(!previous?.visual||!next?.visual||Number(previous.confidence)<=0)return next;
  const fast=[95,96,99,65,67,82].includes(Number(weather?.code))||Number(weather?.precipitation)>1;
  const solarFast=next.mode==='sunrise-east'||next.mode==='sunset-west';const alpha=fast ? 0.68 : (solarFast ? 0.46 : 0.30);
  const visual={};for(const [key,value] of Object.entries(next.visual))visual[key]=Array.isArray(value)?blendRgb(previous.visual[key],value,alpha):blendNumber(previous.visual[key],value,alpha);
  return{...next,confidence:blendNumber(previous.confidence,next.confidence,Math.max(alpha,0.42)),visual,smoothing:{alpha,fastWeather:fast,solarTransition:solarFast}};
}

async function collectStoredObservations(env,cameras,now){
  const observations=[];for(const camera of cameras){const row=await observationRow(env,camera.id);if(!row?.analysis_json)continue;const parsed=parseJson(row.analysis_json),validated=validateObservation(parsed,camera,now);if(validated)observations.push(validated)}return observations;
}

async function evaluate(env,{force=false}={}){
  await ensureSchema(env);const now=Date.now(),solar=solarPosition(new Date(now)),weather=await fetchWeather().catch(()=>null),registry=automatedCameras(),selection=chooseCameras(registry,solar,MAX_ANALYSES_PER_RUN),results=[];
  for(const camera of selection.cameras){try{results.push({cameraId:camera.id,...await analyzeCamera(env,camera,solar,weather,now)})}catch(error){results.push({cameraId:camera.id,error:String(error?.message||error)})}}
  const stored=await collectStoredObservations(env,registry,now),fused=fuseObservations(stored,{now,solar,weather}),previous=await stateGet(env,'latest_calibration'),calibration=smooth(previous,fused,weather);
  await stateSet(env,'latest_calibration',calibration);const status={checkedAt:new Date(now).toISOString(),mode:selection.mode,selected:selection.cameras.map(camera=>camera.id),analyzed:results.map(result=>({cameraId:result.cameraId,reused:Boolean(result.reused),ok:Boolean(result.observation),error:result.error||null})),validObservations:stored.length,confidence:calibration.confidence};await stateSet(env,'last_evaluation',status);return{calibration,status,force};
}

async function sourceProbe(camera){
  try{
    const imageUrl=await resolveCameraImage(camera),response=await fetch(imageUrl,{headers:{accept:'image/*'},redirect:'follow',cache:'no-store'}),type=(response.headers.get('content-type')||'').toLowerCase();
    return{id:camera.id,ok:response.ok&&type.startsWith('image/'),status:response.status,facing:camera.facing};
  }catch(error){return{id:camera.id,ok:false,status:0,facing:camera.facing,error:String(error?.message||error)}}
}

async function handle(request,env){
  await ensureSchema(env);const url=new URL(request.url),origin=request.headers.get('origin')||'',allowed=allowedOrigin(origin,env)?origin:'';
  if(request.method==='OPTIONS'){if(!allowedOrigin(origin,env))return new Response(null,{status:403});return new Response(null,{status:204,headers:{...cors(origin),'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600'}})}
  if(request.method!=='GET')return json({error:'method_not_allowed'},405,allowed);
  if(url.pathname==='/calibration'){
    const current=await stateGet(env,'latest_calibration'),expired=!current?.expiresAt||Date.parse(current.expiresAt)<=Date.now();
    if(!current||expired)return json({schema:1,observedAt:null,expiresAt:null,confidence:0,mode:'fallback',sources:[],visual:null},200,allowed);
    return json(current,200,allowed);
  }
  if(url.pathname==='/health'){
    const last=await stateGet(env,'last_evaluation'),current=await stateGet(env,'latest_calibration'),like=`${prefix(env)}:%`,rows=await env.DB.prepare('SELECT COUNT(*) AS count FROM sky_camera_observations WHERE camera_id LIKE ?').bind(like).first();
    return json({ok:true,service:'sindhorn-midtown-sky',model:MODEL,aiConfigured:Boolean(env.AI),cameraCount:automatedCameras().length,observationCount:Number(rows?.count)||0,calibrationConfidence:Number(current?.confidence)||0,lastEvaluation:last},200,allowed);
  }
  if(url.pathname==='/sources')return json({sources:publicCameraMetadata()},200,allowed);
  if(url.pathname==='/probe'){
    if(env.PREVIEW_MODE!=='true')return json({error:'not_available'},404,allowed);
    const solar=solarPosition(),selection=chooseCameras(automatedCameras(),solar,2),probes=await Promise.all(selection.cameras.map(sourceProbe));return json({mode:selection.mode,probes},200,allowed);
  }
  if(url.pathname==='/evaluate'){
    if(env.PREVIEW_MODE!=='true'||!PREVIEW_ORIGIN.test(origin))return json({error:'not_available'},404,allowed);
    try{const result=await evaluate(env,{force:true});return json(result,200,allowed)}catch(error){return json({error:String(error?.message||error)},500,allowed)}
  }
  return json({error:'not_found'},404,allowed);
}

export default{
  fetch:handle,
  scheduled(_event,env,ctx){ctx.waitUntil(evaluate(env).catch(async error=>{try{await ensureSchema(env);await stateSet(env,'last_evaluation',{checkedAt:new Date().toISOString(),error:String(error?.message||error)})}catch(_){}}))}
};
