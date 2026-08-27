import baseWorker from './index.js';
import {emailOtpHealth,handleContactOtpRoute} from './contact-otp.js';

export default{
  async fetch(request,env,ctx){
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
