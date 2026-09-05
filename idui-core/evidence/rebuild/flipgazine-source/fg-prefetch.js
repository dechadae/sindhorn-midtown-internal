/* fg-prefetch.js — warms the shell's own page cache ahead of a click.
   index.html already reads localStorage['fg:'+path] as an instant-paint cache
   before falling back to network (see paint()/cached/fresh in the boot shell).
   This writes into that exact same key on hover/touch/pointerdown, so by the
   time a real navigation happens the shell's existing cache-first path just
   finds the entry already there. No second cache, no shell change.
   Persistent-stage migration plan, Phase 1. */
(function(){
  var U="https://sjpvhgxacsiorrtijqua.supabase.co/rest/v1";
  var K="FG_ANON_KEY_REDACTED";
  var H={apikey:K,Authorization:"Bearer "+K};
  var SESSION_KEY="sb-sjpvhgxacsiorrtijqua-auth-token";
  var MIN_INTERVAL=15000; /* don't re-warm the same path more than once per 15s of hovering */
  var inflight={};

  function isAuthenticated(){
    try{ return !!localStorage.getItem(SESSION_KEY); }catch(e){ return false; }
  }
  function isSlowConnection(){
    try{
      var c=navigator.connection||navigator.webkitConnection||navigator.mozConnection;
      return !!(c&&(c.saveData||/2g/.test(c.effectiveType||"")));
    }catch(e){ return false; }
  }

  function warm(path){
    if(!path||path.charAt(0)!=="/"||path==="/admin.html") return;
    if(isAuthenticated()||isSlowConnection()) return;
    if(inflight[path]) return;
    var ck="fg:"+path, tsKey=ck+":warmedAt";
    try{
      var last=Number(sessionStorage.getItem(tsKey)||0);
      if(Date.now()-last<MIN_INTERVAL) return;
    }catch(e){}
    inflight[path]=true;
    fetch(U+"/site_files?path=eq."+encodeURIComponent(path)+"&select=content",
      {headers:H,cache:"no-store"})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(rows){
        var html=rows&&rows[0]&&rows[0].content;
        if(!html) return;
        try{
          localStorage.setItem(ck,html);
          sessionStorage.setItem(tsKey,String(Date.now()));
        }catch(e){}
      })["catch"](function(){})
      .then(function(){ inflight[path]=false; });
  }

  function targetPath(a){
    if(!a||!a.getAttribute) return null;
    var href=a.getAttribute("href")||"";
    if(href.charAt(0)!=="/"||href.indexOf("//")===0) return null; /* internal, absolute-path only */
    if(a.target&&a.target!=="_self") return null;
    if(href.length>1&&href.indexOf(".")===-1) return null; /* bare short-link code: resolved server-side, not cacheable here */
    var q=href.indexOf("?");
    return q===-1?href:href.slice(0,q);
  }

  function onIntent(e){
    var t=e.target;
    var a=t&&t.closest?t.closest("a[href]"):null;
    var p=targetPath(a);
    if(p) warm(p);
  }

  document.addEventListener("mouseover",onIntent,{passive:true});
  document.addEventListener("touchstart",onIntent,{passive:true});
  document.addEventListener("pointerdown",onIntent,{passive:true});
})();
