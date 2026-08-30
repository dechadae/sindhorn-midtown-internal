import {loadSettingsAuthority,hasCapability} from './capabilities.js';

const UI_LIBRARY_CAPABILITY='developer.ui_library';
const FIXED_SECTIONS=Object.freeze([
  {key:'account',label:'Account'},
  {key:'people',label:'People'},
  {key:'comms',label:'Comms'},
  {key:'system',label:'System'}
]);
function ensureRail(route,current='account',available=new Set()){
  let rail=route.querySelector(':scope > .settings-section-rail');
  if(!rail){
    rail=document.createElement('nav');rail.className='settings-section-rail';rail.setAttribute('aria-label','Settings sections');
    const dialog=route.querySelector('dialog');route.insertBefore(rail,dialog||null);
  }
  const existing=new Map([...rail.querySelectorAll('[data-section]')].map(button=>[button.dataset.section,button]));
  FIXED_SECTIONS.forEach(item=>{
    let button=existing.get(item.key);
    if(!button){
      button=document.createElement('button');button.className='settings-nav-chip';button.type='button';button.dataset.section=item.key;button.textContent=item.label;
      button.dataset.settingsFixedSynthetic='true';
      button.dataset.settingsFixedAuthorized=String(available.has(item.key));
      rail.appendChild(button);existing.set(item.key,button);
    }
  });
  FIXED_SECTIONS.forEach(item=>rail.appendChild(existing.get(item.key)));
  [...rail.querySelectorAll('[data-section]')].forEach(button=>{
    const active=button.dataset.section===current;button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false');
  });
  return rail;
}
function setUrlSection(key){
  if(location.pathname!=='/settings'&&location.pathname!=='/account'&&location.pathname!=='/admin')return;
  const url=new URL(location.href);if(key==='account')url.searchParams.delete('section');else url.searchParams.set('section',key);
  history.replaceState({...history.state,route:'settings'},'',`${url.pathname}${url.search}${url.hash}`);
}
function setRailCurrent(rail,key){rail.querySelectorAll('[data-section]').forEach(button=>{const active=button.dataset.section===key;button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false')})}
function currentRailSection(rail){return rail.querySelector('[data-section][aria-current="page"]')?.dataset.section||'account'}
function dispatchSection(key,detail={}){document.dispatchEvent(new CustomEvent('sindhorn:settings-section-changed',{detail:{section:key,...detail}}))}
function injectUiLibrary(route,authority){
  if(!hasCapability(UI_LIBRARY_CAPABILITY,authority))return;
  const panel=route.querySelector('[data-settings-panel]'),section=panel?.querySelector('.settings-section');
  if(!section||route.querySelector('[data-system-ui-library]'))return;
  const card=document.createElement('a');card.href='/ci';card.dataset.appRoute='ci';card.dataset.systemUiLibrary='true';card.className='settings-planned settings-system-library-card';
  card.innerHTML='<p class="settings-planned-label">Developer</p><h2>UI Library</h2><p>Living corporate identity, UX components, implementation rules and new-page blueprint.</p><span>Open UI Library →</span>';
  section.appendChild(card);
}

export async function mountSettingsSystemLibrary(root){
  const route=root.querySelector('.settings-route');if(!route)return()=>{};
  const authority=await loadSettingsAuthority();
  const available=new Set((authority.sections||[]).map(section=>section.key));
  const requested=new URLSearchParams(location.search).get('section');
  const baseCurrent=route.querySelector('.settings-section-rail [aria-current="page"]')?.dataset.section||'account';
  const current=FIXED_SECTIONS.some(item=>item.key===requested)?requested:baseCurrent;
  const panel=route.querySelector('[data-settings-panel]');
  const cachedPanels=new Map();
  if(panel?.firstElementChild)cachedPanels.set(baseCurrent,panel.firstElementChild);
  const rail=ensureRail(route,current,available);
  document.body.dataset.settingsContext='true';
  const cleanup=[];const on=(node,event,handler,options)=>{node?.addEventListener(event,handler,options);cleanup.push(()=>node?.removeEventListener(event,handler,options))};

  const cacheVisiblePanel=()=>{
    if(!panel?.firstElementChild)return;
    const key=currentRailSection(rail);
    if(available.has(key))cachedPanels.set(key,panel.firstElementChild);
  };
  const renderSynthetic=key=>{
    cacheVisiblePanel();setRailCurrent(rail,key);
    const authorized=available.has(key),cached=cachedPanels.get(key);
    if(authorized&&cached)panel.replaceChildren(cached);else panel.replaceChildren();
    setUrlSection(key);dispatchSection(key,{empty:!authorized,synthetic:true});
  };

  rail.querySelectorAll('[data-settings-fixed-synthetic="true"]').forEach(button=>on(button,'click',()=>renderSynthetic(button.dataset.section)));
  const sync=event=>{
    const key=event.detail?.section||'account';setRailCurrent(rail,key);
    if(key==='system')requestAnimationFrame(()=>injectUiLibrary(route,authority));
  };
  document.addEventListener('sindhorn:settings-section-changed',sync);cleanup.push(()=>document.removeEventListener('sindhorn:settings-section-changed',sync));

  if(requested&&!available.has(requested)&&FIXED_SECTIONS.some(item=>item.key===requested)){
    cacheVisiblePanel();setRailCurrent(rail,requested);panel.replaceChildren();dispatchSection(requested,{empty:true,synthetic:true});
  }else if(current==='system')injectUiLibrary(route,authority);

  document.dispatchEvent(new CustomEvent('sindhorn:settings-fixed-rail-ready',{detail:{sections:FIXED_SECTIONS.map(item=>item.key)}}));
  window.SindhornFooterGuard?.normalize?.();
  return()=>cleanup.splice(0).forEach(fn=>fn());
}
