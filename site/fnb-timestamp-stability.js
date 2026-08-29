import {FNB_PROMOTIONS,FNB_DATA_UPDATED_AT} from './fnb-data.js';

function parseUpdated(value){
  const text=String(value||'').trim();if(!text)return null;
  const zoned=/(?:z|[+-]\d\d:?\d\d)$/i.test(text)?text:`${text}+07:00`;
  const date=new Date(zoned);return Number.isNaN(date.valueOf())?null:date
}
function formatDate(value){
  const date=parseUpdated(value);if(!date)return'';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(date)
}
function formatDataset(value){
  const date=parseUpdated(value);if(!date)return'';
  const day=formatDate(value);
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'numeric',minute:'2-digit',hour12:true}).format(date).toLowerCase();
  return`Updated ${day} · ${time}`
}
function applyHero(){
  const hero=document.querySelector('.fnb-route .fnb-hero'),period=hero?.querySelector('.fnb-period');
  if(!hero||!period||!FNB_DATA_UPDATED_AT)return;
  let stamp=hero.querySelector('[data-fnb-data-updated]');
  if(!stamp){stamp=document.createElement('div');stamp.className='fnb-data-updated';stamp.dataset.fnbDataUpdated='true';period.insertAdjacentElement('afterend',stamp)}
  const text=formatDataset(FNB_DATA_UPDATED_AT);if(text&&stamp.textContent!==text)stamp.textContent=text
}
function applyDetail(){
  const detail=document.querySelector('.fnb-route [data-detail]:not([hidden])'),title=detail?.querySelector('.fnb-detail-title')?.textContent?.trim();
  if(!detail||!title)return;
  const campaign=FNB_PROMOTIONS.find(item=>item.title===title),text=formatDate(campaign?.updatedAt);if(!text)return;
  for(const fact of detail.querySelectorAll('.fnb-fact')){
    if(fact.querySelector('span')?.textContent?.trim()!=='Updated')continue;
    const value=fact.querySelector('b');if(value&&value.textContent!==text)value.textContent=text
  }
}
function enhance(){if(document.body.dataset.route!=='fnb')return;applyHero();applyDetail()}

const routeHost=document.getElementById('route-view');
if(routeHost)new MutationObserver(enhance).observe(routeHost,{childList:true,subtree:true});
document.addEventListener('sindhorn:route-mounted',event=>{if(event.detail?.route==='fnb')enhance()});
