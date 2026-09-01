let initialized=false;
let api=null;

function markReady(){
  if(document.body.classList.contains('environment-ready'))return;
  document.body.dataset.bettaFirstFrame='ready';
  document.body.classList.add('environment-ready');
  performance.mark?.('sindhorn-betta-first-frame');
  document.dispatchEvent(new CustomEvent('sindhorn:betta-first-frame'));
}

export async function initEnvironment(){
  if(initialized)return api;
  initialized=true;
  api={
    refreshWeather:async()=>{},
    renderExport:async()=>null,
    getState:()=>({renderer:'diagnostic-no-webgl',inputMode:'none'}),
    applyConfig:()=>{}
  };
  window.SindhornEnvironment=api;
  requestAnimationFrame(markReady);
  return api;
}
