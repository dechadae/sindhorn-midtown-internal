import { chromium } from 'playwright';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
const employeeNumber=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!BASE_URL)throw new Error('BASE_URL required');
if(!employeeNumber||!pin||!/^[0-9]{6}$/.test(pin))throw new Error('CI smoke credentials required');

const BETTA_STUB=`
export async function initEnvironment(){
  document.body.classList.add('environment-ready');
  performance.mark?.('sindhorn-betta-first-frame');
  document.dispatchEvent(new CustomEvent('sindhorn:betta-first-frame'));
  return null;
}
`;

async function signIn(page){
  await page.goto(`${BASE_URL}/login.html`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState),null,{timeout:15000});
  await page.fill('#employeeNumber',employeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForURL(url=>new URL(url).pathname==='/',{waitUntil:'commit',timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible',null,{timeout:30000});
}

async function measureReload(page,label){
  const started=Date.now();
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  const domContentLoadedMs=Date.now()-started;
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible',null,{timeout:30000});
  const revealMs=Date.now()-started;
  const nav=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0]||{};return{responseEnd:+(n.responseEnd||0).toFixed(1),domInteractive:+(n.domInteractive||0).toFixed(1),domContentLoaded:+(n.domContentLoadedEventEnd||0).toFixed(1),unloadStart:+(n.unloadEventStart||0).toFixed(1),unloadEnd:+(n.unloadEventEnd||0).toFixed(1),bettaFirstFrame:performance.getEntriesByName('sindhorn-betta-first-frame')[0]?.startTime??null}});
  const result={label,domContentLoadedMs,revealMs,...nav};
  console.log('SINDHORN_BETTA_ISOLATION '+JSON.stringify(result));
  return result;
}

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/betta-runtime.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:BETTA_STUB}));
  await signIn(page);
  const reload1=await measureReload(page,'no-sw-betta-stub-reload-1');
  const reload2=await measureReload(page,'no-sw-betta-stub-reload-2');
  console.log('SINDHORN_BETTA_ISOLATION_COMPARISON '+JSON.stringify({reload1,reload2}));
  await context.close();
}finally{
  await browser.close();
}
