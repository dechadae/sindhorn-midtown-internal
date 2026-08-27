const BREVO_EVENTS_URL='https://api.brevo.com/v3/smtp/statistics/events?days=1&limit=100&sort=desc';
const BREVO_SENDERS_URL='https://api.brevo.com/v3/senders';
const BREVO_ACCOUNT_URL='https://api.brevo.com/v3/account';
const BREVO_DOMAINS_URL='https://api.brevo.com/v3/senders/domains';
const OTP_TAG='sindhorn-internal-otp';
const FAILURE_EVENTS=new Set(['error','blocked','hard_bounce','soft_bounce','deferred']);

const preview=env=>env.PREVIEW_MODE==='true';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const headers=env=>({accept:'application/json','api-key':env.BREVO_API_KEY});
const normalize=value=>String(value||'').trim().toLowerCase();

function hasOtpTag(event){
  const tags=Array.isArray(event?.tags)?event.tags.join(','):String(event?.tag||event?.tags||'');
  return tags.includes(OTP_TAG);
}
function safeReason(value){
  const text=String(value||'').trim();
  return text?text.slice(0,240):null;
}
function configuredDomain(env){
  const email=normalize(env.BREVO_SENDER_EMAIL);
  return email.includes('@')?email.split('@').pop():'';
}
async function getJson(url,env){
  const response=await fetch(url,{headers:headers(env)});
  const data=await response.json().catch(()=>({}));
  return{ok:response.ok,status:response.status,data};
}
function eventSummary(item){
  return item?{event:String(item.event||'unknown'),date:item.date||null,reason:safeReason(item.reason)}:null;
}

export async function handleBrevoDiagnostic(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/diagnostics/brevo-otp-latest'||request.method!=='GET')return null;
  if(!preview(env))return json({ok:false,error:'not_found'},404);
  if(!env.BREVO_API_KEY)return json({ok:false,error:'brevo_not_configured'},503);
  try{
    const [eventsResult,sendersResult,accountResult,domainsResult]=await Promise.all([
      getJson(BREVO_EVENTS_URL,env),getJson(BREVO_SENDERS_URL,env),getJson(BREVO_ACCOUNT_URL,env),getJson(BREVO_DOMAINS_URL,env)
    ]);
    if(!eventsResult.ok)return json({ok:false,provider:'brevo',providerStatus:eventsResult.status},502);

    const events=Array.isArray(eventsResult.data?.events)?eventsResult.data.events.filter(hasOtpTag):[];
    const latest=events[0]||null;
    const failure=events.find(item=>FAILURE_EVENTS.has(String(item?.event||'').toLowerCase()))||null;
    const eventCounts={};
    for(const item of events){const key=String(item?.event||'unknown');eventCounts[key]=(eventCounts[key]||0)+1}

    const configuredSender=normalize(env.BREVO_SENDER_EMAIL);
    const senders=Array.isArray(sendersResult.data?.senders)?sendersResult.data.senders:[];
    const matchingSender=senders.find(item=>normalize(item?.email)===configuredSender)||null;

    const domain=configuredDomain(env);
    const domains=Array.isArray(domainsResult.data?.domains)?domainsResult.data.domains:[];
    const matchingDomain=domains.find(item=>normalize(item?.domain_name||item?.domain)===domain)||null;

    const relay=accountResult.data?.relay||{};
    const relayData=relay?.data||{};
    return json({
      ok:true,
      found:Boolean(latest),
      eventCount:events.length,
      eventCounts,
      latest:eventSummary(latest),
      failure:eventSummary(failure),
      senderCheck:{apiOk:sendersResult.ok,configuredSenderFound:Boolean(matchingSender),configuredSenderActive:matchingSender?matchingSender.active===true:null},
      domainCheck:{apiOk:domainsResult.ok,configuredDomainListed:Boolean(matchingDomain),verified:matchingDomain?matchingDomain.verified===true:null,authenticated:matchingDomain?matchingDomain.authenticated===true:null},
      relayCheck:{apiOk:accountResult.ok,enabled:typeof relay.enabled==='boolean'?relay.enabled:null,status:String(relayData.status||relay.status||'unknown').slice(0,80),planType:String(relayData.planType||relay.planType||'unknown').slice(0,80)}
    });
  }catch(_){return json({ok:false,error:'brevo_diagnostic_unavailable'},503)}
}
