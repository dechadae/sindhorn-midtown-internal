import {FNB_PROMOTIONS as DATA} from './fnb-data.js';
import {initFnbArtworkSync} from '/fnb-artwork-sync.js';

const SHARE_BASE='/share/fnb';
const SHARE_LABEL='Share';
const STATE_KEY='sindhorn-midtown:fnb-local:v1';
const SHARE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 13v6h14v-6"/></svg>';
const FOLDER_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>';
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
  el.className='app-utility-action fnb-action-control fnb-share-button';
  el.dataset.fnbShare=kind;
  if(id)el.dataset.promotionId=id;
  el.setAttribute('aria-label',kind==='page'?'Share F&B promotions':`Share ${title}`);
  el.innerHTML=`${SHARE_ICON}<span>${SHARE_LABEL}</span>`;
  return el
}
function route(){return document.querySelector('#route-view .fnb-route')}
function safeFolder(value){if(!value)return null;try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname.endsWith('sharepoint.com')||url.hostname.endsWith('1drv.ms')||url.hostname.endsWith('onedrive.live.com'))?url.href:null}catch(_){return null}}
function localLinks(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')?.links||{}}catch(_){return{}}}
function artworkLinks(item){
  if(!item)return[];
  const overrides=localLinks(),seen=new Set(),links=[];
  item.activations.forEach(activation=>{
    const raw=Object.prototype.hasOwnProperty.call(overrides,activation.id)?overrides[activation.id]:activation.artworkUrl;
    const url=safeFolder(raw);if(!url||seen.has(url))return;seen.add(url);links.push({outlet:activation.outlet,url})
  });
  return links
}
function folderControl(item){
  const links=artworkLinks(item);if(!links.length)return null;
  if(links.length===1){
    const link=document.createElement('a');link.className='fnb-action-control fnb-card-folder';link.href=links[0].url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',`Open artwork folder for ${item.title}`);link.innerHTML=`${FOLDER_ICON}<span>Artwork folder</span>`;return link
  }
  const control=document.createElement('button');control.type='button';control.className='fnb-action-control fnb-card-folder';control.dataset.fnbFolder=item.id;control.setAttribute('aria-label',`Open artwork folders for ${item.title}`);control.innerHTML=`${FOLDER_ICON}<span>Artwork folders</span>`;return control
}
function notify(message){
  const host=route();
  const existing=host?.querySelector('[data-toast]');
  if(existing){existing.textContent=message;existing.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(existing.isConnected)existing.hidden=true},1800);return}
  const live=document.getElementById('fnb-share-live')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'fnb-share-live'}));
  live.setAttribute('aria-live','polite');live.hidden=true;live.textContent=message
}
async function copyFallback(url){
  try{await navigator.clipboard.writeText(url);return true}catch(_){}
  const area=document.createElement('textarea');area.value=url;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}area.remove();return ok
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
function openFolderChooser(item){
  const host=route(),links=artworkLinks(item);if(!host||!links.length)return;
  if(links.length===1){window.open(links[0].url,'_blank','noopener');return}
  const layer=host.querySelector('[data-sheet-layer]'),title=host.querySelector('[data-sheet-title]'),body=host.querySelector('[data-sheet-body]');
  if(!layer||!title||!body)return;
  title.textContent='Artwork folders';
  body.innerHTML=`<div class="fnb-link-list">${links.map(link=>`<a href="${link.url.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" target="_blank" rel="noopener"><span>${String(link.outlet||'Artwork').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span><span>Open ↗</span></a>`).join('')}</div>`;
  layer.classList.add('is-open');layer.setAttribute('aria-hidden','false')
}
function enhance(){
  const host=route();if(!host)return;
  const hero=host.querySelector('.fnb-hero');
  if(hero&&!hero.querySelector('[data-fnb-share="page"]'))hero.appendChild(button('page'));
  host.querySelectorAll('.fnb-card').forEach(card=>{
    const opener=card.querySelector('[data-open]'),id=opener?.dataset.open,item=promotion(id);if(!id||!item)return;
    let actions=card.querySelector('.fnb-card-actions');
    if(!actions){actions=document.createElement('div');actions.className='fnb-card-actions';card.appendChild(actions)}
    if(!actions.querySelector('.fnb-card-folder')){const folder=folderControl(item);if(folder)actions.appendChild(folder)}
    if(!actions.querySelector('[data-fnb-share="promotion"]'))actions.appendChild(button('promotion',id))
  });
  const detail=host.querySelector('.fnb-detail:not([hidden])');
  const currentTitle=detail?.querySelector('.fnb-detail-title')?.textContent?.trim();
  const item=currentTitle?DATA.find(candidate=>candidate.title===currentTitle):null;
  const head=detail?.querySelector('.fnb-detail-head');
  if(head&&item&&!head.querySelector('[data-fnb-share="promotion"]'))head.appendChild(button('promotion',item.id))
}
function start(){
  observer?.disconnect();observer=null;
  if(document.body.dataset.route!=='fnb')return;
  enhance();const host=route();if(!host)return;
  observer=new MutationObserver(()=>enhance());observer.observe(host,{childList:true,subtree:true})
}
document.addEventListener('click',event=>{
  const share=event.target.closest?.('[data-fnb-share]');
  if(share){event.preventDefault();event.stopPropagation();void performShare(share.dataset.fnbShare,share.dataset.promotionId||'');return}
  const folder=event.target.closest?.('[data-fnb-folder]');
  if(folder){event.preventDefault();event.stopPropagation();const item=promotion(folder.dataset.fnbFolder);if(item)openFolderChooser(item)}
},{capture:true});
document.addEventListener('sindhorn:route-mounted',()=>queueMicrotask(start));
initFnbArtworkSync();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
