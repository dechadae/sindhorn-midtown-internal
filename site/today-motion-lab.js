window.__TODAY_PROGRESS_LAB_VERSION__='v3-waapi';
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const cards=[...document.querySelectorAll('[data-progress-card]')];
const replay=document.querySelector('[data-replay]');

function setCardProgress(card,{animate=true}={}){
  const value=Math.max(0,Math.min(1,Number(card.dataset.progress)||0));
  const fill=card.querySelector('.lab-progress i');
  if(!fill)return;
  fill.getAnimations?.().forEach(animation=>animation.cancel());
  if(reduce()||!animate||typeof fill.animate!=='function'){
    fill.style.transform=`scaleX(${value})`;
    return;
  }
  fill.style.transform=`scaleX(${value})`;
  fill.animate(
    [{transform:'scaleX(0)'},{transform:`scaleX(${value})`}],
    {duration:920,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}
  );
}

function replayProgress(){cards.forEach((card,index)=>setTimeout(()=>setCardProgress(card,{animate:true}),index*55))}

async function startBetta(){
  try{const betta=await import('/betta-runtime.js?v=1');await betta.initEnvironment?.();document.body.dataset.labBetta='ready'}
  catch(error){console.warn('Today Progress Lab Betta unavailable',error);document.body.dataset.labBetta='fallback';document.getElementById('environmentStage')?.removeAttribute('hidden')}
}

replay?.addEventListener('click',replayProgress);
startBetta();
requestAnimationFrame(replayProgress);
