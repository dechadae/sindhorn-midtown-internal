import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
if(!BASE_URL)throw new Error('BASE_URL required');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const workerEvents=[];
context.on('serviceworker',worker=>{
  workerEvents.push({event:'context-serviceworker',url:worker.url(),at:Date.now()});
  worker.on('close',()=>workerEvents.push({event:'worker-close',url:worker.url(),at:Date.now()}));
});

async function state(label){
  const value=await page.evaluate(async label=>{
    const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
    return{
      label,
      href:location.href,
      controller:navigator.serviceWorker.controller?.scriptURL||null,
      registration:registration?{
        scope:registration.scope,
        active:registration.active?{state:registration.active.state,scriptURL:registration.active.scriptURL}:null,
        waiting:registration.waiting?{state:registration.waiting.state,scriptURL:registration.waiting.scriptURL}:null,
        installing:registration.installing?{state:registration.installing.state,scriptURL:registration.installing.scriptURL}:null
      }:null
    };
  },label);
  console.log('SINDHORN_SW_INSTALL_STATE '+JSON.stringify(value));
  return value;
}

try{
  await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded'});
  if(!await page.evaluate(()=>('serviceWorker' in navigator)))throw new Error('Service worker API unavailable');
  await state('before-register');
  const registrationResult=await page.evaluate(async()=>{
    const started=performance.now();
    try{
      const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      return{ok:true,duration:+(performance.now()-started).toFixed(1),scope:registration.scope};
    }catch(error){return{ok:false,duration:+(performance.now()-started).toFixed(1),name:error?.name||null,message:error?.message||String(error)}}
  });
  console.log('SINDHORN_SW_REGISTER_RESULT '+JSON.stringify(registrationResult));
  await state('after-register');
  await page.waitForTimeout(3000);
  await state('after-3s');
  await page.waitForTimeout(9000);
  const after12=await state('after-12s');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1000);
  const afterReload=await state('after-reload');
  console.log('SINDHORN_SW_CONTEXT_EVENTS '+JSON.stringify(workerEvents));

  if(!registrationResult.ok)throw new Error(`Service worker registration failed: ${registrationResult.name||''} ${registrationResult.message||''}`);
  if(!after12.registration?.active&&!afterReload.registration?.active)throw new Error('Service worker never reached active state');
}finally{
  await context.close();
  await browser.close();
}
