import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'00000',display_name:'Startup Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
// Synthetic regression fixture only. Never copy production hotel figures into this public test.
const TEST_BUSINESS_DATE='2000-01-01';
const dashboard={
  businessDate:TEST_BUSINESS_DATE,revision:1,validationStatus:'passed',publishedAt:'2000-01-01T00:00:00.000Z',sources:[],
  fnb:{summary:{daily:{revenue:1000,forecast:1200,covers:10},mtd:{revenue:5000,forecast:6000,covers:50}},outlets:[],notes:[]},
  rooms:{months:[],segments:[]},flags:[]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(12000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_business_dashboard_read_model',async route=>{
  await new Promise(resolve=>setTimeout(resolve,4500));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)});
});

try{
  const started=Date.now();
  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.business-dashboard-route',{state:'attached',timeout:2500});
  const early=await page.evaluate(()=>{
    const route=document.querySelector('.business-dashboard-route'),header=document.querySelector('#app-header .masthead'),footer=document.getElementById('app-footer');
    return{
      shellLoading:document.documentElement.dataset.shellLoading,
      routeOpacity:route?Number.parseFloat(getComputedStyle(route).opacity):null,
      routeHostOpacity:Number.parseFloat(getComputedStyle(document.getElementById('route-view')).opacity),
      title:route?.querySelector('.app-route-title')?.textContent?.trim()||'',
      loadingCopy:route?.querySelector('.app-route-copy')?.textContent?.trim()||'',
      headerVisible:Boolean(header)&&Number.parseFloat(getComputedStyle(document.getElementById('app-header')).opacity)>.9,
      footerDisplay:getComputedStyle(footer).display,
      businessDate:route?.dataset.businessDate||''
    };
  });
  const earlyElapsedMs=Date.now()-started;
  assert(earlyElapsedMs<2500,`Today startup shell took too long to mount: ${earlyElapsedMs}ms`);
  assert(early.shellLoading==='true',`Regression probe must observe the shell before slow dashboard data completes: ${JSON.stringify(early)}`);
  assert(early.routeHostOpacity>.9&&early.routeOpacity>.9,`Today route is still artificially hidden during data loading: ${JSON.stringify(early)}`);
  assert(early.title==='Hotel Business'&&/Loading the latest approved daily business report/.test(early.loadingCopy),`Today loading state is not visible: ${JSON.stringify(early)}`);
  assert(early.headerVisible&&early.footerDisplay!=='none',`Persistent shell is not progressively visible: ${JSON.stringify(early)}`);
  assert(early.businessDate==='',`Slow RPC unexpectedly completed before early startup probe: ${JSON.stringify(early)}`);

  await page.waitForFunction(expectedDate=>document.querySelector('.business-dashboard-route')?.dataset.businessDate===expectedDate,TEST_BUSINESS_DATE,{timeout:12000});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  const final=await page.evaluate(()=>({
    shellLoading:document.documentElement.dataset.shellLoading,
    title:document.querySelector('.business-dashboard-route .app-route-title')?.textContent?.trim(),
    businessDate:document.querySelector('.business-dashboard-route')?.dataset.businessDate||''
  }));
  assert(final.shellLoading==='false'&&final.title==='Hotel Business'&&final.businessDate===TEST_BUSINESS_DATE,`Today did not complete after delayed data load: ${JSON.stringify(final)}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,earlyElapsedMs,early,final}));
}finally{
  await context.close();
  await browser.close();
}
