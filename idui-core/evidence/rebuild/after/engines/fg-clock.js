/* fg-clock.js — one continuous clock for the atmosphere, across navigations.
   ---------------------------------------------------------------------------
   The glyph field drove u_time from performance.now(), which is zero at every
   page load, so the field snapped back to its first frame on every navigation.
   Nothing else about it reset -- the palette, the ripples, the tilt response
   were all fine -- but restarting the animation read as the whole background
   reloading.
   This keeps a running total in sessionStorage. Not localStorage: the clock
   should be continuous within a visit and start fresh on a new one, which is
   what sessionStorage already means. Per-tab, so two tabs do not fight.

   FGClock.seed()  -> seconds to add to the local frame time
   FGClock.mark(s) -> record the current elapsed value

   mark() is throttled to four writes a second. The value only has to be
   accurate to about a frame at the moment of leaving, and a sessionStorage
   write on every rAF would cost more than the effect is worth. */
(function(){
  /* The glyph layout seed belongs to the same continuity contract as time:
     stable within one tab visit, freshly composed in a new session. */
  try{
    var sd=sessionStorage.getItem("fg:seed");
    if(!sd){ sd=String((Math.random()*4294967296)>>>0); sessionStorage.setItem("fg:seed",sd); }
    window.FGSeed=parseInt(sd,10)>>>0;
  }catch(e){ window.FGSeed=1; }

  var KEY="fg:atmosT";
  var last=0, lastWrite=0;

  function read(){
    try{ var v=parseFloat(sessionStorage.getItem(KEY)); return isFinite(v)&&v>0?v:0; }
    catch(e){ return 0; }
  }
  var base=read();

  function write(v){
    try{ sessionStorage.setItem(KEY,String(v)); }catch(e){}
  }

  window.FGClock={
    seed:function(){ return base; },
    mark:function(sec){
      last=base+sec;
      var n=Date.now();
      if(n-lastWrite<250) return;
      lastWrite=n;
      write(last);
    },
    /* Leaving is the one moment the value has to be exact, and the throttle
       may have skipped the last quarter second. Flushed on the way out. */
    flush:function(){ write(last); }
  };

  /* pagehide rather than beforeunload: beforeunload is unreliable on mobile
     Safari and blocks the back/forward cache. pagehide fires in both. */
  addEventListener("pagehide",function(){ window.FGClock.flush(); },{capture:true});
  addEventListener("visibilitychange",function(){
    if(document.hidden) window.FGClock.flush();
  });
})();