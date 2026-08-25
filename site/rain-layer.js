const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const SHOWER_CODES=new Set([80,81,82]);
const STORM_CODES=new Set([95,96,99]);
const MAX_DROPS=190;
const MAX_PANE_DROPS=46;
const DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));
let stage=null,canvas=null,ctx=null,paneCanvas=null,paneCtx=null,width=1,height=1,raf=0,last=performance.now(),targetIntensity=0,currentIntensity=0,pageVisible=!document.hidden;

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

const paneDrops=Array.from({length:MAX_PANE_DROPS},(_,i)=>({
  x:.03+seeded(i*11+1)*.94,
  y:-.15+seeded(i*11+2)*1.18,
  radius:2.2+seeded(i*11+3)*5.6,
  speed:10+seeded(i*11+4)*54,
  trail:10+seeded(i*11+5)*66,
  wobble:.25+seeded(i*11+6)*1.25,
  phase:seeded(i*11+7)*Math.PI*2,
  alpha:.34+seeded(i*11+8)*.54,
  linger:.45+seeded(i*11+9)*1.9,
  delay:seeded(i*11+10)*1.4,
  drift:(seeded(i*11+11)-.5)*.7
}));

function paneEnabled(){return window.__sindhornRainPaneEnabled!==false}

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

function resizeCanvas(target,targetCtx){
  if(!target||!targetCtx)return;
  target.width=Math.max(1,Math.round(width*DPR));
  target.height=Math.max(1,Math.round(height*DPR));
  target.style.width=width+'px';
  target.style.height=height+'px';
  targetCtx.setTransform(DPR,0,0,DPR,0,0);
}

function resize(){
  if(!stage)return;
  const rect=stage.getBoundingClientRect();
  width=Math.max(1,Math.round(rect.width));
  height=Math.max(1,Math.round(rect.height));
  resizeCanvas(canvas,ctx);
  resizeCanvas(paneCanvas,paneCtx);
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

function resetPaneDrop(drop,index){
  drop.y=-.04-seeded(index*23+9)*.24;
  drop.x=.03+((drop.x+.217+seeded(index*23+11)*.41)%1)*.94;
  drop.delay=seeded(index*23+13)*1.2;
}

function drawPaneDrop(drop,index,dt,intensity,time){
  if(drop.delay>0){drop.delay-=dt;return;}
  const activity=.30+intensity*.96;
  const pause=Math.sin(time*.35+drop.phase)>.72+drop.linger*.08?.18:1;
  const speed=drop.speed*activity*pause;
  drop.y+=speed*dt/Math.max(1,height);
  drop.x+=Math.sin(time*.58*drop.wobble+drop.phase)*drop.drift*dt/Math.max(1,width);
  if(drop.y>1.06){resetPaneDrop(drop,index);return;}

  const x=drop.x*width,y=drop.y*height;
  const r=drop.radius*(.78+intensity*.34);
  const alpha=(.035+.105*drop.alpha)*Math.pow(intensity,.72);
  const trailLength=drop.trail*(.45+intensity*.72)*(pause<1?.5:1);

  if(trailLength>7){
    const gradient=paneCtx.createLinearGradient(x,y-trailLength,x,y+r);
    gradient.addColorStop(0,'rgba(235,243,248,0)');
    gradient.addColorStop(.58,`rgba(225,236,243,${(alpha*.20).toFixed(4)})`);
    gradient.addColorStop(1,`rgba(246,250,252,${(alpha*.38).toFixed(4)})`);
    paneCtx.strokeStyle=gradient;
    paneCtx.lineWidth=Math.max(.55,r*.18);
    paneCtx.lineCap='round';
    paneCtx.beginPath();
    paneCtx.moveTo(x+Math.sin(drop.phase)*r*.18,y-trailLength);
    paneCtx.quadraticCurveTo(x-r*.20,y-trailLength*.42,x,y-r*.55);
    paneCtx.stroke();
  }

  const shadow=paneCtx.createRadialGradient(x-r*.18,y-r*.10,r*.12,x,y,r*1.35);
  shadow.addColorStop(0,`rgba(255,255,255,${(alpha*.11).toFixed(4)})`);
  shadow.addColorStop(.52,`rgba(194,211,222,${(alpha*.07).toFixed(4)})`);
  shadow.addColorStop(.76,`rgba(18,29,40,${(alpha*.22).toFixed(4)})`);
  shadow.addColorStop(1,'rgba(18,29,40,0)');
  paneCtx.fillStyle=shadow;
  paneCtx.beginPath();
  paneCtx.ellipse(x,y,r*.72,r,0,0,Math.PI*2);
  paneCtx.fill();

  paneCtx.strokeStyle=`rgba(248,251,252,${(alpha*.56).toFixed(4)})`;
  paneCtx.lineWidth=Math.max(.45,r*.10);
  paneCtx.beginPath();
  paneCtx.arc(x-r*.14,y-r*.20,r*.42,Math.PI*1.02,Math.PI*1.62);
  paneCtx.stroke();

  paneCtx.strokeStyle=`rgba(20,31,41,${(alpha*.27).toFixed(4)})`;
  paneCtx.beginPath();
  paneCtx.arc(x+r*.08,y+r*.12,r*.52,-.18,1.16);
  paneCtx.stroke();
}

function frame(now){
  raf=0;
  if(!pageVisible)return;
  const dt=Math.min(.04,Math.max(0,(now-last)/1000));
  last=now;
  targetIntensity=rainIntensity();
  const response=targetIntensity>currentIntensity?Math.min(1,dt*2.5):Math.min(1,dt*.9);
  currentIntensity+=(targetIntensity-currentIntensity)*response;

  ctx.clearRect(0,0,width,height);
  paneCtx.clearRect(0,0,width,height);

  if(currentIntensity>.006){
    const active=Math.round(34+currentIntensity*(MAX_DROPS-34));
    ctx.lineCap='round';
    for(let i=0;i<active;i++)drawDrop(drops[i],i,dt,currentIntensity);

    if(paneEnabled()){
      const paneActive=Math.round(8+currentIntensity*(MAX_PANE_DROPS-8));
      for(let i=0;i<paneActive;i++)drawPaneDrop(paneDrops[i],i,dt,currentIntensity,now/1000);
    }
  }
  raf=requestAnimationFrame(frame);
}

function start(){
  if(!ctx||!paneCtx||raf||!pageVisible)return;
  last=performance.now();
  raf=requestAnimationFrame(frame);
}

function init(){
  stage=document.getElementById('environmentStage');
  if(!stage||document.getElementById('rainCanvas'))return;

  canvas=document.createElement('canvas');
  canvas.id='rainCanvas';
  canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'3',pointerEvents:'none',display:'block',transform:'translateZ(0)'});
  stage.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx){canvas.remove();return;}

  paneCanvas=document.createElement('canvas');
  paneCanvas.id='rainPaneCanvas';
  paneCanvas.setAttribute('aria-hidden','true');
  Object.assign(paneCanvas.style,{position:'fixed',inset:'0',zIndex:'240',pointerEvents:'none',display:'block',transform:'translateZ(0)'});
  document.body.appendChild(paneCanvas);
  paneCtx=paneCanvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!paneCtx){paneCanvas.remove();paneCanvas=null;return;}

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
