import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('site/betta-fin-lab.html');
const js=read('site/betta-fin-lab.js');
const shader=read('site/betta-fin-shader.js');
const presets=read('site/betta-fin-presets.js');
const css=read('site/betta-fin-lab.css');
const workflow=read('.github/workflows/betta-fin-lab-preview.yml');

for(const name of ['Cobalt Veil','Crimson Silk','Turquoise Drift','Midnight Plum']){
  if(!presets.includes(name))throw new Error(`missing preset ${name}`);
}
if(!js.includes("from './vendor/three.module.js'"))throw new Error('lab must reuse vendored Three.js');
if(js.includes('environment.js')||html.includes('environment.js'))throw new Error('lab must not import production environment');
if(/supabase/i.test(js+shader+presets))throw new Error('lab must not access Supabase');
if(!js.includes('const DPR=2'))throw new Error('lab must preserve fixed DPR 2 hypothesis');
if(!js.includes("document.addEventListener('visibilitychange'"))throw new Error('visibility pause/resume missing');
if(!js.includes('crypto.getRandomValues'))throw new Error('living stochastic current missing');
if(!shader.includes('snoise'))throw new Error('multi-scale GPU noise missing');
if(!shader.includes('aRayJitter'))throw new Error('fin-ray irregularity missing');
if(/\.mp4|\.gif|\.webp|<video|videoTexture/i.test(html+js+shader+css+presets))throw new Error('prerendered/video media forbidden');
if(!workflow.includes('git diff --exit-code "$base" HEAD -- "$file"'))throw new Error('protected-system diff gate missing');
console.log(JSON.stringify({ok:true,presets:4,architecture:'hybrid indexed radial membrane + GPU deformation + custom GLSL',dpr:2},null,2));
