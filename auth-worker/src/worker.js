import baseWorker from './index.js';
import {handleContactOtpRoute} from './contact-otp.js';

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/otp/')){
      if(request.method==='OPTIONS')return baseWorker.fetch(request,env,ctx);
      const response=await handleContactOtpRoute(request,env);
      if(response)return response;
    }
    return baseWorker.fetch(request,env,ctx);
  }
};
