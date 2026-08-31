import {mountFnbRoute as mountBaseFnbRoute} from './fnb.js';

const STYLES=[
  ['link[data-fnb-style]','/fnb.css?v=2&ui=2','data-fnb-style'],
  ['link[data-fnb-approved-polish]','/fnb-approved-polish.css?v=2','data-fnb-approved-polish'],
  ['link[data-fnb-refinements]','/fnb-refinements.css?v=1','data-fnb-refinements'],
  ['link[data-fnb-layout-stability]','/fnb-layout-stability.css?v=1','data-fnb-layout-stability']
];

function ensureStyle(selector,href,attribute){
  const existing=document.querySelector(selector);
  if(existing)return existing.sheet?Promise.resolve():new Promise(resolve=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})});
  return new Promise(resolve=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.setAttribute(attribute,'true');
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',resolve,{once:true});
    document.head.appendChild(link);
  });
}

async function loadRouteHelpers(){
  const results=await Promise.allSettled([
    import('./fnb-timestamp-stability.js?v=1'),
    import('./fnb-share-ui.js?v=3')
  ]);
  for(const result of results)if(result.status==='rejected')console.warn('F&B route helper unavailable',result.reason);
}

export async function mountFnbRoute(root){
  await Promise.all(STYLES.map(args=>ensureStyle(...args)));
  await loadRouteHelpers();
  return mountBaseFnbRoute(root);
}
