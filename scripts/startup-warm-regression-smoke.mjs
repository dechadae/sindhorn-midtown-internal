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

async function signIn(){
  await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState));
  await page.fill('#employeeNumber',employeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForURL(url=>new URL(url).pathname==='/',{waitUntil:'commit'});
}

async function snap(label){
  await page.evaluate(()=>window.SindhornStartupAudit?.snapshot?.());
  const data=await page.evaluate(label=>{
    let history=[];try{history=JSON.parse(localStorage.getItem('sindhorn-startup-audit:v1')||'[]')}catch{}
    const current=history.at(-1)||{};
    const nav=current.navigation||{};
    const fetchMs=kind=>{const rows=(current.fetches||[]).filter(x=>x.kind===kind);return rows.reduce((sum,x)=>sum+(Number(x.duration)||0),0)||0};
    const mark=name=>current.marks?.find(x=>x.name===name)?.startTime??null;
    return {label,controlledAtScriptStart:Boolean(current.sw?.controller),workerStart:nav.workerStart??null,responseStart:nav.responseStart??null,responseEnd:nav.responseEnd??null,domContentLoaded:nav.domContentLoadedEventEnd??null,profileMs:+fetchMs('employee-profile').toFixed(1),authRefreshMs:+fetchMs('auth-refresh').toFixed(1),bettaFirstFrame:mark('sindhorn-betta-first-frame'),startupReveal:mark('sindhorn-startup-enter-visible'),pagehideCount:(current.events||[]).filter(x=>x.name==='pagehide').length,updateFound:(current.events||[]).some(x=>x.name==='sw-updatefound'),historyCount:history.length};
  },label);
  console.log('SINDHORN_WARM_START '+JSON.stringify(data));
  return data;
}

try{
  await signIn();
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible');
  await page.waitForTimeout(1000);
  const first=await snap('first-authenticated-launch');

  await page.waitForTimeout(3000);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible');
  await page.waitForTimeout(1000);
  const warm1=await snap('warm-controlled-reload-1');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible');
  await page.waitForTimeout(1000);
  const warm2=await snap('warm-controlled-reload-2');

  console.log('SINDHORN_WARM_START_COMPARISON '+JSON.stringify({first,warm1,warm2}));
}finally{
  await context.close();
  await browser.close();
}
