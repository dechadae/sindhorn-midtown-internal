/* A generated Betta for one period, the way the macOS Betta Metal Lab makes
   one (BettaRandomStyleStore.swift): a 64-bit seed drives SplitMix64, two
   donor fish are drawn from the eight references - an archetype for the base
   colors and form, an accent for the highlight and edge - the palette is the
   archetype's nudged toward the accent's, the background is derived from the
   palette (adjacent colors, scaled to 4-10% brightness over a near-black
   neutral), and the tail is the archetype's tuning jittered within bounds.
   The camera and composition are never touched: they are copied from the
   period's own preset. Same seed, same fish - the seed is what gets saved.

   Web-specific: rayCount stays the period's own (the fin geometry is built
   once at the maximum ray count and never rebuilt), and the lab's seven
   detail sliders that have no uniform in the web shader are left out. */
import {BETTA_PRESETS} from './betta-fin-presets.js';

export const CAMERA_KEYS=Object.freeze(['offsetX','offsetY','cameraDepth','scale','rotationX','rotationY','rotation','tiltStrength']);
const REFERENCE_KEYS=Object.freeze(Object.keys(BETTA_PRESETS));

/* SplitMix64 on BigInt, bit-exact with the lab so a seed typed across from
   the Mac app draws the same fish. */
const MASK=(1n<<64n)-1n;
export function splitmix64(seed){
  let state=BigInt.asUintN(64,BigInt(seed));
  const next=()=>{state=(state+0x9E3779B97F4A7C15n)&MASK;let z=state;z=((z^(z>>30n))*0xBF58476D1CE4E5B9n)&MASK;z=((z^(z>>27n))*0x94D049BB133111EBn)&MASK;return z^(z>>31n)};
  const unit=()=>Number(next()>>11n)/9007199254740992;
  const range=(lower,upper)=>lower+(upper-lower)*unit();
  return{next,unit,range,signed:m=>range(-m,m),index:count=>count>0?Number(next()%BigInt(count)):0,chance:p=>unit()<p};
}

/* A web-made seed is 24 bits so its six hex digits are the whole seed and
   typing them back draws the same fish; a longer seed typed across from the
   lab is honored in full, and shortSeed shows a lab seed the way the lab
   does (its last six digits). */
export function randomSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return BigInt(a[0]&0xFFFFFF)}
export const seedLabel=seed=>BigInt.asUintN(64,BigInt(seed)).toString(16).toUpperCase().padStart(6,'0');
export const shortSeed=seed=>seedLabel(seed).slice(-6);
export function parseSeed(text){const t=String(text||'').trim().replace(/^#/,'');if(!/^[0-9a-f]{1,16}$/i.test(t))return null;return BigInt.asUintN(64,BigInt('0x'+t))}

const clamp01=v=>Math.min(1,Math.max(0,v));
export function hexToRgb(hex){const h=String(hex).replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
export function rgbToHex(rgb){return'#'+rgb.map(v=>Math.round(clamp01(v)*255).toString(16).padStart(2,'0')).join('')}
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*clamp01(t));
const scale=(a,k)=>a.map(v=>v*k);
const add=(a,b)=>a.map((v,i)=>v+b[i]);

function makePalette(base,accent,rng){
  const subtleMix=rng.range(.04,.22),useAccentHighlight=rng.chance(.62),useAccentEdge=rng.chance(.72);
  return[
    mix(base[0],accent[0],subtleMix*.35),
    mix(base[1],accent[1],subtleMix),
    useAccentHighlight?mix(base[2],accent[2],rng.range(.52,.88)):base[2],
    useAccentEdge?mix(base[3],accent[3],rng.range(.48,.86)):base[3]
  ].map(c=>c.map(clamp01));
}
function makeMatchingBackground(palette,rng){
  const neutral=[.0012,.0016,.0024];
  const first=add(scale(mix(palette[0],palette[1],rng.range(.28,.48)),rng.range(.045,.085)),neutral);
  const middle=add(scale(mix(palette[1],palette[2],rng.range(.18,.40)),rng.range(.055,.105)),scale(neutral,1.25));
  const last=add(scale(mix(palette[2],palette[3],rng.range(.28,.58)),rng.range(.040,.085)),neutral);
  return[first,middle,last].map(c=>c.map(v=>Math.min(.16,Math.max(.0005,v))));
}
function randomizedLayer(canonical,isBack,rng){
  const layer={...canonical,offset:[...(canonical.offset||[0,0,0])]};
  layer.scale=(layer.scale||1)*(isBack?rng.range(.88,1.08):rng.range(.96,1.05));
  layer.rotation=(layer.rotation||0)+rng.signed(isBack?.16:.055);
  layer.offset[0]+=rng.signed(isBack?.08:.035);layer.offset[1]+=rng.signed(isBack?.08:.035);layer.offset[2]+=rng.signed(isBack?.06:.025);
  layer.alpha=clamp01((layer.alpha??1)*(isBack?rng.range(.78,1.18):rng.range(.94,1.04)));
  layer.phase=(layer.phase||0)+rng.signed(isBack?12:7);
  return layer;
}

/* The style for one period from one seed. `baseline` is the period's own
   preset key; its camera, ray count and morph mode are kept. */
export function generateBettaStyle(baseline,seed){
  const own=BETTA_PRESETS[baseline];if(!own)return null;
  const rng=splitmix64(seed);
  const archetype=BETTA_PRESETS[REFERENCE_KEYS[rng.index(REFERENCE_KEYS.length)]];
  const accent=BETTA_PRESETS[REFERENCE_KEYS[rng.index(REFERENCE_KEYS.length)]];
  const t={...archetype.params};
  t.spread*=rng.range(.90,1.12);
  rng.index(8); // the lab draws a ray count here; the web keeps the period's own, so the draw is consumed to stay seed-compatible
  t.foldDensity*=rng.range(.86,1.18);t.curl+=rng.signed(.24);t.twist+=rng.signed(.24);t.edgeFlutter*=rng.range(.78,1.42);t.depth*=rng.range(.88,1.18);
  t.currentStrength*=rng.range(.82,1.24);t.motionSpeed*=rng.range(.88,1.16);t.turbulence*=rng.range(.80,1.30);t.motionAmplitude*=rng.range(.88,1.18);
  t.opacity*=rng.range(.90,1.08);t.transmission*=rng.range(.90,1.10);t.rimStrength*=rng.range(.90,1.14);t.foldHighlight*=rng.range(.90,1.14);t.iridescence*=rng.range(.78,1.30);t.bloom*=rng.range(.88,1.16);
  t.saturation*=rng.range(.92,1.10);t.brightness*=rng.range(.94,1.08);t.gradientPosition+=rng.signed(.08);
  for(let i=0;i<7;i++)rng.unit(); // the lab's seven detail sliders, consumed for seed parity
  t.opacity=clamp01(t.opacity);t.transmission=clamp01(t.transmission);
  const params={};for(const key of Object.keys(own.params))params[key]=CAMERA_KEYS.includes(key)||key==='rayCount'?own.params[key]:(t[key]??own.params[key]);
  const layers=[randomizedLayer(own.layers[0]||{},false,rng),randomizedLayer(own.layers[1]||own.layers[0]||{},true,rng)];
  const palette=makePalette(archetype.palette.map(hexToRgb),accent.palette.map(hexToRgb),rng);
  const gradient=makeMatchingBackground(palette,rng);
  return{seed:BigInt.asUintN(64,BigInt(seed)).toString(),palette:palette.map(rgbToHex),backgroundGradient:gradient.map(rgbToHex),background:rgbToHex(gradient[0]),params,layers,morphMode:own.morphMode||0};
}

/* The period's own preset expressed as a style, for the original/legacy row. */
export function originalBettaStyle(baseline){
  const own=BETTA_PRESETS[baseline];if(!own)return null;
  const g=Array.isArray(own.backgroundGradient)&&own.backgroundGradient.length>=3?own.backgroundGradient:[own.background,own.background,own.background];
  return{seed:'0',palette:[...own.palette],backgroundGradient:[...g],background:own.background,params:{...own.params},layers:own.layers.map(l=>({...l,offset:[...(l.offset||[0,0,0])]})),morphMode:own.morphMode||0};
}
