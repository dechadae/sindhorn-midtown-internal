const THAILAND_BOUNDS={minLat:5.4,maxLat:20.6,minLon:97.2,maxLon:105.8};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const mixColor=(a,b,t)=>a.map((v,i)=>Math.round(mix(v,b[i],t)));
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;

const PROFILES={
  cool:{top:[92,72,116],mid:[181,94,95],horizon:[244,145,68],gray:[107,98,111],strength:.48},
  hot:{top:[111,91,116],mid:[188,119,108],horizon:[235,160,108],gray:[126,111,116],strength:.43},
  rainy:{top:[91,84,108],mid:[153,110,116],horizon:[201,137,116],gray:[119,113,121],strength:.52},
  generic:{top:[88,82,112],mid:[171,108,106],horizon:[232,146,84],gray:[112,105,116],strength:.40}
};

let stage=null,canvas=null,ctx=null,width=1,height=1,dpr=1,raf=0,exportWrapped=false;

function environmentState(){return window.SindhornEnvironment?.getState?.()||null}
function inThailand(location){const lat=Number(location?.latitude),lon=Number(location?.longitude);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=THAILAND_BOUNDS.minLat&&lat<=THAILAND_BOUNDS.maxLat&&lon>=THAILAND_BOUNDS.minLon&&lon<=THAILAND_BOUNDS.maxLon}
function localDayOfYear(date,timezone){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),obj={};parts.forEach(p=>obj[p.type]=p.value);
    const y=Number(obj.year),m=Number(obj.month),d=Number(obj.day);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(y,0,0))/86400000);
  }catch(_){const start=Date.UTC(date.getUTCFullYear(),0,0);return Math.floor((date.getTime()-start)/86400000)}
}
function seasonFor(state,date=new Date()){
  if(!inThailand(state?.location))return 'generic';
  const doy=localDayOfYear(date,state?.location?.timezone||'Asia/Bangkok');
  if(doy>=46&&doy<135)return 'hot';
  if(doy>=135&&doy<288)return 'rainy';
  return 'cool';
}
function twilightStrength(altitude){
  const e=Number(altitude);if(!Number.isFinite(e)||e>=18||e<=-14)return 0;
  if(e>=0)return smooth((18-e)/18);
  if(e>=-6)return 1;
  return 1-smooth((-6-e)/8);
}
function wetness(state){
  const w=state?.weather||{},v=w.visual||{},humidity=clamp((Number(w.humidity||.65)-.58)/.36),cloud=clamp(Number(v.cloud||w.cloudCover||0)),rain=clamp(Number(v.rain||0)),storm=clamp(Number(v.storm||0));
  return clamp(humidity*.34+cloud*.38+rain*.18+storm*.24);
}
function colorsFor(state){
  const season=seasonFor(state),base=PROFILES[season],wet=wetness(state),grayMix=season==='rainy'?wet*.44:wet*.28;
  return{season,wet,strength:base.strength,top:mixColor(base.top,base.gray,grayMix),mid:mixColor(base.mid,base.gray,grayMix*.82),horizon:mixColor(base.horizon,base.gray,grayMix*.68)};
}
function tintState(){
  const state=environmentState();if(!state?.solar)return null;const strength=twilightStrength(state.solar.altitude);if(strength<=.001)return null;
  const colors=colorsFor(state),cloud=clamp(Number(state.weather?.visual?.cloud||state.weather?.cloudCover||0)),storm=clamp(Number(state.weather?.visual?.storm||0));
  const haze=clamp(colors.wet*.58+cloud*.20+storm*.28);return{...colors,alpha:strength*colors.strength*(1+haze*.16),dim:strength*(.035+haze*.075),altitude:Number(state.solar.altitude)};
}
function ensureCanvas(){
  if(canvas?.isConnected)return true;stage=document.getElementById('environmentStage');if(!stage)return false;
  canvas=document.createElement('canvas');canvas.id='seasonalSkyCanvas';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'3',width:'100%',height:'100%',pointerEvents:'none',display:'block'});stage.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});resize();return !!ctx;
}
function resize(){if(!canvas||!stage||!ctx)return;const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width||innerWidth||1));height=Math.max(1,Math.round(rect.height||innerHeight||1));dpr=Math.min(2,Math.max(1,devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule()}
function drawTint(target,w,h,tint,viewportH=h){
  if(!tint)return;const liveH=Math.max(1,Math.min(h,viewportH));target.save();
  if(tint.dim>.001){target.fillStyle=`rgba(39,31,47,${clamp(tint.dim).toFixed(3)})`;target.fillRect(0,0,w,h)}
  const g=target.createLinearGradient(0,0,0,liveH);g.addColorStop(0,rgba(tint.top,tint.alpha*.78));g.addColorStop(.53,rgba(tint.mid,tint.alpha*.88));g.addColorStop(1,rgba(tint.horizon,tint.alpha));target.fillStyle=g;target.fillRect(0,0,w,liveH);
  if(h>liveH){target.fillStyle=rgba(tint.horizon,tint.alpha*.92);target.fillRect(0,liveH,w,h-liveH)}
  target.restore();
}
function render(){raf=0;if(!ensureCanvas())return;ctx.clearRect(0,0,width,height);const tint=tintState();if(tint)drawTint(ctx,width,height,tint,height);canvas.style.opacity=tint?'1':'0';document.body.dataset.environmentSeason=tint?.season||seasonFor(environmentState())}
function schedule(){if(!raf)raf=requestAnimationFrame(render)}
function imageFromData(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data})}
function wrapExport(){
  if(exportWrapped||!window.SindhornEnvironment?.renderExport)return false;exportWrapped=true;const original=window.SindhornEnvironment.renderExport.bind(window.SindhornEnvironment);
  window.SindhornEnvironment.renderExport=async(w,h)=>{const data=await original(w,h),tint=tintState();if(!tint)return data;const img=await imageFromData(data),out=document.createElement('canvas');out.width=Math.max(1,Math.round(w));out.height=Math.max(1,Math.round(h));const c=out.getContext('2d',{alpha:false});c.drawImage(img,0,0,out.width,out.height);const scale=out.width/Math.max(1,innerWidth),viewportH=Math.min(out.height,Math.max(1,innerHeight*scale));drawTint(c,out.width,out.height,tint,viewportH);return out.toDataURL('image/png',1)};return true;
}
function waitForEnvironment(){if(wrapExport())return;const timer=setInterval(()=>{if(wrapExport())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),12000)}

window.addEventListener('resize',resize,{passive:true});document.addEventListener('sindhorn:route-mounted',schedule);document.addEventListener('sindhorn:location-updated',schedule);document.addEventListener('sindhorn:air-updated',schedule);setInterval(schedule,30000);
waitForEnvironment();schedule();
