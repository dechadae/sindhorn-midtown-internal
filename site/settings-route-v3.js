import {mountSettingsRoute as mountBaseSettingsRoute} from './settings.js?v=2';
import {loadSettingsAuthority} from './capabilities.js';

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

function createFact(key,label,value){
  const item=document.createElement('div');
  item.className='settings-fact';
  item.dataset.profileFact=key;
  const caption=document.createElement('span');
  caption.textContent=label;
  const detail=document.createElement('b');
  detail.textContent=value||'—';
  item.append(caption,detail);
  return item;
}

async function decorateEmployeeProfile(root){
  let profile;
  try{profile=(await loadSettingsAuthority())?.profile||{}}catch(_){return}
  if(!root.isConnected)return;

  const facts=root.querySelector('.settings-account-section .settings-facts');
  if(facts){
    facts.querySelectorAll('[data-profile-fact]').forEach(node=>node.remove());
    const position=createFact('position','Position',profile.positionTitle||'—');
    const department=createFact('department','Department',profile.departmentName||'—');
    const employeeId=facts.firstElementChild;
    if(employeeId)employeeId.after(position,department);else facts.append(position,department);
  }

  const id=String(profile.id||'');
  if(!id)return;
  const ownCard=[...root.querySelectorAll('.settings-user-card[data-user-id]')].find(card=>card.dataset.userId===id);
  const copy=ownCard?.querySelector('.settings-user-top>div');
  if(!copy)return;
  copy.querySelector('[data-profile-card-line]')?.remove();
  if(!profile.positionTitle&&!profile.departmentName)return;
  const line=document.createElement('p');
  line.dataset.profileCardLine='true';
  line.textContent=[profile.positionTitle,profile.departmentName].filter(Boolean).join(' · ');
  copy.querySelector('h3')?.after(line);
}

export async function mountSettingsRoute(root){
  await ensureStyle('link[data-settings-style]','/settings.css?v=2','data-settings-style');
  await ensureStyle('link[data-settings-refinements]','/settings-refinements.css?v=2','data-settings-refinements');
  const cleanupBase=await mountBaseSettingsRoute(root);
  let disposed=false;
  const refresh=()=>{if(!disposed)void decorateEmployeeProfile(root)};
  document.addEventListener('sindhorn:settings-section-changed',refresh);
  await decorateEmployeeProfile(root);
  return()=>{
    disposed=true;
    document.removeEventListener('sindhorn:settings-section-changed',refresh);
    cleanupBase?.();
  };
}
