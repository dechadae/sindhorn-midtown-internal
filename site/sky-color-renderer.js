const MIN_CONFIDENCE=.12;
const MAX_DIRECTIONAL_ALPHA=.46;
const MAX_DAY_ALPHA=.28;
const MAX_TWILIGHT_ALPHA=.34;
const MAX_NIGHT_ALPHA=.16;

let canvas=null,ctx=null,current=null,wrappedExport=false,wrapTimer=0;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const validRgb=value=>Array.isArray(value)&&value.length===3&&value.every(channel=>Number.isFinite(Number(channel))&&Number(channel)>=0&&Number(channel)<=255);

function usable(calibration){
  if(!calibration||Number(calibration.schema)!==1||clamp(calibration.confidence)<MIN_CONFIDENCE||!calibration.visual)return false;
  if(!validRgb(calibration.visual.zenithRgb)||!validRgb(calibration.visual.horizonRgb))return false;
  const expires=Date.parse(calibration.expiresAt||'');return Number.isFinite(expires)&&expires>Date.now()-15*60*1000;
}
function alphaFor(calibration){
  if(!usable(calibration))return 0;
  const confidence=clamp(calibration.confidence),mode=String(calibration.mode||'');
  const cap=mode==='sunrise-east'||mode==='sunset-west'?MAX_DIRECTIONAL_ALPHA:mode==='twilight'?MAX_TWILIGHT_ALPHA:mode==='night'?MAX_NIGHT_ALPHA:MAX_DAY_ALPHA;
  const haze=clamp(calibration.visual?.haze),qualityLift=.90+haze*.10;
  return clamp(confidence*cap*qualityLift,0,cap);
}
function rgba(rgb,alpha){return`rgba(${Math.round(Number(rgb[0]))},${Math.round(Number(rgb[1]))},${Math.round(Number(rgb[2]))},${alpha.toFixed(4)})`}
function midpoint(a,b){return[0,1,2].map(index=>Math.round(Number(a[index])*.42+Number(b[index])*.58))}
function ensureCanvas(){
  if(canvas?.isConnected)return canvas;
  const stage=document.getElementById('environmentStage');if(!stage)return null;
  canvas=document.createElement('canvas');canvas.id='skyCalibrationCanvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'3',width:'100%',height:'100%',display:'block',pointerEvents:'none',opacity:'1',transform:'translateZ(0)'});
  stage.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});return canvas;
}
function resize(){
  if(!ensureCanvas()||!ctx)return false;
  const stage=canvas.parentElement,rect=stage?.getBoundingClientRect?.(),w=Math.max(1,Math.round(rect?.width||innerWidth||1)),h=Math.max(1,Math.round(rect?.height||innerHeight||1)),dpr=Math.max(1,Math.min(3,Number(devicePixelRatio)||1));
  const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;ctx.setTransform(dpr,0,0,dpr,0,0)}
  return{w,h};
}
function paint(calibration=current){
  current=calibration||null;const size=resize();if(!size||!ctx)return;
  ctx.clearRect(0,0,size.w,size.h);const alpha=alphaFor(current);document.documentElement.dataset.skyColorCalibration=alpha>0?'live':'fallback';
  if(alpha<=0)return;
  const top=current.visual.zenithRgb,bottom=current.visual.horizonRgb,middle=midpoint(top,bottom),gradient=ctx.createLinearGradient(0,0,0,size.h);
  gradient.addColorStop(0,rgba(top,alpha*.88));gradient.addColorStop(.58,rgba(middle,alpha*.72));gradient.addColorStop(1,rgba(bottom,alpha));ctx.fillStyle=gradient;ctx.fillRect(0,0,size.w,size.h);
}
function compositeExport(dataUrl,width,height,calibration){
  if(!usable(calibration)||alphaFor(calibration)<=0||typeof document==='undefined')return Promise.resolve(dataUrl);
  return new Promise(resolve=>{const image=new Image();image.onload=()=>{try{const out=document.createElement('canvas');out.width=Math.max(1,Math.round(width));out.height=Math.max(1,Math.round(height));const c=out.getContext('2d',{alpha:false});c.drawImage(image,0,0,out.width,out.height);const alpha=alphaFor(calibration),top=calibration.visual.zenithRgb,bottom=calibration.visual.horizonRgb,middle=midpoint(top,bottom),gradient=c.createLinearGradient(0,0,0,out.height);gradient.addColorStop(0,rgba(top,alpha*.88));gradient.addColorStop(.58,rgba(middle,alpha*.72));gradient.addColorStop(1,rgba(bottom,alpha));c.fillStyle=gradient;c.fillRect(0,0,out.width,out.height);resolve(out.toDataURL('image/png',1))}catch(_){resolve(dataUrl)}};image.onerror=()=>resolve(dataUrl);image.src=dataUrl});
}
function wrapExport(){
  const environment=window.SindhornEnvironment;if(!environment?.renderExport||wrappedExport)return false;
  const original=environment.renderExport.bind(environment);environment.renderExport=async(width,height)=>{const data=await original(width,height);return compositeExport(data,width,height,current)};wrappedExport=true;return true;
}
function startExportWrap(){
  if(wrapExport())return;let attempts=0;wrapTimer=setInterval(()=>{attempts++;if(wrapExport()||attempts>=24){clearInterval(wrapTimer);wrapTimer=0}},250);
}
function publish(calibration){paint(calibration);wrapExport()}

document.addEventListener('sindhorn:sky-calibration',event=>publish(event.detail?.calibration||null));
document.addEventListener('sindhorn:route-mounted',()=>{paint();wrapExport()});
addEventListener('resize',()=>paint(),{passive:true});
window.SindhornSkyColorRenderer={getState:()=>({active:alphaFor(current)>0,alpha:alphaFor(current),mode:current?.mode||'fallback',confidence:clamp(current?.confidence),wrappedExport}),refresh:()=>paint(window.SindhornSkyCalibration?.getState?.()||current)};
ensureCanvas();publish(window.SindhornSkyCalibration?.getState?.()||null);startExportWrap();
