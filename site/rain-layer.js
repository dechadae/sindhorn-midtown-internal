const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const SHOWER_CODES=new Set([80,81,82]);
const STORM_CODES=new Set([95,96,99]);
const MAX_DROPS=190;
const DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));
let stage=null,canvas=null,ctx=null,width=1,height=1,raf=0,last=performance.now(),targetIntensity=0,currentIntensity=0,pageVisible=!document.hidden;

function seeded(index){
  const x=Math.sin((index+1)*12.9898+78.233)*43758.5453;
  return x-Math.floor(x);
}

const drops=Array.from({length:MAX_DROPS},(_,i)=>({
  x:seeded(i*7+1),
  y:seeded(i*7+2),
  speed:.48+seeded(i*7+3)*.72,
  length:.55+seeded(i*7+4)*.85,
  alpha:.38+seeded(i*7+5)*.52,
  slant:.035+seeded(i*7+6)*.045,
  phase:seeded(i*7+7)
}));

function rainIntensity(){
  const weather=window.SindhornEnvironment?.getState?.()?.weather;
  if(!weather?.known)return 0;
  const code=Number(weather.weatherCode),mm=Math.max(0,Number(weather.precipitationMm)||0);
  if(!RAIN_CODES.has(code)&&mm<.08)return 0;
  if(STORM_CODES.has(code))return Math.min(1,.78+mm*.08);
  if(SHOWER_CODES.has(code))return Math.min(.86,.52+mm*.10);
  if(DRIZZLE_CODES.has(code))return Math.min(.38,.18+mm*.06);
  return Math.min(.72,.36+mm*.09);
}

function resize(){
  if(!stage||!canvas||!ctx)return;
  const rect=stage.getBoundingClientRect();
  width=Math.max(1,Math.round(rect.width));
  height=Math.max(1,Math.round(rect.height));
  canvas.width=Math.max(1,Math.round(width*DPR));
  canvas.height=Math.max(1,Math.round(height*DPR));
  canvas.style.width=width+'px';
  canvas.style.height=height+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

function drawDrop(drop,index,dt,intensity){
  const speedPx=(540+drop.speed*520)*(0.62+intensity*.72);
  const lengthPx=(13+drop.length*24)*(0.82+intensity*.36);
  drop.y+=speedPx*dt/Math.max(1,height);
  drop.x+=drop.slant*speedPx*dt/Math.max(1,width);
  if(drop.y>1.08){
    drop.y=-.08-drop.phase*.18;
    drop.x=(drop.x+.173+drop.phase*.417)%1;
  }
  if(drop.x>1.06)drop.x-=1.12;
  const x=drop.x*width,y=drop.y*height;
  const drift=lengthPx*(.14+drop.slant*1.9);
  const alpha=(.055+.11*drop.alpha)*intensity;
  ctx.strokeStyle=`rgba(228,238,246,${alpha.toFixed(4)})`;
  ctx.lineWidth=.55+intensity*.32;
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.lineTo(x-drift,y+lengthPx);
  ctx.stroke();
  if(intensity>.55&&index%5===0){
    ctx.strokeStyle=`rgba(240,246,250,${(alpha*.42).toFixed(4)})`;
    ctx.lineWidth=.42;
    ctx.beginPath();
    ctx.moveTo(x+7,y-lengthPx*.35);
    ctx.lineTo(x+7-drift*.72,y+lengthPx*.42);
    ctx.stroke();
  }
}

function frame(now){
  raf=0;
  if(!pageVisible)return;
  const dt=Math.min(.04,Math.max(0,(now-last)/1000));
  last=now;
  targetIntensity=rainIntensity();
  const response=targetIntensity>currentIntensity?Math.min(1,dt*3.2):Math.min(1,dt*1.8);
  currentIntensity+=(targetIntensity-currentIntensity)*response;
  ctx.clearRect(0,0,width,height);
  if(currentIntensity>.006){
    const active=Math.round(34+currentIntensity*(MAX_DROPS-34));
    ctx.lineCap='round';
    for(let i=0;i<active;i++)drawDrop(drops[i],i,dt,currentIntensity);
  }
  raf=requestAnimationFrame(frame);
}

function start(){
  if(!ctx||raf||!pageVisible)return;
  last=performance.now();
  raf=requestAnimationFrame(frame);
}

function init(){
  stage=document.getElementById('environmentStage');
  if(!stage||document.getElementById('rainCanvas'))return;
  canvas=document.createElement('canvas');
  canvas.id='rainCanvas';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.position='absolute';
  canvas.style.inset='0';
  canvas.style.zIndex='3';
  canvas.style.pointerEvents='none';
  canvas.style.display='block';
  canvas.style.transform='translateZ(0)';
  stage.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx){canvas.remove();return;}
  resize();
  new ResizeObserver(resize).observe(stage);
  document.addEventListener('visibilitychange',()=>{
    pageVisible=!document.hidden;
    if(pageVisible)start();
    else if(raf){cancelAnimationFrame(raf);raf=0;}
  });
  document.addEventListener('sindhorn:environment-config',()=>{targetIntensity=rainIntensity();});
  document.addEventListener('sindhorn:pack-updated',()=>{targetIntensity=rainIntensity();});
  window.addEventListener('resize',resize,{passive:true});
  start();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
