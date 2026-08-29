import {PNG} from 'npm:pngjs@7.0.0';
import {Buffer} from 'node:buffer';

const ALLOWED_ORIGIN=/^(https:\/\/sindhorn-midtown-internal\.pages\.dev|https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev)$/i;
const PREVIEW_ORIGIN='https://fix-rain-now-authority.sindhorn-midtown-internal.pages.dev';
const CACHE_TTL_MS=120_000;
const PROVIDER_TIMEOUT_MS=3500;
const RADAR_STALE_MS=12*60*1000;
type Cached={expiresAt:number,value:Record<string,unknown>};
const cache=new Map<string,Cached>();
function cors(origin:string|null){return{'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGIN.test(origin)?origin:'https://sindhorn-midtown-internal.pages.dev','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}
function json(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
function finite(value:unknown,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function cacheKey(lat:number,lon:number,provider='rain'){return`${provider}:${Math.round(lat*400)},${Math.round(lon*400)}`}
function number(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function putCache(key:string,value:Record<string,unknown>,now=Date.now()){cache.set(key,{expiresAt:now+CACHE_TTL_MS,value});if(cache.size>256){for(const [k,v] of cache){if(v.expiresAt<=now)cache.delete(k);if(cache.size<=192)break}}}
async function timedFetch(input:RequestInfo|URL,init:RequestInit={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timeout)}}
async function tomorrowNow(lat:number,lon:number){
  const apikey=Deno.env.get('TOMORROW_API_KEY');if(!apikey)throw Object.assign(new Error('provider_not_configured'),{status:503});
  const key=cacheKey(lat,lon,'tomorrow'),hit=cache.get(key),now=Date.now();if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const started=performance.now(),url=new URL('https://api.tomorrow.io/v4/weather/realtime');url.searchParams.set('location',`${lat},${lon}`);url.searchParams.set('units','metric');url.searchParams.set('apikey',apikey);
  const response=await timedFetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const body=await response.json(),data=body?.data||{},values=data?.values||{},rain=Math.max(0,number(values.rainIntensity)),freezing=Math.max(0,number(values.freezingRainIntensity)),sleet=Math.max(0,number(values.sleetIntensity)),snow=Math.max(0,number(values.snowIntensity)),precip=Math.max(rain+freezing+sleet+snow,number(values.precipitationIntensity));
  const value={ok:true,provider:'tomorrow-io',observedAt:data.time||null,fetchedAt:new Date().toISOString(),rainIntensityMmHr:rain,precipitationIntensityMmHr:precip,precipitationProbability:Math.max(0,number(values.precipitationProbability)),weatherCode:number(values.weatherCode,-1),providerLatencyMs:Math.round(performance.now()-started),cache:'miss'};
  putCache(key,value,now);return value;
}
function pixelWet(data:Uint8Array,width:number,x:number,y:number){const i=(y*width+x)*4;return(data[i+3]||0)>=24}
function radarRateFromCenter(png:{width:number,height:number,data:Uint8Array}){
  const cx=Math.floor(png.width/2),cy=Math.floor(png.height/2);let wet=0;
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(pixelWet(png.data,png.width,x,y))wet++;
  const center=pixelWet(png.data,png.width,cx,cy);
  if(center&&wet>=7)return 1.5;
  if(center)return .8;
  if(wet>=4)return .35;
  return 0;
}
async function rainViewerPreview(lat:number,lon:number,origin:string|null){
  if(origin!==PREVIEW_ORIGIN)throw Object.assign(new Error('provider_not_configured'),{status:503});
  const key=cacheKey(lat,lon,'rainviewer-preview'),hit=cache.get(key),now=Date.now();if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const started=performance.now(),metaResponse=await timedFetch('https://api.rainviewer.com/public/weather-maps.json',{headers:{accept:'application/json'}});if(!metaResponse.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const meta=await metaResponse.json(),frames=Array.isArray(meta?.radar?.past)?meta.radar.past:[],frame=frames.at(-1);if(!frame?.time||!frame?.path||!meta?.host)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const observedMs=Number(frame.time)*1000;if(!Number.isFinite(observedMs)||now-observedMs>RADAR_STALE_MS||observedMs>now+60_000)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const tileUrl=`${meta.host}${frame.path}/512/7/${lat}/${lon}/2/0_0.png`,tileResponse=await timedFetch(tileUrl,{headers:{accept:'image/png'}});if(!tileResponse.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const bytes=Buffer.from(await tileResponse.arrayBuffer()),png=PNG.sync.read(bytes),rate=radarRateFromCenter({width:png.width,height:png.height,data:new Uint8Array(png.data.buffer,png.data.byteOffset,png.data.byteLength)});
  const value={ok:true,provider:'rainviewer-preview-radar',observedAt:new Date(observedMs).toISOString(),fetchedAt:new Date().toISOString(),rainIntensityMmHr:rate,precipitationIntensityMmHr:rate,precipitationProbability:rate>0?100:0,weatherCode:-1,providerLatencyMs:Math.round(performance.now()-started),cache:'miss',previewOnly:true};
  putCache(key,value,now);return value;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405,origin);
  try{
    const body=await req.json().catch(()=>null),latitude=finite(body?.latitude,-90,90),longitude=finite(body?.longitude,-180,180);if(latitude===null||longitude===null)return json({ok:false,error:'invalid_location'},400,origin);
    try{return json(await tomorrowNow(latitude,longitude),200,origin)}catch(error){if(!(error instanceof Error)||error.message!=='provider_not_configured')throw error}
    return json(await rainViewerPreview(latitude,longitude,origin),200,origin);
  }catch(error){const status=Number((error as {status?:number})?.status)||502,code=error instanceof Error&&error.message==='provider_not_configured'?'provider_not_configured':'provider_unavailable';return json({ok:false,provider:'rain-now',error:code,fetchedAt:new Date().toISOString()},status,origin)}
});
