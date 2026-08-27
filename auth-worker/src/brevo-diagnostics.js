const BREVO_EVENTS_URL='https://api.brevo.com/v3/smtp/statistics/events?days=1&limit=100&sort=desc';
const OTP_TAG='sindhorn-internal-otp';

const preview=env=>env.PREVIEW_MODE==='true';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

function hasOtpTag(event){
  const tags=Array.isArray(event?.tags)?event.tags.join(','):String(event?.tag||event?.tags||'');
  return tags.includes(OTP_TAG);
}

function safeReason(value){
  const text=String(value||'').trim();
  return text?text.slice(0,240):null;
}

export async function handleBrevoDiagnostic(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/diagnostics/brevo-otp-latest'||request.method!=='GET')return null;
  if(!preview(env))return json({ok:false,error:'not_found'},404);
  if(!env.BREVO_API_KEY)return json({ok:false,error:'brevo_not_configured'},503);
  try{
    const response=await fetch(BREVO_EVENTS_URL,{headers:{accept:'application/json','api-key':env.BREVO_API_KEY}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return json({ok:false,provider:'brevo',providerStatus:response.status},502);
    const events=Array.isArray(data?.events)?data.events.filter(hasOtpTag):[];
    const latest=events[0]||null;
    return json({
      ok:true,
      found:Boolean(latest),
      eventCount:events.length,
      latest:latest?{
        event:String(latest.event||'unknown'),
        date:latest.date||null,
        reason:safeReason(latest.reason)
      }:null
    });
  }catch(_){
    return json({ok:false,error:'brevo_diagnostic_unavailable'},503);
  }
}
