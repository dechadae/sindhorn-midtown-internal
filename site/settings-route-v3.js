import {mountSettingsRoute as mountBaseSettingsRoute} from './settings.js?v=2';

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

export async function mountSettingsRoute(root){
  await ensureStyle('link[data-settings-style]','/settings.css?v=2','data-settings-style');
  await ensureStyle('link[data-settings-refinements]','/settings-refinements.css?v=2','data-settings-refinements');
  return mountBaseSettingsRoute(root);
}
