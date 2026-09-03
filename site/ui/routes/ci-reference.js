const REFERENCE_STYLES=['/route-hero-standard.css?v=4','/app-controls.css?v=1','/app-shapes.css?v=1','/ci-specimen-fixes.css?v=2'];
const CI_DYNAMIC_STYLE_SELECTOR='link[data-ci-route-style],link[data-ci-fnb-style],link[data-ci-settings-style],link[data-ci-settings-dialog-style],link[data-ci-factsheet-style]';

async function loadStyle(href){
  return new Promise(resolve=>{
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;link.dataset.uiCiReference='true';
    link.addEventListener('load',()=>resolve(link),{once:true});
    link.addEventListener('error',()=>resolve(link),{once:true});
    document.head.appendChild(link);
  });
}

export async function mountCiReferenceRoute(host){
  const before=new Set(document.querySelectorAll(CI_DYNAMIC_STYLE_SELECTOR));
  const referenceLinks=await Promise.all(REFERENCE_STYLES.map(loadStyle));
  const {mountCiRoute}=await import('../../ci-day-cycle-route.js?v=1');
  const cleanup=await mountCiRoute(host);
  return()=>{
    cleanup?.();
    referenceLinks.forEach(link=>link.remove());
    document.querySelectorAll(CI_DYNAMIC_STYLE_SELECTOR).forEach(link=>{if(!before.has(link))link.remove()});
  };
}
