import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'Utility Preview',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Utility Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js?v=2');
`;

function noBlur(value){return !/blur\((?!0(?:px)?\))/i.test(String(value||''))}
async function recipe(page,selector,containerSelector){
  return page.$eval(selector,(node,containerSelector)=>{
    const s=getComputedStyle(node),rect=node.getBoundingClientRect(),container=document.querySelector(containerSelector),hostRect=container?.getBoundingClientRect();
    return{background:s.backgroundColor,borderWidth:s.borderTopWidth,filter:String(s.backdropFilter||s.webkitBackdropFilter||'none'),fontSize:s.fontSize,height:s.height,rightGap:hostRect?Math.round(hostRect.right-rect.right):null,className:node.className};
  },containerSelector);
}
function assertUtility(value,label){
  assert(value.background==='rgba(0, 0, 0, 0)',`${label}: painted background ${JSON.stringify(value)}`);
  assert(value.borderWidth==='0px',`${label}: border returned ${JSON.stringify(value)}`);
  assert(noBlur(value.filter),`${label}: blur returned ${JSON.stringify(value)}`);
  assert(value.fontSize==='12px'&&value.height==='36px',`${label}: type/height drift ${JSON.stringify(value)}`);
  assert(value.rightGap!==null&&Math.abs(value.rightGap)<=8,`${label}: not right anchored ${JSON.stringify(value)}`);
  assert(String(value.className).includes('app-utility-action'),`${label}: not using canonical class ${JSON.stringify(value)}`);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
const page=await context.newPage();page.setDefaultTimeout(30000);
await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
await page.route('**/rest/v1/rpc/**',route=>{
  const url=route.request().url();
  const body=url.includes('sindhorn_settings_manifest')?JSON.stringify(manifest):'[]';
  route.fulfill({status:200,contentType:'application/json',body});
});

try{
  await page.goto(`${BASE_URL}/fnb`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.fnb-route [data-fnb-share="page"].app-utility-action');
  const share=await recipe(page,'.fnb-route [data-fnb-share="page"].app-utility-action','.fnb-hero');
  assertUtility(share,'F&B Share');

  await page.goto(`${BASE_URL}/settings`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.settings-hero .settings-hero-signout.app-utility-action');
  const signout=await recipe(page,'.settings-hero .settings-hero-signout.app-utility-action','.settings-hero');
  assertUtility(signout,'Settings Sign out');

  await page.goto(`${BASE_URL}/hotel-factsheet`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.factsheet-route [data-route-back-to-top].app-utility-action');
  const factsheetTop=await recipe(page,'.factsheet-route [data-route-back-to-top].app-utility-action','.factsheet-route');
  assertUtility(factsheetTop,'Factsheet Back to top');

  // /ci used to be a route inside this SPA (`.ci-route`), which is why it was
  // checked here. It is now the standalone UI Library page at site/ci.html —
  // a different document, not authenticated, not part of this app's routing.
  // ci-page-render-smoke.mjs asserts `.app-utility-action` stays BARE there
  // instead, against the page it actually renders.

  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,share,signout,factsheetTop}));
}finally{await context.close();await browser.close()}
