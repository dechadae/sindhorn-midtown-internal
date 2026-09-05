"use strict";
(function(){
  var PATH="/fg-page-claude-code.js";
  var registry=window.FGPageControllers||{};
  window.FGPageControllers=registry;
  var state=null;

  function mount(main){
    if(state&&state.main===main) return;
    unmount();
    var st={main:main};
    state=st;

/* ===========================================================================
   flipgazine — V2.3 platform runtime
   Implementation order per spec §8:
   1 DOM/CI · 2 Theme crossfade · 3 Interaction runtimes · 4 Glyph atmosphere
   5 Motion · 6 Ripples+gyro · 7 Performance adaptation · 8 A11y + fallback
   =========================================================================== */

/* No copyright line on this page, so no #year to stamp. This statement used to
   sit here unguarded and was the first thing the runtime did: once the footer
   was removed it threw on line one and took the whole runtime with it --
   arrival reveal, glyph field, motion, ripples. Removed rather than wrapped in
   a null check, because the element is not missing by accident; it is gone. */

/* Arrival reveal — no boot screen. Triggered up front (and again on load) so a
   later error can never leave the hero copy stuck hidden. */
function revealNow(){ document.body && document.body.classList.add("arrive"); }
requestAnimationFrame(()=>requestAnimationFrame(revealNow));
st.revealTimer=setTimeout(revealNow,1200);

/* Copy controls are delegated to the mounted payload so newly added manual
   sections work without another inline script. The fallback also runs when
   Clipboard API permission is denied, not only when the API is absent. */
st.copyTimers=[];
function copied(btn){
  if(state!==st||!document.documentElement.contains(btn)) return;
  btn.textContent="Copied";
  btn.className="g-copy ok";
  var timer=setTimeout(function(){
    if(state===st&&document.documentElement.contains(btn)){
      btn.textContent="Copy";
      btn.className="g-copy";
    }
  },1600);
  st.copyTimers.push(timer);
}
function legacyCopy(text,btn){
  var area=document.createElement("textarea");
  area.value=text;
  area.setAttribute("readonly","");
  area.style.position="fixed";
  area.style.opacity="0";
  document.body.appendChild(area);
  area.select();
  try{ if(document.execCommand("copy")) copied(btn); }catch(e){}
  document.body.removeChild(area);
}
st.copyClick=function(e){
  var btn=e.target.closest?e.target.closest(".g-copy"):null;
  if(!btn||!main.contains(btn)) return;
  e.preventDefault();
  var code=btn.parentNode&&btn.parentNode.querySelector("code");
  var text=code?code.textContent:"";
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ copied(btn); })
      ["catch"](function(){ legacyCopy(text,btn); });
  }else{
    legacyCopy(text,btn);
  }
};
main.addEventListener("click",st.copyClick);

/* Section rail — same interaction contract as Voice. The rail is portalled
   outside the animated page payload while mounted so its glass compositor is
   isolated from the long manual underneath it. */
var rail=main.querySelector("#claudeNav");
if(rail){
  st.rail=rail;
  st.railHome=rail.parentNode;
  if(rail.parentNode!==document.body) document.body.appendChild(rail);
  st.navChips=[].slice.call(rail.querySelectorAll("[data-nav]"));
  st.navSections=st.navChips.map(function(chip){return main.querySelector("#"+chip.getAttribute("data-nav"));});
  st.navLock=-1;
  st.navLockTimer=0;
  st.navRaf=0;

  function footerSbw(){
    var w=window.innerWidth-document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--sbw",(w>0?w:0)+"px");
  }
  function revealChip(chip){if(chip&&chip.scrollIntoView)chip.scrollIntoView({block:"nearest",inline:"center"});}
  function activateNav(index){
    st.navChips.forEach(function(chip,i){chip.classList.toggle("on",i===index);});
    revealChip(st.navChips[index]);
  }
  function updateNav(){
    st.navRaf=0;
    if(state!==st)return;
    if(st.navLock>=0){activateNav(st.navLock);return;}
    var header=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fg-hdr"))||55;
    var line=header+38,best=0;
    for(var i=0;i<st.navSections.length;i++){
      if(st.navSections[i]&&st.navSections[i].getBoundingClientRect().top<=line)best=i;
    }
    activateNav(best);
  }
  function queueNav(){if(st.navRaf)return;st.navRaf=requestAnimationFrame(updateNav);}

  st.navClick=function(e){
    var chip=e.target.closest?e.target.closest("[data-nav]"):null;
    if(!chip||!rail.contains(chip))return;
    var target=main.querySelector("#"+chip.getAttribute("data-nav"));
    if(!target)return;
    e.preventDefault();
    var index=st.navChips.indexOf(chip);
    st.navLock=index;
    if(st.navLockTimer)clearTimeout(st.navLockTimer);
    activateNav(index);
    target.scrollIntoView({behavior:"smooth",block:"start"});
    st.navLockTimer=setTimeout(function(){
      if(state!==st)return;
      st.navLock=-1;
      st.navLockTimer=0;
      queueNav();
    },1200);
    try{history.replaceState(null,"","#"+chip.getAttribute("data-nav"));}catch(_e){}
  };
  st.navScroll=queueNav;
  st.navResize=function(){footerSbw();queueNav();};
  rail.addEventListener("click",st.navClick);
  window.addEventListener("scroll",st.navScroll,{passive:true});
  window.addEventListener("resize",st.navResize,{passive:true});
  footerSbw();
  updateNav();

  var footerHash=(location.hash||"").slice(1);
  if(footerHash&&st.navChips.some(function(chip){return chip.getAttribute("data-nav")===footerHash;})){
    requestAnimationFrame(function(){
      var target=main.querySelector("#"+footerHash);
      if(state===st&&target)target.scrollIntoView({block:"start"});
    });
  }
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>Math.random()*(b-a)+a;

/* ===========================================================================
   fg-runtime.js — motion, glyph atmosphere and scroll.
   Was 39KB inline here and byte-identical on four pages. Fetched now from
   site_files so there is one copy to edit. Nothing outside this block referred
   to it, so loading it a frame late is invisible: it is background and
   interaction polish, not structure. */
  (function(){
    window.FGRuntimeWillDrive=true;
    window.FGInterfaceReady
      /* fg-runtime.js references MotionStore, FGTheme etc. as bare globals in
         many places, and expects fg-motion/theme/glyph/atmos to have already
         run. Those now load from the header, in a separate FGModules.load()
         call from this one -- two independent fetches with no ordering
         guarantee between them, where a single combined call used to
         guarantee it by running array entries in order. Waiting on
         FGInterfaceReady, which only resolves once the header's shared
         modules have finished loading and running, restores that guarantee
         without needing to know anything about the header's own internals. */
      ? Promise.resolve(window.FGInterfaceReady).then(function(){ window.FGModules.load(["/fg-runtime.js"]); })
      : window.FGModules.load(["/fg-runtime.js"]);
  })();
(function(){
  /* Editorial toggle. Off falls back to Legacy Dark by default; the light/dark
     switch then becomes meaningful and picks between the two Legacy palettes. */
  var b=document.getElementById("edSwitch");
  if(!b||typeof setEditorial!=="function"||b.dataset.fgEdWired) return;
  b.dataset.fgEdWired="1";
  b.addEventListener("click",function(){
    setEditorial(b.getAttribute("aria-pressed")!=="true");
    if(window.Haptics&&Haptics.theme) Haptics.theme();
  });
})();
(function(){
  var grid=document.getElementById('catalogGrid'); if(!grid) return;
  var IO=window.IntersectionObserver, io=null;
  if(IO){ io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.12}); st.catalogIO=io; }
  function reveal(){
    grid.querySelectorAll('.card:not(.cat-seen)').forEach(function(c){
      c.classList.add('cat-seen');
      if(io){ c.classList.add('cat-reveal'); io.observe(c); } else { c.classList.add('in'); }
    });
    setTimeout(function(){ grid.querySelectorAll('.card').forEach(function(c){c.classList.add('in');}); },1500);
  }
  var activeVal='*';
  /* Re-query the cards on every apply. The grid re-renders once the catalog
     fetch lands, so any list captured when filters() first ran points at
     detached nodes, and setting display on those does nothing. */
  function applyFilter(){
    [].slice.call(grid.querySelectorAll('.card:not(.skeleton)')).forEach(function(c){
      var t=c.getAttribute('data-cat')||'Restaurants';
      c.style.display=(activeVal==='*'||t===activeVal)?'':'none';
    });
  }
  function filters(){
    /* Loading skeletons carry .card as well. Building the bar off those
       captured detached nodes with no data-cat, so clicking a tab filtered
       nothing. Require real, categorised cards before building. */
    var cards=[].slice.call(grid.querySelectorAll('.card:not(.skeleton)[data-cat]'));
    if(cards.length<2 || document.querySelector('.cat-filter')) return;
    /* Fixed groupings rather than one tab per tag: dining venues under
       Restaurants, seasonal titles under Festive. Cards carry data-cat. */
    var keys=['Restaurants','Festive'];
    var bar=document.createElement('div'); bar.className='cat-filter';
    function chip(label,val){ var b=document.createElement('button'); b.className='cat-chip'; b.type='button'; b.textContent=label; b.setAttribute('aria-pressed', val==='*'?'true':'false');
      b.addEventListener('click',function(){ bar.querySelectorAll('.cat-chip').forEach(function(x){x.setAttribute('aria-pressed','false');}); b.setAttribute('aria-pressed','true');
        activeVal=val; applyFilter(); });
      return b; }
    bar.appendChild(chip('All','*')); keys.forEach(function(k){ bar.appendChild(chip(k,k)); });
    grid.parentNode.insertBefore(bar, grid);
  }
  var mo=new MutationObserver(function(){ reveal(); filters(); applyFilter(); }); st.catalogMO=mo; mo.observe(grid,{childList:true});
  reveal(); filters();
})();
  }

  function unmount(){
    if(!state) return;
    var st=state;
    state=null;
    clearTimeout(st.revealTimer);
    if(st.copyClick&&st.main) st.main.removeEventListener("click",st.copyClick);
    if(st.navRaf)cancelAnimationFrame(st.navRaf);
    if(st.navLockTimer)clearTimeout(st.navLockTimer);
    if(st.navClick&&st.rail)st.rail.removeEventListener("click",st.navClick);
    if(st.navScroll)window.removeEventListener("scroll",st.navScroll);
    if(st.navResize)window.removeEventListener("resize",st.navResize);
    if(st.rail&&st.rail.parentElement===document.body){
      if(st.railHome&&st.railHome.isConnected)st.railHome.appendChild(st.rail);
      else st.rail.remove();
    }
    if(st.copyTimers){ for(var i=0;i<st.copyTimers.length;i++) clearTimeout(st.copyTimers[i]); }
    if(st.catalogIO){ try{ st.catalogIO.disconnect(); }catch(e){} }
    if(st.catalogMO){ try{ st.catalogMO.disconnect(); }catch(e){} }
  }

  registry[PATH]={mount:mount,unmount:unmount};
})();
