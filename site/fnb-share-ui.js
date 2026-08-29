import {FNB_PROMOTIONS as DATA} from './fnb-data.js';

const SHARE_BASE='/share/fnb';
const SHARE_LABEL='Share';
const SHARE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 13v6h14v-6"/></svg>';
let observer=null;
let toastTimer=0;

function shareUrl(id=''){
  const suffix=id?`/${encodeURIComponent(id)}`:'';
  return new URL(`${SHARE_BASE}${suffix}`,location.origin).href;
}
function promotion(id){return DATA.find(item=>item.id===id)||null}
function button(kind,id=''){
  const title=kind==='page'?'F&B Promotions':promotion(id)?.title||'F&B Promotion';
  const el=document.createElement('button');
  el.type='button';
  el.className='fnb-action-control fnb-share-button';
  el.dataset.fnbShare=kind;
  if(id)el.dataset.promotionId=id;
  el.setAttribute('aria-label',kind==='page'?'Share F&B promotions':`Share ${title}`);
  el.innerHTML=`${SHARE_ICON}<span>${SHARE_LABEL}</span>`;
  return el
}
function route(){return document.querySelector('#route-view .fnb-route')}
function notify(message){
  const host=route();
  const existing=host?.querySelector('[data-toast]');
  if(existing){existing.textContent=message;existing.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(existing.isConnected)existing.hidden=true},1800);return}
  const live=document.getElementById('fnb-share-live')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'fnb-share-live'}));
  live.setAttribute('aria-live','polite');live.hidden=true;live.textContent=message
}
async function copyFallback(url){
  try{await navigator.clipboard.writeText(url);return true}catch(_){}
  const area=document.createElement('textarea');area.value=url;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}area.remove();return ok
}
async function performShare(kind,id=''){
  const item=id?promotion(id):null;
  const title=item?`${item.title} | Sindhorn Midtown`:'F&B Promotions | Sindhorn Midtown';
  const url=shareUrl(id);
  if(typeof navigator.share==='function'){
    try{await navigator.share({title,url});return}catch(error){if(error?.name==='AbortError')return}
  }
  const copied=await copyFallback(url);notify(copied?'Link copied':'Share link ready')
}
function enhance(){
  const host=route();if(!host)return;
  const hero=host.querySelector('.fnb-hero');
  if(hero&&!hero.querySelector('[data-fnb-share="page"]')){
    const eyebrow=hero.querySelector('.fnb-eyebrow');
    const utility=document.createElement('div');utility.className='fnb-hero-utility';
    if(eyebrow){hero.insertBefore(utility,eyebrow);utility.appendChild(eyebrow)}else hero.prepend(utility);
    utility.appendChild(button('page'))
  }
  host.querySelectorAll('.fnb-card').forEach(card=>{
    const opener=card.querySelector('[data-open]'),id=opener?.dataset.open;
    if(!id||card.querySelector('[data-fnb-share="promotion"]'))return;
    const actions=document.createElement('div');actions.className='fnb-card-actions';actions.appendChild(button('promotion',id));card.appendChild(actions)
  });
  const detail=host.querySelector('.fnb-detail:not([hidden])');
  const currentTitle=detail?.querySelector('.fnb-detail-title')?.textContent?.trim();
  const item=currentTitle?DATA.find(candidate=>candidate.title===currentTitle):null;
  const head=detail?.querySelector('.fnb-detail-head');
  if(head&&item&&!head.querySelector('[data-fnb-share="promotion"]')){
    const back=head.querySelector('.fnb-back');
    const utility=document.createElement('div');utility.className='fnb-detail-utility';
    head.prepend(utility);if(back)utility.appendChild(back);utility.appendChild(button('promotion',item.id))
  }
}
function start(){
  observer?.disconnect();observer=null;
  if(document.body.dataset.route!=='fnb')return;
  enhance();const host=route();if(!host)return;
  observer=new MutationObserver(()=>enhance());observer.observe(host,{childList:true,subtree:true})
}
document.addEventListener('click',event=>{
  const share=event.target.closest?.('[data-fnb-share]');if(!share)return;
  event.preventDefault();event.stopPropagation();void performShare(share.dataset.fnbShare,share.dataset.promotionId||'')
},{capture:true});
document.addEventListener('sindhorn:route-mounted',()=>queueMicrotask(start));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
