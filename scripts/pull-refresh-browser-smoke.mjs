import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Pull Reload Preview',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Pull Reload Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=3');
`;

async function pullReady(page,pathname,expectedRoute){
  await page.goto(`${BASE_URL}${pathname}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('body>.pull-refresh[data-shell-pull-refresh="true"]');
  await page.waitForFunction(route=>document.body.dataset.route===route,expectedRoute);
  await page.evaluate(()=>{
    scrollTo(0,0);
    const fire=(type,y)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      const touches=type==='touchend'||type==='touchcancel'?[]:[{clientX:190,clientY:y}];
      Object.defineProperty(event,'touches',{configurable:true,value:touches});
      document.dispatchEvent(event);
    };
    fire('touchstart',12);
    fire('touchmove',160);
  });
  await page.waitForFunction(()=>document.querySelector('body>.pull-refresh')?.classList.contains('is-ready'));
  const result=await page.$eval('body>.pull-refresh',node=>{
    const spinner=node.querySelector('.pull-refresh-spinner'),style=getComputedStyle(node),spinnerStyle=getComputedStyle(spinner);
    return{
      route:document.body.dataset.route,
      label:node.querySelector('strong')?.textContent.trim(),
      svgCount:node.querySelectorAll('svg').length,
      containerRadius:style.borderRadius,
      spinnerWidth:spinnerStyle.width,
      spinnerHeight:spinnerStyle.height,
      spinnerRadius:spinnerStyle.borderRadius,
      spinnerBackground:spinnerStyle.backgroundColor,
      spinnerBorderTop:spinnerStyle.borderTopWidth,
      ready:node.classList.contains('is-ready')
    };
  });
  assert(result.route===expectedRoute,`${pathname}: route drift ${JSON.stringify(result)}`);
  assert(result.label==='Release to reload',`${pathname}: wrong label ${JSON.stringify(result)}`);
  assert(result.svgCount===0,`${pathname}: legacy arrow/SVG returned ${JSON.stringify(result)}`);
  assert(result.containerRadius==='12px',`${pathname}: pull container geometry drift ${JSON.stringify(result)}`);
  assert(result.spinnerWidth==='18px'&&result.spinnerHeight==='18px',`${pathname}: spinner size drift ${JSON.stringify(result)}`);
  assert(result.spinnerRadius==='50%',`${pathname}: spinner is not circular ${JSON.stringify(result)}`);
  assert(result.spinnerBackground==='rgba(0, 0, 0, 0)',`${pathname}: spinner gained a filled box ${JSON.stringify(result)}`);
  assert(result.spinnerBorderTop==='2px'&&result.ready,`${pathname}: line-spinner contract failed ${JSON.stringify(result)}`);
  await page.evaluate(()=>{
    const event=new Event('touchcancel',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'touches',{configurable:true,value:[]});
    document.dispatchEvent(event);
  });
  return result;
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(30000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/**',route=>{
  const url=route.request().url(),body=url.includes('sindhorn_settings_manifest')?JSON.stringify(manifest):'[]';
  route.fulfill({status:200,contentType:'application/json',body});
});
await page.route('**/rest/v1/sindhorn_app_files*',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));

try{
  const fnb=await pullReady(page,'/fnb','fnb');
  const settings=await pullReady(page,'/settings','settings');
  const brand=await pullReady(page,'/brand','brand');
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,fnb,settings,brand}));
}finally{await context.close();await browser.close()}
