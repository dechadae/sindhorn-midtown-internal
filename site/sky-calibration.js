const PROD_API='https://sindhorn-midtown-sky.decha-dae.workers.dev';
const PREVIEW_API='https://sindhorn-midtown-sky-preview.decha-dae.workers.dev';
const PREVIEW_HOST='phase8-directional-sky-calib.sindhorn-midtown-internal.pages.dev';
const API=location.hostname===PREVIEW_HOST?PREVIEW_API:PROD_API;
const CACHE_KEY='sindhorn-midtown:sky-calibration:v1';
const POLL_MS=5*60*1000;
const CACHE_GRACE_MS=15*60*1000;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const mix=(a,b,t)=>a+(b-a)*t;

let current=null,baselineConfig=null,timer=0,refreshPromise=null;

function validRgb(value){return Array.isArray(value)&&value.length===3&&value.every(channel=>Number.isFinite(Number(channel))&&Number(channel)>=0&&Number(channel)<=255)}
function validate(value,{allowGrace=false}={}){
  if(!value||Number(value.schema)!==1)return null;
  const confidence=clamp(value.confidence),expiresAt=Date.parse(value.expiresAt||'');
  if(!Number.isFinite(expiresAt))return null;
  const now=Date.now();if(expiresAt<now-(allowGrace?CACHE_GRACE_MS:0))return null;
  if(confidence<=0||!value.visual)return{...value,confidence:0,visual:null};
  const visual=value.visual;if(!validRgb(visual.zenithRgb)||!validRgb(visual.horizonRgb))return null;
  const numbers=['luminance','saturation','warmth','cloudOpacity','cloudDarkness','haze','horizonContrast','sunGlow','stormConfidence'];
  if(numbers.some(key=>!Number.isFinite(Number(visual[key]))))return null;
  return{...value,confidence,visual:{...visual,zenithRgb:visual.zenithRgb.map(Number),horizonRgb:visual.horizonRgb.map(Number),...Object.fromEntries(numbers.map(key=>[key,clamp(visual[key])]))}};
}
function readCache(){try{return validate(JSON.parse(localStorage.getItem(CACHE_KEY)||'null'),{allowGrace:true})}catch(_){return null}}
function writeCache(value){try{localStorage.setItem(CACHE_KEY,JSON.stringify(value))}catch(_){}}
function clone(value){return value?structuredClone(value):value}
function safeBaseline(){
  const state=window.SindhornEnvironment?.getState?.(),config=state?.config;
  if(config?.schema===1)return clone(config);
  const remote=window.SindhornAppPack?.getEnvironmentConfig?.();return remote?.schema===1?clone(remote):null;
}
function influence(calibration){
  if(!calibration?.visual)return 0;const confidence=clamp(calibration.confidence);
  const directional=calibration.mode==='sunrise-east'||calibration.mode==='sunset-west';
  return confidence*(directional?0.42:0.28);
}
function calibratedConfig(calibration){
  if(!baselineConfig?.clouds||!calibration?.visual)return baselineConfig;
  const strength=influence(calibration);if(strength<=0)return baselineConfig;
  const v=calibration.visual,base=baselineConfig.clouds;
  const observedOpacity=clamp(0.30+v.cloudOpacity*0.82,0.30,1.12);
  const observedContrast=clamp(0.78+v.cloudDarkness*1.30,0.72,2.08);
  const observedEdge=clamp(0.16+(1-v.cloudDarkness)*0.50+v.sunGlow*0.16,0.12,0.72);
  return{...clone(baselineConfig),clouds:{...base,opacity:mix(Number(base.opacity)||1,observedOpacity,strength),contrast:mix(Number(base.contrast)||1,observedContrast,strength),edgeLight:mix(Number(base.edgeLight)||0.22,observedEdge,strength)}};
}
function apply(){
  if(!window.SindhornEnvironment?.applyConfig)return false;
  if(!baselineConfig)baselineConfig=safeBaseline();if(!baselineConfig)return false;
  const config=current?.confidence>0&&current.visual?calibratedConfig(current):baselineConfig;
  window.SindhornEnvironment.applyConfig(config);return true;
}
function publish(value,source){
  current=value;document.documentElement.dataset.skyCalibration=value?.confidence>0?'live':'fallback';
  document.dispatchEvent(new CustomEvent('sindhorn:sky-calibration',{detail:{calibration:clone(value),source}}));
  apply();
}
async function fetchCalibration(){
  const response=await fetch(`${API}/calibration`,{cache:'no-store',credentials:'omit',headers:{accept:'application/json'}});if(!response.ok)throw new Error(`sky calibration ${response.status}`);
  const value=validate(await response.json());if(!value)throw new Error('invalid sky calibration payload');return value;
}
async function refresh(force=false){
  if(refreshPromise&&!force)return refreshPromise;
  refreshPromise=(async()=>{try{const value=await fetchCalibration();writeCache(value);publish(value,'remote');return value}catch(error){const cached=readCache();if(cached){publish(cached,'cache');return cached}const fallback={schema:1,observedAt:null,expiresAt:new Date(Date.now()+60_000).toISOString(),confidence:0,mode:'fallback',sources:[],visual:null};publish(fallback,'fallback');return fallback}finally{refreshPromise=null}})();
  return refreshPromise;
}
function start(){
  if(timer)return;const cached=readCache();if(cached)publish(cached,'cache');refresh().catch(()=>{});timer=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{})},POLL_MS);
}

document.addEventListener('sindhorn:environment-config',event=>{if(event.detail?.schema===1){baselineConfig=clone(event.detail);apply()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(()=>{})});
document.addEventListener('sindhorn:route-mounted',()=>apply());
window.SindhornSkyCalibration={refresh:()=>refresh(true),getState:()=>clone(current),getApi:()=>API,apply};
start();
