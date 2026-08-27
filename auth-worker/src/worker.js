import baseWorker from './index.js';
import {emailOtpHealth,handleContactOtpRoute} from './contact-otp.js';
import {handleBrevoDiagnostic} from './brevo-diagnostics.js';

async function migrateAuthKeyToSupabase(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/migration/store-supabase-auth-key'||request.method!=='POST')return null;
  if(env.PREVIEW_MODE!=='true')return new Response(JSON.stringify({ok:false,error:'not_found'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store'}});
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return new Response(JSON.stringify({ok:false,error:'supabase_not_configured'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
  try{
    const response=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sindhorn_store_auth_bridge_secret`,{
      method:'POST',
      headers:{apikey:env.SUPABASE_SECRET_KEY,authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'content-type':'application/json'},
      body:JSON.stringify({p_secret:env.SUPABASE_SECRET_KEY})
    });
    return new Response(JSON.stringify({ok:response.ok,stored:response.ok}),{status:response.ok?200:502,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }catch(_){
    return new Response(JSON.stringify({ok:false,error:'vault_migration_failed'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }
}

export default{
  async fetch(request,env,ctx){
    const migration=await migrateAuthKeyToSupabase(request,env);
    if(migration)return migration;
    const diagnostic=await handleBrevoDiagnostic(request,env);
    if(diagnostic)return diagnostic;
    const url=new URL(request.url);
    if(url.pathname.startsWith('/otp/')){
      if(request.method==='OPTIONS')return baseWorker.fetch(request,env,ctx);
      const response=await handleContactOtpRoute(request,env);
      if(response)return response;
    }
    if(url.pathname==='/health'&&request.method==='GET'){
      const response=await baseWorker.fetch(request,env,ctx);
      try{
        const data=await response.clone().json();
        return new Response(JSON.stringify({...data,...emailOtpHealth(env)}),{status:response.status,headers:response.headers});
      }catch(_){return response}
    }
    return baseWorker.fetch(request,env,ctx);
  }
};
