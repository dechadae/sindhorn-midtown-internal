import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.PHASE82_BASE_URL;
if(!base)throw new Error('PHASE82_BASE_URL required');
const smokeEmployeeNumber=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const smokePin=process.env.CI_SMOKE_PIN;
if(!smokeEmployeeNumber||!smokePin)throw new Error('CI_SMOKE_EMPLOYEE_NUMBER and CI_SMOKE_PIN required');
if(!/^[0-9]{6}$/.test(smokePin))throw new Error('CI_SMOKE_PIN must be six digits');
fs.mkdirSync('phase82-artifacts',{recursive:true});
const browser=await chromium.launch({
  headless:true,
  args:[
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=CalculateNativeWinOcclusion'
  ]
});
const errors=[];

async function sampleFrames(page,label,count=30,timeoutMs=15000){
  const result=await page.evaluate(({count,timeoutMs})=>new Promise(resolve=>{
    const values=[];let last=performance.now(),done=false;
    const finish=(timedOut=false)=>{
      if(done)return;
      done=true;
      const warmup=Math.min(5,Math.max(0,values.length-1));
      resolve({values:values.slice(warmup),timedOut});
    };
    const timer=setTimeout(()=>finish(true),timeoutMs);
    function tick(now){
      if(done)return;
      values.push(values.length?now-last:16.7);last=now;
      if(values.length>=count){clearTimeout(timer);finish(false)}else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }),{count,timeoutMs});
  const samples=result.values;
  if(!samples.length)return{frameAverageMs:null,frameP95Ms:null,frameSamples:0,timedOut:result.timedOut,label};
  const sorted=[...samples].sort((a,b)=>a-b),avg=samples.reduce((a,b)=>a+b,0)/samples.length,p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  return{frameAverageMs:+avg.toFixed(2),frameP95Ms:+p95.toFixed(2),frameSamples:samples.length,timedOut:result.timedOut,label};
}

async function signIn(page,name){
  await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.SindhornEmployeeAuth?.getState),null,{timeout:20000});
  await page.fill('#employeeNumber',smokeEmployeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,smokePin[i]);
  /* CI_SMOKE_EMPLOYEE_NUMBER is a non-production synthetic identifier and may
     intentionally not match the human-facing numeric Employee ID HTML pattern.
     Dispatch the form submit event directly so this smoke exercises the same
     login.js controller + Supabase RPC without weakening employee form rules. */
  await page.evaluate(()=>document.querySelector('#employeeForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  try{
    await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:45000,waitUntil:'commit'});
  }catch(error){
    const status=(await page.locator('#status').textContent().catch(()=>''))?.trim()||'';
    const tone=await page.locator('#status').getAttribute('data-tone').catch(()=>null);
    const signed=await page.locator('#signedCard').getAttribute('data-show').catch(()=>null);
    throw new Error(`${name}: CI service-employee sign-in did not reach the app${status?` · ${tone||'status'}: ${status}`:''}${signed==='true'?' · signed card was visible before redirect':''}`);
  }
}

async function cdpScreenshot(page,clip=null){
  const session=await page.context().newCDPSession(page);
  try{
    const params={format:'png',fromSurface:true,captureBeyondViewport:false};
    if(clip)params.clip={...clip,scale:1};
    const result=await session.send('Page.captureScreenshot',params);
    return Buffer.from(result.data,'base64');
  }finally{
    await session.detach().catch(()=>{});
  }
}
async function captureCanvasFrame(page,name,phase){
  const canvas=page.locator('#environmentCanvas');
  const box=await canvas.boundingBox();
  if(!box||box.width<1||box.height<1)throw new Error(`${name}: Betta canvas has no capture bounds during ${phase}`);
  const viewport=page.viewportSize();
  const x=Math.max(0,box.x),y=Math.max(0,box.y);
  const width=Math.min(box.width,(viewport?.width||box.x+box.width)-x);
  const height=Math.min(box.height,(viewport?.height||box.y+box.height)-y);
  if(width<1||height<1)throw new Error(`${name}: Betta canvas is outside viewport during ${phase}`);
  return cdpScreenshot(page,{x,y,width,height});
}
async function assertCanvasMotion(page,name,phase,delayMs=1200){
  /* Playwright screenshot helpers can wait for stability/compositor state. That
     is unsuitable for a canvas that must never become visually stable. CDP's
     Page.captureScreenshot samples the fixed viewport rectangle immediately. */
  const before=await captureCanvasFrame(page,name,phase);
  await page.waitForTimeout(delayMs);
  const after=await captureCanvasFrame(page,name,phase);
  if(Buffer.compare(before,after)===0)throw new Error(`${name}: Betta canvas did not visibly change during ${phase}`);
  return true;
}

async function resourcePerformance(page){
  return page.evaluate(()=>{
    const resources=performance.getEntriesByType('resource').map(entry=>({
      name:entry.name,
      initiatorType:entry.initiatorType,
      duration:+entry.duration.toFixed(2),
      transferSize:Number(entry.transferSize)||0,
      encodedBodySize:Number(entry.encodedBodySize)||0,
      decodedBodySize:Number(entry.decodedBodySize)||0
    }));
    const navigation=performance.getEntriesByType('navigation')[0];
    const mark=performance.getEntriesByName('sindhorn-startup-enter-visible').at(-1);
    const sameOrigin=resources.filter(entry=>entry.name.startsWith(location.origin));
    const total=(key)=>sameOrigin.reduce((sum,entry)=>sum+(Number(entry[key])||0),0);
    const findPath=path=>sameOrigin.find(entry=>{try{return new URL(entry.name).pathname===path}catch{return false}})||null;
    return{
      startupEnterMs:mark?+mark.startTime.toFixed(2):null,
      domContentLoadedMs:navigation?+navigation.domContentLoadedEventEnd.toFixed(2):null,
      loadEventMs:navigation?+navigation.loadEventEnd.toFixed(2):null,
      sameOriginResourceCount:sameOrigin.length,
      sameOriginTransferBytes:total('transferSize'),
      sameOriginEncodedBytes:total('encodedBodySize'),
      sameOriginDecodedBytes:total('decodedBodySize'),
      bettaRuntime:findPath('/betta-runtime.js'),
      html2canvasLoaded:Boolean(findPath('/vendor/html2canvas.min.js')),
      threeModuleLoaded:Boolean(findPath('/vendor/three.module.js')),
      largestSameOrigin:[...sameOrigin].sort((a,b)=>b.decodedBodySize-a.decodedBodySize).slice(0,8)
    };
  });
}

async function exerciseLifecycleRecovery(page,name){
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await page.waitForFunction(()=>{
    const betta=window.SindhornEnvironment?.getState?.().betta;
    return betta?.lifecycle==='suspended'&&betta?.rendering===false&&betta?.satelliteStreaming===false;
  },null,{timeout:5000});
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(()=>{
    const betta=window.SindhornEnvironment?.getState?.().betta;
    return betta?.lifecycle==='active'&&betta?.rendering===true&&betta?.satelliteStreaming===true&&betta?.contextLost===false;
  },null,{timeout:10000});
  await assertCanvasMotion(page,name,'pagehide/pageshow resume');

  const contextTested=await page.evaluate(()=>{
    const canvas=document.querySelector('#environmentCanvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const ext=gl?.getExtension?.('WEBGL_lose_context');
    if(!ext)return false;
    window.__bettaLoseContextExtension=ext;
    ext.loseContext();
    return true;
  });
  if(contextTested){
    await page.waitForFunction(()=>window.SindhornEnvironment?.getState?.().betta?.contextLost===true,null,{timeout:5000});
    await page.evaluate(()=>window.__bettaLoseContextExtension?.restoreContext());
    await page.waitForFunction(()=>{
      const betta=window.SindhornEnvironment?.getState?.().betta;
      return betta?.contextLost===false&&betta?.lifecycle==='active'&&betta?.rendering===true&&betta?.satelliteStreaming===true;
    },null,{timeout:12000});
    await page.waitForTimeout(300);
    await assertCanvasMotion(page,name,'WebGL context restore');
  }
  return{pageLifecycleResume:true,webglContextRestoreTested:contextTested};
}

async function inspectLive(viewport,name){
  const context=await browser.newContext({viewport,screen:viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',err=>errors.push(`${name}: ${err.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await signIn(page,name);
  await page.waitForFunction(()=>document.body.classList.contains('environment-ready'),null,{timeout:30000});
  await page.waitForFunction(()=>window.SindhornEnvironment?.getState?.().renderer==='sindhorn-betta-satellite-v1',null,{timeout:30000});
  await page.waitForFunction(()=>window.SindhornEnvironment?.getState?.().betta?.satelliteStatus==='live',null,{timeout:60000});
  /* This is a Betta lifecycle/rendering smoke, not an external AirBKK SLA test.
     Live-data initialization is still recorded below, but a transient upstream
     air outage must not make current WebGL acceptance fail. Air service health
     has its own operational checks and Today already supports cached/unavailable
     delivery states by design. */
  await page.waitForFunction(()=>Boolean(window.SindhornLiveData?.getState?.()),null,{timeout:20000});
  await page.waitForTimeout(800);
  const performanceData=await resourcePerformance(page);
  console.log(`SINDHORN_PERFORMANCE ${name} ${JSON.stringify(performanceData)}`);
  if(performanceData.html2canvasLoaded)throw new Error(`${name}: html2canvas was loaded before Save Image interaction`);
  if(performanceData.threeModuleLoaded)throw new Error(`${name}: redundant Three module was loaded outside the tree-shaken Betta runtime`);
  await assertCanvasMotion(page,name,'normal foreground motion');
  const lifecycle=await exerciseLifecycleRecovery(page,name);
  const state=await page.evaluate(()=>{
    const env=window.SindhornEnvironment?.getState?.()||{};
    const live=window.SindhornLiveData?.getState?.()||{};
    const canvas=document.querySelector('#environmentCanvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const attrs=gl?.getContextAttributes?.()||{};
    return{
      width:innerWidth,height:innerHeight,
      canvasWidth:canvas?.width||0,canvasHeight:canvas?.height||0,
      dprX:canvas?.width?canvas.width/innerWidth:0,dprY:canvas?.height?canvas.height/innerHeight:0,
      antialias:attrs.antialias,preserveDrawingBuffer:attrs.preserveDrawingBuffer,
      renderer:env.renderer||null,quality:env.quality||null,inputMode:env.inputMode||null,
      baseline:env.betta?.baseline||null,baselineAuthority:env.betta?.baselineAuthority||null,
      dayCycle:env.betta?.dayCycle||null,availableBaselines:env.betta?.availableBaselines||[],
      satelliteStatus:env.betta?.satelliteStatus||null,satelliteSource:env.betta?.satelliteSource||null,
      satelliteObservedAt:env.betta?.observedAt||null,satelliteMetrics:env.betta?.metrics||null,
      lifecycle:env.betta?.lifecycle||null,lifecycleReason:env.betta?.lifecycleReason||null,
      contextLost:Boolean(env.betta?.contextLost),satelliteStreaming:Boolean(env.betta?.satelliteStreaming),rendering:Boolean(env.betta?.rendering),
      airDelivery:live.delivery||null,airStationId:String(live.air?.stationId||''),
      pm:Number(live.air?.pm),aqi:Number(live.air?.aqi)
    };
  });
  if(state.width!==viewport.width||state.height!==viewport.height)throw new Error(`${name}: viewport mismatch ${state.width}x${state.height}`);
  if(state.renderer!=='sindhorn-betta-satellite-v1')throw new Error(`${name}: renderer mismatch ${state.renderer}`);
  if(state.inputMode!=='satellite-only')throw new Error(`${name}: renderer is not satellite-only`);
  if(state.baselineAuthority!=='bangkok-day-cycle')throw new Error(`${name}: unexpected Betta baseline authority ${state.baselineAuthority}`);
  if(state.dayCycle?.timeZone!=='Asia/Bangkok'||state.dayCycle?.periods?.length!==8)throw new Error(`${name}: invalid Bangkok day-cycle state`);
  if(state.baseline!==state.dayCycle?.targetBaseline)throw new Error(`${name}: active baseline ${state.baseline} does not match period target ${state.dayCycle?.targetBaseline}`);
  const activePeriod=state.dayCycle?.periods?.find(period=>period.key===state.dayCycle?.targetPeriodKey);
  if(!activePeriod||activePeriod.baseline!==state.baseline)throw new Error(`${name}: active period/baseline mismatch`);
  const expectedTone=activePeriod.startHour>=6&&activePeriod.startHour<18?'bright':'dark';
  if(activePeriod.tone!==expectedTone)throw new Error(`${name}: invalid ${activePeriod.key} tone ${activePeriod.tone}`);
  if(state.availableBaselines.length!==8)throw new Error(`${name}: expected eight Betta baselines, got ${state.availableBaselines.length}`);
  if(state.satelliteStatus!=='live'||!String(state.satelliteSource).includes('Himawari-9'))throw new Error(`${name}: satellite feed not live`);
  if(!state.satelliteMetrics||!Number.isFinite(Number(state.satelliteMetrics.energy)))throw new Error(`${name}: satellite metrics missing`);
  if(state.lifecycle!=='active'||state.contextLost||!state.satelliteStreaming||!state.rendering)throw new Error(`${name}: Betta lifecycle did not recover: ${JSON.stringify({lifecycle:state.lifecycle,contextLost:state.contextLost,satelliteStreaming:state.satelliteStreaming,rendering:state.rendering})}`);
  if(Math.abs(state.dprX-2)>.05||Math.abs(state.dprY-2)>.05)throw new Error(`${name}: DPR not fixed at 2: ${state.dprX}x${state.dprY}`);
  if(state.antialias!==false)throw new Error(`${name}: WebGL antialias should be false`);
  if(state.preserveDrawingBuffer!==false)throw new Error(`${name}: live preserveDrawingBuffer should be false`);
  if(!['live','cached','unavailable','loading'].includes(String(state.airDelivery||'loading')))throw new Error(`${name}: unexpected air delivery state: ${state.airDelivery}`);
  if(state.airDelivery==='live'||state.airDelivery==='cached'){
    if(!['114','139','65'].includes(state.airStationId))throw new Error(`${name}: unexpected AirBKK station: ${state.airStationId}`);
    if(!Number.isFinite(state.pm)||state.pm<0||state.pm>500)throw new Error(`${name}: invalid PM2.5: ${state.pm}`);
    if(!Number.isFinite(state.aqi)||state.aqi<0||state.aqi>500)throw new Error(`${name}: invalid Thai AQI: ${state.aqi}`);
  }
  await fs.promises.writeFile(`phase82-artifacts/${name}.png`,await cdpScreenshot(page));
  const pacing=await sampleFrames(page,name);
  await context.close();
  return {...state,motionChanged:true,...lifecycle,...pacing,performance:performanceData};
}

let desktop=null,mobile=null,fatal=null;
try{
  desktop=await inspectLive({width:1440,height:1000},'app-desktop');
  mobile=await inspectLive({width:390,height:844},'app-mobile');
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}finally{
  await browser.close();
  const metrics={benchmark:'CPU-only SwANGLE diagnostic; physical GPU acceptance remains separate',renderer:'sindhorn-betta-satellite-v1',baselineAuthority:'Asia/Bangkok eight-period day cycle',realtimeVisualInput:'JMA Himawari-9 satellite only',desktop,mobile,errors};
  fs.writeFileSync('phase82-artifacts/metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
}
if(fatal)throw fatal;
if(errors.length)throw new Error(errors.join('\n'));
for(const [name,m] of Object.entries({desktop,mobile})){
  if(!m||m.frameSamples<1)throw new Error(`${name}: renderer produced no diagnostic frames`);
  if(!m.pageLifecycleResume)throw new Error(`${name}: page lifecycle resume was not exercised`);
}
