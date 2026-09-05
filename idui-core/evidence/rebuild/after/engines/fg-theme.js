/* fg-theme.js — the Bangkok Sky theme engine, one implementation.
   ---------------------------------------------------------------------------
   There were three: this one from fg-runtime.js, and simpler inline copies on
   ci/pilot and on admin. The cost was visible: the editorial switch broke in
   two different ways and had to be fixed twice.

   Owns the whole unit -- THEME_A/THEME_B legacy palettes, mixArr, the 900ms
   crossfade in applyThemeMix, the eight periods, both header switches
   (#themeSwitch legacy light/dark, #edSwitch editorial on/off) and the
   fg:mode / fg:legacy preferences. The first attempt at this cut the block in
   half and left the palettes behind in fg-runtime, so the module threw on its
   first line and no theme loaded at all.

   Depends on fg-motion.js for MotionStore.theme and Haptics. Load motion first.
   Exposes FGTheme.step(now); fg-runtime drives it where there is a master loop,
   and it self-drives where there is not. */
(function(){
  function _clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function _lerp(a,b,t){ return a+(b-a)*t; }
  var clamp=_clamp, lerp=_lerp;
  var MotionStore = window.FGMotion || {theme:{mix:1,target:1},reduced:false};
  var Haptics = window.FGHaptics || {theme:function(){}};

/* ===========================================================================
   THEME · 900ms interpolated environment crossfade (spec §4.2)
   Not an instantaneous variable swap: bg / surface / text / muted / glyph
   opacity all animate through an eased mix, and WebGL reads the same mix.
   =========================================================================== */

const THEME_A={ // light
  bg:[250,248,243], surface:[236,232,225], text:[26,26,26], muted:[110,110,110],
  accent:[0,121,107], glyph:1.0
};
const THEME_B={ // dark
  bg:[13,17,16], surface:[21,25,24], text:[244,241,235], muted:[133,136,135],
  accent:[0,240,209], glyph:0.85
};
const rgb=a=>`rgb(${a[0]|0},${a[1]|0},${a[2]|0})`;
const mixArr=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];

let themeBgNorm=[THEME_B.bg[0]/255,THEME_B.bg[1]/255,THEME_B.bg[2]/255];
let themeGlow=0.7;
let themeBg2Norm=new Float32Array([0.05,0.07,0.06]);
let ambientNorm=new Float32Array([0.0,0.941,0.819]);
let accentNorm=new Float32Array([0.0,0.941,0.819]);

/* Single writer for every theme token. Legacy mixing and the editorial engine
   both funnel through here, so the two paths cannot diverge. */
function applyTokens(bg,surface,text,muted,accent,amb,glyph,bg2){
  const rs=document.documentElement.style;
  const b2=bg2||bg;
  rs.setProperty("--bg",rgb(bg));
  rs.setProperty("--bg2",rgb(b2));
  rs.setProperty("--bg-grad",`linear-gradient(165deg, ${rgb(bg)} 0%, ${rgb(b2)} 100%)`);
  rs.setProperty("--bg-rgb",`${bg[0]|0},${bg[1]|0},${bg[2]|0}`);
  rs.setProperty("--surface",rgb(surface));
  rs.setProperty("--text",rgb(text));
  rs.setProperty("--text-rgb",`${text[0]|0},${text[1]|0},${text[2]|0}`);
  rs.setProperty("--muted",rgb(muted));
  rs.setProperty("--line",`rgba(${text[0]|0},${text[1]|0},${text[2]|0},0.09)`);
  rs.setProperty("--glass",`rgba(${surface[0]|0},${surface[1]|0},${surface[2]|0},0.55)`);
  rs.setProperty("--glass-brd",`rgba(${text[0]|0},${text[1]|0},${text[2]|0},0.14)`);
  rs.setProperty("--accent",rgb(accent));
  rs.setProperty("--accent-rgb",`${accent[0]|0},${accent[1]|0},${accent[2]|0}`);
  rs.setProperty("--ambient",rgb(amb));
  rs.setProperty("--ambient-rgb",`${amb[0]|0},${amb[1]|0},${amb[2]|0}`);
  rs.setProperty("--glyph-op",glyph.toFixed(3));
  themeBgNorm=[bg[0]/255,bg[1]/255,bg[2]/255];
  themeBg2Norm[0]=b2[0]/255; themeBg2Norm[1]=b2[1]/255; themeBg2Norm[2]=b2[2]/255;
  ambientNorm[0]=amb[0]/255; ambientNorm[1]=amb[1]/255; ambientNorm[2]=amb[2]/255;
  accentNorm[0]=accent[0]/255; accentNorm[1]=accent[1]/255; accentNorm[2]=accent[2]/255;
  const dark=(0.2126*bg[0]+0.7152*bg[1]+0.0722*bg[2])/255<0.5;
  themeGlow=dark?0.7:0.0;
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",rgb(bg));
}
function applyThemeMix(m){
  const ac=mixArr(THEME_A.accent,THEME_B.accent,m);
  applyTokens(
    mixArr(THEME_A.bg,THEME_B.bg,m),
    mixArr(THEME_A.surface,THEME_B.surface,m),
    mixArr(THEME_A.text,THEME_B.text,m),
    mixArr(THEME_A.muted,THEME_B.muted,m),
    ac, ac, lerp(THEME_A.glyph,THEME_B.glyph,m)
  );
}
/* ===========================================================================
   EDITORIAL THEME ENGINE — Bangkok Sky Collection
   Eight periods on the guest's local clock, each a full environment rather
   than a palette. Legacy Dark / Legacy Light stay available and override the
   editorial theme entirely. Homepage only -- books carry their own art
   direction and this never touches them.
   Interactive values are the AA-corrected set: the originally specified ones
   measured 2.99-3.83:1 against their own base, under the 4.5 floor.
   =========================================================================== */
let PERIODS=[
  {k:"first-light",   s:6,  e:9,  name:"First Light",    mood:"Fresh · Quiet · Optimistic",
   bg:[0,29,46],   bg2:[79,50,0],  surface:[29,42,56],  amb:[255,184,119],
   text:[233,241,249], muted:[147,167,188], accent:[255,176,32],
   tracks:["First Light Over Langsuan","Garden Windows"]},
  {k:"bright-morning",s:9,  e:12, name:"Bright Morning", mood:"Energetic · Clean · Refreshing",
   bg:[7,21,28],   bg2:[17,50,64],  surface:[23,61,77],  amb:[95,227,255],
   text:[230,246,251], muted:[141,170,182], accent:[0,217,245],
   tracks:["City in Bloom","Midtown Morning"]},
  {k:"midday",        s:12, e:15, name:"Midday",         mood:"Bright · Open · Confident",
   bg:[15,20,24],  bg2:[30,38,43],  surface:[37,47,53],  amb:[191,239,255],
   text:[238,243,246], muted:[152,166,174], accent:[158,232,59],
   tracks:["Ivory Sun","Slow Afternoon"]},
  {k:"afternoon",     s:15, e:18, name:"Afternoon",      mood:"Warm · Comfortable · Relaxed",
   bg:[22,15,10],  bg2:[34,43,23],  surface:[44,42,25],  amb:[240,178,122],
   text:[247,239,231], muted:[188,167,149], accent:[255,133,52],
   tracks:["Amber Glass","Before Sunset"]},
  {k:"golden-hour",   s:18, e:21, name:"Golden Hour",    mood:"Elegant · Romantic · Editorial",
   bg:[16,22,35],  bg2:[59,29,23],  surface:[53,39,24],  amb:[201,162,39],
   text:[248,239,226], muted:[203,185,160], accent:[255,138,117],
   tracks:["After Six","Rooftop Glow"]},
  {k:"blue-hour",     s:21, e:24, name:"Blue Hour",      mood:"Sophisticated · Reflective · Urban",
   bg:[10,16,36],  bg2:[26,36,80],  surface:[33,44,94],  amb:[127,160,255],
   text:[238,241,255], muted:[163,173,209], accent:[123,140,255],
   tracks:["Midnight Lobby","Neon Reflections"]},
  {k:"midnight",      s:0,  e:3,  name:"Midnight",       mood:"Private · Quiet · Dreamlike",
   bg:[5,7,14],    bg2:[16,22,42],  surface:[22,30,54],  amb:[92,123,209],
   text:[242,244,250], muted:[154,166,196], accent:[176,108,255],
   tracks:["Sleepless Bangkok","Quiet Elevators"]},
  {k:"before-dawn",   s:3,  e:6,  name:"Before Dawn",    mood:"Stillness · Reflection · Anticipation",
   bg:[12,18,32],  bg2:[51,0,13],  surface:[53,26,32],  amb:[232,92,74],
   text:[248,234,232], muted:[198,167,164], accent:[255,79,79],
   tracks:["Blue Before Morning","Waiting for Sunrise"]}
];
const LEGACY={
  dark: {k:"legacy-dark", name:"Legacy Dark", mood:"Charcoal · Neon Teal",
         bg:THEME_B.bg,surface:THEME_B.surface,amb:THEME_B.accent,
         text:THEME_B.text,muted:THEME_B.muted,accent:THEME_B.accent},
  light:{k:"legacy-light",name:"Legacy Light",mood:"Ivory · Deep Teal",
         bg:THEME_A.bg,surface:THEME_A.surface,amb:THEME_A.accent,
         text:THEME_A.text,muted:THEME_A.muted,accent:THEME_A.accent}
};
function periodNow(){
  const h=new Date().getHours();
  for(let i=0;i<PERIODS.length;i++){ if(h>=PERIODS[i].s&&h<PERIODS[i].e) return PERIODS[i]; }
  return PERIODS[0];
}

/* The evidence copy keeps the period snapshot above and does not fetch
   flipgazine_periods: the test pins one period, and the engine may not carry a
   key. Everything else is the engine as it ships. */
function isDarkBg(bg){ return (0.2126*bg[0]+0.7152*bg[1]+0.0722*bg[2])/255<0.5; }
function glyphFor(p){ return isDarkBg(p.bg)?0.85:1.0; }

const ED={on:true,cur:null,from:null,to:null,t0:0,dur:0,legacyDark:true,pin:null};
try{
  const sm=localStorage.getItem("fg:mode");   if(sm) ED.on=(sm==="editorial");
  const sl=localStorage.getItem("fg:legacy"); if(sl) ED.legacyDark=(sl==="dark");
}catch(e){}

function palTarget(){ return ED.pin|| (ED.on?periodNow():(ED.legacyDark?LEGACY.dark:LEGACY.light)); }
function edPaint(p){
  applyTokens(p.bg,p.surface,p.text,p.muted,p.accent,p.amb,glyphFor(p),p.bg2);
  ED.cur=p;
  /* Cache the painted palette so the next load can apply it before first paint.
     Every palette change passes through here -- switch, rollover, crossfade
     frame -- so the cache is never more than one repaint stale. Throttled to
     whole periods: writing on every frame of a 60s crossfade would be hundreds
     of writes for a value only read once, at load. */
  if(p.k && p.k!==ED.cachedK){
    ED.cachedK=p.k;
    try{
      localStorage.setItem("fg:pal",JSON.stringify({
        k:p.k, bg:p.bg, bg2:p.bg2||p.bg, surface:p.surface,
        text:p.text, muted:p.muted, accent:p.accent, amb:p.amb,
        glyph:glyphFor(p)
      }));
    }catch(e){}
  }
}
function edBlend(a,b,t){
  return {k:b.k,name:b.name,mood:b.mood,
    bg:mixArr(a.bg,b.bg,t),bg2:mixArr(a.bg2||a.bg,b.bg2||b.bg,t),surface:mixArr(a.surface,b.surface,t),
    text:mixArr(a.text,b.text,t),muted:mixArr(a.muted,b.muted,t),
    accent:mixArr(a.accent,b.accent,t),amb:mixArr(a.amb,b.amb,t)};
}
function setPeriodLabel(p){
  const n=document.getElementById("periodName"),m=document.getElementById("periodMood");
  if(n) n.textContent=p.name;
  if(m) m.textContent=p.mood;
  try{
    if(window.FGThemeAdapter&&typeof window.FGThemeAdapter.paint==="function"){
      window.FGThemeAdapter.paint(p);
    }
  }catch(e){}
}
function edGoTo(p,dur){
  setPeriodLabel(p);
  if(!ED.cur||dur<=0){ edPaint(p); ED.to=null; return; }
  ED.from=ED.cur; ED.to=p; ED.t0=performance.now(); ED.dur=dur;
}
function stepEditorial(now){
  if(!ED.to) return;
  const k=clamp((now-ED.t0)/ED.dur,0,1);
  const e=1-Math.pow(1-k,3);
  edPaint(edBlend(ED.from,ED.to,e));
  if(k>=1){ ED.cur=ED.to; ED.to=null; }
}
/* Not a hard snap: whatever was already showing -- the static #0D1110
   default, or a cached palette from a different period than the one that's
   actually live now -- differed from the real target often enough to read as
   a colour flash the instant this fetch resolved. 900ms matches the crossfade
   already used for the legacy/editorial toggle elsewhere in this file, so a
   correction on arrival looks like the same motion as any other palette
   change instead of a jump. Not the 60s rollover fade either -- that duration
   is for a period changing while you're already looking at the page, which
   is a different situation from arriving on one already past its cue.
   edGoTo's own guard (below) still force-snaps on a null ED.cur, since there
   is nothing to blend away from -- so the dark-ink baseline every page
   already shows before any script runs is seeded here first, deliberately,
   as the starting point to fade away from. Without this line the 900ms above
   is dead: this is genuinely the very first call, ED.cur is null, and
   edGoTo's own condition would silently choose the snap branch regardless of
   the duration passed in. */
/* Seeding straight to LEGACY.dark unconditionally was itself a bug: on
   pages whose inline preload script had already painted the correct cached
   gradient before this file even ran, that forced the crossfade to animate
   backward through flat ink and then back to the real colour -- visible as
   exactly "gradient, gone, solid colour" instead of nothing happening at
   all. Reading the same fg:pal cache the preload script already used means
   this starts from whatever is actually on screen: a true no-op when that
   cache is accurate, a real (and now smooth, not instant) correction when
   it's stale or the period has since rolled over, and the ink baseline only
   when there is truly nothing cached yet -- a first visit, this browser. */
ED.cur=(function(){
  try{
    var c=JSON.parse(localStorage.getItem("fg:pal")||"null");
    if(c&&c.bg) return {k:c.k,bg:c.bg,bg2:c.bg2||c.bg,surface:c.surface,text:c.text,muted:c.muted,accent:c.accent,amb:c.amb};
  }catch(e){}
  return LEGACY.dark;
})();
edGoTo(palTarget(),900);
/* Period rollover crossfades over 60s, checked on the half minute. */
setInterval(function(){
  if(!ED.on||ED.pin) return;
  const p=periodNow();
  if((ED.cur&&ED.cur.k===p.k)||(ED.to&&ED.to.k===p.k)) return;
  edGoTo(p,60000);
},30000);

function syncSwitchState(){
  const sw=document.getElementById("themeSwitch");
  if(sw){ sw.classList.toggle("inert",ED.on); sw.setAttribute("aria-disabled",String(ED.on)); }
  /* the alternating button carries the same inert treatment */
  const ed=document.getElementById("edSwitch");
  if(ed) ed.setAttribute("aria-pressed",String(ED.on));
  document.documentElement.setAttribute("data-mode",ED.on?"editorial":"legacy");
}
function setEditorial(on){
  ED.on=on;
  ED.pin=null;
  try{ localStorage.setItem("fg:mode",on?"editorial":"legacy"); }catch(e){}
  syncSwitchState();
  edGoTo(palTarget(),900);
}
function pinPeriod(key){
  ED.pin=null;
  if(key){
    for(let i=0;i<PERIODS.length;i++){
      if(PERIODS[i].k===key){ ED.pin=PERIODS[i]; break; }
    }
    if(!ED.pin) return;
  }
  ED.on=true;
  syncSwitchState();
  edGoTo(palTarget(),900);
}
syncSwitchState();

/* Persistent payload navigation replaces page-local DOM while this shared
   theme engine stays alive. Re-bind the current period label after each swap
   so newly inserted #periodName/#periodMood placeholders never remain as —. */
addEventListener("fg:pagechange",function(){
  setPeriodLabel(palTarget());
});

const themeSwitch=document.getElementById("themeSwitch");
let themeTween=null;
function toggleTheme(){
  if(ED.on) return;                       // editorial is driving; legacy is inert
  const to=MotionStore.theme.target>=0.5?0:1;
  MotionStore.theme.target=to;
  themeSwitch.setAttribute("aria-pressed",String(to>=0.5));
  Haptics.theme();
  ED.legacyDark=(to>=0.5);
  try{ localStorage.setItem("fg:legacy",ED.legacyDark?"dark":"light"); }catch(e){}
  ED.cur=ED.legacyDark?LEGACY.dark:LEGACY.light;
  setPeriodLabel(ED.cur);
  const from=MotionStore.theme.mix;
  const dur=MotionStore.reduced?120:900;
  const t0=performance.now();
  themeTween={from,to,t0,dur};
}
themeSwitch.addEventListener("click",toggleTheme);

/* The editorial switch had no handler at all. setEditorial() was defined and
   never called, and syncSwitchState() only ever read #edSwitch to set
   aria-pressed on it -- so the button reported a state it could not change.
   Clicking it did nothing on every page, which is why the atmosphere never
   toggled. */
const edSwitch=document.getElementById("edSwitch");
if(edSwitch){
  edSwitch.addEventListener("click",function(){
    setEditorial(!ED.on);
    /* Legacy light/dark is inert while editorial drives the palette, so the
       other button has to be re-marked either way. */
    try{ Haptics.theme(); }catch(e){}
  });
}
function stepTheme(now){
  stepEditorial(now);
  if(!themeTween) return;
  const {from,to,t0,dur}=themeTween;
  const k=clamp((now-t0)/dur,0,1);
  const e=1-Math.pow(1-k,3); // editorial ease-out
  MotionStore.theme.mix=lerp(from,to,e);
  applyThemeMix(MotionStore.theme.mix);
  if(k>=1) themeTween=null;
}

  window.FGTheme = {
    step: (typeof stepTheme==="function") ? stepTheme : function(){},
    periods: PERIODS,
    periodNow: (typeof periodNow==="function") ? periodNow : null,
    pin: pinPeriod
  };
  window.FGSetEditorial = (typeof setEditorial==="function") ? setEditorial : null;
  try{ window.dispatchEvent(new CustomEvent("fg:theme-ready")); }catch(e){}

  /* No runtime on this page means no master loop, so drive it here. Same flag
     fg-glyph uses, set by the loader before anything is injected. */
  if(!window.FGRuntimeWillDrive){
    (function frame(now){ try{ FGTheme.step(now); }catch(e){} requestAnimationFrame(frame); })(performance.now());
  }
})();