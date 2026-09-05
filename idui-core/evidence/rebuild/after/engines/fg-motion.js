/* fg-motion.js — the one motion signal: pointer, touch, tilt, ripples.
   ---------------------------------------------------------------------------
   Lifted out of fg-runtime.js so both atmosphere engines can read the same
   values. Before this there were two: MotionStore here, driving the four
   editorial pages, and a separate tilt tracker inside fg-atmos.js publishing
   window.FG_TILT for ci, pilot and admin. Two sources meant the shader and the
   glyph layer could disagree about where the light was.

   Publishes both names on purpose. FGMotion is what new code should read;
   MotionStore stays because 42 call sites in fg-runtime.js use it, and FG_TILT
   stays because fg-atmos.js reads it. One object, three handles -- no copies to
   fall out of step.

   Load order matters: this must run before either engine. The page loaders
   fetch it alongside and inject it first. */
/* ---- helpers --------------------------------------------------------------
   These were page-level declarations that this code inherited when it lived
   inside the four editorial pages. Those pages still declare clamp and rand, so
   nothing looked wrong -- but ci, pilot and admin never had them, and the
   deviceorientation handler threw on every event there. Tilt was dead on those
   three while taps kept working, because ripples come from fg-atmos, not here.
   Private names on purpose: declaring clamp here would collide with the
   page-level const on the four pages that do have it, and a redeclaration is a
   syntax error that takes the whole module with it. */
function _clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function _rand(a,b){ return a+Math.random()*(b-a); }

const MotionStore = {
  pointer:{tx:0,ty:0,x:0,y:0,active:false},   // target + smoothed, normalized [-1,1]
  tilt:{tx:0,ty:0,x:0,y:0},      // gyroscope target + smoothed
  scroll:{progress:0},           // 0..1 down the document
  theme:{mix:1,target:1},        // 0 = light, 1 = dark
  ripples:[],                    // {x,y,start,dur,strength} — max 3
  reduced:false                  // motion is uniform for every user (no opt-out)
};

/* --- Haptic runtime (spec §6.1) — always wrapped, never during drag --- */
const Haptics=(()=>{
  const ok=typeof navigator!=="undefined" && "vibrate" in navigator;
  const fire=pat=>{
    // Reduced motion: only explicit button-tap confirmations are permitted.
    if(!ok) return;
    try{ navigator.vibrate(pat); }catch(_){}
  };
  return {
    cta(){ fire(8); },
    card(){ fire(8); },
    theme(){ if(!MotionStore.reduced) fire([10,20,10]); else fire(8); }
  };
})();
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-haptic]");
  if(t && t.dataset.haptic==="cta") Haptics.cta();
},{passive:true});

/* --- Pointer runtime — desktop parallax source --- */
const PointerRuntime=(()=>{
  let active=false;
  const on=e=>{
    active=true; MotionStore.pointer.active=true;
    MotionStore.pointer.tx=(e.clientX/innerWidth)*2-1;
    MotionStore.pointer.ty=(e.clientY/innerHeight)*2-1;
  };
  return { start(){ if(!active) window.addEventListener("pointermove",on,{passive:true}); } };
})();
PointerRuntime.start();

/* --- Touch runtime — ripples (spec §5.2) + first-interaction signal --- */
let firstInteraction=false;
const InteractionSignal=[];
function onFirstInteraction(fn){ if(firstInteraction) fn(); else InteractionSignal.push(fn); }
function meaningfulInteraction(){
  if(firstInteraction) return;
  firstInteraction=true;
  InteractionSignal.splice(0).forEach(fn=>{try{fn();}catch(_){}});
}
window.addEventListener("pointerdown",meaningfulInteraction,{passive:true,once:false});
window.addEventListener("keydown",meaningfulInteraction,{passive:true});

const TouchRuntime=(()=>{
  function addRipple(clientX,clientY,primary){
    if(MotionStore.reduced) return;
    const list=MotionStore.ripples;
    if(list.length>=3) list.shift();           // hard cap: 3 active
    list.push({
      x:clientX/innerWidth,
      y:1-(clientY/innerHeight),
      start:performance.now()/1000,
      dur: primary ? _rand(0.7,1.0) : _rand(0.4,0.7),
      strength: primary ? 1.0 : 0.4
    });
  }
  window.addEventListener("touchstart",e=>{
    const t=e.changedTouches[0]; if(!t) return;
    addRipple(t.clientX,t.clientY,true);
    // A second, subtler ripple gives depth without a continuous drag wave.
    const t2=e.changedTouches[1];
    if(t2) addRipple(t2.clientX,t2.clientY,false);
  },{passive:true});
  // Mouse/pen also emit a ripple (touch is handled above to avoid double-firing).
  window.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch") addRipple(e.clientX,e.clientY,true);
  },{passive:true});
  return {};
})();

/* --- Orientation runtime (spec §5.3) — permission only after interaction --- */
const OrientationRuntime=(()=>{
  /* No permission prompt anywhere outside the books. Asking for motion access
     is a fair trade inside a book, where tilt moves the artwork and the reader
     chose to be there; on the catalog and the tools it interrupts to offer a
     background effect nobody came for. The toggle lives in the books, and the
     books have their own copy of it.
     So on iOS there is no gyro here, because getting it would mean asking.
     Pointer parallax is unaffected, and Android attaches directly below. */

  function handle(e){
    if(e.gamma==null) return;
    MotionStore.tilt.tx=_clamp(e.gamma/30,-1,1);
    MotionStore.tilt.ty=_clamp((e.beta!=null?(e.beta-45)/30:0),-1,1);
  }
  function attach(){ window.addEventListener("deviceorientation",handle); }

  const needsPrompt = typeof DeviceOrientationEvent!=="undefined" &&
                      typeof DeviceOrientationEvent.requestPermission==="function";

  if(MotionStore.reduced) return {}; // no gyro parallax under reduced motion

  if(needsPrompt){
    /* iOS: permission is required and nothing here will ask for it. The field
       still moves with the pointer and with its own drift. */
  } else if(typeof DeviceOrientationEvent!=="undefined"){
    onFirstInteraction(attach);          // Android / permissionless: just start
  }
  return {};
})();


/* The aliases. Same object, not a snapshot -- a copy would freeze at load. */
/* ---- smoothing ------------------------------------------------------------
   The handlers above only record raw targets (tx, ty). Turning those into the
   damped x, y that everything actually reads used to happen inside
   fg-runtime.js's master loop -- which meant the values only advanced on the
   four pages that load it. ci, pilot and admin would have read a tilt frozen
   at zero forever.
   It belongs with the store it smooths, so it lives here now and runs whether
   or not an atmosphere engine is present. fg-runtime no longer does it: two
   lerps against the same numbers would double the damping rate. */
(function(){
  var k = 0.06;                 // heavy damping, per the motion spec
  function damp(now){
    MotionStore.pointer.x += (MotionStore.pointer.tx - MotionStore.pointer.x) * k;
    MotionStore.pointer.y += (MotionStore.pointer.ty - MotionStore.pointer.y) * k;
    MotionStore.tilt.x    += (MotionStore.tilt.tx    - MotionStore.tilt.x)    * k;
    MotionStore.tilt.y    += (MotionStore.tilt.ty    - MotionStore.tilt.y)    * k;
    requestAnimationFrame(damp);
  }
  requestAnimationFrame(damp);
})();

/* Haptics travels with the store: fg-theme fires it on a theme switch, and a
   module cannot see another module's lexical const unless it is published. */
try{ window.FGHaptics = Haptics; }catch(e){}
window.FGMotion = MotionStore;
window.MotionStore = MotionStore;
Object.defineProperty(window, "FG_TILT", {
  /* fg-atmos reads FG_TILT.x / .y as smoothed tilt. Served live from the same
     store rather than mirrored, so there is nothing to keep synchronised. */
  get: function(){ return MotionStore.tilt; },
  configurable: true
});

/* ---------------------------------------------------------------------------
   Page transition — the books' cross-dissolve, centralised.
   ---------------------------------------------------------------------------
   This lived inline in fourteen pages, pasted and drifting. It is behaviour
   shared by every page, so it belongs here with the rest of the shared
   behaviour.

   Migration is page by page, not all at once: the guard below stands down if a
   page still carries its own copy, so nothing runs twice while the inline
   blocks are being removed. Delete a page's inline transition and it falls
   through to this one; until then this is a no-op there.

   Two details that are easy to get wrong and were learned the hard way:

   z-index 45 puts the overlay below the header (50) and above a section rail
   (40). At 9999 it covered the bar on the way out, so the bar vanished, the
   shell drew it again and the page drew it a third time -- three appearances
   of a thing meant to be continuous.

   The arrival fade is never on body. Opacity on body drags every child down
   with it, the header included, so the one element identical on every page
   becomes the one that flashes on every navigation. It is applied to the
   content column instead, and the header is left alone.
   =========================================================================== */
(function(){
  /* A page that already has #fgFade in its own markup or inline script owns
     the transition; this module leaves it alone. */
  if(window.__fgTransition) return;
  if(document.getElementById("fgFade")) return;
  window.__fgTransition = true;

  /* Editorial books remain full-document pages. Their six grounds are known
     here so the interface can dissolve to the destination colour before the
     shell replaces the document. Cached HTML remains the fallback for future
     hand-built books, so adding one does not require another hard-coded branch
     once its row has been visited. */
  var BOOK_GROUNDS={
    "/sindhornmidtown/anju-rooftop-bar.html":"#141414",
    "/sindhornmidtown/bangkok-78.html":"#0a1f16",
    "/sindhornmidtown/countdown-to-midnight.html":"#000000",
    "/sindhornmidtown/horizon-pool-bar.html":"#03151d",
    "/sindhornmidtown/lobby-lounge.html":"#0a0a0b",
    "/sindhornmidtown/sip-and-co.html":"#0e2f22"
  };
  function editorialGround(url){
    var ground=BOOK_GROUNDS[url.pathname]||"";
    if(ground) return ground;
    try{
      var cached=localStorage.getItem("fg:"+url.pathname);
      var hit=cached&&cached.match(/<html[^>]*style=["'][^"']*background:\s*(#[0-9a-f]{3,6})/i);
      if(hit&&cached.indexOf("data-fg-persist=")===-1) return hit[1];
    }catch(e){}
    return "";
  }
  function rememberReturnHeader(){
    try{
      var header=document.querySelector("header");
      var styles=document.getElementById("fgSharedHeaderStyles");
      if(header) sessionStorage.setItem("fg:return-header",header.outerHTML);
      if(styles) sessionStorage.setItem("fg:return-header-style",styles.textContent||"");
      var root=getComputedStyle(document.documentElement);
      var ground=(root.getPropertyValue("--bg")||root.backgroundColor||"#0D1110").trim();
      sessionStorage.setItem("fg:return-interface",JSON.stringify({
        path:"/home.html",ground:ground,at:Date.now()
      }));
    }catch(e){}
  }
  function prepareBookHandoff(url,ground){
    document.documentElement.style.setProperty("--fg-book-ground",ground);
    document.body.classList.add("fg-book-leaving");
    rememberReturnHeader();
    try{
      sessionStorage.setItem("fg:book-entry",JSON.stringify({
        path:url.pathname,ground:ground,at:Date.now()
      }));
    }catch(e){}
  }

  if(!document.getElementById("fgTransitionStyle")){
    var st = document.createElement("style");
    st.id = "fgTransitionStyle";
    st.textContent =
      /* The arrival fade is NOT here, deliberately. This stylesheet is injected
         after the module loads, which is after the page has already painted --
         so applying an opacity animation at that point drops visible content
         to zero and fades it back in. That is a flicker, and it is worse than
         the duplication it was meant to remove.
         The fade has to exist at parse time, so it stays inline in each page's
         head: two lines, and they cannot be centralised through a module that
         loads late. What is centralised here is everything that can be --
         the overlay, its stacking, the click interception and the timing. */
      /* #fgFade carries no colour of its own now. It used to paint a flat
         #0D1110 plate over the whole page -- simple, but it hid the gradient
         and the glyph field along with the content, which a full reload was
         already about to do a moment later anyway. It is kept only to block
         pointer events during the 660ms; the fade itself is now on the
         content, so leaving reveals whatever the shader and the glyphs are
         doing underneath instead of covering them. */
      "#fgFade{position:fixed;inset:0;z-index:45;background:transparent;" +
      "opacity:0;pointer-events:none;transition:opacity .64s var(--ease-soft,cubic-bezier(.4,0,.2,1))}" +
      "body.fg-leaving #fgFade{opacity:1;pointer-events:auto}" +
      /* A book cannot keep the persistent atmosphere or header. Cover the
         complete interface with the destination book ground while those
         shared nodes dissolve underneath; the shell then opens on the exact
         same colour with no intermediate header frame. */
      "body.fg-book-leaving #fgFade{background:var(--fg-book-ground,#0a0a0b);z-index:2147483600}" +
      /* Everything at the top level except the shader canvas, the glyph
         field and the header dissolves, so the gradient and the glyphs carry
         the transition instead of a plate covering them. Excluded by id/tag
         rather than by a shared class: the two things this must never touch
         are the two the atmosphere depends on, and the one bar that must
         never flash. */
      "body.fg-leaving>:not(#glCanvas):not(#bgLetters):not(#glyphs):not(header):not(#fgFade){" +
      "opacity:0;transition:opacity .64s var(--ease-soft,cubic-bezier(.4,0,.2,1))}";
    document.head.appendChild(st);
  }

  /* Created now rather than on the click: an element inserted and given its
     class in the same frame has no starting value to animate from, so the
     overlay would snap instead of fade. Appended beside the header so it is
     ordered against the header directly, rather than against whatever wrapper
     a page happens to put around its content. */
  function mount(){
    if(document.getElementById("fgFade")) return;
    var f = document.createElement("div");
    f.id = "fgFade";
    var hdr = document.querySelector("header");
    var host = (hdr && hdr.parentNode) || document.body;
    host.appendChild(f);
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mount);
  }else{
    mount();
  }

  /* Same-document links are resolved before the departure signal. A link to
     what is already mounted must never add fg-leaving, start a fetch or wait
     through the 660ms page-transition timer. Leading-slash links still cover
     the site's internal routes; hash-only links join them here so section
     movement uses the same smooth behaviour. Modified clicks fall through so
     open-in-new-tab still works. */
  function sameDocument(url){
    return url.origin===location.origin &&
           url.pathname===location.pathname &&
           url.search===location.search;
  }

  function findHashTarget(hash){
    if(!hash) return null;
    var id=hash.slice(1);
    try{ id=decodeURIComponent(id); }catch(e){}
    if(!id) return null;
    return document.getElementById(id) ||
           (document.getElementsByName(id)[0] || null);
  }

  function setSamePageHash(url,moveFocus){
    var target=findHashTarget(url.hash);
    if(location.hash!==url.hash){
      try{
        history.pushState(history.state,"",
          url.pathname+url.search+url.hash);
      }catch(e){
        location.hash=url.hash;
        return;
      }
    }
    if(target&&moveFocus&&typeof target.focus==="function"){
      var temporary=!target.hasAttribute("tabindex");
      if(temporary) target.setAttribute("tabindex","-1");
      try{ target.focus({preventScroll:true}); }catch(e){ target.focus(); }
      if(temporary){
        target.addEventListener("blur",function(){
          target.removeAttribute("tabindex");
        },{once:true});
      }
    }
    if(target&&typeof target.scrollIntoView==="function"){
      target.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }

  function activateSameDocument(a,url,event){
    if(url.hash){
      setSamePageHash(url,event.detail===0);
      return;
    }
    /* Only the shared brand has a useful action when it already points at the
       mounted route. Current-page navigation links are intentional no-ops. */
    if(a.classList&&a.classList.contains("brand")){
      if(location.hash){
        try{
          history.pushState(history.state,"",url.pathname+url.search);
        }catch(e){}
      }
      try{
        scrollTo({top:0,left:0,behavior:"smooth"});
      }catch(e){
        scrollTo(0,0);
      }
    }
  }

  document.addEventListener("click", function(e){
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    var t=e.target, a=(t&&t.closest)?t.closest("a[href]"):null;
    if(!a) return;
    if(a.target&&a.target!=="_self") return;
    if(a.hasAttribute("download")) return;
    var href=a.getAttribute("href");
    if(!href||(href.charAt(0)!=="/"&&href.charAt(0)!=="#")) return;
    var url;
    try{ url=new URL(href,location.href); }catch(linkError){ return; }
    if(url.origin!==location.origin) return;
    var targetBookGround=editorialGround(url);
    if(sameDocument(url)){
      e.preventDefault();
      activateSameDocument(a,url,e);
      return;
    }
    var prepared=null;
    try{
      if(window.FGNav&&typeof window.FGNav.prepare==="function"){
        prepared=window.FGNav.prepare(href);
      }
    }catch(navError){ prepared=null; }
    e.preventDefault();
    if(targetBookGround) prepareBookHandoff(url,targetBookGround);
    document.body.classList.add("fg-leaving");
    /* 660ms against a .64s fade: leaving earlier navigates part-way through
       the fade rather than after it. Deliberately quicker than the .64s ->
       1.06s arrival: leaving is a snap decision, arriving should not be
       rushed -- the two used to match exactly and were pulled back apart on
       purpose. The opt-in persistent router starts its fetch above while this
       fade runs; incompatible pages still take the exact full-navigation path. */
    setTimeout(function(){
      if(prepared&&typeof prepared.commit==="function"){
        prepared.commit();
        return;
      }
      location.href=href;
    },660);
  },true);

  /* Restoring from the back/forward cache keeps the leaving class, which would
     leave the overlay up over a page the visitor has just returned to. */
  addEventListener("pageshow", function(){
    document.body.classList.remove("fg-leaving");
    document.body.classList.remove("fg-book-leaving");
    document.documentElement.style.removeProperty("--fg-book-ground");
  });
})();


/* ---------------------------------------------------------------------------
   Reading progress — the accent line under the header.
   ---------------------------------------------------------------------------
   #ruleFill and its styling come from fg-header.html, so every page has always
   had the bar; what was pasted into twelve files was only the scroll listener.
   That listener depends on nothing at first paint, which is what makes this a
   clean extraction where the arrival fade was not: it can live here entirely,
   with no inline remainder.

   Duplication is harmless while pages are migrated -- two listeners write the
   same width from the same scrollTop -- but the guard keeps it to one.
   =========================================================================== */
(function(){
  if(window.__fgProgress) return;
  window.__fgProgress = true;

  function start(){
    var fill = document.getElementById("ruleFill");
    /* The header arrives with the shell rather than with the document, so on a
       page where it has not landed yet this retries rather than giving up. */
    if(!fill){
      if((start.tries = (start.tries || 0) + 1) < 20) setTimeout(start, 100);
      return;
    }
    function upd(){
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      fill.style.width = Math.max(0, Math.min(100, p * 100)).toFixed(2) + "%";
    }
    addEventListener("scroll", upd, {passive:true});
    addEventListener("resize", upd, {passive:true});
    upd();
  }
  start();
})();
