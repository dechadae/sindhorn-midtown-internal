import {chromium} from 'playwright';

const base=process.env.STARTUP_BASE_URL;
const employee=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!base)throw new Error('STARTUP_BASE_URL required');
if(!employee||!/^[0-9]{6}$/.test(String(pin||'')))throw new Error('CI startup credentials unavailable');

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const page=await context.newPage();
try{
  await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState),null,{timeout:20000});
  await page.fill('#employeeNumber',employee);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:45000,waitUntil:'commit'});
  await page.waitForFunction(()=>document.documentElement.dataset.startupEnter==='visible',null,{timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.route==='today',null,{timeout:30000});
  await page.waitForTimeout(350);
  const result=await page.evaluate(()=>{
    const nav=performance.getEntriesByType('navigation')[0];
    const marks=Object.fromEntries(performance.getEntriesByType('mark').filter(entry=>entry.name.startsWith('sindhorn-')).map(entry=>[entry.name,+entry.startTime.toFixed(2)]));
    const resources=performance.getEntriesByType('resource').map(entry=>({name:entry.name,duration:+entry.duration.toFixed(2),transferSize:Number(entry.transferSize)||0,encodedBodySize:Number(entry.encodedBodySize)||0,decodedBodySize:Number(entry.decodedBodySize)||0,initiatorType:entry.initiatorType}));
    const sameOrigin=resources.filter(entry=>entry.name.startsWith(location.origin));
    const external=resources.filter(entry=>!entry.name.startsWith(location.origin)).map(entry=>{let url;try{url=new URL(entry.name)}catch{return null}return{host:url.host,path:url.pathname,duration:entry.duration,initiatorType:entry.initiatorType}}).filter(Boolean);
    const total=key=>sameOrigin.reduce((sum,entry)=>sum+(Number(entry[key])||0),0);
    const pathLoaded=path=>sameOrigin.some(entry=>{try{return new URL(entry.name).pathname===path}catch{return false}});
    return{
      navigation:{domContentLoadedMs:nav?+nav.domContentLoadedEventEnd.toFixed(2):null,loadEventMs:nav?+nav.loadEventEnd.toFixed(2):null},
      marks,
      durations:{
        authMs:marks['sindhorn-auth-ready']!=null&&marks['sindhorn-auth-start']!=null?+(marks['sindhorn-auth-ready']-marks['sindhorn-auth-start']).toFixed(2):null,
        locationMs:marks['sindhorn-location-load-ready']!=null&&marks['sindhorn-location-load-start']!=null?+(marks['sindhorn-location-load-ready']-marks['sindhorn-location-load-start']).toFixed(2):null,
        bootstrapMs:marks['sindhorn-bootstrap-import-ready']!=null&&marks['sindhorn-bootstrap-import-start']!=null?+(marks['sindhorn-bootstrap-import-ready']-marks['sindhorn-bootstrap-import-start']).toFixed(2):null,
        onboardingMs:marks['sindhorn-onboarding-import-ready']!=null&&marks['sindhorn-onboarding-import-start']!=null?+(marks['sindhorn-onboarding-import-ready']-marks['sindhorn-onboarding-import-start']).toFixed(2):null,
        startupRevealMs:marks['sindhorn-startup-enter-visible']??null
      },
      sameOrigin:{count:sameOrigin.length,transferBytes:total('transferSize'),encodedBytes:total('encodedBodySize'),decodedBytes:total('decodedBodySize')},
      legacyStartupAssets:{accountCss:pathLoaded('/account.css'),adminCss:pathLoaded('/admin.css'),html2canvas:pathLoaded('/vendor/html2canvas.min.js'),threeSource:pathLoaded('/vendor/three.module.js')},
      external:external.sort((a,b)=>b.duration-a.duration).slice(0,12),
      largest:[...sameOrigin].sort((a,b)=>b.decodedBodySize-a.decodedBodySize).slice(0,12)
    };
  });
  if(result.legacyStartupAssets.accountCss||result.legacyStartupAssets.adminCss)throw new Error(`Legacy route CSS loaded on Today: ${JSON.stringify(result.legacyStartupAssets)}`);
  if(result.legacyStartupAssets.html2canvas||result.legacyStartupAssets.threeSource)throw new Error(`Deferred vendor source loaded on Today: ${JSON.stringify(result.legacyStartupAssets)}`);
  console.log(`SINDHORN_STARTUP_PERFORMANCE ${JSON.stringify(result)}`);
}finally{
  await context.close();
  await browser.close();
}
