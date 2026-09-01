import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
const employeeNumber=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!BASE_URL)throw new Error('BASE_URL required');
if(!employeeNumber||!pin||!/^[0-9]{6}$/.test(pin))throw new Error('CI smoke credentials required');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const page=await context.newPage();
page.setDefaultTimeout(45000);
const errors=[];
page.on('pageerror',error=>errors.push(`pageerror:${error.message}`));
page.on('console',message=>{if(message.type()==='error')errors.push(`console:${message.text()}`)});

async function signIn(){
  await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState));
  await page.fill('#employeeNumber',employeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForURL(url=>new URL(url).pathname==='/',{waitUntil:'commit'});
}

function summarize(history){
  return history.map((session,index)=>{
    const event=(name)=>session.events?.find(item=>item.name===name)?.t??null;
    const lastEvent=(name)=>[...(session.events||[])].reverse().find(item=>item.name===name)?.t??null;
    const mark=name=>session.marks?.find(item=>item.name===name)?.startTime??null;
    const fetchMs=kind=>{const rows=(session.fetches||[]).filter(item=>item.kind===kind);return rows.length?+rows.reduce((sum,item)=>sum+(Number(item.duration)||0),0).toFixed(1):null};
    return{
      index:index+1,
      standalone:session.standalone,
      controlledAtScriptStart:Boolean(session.sw?.controller),
      navigationType:session.navigation?.type||null,
      workerStart:session.navigation?.workerStart??null,
      responseStart:session.navigation?.responseStart??null,
      domContentLoaded:session.navigation?.domContentLoadedEventEnd??null,
      profileMs:fetchMs('employee-profile'),
      authRefreshMs:fetchMs('auth-refresh'),
      bettaFirstFrame:mark('sindhorn-betta-first-frame')??event('betta-first-frame'),
      startupReveal:mark('sindhorn-startup-enter-visible')??event('startup-enter-visible'),
      swUpdateStart:event('sw-update-start'),
      swUpdateEnd:event('sw-update-end'),
      updateFound:event('sw-updatefound'),
      controllerChange:lastEvent('sw-controllerchange'),
      pagehide:lastEvent('pagehide'),
      workerStates:(session.events||[]).filter(item=>item.name==='sw-worker-state').map(item=>({t:item.t,state:item.detail?.state||null}))
    };
  });
}

try{
  await signIn();
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible');
  await page.waitForTimeout(9000);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:30000});
  await page.waitForFunction(()=>Boolean(window.SindhornStartupAudit?.snapshot));
  await page.evaluate(()=>window.SindhornStartupAudit.snapshot());
  const firstHistory=await page.evaluate(()=>JSON.parse(localStorage.getItem('sindhorn-startup-audit:v1')||'[]'));
  if(firstHistory.length<1)throw new Error('No Phase 0 audit navigation was recorded');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible');
  await page.waitForTimeout(2500);
  await page.evaluate(()=>window.SindhornStartupAudit.snapshot());
  const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('sindhorn-startup-audit:v1')||'[]'));
  if(history.length<2)throw new Error(`Expected at least two startup records, got ${history.length}`);
  if(!history.some(session=>session.sw?.controller))throw new Error('No service-worker-controlled startup record was captured');

  const summary=summarize(history);
  console.log('SINDHORN_STARTUP_AUDIT_SUMMARY '+JSON.stringify(summary));
  console.log('SINDHORN_STARTUP_AUDIT_HISTORY '+JSON.stringify(history));
  if(errors.length)console.log('SINDHORN_STARTUP_AUDIT_BROWSER_ERRORS '+JSON.stringify(errors));
}finally{
  await context.close();
  await browser.close();
}
