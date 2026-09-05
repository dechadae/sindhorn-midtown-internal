"use strict";
/* Moving to Claude Code — page behavior on idui-core.

   Everything the page does that is not presentation: the brand mark, the
   measured header height, fullscreen, the editorial toggle, copy buttons and
   the section rail. Mirrors fg-page-claude-code.js and the header's inline
   scripts one for one; state moved from class names to ARIA where the
   library reads ARIA (aria-current on the active chip, aria-pressed on
   toggles) so no CSS hook belongs to this file. */
(function(){
  var root=document.documentElement;

  /* ---- brand mark (the header's F_PATHS, verbatim) ---- */
  var F_PATHS=[
  "M 144.96,650.77 c 6.02,0.38 12.04,0.42 18.07,0.12 c -0.33,0.6 -0.85,0.92 -1.55,0.96 c -5,0.29 -9.99,0.28 -14.99,-0.03 c -0.7,-0.08 -1.21,-0.42 -1.53,-1.05 Z",
  "M 570.28,87.25 c -2.59,4.23 -6.51,6.52 -9.93,9.95 c -1.55,-0.71 -1.48,-1.33 -2.53,0.92 c -40.07,-28.18 -95.13,-15.65 -126.53,19.56 c -25.18,27.47 -37.8,65.09 -49.17,99.88 c -9.76,31.14 -19.19,62.38 -28.29,93.72 c -1.04,3.54 -0.92,7.48 3.78,7.47 c 26.24,-0.06 52.47,0.11 78.69,0.51 c 11.09,3.04 9.59,18.08 -2.17,19.16 c -27.19,0.12 -54.39,0.23 -81.59,0.34 c -4.53,0.1 -7.29,2.39 -8.29,6.86 c -21.27,69.65 -40.45,141.46 -67,209.26 c -22.34,52.71 -55.03,88.67 -114.22,96.01 c -0.71,-0.6 -1.55,-0.9 -2.51,-0.89 c -4.35,0.47 -8.69,0.47 -13.03,0.01 c -0.9,0.07 -1.75,0.32 -2.53,0.76 c -14.73,-1.96 -28.02,-5.23 -41.18,-12.34 c 1.47,-4.03 5.33,2.22 4.68,-2.44 c 0.41,-0.61 0.93,-1.09 1.57,-1.45 c 1.81,-0.07 3.63,-0.03 5.46,0.09 c 1.43,-0.93 2.95,-1.65 4.57,-2.17 c 1.15,-0.79 0.16,-2.26 0.96,-3.44 c 10.47,3.86 21.27,5.48 32.41,4.89 c 54.92,-3.05 83.38,-50.27 98.36,-97.58 c 19.9,-61.97 36.87,-125.66 54.77,-188.29 c 0.89,-2.38 1.21,-4.83 0.96,-7.34 c -0.28,-1.79 -4.01,-2.01 -5.38,-2.16 c -18.16,0.04 -36.31,0.03 -54.47,-0.02 c -15.01,1.43 -16.63,-17.72 -4.04,-19.33 c 21.59,-0.29 43.18,-0.45 64.77,-0.47 c 4.83,0.11 7.04,-3.35 8.21,-7.53 c 8.71,-30.4 17.77,-60.71 27.17,-90.91 c 11.39,-36.36 25.59,-73.94 50.47,-103.4 c 42.19,-50.28 120.84,-71.27 176.03,-29.63 Z M 579.23,95.72 c 37.04,39.61 25.21,107.21 -28.56,123.53 c -24.44,6.86 -51.21,-0.25 -64.55,-22.87 c -4.63,-9.83 6.58,-18.49 14.44,-10.44 c 8.48,14.1 18.24,19.13 34.94,19.41 c 49.8,-3.82 64.39,-65.55 31.34,-99.18 c 3.88,-3.89 4.79,-6.18 10.54,-7.32 c 1.08,-1 0.25,-2.64 1.85,-3.13 Z",
  "M 163.03,650.89 c -6.03,0.3 -12.05,0.26 -18.07,-0.12 c 0.78,-0.44 1.63,-0.69 2.53,-0.76 c 4.34,0.46 8.68,0.46 13.03,-0.01 c 0.96,-0.01 1.8,0.29 2.51,0.89 Z",
  "M 121.02,629.02 c -0.8,1.18 0.19,2.65 -0.96,3.44 c -1.62,0.52 -3.14,1.24 -4.57,2.17 c -1.83,-0.12 -3.65,-0.16 -5.46,-0.09 c -0.64,0.36 -1.16,0.84 -1.57,1.45 c 0.65,4.66 -3.21,-1.59 -4.68,2.44 c -80.15,-44.41 -59.44,-170.14 33.09,-179.91 c 22.72,-1.97 46.96,5.57 63.2,21.88 c 7.89,7.12 -0.3,18.05 -7.91,12.78 c -26.46,-23.7 -60.69,-25.1 -89.98,-5.36 c -52.33,38.95 -41.27,117.01 18.84,141.2 Z",
  "M 570.28,87.25 c 3.16,2.64 6.15,5.46 8.95,8.47 c -1.6,0.49 -0.77,2.13 -1.85,3.13 c -5.75,1.14 -6.66,3.43 -10.54,7.32 c -2.78,-2.94 -5.79,-5.62 -9.02,-8.05 c 1.05,-2.25 0.98,-1.63 2.53,-0.92 c 3.42,-3.43 7.34,-5.72 9.93,-9.95 Z"
  ];
  var logo=document.getElementById("logoMark");
  if(logo) logo.innerHTML=F_PATHS.map(function(d){return '<path fill="currentColor" d="'+d+'"/>';}).join("");

  /* ---- one measured header height, for the engines and the rail ---- */
  var header=document.querySelector("header");
  function syncHeight(){
    var px=(header.getBoundingClientRect().height||55)+"px";
    root.style.setProperty("--fg-hdr",px);
    root.style.setProperty("--header-h",px);
  }
  if(header){
    syncHeight();
    if(window.ResizeObserver) new ResizeObserver(syncHeight).observe(header);
    else addEventListener("resize",syncHeight,{passive:true});
  }

  /* ---- fullscreen ---- */
  (function(){
    var b=document.getElementById("fsSwitch"); if(!b) return;
    var request=root.requestFullscreen||root.webkitRequestFullscreen;
    var exit=document.exitFullscreen||document.webkitExitFullscreen;
    function active(){ return !!(document.fullscreenElement||document.webkitFullscreenElement); }
    function sync(){
      var on=active();
      b.setAttribute("aria-pressed",on?"true":"false");
      b.setAttribute("aria-label",on?"Exit fullscreen":"Enter fullscreen");
    }
    if(!request||!exit){ b.hidden=true; return; }
    b.addEventListener("click",function(){
      try{ var p=active()?exit.call(document):request.call(root); if(p&&p["catch"]) p["catch"](function(){}); }catch(e){}
    });
    document.addEventListener("fullscreenchange",sync);
    document.addEventListener("webkitfullscreenchange",sync);
    sync();
  })();

  /* ---- editorial toggle ---- */
  (function(){
    var b=document.getElementById("edSwitch"); if(!b) return;
    b.addEventListener("click",function(){
      if(typeof window.FGSetEditorial==="function") window.FGSetEditorial(b.getAttribute("aria-pressed")!=="true");
    });
  })();

  var main=document.getElementById("main");

  /* ---- copy buttons ---- */
  function copied(btn){
    btn.textContent="Copied"; btn.classList.add("is-active");
    setTimeout(function(){ btn.textContent="Copy"; btn.classList.remove("is-active"); },1600);
  }
  function legacyCopy(text,btn){
    var area=document.createElement("textarea");
    area.value=text; area.setAttribute("readonly",""); area.style.position="fixed"; area.style.opacity="0";
    document.body.appendChild(area); area.select();
    try{ if(document.execCommand("copy")) copied(btn); }catch(e){}
    document.body.removeChild(area);
  }
  main.addEventListener("click",function(e){
    var btn=e.target.closest?e.target.closest("[data-copy]"):null;
    if(!btn) return;
    e.preventDefault();
    var code=btn.parentNode&&btn.parentNode.querySelector("code");
    var text=code?code.textContent:"";
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ copied(btn); })["catch"](function(){ legacyCopy(text,btn); });
    }else legacyCopy(text,btn);
  });

  /* ---- section rail ---- */
  var rail=document.getElementById("claudeNav");
  if(rail){
    var chips=[].slice.call(rail.querySelectorAll("[data-nav]"));
    var sections=chips.map(function(c){ return document.getElementById(c.getAttribute("data-nav")); });
    var lock=-1,lockTimer=0,raf=0;
    function activate(i){
      chips.forEach(function(c,j){ if(j===i) c.setAttribute("aria-current","true"); else c.removeAttribute("aria-current"); });
      var c=chips[i]; if(c&&c.scrollIntoView) c.scrollIntoView({block:"nearest",inline:"center"});
    }
    function update(){
      raf=0;
      if(lock>=0){ activate(lock); return; }
      var h=parseFloat(getComputedStyle(root).getPropertyValue("--fg-hdr"))||55;
      var line=h+38,best=0;
      for(var i=0;i<sections.length;i++) if(sections[i]&&sections[i].getBoundingClientRect().top<=line) best=i;
      activate(best);
    }
    function queue(){ if(!raf) raf=requestAnimationFrame(update); }
    rail.addEventListener("click",function(e){
      var chip=e.target.closest?e.target.closest("[data-nav]"):null; if(!chip) return;
      var target=document.getElementById(chip.getAttribute("data-nav")); if(!target) return;
      e.preventDefault();
      lock=chips.indexOf(chip);
      if(lockTimer) clearTimeout(lockTimer);
      activate(lock);
      target.scrollIntoView({behavior:"smooth",block:"start"});
      lockTimer=setTimeout(function(){ lock=-1; lockTimer=0; queue(); },1200);
      try{ history.replaceState(null,"","#"+chip.getAttribute("data-nav")); }catch(_e){}
    });
    addEventListener("scroll",queue,{passive:true});
    addEventListener("resize",queue,{passive:true});
    update();
    var hash=(location.hash||"").slice(1);
    if(hash&&chips.some(function(c){ return c.getAttribute("data-nav")===hash; })){
      requestAnimationFrame(function(){ var t=document.getElementById(hash); if(t) t.scrollIntoView({block:"start"}); });
    }
  }
})();
