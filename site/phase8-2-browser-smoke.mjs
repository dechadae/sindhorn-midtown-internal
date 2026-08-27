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

async function sampleFrames(page,label,count=30,timeoutMs=15000){
  const result=await page.evaluate(({count,timeoutMs})=>new Promise(resolve=>{
    const values=[];let last=performance.now(),done=false;
    const finish=(timedOut=false)=>{if(done)return;done=true;const warmup=Math.min(5,Math.max(0,values.length-1));resolve({values:values.slice(warmup),timedOut})};
    const timer=setTimeout(()=>finish(true),timeoutMs);
    function tick(now){if(done)return;values.push(values.length?now-last:16.7);last=now;if(values.length>=count){clearTimeout(timer);finish(false)}else requestAnimationFrame(tick)}
    requestAnimationFrame(tick);
  }),{count,timeoutMs});
  const samples=result.values;
  if(!samples.length)return{frameAverageMs:null,frameP95Ms:null,frameSamples:0,timedOut:result.timedOut,label};
  const sorted=[...samples].sort((a,b)=>a-b),avg=samples.reduce((a,b)=>a+b,0)/samples.length,p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  return{frameAverageMs:+avg.toFixed(2),frameP95Ms:+p95.toFixed(2),frameSamples:samples.length,timedOut:result.timedOut,label};
}

async function inspect(viewport,name){
  const page=await browser.newPage({viewport,screen:viewport});
  page.on('pageerror',err=>errors.push(`${name}: ${err.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await page.goto(`${base}/cloud-tester.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#sky',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#readout')?.textContent?.includes('renderer   shared Phase 8.2'),null,{timeout:15000});
  await page.evaluate(()=>{const input=document.querySelector('#solarAltitude');input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#hidePanel')?.click()});
  await page.waitForTimeout(500);
  const state=await page.evaluate(()=>{const canvas=document.querySelector('#sky'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),attrs=gl?.getContextAttributes?.()||{};return{width:innerWidth,height:innerHeight,canvasWidth:canvas.width,canvasHeight:canvas.height,dprX:canvas.width/innerWidth,dprY:canvas.height/innerHeight,antialias:attrs.antialias,preserveDrawingBuffer:attrs.preserveDrawingBuffer,readout:document.querySelector('#readout')?.textContent||''}});
  if(state.width!==viewport.width||state.height!==viewport.height)throw new Error(`${name}: viewport mismatch ${state.width}x${state.height}`);
  if(Math.abs(state.dprX-2)>.05||Math.abs(state.dprY-2)>.05)throw new Error(`${name}: DPR not fixed at 2: ${state.dprX}x${state.dprY}`);
  if(state.antialias!==false)throw new Error(`${name}: WebGL antialias should be false`);
  if(state.preserveDrawingBuffer!==false)throw new Error(`${name}: live preserveDrawingBuffer should be false`);
  if(!state.readout.includes('disc visible'))throw new Error(`${name}: tester does not report visible sun disc`);
  await page.screenshot({path:`phase82-artifacts/${name}.png`,fullPage:true});
  const pacing=await sampleFrames(page,name);await page.close();return{...state,...pacing};
}

async function capturePreset(presetName,name,expect=[]){
  const viewport={width:390,height:844},page=await browser.newPage({viewport,screen:viewport});
  page.on('pageerror',err=>errors.push(`${name}: ${err.message}`));page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await page.goto(`${base}/cloud-tester.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#readout')?.textContent?.includes('renderer   shared Phase 8.2'),null,{timeout:15000});
  await page.evaluate(presetName=>{const preset=document.querySelector('#preset');preset.value=presetName;document.querySelector('#applyPreset')?.click();document.querySelector('#hidePanel')?.click()},presetName);
  await page.waitForTimeout(700);const readout=await page.locator('#readout').textContent();
  for(const token of expect)if(!readout?.includes(token))throw new Error(`${name}: preset failed (${token}): ${readout}`);
  await page.screenshot({path:`phase82-artifacts/${name}.png`,fullPage:true});await page.close();return{viewport:[390,844],readout};
}

let desktop=null,mobile=null,augPartly=null,denseMonsoon=null,appState=null,fatal=null;
try{
  desktop=await inspect({width:1440,height:1000},'cloud-tester-desktop-sun');
  mobile=await inspect({width:390,height:844},'cloud-tester-mobile-sun');
  augPartly=await capturePreset('augPartly','cloud-tester-mobile-aug-partly',['weather   partly-cloudy','mid       58%','low       28%']);
  denseMonsoon=await capturePreset('augStorm','cloud-tester-mobile-aug-storm',['weather   thunderstorm','low       100%']);
  const viewport={width:390,height:844},root=await browser.newPage({viewport,screen:viewport});
  root.on('pageerror',err=>errors.push(`app: ${err.message}`));root.on('console',msg=>{if(msg.type()==='error')errors.push(`app console: ${msg.text()}`)});
  await root.goto(`${base}/?debug=1`,{waitUntil:'domcontentloaded',timeout:45000});
  await root.waitForFunction(()=>document.body.classList.contains('environment-ready'),null,{timeout:30000});
  await root.waitForFunction(()=>{const state=window.SindhornLiveData?.getState?.();return state?.delivery==='live'&&Number.isFinite(Number(state?.air?.pm))&&Number.isFinite(Number(state?.air?.aqi))},null,{timeout:20000});
  await root.waitForTimeout(500);
  appState=await root.evaluate(()=>{const env=window.SindhornEnvironment?.getState?.()||{},live=window.SindhornLiveData?.getState?.()||{};return{renderer:env.renderer||null,quality:env.quality||null,pack:document.body.dataset.appPack||null,viewport:[innerWidth,innerHeight],canvas:[document.querySelector('#environmentCanvas')?.width||0,document.querySelector('#environmentCanvas')?.height||0],airDelivery:live.delivery||null,airStationId:String(live.air?.stationId||''),pm:Number(live.air?.pm),aqi:Number(live.air?.aqi)}});
  if(appState.renderer!=='bangkok-seasonal-clouds-v2')throw new Error(`app renderer mismatch: ${appState.renderer}`);if(appState.quality!==2)throw new Error(`app DPR mismatch: ${appState.quality}`);if(appState.viewport[0]!==390||appState.viewport[1]!==844)throw new Error(`app viewport mismatch: ${appState.viewport.join('x')}`);if(appState.airDelivery!=='live')throw new Error(`air delivery is not live: ${appState.airDelivery}`);if(!['114','139','65'].includes(appState.airStationId))throw new Error(`unexpected AirBKK station: ${appState.airStationId}`);if(!Number.isFinite(appState.pm)||appState.pm<0||appState.pm>500)throw new Error(`invalid PM2.5: ${appState.pm}`);if(!Number.isFinite(appState.aqi)||appState.aqi<0||appState.aqi>500)throw new Error(`invalid Thai AQI: ${appState.aqi}`);
  await root.screenshot({path:'phase82-artifacts/app-mobile.png',fullPage:true});appState={...appState,...await sampleFrames(root,'app-mobile',24,15000)};await root.close();
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}finally{await browser.close();const metrics={benchmark:'CPU-only SwANGLE diagnostic; physical GPU acceptance remains separate',desktop,mobile,augPartly,denseMonsoon,appState,errors};fs.writeFileSync('phase82-artifacts/metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2))}
if(fatal)throw fatal;if(errors.length)throw new Error(errors.join('\n'));
for(const [name,m] of Object.entries({desktop,mobile,appMobile:appState}))if(!m||m.frameSamples<1)throw new Error(`${name}: renderer produced no diagnostic frames`);
