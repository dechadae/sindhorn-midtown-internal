const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const main=document.querySelector('[data-lab-main]');
const scan=document.querySelector('[data-scan]');
const replayButton=document.querySelector('[data-replay]');
const refreshButton=document.querySelector('[data-refresh]');
const progressLine=document.querySelector('[data-progress-line]');
const sections=[...document.querySelectorAll('[data-section]')];
const metricNodes=[...document.querySelectorAll('[data-metric]')];
let refreshCycle=0;

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease=t=>1-Math.pow(1-t,3);
const formatters={
  'money-compact':v=>{const n=Math.round(v),a=Math.abs(n);if(a>=1e6)return`฿${(n/1e6).toFixed(a>=1e7?1:2).replace(/\.0+$/,'')}M`;if(a>=1e3)return`฿${Math.round(n/1000)}K`;return`฿${n.toLocaleString('en-US')}`},
  money:v=>`฿${Math.round(v).toLocaleString('en-US')}`,
  percent:v=>`${(v*100).toFixed(1)}%`,
  rn:v=>`${v>=0?'+':''}${Math.round(v)} RN`
};
function animateNumber(node,from,to,format,duration=720){
  if(reduce()){node.textContent=formatters[format](to);return}
  const start=performance.now(),formatter=formatters[format]||String;
  node.closest('.lab-card')?.classList.add('is-flipping');
  const frame=now=>{const t=clamp((now-start)/duration),v=from+(to-from)*ease(t);node.textContent=formatter(v);if(t<1)requestAnimationFrame(frame);else{node.textContent=formatter(to);setTimeout(()=>node.closest('.lab-card')?.classList.remove('is-flipping'),80)}};
  requestAnimationFrame(frame);
}
function animateInitialMetrics(){
  metricNodes.forEach((card,index)=>{
    const node=card.querySelector('[data-rolling]'),to=Number(card.dataset.value),format=card.dataset.format;
    if(!node||!Number.isFinite(to))return;
    const from=format==='percent'?Math.max(0,to-.18):format==='rn'?0:to*.72;
    setTimeout(()=>animateNumber(node,from,to,format,640),160+index*58);
  });
}
function replay(){
  document.querySelector('.lab-enter')?.classList.remove('is-entered');
  sections.forEach(section=>{section.classList.remove('is-active','is-distant');section.querySelectorAll('.lab-track i').forEach(track=>{track.style.animation='none';void track.offsetWidth;track.style.removeProperty('animation')})});
  void document.body.offsetWidth;
  requestAnimationFrame(()=>{document.querySelector('.lab-enter')?.classList.add('is-entered');animateInitialMetrics();updateSectionFocus()});
}
function signalFreshData(){
  if(scan?.classList.contains('is-running'))return;
  refreshCycle++;
  scan?.classList.add('is-running');
  refreshButton.disabled=true;
  const variants={revenue:[438900,421300],mtd:[9870000,9950000],occupancy:[.874,.852],adr:[5890,5760],revpar:[5148,4907],pickup:[34,21]};
  metricNodes.forEach((card,index)=>{
    const key=card.dataset.metric,current=Number(card.dataset.value),choices=variants[key];if(!choices)return;
    const next=choices[(refreshCycle-1)%choices.length],node=card.querySelector('[data-rolling]');
    setTimeout(()=>{animateNumber(node,current,next,card.dataset.format,560);card.dataset.value=String(next)},320+index*92);
  });
  document.querySelectorAll('.lab-flag').forEach((flag,index)=>setTimeout(()=>{flag.classList.remove('is-signaling');void flag.offsetWidth;flag.classList.add('is-signaling')},580+index*80));
  const stamp=document.querySelector('[data-update-stamp]');
  setTimeout(()=>{stamp?.classList.remove('is-fresh');void stamp?.offsetWidth;stamp?.classList.add('is-fresh');const toast=document.createElement('div');toast.className='lab-dopamine';toast.textContent='Fresh hotel pulse';document.body.append(toast);setTimeout(()=>toast.remove(),950)},1060);
  setTimeout(()=>{scan?.classList.remove('is-running');refreshButton.disabled=false},1500);
}
function updateProgress(){
  if(!main||!progressLine)return;
  const start=main.offsetTop,range=Math.max(1,main.scrollHeight-innerHeight*.7),p=clamp((scrollY-start+innerHeight*.24)/range);
  progressLine.style.transform=`scaleY(${p})`;
}
function updateSectionFocus(){
  const center=innerHeight*.48;
  let best=null,bestDistance=Infinity;
  for(const section of sections){
    const r=section.getBoundingClientRect(),sectionCenter=r.top+Math.min(r.height,innerHeight)*.34,d=Math.abs(sectionCenter-center);
    if(r.bottom>90&&r.top<innerHeight&&d<bestDistance){best=section;bestDistance=d}
  }
  for(const section of sections){const active=section===best;section.classList.toggle('is-active',active);section.classList.toggle('is-distant',!active&&section.getBoundingClientRect().top<innerHeight*.92)}
  document.querySelectorAll('[data-progress-node]').forEach(node=>node.classList.toggle('is-active',node.dataset.progressNode===best?.dataset.section));
}
let scrollRaf=0;
function onScroll(){if(scrollRaf)return;scrollRaf=requestAnimationFrame(()=>{scrollRaf=0;updateProgress();updateSectionFocus();updateOutlook()})}
function setupTilt(){
  if(reduce()||!matchMedia('(pointer:fine)').matches)return;
  document.querySelectorAll('[data-tilt]').forEach(card=>{
    card.addEventListener('pointermove',event=>{const r=card.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height,rx=(.5-y)*3.2,ry=(x-.5)*3.6;card.style.transform=`perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;card.style.setProperty('--shine-x',`${x*100}%`);card.style.setProperty('--shine-y',`${y*100}%`);card.style.setProperty('--shine-opacity','.9')});
    card.addEventListener('pointerleave',()=>{card.style.removeProperty('transform');card.style.setProperty('--shine-opacity','0')});
  });
}
function setupTouchPhysics(){
  document.addEventListener('pointerdown',event=>{const card=event.target.closest?.('.lab-card');if(card&&event.pointerType!=='mouse')card.classList.add('is-touching')},{passive:true});
  const clear=()=>document.querySelectorAll('.lab-card.is-touching').forEach(card=>card.classList.remove('is-touching'));
  addEventListener('pointerup',clear,{passive:true});addEventListener('pointercancel',clear,{passive:true});
}
function setupDisclosures(){
  document.querySelectorAll('.lab-disclosure button').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('.lab-disclosure'),open=!card.classList.contains('is-open');document.querySelectorAll('.lab-disclosure.is-open').forEach(other=>{if(other!==card){other.classList.remove('is-open');other.querySelector('button')?.setAttribute('aria-expanded','false')}});card.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));if(open&&!reduce())card.animate([{transform:'translateY(1px) scale(.995)'},{transform:'translateY(-4px) scale(1.006)',offset:.55},{transform:'translateY(-3px) scale(1)}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'})}));
}
function updateOutlook(){
  const strip=document.querySelector('[data-outlook]');if(!strip)return;const center=innerWidth/2;
  strip.querySelectorAll('.lab-outlook-card').forEach(card=>{const r=card.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-center),n=clamp(1-d/(innerWidth*.82)),scale=.93+n*.07,opacity=.56+n*.44;card.style.setProperty('--card-scale',scale.toFixed(3));card.style.setProperty('--card-opacity',opacity.toFixed(3))});
}
function setupOutlook(){const strip=document.querySelector('[data-outlook]');strip?.addEventListener('scroll',()=>requestAnimationFrame(updateOutlook),{passive:true});updateOutlook()}
async function startBetta(){
  try{const betta=await import('/betta-runtime.js?v=1');await betta.initEnvironment?.();document.body.dataset.labBetta='ready'}catch(error){console.warn('Today Motion Lab Betta unavailable',error);document.body.dataset.labBetta='fallback';document.getElementById('environmentStage')?.removeAttribute('hidden')}
}
replayButton?.addEventListener('click',replay);
refreshButton?.addEventListener('click',signalFreshData);
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll,{passive:true});
setupTilt();setupTouchPhysics();setupDisclosures();setupOutlook();
startBetta();
requestAnimationFrame(()=>{document.querySelector('.lab-enter')?.classList.add('is-entered');updateProgress();updateSectionFocus();animateInitialMetrics()});