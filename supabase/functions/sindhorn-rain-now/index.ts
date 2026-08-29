const ALLOWED_ORIGIN=/^(https:\/\/sindhorn-midtown-internal\.pages\.dev|https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev)$/i;
const CACHE_TTL_MS=120_000;
const PROVIDER_TIMEOUT_MS=3500;
type Cached={expiresAt:number,value:Record<string,unknown>};
const cache=new Map<string,Cached>();
function cors(origin:string|null){return{'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGIN.test(origin)?origin:'https://sindhorn-midtown-internal.pages.dev','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}
function json(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
function finite(value:unknown,min:number,max:number){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function cacheKey(lat:number,lon:number){return`${Math.round(lat*400)},${Math.round(lon*400)}`}
function number(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
async function tomorrowNow(lat:number,lon:number){
  const apikey=Deno.env.get('TOMORROW_API_KEY');if(!apikey)throw Object.assign(new Error('provider_not_configured'),{status:503});
  const key=cacheKey(lat,lon),hit=cache.get(key),now=Date.now();if(hit&&hit.expiresAt>now)return{...hit.value,cache:'hit'};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS),started=performance.now();
  try{
    const url=new URL('https://api.tomorrow.io/v4/weather/realtime');url.searchParams.set('location',`${lat},${lon}`);url.searchParams.set('units','metric');url.searchParams.set('apikey',apikey);
    const response=await fetch(url,{headers:{accept:'application/json'},signal:controller.signal});if(!response.ok)throw Object.assign(new Error('provider_unavailable'),{status:502});
    const body=await response.json(),data=body?.data||{},values=data?.values||{},rain=Math.max(0,number(values.rainIntensity)),freezing=Math.max(0,number(values.freezingRainIntensity)),sleet=Math.max(0,number(values.sleetIntensity)),snow=Math.max(0,number(values.snowIntensity)),precip=Math.max(rain+freezing+sleet+snow,number(values.precipitationIntensity));
    const value={ok:true,provider:'tomorrow-io',observedAt:data.time||null,fetchedAt:new Date().toISOString(),rainIntensityMmHr:rain,precipitationIntensityMmHr:precip,precipitationProbability:Math.max(0,number(values.precipitationProbability)),weatherCode:number(values.weatherCode,-1),providerLatencyMs:Math.round(performance.now()-started),cache:'miss'};
    cache.set(key,{expiresAt:now+CACHE_TTL_MS,value});if(cache.size>256){for(const [k,v] of cache){if(v.expiresAt<=now)cache.delete(k);if(cache.size<=192)break}}
    return value;
  }finally{clearTimeout(timeout)}
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405,origin);
  try{
    const body=await req.json().catch(()=>null),latitude=finite(body?.latitude,-90,90),longitude=finite(body?.longitude,-180,180);if(latitude===null||longitude===null)return json({ok:false,error:'invalid_location'},400,origin);
    return json(await tomorrowNow(latitude,longitude),200,origin);
  }catch(error){const status=Number((error as {status?:number})?.status)||502,code=error instanceof Error&&error.message==='provider_not_configured'?'provider_not_configured':'provider_unavailable';return json({ok:false,provider:'tomorrow-io',error:code,fetchedAt:new Date().toISOString()},status,origin)}
});
