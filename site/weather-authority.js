const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const HEAVY_CODES=new Set([65,67,82,96,99]);
export const RAIN_NOW_STALE_MS=7*60*1000;
export const TMD_RAIN_NOW_STALE_MS=20*60*1000;
export const RADAR_RAIN_NOW_STALE_MS=12*60*1000;
// Compatibility export for older tests/imports. Open-Meteo is no longer a production authority.
export const OPEN_METEO_STALE_MS=20*60*1000;
export const DRY_HOLD_MAX_MS=0;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const parseTime=value=>{const ms=Date.parse(String(value||''));return Number.isFinite(ms)?ms:null};
export function weatherLabel(code){const c=Number(code);if(c===0)return'Clear';if(c===1)return'Mainly clear';if(c===2)return'Partly cloudy';if(c===3)return'Overcast';if([45,48].includes(c))return'Fog';if(DRIZZLE_CODES.has(c))return'Drizzle';if([61,63,65,66,67].includes(c))return'Rain';if([71,73,75,77].includes(c))return'Snow';if([80,81,82].includes(c))return'Rain showers';if([85,86].includes(c))return'Snow showers';if([95,96,99].includes(c))return'Thunderstorm';return'Current weather'}
export function classifyRainRate(rateMmHr){const rate=Math.max(0,finite(rateMmHr));if(rate<.1)return'dry';if(rate<.3)return'possible-drizzle';if(rate<1)return'drizzle';if(rate<4)return'rain';return'heavy-rain'}
export function isFresh(observedAt,nowMs=Date.now(),limitMs=RAIN_NOW_STALE_MS){const observed=parseTime(observedAt);return observed!==null&&observed<=nowMs+2*60_000&&nowMs-observed<=limitMs}
function providerFreshLimit(provider=''){const p=String(provider).toLowerCase();if(p.includes('radar'))return RADAR_RAIN_NOW_STALE_MS;if(p.startsWith('tmd-'))return TMD_RAIN_NOW_STALE_MS;return RAIN_NOW_STALE_MS}
function baseWeatherSignal(weather={},nowMs=Date.now()){
  const observedAt=weather.observedAt??weather.currentTime??null,fresh=observedAt?isFresh(observedAt,nowMs,OPEN_METEO_STALE_MS):weather.cached!==true,code=finite(weather.weatherCode,-1);
  return{fresh,code,label:weatherLabel(code),observedAt};
}
function rainNowSignal(rainNow={},nowMs=Date.now()){
  const provider=String(rainNow.provider||'rain-now'),observedAt=rainNow.observedAt??null,available=rainNow.ok===true||rainNow.status==='ok'||rainNow.available===true,fresh=available&&isFresh(observedAt,nowMs,providerFreshLimit(provider));
  const rate=Math.max(0,finite(rainNow.rainIntensityMmHr),finite(rainNow.precipitationIntensityMmHr)),code=finite(rainNow.weatherCode,-1),explicit=rainNow.rainNow===true?true:rainNow.rainNow===false?false:null;
  let state=classifyRainRate(rate);if(HEAVY_CODES.has(code)&&rate>=.3)state='heavy-rain';else if(DRIZZLE_CODES.has(code)&&rate>=.3)state='drizzle';else if(RAIN_CODES.has(code)&&rate>=.3&&state==='drizzle')state='rain';
  const strongWet=fresh&&(explicit===true||rate>=.3),possible=fresh&&explicit!==false&&!strongWet&&rate>=.1,dryObserved=fresh&&(explicit===false||(rate<.1&&!RAIN_CODES.has(code)));
  return{available,fresh,rate,code,state,strongWet,possible,dryObserved,observedAt,provider};
}
function labelForState(state,providerCode){const c=Number(providerCode);if([95,96,99].includes(c))return'Thunderstorm';if([80,81,82].includes(c))return'Rain showers';if(state==='heavy-rain')return'Heavy rain';if(state==='drizzle'||state==='possible-drizzle'||DRIZZLE_CODES.has(c))return'Drizzle';return'Rain'}
export function resolveWeatherAuthority({openMeteo={},weather=null,rainNow={},previous=null,nowMs=Date.now(),locationKey='default'}={}){
  // `openMeteo` remains as a compatibility argument name for callers on the old contract;
  // its data is now supplied by the TMD + MET Norway adapter and is never allowed to activate rain.
  const base=baseWeatherSignal(weather||openMeteo,nowMs),rain=rainNowSignal(rainNow,nowMs),locationChanged=Boolean(previous&&previous.locationKey!==locationKey);
  let active=false,precipitationState='dry',label=base.label,authority='observed-weather',rate=0,confidence=rain.fresh?'dry-observation':'unknown';
  if(rain.fresh&&rain.strongWet){active=true;precipitationState=rain.state==='possible-drizzle'?'drizzle':rain.state;label=labelForState(precipitationState,rain.code);authority=rain.provider;rate=rain.rate;confidence='high'}
  else if(rain.fresh&&rain.possible){precipitationState='possible-drizzle';authority=rain.provider;rate=rain.rate;confidence='possible'}
  // Fresh dry observation releases rain immediately. No model wet code and no historical hold may override it.
  if(rain.fresh&&rain.dryObserved){active=false;precipitationState='dry';label=base.label;authority=rain.provider;rate=0;confidence='dry-observation'}
  const staleRainNow=Boolean(rain.available&&!rain.fresh),lastWetAt=active?nowMs:(previous?.lastWetAt??null);
  return{active,precipitationState,label,authority,rainRateMmHr:rate,confidence,rainNowFresh:rain.fresh,rainNowStale:staleRainNow,baseWeatherFresh:base.fresh,openMeteoFresh:false,locationChanged,state:{active,precipitationState,label,rainRateMmHr:rate,lastWetAt,drySamples:0,drySince:null,lastSampleKey:rain.observedAt||null,locationKey}};
}
export function locationKey(location={}){const lat=finite(location.latitude,NaN),lon=finite(location.longitude,NaN);if(!Number.isFinite(lat)||!Number.isFinite(lon))return'unknown';return`${Math.round(lat*400)},${Math.round(lon*400)}`}
export function effectiveWeatherSnapshot(weather={},resolution={}){
  const originalCode=finite(weather.weatherCode,-1);if(!resolution?.active)return{...weather,cloudWeatherCode:originalCode,precipitationMm:0,rainMm:0,showersMm:0,precipitationActive:false,precipitationState:resolution?.precipitationState||'dry',rainAuthority:resolution?.authority||'observed-weather'};
  const state=resolution.precipitationState||'rain',rate=Math.max(0,finite(resolution.rainRateMmHr)),effectiveCode=resolution.label==='Thunderstorm'?95:state==='heavy-rain'?65:state==='drizzle'?51:61,equivalent=Math.max(.1,rate/4);
  return{...weather,cloudWeatherCode:originalCode,weatherCode:effectiveCode,precipitationMm:equivalent,rainMm:equivalent,showersMm:0,precipitationActive:true,precipitationState:state,rainRateMmHr:rate,rainAuthority:resolution.authority||'rain-now'};
}
