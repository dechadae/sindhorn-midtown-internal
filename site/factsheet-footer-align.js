const SELECTOR='#app-footer [data-shell-context="factsheet"]';
let activeId=null;
let frame=0;

function reduceMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function align(control,{smooth=true}={}){
  const rail=control?.closest?.(SELECTOR);if(!rail)return;
  const inset=parseFloat(getComputedStyle(rail).paddingLeft)||0;
  const target=Math.max(0,control.offsetLeft-inset);
  rail.scrollTo({left:target,behavior:smooth&&!reduceMotion()?'smooth':'auto'});
}
function sync({smooth=true}={}){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    const rail=document.querySelector(SELECTOR),control=rail?.querySelector('[data-factsheet-section-nav][aria-current]');
    if(!rail||!control)return;
    const id=control.dataset.factsheetSectionNav||null;
    if(id===activeId&&smooth)return;
    activeId=id;align(control,{smooth});
  });
}
function onClick(event){
  const control=event.target.closest?.(`${SELECTOR} [data-factsheet-section-nav]`);if(!control)return;
  activeId=control.dataset.factsheetSectionNav||null;
  align(control,{smooth:true});
}

document.addEventListener('click',onClick);
document.addEventListener('sindhorn:route-mounted',()=>sync({smooth:false}));
const footer=document.getElementById('app-footer');
const observer=footer?new MutationObserver(mutations=>{
  if(mutations.some(mutation=>mutation.type==='childList'||mutation.type==='attributes'))sync({smooth:true});
}):null;
observer?.observe(footer,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-current']});
queueMicrotask(()=>sync({smooth:false}));
