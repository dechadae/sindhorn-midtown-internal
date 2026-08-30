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
function parseUtc(value){
  const text=String(value||'').trim().replace(' ','T');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text)?text:`${text}Z`);
}
function ageMinutes(value){return (Date.now()-parseUtc(value).getTime())/60000}
function finite01(value,name){
  if(!Number.isFinite(value)||value<0||value>1)throw new Error(`${name} outside 0..1: ${value}`);
}
async function inspect(viewport,name,preset){
  const context=await browser.newContext({viewport,screen:viewport,deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`${name} console: ${msg.text()}`)});
  await page.goto(`${base}/betta-fin-lab.html?satellite-jma-smoke=1`,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.SindhornBettaLab?.getDiagnostics?.().triangles>0,null,{timeout:20000});
  await page.waitForFunction(()=>window.SindhornBettaLab?.getSatelliteState?.().status==='live',null,{timeout:60000});
  await page.evaluate(key=>window.SindhornBettaLab.setPreset(key),preset);
  await page.waitForTimeout(1000);
  const before=await page.evaluate(()=>window.SindhornBettaLab.getDiagnostics());
  const satellite=await page.evaluate(()=>window.SindhornBettaLab.getSatelliteState());
  if(before.inputMode!=='satellite-only'||satellite.inputMode!=='satellite-only')throw new Error(`${name}: satellite-only runtime contract missing`);
  if(satellite.satellite!=='Himawari-9')throw new Error(`${name}: unexpected satellite ${satellite.satellite}`);
  if(satellite.provider!=='JMA')throw new Error(`${name}: unexpected provider ${satellite.provider}`);
  if(satellite.sector!=='High-Resolution Asia 1')throw new Error(`${name}: unexpected sector ${satellite.sector}`);
  const age=ageMinutes(satellite.observedAt);
  if(!Number.isFinite(age)||age< -5||age>120)throw new Error(`${name}: Himawari observation is not fresh enough (${age.toFixed(1)} min)`);
  const sourceAge=ageMinutes(satellite.sourceLastModified);
  if(!Number.isFinite(sourceAge)||sourceAge< -10||sourceAge>120)throw new Error(`${name}: JMA source file is not freshly modified (${sourceAge.toFixed(1)} min)`);
  for(const [key,value] of Object.entries({
    cloud:satellite.metrics.cloudAmount,
    cold:satellite.metrics.coldCloud,
    texture:satellite.metrics.cloudTexture,
    vapor:satellite.metrics.waterVapor,
    confidence:satellite.metrics.motionConfidence,
    visible:satellite.metrics.visibleConfidence,
    energy:satellite.metrics.energy
  }))finite01(value,`${name} satellite ${key}`);
  if(!Number.isFinite(satellite.metrics.irVariation)||satellite.metrics.irVariation<.006)throw new Error(`${name}: IR Bangkok patch degenerate (${satellite.metrics.irVariation})`);
  if(!Number.isFinite(satellite.metrics.vaporVariation)||satellite.metrics.vaporVariation<.004)throw new Error(`${name}: water-vapor Bangkok patch degenerate (${satellite.metrics.vaporVariation})`);
  if(!/^[0-9a-f]{8}$/i.test(satellite.metrics.fingerprint))throw new Error(`${name}: satellite fingerprint invalid`);
  if(!(satellite.bangkok?.imageWidth>100&&satellite.bangkok?.imageHeight>100))throw new Error(`${name}: JMA source image dimensions invalid`);
  const canvas=page.locator('#bettaCanvas');
  const motionA=await canvas.screenshot();
  await page.waitForTimeout(1200);
  const motionB=await canvas.screenshot();
  const motionHashA=hash(motionA),motionHashB=hash(motionB);
  if(motionHashA===motionHashB)throw new Error(`${name}: WebGL canvas did not visibly change across satellite motion probe`);
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
  if(before.textures!==0)throw new Error(`${name}: procedural lab should use zero WebGL textures, got ${before.textures}`);
  return{
    ...before,
    satellite:{
      observedAt:satellite.observedAt,
      sourceLastModified:satellite.sourceLastModified,
      observationAgeMinutes:+age.toFixed(1),
      sourceAgeMinutes:+sourceAge.toFixed(1),
      sector:satellite.sector,
      bangkok:satellite.bangkok,
      metrics:satellite.metrics
    },
    motionProbe:{intervalMs:1200,changed:true,hashA:motionHashA.slice(0,12),hashB:motionHashB.slice(0,12)},
    frameAverageMs:+avg.toFixed(2),frameP95Ms:+p95.toFixed(2),frameSamples:frames.length
  };
}
let mobile,desktop,fatal;
try{
  mobile=await inspect({width:390,height:844},'mobile-cobalt','cobaltVeil');
  desktop=await inspect({width:1440,height:1000},'desktop-crimson','crimsonSilk');
}catch(error){fatal=error;errors.push(`fatal: ${error.message}`)}
await browser.close();
const report={
  benchmark:'CPU-only SwANGLE diagnostic; physical Android GPU remains the visual/performance acceptance target',
  realtimeInput:'JMA Himawari-9 High-Resolution Asia 1 satellite imagery only',
  mobile,desktop,errors
};
fs.writeFileSync(`${dir}/metrics.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(fatal)throw fatal;
if(errors.length)throw new Error(errors.join('\n'));
