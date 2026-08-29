const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const DRIZZLE_CODES=new Set([51,53,55,56,57]);
const SHOWER_CODES=new Set([80,81,82]);
const STORM_CODES=new Set([95,96,99]);
const MAX_DROPS=190;
const MAX_PANE_DROPS=22;
const MAX_PANE_BEADS=54;
const DPR=Math.min(2,Math.max(1,window.devicePixelRatio||1));
const SVG_NS='http://www.w3.org/2000/svg';
let stage=null,canvas=null,ctx=null,paneSvg=null,width=1,height=1,raf=0,last=performance.now(),targetIntensity=0,currentIntensity=0,pageVisible=!document.hidden;
let idleProbe=0;

function seeded(index){const x=Math.sin((index+1)*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
function clamp(v,a=0,b=1){return Math.min(b,Math.max(a,v))}

const drops=Array.from({length:MAX_DROPS},(_,i)=>({
  x:seeded(i*7+1),y:seeded(i*7+2),speed:.48+seeded(i*7+3)*.72,length:.55+seeded(i*7+4)*.85,
  alpha:.38+seeded(i*7+5)*.52,slant:.035+seeded(i*7+6)*.045,phase:seeded(i*7+7)
}));

const paneDrops=Array.from({length:MAX_PANE_DROPS},(_,i)=>({
  x:.04+seeded(i*17+1)*.92,y:-.18+seeded(i*17+2)*1.28,
  radius:2.8+seeded(i*17+3)*4.8,aspect:.78+seeded(i*17+4)*.46,asym:(seeded(i*17+5)-.5)*.34,
  speed:7+seeded(i*17+6)*28,trail:16+seeded(i*17+7)*58,phase:seeded(i*17+8)*Math.PI*2,
  alpha:.24+seeded(i*17+9)*.28,drift:(seeded(i*17+10)-.5)*.35,
  hold:.4+seeded(i*17+11)*3.8,slideFor:.6+seeded(i*17+12)*2.2,slideLeft:0,
  rotation:(seeded(i*17+13)-.5)*8,growth:.88+seeded(i*17+14)*.26,delay:seeded(i*17+15)*1.8,
  node:null,trailNode:null,bodyNode:null,highlightNode:null,shadeNode:null
}));

const paneBeads=Array.from({length:MAX_PANE_BEADS},(_,i)=>({
  x:.018+seeded(i*13+1)*.964,y:.015+seeded(i*13+2)*.97,
  radius:.75+seeded(i*13+3)*2,aspect:.72+seeded(i*13+4)*.70,rotation:(seeded(i*13+5)-.5)*34,
  alpha:.07+seeded(i*13+6)*.14,phase:seeded(i*13+7)*Math.PI*2,node:null
}));

function paneEnabled(){return window.__sindhornRainPaneEnabled!==false}
function weatherState(){return window.SindhornEnvironment?.getState?.()?.weather||null}
function rainIntensity(){
  const weather=weatherState();if(!weather?.known)return 0;
  const code=Number(weather.weatherCode),mm=Math.max(0,Number(weather.precipitationMm)||0);
  if(!RAIN_CODES.has(code)&&mm<.08)return 0;
  if(STORM_CODES.has(code))return Math.min(1,.82+mm*.06);
  if(SHOWER_CODES.has(code))return Math.min(.90,.66+mm*.08);
  if(DRIZZLE_CODES.has(code))return Math.min(.32,.16+mm*.05);
  return Math.min(.82,.50+mm*.08);
}

function positionPaneBeads(){
  for(const bead of paneBeads){
    if(!bead.node)continue;
    bead.node.setAttribute('transform',`translate(${(bead.x*width).toFixed(2)} ${(bead.y*height).toFixed(2)}) rotate(${bead.rotation.toFixed(2)})`);
  }
}

function resize(){
  if(!stage||!canvas||!ctx)return;
  const rect=stage.getBoundingClientRect();
  width=Math.max(1,Math.round(rect.width||window.innerWidth||1));
  height=Math.max(1,Math.round(rect.height||window.innerHeight||1));
  canvas.width=Math.max(1,Math.round(width*DPR));canvas.height=Math.max(1,Math.round(height*DPR));
  canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(DPR,0,0,DPR,0,0);
  if(paneSvg)paneSvg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  positionPaneBeads();
}

function drawDrop(drop,index,dt,intensity){
  const speedPx=(560+drop.speed*520)*(0.68+intensity*.68),lengthPx=(16+drop.length*27)*(0.90+intensity*.32);
  drop.y+=speedPx*dt/Math.max(1,height);drop.x+=drop.slant*speedPx*dt/Math.max(1,width);
  if(drop.y>1.08){drop.y=-.08-drop.phase*.18;drop.x=(drop.x+.173+drop.phase*.417)%1}if(drop.x>1.06)drop.x-=1.12;
  const x=drop.x*width,y=drop.y*height,drift=lengthPx*(.14+drop.slant*1.9),alpha=(.075+.14*drop.alpha)*Math.pow(intensity,.72);
  ctx.strokeStyle=`rgba(235,244,250,${alpha.toFixed(4)})`;ctx.lineWidth=.58+intensity*.34;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-drift,y+lengthPx);ctx.stroke();
  if(intensity>.38&&index%11===0){ctx.strokeStyle=`rgba(247,250,252,${(alpha*.42).toFixed(4)})`;ctx.lineWidth=.50+intensity*.18;ctx.beginPath();ctx.moveTo(x+6,y-lengthPx*.30);ctx.lineTo(x+6-drift*.66,y+lengthPx*.35);ctx.stroke()}
}

function makeSvgNode(name,attrs={}){const n=document.createElementNS(SVG_NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n}
function dropPath(r,aspect,asym,stretch=1){
  const rx=r*aspect,ry=r*stretch,lean=asym*r;
  return `M ${(-rx*.08+lean).toFixed(2)} ${(-ry*1.05).toFixed(2)} C ${(rx*.52+lean).toFixed(2)} ${(-ry*.92).toFixed(2)} ${(rx*.82+lean*.35).toFixed(2)} ${(-ry*.28).toFixed(2)} ${(rx*.72).toFixed(2)} ${(ry*.30).toFixed(2)} C ${(rx*.62).toFixed(2)} ${(ry*.88).toFixed(2)} ${(rx*.20).toFixed(2)} ${(ry*1.08).toFixed(2)} ${(-rx*.10).toFixed(2)} ${(ry*1.02).toFixed(2)} C ${(-rx*.58).toFixed(2)} ${(ry*.92).toFixed(2)} ${(-rx*.80+lean*.22).toFixed(2)} ${(ry*.42).toFixed(2)} ${(-rx*.70+lean*.18).toFixed(2)} ${(-ry*.10).toFixed(2)} C ${(-rx*.62+lean*.26).toFixed(2)} ${(-ry*.62).toFixed(2)} ${(-rx*.34+lean*.60).toFixed(2)} ${(-ry*.98).toFixed(2)} ${(-rx*.08+lean).toFixed(2)} ${(-ry*1.05).toFixed(2)} Z`;
}

function buildPaneSvg(){
  paneSvg=makeSvgNode('svg',{id:'rainPaneSvg','aria-hidden':'true',preserveAspectRatio:'none'});
  Object.assign(paneSvg.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',zIndex:'240',pointerEvents:'none',overflow:'hidden',display:'block',opacity:'0',transition:'opacity .45s linear'});
  const defs=makeSvgNode('defs');
  const bodyGrad=makeSvgNode('radialGradient',{id:'rainDropBody',cx:'30%',cy:'20%',r:'78%',fx:'22%',fy:'14%'});
  bodyGrad.append(
    makeSvgNode('stop',{offset:'0%','stop-color':'#ffffff','stop-opacity':'.20'}),
    makeSvgNode('stop',{offset:'18%','stop-color':'#eef7fb','stop-opacity':'.075'}),
    makeSvgNode('stop',{offset:'58%','stop-color':'#d8e7ef','stop-opacity':'.020'}),
    makeSvgNode('stop',{offset:'82%','stop-color':'#617481','stop-opacity':'.075'}),
    makeSvgNode('stop',{offset:'100%','stop-color':'#13212b','stop-opacity':'.13'})
  );
  const beadGrad=makeSvgNode('radialGradient',{id:'rainBeadBody',cx:'34%',cy:'26%',r:'74%',fx:'26%',fy:'18%'});
  beadGrad.append(
    makeSvgNode('stop',{offset:'0%','stop-color':'#ffffff','stop-opacity':'.18'}),
    makeSvgNode('stop',{offset:'34%','stop-color':'#eef6fa','stop-opacity':'.045'}),
    makeSvgNode('stop',{offset:'78%','stop-color':'#71838f','stop-opacity':'.052'}),
    makeSvgNode('stop',{offset:'100%','stop-color':'#17242d','stop-opacity':'.09'})
  );
  const trailGrad=makeSvgNode('linearGradient',{id:'rainTrailGradient',x1:'0',y1:'0',x2:'0',y2:'1'});
  trailGrad.append(
    makeSvgNode('stop',{offset:'0%','stop-color':'#dfeaf0','stop-opacity':'0'}),
    makeSvgNode('stop',{offset:'72%','stop-color':'#e9f2f6','stop-opacity':'.06'}),
    makeSvgNode('stop',{offset:'100%','stop-color':'#f7fafb','stop-opacity':'.12'})
  );
  defs.append(bodyGrad,beadGrad,trailGrad);paneSvg.appendChild(defs);

  const beadLayer=makeSvgNode('g',{id:'rainPaneBeads'});paneSvg.appendChild(beadLayer);
  paneBeads.forEach((bead,i)=>{
    const p=makeSvgNode('path',{
      d:dropPath(bead.radius,bead.aspect,(seeded(i*19+4)-.5)*.22,.82+seeded(i*19+5)*.28),
      fill:'url(#rainBeadBody)',stroke:'none'
    });
    p.style.opacity=String(bead.alpha);beadLayer.appendChild(p);bead.node=p;
  });

  paneDrops.forEach((drop,i)=>{
    const g=makeSvgNode('g',{'data-rain-drop':i});
    const trail=makeSvgNode('path',{fill:'none',stroke:'url(#rainTrailGradient)','stroke-linecap':'round'});
    const shade=makeSvgNode('path',{fill:'none',stroke:'rgba(24,35,43,.11)','stroke-linecap':'round'});
    const body=makeSvgNode('path',{fill:'url(#rainDropBody)',stroke:'none'});
    const highlight=makeSvgNode('path',{fill:'none',stroke:'rgba(255,255,255,.24)','stroke-linecap':'round'});
    g.append(trail,shade,body,highlight);paneSvg.appendChild(g);
    drop.node=g;drop.trailNode=trail;drop.bodyNode=body;drop.highlightNode=highlight;drop.shadeNode=shade;
  });
  document.body.appendChild(paneSvg);
}

function resetPaneDrop(drop,index){
  drop.y=-.05-seeded(index*31+9)*.30;drop.x=.04+seeded(index*31+11)*.92;drop.delay=seeded(index*31+13)*1.9;
  drop.hold=.6+seeded(index*31+15)*4.4;drop.slideFor=.55+seeded(index*31+17)*2.4;drop.slideLeft=0;
}

function updatePaneDrop(drop,index,dt,intensity,time){
  if(!drop.node)return;
  if(drop.delay>0){drop.delay-=dt;drop.node.style.opacity='0';return}
  if(drop.hold>0){drop.hold-=dt;drop.y+=dt*.35/Math.max(1,height)}
  else if(drop.slideLeft<=0){drop.slideLeft=drop.slideFor*(.72+seeded(index*37+Math.floor(time*.18))* .62)}

  const moving=drop.slideLeft>0;
  if(moving){
    const sizeAssist=.78+drop.radius/11;
    const speed=drop.speed*(.38+intensity*.88)*sizeAssist;
    drop.slideLeft-=dt;drop.y+=speed*dt/Math.max(1,height);
    drop.x+=Math.sin(time*.42+drop.phase)*drop.drift*dt/Math.max(1,width);
    if(drop.slideLeft<=0)drop.hold=.55+seeded(index*43+Math.floor(time*.12))*3.7;
  }
  if(drop.y>1.08){resetPaneDrop(drop,index);drop.node.style.opacity='0';return}

  const x=drop.x*width,y=drop.y*height;
  const speedStretch=moving?1.12+clamp(drop.radius/10)*.30:.94;
  const r=drop.radius*drop.growth*(.90+intensity*.13);
  const pulse=moving?1+Math.sin(time*.9+drop.phase)*.035:1;
  const stretch=speedStretch*pulse;
  const trail=moving?drop.trail*(.30+intensity*.45):0;
  const alpha=(.07+.20*drop.alpha)*Math.pow(intensity,.70);
  const rotation=drop.rotation+Math.sin(time*.21+drop.phase)*2.2;

  drop.node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotation.toFixed(2)})`);
  drop.node.style.opacity=String(Math.min(.32,alpha));
  drop.bodyNode.setAttribute('d',dropPath(r,drop.aspect,drop.asym,stretch));

  if(trail>4){
    const curve=drop.asym*r*.7;
    drop.trailNode.setAttribute('d',`M ${(-curve*.18).toFixed(2)} ${(-trail).toFixed(2)} C ${(curve*.12).toFixed(2)} ${(-trail*.72).toFixed(2)} ${(-curve*.36).toFixed(2)} ${(-trail*.30).toFixed(2)} 0 ${(-r*.72).toFixed(2)}`);
    drop.trailNode.setAttribute('stroke-width',String(Math.max(.42,r*.10)));
    drop.trailNode.style.opacity=String(Math.min(.24,.07+intensity*.17));
  }else drop.trailNode.style.opacity='0';

  drop.highlightNode.setAttribute('d',`M ${(-r*.25).toFixed(2)} ${(-r*.42*stretch).toFixed(2)} Q ${(-r*.08).toFixed(2)} ${(-r*.70*stretch).toFixed(2)} ${(r*.12).toFixed(2)} ${(-r*.58*stretch).toFixed(2)}`);
  drop.highlightNode.setAttribute('stroke-width',String(Math.max(.28,r*.05)));
  drop.shadeNode.setAttribute('d',`M ${(r*.34).toFixed(2)} ${(r*.18).toFixed(2)} Q ${(r*.45).toFixed(2)} ${(r*.58*stretch).toFixed(2)} ${(r*.12).toFixed(2)} ${(r*.80*stretch).toFixed(2)}`);
  drop.shadeNode.setAttribute('stroke-width',String(Math.max(.28,r*.045)));
}

function clearDryFrame(){
  ctx?.clearRect(0,0,width,height);if(paneSvg)paneSvg.style.opacity='0';
  for(const bead of paneBeads)if(bead.node)bead.node.style.opacity='0';
  for(const drop of paneDrops)if(drop.node)drop.node.style.opacity='0';
}
function scheduleUnknownWeatherProbe(){
  if(idleProbe||!pageVisible)return;
  idleProbe=window.setTimeout(()=>{idleProbe=0;start()},750);
}
function frame(now){
  raf=0;if(!pageVisible||!ctx)return;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;targetIntensity=rainIntensity();
  const response=targetIntensity>currentIntensity?Math.min(1,dt*2.8):Math.min(1,dt*.72);currentIntensity+=(targetIntensity-currentIntensity)*response;
  ctx.clearRect(0,0,width,height);
  if(currentIntensity>.006){const active=Math.round(44+Math.pow(currentIntensity,.82)*(MAX_DROPS-44));for(let i=0;i<active;i++)drawDrop(drops[i],i,dt,currentIntensity)}

  const showPane=paneEnabled()&&currentIntensity>.015;
  if(paneSvg)paneSvg.style.opacity=showPane?String(Math.min(.52,.14+currentIntensity*.35)):'0';
  if(showPane){
    const beadActive=Math.round(10+currentIntensity*(MAX_PANE_BEADS-10));
    for(let i=0;i<paneBeads.length;i++)if(paneBeads[i].node)paneBeads[i].node.style.opacity=i<beadActive?String(paneBeads[i].alpha*(.28+currentIntensity*.38)):'0';
    const paneActive=Math.round(2+currentIntensity*6);
    for(let i=0;i<paneDrops.length;i++){if(i<paneActive)updatePaneDrop(paneDrops[i],i,dt,currentIntensity,now/1000);else if(paneDrops[i].node)paneDrops[i].node.style.opacity='0'}
  }
  if(targetIntensity===0&&currentIntensity<.001){
    currentIntensity=0;clearDryFrame();
    if(!weatherState()?.known)scheduleUnknownWeatherProbe();
    return;
  }
  raf=requestAnimationFrame(frame);
}

function start(){if(!ctx||raf||!pageVisible)return;if(idleProbe){clearTimeout(idleProbe);idleProbe=0}last=performance.now();raf=requestAnimationFrame(frame)}
function init(){
  stage=document.getElementById('environmentStage');if(!stage||document.getElementById('rainCanvas'))return;
  canvas=document.createElement('canvas');canvas.id='rainCanvas';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'3',pointerEvents:'none',display:'block',transform:'translateZ(0)'});stage.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true});if(!ctx){canvas.remove();return}buildPaneSvg();resize();
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('sindhorn:weather-updated',start);
  document.addEventListener('sindhorn:rain-authority-updated',start);
  document.addEventListener('sindhorn:location-updated',start);
  document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;if(pageVisible)start();else{if(raf){cancelAnimationFrame(raf);raf=0}if(idleProbe){clearTimeout(idleProbe);idleProbe=0}}});
  start();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();