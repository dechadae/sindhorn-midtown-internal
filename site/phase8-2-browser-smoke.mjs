import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.PHASE82_BASE_URL;
if(!base)throw new Error('PHASE82_BASE_URL required');
// Every authenticated route redirects to /login.html when there is no session,
// so the renderer cannot be reached at all without signing in first. These come
// from the CI_SMOKE_* Actions secrets and belong to a dedicated non-admin
// service employee (role "employee", account_type "service"), never a real person.
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

// Signs in through the real PIN form rather than injecting a session, so the
// authenticated boot path itself stays covered by this gate.
async function signIn(page){
  await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.fill('#employeeNumber',smokeEmployeeNumber);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,smokePin[i]);
  await page.click('#pinLoginButton');
  await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:20000});
}

// Verifies the deployed production/preview candidate directly at "/", using
// live astronomy/weather/AirBKK state rather than a forced sun angle. There is
// no standalone atmosphere tester page anymore (removed 2026-08-28): all
// release verification runs against the live route only.
async function inspectLive(viewport,name){
  const page=await browser.newPage({viewport,screen:viewport});
  page.on('pageerror',err=>errors.push(`${name}: ${err.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await signIn(page);
  // Stay on the page the sign-in redirect already landed on rather than
  // navigating again: a second full navigation right after login intermittently
  // bounces back to /login, seemingly a session-hydration race on reload.
  await page.waitForFunction(()=>document.body.classList.contains('environment-ready'),null,{timeout:30000});
  await page.waitForFunction(()=>{
    const state=window.SindhornLiveData?.getState?.();
    return state?.delivery==='live'&&Number.isFinite(Number(state?.air?.pm))&&Number.isFinite(Number(state?.air?.aqi));
  },null,{timeout:20000});
  await page.waitForTimeout(500);
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
      renderer:env.renderer||null,quality:env.quality||null,
      airDelivery:live.delivery||null,airStationId:String(live.air?.stationId||''),
      pm:Number(live.air?.pm),aqi:Number(live.air?.aqi)
    };
  });
  if(state.width!==viewport.width||state.height!==viewport.height)throw new Error(`${name}: viewport mismatch ${state.width}x${state.height}`);
  if(state.renderer!=='bangkok-seasonal-clouds-v2')throw new Error(`${name}: renderer mismatch ${state.renderer}`);
  if(Math.abs(state.dprX-2)>.05||Math.abs(state.dprY-2)>.05)throw new Error(`${name}: DPR not fixed at 2: ${state.dprX}x${state.dprY}`);
  if(state.antialias!==false)throw new Error(`${name}: WebGL antialias should be false`);
  if(state.preserveDrawingBuffer!==false)throw new Error(`${name}: live preserveDrawingBuffer should be false`);
  if(state.airDelivery!=='live')throw new Error(`${name}: air delivery is not live: ${state.airDelivery}`);
  if(!['114','139','65'].includes(state.airStationId))throw new Error(`${name}: unexpected AirBKK station: ${state.airStationId}`);
  if(!Number.isFinite(state.pm)||state.pm<0||state.pm>500)throw new Error(`${name}: invalid PM2.5: ${state.pm}`);
  if(!Number.isFinite(state.aqi)||state.aqi<0||state.aqi>500)throw new Error(`${name}: invalid Thai AQI: ${state.aqi}`);
  await page.screenshot({path:`phase82-artifacts/${name}.png`,fullPage:true});
  const pacing=await sampleFrames(page,name);
  await page.close();
  return {...state,...pacing};
}

let desktop=null,mobile=null,fatal=null;
try{
  desktop=await inspectLive({width:1440,height:1000},'app-desktop');
  mobile=await inspectLive({width:390,height:844},'app-mobile');
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}finally{
  await browser.close();
  const metrics={benchmark:'CPU-only SwANGLE diagnostic; physical GPU acceptance remains separate',desktop,mobile,errors};
  fs.writeFileSync('phase82-artifacts/metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
}
if(fatal)throw fatal;
if(errors.length)throw new Error(errors.join('\n'));
// CPU-only SwANGLE timing is evidence only. Release correctness requires each
// viewport to produce at least one rAF sample in addition to the successful
// WebGL context, DPR, shared-renderer and live-data checks above.
for(const [name,m] of Object.entries({desktop,mobile})){
  if(!m||m.frameSamples<1)throw new Error(`${name}: renderer produced no diagnostic frames`);
}
