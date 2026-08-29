const OPEN_METEO_RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const OPEN_METEO_DRIZZLE_CODES=new Set([51,53,55,56,57]);
const OPEN_METEO_HEAVY_CODES=new Set([65,67,82,96,99]);
const TOMORROW_WET_CODES=new Set([4000,4001,4200,4201,8000]);
const TOMORROW_DRIZZLE_CODES=new Set([4000]);
const TOMORROW_HEAVY_CODES=new Set([4201,8000]);
const PROVIDER_WET_CODES=new Set([...OPEN_METEO_RAIN_CODES,...TOMORROW_WET_CODES]);
const PROVIDER_DRIZZLE_CODES=new Set([...OPEN_METEO_DRIZZLE_CODES,...TOMORROW_DRIZZLE_CODES]);
const PROVIDER_HEAVY_CODES=new Set([...OPEN_METEO_HEAVY_CODES,...TOMORROW_HEAVY_CODES]);
export const RAIN_NOW_STALE_MS=7*60*1000;
export const TMD_RAIN_NOW_STALE_MS=20*60*1000;
export const RADAR_RAIN_NOW_STALE_MS=12*60*1000;
export const OPEN_METEO_STALE_MS=20*60*1000;
export const DRY_HOLD_MAX_MS=7*60*1000;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const parseTime=value=>{const ms=Date.parse(String(value||''));return Number.isFinite(ms)?ms:null};
export function weatherLabel(code){const c=Number(code);if(c===0)return'Clear';if(c===1)return'Mainly clear';if(c===2)return'Partly cloudy';if(c===3)return'Overcast';if([45,48].includes(c))return'Fog';if(OPEN_METEO_DRIZZLE_CODES.has(c))return'Drizzle';if([61,63,65,66,67].includes(c))return'Rain';if([71,73,75,77].includes(c))return'Snow';if([80,81,82].includes(c))return'Rain showers';if([85,86].includes(c))return'Snow showers';if([95,96,99].includes(c))return'Thunderstorm';return'Current weather'}
export function classifyRainRate(rateMmHr){const rate=Math.max(0,finite(rateMmHr));if(rate<.1)return'dry';if(rate<.3)return'possible-drizzle';if(rate<1)return'drizzle';if(rate<4)return'rain';return'heavy-rain'}
export function isFresh(observedAt,nowMs=Date.now(),limitMs=RAIN_NOW_STALE_MS){const observed=parseTime(observedAt);return observed!==null&&observed<=nowMs+2*60_000&&nowMs-observed<=limitMs}
function providerFreshLimit(provider=''){const p=String(provider).toLowerCase();if(p.startsWith('tmd-'))return TMD_RAIN_NOW_STALE_MS;if(p.includes('radar'))return RADAR_RAIN_NOW_STALE_MS;return RAIN_NOW_STALE_MS}
function openMeteoSignal(openMeteo={},nowMs=Date.now()){
  const observedAt=openMeteo.observedAt??openMeteo.currentTime??null;
  const fresh=observedAt?isFresh(observedAt,nowMs,OPEN_METEO_STALE_MS):openMeteo.cached!==true;
  const code=finite(openMeteo.weatherCode,-1),amount=Math.max(0,finite(openMeteo.precipitationMm),finite(openMeteo.rainMm),finite(openMeteo.showersMm));
  const wet=OPEN_METEO_RAIN_CODES.has(code)||amount>=.1;
  const state=!wet?'dry':OPEN_METEO_HEAVY_CODES.has(code)||amount>=4?'heavy-rain':OPEN_METEO_DRIZZLE_CODES.has(code)&&amount<1?'drizzle':'rain';
  return{fresh,wet,state,amount,code,label:weatherLabel(code),observedAt};
}
function rainNowSignal(rainNow={},nowMs=Date.now()){
  const provider=String(rainNow.provider||'rain-now'),observedAt=rainNow.observedAt??null,available=rainNow.ok===true||rainNow.status==='ok',fresh=available&&isFresh(observedAt,nowMs,providerFreshLimit(provider)),rate=Math.max(0,finite(rainNow.rainIntensityMmHr),finite(rainNow.precipitationIntensityMmHr));
  const code=finite(rainNow.weatherCode,-1),probability=Math.max(0,finite(rainNow.precipitationProbability));let state=classifyRainRate(rate);
  if(PROVIDER_HEAVY_CODES.has(code))state='heavy-rain';else if(PROVIDER_DRIZZLE_CODES.has(code)&&['dry','possible-drizzle'].includes(state))state='drizzle';else if(PROVIDER_WET_CODES.has(code)&&!PROVIDER_DRIZZLE_CODES.has(code)&&['dry','possible-drizzle','drizzle'].includes(state))state='rain';
  const strongWet=fresh&&(PROVIDER_WET_CODES.has(code)||rate>=.3),possible=fresh&&!strongWet&&rate>=.1&&(probability>=50||probability===0),wet=strongWet||possible;
  return{available,fresh,rate,code,probability,state,wet,strongWet,possible,observedAt,provider};
}
function labelForState(state,providerCode){const c=Number(providerCode);if(c===8000||[95,96,99].includes(c))return'Thunderstorm';if([80,81,82].includes(c))return'Rain showers';if(state==='heavy-rain')return'Heavy rain';if(state==='drizzle'||state==='possible-drizzle'||OPEN_METEO_DRIZZLE_CODES.has(c))return'Drizzle';return'Rain'}
function drySampleKey(rain,open){return`${rain.observedAt||'rain-none'}|${open.observedAt||'om-none'}|${rain.fresh?'f':'s'}|${open.fresh?'f':'s'}`}
export function resolveWeatherAuthority({openMeteo={},rainNow={},previous=null,nowMs=Date.now(),locationKey='default'}={}){
  const open=openMeteoSignal(openMeteo,nowMs),rain=rainNowSignal(rainNow,nowMs),locationChanged=Boolean(previous&&previous.locationKey!==locationKey);const prior=locationChanged?null:previous;
  let active=false,precipitationState='dry',label=open.label,authority='open-meteo',rate=0,confidence='dry';
  if(rain.fresh&&rain.strongWet){active=true;precipitationState=rain.state==='possible-drizzle'?'drizzle':rain.state;label=labelForState(precipitationState,rain.code);authority=rain.provider;rate=rain.rate;confidence='high'}
  else if(rain.fresh&&rain.possible&&open.wet){active=true;precipitationState=open.state==='dry'?'drizzle':open.state;label=open.label==='Overcast'?labelForState(precipitationState,rain.code):open.label;authority=`${rain.provider}+open-meteo`;rate=rain.rate;confidence='medium'}
  else if(open.wet&&open.fresh){active=true;precipitationState=open.state;label=open.label==='Overcast'?labelForState(open.state,rain.code):open.label;authority='open-meteo';rate=rain.rate;confidence='medium'}
  const sampleKey=drySampleKey(rain,open);let drySamples=0,drySince=null,lastWetAt=prior?.lastWetAt??null,lastSampleKey=prior?.lastSampleKey??null;
  if(active){lastWetAt=nowMs;drySamples=0;drySince=null}
  else if(prior?.active){drySamples=Number(prior.drySamples)||0;drySince=prior.drySince??nowMs;if(sampleKey!==lastSampleKey)drySamples+=1;const heldFor=nowMs-drySince,wetAge=lastWetAt===null?Infinity:nowMs-lastWetAt;if(drySamples<2&&heldFor<DRY_HOLD_MAX_MS&&wetAge<DRY_HOLD_MAX_MS){active=true;precipitationState=prior.precipitationState||'rain';label=prior.label||'Rain';authority='hysteresis';rate=finite(prior.rainRateMmHr);confidence='held'}else{drySamples=0;drySince=null}}
  if(!active&&rain.fresh&&rain.possible&&!open.wet){precipitationState='possible-drizzle';confidence='possible'}
  const staleRainNow=Boolean(rain.available&&!rain.fresh);
  return{active,precipitationState,label,authority,rainRateMmHr:rate,confidence,rainNowFresh:rain.fresh,rainNowStale:staleRainNow,openMeteoFresh:open.fresh,locationChanged,state:{active,precipitationState,label,rainRateMmHr:rate,lastWetAt,drySamples,drySince,lastSampleKey:sampleKey,locationKey}};
}
export function locationKey(location={}){const lat=finite(location.latitude,NaN),lon=finite(location.longitude,NaN);if(!Number.isFinite(lat)||!Number.isFinite(lon))return'unknown';return`${Math.round(lat*400)},${Math.round(lon*400)}`}
export function effectiveWeatherSnapshot(weather={},resolution={}){
  const originalCode=finite(weather.weatherCode,-1);if(!resolution?.active)return{...weather,cloudWeatherCode:originalCode,precipitationActive:false,precipitationState:resolution?.precipitationState||'dry',rainAuthority:resolution?.authority||'open-meteo'};
  const state=resolution.precipitationState||'rain',rate=Math.max(0,finite(resolution.rainRateMmHr));
  const effectiveCode=resolution.label==='Thunderstorm'?95:state==='heavy-rain'?65:state==='drizzle'?51:61;
  const equivalent=Math.max(.1,rate/4),precipitationMm=Math.max(0,finite(weather.precipitationMm),finite(weather.rainMm),finite(weather.showersMm),equivalent);
  return{...weather,cloudWeatherCode:originalCode,weatherCode:effectiveCode,precipitationMm,rainMm:Math.max(0,finite(weather.rainMm),equivalent),precipitationActive:true,precipitationState:state,rainRateMmHr:rate,rainAuthority:resolution.authority||'rain-now'};
}
