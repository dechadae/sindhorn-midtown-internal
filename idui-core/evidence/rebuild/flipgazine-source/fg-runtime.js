/* fg-runtime.js — motion, glyph atmosphere and scroll, in one place.
   ---------------------------------------------------------------------------
   This was 39KB pasted byte-identical into four pages: home, moodboard,
   job-tracking and claude-code. 156KB of duplication, and four copies to keep
   in step -- which they had not been, and which is how a third glyph
   implementation nearly got written this week.
   Safe to load late and out of band: nothing outside this block references
   MotionStore, GlyphField, ScrollRuntime, clamp or lerp on any of the four
   pages. Verified before extracting, not assumed. It is entirely decorative
   and interaction-level, so arriving a frame after the page is invisible.
   The whole thing stays wrapped exactly as it was -- the top-level const
   declarations are inside the injected script's own scope, so they cannot
   collide with anything on the page.

   The block below opens mid-comment on purpose: the extract began at the
   LAYER 2 banner, and its opening delimiter was left behind in the pages. Reopened
   here rather than trimmed, so the banner reads as it always did.
   =========================================================================== */
/* ===========================================================================
   LAYER 2 · INTERACTION RUNTIME
   A coordinator of independent, individually-disableable runtimes — not a
   monolithic state object. Every runtime writes into MotionStore; WebGL and
   the CSS atmosphere read from it. If one runtime throws, the rest survive.
   =========================================================================== */

/* MotionStore, the pointer/touch/tilt/ripple runtimes and their helpers now
   live in fg-motion.js, loaded immediately before this file. Both atmosphere
   engines read the same object from there, so the shader and the glyph layer
   can no longer disagree about where the light is.
   Everything below still refers to MotionStore by name and needs no change:
   a top-level const in a classic script joins the global lexical scope, so a
   script injected afterwards sees it. */

/* --- Scroll runtime — normalized progress (native scroll, rAF-sampled) --- */
const ScrollRuntime=(()=>{
  /* Page controllers no longer publish a global clamp helper. Keep this
     runtime self-contained so initial and persistent mounts behave alike. */
  const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
  function sample(){
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    MotionStore.scroll.progress=limit(scrollY/max,0,1);
  }
  window.addEventListener("scroll",sample,{passive:true});
  window.addEventListener("resize",sample,{passive:true});
  sample();
  return {sample};
})();

/* --- header height token, kept in sync for the hero calc --- */
(function headerHeight(){
  const h=document.querySelector("header");
  const set=()=>document.documentElement.style.setProperty("--header-h",(h.offsetHeight||64)+"px");
  set(); window.addEventListener("resize",set,{passive:true});
})();

/* The Bangkok Sky theme engine lives in fg-theme.js now — the legacy palettes,
   the 900ms crossfade, the eight periods, both header switches and the
   fg:mode / fg:legacy preferences. It was here and inline on ci, pilot and
   admin: three copies, which is why the editorial switch broke twice.
   The master loop below calls FGTheme.step(); on pages without a runtime the
   module drives itself. */


/* ===========================================================================
   PERFORMANCE — rolling FPS → tier (spec §7). Tiers scale glyph budget,
   pixel ratio, and shader ripple work. Degrades; never crashes.
   =========================================================================== */

const Perf=(()=>{
  const mem=navigator.deviceMemory||4;
  const cores=navigator.hardwareConcurrency||4;
  const mobile=Math.min(innerWidth,innerHeight)<620;
  // initial guess
  let tier = (mem<=3||cores<=4||mobile) ? (mem<=2?"low":"mid") : "high";
  const budget={
    high:{glyphs:mobile?24:64, pr:2.0, ripples:true},
    mid :{glyphs:mobile?18:40, pr:1.5, ripples:true},
    low :{glyphs:mobile?12:20, pr:1.0, ripples:true}
  };
  let frames=0,acc=0,last=performance.now(),avg=60;
  const listeners=[];
  function onChange(fn){listeners.push(fn);}
  function tick(now){
    const dt=now-last; last=now;
    // A backgrounded tab pauses rAF; the first frame back has a huge dt that
    // would fake a ~0 FPS reading and wrongly demote the tier. Ignore stalls.
    if(dt>200){ frames=0; acc=0; return; }
    frames++; acc+=dt;
    if(acc>=1000){
      avg=frames*1000/acc; frames=0; acc=0;
      const prev=tier;
      if(avg<32 && tier!=="low") tier=tier==="high"?"mid":"low";
      else if(avg<48 && tier==="high") tier="mid";
      if(tier!==prev) listeners.forEach(fn=>{try{fn(budget[tier],tier);}catch(_){}});
    }
  }
  return {get b(){return budget[tier];}, get tier(){return tier;}, tick, onChange};
})();

/* ===========================================================================
   LAYER 3a · DOM GLYPH ATMOSPHERE (spec §5.1)
   Typography as material: 3 Z-depth layers, opacity hierarchy, slow drift,
   camera parallax, hover pulse to neon teal. Pure DOM so it survives a WebGL
   failure and keeps the letters crisp and accessible.
   =========================================================================== */

/* GlyphField lives in fg-glyph.js now — one implementation for all seven
   pages, instead of this one and a simpler inline copy on ci, pilot and admin.
   The master loop below still calls GlyphField.update() and still wraps it in
   try/catch, so the module arriving a frame late costs nothing. */

/* WebGL lives in /fg-atmos.js. It owns its canvas and animation loop on
   every interface page; this runtime retains scroll, performance and catalog. */

/* ===========================================================================
   MASTER LOOP — smooth the store, then render both atmosphere layers.
   =========================================================================== */

/* fg-glyph.js owns glyph construction, animation and resize on every page. */

function loop(now){
  Perf.tick(now);
  try{ FGTheme.step(now); }catch(e){}
  /* Damping moved to fg-motion.js, which owns the store and runs it whether or
     not this file is loaded. Doing it in both places would apply the lerp twice
     per frame and halve the smoothing time. */

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* Catalog is page-owned by /fg-page-home.js so it remounts with the Home payload. */
