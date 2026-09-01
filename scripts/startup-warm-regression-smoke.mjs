import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
const employeeNumber=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!BASE_URL)throw new Error('BASE_URL required');
if(!employeeNumber||!pin||!/^[0-9]{6}$/.test(pin))throw new Error('CI smoke credentials required');

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const page=await context.newPage();
page.setDefaultTimeout(20000);
const phase=name=>console.log(`SINDHORN_WARM_START_PHASE ${name}`);

async function signIn(){
  phase('login-open');
  await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState),null,{timeout:15000});
  await page.fill('#employeeNumber',employeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  phase('login-submit');
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  try{await page.waitForURL(url=>new URL(url).pathname==='/',{waitUntil:'commit',timeout:30000})}
  catch(error){const status=(await page.locator('#status').textContent().catch(()=>''))?.trim()||'';throw new Error(`Sign-in did not reach app. ${status} ${error.message}`)}
  phase('root-committed');
}

async function waitReveal(label){
  phase(`${label}-wait-reveal`);
  try{await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible',null,{timeout:35000})}
  catch(error){console.log(`SINDHORN_WARM_START_REVEAL_TIMEOUT ${label} ${JSON.stringify({href:page.url(),message:error.message})}`)}
  await page.waitForTimeout(250);
}

async function swState(label){
  const state=await page.evaluate(async label=>{const r=await navigator.serviceWorker.getRegistration('/').catch(()=>null);return{label,controller:navigator.serviceWorker.controller?.scriptURL||null,active:r?.active?.state||null,waiting:r?.waiting?.state||null,installing:r?.installing?.state||null}},label);
  console.log('SINDHORN_WARM_SW_STATE '+JSON.stringify(state));
  return state;
}

async function waitForSettledServiceWorker(){
  phase('wait-sw-settled');
  const started=Date.now();
  await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration('/').catch(()=>null);return Boolean(r?.active)&&!r?.installing&&!r?.waiting},{timeout:60000});
  await page.waitForTimeout(1000);
  console.log('SINDHORN_WARM_SW_SETTLED '+JSON.stringify({durationMs:Date.now()-started}));
  return swState('settled');
}

async function snap(label,wall={}){
  const data=await page.evaluate(({label,wall})=>{
    const n=performance.getEntriesByType('navigation')[0]||{};
    const resources=performance.getEntriesByType('resource').map(x=>({path:x.name,initiatorType:x.initiatorType||'',startTime:+x.startTime.toFixed(1),responseEnd:+x.responseEnd.toFixed(1),duration:+x.duration.toFixed(1),transferSize:Number(x.transferSize)||0,encodedBodySize:Number(x.encodedBodySize)||0,deliveryType:x.deliveryType||''}));
    const marks=performance.getEntriesByType('mark');
    const mark=name=>marks.find(x=>x.name===name)?.startTime??null;
    const sumWhere=predicate=>+resources.filter(predicate).reduce((sum,x)=>sum+x.duration,0).toFixed(1);
    const swControlled=Boolean(navigator.serviceWorker?.controller);
    return {
      label,
      href:location.href,
      startupEnter:document.documentElement.dataset.startupEnter||null,
      swControlled,
      workerStart:Number.isFinite(n.workerStart)?+n.workerStart.toFixed(1):null,
      responseStart:Number.isFinite(n.responseStart)?+n.responseStart.toFixed(1):null,
      responseEnd:Number.isFinite(n.responseEnd)?+n.responseEnd.toFixed(1):null,
      domContentLoaded:Number.isFinite(n.domContentLoadedEventEnd)?+n.domContentLoadedEventEnd.toFixed(1):null,
      loadEnd:Number.isFinite(n.loadEventEnd)?+n.loadEventEnd.toFixed(1):null,
      profileMs:sumWhere(x=>x.path.includes('/rest/v1/rpc/sindhorn_current_employee_profile')),
      authRefreshMs:sumWhere(x=>x.path.includes('/auth/v1/token')),
      bettaFirstFrame:mark('sindhorn-betta-first-frame'),
      startupReveal:mark('sindhorn-startup-enter-visible'),
      wallDomContentLoadedMs:wall.domContentLoadedMs??null,
      wallRevealMs:wall.revealMs??null,
      slowestResources:resources.sort((a,b)=>b.duration-a.duration).slice(0,15)
    };
  },{label,wall});
  console.log('SINDHORN_WARM_START '+JSON.stringify(data));
  return data;
}

async function reloadAndMeasure(label){
  phase(`${label}-reload`);
  const started=Date.now();
  await page.reload({waitUntil:'domcontentloaded',timeout:40000});
  const domContentLoadedMs=Date.now()-started;
  await waitReveal(label);
  const revealMs=Date.now()-started;
  return snap(label,{domContentLoadedMs,revealMs});
}

try{
  await signIn();
  await waitReveal('first');
  const first=await snap('first-authenticated-launch');
  await swState('after-first');

  const immediateWarm=await reloadAndMeasure('immediate-warm-reload');
  await swState('after-immediate-warm');

  await waitForSettledServiceWorker();
  const settledWarm1=await reloadAndMeasure('settled-warm-reload-1');
  const settledWarm2=await reloadAndMeasure('settled-warm-reload-2');

  console.log('SINDHORN_WARM_START_COMPARISON '+JSON.stringify({first,immediateWarm,settledWarm1,settledWarm2}));
}finally{
  await context.close();
  await browser.close();
}
