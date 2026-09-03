import {IHG_HISTORY_PERIODS} from '../../ihg-history-data.js';
import {HOTEL_FACTSHEET} from '../../hotel-factsheet-data.js';

let stylePromise=null;
function ensureStyle(){if(stylePromise)return stylePromise;stylePromise=new Promise(resolve=>{const existing=document.querySelector('link[data-ui-brand-style]');if(existing){if(existing.sheet)resolve();else{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})}return}const link=document.createElement('link');link.rel='stylesheet';link.href='/ui/routes/brand.css';link.dataset.uiBrandStyle='true';link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});document.head.appendChild(link)});return stylePromise}
const arrow='<svg class="ui-brand__arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10h8M11 7l3 3-3 3"/></svg>';

export async function mountBrandRoute(host){
  await ensureStyle();
  const milestones=IHG_HISTORY_PERIODS.reduce((sum,period)=>sum+(period.milestones?.length||0),0);
  const route=document.createElement('section');route.className='ui-brand';
  route.innerHTML=`<header class="ui-route-hero"><p class="ui-eyebrow">Brand</p><h1 class="ui-title">Know Our Hotel</h1><p class="ui-copy">History, identity and essential hotel knowledge.</p><div class="ui-brand__summary"><div class="ui-brand__stat"><span>Hotel</span><b>Sindhorn Midtown</b></div><div class="ui-brand__stat"><span>Collection</span><b>Vignette Collection by IHG</b></div></div></header><div class="ui-brand__cards"><a class="ui-card ui-card--interactive ui-brand__card" href="/ihg-history" data-ui-route="ihgHistory" aria-label="Open Our History"><span class="ui-brand__index">01 · IHG Hotels &amp; Resorts</span><h2>Our History</h2><p>From the origins of Bass in 1777 to today’s global IHG portfolio.</p><div class="ui-brand__foot"><span>${milestones} milestones</span>${arrow}</div></a><a class="ui-card ui-card--interactive ui-brand__card" href="/hotel-factsheet" data-ui-route="hotelFactsheet" aria-label="Open Sindhorn Midtown Factsheet"><span class="ui-brand__index">02 · Sindhorn Midtown</span><h2>Hotel Factsheet</h2><p>The essential employee reference for rooms, dining, facilities, meetings and location.</p><div class="ui-brand__foot"><span>${HOTEL_FACTSHEET.hotel.roomsAndSuites} rooms &amp; suites</span>${arrow}</div></a></div>`;
  host.replaceChildren(route);
  return()=>route.remove();
}
