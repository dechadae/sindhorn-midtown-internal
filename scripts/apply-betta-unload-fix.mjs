import { readFileSync, writeFileSync } from 'node:fs';

function replaceAny(text, variants, replacement, label, already) {
  for (const value of variants) {
    if (text.includes(value)) return text.replace(value, replacement);
  }
  if (already && text.includes(already)) return text;
  throw new Error(`Expected ${label} pattern not found`);
}

const bettaPath='site/betta-environment.js';
let betta=readFileSync(bettaPath,'utf8');

betta=replaceAny(
  betta,
  [
    "let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,backgroundMesh=null,backgroundMaterial=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false;",
    "let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,backgroundMesh=null,backgroundMaterial=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false,resizeObserver=null,weatherTimer=0,dayCycleTimer=0,watchdogTimer=0,hardDisposed=false;"
  ],
  "let initialized=false,stage=null,canvas=null,renderer=null,scene=null,camera=null,sharedGeometry=null,backgroundMesh=null,backgroundMaterial=null,raf=0,activeTime=0,previousNow=performance.now(),firstFrameRendered=false,resizeObserver=null,weatherTimer=0,dayCycleTimer=0,watchdogTimer=0,navigationPrepared=false;",
  'Betta lifecycle variables',
  'navigationPrepared=false'
);

const restore="function handleContextRestored(){webglContextLost=false;document.body.dataset.bettaContext='restored';renderer?.resetState?.();buildFins();resumeEnvironment('webglcontextrestored')}";
const hard=`${restore}\nfunction hardDisposeEnvironment(reason='beforeunload'){\n  if(hardDisposed)return;hardDisposed=true;pageVisible=false;setLifecycle('disposed',reason);stopRender();pauseSatellite();\n  if(weatherTimer){clearInterval(weatherTimer);weatherTimer=0}if(dayCycleTimer){clearInterval(dayCycleTimer);dayCycleTimer=0}if(watchdogTimer){clearInterval(watchdogTimer);watchdogTimer=0}\n  resizeObserver?.disconnect();resizeObserver=null;\n  if(tilt.listening){removeEventListener('deviceorientation',handleDeviceOrientation);tilt.listening=false}\n  canvas?.removeEventListener('webglcontextlost',handleContextLost,false);canvas?.removeEventListener('webglcontextrestored',handleContextRestored,false);\n  try{clearFins()}catch(_){}sharedGeometry?.dispose();sharedGeometry=null;\n  if(backgroundMesh){try{scene?.remove(backgroundMesh)}catch(_){}backgroundMesh.geometry?.dispose?.();backgroundMesh=null}backgroundMaterial?.dispose?.();backgroundMaterial=null;\n  try{renderer?.setAnimationLoop?.(null)}catch(_){}try{renderer?.dispose?.()}catch(_){}try{renderer?.forceContextLoss?.()}catch(_){}\n  renderer=null;scene=null;camera=null;document.body.dataset.bettaContext='disposed';\n}`;
const soft=`${restore}\nfunction prepareNavigationCleanup(reason='beforeunload'){\n  if(navigationPrepared)return;navigationPrepared=true;pageVisible=false;setLifecycle('suspended',reason);stopRender();pauseSatellite();\n  if(weatherTimer){clearInterval(weatherTimer);weatherTimer=0}if(dayCycleTimer){clearInterval(dayCycleTimer);dayCycleTimer=0}if(watchdogTimer){clearInterval(watchdogTimer);watchdogTimer=0}\n  resizeObserver?.disconnect();resizeObserver=null;\n  if(tilt.listening){removeEventListener('deviceorientation',handleDeviceOrientation);tilt.listening=false}\n}`;
betta=replaceAny(betta,[hard,restore],soft,'Betta navigation cleanup','function prepareNavigationCleanup');

betta=replaceAny(
  betta,
  [
    "new ResizeObserver(()=>resize()).observe(stage);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendEnvironment('visibilitychange');else resumeEnvironment('visibilitychange')});addEventListener('pagehide',()=>suspendEnvironment('pagehide'));addEventListener('pageshow',()=>resumeEnvironment('pageshow'));addEventListener('focus',()=>resumeEnvironment('focus'));document.addEventListener('freeze',()=>suspendEnvironment('freeze'));document.addEventListener('resume',()=>resumeEnvironment('resume'));canvas.addEventListener('webglcontextlost',handleContextLost,false);canvas.addEventListener('webglcontextrestored',handleContextRestored,false);document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:location-updated',()=>fetchWeather().catch(()=>{}));startSatellite();",
    "resizeObserver=new ResizeObserver(()=>resize());resizeObserver.observe(stage);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendEnvironment('visibilitychange');else resumeEnvironment('visibilitychange')});addEventListener('pagehide',()=>suspendEnvironment('pagehide'));addEventListener('pageshow',()=>resumeEnvironment('pageshow'));addEventListener('focus',()=>resumeEnvironment('focus'));addEventListener('beforeunload',()=>hardDisposeEnvironment('beforeunload'),{once:true});document.addEventListener('freeze',()=>suspendEnvironment('freeze'));document.addEventListener('resume',()=>resumeEnvironment('resume'));canvas.addEventListener('webglcontextlost',handleContextLost,false);canvas.addEventListener('webglcontextrestored',handleContextRestored,false);document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:location-updated',()=>fetchWeather().catch(()=>{}));startSatellite();"
  ],
  "resizeObserver=new ResizeObserver(()=>resize());resizeObserver.observe(stage);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendEnvironment('visibilitychange');else resumeEnvironment('visibilitychange')});addEventListener('pagehide',()=>suspendEnvironment('pagehide'));addEventListener('pageshow',()=>resumeEnvironment('pageshow'));addEventListener('focus',()=>resumeEnvironment('focus'));addEventListener('beforeunload',()=>prepareNavigationCleanup('beforeunload'),{once:true});document.addEventListener('freeze',()=>suspendEnvironment('freeze'));document.addEventListener('resume',()=>resumeEnvironment('resume'));canvas.addEventListener('webglcontextlost',handleContextLost,false);canvas.addEventListener('webglcontextrestored',handleContextRestored,false);document.addEventListener('sindhorn:route-mounted',renderWeather);document.addEventListener('sindhorn:location-updated',()=>fetchWeather().catch(()=>{}));startSatellite();",
  'Betta lifecycle listeners',
  "beforeunload',()=>prepareNavigationCleanup"
);

betta=replaceAny(
  betta,
  ["requestRender();fetchWeather().catch(()=>{});setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);setInterval(()=>{if(dayCycle.mode==='live'&&!document.hidden)syncDayCycle(performance.now())},DAY_CYCLE_CHECK_MS);setInterval(()=>{if(!document.hidden&&!webglContextLost&&!raf)resumeEnvironment('watchdog')},2000);"],
  "requestRender();fetchWeather().catch(()=>{});weatherTimer=setInterval(()=>fetchWeather().catch(()=>{}),10*60*1000);dayCycleTimer=setInterval(()=>{if(dayCycle.mode==='live'&&!document.hidden)syncDayCycle(performance.now())},DAY_CYCLE_CHECK_MS);watchdogTimer=setInterval(()=>{if(!document.hidden&&!webglContextLost&&!raf)resumeEnvironment('watchdog')},2000);",
  'Betta timers',
  'weatherTimer=setInterval'
);
writeFileSync(bettaPath,betta);

const swPath='site/sw.js';
let sw=readFileSync(swPath,'utf8');
sw=replaceAny(
  sw,
  [
    "const VERSION='sindhorn-midtown-internal-pwa-v45-warm-cache-r1';",
    "const VERSION='sindhorn-midtown-internal-pwa-v46-betta-unload-r1';\n// sindhorn-midtown-internal-pwa-v45-warm-cache-r1"
  ],
  "const VERSION='sindhorn-midtown-internal-pwa-v47-betta-soft-unload-r1';\n// sindhorn-midtown-internal-pwa-v46-betta-unload-r1\n// sindhorn-midtown-internal-pwa-v45-warm-cache-r1",
  'service worker warm-start version',
  'pwa-v47-betta-soft-unload-r1'
);
writeFileSync(swPath,sw);
console.log('Betta soft navigation cleanup source prepared.');
