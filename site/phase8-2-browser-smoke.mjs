import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.PHASE82_BASE_URL;
if(!base)throw new Error('PHASE82_BASE_URL required');
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

async function sampleFrames(page,label,count=90,timeoutMs=20000){
  const result=await page.evaluate(({count,timeoutMs})=>new Promise(resolve=>{
    const values=[];let last=performance.now(),done=false;
    const finish=(timedOut=false)=>{if(done)return;done=true;resolve({values:values.slice(Math.min(8,values.length)),timedOut})};
    const timer=setTimeout(()=>finish(true),timeoutMs);
    function tick(now){
      if(done)return;
      values.push(values.length?now-last:16.7);last=now;
      if(values.length>=count){clearTimeout(timer);finish(false)}else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }),{count,timeoutMs});
  const samples=result.values;
  if(!samples.length)return{frameAverageMs:null,frameP95Ms:null,frameSamples:0,timedOut:result.timedOut};
  const sorted=[...samples].sort((a,b)=>a-b),avg=samples.reduce((a,b)=>a+b,0)/samples.length,p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  return{frameAverageMs:+avg.toFixed(2),frameP95Ms:+p95.toFixed(2),frameSamples:samples.length,timedOut:result.timedOut,label};
}

async function inspect(viewport,name){
  const page=await browser.newPage({viewportSize:viewport});
  page.on('pageerror',err=>errors.push(`${name}: ${err.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await page.goto(`${base}/cloud-tester.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#sky',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#readout')?.textContent?.includes('renderer   shared Phase 8.2'),null,{timeout:15000});
  await page.evaluate(()=>{
    const input=document.querySelector('#solarAltitude');
    input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#hidePanel')?.click();
  });
  await page.waitForTimeout(700);
  const state=await page.evaluate(()=>{
    const canvas=document.querySelector('#sky');
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    const attrs=gl?.getContextAttributes?.()||{};
    return {width:innerWidth,height:innerHeight,canvasWidth:canvas.width,canvasHeight:canvas.height,dprX:canvas.width/innerWidth,dprY:canvas.height/innerHeight,antialias:attrs.antialias,preserveDrawingBuffer:attrs.preserveDrawingBuffer,readout:document.querySelector('#readout')?.textContent||''};
  });
  if(Math.abs(state.dprX-2)>.05||Math.abs(state.dprY-2)>.05)throw new Error(`${name}: DPR not fixed at 2: ${state.dprX}x${state.dprY}`);
  if(state.antialias!==false)throw new Error(`${name}: WebGL antialias should be false`);
  if(state.preserveDrawingBuffer!==false)throw new Error(`${name}: live preserveDrawingBuffer should be false`);
  if(!state.readout.includes('disc visible'))throw new Error(`${name}: tester does not report visible sun disc`);
  await page.screenshot({path:`phase82-artifacts/${name}.png`,fullPage:true});
  const pacing=await sampleFrames(page,name);
  await page.close();
  return {...state,...pacing};
}

let desktop=null,mobile=null,appState=null,fatal=null;
try{
  desktop=await inspect({width:1440,height:1000},'cloud-tester-desktop-sun');
  mobile=await inspect({width:390,height:844},'cloud-tester-mobile-sun');
  const root=await browser.newPage({viewportSize:{width:390,height:844}});
  root.on('pageerror',err=>errors.push(`app: ${err.message}`));
  root.on('console',msg=>{if(msg.type()==='error')errors.push(`app console: ${msg.text()}`)});
  await root.goto(`${base}/?debug=1`,{waitUntil:'domcontentloaded',timeout:45000});
  await root.waitForFunction(()=>document.body.classList.contains('environment-ready'),null,{timeout:30000});
  await root.waitForTimeout(1000);
  appState=await root.evaluate(()=>({renderer:window.SindhornEnvironment?.getState?.()?.renderer||null,quality:window.SindhornEnvironment?.getState?.()?.quality||null,pack:document.body.dataset.appPack||null,canvas:[document.querySelector('#environmentCanvas')?.width||0,document.querySelector('#environmentCanvas')?.height||0]}));
  if(appState.renderer!=='bangkok-seasonal-clouds-v2')throw new Error(`app renderer mismatch: ${appState.renderer}`);
  if(appState.quality!==2)throw new Error(`app DPR mismatch: ${appState.quality}`);
  await root.screenshot({path:'phase82-artifacts/app-mobile.png',fullPage:true});
  appState={...appState,...await sampleFrames(root,'app-mobile',75,20000)};
  await root.close();
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}finally{
  await browser.close();
  const metrics={desktop,mobile,appState,errors};fs.writeFileSync('phase82-artifacts/metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
}
if(fatal)throw fatal;
if(errors.length)throw new Error(errors.join('\n'));
// SwANGLE/SwiftShader is a regression smoke, not a physical-device benchmark.
for(const [name,m] of Object.entries({desktop,mobile,appMobile:appState})){
  if(m.timedOut)throw new Error(`${name}: frame sampler timed out after ${m.frameSamples} usable samples`);
  if(m.frameSamples<30)throw new Error(`${name}: insufficient frame samples: ${m.frameSamples}`);
  if(m.frameAverageMs>55||m.frameP95Ms>100)throw new Error(`${name}: severe frame pacing regression avg=${m.frameAverageMs} p95=${m.frameP95Ms}`);
}
