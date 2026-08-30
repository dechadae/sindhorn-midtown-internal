import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const base=process.env.BETTA_BASE_URL;
if(!base)throw new Error('BETTA_BASE_URL required');
const dir=process.env.BETTA_SCREENSHOT_DIR||'betta-fin-artifacts';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  args:[
    '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows'
  ]
});
const errors=[];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function inspect(viewport,name,preset){
  const context=await browser.newContext({viewport,screen:viewport,deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await page.goto(`${base}/betta-fin-lab.html?motion-smoke=2`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.SindhornBettaLab?.getDiagnostics?.().triangles>0,null,{timeout:20000});
  await page.evaluate(key=>window.SindhornBettaLab.setPreset(key),preset);
  await page.waitForTimeout(900);
  const before=await page.evaluate(()=>window.SindhornBettaLab.getDiagnostics());
  const canvas=page.locator('#bettaCanvas');
  const motionA=await canvas.screenshot();
  await page.waitForTimeout(1800);
  const motionB=await canvas.screenshot();
  const motionHashA=hash(motionA),motionHashB=hash(motionB);
  if(motionHashA===motionHashB)throw new Error(`${name}: WebGL canvas did not visibly change across motion probe`);
  const frames=await page.evaluate(()=>new Promise(resolve=>{
    const times=[];let last=performance.now();
    function tick(now){
      times.push(now-last);last=now;
      if(times.length>=45)resolve(times.slice(5));
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
  const sorted=[...frames].sort((a,b)=>a-b);
  const avg=frames.reduce((a,b)=>a+b,0)/frames.length;
  const p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
  await context.close();
  if(Math.abs(before.dpr-2)>.01)throw new Error(`${name}: expected DPR 2`);
  if(before.antialias!==false)throw new Error(`${name}: antialias must remain false`);
  if(before.preserveDrawingBuffer!==false)throw new Error(`${name}: preserveDrawingBuffer must remain false`);
  if(before.drawCalls<1||before.drawCalls>3)throw new Error(`${name}: draw calls outside 1-3: ${before.drawCalls}`);
  if(before.triangles<4000||before.triangles>25000)throw new Error(`${name}: triangle count unexpected: ${before.triangles}`);
  if(before.textures!==0)throw new Error(`${name}: procedural lab should use zero textures, got ${before.textures}`);
  return{...before,motionProbe:{intervalMs:1800,changed:true,hashA:motionHashA.slice(0,12),hashB:motionHashB.slice(0,12)},frameAverageMs:+avg.toFixed(2),frameP95Ms:+p95.toFixed(2),frameSamples:frames.length};
}
let mobile,desktop,fatal;
try{
  mobile=await inspect({width:390,height:844},'mobile-cobalt','cobaltVeil');
  desktop=await inspect({width:1440,height:1000},'desktop-crimson','crimsonSilk');
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}
await browser.close();
const report={benchmark:'CPU-only SwANGLE diagnostic; physical Android GPU remains the visual/performance acceptance target',mobile,desktop,errors};
fs.writeFileSync(`${dir}/metrics.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(fatal)throw fatal;
if(errors.length)throw new Error(errors.join('\n'));
