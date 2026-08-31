window.__TODAY_PROGRESS_LAB_VERSION__='v4-raf';
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards=[...document.querySelectorAll('[data-progress-card]')];
const replay=document.querySelector('[data-replay]');
const animationTokens=new WeakMap();

function setCardProgress(card,{animate=true}={}){
  const value=Math.max(0,Math.min(1,Number(card.dataset.progress)||0));
  const fill=card.querySelector('.lab-progress i');
  if(!fill)return;
  const token=(animationTokens.get(fill)||0)+1;
  animationTokens.set(fill,token);
  if(reduce()||!animate){fill.style.transform=`scaleX(${value})`;return}
  const duration=920,start=performance.now(),ease=t=>1-Math.pow(1-t,3);
  fill.style.transform='scaleX(0)';
  const frame=now=>{
    if(animationTokens.get(fill)!==token)return;
    const t=Math.min(1,(now-start)/duration);
    fill.style.transform=`scaleX(${value*ease(t)})`;
    if(t<1)requestAnimationFrame(frame);
    else fill.style.transform=`scaleX(${value})`;
  };
  requestAnimationFrame(frame);
}

function replayProgress(){cards.forEach((card,index)=>setTimeout(()=>setCardProgress(card,{animate:true}),index*55))}

async function startBetta(){
  try{const betta=await import('/betta-runtime.js?v=1');await betta.initEnvironment?.();document.body.dataset.labBetta='ready'}
  catch(error){console.warn('Today Progress Lab Betta unavailable',error);document.body.dataset.labBetta='fallback';document.getElementById('environmentStage')?.removeAttribute('hidden')}
}

replay?.addEventListener('click',replayProgress);
startBetta();
requestAnimationFrame(replayProgress);
