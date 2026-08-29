import {PNG} from 'npm:pngjs@7.0.0';
import {Buffer} from 'node:buffer';

const ALLOWED_ORIGIN=/^(https:\/\/sindhorn-midtown-internal\.pages\.dev|https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev)$/i;
const PREVIEW_ORIGIN='https://fix-rain-now-authority.sindhorn-midtown-internal.pages.dev';
const TMD_URL='https://www.tmd.go.th/api/weather/get-aws-weather-by-province?province=%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3';
const CACHE_TTL_MS=120_000;
const PROVIDER_TIMEOUT_MS=3500;
const TMD_STALE_MS=20*60*1000;
const RADAR_STALE_MS=12*60*1000;
const MAX_TMD_DISTANCE_KM=45;
const TMD_WET_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
type Cached={expiresAt:number,value:Record<string,unknown>};
type TmdStation={stationId?:unknown,stationNameEn?:unknown,stationLat?:unknown,stationLon?:unknown,temperature?:unknown,humidity?:unknown,windSpeed?:unknown,precip15Mins?:unknown,precip1Hr?:unknown,precipToday?:unknown,weatherType?:unknown,dateTimeUtc7?:unknown};
const cache=new Map<string,Cached>();
let tmdStationsCache:{expiresAt:number,stations:TmdStation[]}|null=null;
function cors(origin:string|null){return{'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGIN.test(origin)?origin:'https://sindhorn-midtown-internal.pages.dev','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}
function json(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
function finite(value:unknown,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function number(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function cacheKey(lat:number,lon:number,provider='rain'){return`${provider}:${Math.round(lat*400)},${Math.round(lon*400)}`}
function putCache(key:string,value:Record<string,unknown>,now=Date.now()){cache.set(key,{expiresAt:now+CACHE_TTL_MS,value});if(cache.size>256){for(const [k,v] of cache){if(v.expiresAt<=now)cache.delete(k);if(cache.size<=192)break}}}
async function timedFetch(input:RequestInfo|URL,init:RequestInit={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timeout)}}
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad,a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
async function tmdStations(){
  const now=Date.now();if(tmdStationsCache&&tmdStationsCache.expiresAt>now)return tmdStationsCache.stations;
  const response=await timedFetch(TMD_URL,{headers:{accept:'application/json','user-agent':'SindhornMidtownInternal/1.0'}});if(!response.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const body=await response.json(),stations=Array.isArray(body?.data)?body.data:[];if(body?.success!==true||!stations.length)throw Object.assign(new Error('provider_unavailable'),{status:502});
  tmdStationsCache={expiresAt:now+CACHE_TTL_MS,stations};return stations;
}
function nearestTmdStation(stations:TmdStation[],lat:number,lon:number){let best:null|{station:TmdStation,distanceKm:number}=null;for(const station of stations){const sLat=finite(station.stationLat,-90,90),sLon=finite(station.stationLon,-180,180);if(sLat===null||sLon===null)continue;const distanceKm=haversineKm(lat,lon,sLat,sLon);if(!best||distanceKm<best.distanceKm)best={station,distanceKm}}return best}
async function tmdNow(lat:number,lon:number){
  const key=cacheKey(lat,lon,'tmd'),hit=cache.get(key),now=Date.now();if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const started=performance.now(),nearest=nearestTmdStation(await tmdStations(),lat,lon);if(!nearest||nearest.distanceKm>MAX_TMD_DISTANCE_KM)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const station=nearest.station,observedAt=String(station.dateTimeUtc7||''),observedMs=Date.parse(observedAt);if(!Number.isFinite(observedMs)||observedMs>now+2*60_000||now-observedMs>TMD_STALE_MS)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const precip15=Math.max(0,number(station.precip15Mins)),precip1h=Math.max(0,number(station.precip1Hr)),weatherCode=number(station.weatherType,-1),rate=precip15*4,wet=TMD_WET_CODES.has(weatherCode)||precip15>0;
  const value={ok:true,provider:'tmd-aws',observedAt,fetchedAt:new Date().toISOString(),rainIntensityMmHr:rate,precipitationIntensityMmHr:rate,precipitationProbability:wet?100:0,weatherCode,providerLatencyMs:Math.round(performance.now()-started),cache:'miss',stationId:number(station.stationId,-1),stationNameEn:String(station.stationNameEn||'TMD Bangkok AWS'),stationDistanceKm:Number(nearest.distanceKm.toFixed(1)),precip15MinsMm:precip15,precip1HrMm:precip1h,precipTodayMm:Math.max(0,number(station.precipToday))};
  putCache(key,value,now);return value;
}
function pixelWet(data:Uint8Array,width:number,x:number,y:number){const i=(y*width+x)*4;return(data[i+3]||0)>=24}
function radarRateFromCenter(png:{width:number,height:number,data:Uint8Array}){const cx=Math.floor(png.width/2),cy=Math.floor(png.height/2);let wet=0;for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(pixelWet(png.data,png.width,x,y))wet++;const center=pixelWet(png.data,png.width,cx,cy);if(center&&wet>=7)return 1.5;if(center)return .8;if(wet>=4)return .35;return 0}
async function rainViewerPreview(lat:number,lon:number,origin:string|null){
  if(origin!==PREVIEW_ORIGIN)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const key=cacheKey(lat,lon,'rainviewer-preview'),hit=cache.get(key),now=Date.now();if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const started=performance.now(),metaResponse=await timedFetch('https://api.rainviewer.com/public/weather-maps.json',{headers:{accept:'application/json'}});if(!metaResponse.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const meta=await metaResponse.json(),frames=Array.isArray(meta?.radar?.past)?meta.radar.past:[],frame=frames.at(-1);if(!frame?.time||!frame?.path||!meta?.host)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const observedMs=Number(frame.time)*1000;if(!Number.isFinite(observedMs)||now-observedMs>RADAR_STALE_MS||observedMs>now+60_000)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const tileUrl=`${meta.host}${frame.path}/512/7/${lat}/${lon}/2/0_0.png`,tileResponse=await timedFetch(tileUrl,{headers:{accept:'image/png'}});if(!tileResponse.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
  const bytes=Buffer.from(await tileResponse.arrayBuffer()),png=PNG.sync.read(bytes),rate=radarRateFromCenter({width:png.width,height:png.height,data:new Uint8Array(png.data.buffer,png.data.byteOffset,png.data.byteLength)});
  const value={ok:true,provider:'rainviewer-preview-radar',observedAt:new Date(observedMs).toISOString(),fetchedAt:new Date().toISOString(),rainIntensityMmHr:rate,precipitationIntensityMmHr:rate,precipitationProbability:rate>0?100:0,weatherCode:rate>0?61:-1,providerLatencyMs:Math.round(performance.now()-started),cache:'miss',previewOnly:true};putCache(key,value,now);return value;
}
function tmdWet(value:Record<string,unknown>){return TMD_WET_CODES.has(number(value.weatherCode,-1))||number(value.precip15MinsMm)>0}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405,origin);
  try{
    const body=await req.json().catch(()=>null),latitude=finite(body?.latitude,-90,90),longitude=finite(body?.longitude,-180,180);if(latitude===null||longitude===null)return json({ok:false,error:'invalid_location'},400,origin);
    try{const tmd=await tmdNow(latitude,longitude);if(tmdWet(tmd)||origin!==PREVIEW_ORIGIN)return json(tmd,200,origin);try{const radar=await rainViewerPreview(latitude,longitude,origin);if(number(radar.rainIntensityMmHr)>0)return json({...radar,secondaryOf:'tmd-aws'},200,origin)}catch(_){ }return json(tmd,200,origin)}catch(_){ }
    if(origin===PREVIEW_ORIGIN)try{return json(await rainViewerPreview(latitude,longitude,origin),200,origin)}catch(_){ }
    return json({ok:false,provider:'tmd-aws',error:'provider_unavailable',fetchedAt:new Date().toISOString()},502,origin);
  }catch(_){return json({ok:false,provider:'tmd-aws',error:'provider_unavailable',fetchedAt:new Date().toISOString()},502,origin)}
});
