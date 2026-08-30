import {IHG_HISTORY_PERIODS} from './ihg-history-data.js';
import {HOTEL_FACTSHEET} from './hotel-factsheet-data.js';

let stylesPromise=null;
function ensureStyles(){
  if(document.querySelector('link[data-brand-route-style]'))return Promise.resolve();
  if(stylesPromise)return stylesPromise;
  stylesPromise=new Promise((resolve,reject)=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/brand.css?v=3';
    link.dataset.brandRouteStyle='';
    link.onload=resolve;
    link.onerror=()=>{stylesPromise=null;reject(new Error('Brand styles unavailable'))};
    document.head.appendChild(link);
  });
  return stylesPromise;
}
const arrow='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10h8M11 7l3 3-3 3"/></svg>';

export async function mountBrandRoute(host){
  await ensureStyles();
  const milestones=IHG_HISTORY_PERIODS.reduce((sum,period)=>sum+period.milestones.length,0);
  const route=document.createElement('section');
  route.className='brand-route';
  route.innerHTML=`
    <header class="brand-hero">
      <p class="brand-eyebrow">Brand</p>
      <h1>Know Our Hotel</h1>
      <p class="brand-intro">History, identity and essential hotel knowledge.</p>
      <div class="brand-summary" aria-label="Brand knowledge summary">
        <div class="brand-stat"><span>Hotel</span><b>Sindhorn Midtown</b></div>
        <div class="brand-stat"><span>Collection</span><b>Vignette Collection by IHG</b></div>
      </div>
    </header>
    <div class="brand-card-list">
      <a class="brand-card" href="/ihg-history" data-app-route="ihgHistory" aria-label="Open Our History">
        <span class="brand-card-index">01 · IHG Hotels &amp; Resorts</span>
        <h2>Our History</h2>
        <p>From the origins of Bass in 1777 to today’s global IHG portfolio.</p>
        <div class="brand-card-foot"><span>${milestones} milestones</span><span class="brand-arrow">${arrow}</span></div>
      </a>
      <a class="brand-card" href="/hotel-factsheet" data-app-route="hotelFactsheet" aria-label="Open Sindhorn Midtown Factsheet">
        <span class="brand-card-index">02 · Sindhorn Midtown</span>
        <h2>Hotel Factsheet</h2>
        <p>The essential employee reference for rooms, dining, facilities, meetings and location.</p>
        <div class="brand-card-foot"><span>${HOTEL_FACTSHEET.hotel.roomsAndSuites} rooms &amp; suites</span><span class="brand-arrow">${arrow}</span></div>
      </a>
    </div>
  `;
  host.appendChild(route);
  return()=>route.remove();
}
