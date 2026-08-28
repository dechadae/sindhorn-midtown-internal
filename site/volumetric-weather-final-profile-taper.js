const tunedUrl=new URL('./volumetric-weather-final-tuned.js',import.meta.url);
const baseUrl=new URL('./volumetric-weather-final.js',import.meta.url).href;
const seasonalUrl=new URL('./seasonal-sky.js',import.meta.url).href;
let source=await fetch(tunedUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`tuned renderer ${r.status}`);return r.text()});
source=source
  .replace("new URL('./volumetric-weather-final.js',import.meta.url)",`new URL('${baseUrl}')`)
  .replace("new URL('./seasonal-sky.js',import.meta.url).href",`'${seasonalUrl}'`)
  .replace('profile=[.18,.43,.36,.68,.53,.82,.48,.64,.34,.20]','profile=[.03,.30,.36,.68,.53,.82,.48,.58,.28,.03]');
if(!source.includes('profile=[.03,.30,.36,.68,.53,.82,.48,.58,.28,.03]'))throw new Error('cloud bank taper contract missing');
const blob=new Blob([source],{type:'text/javascript'}),blobUrl=URL.createObjectURL(blob);
try{await import(blobUrl)}finally{setTimeout(()=>URL.revokeObjectURL(blobUrl),10000)}
