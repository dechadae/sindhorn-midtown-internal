import {unzipSync} from 'npm:fflate@0.8.2';

const ALLOWED_ORIGIN=/^(https:\/\/sindhorn-midtown-internal\.pages\.dev|https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev)$/i;
const QPE_URL='https://weather.tmd.go.th/composite/compositeQPE_VTBB_latest.asc.zip';
const TMD_AWS_URL='https://www.tmd.go.th/api/weather/get-aws-weather-by-province?province=%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3';
const SATDA_URL='https://satda.tmd.go.th/';
const SATDA_BKK_NOWCAST_URL='https://satda.tmd.go.th/wp-content/uploads/nowcasting/bkk/bangkok.php';
const QPE_CACHE_MS=3*60_000;
const AWS_CACHE_MS=2*60_000;
const SATDA_CACHE_MS=3*60_000;
const QPE_FRESH_MS=30*60_000;
const AWS_FRESH_MS=20*60_000;
const WEATHER_CODE_WET=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);

type Cache<T>={expiresAt:number,value:T};
type GridHeader={ncols?:number,nrows?:number,xllcorner?:number,xllcenter?:number,yllcorner?:number,yllcenter?:number,cellsize?:number,nodata_value?:number};
type QpeGrid={fetchedAt:string,lastModified:string|null,etag:string|null,memberName:string,memberBytes:number,archiveBytes:number,header:GridHeader,headerLines:number,lines:string[],timestampToken:string|null};
type TmdStation={stationId?:unknown,stationNameEn?:unknown,stationLat?:unknown,stationLon?:unknown,temperature?:unknown,humidity?:unknown,windSpeed?:unknown,windDirection?:unknown,windGust?:unknown,pressure?:unknown,precip15Mins?:unknown,precip1Hr?:unknown,precipToday?:unknown,weatherType?:unknown,dateTimeUtc7?:unknown};

let qpeCache:Cache<QpeGrid>|null=null;
let awsCache:Cache<TmdStation[]>|null=null;
let satdaCache:Cache<Record<string,unknown>>|null=null;

function cors(origin:string|null){return{'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGIN.test(origin)?origin:'https://sindhorn-midtown-internal.pages.dev','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}
function json(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
function finite(value:unknown,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function num(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function ageMs(value:string|null|undefined,now=Date.now()){const ms=Date.parse(String(value||''));return Number.isFinite(ms)?Math.max(0,now-ms):null}
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad,a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
async function timedFetch(input:RequestInfo|URL,timeoutMs:number,init:RequestInit={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timeout)}}

function parseGridHeader(lines:string[]){
  const header:GridHeader={};let headerLines=0;
  const allowed=new Set(['ncols','nrows','xllcorner','xllcenter','yllcorner','yllcenter','cellsize','nodata_value']);
  for(let i=0;i<Math.min(lines.length,20);i++){
    const match=lines[i].trim().match(/^([A-Za-z_]+)\s+([-+0-9.eE]+)\s*$/);if(!match)break;
    const key=match[1].toLowerCase();if(!allowed.has(key))break;
    const value=Number(match[2]);if(!Number.isFinite(value))break;(header as Record<string,number>)[key]=value;headerLines=i+1;
  }
  return{header,headerLines};
}
function timestampToken(name:string){const match=name.match(/(20\d{6})[_-]?(\d{4})?/);return match?`${match[1]}${match[2]?`_${match[2]}`:''}`:null}
async function qpeGrid(){
  const now=Date.now();if(qpeCache&&qpeCache.expiresAt>now)return{grid:qpeCache.value,cache:'hit'};
  const started=performance.now(),response=await timedFetch(QPE_URL,8000,{headers:{accept:'application/zip','user-agent':'SindhornMidtownInternalWeatherLab/1.0'}});if(!response.ok)throw new Error(`qpe_http_${response.status}`);
  const archive=new Uint8Array(await response.arrayBuffer());if(archive.byteLength>30*1024*1024)throw new Error('qpe_archive_too_large');
  const files=unzipSync(archive),names=Object.keys(files).filter(name=>/\.asc$/i.test(name));if(!names.length)throw new Error('qpe_ascii_missing');
  const memberName=names.sort().at(-1)!,bytes=files[memberName];if(bytes.byteLength>80*1024*1024)throw new Error('qpe_grid_too_large');
  const text=new TextDecoder().decode(bytes),lines=text.split(/\r?\n/),parsed=parseGridHeader(lines);
  const grid:QpeGrid={fetchedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified'),etag:response.headers.get('etag'),memberName,memberBytes:bytes.byteLength,archiveBytes:archive.byteLength,header:parsed.header,headerLines:parsed.headerLines,lines,timestampToken:timestampToken(memberName)};
  qpeCache={expiresAt:now+QPE_CACHE_MS,value:grid};
  return{grid,cache:'miss',providerLatencyMs:Math.round(performance.now()-started)};
}
function rowValues(grid:QpeGrid,row:number){const line=grid.lines[grid.headerLines+row];if(typeof line!=='string')return null;return line.trim().split(/\s+/).map(Number)}
function sampleQpe(grid:QpeGrid,lat:number,lon:number){
  const h=grid.header,ncols=Number(h.ncols),nrows=Number(h.nrows),cell=Number(h.cellsize);
  const xBase=Number.isFinite(Number(h.xllcorner))?Number(h.xllcorner):Number.isFinite(Number(h.xllcenter))?Number(h.xllcenter)-cell/2:NaN;
  const yBase=Number.isFinite(Number(h.yllcorner))?Number(h.yllcorner):Number.isFinite(Number(h.yllcenter))?Number(h.yllcenter)-cell/2:NaN;
  const geographic=Number.isFinite(xBase)&&Number.isFinite(yBase)&&Number.isFinite(cell)&&cell>0&&Math.abs(xBase)<=180&&Math.abs(yBase)<=90&&cell<=5;
  if(!geographic||!Number.isInteger(ncols)||!Number.isInteger(nrows))return{supported:false,reason:'grid_projection_or_header_unknown'};
  const col=Math.floor((lon-xBase)/cell),fromBottom=Math.floor((lat-yBase)/cell),row=nrows-1-fromBottom;
  if(col<0||col>=ncols||row<0||row>=nrows)return{supported:false,reason:'location_outside_grid',row,col};
  const nodata=Number(h.nodata_value);const values:number[]=[];let center:number|null=null;
  for(let r=Math.max(0,row-1);r<=Math.min(nrows-1,row+1);r++){
    const line=rowValues(grid,r);if(!line)continue;
    for(let c=Math.max(0,col-1);c<=Math.min(ncols-1,col+1);c++){
      const value=Number(line[c]);if(!Number.isFinite(value)||(Number.isFinite(nodata)&&value===nodata))continue;if(r===row&&c===col)center=value;values.push(value);
    }
  }
  const neighborhoodMax=values.length?Math.max(...values):null,neighborhoodMean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const ns=Math.abs(cell)*111_320,ew=ns*Math.cos(lat*Math.PI/180),resolutionMApprox=Math.round((ns+ew)/2);
  return{supported:true,row,col,centerValue:center,neighborhoodMax,neighborhoodMean:neighborhoodMean===null?null:Number(neighborhoodMean.toFixed(3)),resolutionMApprox,cellSize:cell,unit:'source-grid-value'};
}
async function tmdStations(){
  const now=Date.now();if(awsCache&&awsCache.expiresAt>now)return{stations:awsCache.value,cache:'hit'};
  const started=performance.now(),response=await timedFetch(TMD_AWS_URL,4500,{headers:{accept:'application/json','user-agent':'SindhornMidtownInternalWeatherLab/1.0'}});if(!response.ok)throw new Error(`aws_http_${response.status}`);
  const body=await response.json(),stations=Array.isArray(body?.data)?body.data:[];if(body?.success!==true||!stations.length)throw new Error('aws_payload_invalid');
  awsCache={expiresAt:now+AWS_CACHE_MS,value:stations};return{stations,cache:'miss',providerLatencyMs:Math.round(performance.now()-started)};
}
function nearestAws(stations:TmdStation[],lat:number,lon:number){let best:null|{station:TmdStation,distanceKm:number}=null;for(const station of stations){const sLat=finite(station.stationLat,-90,90),sLon=finite(station.stationLon,-180,180);if(sLat===null||sLon===null)continue;const distanceKm=haversineKm(lat,lon,sLat,sLon);if(!best||distanceKm<best.distanceKm)best={station,distanceKm}}return best}
async function awsEvidence(lat:number,lon:number){
  const result=await tmdStations(),nearest=nearestAws(result.stations,lat,lon);if(!nearest)throw new Error('aws_station_missing');const s=nearest.station,observedAt=String(s.dateTimeUtc7||''),age=ageMs(observedAt),code=num(s.weatherType,-1),p15=Math.max(0,num(s.precip15Mins)),p1h=Math.max(0,num(s.precip1Hr));
  return{ok:true,provider:'tmd-aws',kind:'observation',observedAt,ageMs:age,fresh:age!==null&&age<=AWS_FRESH_MS,cache:result.cache,providerLatencyMs:'providerLatencyMs'in result?result.providerLatencyMs:0,station:{id:num(s.stationId,-1),nameEn:String(s.stationNameEn||'TMD AWS'),distanceKm:Number(nearest.distanceKm.toFixed(2))},temperatureC:finite(s.temperature,-80,70),humidityPct:finite(s.humidity,0,100),windSpeed:finite(s.windSpeed,0,300),windDirection:finite(s.windDirection,0,360),windGust:finite(s.windGust,0,400),pressure:finite(s.pressure,800,1200),weatherCode:code,weatherTypeRainHint:WEATHER_CODE_WET.has(code),precip15MinsMm:p15,precip1HrMm:p1h,precipTodayMm:Math.max(0,num(s.precipToday)),recentRain15m:p15>0,note:'15-minute accumulation and weatherType are supporting evidence, not instantaneous rain proof.'};
}
function absoluteAsset(base:string,value:string){try{return new URL(value,base).href}catch(_){return null}}
async function satdaEvidence(){
  const now=Date.now();if(satdaCache&&satdaCache.expiresAt>now)return{...satdaCache.value,cache:'hit'};
  const started=performance.now();const [mainResponse,nowcastResponse]=await Promise.all([timedFetch(SATDA_URL,5000,{headers:{'user-agent':'SindhornMidtownInternalWeatherLab/1.0'}}),timedFetch(SATDA_BKK_NOWCAST_URL,5000,{headers:{'user-agent':'SindhornMidtownInternalWeatherLab/1.0'}})]);
  if(!mainResponse.ok)throw new Error(`satda_http_${mainResponse.status}`);const main=await mainResponse.text(),nowcast=nowcastResponse.ok?await nowcastResponse.text():'';
  const update=[...main.matchAll(/อัปเดตล่าสุด:\s*(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2})/g)].map(match=>match[1]).at(-1)||null;
  const frames=[...new Set([...main.matchAll(/(20\d{10}\.png)/g)].map(match=>match[1]))].sort().reverse().slice(0,16);
  const assets=[...new Set([...nowcast.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(match=>absoluteAsset(SATDA_BKK_NOWCAST_URL,match[1])).filter(Boolean) as string[])].filter(url=>/nowcast|\.js(?:\?|$)|\.json(?:\?|$)|\.png(?:\?|$)|\.gif(?:\?|$)/i.test(url)).slice(0,24);
  const value={ok:true,provider:'tmd-satda',kind:'radar-nowcast',fetchedAt:new Date().toISOString(),radarCompositeUpdatedAtLocal:update,latestFrameName:frames[0]||null,recentFrameNames:frames,nowcastPageOk:nowcastResponse.ok,nowcastPageBytes:nowcast.length,assetHints:assets,sourceUrls:{satda:SATDA_URL,bangkokNowcast:SATDA_BKK_NOWCAST_URL},providerLatencyMs:Math.round(performance.now()-started),cache:'miss'};
  satdaCache={expiresAt:now+SATDA_CACHE_MS,value};return value;
}
async function qpeEvidence(lat:number,lon:number){
  const result=await qpeGrid(),grid=result.grid,sample=sampleQpe(grid,lat,lon),modifiedAge=ageMs(grid.lastModified),fresh=modifiedAge!==null&&modifiedAge<=QPE_FRESH_MS;
  return{ok:true,provider:'tmd-radar-qpe',kind:'radar-qpe',fetchedAt:grid.fetchedAt,upstreamLastModified:grid.lastModified,upstreamAgeMs:modifiedAge,fresh,freshnessBasis:'HTTP Last-Modified only until the product timestamp is verified',etag:grid.etag,archiveBytes:grid.archiveBytes,memberName:grid.memberName,memberTimestampToken:grid.timestampToken,memberBytes:grid.memberBytes,gridHeader:grid.header,cache:result.cache,providerLatencyMs:'providerLatencyMs'in result?result.providerLatencyMs:0,sample};
}
function proposedRain(qpe:Record<string,any>|null,aws:Record<string,any>|null){
  const sample=qpe?.sample;if(qpe?.ok===true&&qpe?.fresh===true&&sample?.supported===true&&Number.isFinite(Number(sample.centerValue))){const value=Number(sample.centerValue),wet=value>0.05;return{rainNow:wet,confidence:'experimental-high',authority:'tmd-radar-qpe',reason:wet?'Fresh QPE cell is non-zero at device location.':'Fresh QPE cell is dry at device location.',nearbyRain:Number(sample.neighborhoodMax)>0.05};}
  if(aws?.ok===true&&aws?.fresh===true&&(aws.weatherTypeRainHint||aws.recentRain15m))return{rainNow:null,confidence:'support-only',authority:'tmd-aws',reason:'AWS reports rain/recent rain, but station weatherType and trailing accumulation do not prove instantaneous rain.'};
  return{rainNow:null,confidence:'unknown',authority:null,reason:'No fresh exact-point radar/QPE evidence is available.'};
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405,origin);
  const started=performance.now();try{
    const body=await req.json().catch(()=>null),lat=finite(body?.latitude,-90,90),lon=finite(body?.longitude,-180,180);if(lat===null||lon===null)return json({ok:false,error:'invalid_location'},400,origin);
    const [qpeResult,awsResult,satdaResult]=await Promise.allSettled([qpeEvidence(lat,lon),awsEvidence(lat,lon),satdaEvidence()]);
    const qpe=qpeResult.status==='fulfilled'?qpeResult.value:{ok:false,provider:'tmd-radar-qpe',error:String(qpeResult.reason?.message||qpeResult.reason||'unavailable')};
    const aws=awsResult.status==='fulfilled'?awsResult.value:{ok:false,provider:'tmd-aws',error:String(awsResult.reason?.message||awsResult.reason||'unavailable')};
    const satda=satdaResult.status==='fulfilled'?satdaResult.value:{ok:false,provider:'tmd-satda',error:String(satdaResult.reason?.message||satdaResult.reason||'unavailable')};
    return json({ok:true,schemaVersion:1,fetchedAt:new Date().toISOString(),totalLatencyMs:Math.round(performance.now()-started),attribution:'Thai Meteorological Department (TMD)',privacy:'Precise request coordinates are used transiently for sampling and are not echoed in this response.',qpe,aws,satda,proposedRainNow:proposedRain(qpe as Record<string,any>,aws as Record<string,any>)},200,origin);
  }catch(error){return json({ok:false,error:'weather_lab_failed',detail:String((error as Error)?.message||error),fetchedAt:new Date().toISOString()},502,origin)}
});
