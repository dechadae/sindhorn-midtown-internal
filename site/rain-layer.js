const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const SHOWER_CODES=new Set([80,81,82]);
const STORM_CODES=new Set([95,96,99]);
const MAX_DROPS=190;
const MAX_PANE_DROPS=40;
const DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));
const SVG_NS='http://www.w3.org/2000/svg';
let stage=null,canvas=null,ctx=null,paneSvg=null,width=1,height=1,raf=0,last=performance.now(),targetIntensity=0,currentIntensity=0,pageVisible=!document.hidden;

function seeded(index){const x=Math.sin((index+1)*12.9898+78.233)*43758.5453;return x-Math.floor(x)}

const drops=Array.from({length:MAX_DROPS},(_,i)=>({
  x:seeded(i*7+1),y:seeded(i*7+2),speed:.48+seeded(i*7+3)*.72,length:.55+seeded(i*7+4)*.85,
  alpha:.38+seeded(i*7+5)*.52,slant:.035+seeded(i*7+6)*.045,phase:seeded(i*7+7)
}));

const paneDrops=Array.from({length:MAX_PANE_DROPS},(_,i)=>({
  x:.03+seeded(i*11+1)*.94,y:-.15+seeded(i*11+2)*1.18,radius:2.3+seeded(i*11+3)*5.2,
  speed:11+seeded(i*11+4)*50,trail:12+seeded(i*11+5)*60,wobble:.25+seeded(i*11+6)*1.1,
  phase:seeded(i*11+7)*Math.PI*2,alpha:.34+seeded(i*11+8)*.52,linger:.45+seeded(i*11+9)*1.7,
  delay:seeded(i*11+10)*1.3,drift:(seeded(i*11+11)-.5)*.7,node:null,trailNode:null,dropNode:null,highlightNode:null
}));

function paneEnabled(){return window.__sindhornRainPaneEnabled!==false}
function weatherState(){return window.SindhornEnvironment?.getState?.()?.weather||null}
function rainIntensity(){
  const weather=weatherState();if(!weather?.known)return 0;
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
  width=Math.max(1,Math.round(rect.width||window.innerWidth||1));
  height=Math.max(1,Math.round(rect.height||window.innerHeight||1));
  canvas.width=Math.max(1,Math.round(width*DPR));canvas.height=Math.max(1,Math.round(height*DPR));
  canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(DPR,0,0,DPR,0,0);
  if(paneSvg)paneSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);
}

function drawDrop(drop,index,dt,intensity){
  const speedPx=(520+drop.speed*500)*(0.62+intensity*.72),lengthPx=(12+drop.length*23)*(0.82+intensity*.36);
  drop.y+=speedPx*dt/Math.max(1,height);drop.x+=drop.slant*speedPx*dt/Math.max(1,width);
  if(drop.y>1.08){drop.y=-.08-drop.phase*.18;drop.x=(drop.x+.173+drop.phase*.417)%1}if(drop.x>1.06)drop.x-=1.12;
  const x=drop.x*width,y=drop.y*height,drift=lengthPx*(.14+drop.slant*1.9),alpha=(.045+.10*drop.alpha)*intensity;
  ctx.strokeStyle=`rgba(228,238,246,${alpha.toFixed(4)})`;ctx.lineWidth=.5+intensity*.28;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-drift,y+lengthPx);ctx.stroke();
  if(intensity>.58&&index%6===0){ctx.strokeStyle=`rgba(244,248,250,${(alpha*.35).toFixed(4)})`;ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(x+6,y-lengthPx*.30);ctx.lineTo(x+6-drift*.66,y+lengthPx*.35);ctx.stroke()}
}

function makeSvgNode(name,attrs={}){const n=document.createElementNS(SVG_NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n}
function buildPaneSvg(){
  paneSvg=makeSvgNode('svg',{id:'rainPaneSvg','aria-hidden':'true',preserveAspectRatio:'none'});
  Object.assign(paneSvg.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',zIndex:'240',pointerEvents:'none',overflow:'hidden',display:'block',opacity:'0',transition:'opacity .35s linear'});
  const defs=makeSvgNode('defs');
  const grad=makeSvgNode('linearGradient',{id:'rainTrailGradient',x1:'0',y1:'0',x2:'0',y2:'1'});
  grad.append(makeSvgNode('stop',{offset:'0%','stop-color':'#edf5fa','stop-opacity':'0'}),makeSvgNode('stop',{offset:'100%','stop-color':'#f8fbfc','stop-opacity':'.42'}));
  defs.appendChild(grad);paneSvg.appendChild(defs);
  paneDrops.forEach((drop,i)=>{
    const g=makeSvgNode('g',{'data-rain-drop':i});
    const trail=makeSvgNode('path',{fill:'none',stroke:'url(#rainTrailGradient)','stroke-linecap':'round'});
    const ellipse=makeSvgNode('ellipse',{cx:'0',cy:'0',fill:'rgba(185,205,218,.09)',stroke:'rgba(248,251,252,.38)'});
    const highlight=makeSvgNode('path',{fill:'none',stroke:'rgba(255,255,255,.52)','stroke-linecap':'round'});
    g.append(trail,ellipse,highlight);paneSvg.appendChild(g);drop.node=g;drop.trailNode=trail;drop.dropNode=ellipse;drop.highlightNode=highlight;
  });
  document.body.appendChild(paneSvg);
}

function resetPaneDrop(drop,index){drop.y=-.04-seeded(index*23+9)*.24;drop.x=.03+((drop.x+.217+seeded(index*23+11)*.41)%1)*.94;drop.delay=seeded(index*23+13)*1.2}
function updatePaneDrop(drop,index,dt,intensity,time){
  if(!drop.node)return;if(drop.delay>0){drop.delay-=dt;drop.node.style.opacity='0';return}
  const activity=.30+intensity*.96,pause=Math.sin(time*.35+drop.phase)>.72+drop.linger*.08?.18:1,speed=drop.speed*activity*pause;
  drop.y+=speed*dt/Math.max(1,height);drop.x+=Math.sin(time*.58*drop.wobble+drop.phase)*drop.drift*dt/Math.max(1,width);
  if(drop.y>1.06){resetPaneDrop(drop,index);drop.node.style.opacity='0';return}
  const x=drop.x*width,y=drop.y*height,r=drop.radius*(.78+intensity*.34),trail=drop.trail*(.45+intensity*.72)*(pause<1?.5:1),alpha=(.18+.54*drop.alpha)*Math.pow(intensity,.72);
  drop.node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);drop.node.style.opacity=String(Math.min(.72,alpha));
  drop.trailNode.setAttribute('d',`M 0 ${(-trail).toFixed(2)} Q ${(-r*.18).toFixed(2)} ${(-trail*.42).toFixed(2)} 0 ${(-r*.5).toFixed(2)}`);drop.trailNode.setAttribute('stroke-width',String(Math.max(.55,r*.18)));
  drop.dropNode.setAttribute('rx',String(r*.72));drop.dropNode.setAttribute('ry',String(r));drop.dropNode.setAttribute('stroke-width',String(Math.max(.42,r*.09)));
  drop.highlightNode.setAttribute('d',`M ${(-r*.28).toFixed(2)} ${(-r*.22).toFixed(2)} Q ${(-r*.12).toFixed(2)} ${(-r*.48).toFixed(2)} ${(r*.08).toFixed(2)} ${(-r*.36).toFixed(2)}`);drop.highlightNode.setAttribute('stroke-width',String(Math.max(.4,r*.08)));
}

function frame(now){
  raf=0;if(!pageVisible||!ctx)return;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;targetIntensity=rainIntensity();
  const response=targetIntensity>currentIntensity?Math.min(1,dt*2.5):Math.min(1,dt*.9);currentIntensity+=(targetIntensity-currentIntensity)*response;
  ctx.clearRect(0,0,width,height);
  if(currentIntensity>.006){const active=Math.round(30+currentIntensity*(MAX_DROPS-30));for(let i=0;i<active;i++)drawDrop(drops[i],i,dt,currentIntensity)}
  const showPane=paneEnabled()&&currentIntensity>.01;if(paneSvg)paneSvg.style.opacity=showPane?String(Math.min(1,currentIntensity*1.18)):'0';
  if(showPane){const paneActive=Math.round(6+currentIntensity*(MAX_PANE_DROPS-6));for(let i=0;i<paneDrops.length;i++){if(i<paneActive)updatePaneDrop(paneDrops[i],i,dt,currentIntensity,now/1000);else if(paneDrops[i].node)paneDrops[i].node.style.opacity='0'}}
  raf=requestAnimationFrame(frame);
}
function start(){if(!ctx||raf||!pageVisible)return;last=performance.now();raf=requestAnimationFrame(frame)}
function init(){
  stage=document.getElementById('environmentStage');if(!stage||document.getElementById('rainCanvas'))return;
  canvas=document.createElement('canvas');canvas.id='rainCanvas';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'3',pointerEvents:'none',display:'block',transform:'translateZ(0)'});stage.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true});if(!ctx){canvas.remove();return}buildPaneSvg();resize();
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;if(pageVisible)start();else if(raf){cancelAnimationFrame(raf);raf=0}});
  start();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
