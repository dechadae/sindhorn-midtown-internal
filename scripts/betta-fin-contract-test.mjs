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
if(!satellite.includes("imageData('b13'")||!satellite.includes("imageData('b08'")||!satellite.includes("imageData('true'"))throw new Error('required Himawari image channels missing');
if(!satellite.includes('motionMetrics')||!satellite.includes('fingerprint'))throw new Error('satellite motion/fingerprint analysis missing');
if(!worker.includes('himawari8-dl.nict.go.jp'))throw new Error('Himawari proxy origin missing');
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
  architecture:'hybrid indexed radial membrane + GPU deformation + Himawari-9 pixel analysis',
  realtimeInput:'satellite-only',
  satellite:'Himawari-9 via NICT/JMA',
  dpr:2
},null,2));
