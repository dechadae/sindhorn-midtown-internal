const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};

let stage=null,canvas=null,ctx=null,width=1,height=1,dpr=1,raf=0,exportWrapped=false;
const sampleCanvas=document.createElement('canvas');
sampleCanvas.width=1;sampleCanvas.height=1;
const sampleCtx=sampleCanvas.getContext('2d',{alpha:true,willReadFrequently:true});

function environmentState(){return window.SindhornEnvironment?.getState?.()||null}
function skyY(altitude){return clamp(.12+clamp((Number(altitude)+2)/82,0,1)*.72,.08,.88)}
function moonPoint(state,w,h){
  const lunar=state?.lunar;if(!lunar||Number(lunar.altitude)<=-4)return null;
  const az=Number(lunar.azimuth)*Math.PI/180;
  return{x:clamp(.5-Math.sin(az)*.42,.06,.94)*w,y:(1-skyY(lunar.altitude))*h};
}
function visibility(state){
  const weather=state?.weather||{},visual=weather.visual||{};
  const cloud=clamp(Number(visual.cloud??weather.cloudCover??0));
  const storm=clamp(Number(visual.storm)||0),fog=clamp(Number(visual.fog)||0);
  const visKm=Number(weather.visibilityKm);
  const distance=Number.isFinite(visKm)?clamp((visKm-.4)/12):1;
  return clamp((1-cloud*.78)*(1-storm*.78)*(1-fog*.72)*(.45+.55*distance));
}
function liveSources(){
  return['environmentCanvas','rainCanvas','seasonalSkyCanvas','environmentSnowCanvas','environmentHailCanvas','stormEffectsCanvas']
    .map(id=>document.getElementById(id)).filter(Boolean);
}
function sampleStack(x,y,w,h){
  if(!sampleCtx)return{r:104,g:122,b:145};
  sampleCtx.clearRect(0,0,1,1);
  for(const source of liveSources()){
    try{
      if(!source.width||!source.height)continue;
      const sx=source.width/Math.max(1,w),sy=source.height/Math.max(1,h);
      sampleCtx.drawImage(source,clamp(x*sx,0,source.width-1),clamp(y*sy,0,source.height-1),1,1,0,0,1,1);
    }catch(_){ }
  }
  try{const p=sampleCtx.getImageData(0,0,1,1).data;return{r:p[0],g:p[1],b:p[2]}}catch(_){return{r:104,g:122,b:145}}
}
function sampleImage(canvas,x,y){
  try{const c=canvas.getContext('2d',{willReadFrequently:true}),p=c.getImageData(Math.round(clamp(x,0,canvas.width-1)),Math.round(clamp(y,0,canvas.height-1)),1,1).data;return{r:p[0],g:p[1],b:p[2]}}catch(_){return{r:104,g:122,b:145}}
}
function averagedSample(sampler,x,y,r){
  const points=[[0,-2.25],[1.75,-1.35],[2.35,0],[1.75,1.35],[0,2.25],[-1.75,1.35],[-2.35,0],[-1.75,-1.35]];
  let red=0,green=0,blue=0;
  for(const [dx,dy] of points){const p=sampler(x+dx*r,y+dy*r);red+=p.r;green+=p.g;blue+=p.b}
  return{r:Math.round(red/points.length),g:Math.round(green/points.length),b:Math.round(blue/points.length)};
}
function eraseLegacyDisc(target,x,y,r,sampler){
  const top=averagedSample(sampler,x,y-r*.72,r),bottom=averagedSample(sampler,x,y+r*.72,r);
  const size=Math.max(8,Math.ceil(r*4)),patch=document.createElement('canvas');patch.width=size;patch.height=size;const p=patch.getContext('2d',{alpha:true});
  const linear=p.createLinearGradient(0,0,0,size);linear.addColorStop(0,`rgb(${top.r},${top.g},${top.b})`);linear.addColorStop(1,`rgb(${bottom.r},${bottom.g},${bottom.b})`);p.fillStyle=linear;p.fillRect(0,0,size,size);
  p.globalCompositeOperation='destination-in';const mask=p.createRadialGradient(size/2,size/2,r*.45,size/2,size/2,size*.49);mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(.62,'rgba(0,0,0,.98)');mask.addColorStop(1,'rgba(0,0,0,0)');p.fillStyle=mask;p.fillRect(0,0,size,size);p.globalCompositeOperation='source-over';
  target.drawImage(patch,x-size/2,y-size/2);
}
function hash2(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453123;return n-Math.floor(n)}
function craterShade(x,y){
  const craters=[[-.34,-.18,.16,.10],[.27,.22,.13,.09],[.08,-.39,.10,.07],[-.12,.34,.09,.06],[.42,-.05,.08,.05]];
  let shade=0;
  for(const [cx,cy,r,d] of craters){const dist=Math.hypot(x-cx,y-cy);shade+=d*(1-smoothstep(r*.38,r,dist))}
  return shade;
}
function phaseTexture(phase,illumination,opacity,size=112){
  const out=document.createElement('canvas');out.width=size;out.height=size;const c=out.getContext('2d'),img=c.createImageData(size,size),data=img.data;
  const angle=phase*Math.PI*2,cosPhase=Math.cos(angle),waxing=Math.sin(angle)>=0;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
    const x=(px+.5-size/2)/(size*.44),y=(py+.5-size/2)/(size*.44),rr=x*x+y*y,i=(py*size+px)*4;
    if(rr>=1.08)continue;
    const radius=Math.sqrt(rr),edge=1-smoothstep(.90,1.03,radius),chord=Math.sqrt(Math.max(0,1-y*y));
    const terminator=cosPhase*chord,coord=waxing?x:-x,lit=smoothstep(terminator-.045,terminator+.045,coord);
    const limb=.70+.30*Math.sqrt(Math.max(0,1-rr));
    const grain=(hash2(Math.floor(px/3),Math.floor(py/3))-.5)*.085,crater=craterShade(x,y),surface=clamp(limb+grain-crater,.62,1.04);
    const earth=(1-lit)*(.035+.055*(1-illumination));
    const litAlpha=lit*edge*opacity*(.58+.26*illumination),earthAlpha=earth*edge*opacity;
    const alpha=clamp(litAlpha+earthAlpha);
    const lr=238*surface,lg=240*surface,lb=232*surface,er=128,eg=144,eb=163,total=Math.max(alpha,.0001);
    data[i]=Math.round((lr*litAlpha+er*earthAlpha)/total);data[i+1]=Math.round((lg*litAlpha+eg*earthAlpha)/total);data[i+2]=Math.round((lb*litAlpha+eb*earthAlpha)/total);data[i+3]=Math.round(alpha*255);
  }
  c.putImageData(img,0,0);return out;
}
function drawMoon(target,w,h,state,sampler){
  const point=moonPoint(state,w,h);if(!point)return false;
  const lunar=state.lunar,phase=clamp(Number(lunar.phase)||0),illumination=clamp(Number(lunar.illumination)||0),vis=visibility(state);
  const legacyR=Math.max(10,h*.030);eraseLegacyDisc(target,point.x,point.y,legacyR,sampler);
  if(vis<.025||illumination<.008)return true;
  const r=Math.max(6,h*.0185),haloAlpha=vis*(.018+.045*illumination);
  const halo=target.createRadialGradient(point.x,point.y,r*.38,point.x,point.y,r*2.9);halo.addColorStop(0,`rgba(226,235,245,${haloAlpha.toFixed(3)})`);halo.addColorStop(.38,`rgba(200,216,235,${(haloAlpha*.48).toFixed(3)})`);halo.addColorStop(1,'rgba(190,210,235,0)');target.save();target.fillStyle=halo;target.beginPath();target.arc(point.x,point.y,r*3,0,Math.PI*2);target.fill();
  const texture=phaseTexture(phase,illumination,vis);target.globalCompositeOperation='screen';target.drawImage(texture,point.x-r,point.y-r,r*2,r*2);target.globalCompositeOperation='source-over';target.restore();
  document.body.dataset.moonPhase=phase.toFixed(3);document.body.dataset.moonIllumination=illumination.toFixed(3);return true;
}
function ensureCanvas(){
  if(canvas?.isConnected)return true;stage=document.getElementById('environmentStage');if(!stage)return false;
  canvas=document.createElement('canvas');canvas.id='moonPhaseCanvas';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'7',width:'100%',height:'100%',pointerEvents:'none',display:'block'});stage.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});resize();return !!ctx;
}
function resize(){if(!canvas||!stage||!ctx)return;const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width||innerWidth||1));height=Math.max(1,Math.round(rect.height||innerHeight||1));dpr=Math.min(2,Math.max(1,devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule()}
function render(){raf=0;if(!ensureCanvas())return;ctx.clearRect(0,0,width,height);const state=environmentState();if(!state?.lunar){canvas.style.opacity='0';return}const shown=drawMoon(ctx,width,height,state,(x,y)=>sampleStack(x,y,width,height));canvas.style.opacity=shown?'1':'0'}
function schedule(){if(!raf)raf=requestAnimationFrame(render)}
function imageFromData(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data})}
function wrapExport(){
  if(exportWrapped||!window.SindhornEnvironment?.renderExport)return false;exportWrapped=true;const original=window.SindhornEnvironment.renderExport.bind(window.SindhornEnvironment);
  window.SindhornEnvironment.renderExport=async(w,h)=>{const data=await original(w,h),state=environmentState();if(!state?.lunar)return data;const img=await imageFromData(data),out=document.createElement('canvas');out.width=Math.max(1,Math.round(w));out.height=Math.max(1,Math.round(h));const c=out.getContext('2d',{alpha:false});c.drawImage(img,0,0,out.width,out.height);const scale=out.width/Math.max(1,innerWidth),viewportH=Math.min(out.height,Math.max(1,innerHeight*scale));drawMoon(c,out.width,viewportH,state,(x,y)=>sampleImage(out,x,y));return out.toDataURL('image/png',1)};return true;
}
function waitForEnvironment(){if(wrapExport())return;const timer=setInterval(()=>{if(wrapExport())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),12000)}

window.addEventListener('resize',resize,{passive:true});document.addEventListener('sindhorn:route-mounted',schedule);document.addEventListener('sindhorn:location-updated',schedule);document.addEventListener('sindhorn:air-updated',schedule);setInterval(schedule,15000);
waitForEnvironment();schedule();