/* fg-nav.js — persistent page-payload navigation.
   ---------------------------------------------------------------------------
   The shared stage (header, WebGL canvas, glyph field, atmosphere and session)
   stays mounted. A page opts in with a strict payload contract; anything else
   falls back to a normal full navigation.

   static-v1:
     body[data-fg-persist="static-v1"]
     one or more head style[data-fg-page-style]
     exactly one direct body child main[data-fg-page]
     no script inside the page payload

   interactive-v1 adds:
     main[data-fg-controller="/fg-page-name.js"]
     a database-backed controller exposing mount(main) and unmount()
 */
(function(){
  if(window.FGNav) return;

  var STATIC="static-v1";
  var INTERACTIVE="interactive-v1";
  var activePath=location.pathname+location.search;
  var serial=0;
  var activation=0;
  var activeController=null;
  var activeMain=null;
  var controllers=window.FGPageControllers||{};
  window.FGPageControllers=controllers;

  function compatible(value){
    return value===STATIC||value===INTERACTIVE;
  }

  function route(href){
    try{
      var url=new URL(href,location.href);
      if(url.origin!==location.origin) return null;
      return url;
    }catch(e){ return null; }
  }

  function meta(doc,selector){
    var node=doc.querySelector(selector);
    return node&&node.getAttribute("content")||"";
  }

  function validController(path){
    return /^\/fg-page-[a-z0-9-]+\.js$/.test(path||"");
  }

  function read(raw,url){
    var doc=new DOMParser().parseFromString(raw,"text/html");
    var contract=doc.body&&doc.body.getAttribute("data-fg-persist");
    if(!compatible(contract)) throw new Error("incompatible page");
    var mains=doc.querySelectorAll("body > main[data-fg-page]");
    var styles=doc.querySelectorAll("head > style[data-fg-page-style]");
    if(mains.length!==1||styles.length<1||mains[0].querySelector("script")) throw new Error("invalid page contract");
    var controller=mains[0].getAttribute("data-fg-controller")||"";
    if(contract===INTERACTIVE&&!validController(controller)) throw new Error("invalid page controller");
    if(contract===STATIC&&controller) throw new Error("static page has controller");
    return {
      url:url,
      contract:contract,
      controller:controller,
      title:doc.title||document.title,
      description:meta(doc,'meta[name="description"]'),
      robots:meta(doc,'meta[name="robots"]'),
      main:mains[0],
      styles:Array.prototype.slice.call(styles)
    };
  }

  function setMeta(selector,value){
    var node=document.head.querySelector(selector);
    if(!value){ if(node) node.remove(); return; }
    if(!node){
      node=document.createElement("meta");
      var name=(selector.match(/name="([^"]+)/)||[])[1];
      if(name) node.setAttribute("name",name);
      document.head.appendChild(node);
    }
    node.setAttribute("content",value);
  }

  function loadController(path){
    if(!path) return Promise.resolve(null);
    if(!window.FGModules||typeof window.FGModules.load!=="function") return Promise.reject(new Error("module loader missing"));
    return window.FGModules.load([path]).then(function(){
      var controller=controllers[path];
      if(!controller||typeof controller.mount!=="function"||typeof controller.unmount!=="function"){
        throw new Error("controller did not register");
      }
      return controller;
    });
  }

  function unmountController(){
    activation++;
    var controller=activeController;
    activeController=null;
    activeMain=null;
    if(controller){
      try{ controller.unmount(); }catch(e){}
    }
  }

  function mountController(path,main){
    var id=++activation;
    if(!path){
      activeController=null;
      activeMain=main||null;
      return Promise.resolve(null);
    }
    return loadController(path).then(function(controller){
      if(id!==activation||!document.documentElement.contains(main)) return null;
      controller.mount(main);
      activeController=controller;
      activeMain=main;
      return controller;
    });
  }

  function updateLocation(view,mode){
    var target=view.url.pathname+view.url.search+view.url.hash;
    if(mode!=="pop") history.pushState({fgPersist:true},"",target);
    activePath=view.url.pathname+view.url.search;
    document.title=view.title;
    setMeta('meta[name="description"]',view.description);
    setMeta('meta[name="robots"]',view.robots);
    var canonical=document.head.querySelector('link[rel="canonical"]');
    if(canonical) canonical.href=view.url.origin+view.url.pathname;
  }

  function finishSwap(){
    requestAnimationFrame(function(){
      document.body.classList.remove("fg-leaving");
      try{
        dispatchEvent(new CustomEvent("fg:pagechange",{detail:{path:activePath}}));
      }catch(e){}
    });
  }

  function swap(view,mode){
    var oldMain=document.querySelector("body > main[data-fg-page]");
    var oldStyles=document.head.querySelectorAll("style[data-fg-page-style]");
    if(!oldMain||!oldStyles.length) throw new Error("current page contract missing");

    unmountController();
    var anchor=oldStyles[0];
    for(var i=0;i<view.styles.length;i++){
      document.head.insertBefore(document.importNode(view.styles[i],true),anchor);
    }
    for(var j=0;j<oldStyles.length;j++) oldStyles[j].remove();

    var newMain=document.importNode(view.main,true);
    oldMain.replaceWith(newMain);
    document.body.setAttribute("data-fg-persist",view.contract);
    updateLocation(view,mode);
    scrollTo(0,0);
    var fill=document.getElementById("ruleFill");
    if(fill) fill.style.width="0%";

    mountController(view.controller,newMain).then(finishSwap)["catch"](function(){
      location.href=view.url.href;
    });
  }

  function fallback(url,mode){
    if(mode==="pop") location.reload();
    else location.href=url.href;
  }

  function make(href,mode){
    if(!document.body||!compatible(document.body.getAttribute("data-fg-persist"))) return null;
    if(!window.FGModules||typeof window.FGModules.page!=="function") return null;
    var url=route(href);
    if(!url) return null;
    var targetPath=url.pathname+url.search;
    /* Same-document activation belongs to fg-motion. prepare() must be free of
       hash and history side effects, including for callers outside that click
       handler. */
    if(targetPath===activePath) return null;

    var id=++serial;
    /* The public Home URL is /, while the shell's database source is
       /home.html. Keep the browser URL canonical and translate only the row
       lookup so the shared brand can return Home without a full reload. */
    var rowPath=url.pathname==="/" ? "/home.html" : url.pathname;
    var pageReady=window.FGModules.page(rowPath).then(function(raw){
      if(id!==serial) throw new Error("superseded navigation");
      return read(raw,url);
    }).then(function(view){
      return loadController(view.controller).then(function(){ return view; });
    });
    /* A commit landing before the interface itself has finished starting up --
       session still resolving, shared motion/theme/glyph/atmosphere modules
       still loading -- could swap in a controller that reads state which
       isn't there yet. In practice FGInterfaceReady has almost always settled
       long before a click gets this far, since the 660ms departure fade alone
       outlasts it; this is the guarantee for the rare case it hasn't. Run in
       parallel with the page fetch, not after it, so the common case costs
       nothing. Promise.resolve(undefined) settles immediately, so a page
       where FGInterfaceReady was never published (nothing here depends on
       fg-header.html specifically) is not blocked. */
    var ready=Promise.all([pageReady,Promise.resolve(window.FGInterfaceReady)]).then(function(all){
      return all[0];
    });
    /* prepare() starts this chain immediately, but commit() -- the only place
       that attaches a real .catch() -- does not run until 660ms later, after
       the departure fade. An incompatible target page rejects well within
       that window, and until commit() runs nothing is listening: an
       unhandled rejection every time someone follows a link from a migrated
       page to one that hasn't been. A silent catch here does not interfere
       with commit()'s own handler below -- both are independent listeners on
       the same promise -- it only ensures one is attached from the moment
       this chain exists, not from the moment something happens to ask for
       the result. */
    ready["catch"](function(){});
    var committed=false;
    return {
      commit:function(){
        if(committed) return;
        committed=true;
        ready.then(function(view){ swap(view,mode); })["catch"](function(){ fallback(url,mode); });
      }
    };
  }

  function activateInitial(){
    var main=document.querySelector("body > main[data-fg-page]");
    if(!main) return;
    var path=main.getAttribute("data-fg-controller")||"";
    if(path) mountController(path,main)["catch"](function(){});
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",activateInitial,{once:true});
  }else{
    activateInitial();
  }

  addEventListener("popstate",function(){
    var url=route(location.href);
    /* Hash and same-document history traversal must not dissolve or reload the
       mounted page. The browser restores the recorded scroll position. */
    if(url&&url.pathname+url.search===activePath){
      document.body.classList.remove("fg-leaving");
      return;
    }
    var prepared=make(location.href,"pop");
    if(!prepared){ location.reload(); return; }
    document.body.classList.add("fg-leaving");
    setTimeout(function(){ prepared.commit(); },660);
  });

  window.FGNav={
    contract:STATIC,
    contracts:[STATIC,INTERACTIVE],
    prepare:function(href){ return make(href,"push"); }
  };
})();
