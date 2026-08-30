import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('site/betta-fin-lab.html');
const js=read('site/betta-fin-lab.js');
const shader=read('site/betta-fin-shader.js');
const presets=read('site/betta-fin-presets.js');
const css=read('site/betta-fin-lab.css');
const satellite=read('site/betta-satellite.js');
const worker=read('site/_worker.js');
const routes=read('site/_routes.json');
const workflow=read('.github/workflows/betta-fin-lab-preview.yml');

for(const name of ['Cobalt Veil','Crimson Silk','Turquoise Drift','Midnight Plum']){
  if(!presets.includes(name))throw new Error(`missing preset ${name}`);
}
if(!js.includes("from './vendor/three.module.js'"))throw new Error('lab must reuse vendored Three.js');
if(js.includes('environment.js')||html.includes('environment.js'))throw new Error('lab must not import production environment');
if(/supabase/i.test(js+shader+presets+satellite+worker))throw new Error('lab must not access Supabase');
if(!js.includes('const DPR=2'))throw new Error('lab must preserve fixed DPR 2 hypothesis');
if(!js.includes("document.addEventListener('visibilitychange'"))throw new Error('visibility pause/resume missing');
if(!js.includes("inputMode:'satellite-only'"))throw new Error('runtime satellite-only declaration missing');
if(!satellite.includes("inputMode:'satellite-only'"))throw new Error('satellite analyzer must emit satellite-only state');
if(!satellite.includes("imageData('b13'")||!satellite.includes("imageData('b08'")||!satellite.includes("imageData('b03'"))throw new Error('required Himawari HA1 image channels missing');
if(!satellite.includes('motionMetrics')||!satellite.includes('fingerprint'))throw new Error('satellite motion/fingerprint analysis missing');
if(!satellite.includes('standardDeviation')||!satellite.includes('Degenerate Himawari Bangkok patch'))throw new Error('satellite non-degeneracy gate missing');
if(!worker.includes('www.data.jma.go.jp/mscweb/data/himawari'))throw new Error('JMA Himawari proxy origin missing');
if(!worker.includes("SECTOR='High-Resolution Asia 1'"))throw new Error('JMA HA1 sector declaration missing');
if(!worker.includes("new Set(['b03','b08','b13'])"))throw new Error('JMA satellite band allow-list missing');
if(!worker.includes('last-modified'))throw new Error('JMA rolling-slot freshness guard missing');
if(/himawari8-dl\.nict\.go\.jp/i.test(js+satellite+worker))throw new Error('retired NICT tile path must not remain');
if(/open-meteo|api\.met\.no|airbkk|tmd\.go\.th|deviceorientation|geolocation|getCurrentPosition/i.test(js+satellite+worker+html))throw new Error('non-satellite realtime input forbidden in betta lab');
if(/tilt/i.test(html+js))throw new Error('device tilt must not influence satellite-only lab');
if(!shader.includes('snoise'))throw new Error('multi-scale GPU noise missing');
if(!shader.includes('uSatelliteEnergy')||!shader.includes('uSatelliteMotion')||!shader.includes('uSatelliteColor'))throw new Error('satellite shader drivers missing');
if(!shader.includes('aRayJitter'))throw new Error('fin-ray irregularity missing');
if(/\.mp4|\.gif|\.webp|<video|videoTexture/i.test(html+js+shader+css+presets+satellite))throw new Error('prerendered/video media forbidden');
const parsedRoutes=JSON.parse(routes);
if(!parsedRoutes.include?.some(value=>value.includes('/api/betta-satellite')))throw new Error('satellite proxy route missing');
if(!workflow.includes('git diff --exit-code "$base" HEAD -- "$file"'))throw new Error('protected-system diff gate missing');
console.log(JSON.stringify({
  ok:true,
  presets:4,
  architecture:'hybrid indexed radial membrane + GPU deformation + Himawari-9 HA1 pixel analysis',
  realtimeInput:'satellite-only',
  satellite:'Himawari-9 via JMA High-Resolution Asia 1',
  bands:['B13 infrared','B08 water vapor','B03 visible'],
  dpr:2
},null,2));
