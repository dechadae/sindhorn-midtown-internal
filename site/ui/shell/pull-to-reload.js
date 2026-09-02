const THRESHOLD=72;
let cleanup=null;

function stateLabel(state){return state==='release'?'Release to reload':state==='reloading'?'Reloading':state==='reloaded'?'Reloaded':'Pull to reload'}

export function initPullToReload(){
  cleanup?.();
  const indicator=document.createElement('div');
  indicator.className='ui-pull-refresh';
  indicator.dataset.state='pull';
  indicator.setAttribute('role','status');
  indicator.setAttribute('aria-live','polite');
  indicator.innerHTML='<span class="ui-spinner" aria-hidden="true"></span><span class="ui-pull-refresh__label">Pull to reload</span>';
  document.body.appendChild(indicator);
  const label=indicator.querySelector('.ui-pull-refresh__label');
  let startY=0,tracking=false,distance=0,reloading=false,hideTimer=0;

  const setState=state=>{indicator.dataset.state=state;label.textContent=stateLabel(state);indicator.classList.toggle('is-visible',state!=='pull'||distance>8)};
  const reset=()=>{tracking=false;distance=0;if(!reloading)setState('pull')};
  const reload=async()=>{
    if(reloading)return;
    reloading=true;setState('reloading');
    try{
      const app=window.SindhornAppPack;
      const route=app?.getRoute?.()||'today';
      await app?.mountRoute?.(route,{animate:false});
      document.dispatchEvent(new CustomEvent('sindhorn:pull-reload',{detail:{route}}));
      try{await window.SindhornEnvironment?.refreshWeather?.()}catch(_){}
      setState('reloaded');
    }catch(error){console.warn('Pull reload failed',error);setState('pull')}
    finally{
      reloading=false;
      clearTimeout(hideTimer);
      hideTimer=setTimeout(()=>{distance=0;setState('pull')},700);
    }
  };
  const onTouchStart=event=>{
    if(reloading||window.scrollY>0||event.touches.length!==1)return;
    startY=event.touches[0].clientY;tracking=true;distance=0;
  };
  const onTouchMove=event=>{
    if(!tracking)return;
    const delta=event.touches[0].clientY-startY;
    if(delta<=0){reset();return}
    distance=Math.min(delta*.58,110);
    indicator.style.transform=`translate(-50%,${Math.max(-44,distance-44)}px)`;
    indicator.classList.add('is-visible');
    setState(distance>=THRESHOLD?'release':'pull');
  };
  const onTouchEnd=()=>{
    if(!tracking)return;
    const shouldReload=distance>=THRESHOLD;
    tracking=false;indicator.style.transform='';
    if(shouldReload)void reload();else reset();
  };
  document.addEventListener('touchstart',onTouchStart,{passive:true});
  document.addEventListener('touchmove',onTouchMove,{passive:true});
  document.addEventListener('touchend',onTouchEnd,{passive:true});
  document.addEventListener('touchcancel',onTouchEnd,{passive:true});
  cleanup=()=>{
    clearTimeout(hideTimer);
    document.removeEventListener('touchstart',onTouchStart);
    document.removeEventListener('touchmove',onTouchMove);
    document.removeEventListener('touchend',onTouchEnd);
    document.removeEventListener('touchcancel',onTouchEnd);
    indicator.remove();cleanup=null;
  };
  return cleanup;
}
