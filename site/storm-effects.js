const MIN_STRIKE_MS=12000;
const MAX_STRIKE_MS=30000;
const SAMPLE_INTERVAL_MS=120;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};

let stage=null,canvas=null,ctx=null,width=1,height=1,raf=0,last=performance.now();
let nextStrikeAt=0,strikeUntil=0,strikePath=null,strikeIntensity=0;
let sampleCanvas=null,sampleCtx=null,lastSampleAt=0,baselineLum=null,flashShield=0;
let exportWrapped=false,moonSprite=null,moonSpriteKey='';

function environmentState(){return window.SindhornEnvironment?.getState?.()||null}
function stormState(){
  const weather=environmentState()?.weather||{},visual=weather.visual||{};
  return{
    rain:clamp(Number(visual.rain)||0),
    storm:clamp(Number(visual.storm)||0),
    lightning:clamp(Number(visual.lightning)||0),
    wind:Number(weather.windSpeedKmh)||0,
    direction:Number(weather.windDirectionDeg)||180
  };
}
function rand(seed){const x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
function strikeDelay(intensity){const span=MAX_STRIKE_MS-MIN_STRIKE_MS;return MIN_STRIKE_MS+Math.random()*span*(1-intensity*.34)}
function skyY(altitude){return clamp(.12+clamp((Number(altitude)+2)/82,0,1)*.72,.08,.88)}
function daytimeMoonPoint(env,w,h){
  const lunar=env?.lunar;if(!lunar||Number(lunar.altitude)<=-2)return null;
  const az=Number(lunar.azimuth)*Math.PI/180,x=clamp(.5-Math.sin(az)*.42,.06,.94)*w,y=(1-skyY(lunar.altitude))*h,r=Math.max(7,h*.0205);
  return{x,y,r,phase:((Number(lunar.phase)||0)%1+1)%1,illumination:clamp(Number(lunar.illumination)||0),altitude:Number(lunar.altitude)};
}
function ensureCanvas(){
  if(canvas?.isConnected)return true;
  stage=document.getElementById('environmentStage');if(!stage)return false;
  canvas=document.createElement('canvas');canvas.id='stormEffectsCanvas';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'6',width:'100%',height:'100%',pointerEvents:'none',display:'block'});
  stage.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});if(!ctx){canvas.remove();canvas=null;return false}
  sampleCanvas=document.createElement('canvas');sampleCanvas.width=2;sampleCanvas.height=2;sampleCtx=sampleCanvas.getContext('2d',{alpha:true,willReadFrequently:true});
  resize();return true;
}
function resize(){
  if(!canvas||!stage||!ctx)return;const rect=stage.getBoundingClientRect();width=Math.max(1,Math.round(rect.width||innerWidth||1));height=Math.max(1,Math.round(rect.height||innerHeight||1));
  const dpr=Math.min(2,Math.max(1,devicePixelRatio||1));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
function drawSourceRegion(target,source,logicalW,logicalH,left,top,box,size){
  if(!source)return;const sx=source.width/Math.max(1,logicalW),sy=source.height/Math.max(1,logicalH);
  try{target.drawImage(source,left*sx,top*sy,box*sx,box*sy,0,0,size,size)}catch(_){ }
}
function buildMoonBackgroundPatch(logicalW,logicalH,x,y,r){
  const environment=document.getElementById('environmentCanvas');if(!environment)return null;
  const seasonal=document.getElementById('seasonalSkyCanvas');
  const box=Math.max(18,r*3.5),sampleOffset=(x<logicalW*.56?1:-1)*r*3.7,centerX=clamp(x+sampleOffset,box*.5,logicalW-box*.5),left=clamp(centerX-box*.5,0,Math.max(0,logicalW-box)),top=clamp(y-box*.5,0,Math.max(0,logicalH-box)),size=Math.max(32,Math.min(180,Math.round(box)));
  const patch=document.createElement('canvas');patch.width=size;patch.height=size;const pc=patch.getContext('2d',{alpha:true});if(!pc)return null;
  drawSourceRegion(pc,environment,logicalW,logicalH,left,top,box,size);drawSourceRegion(pc,seasonal,logicalW,logicalH,left,top,box,size);
  pc.globalCompositeOperation='destination-in';const mask=pc.createRadialGradient(size*.5,size*.5,size*.23,size*.5,size*.5,size*.5);mask.addColorStop(0,'rgba(255,255,255,1)');mask.addColorStop(.68,'rgba(255,255,255,.98)');mask.addColorStop(1,'rgba(255,255,255,0)');pc.fillStyle=mask;pc.fillRect(0,0,size,size);pc.globalCompositeOperation='source-over';
  return{canvas:patch,box};
}
function makeMoonSprite(phase,illumination,visibility,solarAltitude){
  const key=[phase.toFixed(3),illumination.toFixed(3),visibility.toFixed(2),solarAltitude>0?'day':'night'].join('|');if(moonSprite&&moonSpriteKey===key)return moonSprite;
  const size=112,s=document.createElement('canvas');s.width=size;s.height=size;const c=s.getContext('2d');if(!c)return null;const image=c.createImageData(size,size),data=image.data,theta=phase*Math.PI*2,lx=Math.sin(theta),lz=-Math.cos(theta),day=solarAltitude>0;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
    const nx=(px+.5-size*.5)/(size*.46),ny=(py+.5-size*.5)/(size*.46),rr=nx*nx+ny*ny;if(rr>=1)continue;
    const z=Math.sqrt(Math.max(0,1-rr)),dot=nx*lx+z*lz,lit=smooth((dot+.055)/.12),edge=smooth((1-Math.sqrt(rr))/.055),limb=Math.pow(z,.24),earth=(day?.008:.035)*(1-lit),brightness=(.18+.82*limb),alpha=edge*visibility*(earth+lit*(.74+.18*illumination));
    const maria=.94+.06*Math.sin(nx*13+ny*9)*Math.sin(nx*5-ny*11),base=brightness*maria;
    const i=(py*size+px)*4;data[i]=Math.round(226+18*base);data[i+1]=Math.round(233+15*base);data[i+2]=Math.round(239+13*base);data[i+3]=Math.round(255*clamp(alpha));
  }
  c.putImageData(image,0,0);moonSprite=s;moonSpriteKey=key;return s;
}
function drawDayMoonRepair(target,w,h,env,source,sourceW=w,sourceH=h){
  const moon=daytimeMoonPoint(env,w,h);if(!moon)return false;
  const visual=env?.weather?.visual||{},cloud=clamp(Number(visual.cloud||env?.weather?.cloudCover||0)),storm=clamp(Number(visual.storm||0)),fog=clamp(Number(visual.fog||0)),visibility=clamp((1-cloud*.82)*(1-storm*.78)*(1-fog*.82));
  const patch=buildMoonBackgroundPatch(sourceW,sourceH,moon.x,moon.y,moon.r);if(patch){target.save();target.drawImage(patch.canvas,moon.x-patch.box*.5,moon.y-patch.box*.5,patch.box,patch.box);target.restore()}
  if(visibility<.025)return true;
  const halo=target.createRadialGradient(moon.x,moon.y,moon.r*.25,moon.x,moon.y,moon.r*2.25),haloAlpha=visibility*(.018+.065*moon.illumination)*(Number(env?.solar?.altitude)>0?.56:1);
  halo.addColorStop(0,`rgba(226,238,248,${haloAlpha.toFixed(3)})`);halo.addColorStop(.42,`rgba(205,224,244,${(haloAlpha*.48).toFixed(3)})`);halo.addColorStop(1,'rgba(190,214,242,0)');target.save();target.fillStyle=halo;target.beginPath();target.arc(moon.x,moon.y,moon.r*2.25,0,Math.PI*2);target.fill();
  const sprite=makeMoonSprite(moon.phase,moon.illumination,visibility,Number(env?.solar?.altitude)||0);if(sprite)target.drawImage(sprite,moon.x-moon.r,moon.y-moon.r,moon.r*2,moon.r*2);target.restore();return true;
}
function sampleUnderlying(now,storm){
  if(!sampleCtx||storm<.08||now-lastSampleAt<SAMPLE_INTERVAL_MS)return;lastSampleAt=now;
  const source=document.getElementById('environmentCanvas');if(!source)return;
  try{
    sampleCtx.clearRect(0,0,2,2);sampleCtx.drawImage(source,0,0,2,2);const p=sampleCtx.getImageData(0,0,2,2).data;let lum=0;
    for(let i=0;i<p.length;i+=4)lum+=(p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722)/255;lum/=4;
    if(baselineLum===null)baselineLum=lum;
    const spike=lum-baselineLum;
    if(spike>.045)flashShield=Math.max(flashShield,clamp((spike-.035)*2.2,0,.26));
    else baselineLum=baselineLum*.965+lum*.035;
  }catch(_){ }
}
function drawCloudMasses(target,w,h,rain,storm,time){
  const cover=clamp(rain*.42+storm*.74);if(cover<.02)return;
  target.save();target.globalCompositeOperation='source-over';
  const drift=time*.000008*(1+storm*.65);
  for(let i=0;i<8;i++){
    const x=((rand(i*11+4)+drift*(i%2?1:-1))%1+1)%1*w;
    const y=(.05+rand(i*13+7)*.46)*h;
    const rx=(.22+rand(i*17+3)*.30)*w,ry=(.08+rand(i*19+5)*.13)*h;
    target.save();target.translate(x,y);target.scale(rx,ry);
    const g=target.createRadialGradient(0,0,0,0,0,1);
    const a=(.035+cover*.072)*(0.72+rand(i*23+9)*.45);
    g.addColorStop(0,`rgba(25,39,53,${a.toFixed(3)})`);g.addColorStop(.58,`rgba(42,57,70,${(a*.72).toFixed(3)})`);g.addColorStop(1,'rgba(52,67,80,0)');
    target.fillStyle=g;target.beginPath();target.arc(0,0,1,0,Math.PI*2);target.fill();target.restore();
  }
  target.restore();
}
function drawWetAtmosphere(target,w,h,state,time,extraShade=0){
  const {rain,storm}=state;if(rain<.03&&storm<.03)return;
  const shade=clamp(.035+rain*.11+storm*.20+extraShade,0,.46);
  target.save();target.fillStyle=`rgba(15,27,40,${shade.toFixed(3)})`;target.fillRect(0,0,w,h);
  drawCloudMasses(target,w,h,rain,storm,time);
  const haze=target.createLinearGradient(0,0,0,h);
  haze.addColorStop(0,`rgba(78,101,119,${(.025+storm*.028).toFixed(3)})`);
  haze.addColorStop(.55,`rgba(100,119,131,${(.035+rain*.045+storm*.025).toFixed(3)})`);
  haze.addColorStop(1,`rgba(112,126,134,${(.055+rain*.065+storm*.035).toFixed(3)})`);
  target.fillStyle=haze;target.fillRect(0,0,w,h);target.restore();
}
function makeStrike(){
  const startX=.18+Math.random()*.64,endY=.44+Math.random()*.30,points=[{x:startX,y:-.02}];let x=startX;
  const segments=9+Math.floor(Math.random()*5);
  for(let i=1;i<=segments;i++){const t=i/segments;x+=(Math.random()-.5)*(.10-i*.003);points.push({x:clamp(x,.08,.92),y:endY*t})}
  strikePath=points;strikeUntil=performance.now()+150;strikeIntensity=.72+Math.random()*.28;
}
function drawStrike(target,w,h,now){
  if(!strikePath||now>strikeUntil)return;
  const life=clamp((strikeUntil-now)/150),alpha=strikeIntensity*Math.sin(life*Math.PI*.72);
  target.save();target.lineCap='round';target.lineJoin='round';target.beginPath();
  strikePath.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?target.lineTo(x,y):target.moveTo(x,y)});
  target.strokeStyle=`rgba(188,220,245,${(.18*alpha).toFixed(3)})`;target.lineWidth=5;target.stroke();
  target.strokeStyle=`rgba(238,248,255,${(.80*alpha).toFixed(3)})`;target.lineWidth=1.15;target.stroke();
  if(strikePath.length>5){const p=strikePath[Math.floor(strikePath.length*.56)];target.beginPath();target.moveTo(p.x*w,p.y*h);target.lineTo((p.x-.07)*w,(p.y+.10)*h);target.lineTo((p.x-.045)*w,(p.y+.18)*h);target.strokeStyle=`rgba(226,242,255,${(.42*alpha).toFixed(3)})`;target.lineWidth=.8;target.stroke()}
  target.restore();
}
function scheduleLightning(now,state){
  if(state.lightning<.08){nextStrikeAt=0;strikePath=null;strikeUntil=0;return}
  if(!nextStrikeAt)nextStrikeAt=now+strikeDelay(state.lightning);
  if(now>=nextStrikeAt){makeStrike();nextStrikeAt=now+strikeDelay(state.lightning)}
}
function frame(now){
  raf=requestAnimationFrame(frame);if(!ensureCanvas())return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  const state=stormState(),env=environmentState(),source=document.getElementById('environmentCanvas');sampleUnderlying(now,state.storm);flashShield=Math.max(0,flashShield-dt*.90);scheduleLightning(now,state);
  ctx.clearRect(0,0,width,height);const moonRepaired=drawDayMoonRepair(ctx,width,height,env,source,width,height);drawWetAtmosphere(ctx,width,height,state,now,flashShield);drawStrike(ctx,width,height,now);
  canvas.style.opacity=(moonRepaired||state.rain>.02||state.storm>.02||state.lightning>.02)?'1':'0';
}
function averageLuminance(target,w,h){
  try{const s=document.createElement('canvas'),sc=s.getContext('2d',{willReadFrequently:true});s.width=1;s.height=1;sc.drawImage(target,0,0,w,h,0,0,1,1);const p=sc.getImageData(0,0,1,1).data;return(p[0]*.2126+p[1]*.7152+p[2]*.0722)/255}catch(_){return.5}
}
function imageFromData(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data})}
function extendViewportAtmosphere(base,w,liveH,fullH){
  const out=document.createElement('canvas');out.width=Math.max(1,Math.round(w));out.height=Math.max(1,Math.round(fullH));const c=out.getContext('2d',{alpha:false});
  c.drawImage(base,0,0,w,liveH,0,0,w,liveH);
  if(fullH>liveH){const start=Math.max(0,Math.floor(liveH*.76)),slice=Math.max(1,liveH-start);c.drawImage(base,0,start,w,slice,0,start,w,fullH-start)}
  return out;
}
function wrapExport(){
  if(exportWrapped||!window.SindhornEnvironment?.renderExport)return false;exportWrapped=true;
  const original=window.SindhornEnvironment.renderExport.bind(window.SindhornEnvironment);
  window.SindhornEnvironment.renderExport=async(w,h)=>{
    const scale=w/Math.max(1,window.innerWidth),liveH=Math.max(1,Math.min(Math.round(h),Math.round(window.innerHeight*scale))),env=environmentState(),state=stormState();
    const data=await original(w,liveH),img=await imageFromData(data),base=document.createElement('canvas');base.width=Math.max(1,Math.round(w));base.height=liveH;const bc=base.getContext('2d',{alpha:false});bc.drawImage(img,0,0,base.width,base.height);
    drawDayMoonRepair(bc,base.width,base.height,env,base,base.width,base.height);
    const out=extendViewportAtmosphere(base,base.width,base.height,h),c=out.getContext('2d',{alpha:false});
    if(state.rain>=.03||state.storm>=.03){const lum=averageLuminance(out,out.width,out.height),extra=state.storm>.08?clamp((lum-.56)*.42,0,.12):0;drawWetAtmosphere(c,out.width,out.height,state,performance.now(),extra)}
    return out.toDataURL('image/png',1);
  };return true;
}
function waitForEnvironment(){if(wrapExport())return;const timer=setInterval(()=>{if(wrapExport())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),12000)}

window.addEventListener('resize',resize,{passive:true});document.addEventListener('sindhorn:route-mounted',resize);document.addEventListener('sindhorn:location-updated',()=>{baselineLum=null;flashShield=0;moonSpriteKey=''});
waitForEnvironment();raf=requestAnimationFrame(frame);
