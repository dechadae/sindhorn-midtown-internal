import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'00000',display_name:'Startup Preview',pin_configured_at:new Date().toISOString()};
performance.mark?.('sindhorn-smoke-auth-shim');
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
performance.mark?.('sindhorn-smoke-before-bootstrap');
await import('/bootstrap.js');
performance.mark?.('sindhorn-smoke-after-bootstrap');
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
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(`pageerror:${error.message}`));
page.on('console',message=>{if(message.type()==='error'||message.type()==='warning')pageErrors.push(`${message.type()}:${message.text()}`)});
await page.addInitScript(()=>{
  window.__startupTransitions=[];
  performance.mark?.('sindhorn-smoke-document-start');
  document.addEventListener('transitionrun',event=>{
    if(event.propertyName!=='opacity')return;
    const id=event.target?.id;
    if(id==='route-view'||id==='environmentCanvas')window.__startupTransitions.push({id,t:performance.now()});
  },true);
  new MutationObserver(()=>{
    const route=document.querySelector('.business-dashboard-route');
    if(route&&!performance.getEntriesByName('sindhorn-smoke-today-mounted').length)performance.mark?.('sindhorn-smoke-today-mounted');
  }).observe(document,{subtree:true,childList:true});
});
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/sindhorn_business_dashboard_read_model',async route=>{
  await new Promise(resolve=>setTimeout(resolve,4500));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)});
});

try{
  const wallStart=Date.now();
  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded',timeout:15000});
  const domContentLoadedWallMs=Date.now()-wallStart;
  await page.waitForSelector('.business-dashboard-route',{state:'attached',timeout:10000});
  const mounted=await page.evaluate(domContentLoadedWallMs=>{
    const route=document.querySelector('.business-dashboard-route');
    const marks=Object.fromEntries(performance.getEntriesByType('mark').filter(item=>item.name.startsWith('sindhorn-')).map(item=>[item.name,item.startTime]));
    const runtime=performance.getEntriesByType('resource').find(item=>item.name.includes('/betta-runtime.js'));
    return{
      browserMs:performance.now(),domContentLoadedWallMs,
      startupEnter:document.documentElement.dataset.startupEnter,
      shellLoading:document.documentElement.dataset.shellLoading,
      title:route?.querySelector('.app-route-title')?.textContent?.trim()||'',
      loadingCopy:route?.querySelector('.app-route-copy')?.textContent?.trim()||'',
      businessDate:route?.dataset.businessDate||'',
      marks,
      bettaRuntime:runtime?{startTime:runtime.startTime,responseEnd:runtime.responseEnd,duration:runtime.duration,transferSize:runtime.transferSize,encodedBodySize:runtime.encodedBodySize}:null
    };
  },domContentLoadedWallMs);
  assert(mounted.title==='Hotel Business'&&/Loading the latest approved daily business report/.test(mounted.loadingCopy),`Today loading structure did not mount before business data: ${JSON.stringify({mounted,pageErrors})}`);
  assert(mounted.businessDate==='',`Slow RPC unexpectedly completed before startup reveal: ${JSON.stringify({mounted,pageErrors})}`);

  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible',{timeout:10000});
  await page.waitForFunction(()=>window.__startupTransitions.some(item=>item.id==='route-view')&&window.__startupTransitions.some(item=>item.id==='environmentCanvas'),{timeout:10000});
  await page.waitForFunction(()=>{
    const routeHost=document.getElementById('route-view'),canvas=document.getElementById('environmentCanvas');
    return Number.parseFloat(getComputedStyle(routeHost).opacity)>.95&&Number.parseFloat(getComputedStyle(canvas).opacity)>.95;
  },{timeout:10000});
  const reveal=await page.evaluate(()=>{
    const route=document.querySelector('.business-dashboard-route'),routeHost=document.getElementById('route-view'),canvas=document.getElementById('environmentCanvas'),header=document.querySelector('#app-header .masthead'),footer=document.getElementById('app-footer');
    const transitions=window.__startupTransitions||[],routeTransition=transitions.find(item=>item.id==='route-view'),canvasTransition=transitions.find(item=>item.id==='environmentCanvas');
    const marks=Object.fromEntries(performance.getEntriesByType('mark').filter(item=>item.name.startsWith('sindhorn-')).map(item=>[item.name,item.startTime]));
    return{
      browserMs:performance.now(),
      startupEnter:document.documentElement.dataset.startupEnter,
      shellLoading:document.documentElement.dataset.shellLoading,
      routeHostOpacity:Number.parseFloat(getComputedStyle(routeHost).opacity),
      canvasOpacity:Number.parseFloat(getComputedStyle(canvas).opacity),
      headerVisible:Boolean(header)&&Number.parseFloat(getComputedStyle(document.getElementById('app-header')).opacity)>.9,
      footerVisible:Number.parseFloat(getComputedStyle(footer).opacity)>.9&&getComputedStyle(footer).display!=='none',
      environmentReady:document.body.classList.contains('environment-ready'),
      bettaFirstFrame:document.body.dataset.bettaFirstFrame||'',
      businessDate:route?.dataset.businessDate||'',
      routeTransitionAt:routeTransition?.t??null,
      canvasTransitionAt:canvasTransition?.t??null,
      transitionDeltaMs:routeTransition&&canvasTransition?Math.abs(routeTransition.t-canvasTransition.t):null,
      marks
    };
  });
  console.log(JSON.stringify({phase:'startup-diagnostic',baseUrl:BASE_URL,mounted,reveal,pageErrors}));
  assert(Number.isFinite(reveal.routeTransitionAt)&&reveal.routeTransitionAt<2500,`Synchronized Today/Betta fade started too late in the browser: ${JSON.stringify({mounted,reveal,pageErrors})}`);
  assert(reveal.startupEnter==='visible'&&reveal.environmentReady&&reveal.bettaFirstFrame==='ready',`Startup reveal fired before actual Betta first frame: ${JSON.stringify({mounted,reveal,pageErrors})}`);
  assert(reveal.routeHostOpacity>.95&&reveal.canvasOpacity>.95&&reveal.headerVisible&&reveal.footerVisible,`Today and Betta did not finish the shared fade together: ${JSON.stringify({mounted,reveal,pageErrors})}`);
  assert(Number.isFinite(reveal.transitionDeltaMs)&&reveal.transitionDeltaMs<=16,`Today and Betta opacity transitions did not start in the same frame: ${JSON.stringify({mounted,reveal,pageErrors})}`);
  assert(reveal.businessDate==='',`Startup reveal waited for private business data: ${JSON.stringify({mounted,reveal,pageErrors})}`);

  await page.waitForFunction(expectedDate=>document.querySelector('.business-dashboard-route')?.dataset.businessDate===expectedDate,TEST_BUSINESS_DATE,{timeout:12000});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false');
  const final=await page.evaluate(()=>({
    startupEnter:document.documentElement.dataset.startupEnter,
    shellLoading:document.documentElement.dataset.shellLoading,
    title:document.querySelector('.business-dashboard-route .app-route-title')?.textContent?.trim(),
    businessDate:document.querySelector('.business-dashboard-route')?.dataset.businessDate||''
  }));
  assert(final.startupEnter==='visible'&&final.shellLoading==='false'&&final.title==='Hotel Business'&&final.businessDate===TEST_BUSINESS_DATE,`Today did not complete after delayed data load: ${JSON.stringify({final,pageErrors})}`);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,mounted,reveal,final,pageErrors}));
}finally{
  await context.close();
  await browser.close();
}
