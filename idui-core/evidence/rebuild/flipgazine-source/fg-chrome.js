/* ===========================================================================
   flipgazine — Book chrome. ONE copy, shared by five books.
   Tilt (gyro permission, smoothing, label), fullscreen, share and nav flash.
   Extracted from the five inline copies, which hashed identically once the
   share payload was parameterised -- that object was the only difference.

   A book supplies, before loading this:
     window.FG_SHARE = { title:"...", text:"..." };

   Expects the standard book chrome in the DOM: #tiltToggle, #fsToggle,
   #shareBtn, and the tilt/target globals the render loop reads.
   =========================================================================== */
function onOrientation(e){
  if(!tiltEnabled) return;
  if(e.gamma===null&&e.beta===null) return;
  gyroActive=true;
  target.x=clamp((e.gamma||0)/32,-1,1);
  target.y=clamp(((e.beta||0)-45)/32,-1,1);
}
function needsGyroPermission(){
  return typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function';
}
function enableGyro(){
  if(needsGyroPermission()){
    DeviceOrientationEvent.requestPermission().then(function(s){
      if(s==='granted') window.addEventListener('deviceorientation',onOrientation,{passive:true});
    })['catch'](function(){});
  } else if(window.DeviceOrientationEvent){
    window.addEventListener('deviceorientation',onOrientation,{passive:true});
  }
}
if(!needsGyroPermission()) enableGyro();

var awaitingGrant=needsGyroPermission();
window.FG_TILT_ON=true;
function setTiltLabel(){
  if(awaitingGrant){ tiltToggle.classList.remove('off'); tiltToggle.classList.remove('on'); tiltToggle.title='Enable tilt'; return; }
  tiltToggle.classList.toggle('off',!tiltEnabled);
  tiltToggle.classList.toggle('on',tiltEnabled);
  tiltToggle.title='Tilt: '+(tiltEnabled?'On':'Off');
}
tiltToggle.addEventListener('click',function(){
  if(awaitingGrant){ awaitingGrant=false; tiltEnabled=true; enableGyro(); setTiltLabel(); return; }
  tiltEnabled=!tiltEnabled;
  /* Some books run their own deviceorientation listener inside their background
     renderer. Publish the state so they can honour this toggle too. */
  window.FG_TILT_ON=tiltEnabled;
  if(tiltEnabled) enableGyro(); else { target.x=0; target.y=0; }
  setTiltLabel();
});
tiltToggle.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); tiltToggle.click(); } });
setTiltLabel();

/* =====================================================================
   FULLSCREEN
   ===================================================================== */
function isFullscreen(){ return !!(document.fullscreenElement||document.webkitFullscreenElement); }
function updateFsLabel(){
  var on=isFullscreen();
  fsToggle.classList.toggle('on',on);
  fsToggle.classList.toggle('off',!on);
  fsToggle.title='Fullscreen: '+(on?'On':'Off');
}
fsToggle.addEventListener('click',function(){
  try{
    if(!isFullscreen()){
      var el=document.documentElement;
      var req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen;
      if(req) req.call(el);
    } else {
      var exit=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
      if(exit) exit.call(document);
    }
  }catch(e){}
});
fsToggle.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fsToggle.click(); } });
document.addEventListener('fullscreenchange',updateFsLabel);
document.addEventListener('webkitfullscreenchange',updateFsLabel);
updateFsLabel();

/* =====================================================================
   HOME + SHARE
   ===================================================================== */
function flashNav(btn){ btn.classList.add('on'); setTimeout(function(){ btn.classList.remove('on'); },220); }
homeBtn.addEventListener('click',function(){
  if(!pageFlip) return;
  try{ pageFlip.turnToPage(0); }catch(e){}
  applyScene(0);
  flashNav(homeBtn);
});
homeBtn.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); homeBtn.click(); } });

var fgShareUrl=null;
function resolveShareUrl(cb){
  if(fgShareUrl){ cb(fgShareUrl); return; }
  fetch(U+"/rest/v1/fg_shortlinks?target_path=eq."+encodeURIComponent(location.pathname)+"&active=eq.true&select=code",
        {headers:{apikey:K,Authorization:"Bearer "+K}})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(rows){
      fgShareUrl=(rows&&rows[0]&&rows[0].code)?location.origin+"/"+rows[0].code:location.href;
      cb(fgShareUrl);
    })['catch'](function(){
      fgShareUrl=location.href;
      cb(fgShareUrl);
    });
}
shareBtn.addEventListener('click',function(){
  resolveShareUrl(function(url){
    var S=window.FG_SHARE||{};
    var data={ title:S.title||document.title, text:S.text||'', url:url };
    if(navigator.share){
      navigator.share(data)['catch'](function(){});
      flashNav(shareBtn);
    } else if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){
        shareBtn.title='Link copied';
        flashNav(shareBtn);
      })['catch'](function(){});
    }
  });
});
shareBtn.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); shareBtn.click(); } });

