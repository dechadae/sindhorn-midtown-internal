/* fg-glyph.js — the DOM glyph atmosphere, one implementation.
   ---------------------------------------------------------------------------
   There were two. This richer field keeps the three depth layers, opacity
   hierarchy and seeded layout, and now owns the visual rules and driver too.
   Placement never depends on page content. The live composition is persisted
   for the browser session, so navigation continues the same field rather than
   drawing a replacement.

   This is the richer of the two and is now the only one. Two changes were
   needed to make it portable:
     - the host is #bgLetters or #glyphs, whichever the page provides;
     - clamp/lerp/rand are defined here rather than inherited from the page,
       because ci, pilot and admin never declared them. That was the bug that
       left tilt dead on those three for an hour.
   Reads MotionStore from fg-motion.js, which every page now loads. */
(function(){
  function _clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function _lerp(a,b,t){ return a+(b-a)*t; }
  function _rand(a,b){ return a+Math.random()*(b-a); }
  var clamp=_clamp, lerp=_lerp, rand=_rand;

  /* fg-motion owns the camera. Without it the field still drifts, it just does
     not lean. */
  var MotionStore = window.FGMotion || {pointer:{x:0,y:0},tilt:{x:0,y:0},reduced:false};

const GlyphField=(()=>{
  /* Either legacy host id is accepted; this module normalises both. */
  const host=document.getElementById("bgLetters")||document.getElementById("glyphs");
  if(!host) return null;

  /* One engine owns the field's visual contract on every host page. Inline
     declarations deliberately outrank older page-local #glyphs rules. */
  host.classList.add("fg-glyph-host");
  host.style.opacity="1";
  if(!document.getElementById("fgGlyphStyle")){
    const sheet=document.createElement("style");
    sheet.id="fgGlyphStyle";
    sheet.textContent=".fg-glyph-host{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden;color:var(--text)}.fg-glyph-host span{position:absolute;font-family:'Poppins',sans-serif;font-weight:300;line-height:1;color:var(--text);-webkit-user-select:none;user-select:none;white-space:nowrap;will-change:transform,opacity}.fg-glyph-host span.th{font-family:'Noto Sans Thai','Poppins',sans-serif;font-weight:300}";
    document.head.appendChild(sheet);
  }
  const chars="AaGgQqRr7&@%zKPSf9?£#".split("");
  const thaiChars="กขคฆงจฉชซญฐฑณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮเแโใไ๑๓๕๗๙".split("");
  const THAI_SHARE=0.30;
  /* Final field-level trim, applied after the active theme opacity. Keeping it
     here makes the reduction immediate for restored as well as new glyphs. */
  const FIELD_OPACITY=0.95;
  let glyphs=[];
  const STORE_KEY="fgGlyphField.v2";
  const STORE_MAX_AGE=30*60*1000;
  const CHANGE_MIN=7000;
  const CHANGE_MAX=14000;
  let nextChangeAt=0;
  let lastSave=0;

  function budget(){
    /* Viewport-only budget: identical viewport + seed means identical field,
       independent of which page happens to host it. The restrained ceiling
       keeps glyphs atmospheric instead of competing with page content. */
    return Math.max(14,Math.min(36,Math.round(innerWidth*innerHeight/24000)));
  }

  function makeState(now,visible){
    const depth=(Math.random()*3)|0;
    const r=Math.random();
    let op=(r>0.94?rand(0.18,0.20):r>0.72?rand(0.10,0.14):rand(0.03,0.08))*0.95;
    const isThai=Math.random()<THAI_SHARE;
    if(isThai) op=Math.min(0.209,op*1.25);
    return {depth:depth,baseOp:op,lx:rand(-0.04,1),ly:rand(-0.04,1),
      char:(isThai?thaiChars:chars)[(Math.random()*(isThai?thaiChars:chars).length)|0],
      thai:isThai,size:depth===2?rand(70,190):depth===1?rand(40,90):rand(24,54),
      px:rand(0,Math.PI*2),py:rand(0,Math.PI*2),sp:rand(0.05,0.16),
      amp:rand(6,18)*(depth+1),rot:rand(-14,14),
      phase:visible?"present":"birth",phaseAt:now,
      phaseDuration:visible?0:rand(9000,18000)};
  }

  function stateFromSeed(R,now){
    const depth=(R()*3)|0;
    const r=R();
    const seededRand=function(a,b){ return R()*(b-a)+a; };
    let op=(r>0.94?seededRand(0.18,0.20):r>0.72?seededRand(0.10,0.14):seededRand(0.03,0.08))*0.95;
    const isThai=R()<THAI_SHARE;
    const set=isThai?thaiChars:chars;
    if(isThai) op=Math.min(0.209,op*1.25);
    return {depth:depth,baseOp:op,lx:seededRand(-0.04,1),ly:seededRand(-0.04,1),
      char:set[(R()*set.length)|0],thai:isThai,
      size:depth===2?seededRand(70,190):depth===1?seededRand(40,90):seededRand(24,54),
      px:seededRand(0,Math.PI*2),py:seededRand(0,Math.PI*2),sp:seededRand(0.05,0.16),
      amp:seededRand(6,18)*(depth+1),rot:seededRand(-14,14),
      phase:"present",phaseAt:now,phaseDuration:0};
  }

  function attach(state){
    const el=document.createElement("span");
    state.el=el;
    el.textContent=state.char;
    el.classList.toggle("th",!!state.thai);
    el.style.left=(state.lx*100)+"%";
    el.style.top=(state.ly*100)+"%";
    el.style.fontSize=state.size+"px";
    host.appendChild(el);
    glyphs.push(state);
  }

  function serialise(g){
    return {depth:g.depth,baseOp:g.baseOp,lx:g.lx,ly:g.ly,char:g.char,
      thai:g.thai,size:g.size,px:g.px,py:g.py,sp:g.sp,amp:g.amp,rot:g.rot,
      phase:g.phase,phaseAt:g.phaseAt,phaseDuration:g.phaseDuration};
  }

  function save(now,force){
    if(!force&&now-lastSave<2000) return;
    lastSave=now;
    try{ sessionStorage.setItem(STORE_KEY,JSON.stringify({savedAt:now,
      nextChangeAt:nextChangeAt,glyphs:glyphs.map(serialise)})); }catch(e){}
  }

  function restore(now){
    try{
      const saved=JSON.parse(sessionStorage.getItem(STORE_KEY)||"null");
      if(!saved||!Array.isArray(saved.glyphs)||now-saved.savedAt>STORE_MAX_AGE) return false;
      /* A saved field may predate a lower density ceiling. Trim it while
         restoring so the quieter capacity takes effect on the next page load,
         without waiting through a long sequence of decay cycles. */
      const restored=saved.glyphs.slice(0,budget());
      for(let i=0;i<restored.length;i++) attach(restored[i]);
      nextChangeAt=saved.nextChangeAt||now+rand(CHANGE_MIN,CHANGE_MAX);
      return glyphs.length>0;
    }catch(e){ return false; }
  }

  function build(count){
    count=(typeof count==="number"&&isFinite(count))?Math.round(count):budget();
    if(glyphs.length) return;
    /* Seeded, not random. Every value below -- position, size, opacity, which
       character, Latin or Thai -- came from Math.random(), so the field was
       redrawn differently on every navigation. The shader continuing while the
       glyphs jumped to a new arrangement is what still read as the background
       reloading.
       FGSeed is fixed for the session, so the same sequence comes out on every
       page and the field looks like the one you just left. A new visit gets a
       new field, which is the intent -- it should feel composed, not fixed.
       Scoped to this function on purpose: the ripples under a pointer must stay
       genuinely random, and they use the outer rand(). */
    var _s = (window.FGSeed || 1) >>> 0;
    const R = function(){
      /* mulberry32 -- small, fast, and good enough for scattering glyphs. */
      _s = (_s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    /* No content keep-out: placement depends only on the session seed and
       viewport, so navigating cannot re-consume the random sequence. */
    for(let i=0;i<count;i++){
      attach(stateFromSeed(R,Date.now()));
    }
    nextChangeAt=Date.now()+rand(CHANGE_MIN,CHANGE_MAX);
  }

  function beginDecay(now){
    const choices=glyphs.filter(function(g){ return g.phase==="present"; });
    if(!choices.length) return;
    const g=choices[(Math.random()*choices.length)|0];
    g.phase="decay"; g.phaseAt=now; g.phaseDuration=rand(14000,28000);
  }

  function rebirth(g,now){
    const fresh=makeState(now,false), el=g.el;
    Object.keys(fresh).forEach(function(key){ g[key]=fresh[key]; });
    g.el=el; el.textContent=g.char; el.classList.toggle("th",!!g.thai);
    el.style.left=(g.lx*100)+"%";
    el.style.top=(g.ly*100)+"%"; el.style.fontSize=g.size+"px";
  }

  function reconcileBudget(now){
    const wanted=budget();
    if(glyphs.length<wanted) attach(makeState(now,false));
    else if(glyphs.length>wanted){
      const g=glyphs[glyphs.length-1];
      if(g.phase==="present"){ g.phase="decay"; g.phaseAt=now; g.phaseDuration=rand(14000,28000); g.removeAfter=true; }
    }
  }

  // The pointer may lean the whole field, but never singles out a glyph.
  // Camera parallax limits (spec §5.3): X ±0.18, Y ±0.12
  function update(now){
    const still=MotionStore.reduced;
    const camX=(MotionStore.pointer.x+MotionStore.tilt.x*1.4);
    const camY=(MotionStore.pointer.y+MotionStore.tilt.y*1.4);
    const gOp=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--glyph-op"))||1;
    const wall=Date.now();
    const driftNow=wall/1000;
    for(let i=0;i<glyphs.length;i++){
      const g=glyphs[i];
      let life=1;
      if(g.phase==="birth"){
        life=clamp((wall-g.phaseAt)/g.phaseDuration,0,1);
        life=life*life*(3-2*life);
        if(wall>=g.phaseAt+g.phaseDuration) g.phase="present";
      }else if(g.phase==="decay"){
        life=1-clamp((wall-g.phaseAt)/g.phaseDuration,0,1);
        life=life*life*(3-2*life);
        if(wall>=g.phaseAt+g.phaseDuration){
          if(g.removeAfter){ g.el.remove(); glyphs.splice(i--,1); continue; }
          rebirth(g,wall); life=0;
        }
      }
      const dmul=(g.depth+1)/3;
      let dx=0,dy=0,rz=0;
      if(!still){
        dx=Math.sin(driftNow*g.sp+g.px)*g.amp;
        dy=Math.cos(driftNow*g.sp*0.8+g.py)*g.amp;
        rz=g.rot*dmul*0.3;
      }
      const parX=camX*0.18*180*dmul;   // normalized camera → px
      const parY=camY*0.12*180*dmul;
      g.el.style.transform=`translate(${dx+parX}px,${dy+parY}px) rotate(${rz}deg)`;
      g.el.style.opacity=(g.baseOp*gOp*life*FIELD_OPACITY).toFixed(3);
    }
    if(wall>=nextChangeAt){ beginDecay(wall); nextChangeAt=wall+rand(CHANGE_MIN,CHANGE_MAX); save(wall,true); }
    save(wall,false);
  }

  return {build,update,budget,restore,reconcileBudget,save};
})();

  /* Published for diagnostics and optional interaction hooks; construction
     and animation remain owned here so every page follows the same path. */
  try{ window.GlyphField = GlyphField; window.FGGlyphField = GlyphField; }catch(e){}

  /* ---- single driver ------------------------------------------------------- */
  if(GlyphField){
    if(!GlyphField.restore(Date.now())) GlyphField.build(GlyphField.budget());
    (function frame(now){
      try{ GlyphField.update(now/1000); }catch(e){}
      requestAnimationFrame(frame);
    })(performance.now());
    var rt;
    addEventListener("resize",function(){
      clearTimeout(rt);
      rt=setTimeout(function(){
        GlyphField.reconcileBudget(Date.now());
      },220);
    },{passive:true});
    addEventListener("pagehide",function(){ GlyphField.save(Date.now(),true); });
  }
})();
