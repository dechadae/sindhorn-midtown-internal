/* ===========================================================================
   flipgazine — Book sound engine. ONE copy, shared by every book.
   Extracted verbatim from the five identical inline copies; they differed only
   in the curated track URL and the Jamendo fallback tags, which are now config.

   A book supplies, before loading this:
     window.FG_SOUND = { curated: "<mp3 url>", tags: "lounge+jazz" };

   Loaded via fetch + injected script, because a script tag with src would hit
   the SPA catch-all and return HTML. The book installs a no-op stub first, so
   setMood/tickVolume can be called during the async window without throwing.
   =========================================================================== */
window.Sound=(function(){
  var CFG=window.FG_SOUND||{};
  var ctx=null, master=null;
  var enabled=false, started=false;
  var currentIndex=0;

  var JAMENDO_CLIENT_ID='baf898e6';
  var lofiEl=document.getElementById('lofiAudio');
  var lofiPlaylist=[], lofiIndex=0, lofiFetched=false, lofiReady=false;
  var lofiTargetVol=0;
  if(lofiEl) lofiEl.volume=0;

  function playLofiTrack(i){
    if(!lofiPlaylist.length||!lofiEl) return;
    lofiIndex=((i%lofiPlaylist.length)+lofiPlaylist.length)%lofiPlaylist.length;
    lofiEl.loop=(lofiPlaylist.length===1);
    lofiEl.src=lofiPlaylist[lofiIndex].audio;
  }
  function shuffleArray(arr){
    for(var i=arr.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0; var t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
    return arr;
  }
  var CURATED_URL=CFG.curated||'';
  var curatedTried=false, curatedOK=false;
  function fetchLofi(){
    if(lofiFetched||!lofiEl) return;
    lofiFetched=true;
    if(!curatedTried){
      curatedTried=true;
      lofiPlaylist=[{audio:CURATED_URL}];
      lofiEl.loop=true; lofiEl.src=CURATED_URL; lofiReady=true;
      var onErr=function(){ if(curatedOK) return; try{lofiEl.removeEventListener('error',onErr);}catch(e){} lofiPlaylist=[]; lofiReady=false; fetchJamendo(); };
      lofiEl.addEventListener('error',onErr);
      lofiEl.addEventListener('canplay',function(){ curatedOK=true; try{lofiEl.removeEventListener('error',onErr);}catch(e){} },{once:true});
      if(enabled) lofiEl.play()['catch'](function(){});
      return;
    }
    fetchJamendo();
  }
  function fetchJamendo(){
    lofiFetched=true;
    var url='https://api.jamendo.com/v3.0/tracks/?client_id='+JAMENDO_CLIENT_ID+
      '&format=json&limit=24&tags='+(CFG.tags||'lounge')+'&vocalinstrumental=instrumental&audioformat=mp32&order=popularity_total';
    fetch(url).then(function(r){ return r.ok?r.json():null; })
      .then(function(data){
        var results=data&&data.results;
        if(!results||!results.length) return;
        lofiPlaylist=shuffleArray(results.filter(function(t){ return !!t.audio; }));
        if(!lofiPlaylist.length) return;
        lofiReady=true;
        playLofiTrack(0);
        if(enabled) lofiEl.play()['catch'](function(){});
      })['catch'](function(){});
  }
  if(lofiEl){
    lofiEl.addEventListener('ended',function(){
      if(lofiPlaylist.length>1){ playLofiTrack(lofiIndex+1); if(enabled) lofiEl.play()['catch'](function(){}); }
    });
  }

  function makeNoiseBuffer(seconds){
    var sr=ctx.sampleRate, len=Math.floor(sr*seconds);
    var buf=ctx.createBuffer(1,len,sr), d=buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    return buf;
  }

  var clinkTimer=null;
  function isBarMoment(index){ return index===5||index===6||index===9; } // small bites/cocktails/energy pages
  function clink(){
    if(!ctx||!enabled) return;
    var t=ctx.currentTime;
    [2600,3900,5200].forEach(function(f,i){
      var o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f*(0.98+Math.random()*0.04);
      var g=ctx.createGain(); var start=t+i*0.008;
      g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(0.03/(i+1),start+0.004);
      g.gain.exponentialRampToValueAtTime(0.0004,start+0.35);
      o.connect(g); g.connect(master);
      o.start(start); o.stop(start+0.4);
    });
  }
  function pageTurn(){
    if(!ctx||!enabled) return;
    var t=ctx.currentTime;
    var src=ctx.createBufferSource(); src.buffer=makeNoiseBuffer(0.3);
    var f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200; f.Q.value=0.9;
    var g=ctx.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.05,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0006,t+0.20);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t+0.24);
  }

  function init(){
    if(ctx) return;
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=0;
    master.connect(ctx.destination);

    (function clinkLoop(){
      if(!ctx) return;
      if(enabled && isBarMoment(currentIndex) && Math.random()<0.5) clink();
      clinkTimer=setTimeout(clinkLoop, 3200+Math.random()*4800);
    })();

    started=true;
  }

  function setMood(index){
    currentIndex=index;
    if(enabled) lofiTargetVol=0.5;
  }
  function tickVolume(){
    if(!lofiEl) return;
    lofiEl.volume+=(lofiTargetVol-lofiEl.volume)*0.03;
  }

  function setEnabled(v){
    enabled=v;
    if(ctx) master.gain.setTargetAtTime(v?0.55:0, ctx.currentTime, 0.3);
    if(lofiEl){
      if(v){ lofiTargetVol=0.5; if(lofiReady&&lofiEl.paused) lofiEl.play()['catch'](function(){}); }
      else { lofiTargetVol=0; }
    }
  }

  var wasEnabledBeforeHide=false;
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      wasEnabledBeforeHide=enabled;
      if(ctx&&ctx.state==='running') ctx.suspend();
      if(lofiEl&&!lofiEl.paused) lofiEl.pause();
    } else if(wasEnabledBeforeHide){
      if(ctx&&ctx.state==='suspended') ctx.resume();
      if(lofiEl&&lofiReady) lofiEl.play()['catch'](function(){});
    }
  });
  window.addEventListener('pagehide',function(){
    if(ctx&&ctx.state==='running') ctx.suspend();
    if(lofiEl) lofiEl.pause();
  });

  return {
    toggle:function(){
      if(!started){ init(); enabled=true; } else { enabled=!enabled; }
      setEnabled(enabled);
      if(enabled) fetchLofi();
      return enabled;
    },
    isEnabled:function(){ return enabled; },
    setMood:setMood,
    tickVolume:tickVolume,
    pageTurn:pageTurn,
    clink:clink,
    debugInfo:function(){ return { enabled:enabled, lofiTracks:lofiPlaylist.length, lofiReady:lofiReady, lofiTrack:lofiIndex }; }
  };
})();