const FULL_RUNTIME_URL='./betta-runtime-full.js?v=1';
const BOOTSTRAP_DPR=2;
const BOOTSTRAP_RENDERER='sindhorn-betta-bootstrap-v1';

let initialized=false;
let fullRuntimePromise=null;
let fullStartPromise=null;
let previewCanvas=null;
let previewContext=null;
let previewRaf=0;
let previewResizeObserver=null;
let previewStartedAt=0;
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
    betta:{baseline:'royal-blue-halfmoon',baselineAuthority:'startup-bootstrap',availableBaselines:[],dayCycle:null,satelliteSource:null,satelliteStatus:'deferred',observedAt:null,metrics:null,lifecycle:'bootstrap',lifecycleReason:'foreground-first',contextLost:false,satelliteStreaming:false,rendering:true,firstFrameRendered:false,tilt:{supported:false,enabled:false,listening:false,permission:'deferred',calibrated:false,x:0,y:0}}
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
}

function finPath(ctx,cx,cy,scale,phase,flip=1){
  const sway=Math.sin(phase)*.08;
  ctx.beginPath();
  ctx.moveTo(cx,cy);
  ctx.bezierCurveTo(cx+scale*(.18+sway)*flip,cy-scale*.42,cx+scale*.82*flip,cy-scale*.54,cx+scale*1.04*flip,cy-scale*.08);
  ctx.bezierCurveTo(cx+scale*.84*flip,cy+scale*.20,cx+scale*.42*flip,cy+scale*.58,cx+scale*.05*flip,cy+scale*.76);
  ctx.bezierCurveTo(cx-scale*.08*flip,cy+scale*.38,cx-scale*.10*flip,cy+scale*.14,cx,cy);
  ctx.closePath();
}

function drawPreview(now){
  if(!previewCanvas||!previewContext)return;
  const ctx=previewContext;
  const width=previewCanvas.width/BOOTSTRAP_DPR;
  const height=previewCanvas.height/BOOTSTRAP_DPR;
  const elapsed=(now-previewStartedAt)/1000;
  ctx.setTransform(BOOTSTRAP_DPR,0,0,BOOTSTRAP_DPR,0,0);
  ctx.clearRect(0,0,width,height);

  const background=ctx.createLinearGradient(0,0,width,height);
  background.addColorStop(0,'#171421');
  background.addColorStop(.48,'#2E273B');
  background.addColorStop(1,'#171522');
  ctx.fillStyle=background;
  ctx.fillRect(0,0,width,height);

  const cx=width*(.53+Math.sin(elapsed*.32)*.012);
  const cy=height*(.46+Math.sin(elapsed*.27)*.008);
  const scale=Math.min(width,height)*.34;

  ctx.save();
  ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=.44;
  let glow=ctx.createRadialGradient(cx-scale*.06,cy-scale*.02,scale*.02,cx,cy,scale*.88);
  glow.addColorStop(0,'rgba(74,185,255,.52)');
  glow.addColorStop(.42,'rgba(24,77,210,.28)');
  glow.addColorStop(1,'rgba(8,12,35,0)');
  ctx.fillStyle=glow;
  ctx.beginPath();ctx.ellipse(cx,cy,scale*.92,scale*.64,Math.sin(elapsed*.18)*.05,0,Math.PI*2);ctx.fill();

  finPath(ctx,cx-scale*.02,cy-scale*.02,scale,elapsed*.55,1);
  const finGradient=ctx.createLinearGradient(cx-scale*.12,cy-scale*.45,cx+scale,cy+scale*.65);
  finGradient.addColorStop(0,'rgba(75,214,255,.22)');
  finGradient.addColorStop(.35,'rgba(40,92,235,.62)');
  finGradient.addColorStop(.72,'rgba(49,33,154,.50)');
  finGradient.addColorStop(1,'rgba(10,9,32,.04)');
  ctx.fillStyle=finGradient;ctx.fill();

  ctx.globalAlpha=.28;
  finPath(ctx,cx-scale*.10,cy+scale*.02,scale*.82,elapsed*.44+1.1,-1);
  const rearGradient=ctx.createLinearGradient(cx-scale,cy-scale*.3,cx,cy+scale*.7);
  rearGradient.addColorStop(0,'rgba(45,125,245,.05)');
  rearGradient.addColorStop(.45,'rgba(43,174,241,.45)');
  rearGradient.addColorStop(1,'rgba(16,20,70,.04)');
  ctx.fillStyle=rearGradient;ctx.fill();

  ctx.globalAlpha=.68;
  const bodyGradient=ctx.createLinearGradient(cx-scale*.48,cy,cx+scale*.42,cy);
  bodyGradient.addColorStop(0,'rgba(17,40,106,.25)');
  bodyGradient.addColorStop(.45,'rgba(34,104,230,.72)');
  bodyGradient.addColorStop(.82,'rgba(87,205,244,.58)');
  bodyGradient.addColorStop(1,'rgba(22,39,94,.15)');
  ctx.fillStyle=bodyGradient;
  ctx.beginPath();ctx.ellipse(cx-scale*.12,cy,scale*.34,scale*.12,-.05,0,Math.PI*2);ctx.fill();
  ctx.restore();

  previewRaf=requestAnimationFrame(drawPreview);
}

function removePreview(){
  if(!previewCanvas)return;
  cancelAnimationFrame(previewRaf);
  previewRaf=0;
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
  if('ResizeObserver'in window){previewResizeObserver=new ResizeObserver(sizePreview);previewResizeObserver.observe(stage)}else addEventListener('resize',sizePreview,{passive:true});
  previewStartedAt=performance.now();
  drawPreview(previewStartedAt);
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
