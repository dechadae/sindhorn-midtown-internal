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
async function senderState(env){
  const result=await getJson(BREVO_SENDERS_URL,env);
  const configuredSender=normalize(env.BREVO_SENDER_EMAIL);
  const senders=Array.isArray(result.data?.senders)?result.data.senders:[];
  const matching=senders.find(item=>normalize(item?.email)===configuredSender)||null;
  return{result,matching};
}

export async function handleBrevoDiagnostic(request,env){
  const url=new URL(request.url);
  if(!preview(env)||!env.BREVO_API_KEY){
    if(url.pathname.startsWith('/diagnostics/brevo-'))return json({ok:false,error:preview(env)?'brevo_not_configured':'not_found'},preview(env)?503:404);
    return null;
  }

  if(url.pathname==='/diagnostics/brevo-create-configured-sender'&&request.method==='POST'){
    try{
      const before=await senderState(env);
      if(before.matching)return json({ok:true,created:false,alreadyExists:true,active:before.matching.active===true});
      const response=await fetch(BREVO_SENDERS_URL,{
        method:'POST',
        headers:{...headers(env),'content-type':'application/json'},
        body:JSON.stringify({email:env.BREVO_SENDER_EMAIL,name:env.BREVO_SENDER_NAME||'Sindhorn Midtown Internal'})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)return json({ok:false,created:false,providerStatus:response.status,errorCode:String(data?.code||'provider_error').slice(0,80)},502);
      return json({ok:true,created:true,alreadyExists:false,senderIdPresent:Boolean(data?.id),dkimError:typeof data?.dkimError==='boolean'?data.dkimError:null,spfError:typeof data?.spfError==='boolean'?data.spfError:null});
    }catch(_){return json({ok:false,error:'brevo_sender_creation_unavailable'},503)}
  }

  if(url.pathname!=='/diagnostics/brevo-otp-latest'||request.method!=='GET')return null;
  try{
    const [eventsResult,senderResult,accountResult,domainsResult]=await Promise.all([
      getJson(BREVO_EVENTS_URL,env),senderState(env),getJson(BREVO_ACCOUNT_URL,env),getJson(BREVO_DOMAINS_URL,env)
    ]);
    if(!eventsResult.ok)return json({ok:false,provider:'brevo',providerStatus:eventsResult.status},502);

    const events=Array.isArray(eventsResult.data?.events)?eventsResult.data.events.filter(hasOtpTag):[];
    const failure=events.find(item=>FAILURE_EVENTS.has(String(item?.event||'').toLowerCase()))||null;
    const latest=failure||events[0]||null;
    const eventCounts={};
    for(const item of events){const key=String(item?.event||'unknown');eventCounts[key]=(eventCounts[key]||0)+1}

    const matchingSender=senderResult.matching;
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
      senderCheck:{apiOk:senderResult.result.ok,configuredSenderFound:Boolean(matchingSender),configuredSenderActive:matchingSender?matchingSender.active===true:null},
      domainCheck:{apiOk:domainsResult.ok,configuredDomainListed:Boolean(matchingDomain),verified:matchingDomain?matchingDomain.verified===true:null,authenticated:matchingDomain?matchingDomain.authenticated===true:null},
      relayCheck:{apiOk:accountResult.ok,enabled:typeof relay.enabled==='boolean'?relay.enabled:null,status:String(relayData.status||relay.status||'unknown').slice(0,80),planType:String(relayData.planType||relay.planType||'unknown').slice(0,80)}
    });
  }catch(_){return json({ok:false,error:'brevo_diagnostic_unavailable'},503)}
}
