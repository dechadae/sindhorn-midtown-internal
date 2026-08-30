import {resolveTmdCurrentRain} from './rain-observation.js';

const ALLOWED_ORIGIN=/^(https:\/\/sindhorn-midtown-internal\.pages\.dev|https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev)$/i;
const TMD_URL='https://www.tmd.go.th/api/weather/get-aws-weather-by-province?province=%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3';
const MET_URL='https://api.met.no/weatherapi/locationforecast/2.0/compact';
const CACHE_TTL_MS=2*60_000;
const TMD_STALE_MS=20*60_000;
const MAX_TMD_DISTANCE_KM=12;
const TMD_WET_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);

type Cache={expiresAt:number,value:Record<string,unknown>};
type TmdStation={
  stationId?:unknown;
  stationNameEn?:unknown;
  stationLat?:unknown;
  stationLon?:unknown;
  temperature?:unknown;
  humidity?:unknown;
  windSpeed?:unknown;
  windDirection?:unknown;
  windGust?:unknown;
  pressure?:unknown;
  precip15Mins?:unknown;
  precip1Hr?:unknown;
  precipToday?:unknown;
  weatherType?:unknown;
  dateTimeUtc7?:unknown;
};

const cache=new Map<string,Cache>();
let stationCache:{expiresAt:number,stations:TmdStation[]}|null=null;

function cors(origin:string|null){
  return{
    'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGIN.test(origin)?origin:'https://sindhorn-midtown-internal.pages.dev',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Vary':'Origin'
  };
}
function json(data:unknown,status=200,origin:string|null=null){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}
  });
}
function finite(value:unknown,min=-Infinity,max=Infinity){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
function number(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function ageMs(value:unknown,now=Date.now()){
  const ms=Date.parse(String(value||''));
  return Number.isFinite(ms)?Math.max(0,now-ms):null;
}
function haversineKm(lat1:number,lon1:number,lat2:number,lon2:number){
  const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
async function timedFetch(input:RequestInfo|URL,timeoutMs:number,init:RequestInit={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(input,{...init,signal:controller.signal})}
  finally{clearTimeout(timeout)}
}
function cacheKey(lat:number,lon:number){return`${Math.round(lat*400)},${Math.round(lon*400)}`}
function cloudCode(cloudPct:number){if(cloudPct<12)return 0;if(cloudPct<35)return 1;if(cloudPct<78)return 2;return 3}
function apparentC(tempC:number,rh:number){
  if(tempC<26.7||rh<40)return tempC;
  const t=tempC*9/5+32,R=rh;
  const hi=-42.379+2.04901523*t+10.14333127*R-.22475541*t*R-.00683783*t*t-.05481717*R*R+.00122874*t*t*R+.00085282*t*R*R-.00000199*t*t*R*R;
  return Number((((hi-32)*5/9)).toFixed(1));
}

async function tmdStations(){
  const now=Date.now();
  if(stationCache&&stationCache.expiresAt>now)return stationCache.stations;
  const response=await timedFetch(TMD_URL,4500,{headers:{accept:'application/json','user-agent':'SindhornMidtownInternalWeatherCore/1.0'}});
  if(!response.ok)throw new Error(`tmd_http_${response.status}`);
  const body=await response.json(),stations=Array.isArray(body?.data)?body.data:[];
  if(body?.success!==true||!stations.length)throw new Error('tmd_payload_invalid');
  stationCache={expiresAt:now+CACHE_TTL_MS,stations};
  return stations;
}
function nearestStation(stations:TmdStation[],lat:number,lon:number){
  let best:null|{station:TmdStation,distanceKm:number}=null;
  for(const station of stations){
    const sLat=finite(station.stationLat,-90,90),sLon=finite(station.stationLon,-180,180);
    if(sLat===null||sLon===null)continue;
    const distanceKm=haversineKm(lat,lon,sLat,sLon);
    if(!best||distanceKm<best.distanceKm)best={station,distanceKm};
  }
  return best;
}
async function metForecast(lat:number,lon:number){
  const url=new URL(MET_URL);
  url.searchParams.set('lat',lat.toFixed(4));
  url.searchParams.set('lon',lon.toFixed(4));
  const response=await timedFetch(url,5000,{headers:{accept:'application/json','user-agent':'SindhornMidtownInternal/1.0 https://sindhorn-midtown-internal.pages.dev/'}});
  if(!response.ok)throw new Error(`met_http_${response.status}`);
  const body=await response.json(),series=Array.isArray(body?.properties?.timeseries)?body.properties.timeseries:[];
  if(!series.length)throw new Error('met_payload_invalid');
  const point=series[0],instant=point?.data?.instant?.details||{},next=point?.data?.next_1_hours||{};
  return{
    provider:'met-no-locationforecast',
    validAt:point?.time||null,
    cloudCoverPct:finite(instant.cloud_area_fraction,0,100),
    temperatureC:finite(instant.air_temperature,-80,70),
    humidityPct:finite(instant.relative_humidity,0,100),
    windSpeedMs:finite(instant.wind_speed,0,150),
    windDirectionDeg:finite(instant.wind_from_direction,0,360),
    pressureHpa:finite(instant.air_pressure_at_sea_level,800,1200),
    forecastPrecipitationNext1hMm:finite(next?.details?.precipitation_amount,0,500),
    symbolCode:String(next?.summary?.symbol_code||''),
    expires:response.headers.get('expires'),
    lastModified:response.headers.get('last-modified')
  };
}

async function build(lat:number,lon:number){
  const now=Date.now(),key=cacheKey(lat,lon),hit=cache.get(key);
  if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const started=performance.now();
  const [tmdResult,metResult]=await Promise.allSettled([tmdStations(),metForecast(lat,lon)]);
  let tmd:any=null,met:any=null;
  if(tmdResult.status==='fulfilled'){
    const nearest=nearestStation(tmdResult.value,lat,lon);
    if(nearest&&nearest.distanceKm<=MAX_TMD_DISTANCE_KM){
      const s=nearest.station,observedAt=String(s.dateTimeUtc7||''),age=ageMs(observedAt,now),fresh=age!==null&&age<=TMD_STALE_MS,code=number(s.weatherType,-1),p15=Math.max(0,number(s.precip15Mins)),p1h=Math.max(0,number(s.precip1Hr));
      tmd={
        provider:'tmd-aws',observedAt,ageMs:age,fresh,
        stationId:number(s.stationId,-1),stationNameEn:String(s.stationNameEn||'TMD AWS'),stationDistanceKm:Number(nearest.distanceKm.toFixed(2)),
        temperatureC:finite(s.temperature,-80,70),humidityPct:finite(s.humidity,0,100),windSpeedKmh:finite(s.windSpeed,0,300),windDirectionDeg:finite(s.windDirection,0,360),windGustKmh:finite(s.windGust,0,400),pressureHpa:finite(s.pressure,800,1200),
        weatherCode:code,precip15MinsMm:p15,precip1HrMm:p1h,weatherTypeRainHint:TMD_WET_CODES.has(code)
      };
    }
  }
  if(metResult.status==='fulfilled')met=metResult.value;

  const cloudPct=finite(met?.cloudCoverPct,0,100)??(tmd?.weatherCode===3?95:tmd?.weatherCode===2?60:tmd?.weatherCode===1?25:20);
  const rainDecision=resolveTmdCurrentRain({
    fresh:Boolean(tmd?.fresh),
    weatherCode:tmd?.weatherCode,
    weatherTypeRainHint:Boolean(tmd?.weatherTypeRainHint),
    precip15MinsMm:tmd?.precip15MinsMm
  });
  const observedWet=rainDecision.observedWet,observedDry=rainDecision.observedDry;
  const tmdCode=Number(tmd?.weatherCode);
  const code=tmd?.fresh&&Number.isFinite(tmdCode)&&tmdCode>=0?tmdCode:cloudCode(cloudPct);
  const temperatureC=finite(tmd?.temperatureC,-80,70)??finite(met?.temperatureC,-80,70);
  const humidityPct=finite(tmd?.humidityPct,0,100)??finite(met?.humidityPct,0,100)??68;
  const windSpeedKmh=finite(tmd?.windSpeedKmh,0,300)??((finite(met?.windSpeedMs,0,150)??1.1)*3.6);
  const windDirectionDeg=finite(tmd?.windDirectionDeg,0,360)??finite(met?.windDirectionDeg,0,360)??180;

  const current={
    known:temperatureC!==null,
    provider:tmd?.fresh?'tmd-aws':'met-no-locationforecast',
    observationProvider:tmd?.fresh?'tmd-aws':null,
    modelProvider:'met-no-locationforecast',
    observedAt:tmd?.fresh?tmd.observedAt:met?.validAt||null,
    temperatureC,
    apparentTemperatureC:temperatureC===null?null:apparentC(temperatureC,humidityPct),
    humidityPct,
    cloudCoverPct:cloudPct,
    precipitationMm:observedWet?Math.max(.1,tmd.precip15MinsMm):0,
    rainMm:observedWet?Math.max(.1,tmd.precip15MinsMm):0,
    showersMm:0,
    snowfallCm:0,
    weatherCode:code,
    windSpeedKmh,
    windDirectionDeg,
    windGustKmh:finite(tmd?.windGustKmh,0,400),
    visibilityKm:20,
    isDay:null,
    source:{current:tmd?.fresh?'tmd-aws':'met-no-locationforecast',cloud:'met-no-locationforecast',forecast:'met-no-locationforecast'}
  };
  const rainNow={
    available:rainDecision.currentConditionAvailable,
    rainNow:observedWet?true:observedDry?false:null,
    provider:'tmd-aws',
    observedAt:tmd?.observedAt||null,
    stationNameEn:tmd?.stationNameEn||null,
    stationDistanceKm:tmd?.stationDistanceKm??null,
    precip15MinsMm:tmd?.precip15MinsMm??null,
    precip1HrMm:tmd?.precip1HrMm??null,
    weatherCode:tmd?.weatherCode??-1,
    confidence:observedWet?'current-condition':observedDry?'current-condition-dry':'unknown',
    reason:observedWet
      ?'Fresh nearby TMD AWS reports a current rain condition; the 15-minute gauge is trailing accumulation and does not veto the condition.'
      :observedDry
        ?'Fresh nearby TMD AWS reports a current non-rain condition; trailing rainfall accumulation does not keep rain active.'
        :'TMD AWS is unavailable, stale, or has no usable current-condition code.'
  };
  const value={
    ok:true,
    fetchedAt:new Date().toISOString(),
    current,
    rainNow,
    tmd,
    forecast:met?{provider:'met-no-locationforecast',validAt:met.validAt,cloudCoverPct:met.cloudCoverPct,precipitationNext1hMm:met.forecastPrecipitationNext1hMm,symbolCode:met.symbolCode}:null,
    diagnostics:{totalLatencyMs:Math.round(performance.now()-started),openMeteoUsed:false,rainObservationEvidence:rainDecision.evidence}
  };
  cache.set(key,{expiresAt:now+CACHE_TTL_MS,value});
  return{...value,cache:'miss'};
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405,origin);
  try{
    const body=await req.json().catch(()=>null),lat=finite(body?.latitude,-90,90),lon=finite(body?.longitude,-180,180);
    if(lat===null||lon===null)return json({ok:false,error:'invalid_location'},400,origin);
    return json(await build(lat,lon),200,origin);
  }catch(error){
    return json({ok:false,error:String((error as Error)?.message||'weather_unavailable'),fetchedAt:new Date().toISOString()},502,origin);
  }
});
