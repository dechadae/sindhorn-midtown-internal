const FULL_RUNTIME_URL='./betta-runtime-full.js?v=1';
const BOOTSTRAP_DPR=2;
const BOOTSTRAP_RENDERER='sindhorn-betta-bootstrap-v1';

let initialized=false;
let fullRuntimePromise=null;
let fullStartPromise=null;
let previewCanvas=null;
let previewContext=null;
let previewResizeObserver=null;
let fullFirstFrameListenerInstalled=false;

function nextFrame(){return new Promise(resolve=>requestAnimationFrame(()=>resolve()))}

function waitForStartupReveal(){
  const root=document.documentElement;
  if(root.dataset.startupEnter==='visible')return Promise.resolve();
  return new Promise(resolve=>{
    const observer=new MutationObserver(()=>{
      if(root.dataset.startupEnter!=='visible')return;
      observer.disconnect();
      resolve();
    });
    observer.observe(root,{attributes:true,attributeFilter:['data-startup-enter']});
  });
}

function bootstrapState(){
  return{
    weather:{},air:{},solar:null,lunar:null,
    location:{...(window.SindhornLocation?.getState?.()||{})},
    quality:BOOTSTRAP_DPR,config:null,seasonal:null,
    renderer:BOOTSTRAP_RENDERER,inputMode:'satellite-only',
    betta:{baseline:'royal-blue-halfmoon',baselineAuthority:'startup-bootstrap',availableBaselines:[],dayCycle:null,satelliteSource:null,satelliteStatus:'deferred',observedAt:null,metrics:null,lifecycle:'bootstrap',lifecycleReason:'foreground-first',contextLost:false,satelliteStreaming:false,rendering:false,firstFrameRendered:false,tilt:{supported:false,enabled:false,listening:false,permission:'deferred',calibrated:false,x:0,y:0}}
  };
}

function installBootstrapApi(){
  if(window.SindhornEnvironment&&window.SindhornEnvironment.getState?.().renderer!=='')return;
  window.SindhornEnvironment={
    refreshWeather:async()=>null,
    renderExport:async(...args)=>{
      const api=await ensureFullRuntime();
      return api?.renderExport?.(...args);
    },
    setBettaBaseline:()=>{},
    setBettaPeriod:()=>{},
    useLiveBettaDayCycle:()=>{},
    previewBettaDayCycle:()=>{},
    previewBettaComposition:()=>{},
    enableBettaTilt:async()=>false,
    recenterBettaTilt:()=>{},
    getState:bootstrapState,
    applyConfig:()=>{}
  };
}

function drawPreview(){
  if(!previewCanvas||!previewContext)return;
  const ctx=previewContext;
  const width=previewCanvas.width/BOOTSTRAP_DPR;
  const height=previewCanvas.height/BOOTSTRAP_DPR;
  ctx.setTransform(BOOTSTRAP_DPR,0,0,BOOTSTRAP_DPR,0,0);
  ctx.clearRect(0,0,width,height);

  // Deliberately neutral startup atmosphere. No fake fish, fins, body or glow.
  // The only organism shown to the user is the approved WebGL Betta once its
  // real first frame has completed.
  const background=ctx.createLinearGradient(0,0,width,height);
  background.addColorStop(0,'#171421');
  background.addColorStop(.48,'#2E273B');
  background.addColorStop(1,'#171522');
  ctx.fillStyle=background;
  ctx.fillRect(0,0,width,height);
}

function sizePreview(){
  if(!previewCanvas)return;
  const width=Math.max(1,Math.round(window.innerWidth));
  const height=Math.max(1,Math.round(window.innerHeight));
  const targetWidth=width*BOOTSTRAP_DPR;
  const targetHeight=height*BOOTSTRAP_DPR;
  if(previewCanvas.width!==targetWidth)previewCanvas.width=targetWidth;
  if(previewCanvas.height!==targetHeight)previewCanvas.height=targetHeight;
  previewCanvas.style.width=`${width}px`;
  previewCanvas.style.height=`${height}px`;
  drawPreview();
}

function removePreview(){
  if(!previewCanvas)return;
  previewResizeObserver?.disconnect();
  previewResizeObserver=null;
  const canvas=previewCanvas;
  previewCanvas=null;
  previewContext=null;
  canvas.style.opacity='0';
  setTimeout(()=>canvas.remove(),280);
}

function installFullFirstFrameHandoff(){
  if(fullFirstFrameListenerInstalled)return;
  fullFirstFrameListenerInstalled=true;
  document.addEventListener('sindhorn:betta-first-frame',()=>{
    performance.mark?.('sindhorn-betta-full-ready-after-bootstrap');
    document.body.dataset.bettaBootstrap='complete';
    removePreview();
  },{once:true});
}

function renderBootstrapFrame(){
  const stage=document.getElementById('environmentStage');
  const webglCanvas=document.getElementById('environmentCanvas');
  if(!stage||!webglCanvas)return false;
  stage.hidden=false;
  const canvas=document.createElement('canvas');
  canvas.id='bettaStartupCanvas';
  canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2',opacity:'1',transition:'opacity .24s cubic-bezier(.22,1,.36,1)'});
  stage.append(canvas);
  previewCanvas=canvas;
  previewContext=canvas.getContext('2d',{alpha:false,desynchronized:true})||canvas.getContext('2d',{alpha:false});
  if(!previewContext){canvas.remove();previewCanvas=null;return false}
  sizePreview();
  if('ResizeObserver'in window){
    previewResizeObserver=new ResizeObserver(sizePreview);
    previewResizeObserver.observe(stage);
  }else addEventListener('resize',sizePreview,{passive:true});
  installBootstrapApi();
  installFullFirstFrameHandoff();
  document.body.dataset.bettaBootstrap='visible';
  document.body.dataset.bettaFirstFrame='bootstrap';
  document.body.dataset.environmentRenderer=BOOTSTRAP_RENDERER;
  document.body.dataset.environmentInput='satellite-only';
  document.body.classList.add('environment-ready');
  performance.mark?.('sindhorn-betta-bootstrap-first-frame');
  document.dispatchEvent(new CustomEvent('sindhorn:betta-bootstrap-first-frame'));
  return true;
}

async function ensureFullRuntime(){
  if(fullRuntimePromise)return fullRuntimePromise;
  fullRuntimePromise=(async()=>{
    performance.mark?.('sindhorn-betta-full-import-start');
    const module=await import(FULL_RUNTIME_URL);
    performance.mark?.('sindhorn-betta-full-import-end');
    performance.mark?.('sindhorn-betta-full-init-start');
    await module.initEnvironment();
    performance.mark?.('sindhorn-betta-full-init-return');
    return window.SindhornEnvironment;
  })().catch(error=>{
    console.error('Deferred full Betta startup failed.',error);
    document.body.dataset.bettaBootstrap='fallback';
    fullRuntimePromise=null;
    return window.SindhornEnvironment;
  });
  return fullRuntimePromise;
}

function scheduleFullRuntime(){
  if(fullStartPromise)return fullStartPromise;
  fullStartPromise=(async()=>{
    await waitForStartupReveal();
    await nextFrame();
    await nextFrame();
    await new Promise(resolve=>setTimeout(resolve,80));
    if(document.hidden){
      await new Promise(resolve=>{
        const onVisible=()=>{if(document.hidden)return;document.removeEventListener('visibilitychange',onVisible);resolve()};
        document.addEventListener('visibilitychange',onVisible);
      });
    }
    return ensureFullRuntime();
  })();
  return fullStartPromise;
}

export async function initEnvironment(){
  if(initialized)return;
  initialized=true;
  const rendered=renderBootstrapFrame();
  if(!rendered){
    await ensureFullRuntime();
    return;
  }
  void scheduleFullRuntime();
}
