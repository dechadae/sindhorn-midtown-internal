import {IHG_HISTORY_PERIODS,IHG_HISTORY_SOURCE} from '../../ihg-history-data.js';

let stylePromise=null;
const IMAGES=Object.freeze({
  '1777–1899':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1770.jpg?h=422&iar=0&w=750','IHG history archive · 1777'],
  '1900–1949':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1946.jpg?h=422&iar=0&w=750','IHG history archive · 1946'],
  '1950–1959':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1952.jpg?h=750&iar=0&w=750','IHG history archive · 1952'],
  '1960–1969':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1961.jpg?h=750&iar=0&w=750','IHG history archive · 1961'],
  '1970–1979':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1972.jpg?h=422&iar=0&w=750','IHG history archive · 1972'],
  '1980–1989':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1981.jpg?h=750&iar=0&w=750','IHG history archive · 1981'],
  '1990–1999':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1990.jpg?h=750&iar=0&w=750','IHG history archive · 1990'],
  '2000–2009':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-2000.png?h=750&iar=0&w=750','IHG history archive · 2000'],
  '2010–2019':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-2010.jpg?h=750&iar=0&w=750','IHG history archive · 2010'],
  '2020–Present':['https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/history-2.jpg?h=422&iar=0&w=750','IHG history archive · 2021']
});
function ensureStyle(){if(stylePromise)return stylePromise;stylePromise=new Promise(resolve=>{const existing=document.querySelector('link[data-ui-history-style]');if(existing){if(existing.sheet)resolve();else{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})}return}const link=document.createElement('link');link.rel='stylesheet';link.href='/ui/routes/history.css';link.dataset.uiHistoryStyle='true';link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});document.head.appendChild(link)});return stylePromise}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const chevron='<svg class="ui-disclosure__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg>';
function visual(period){const item=IMAGES[period.period];if(!item)return'';return`<figure class="ui-history__visual"><img src="${esc(item[0])}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer-when-downgrade"><figcaption>${esc(item[1])}</figcaption></figure>`}
function milestones(period){return`<div class="ui-history__milestones">${period.milestones.map(item=>`<article class="ui-history__milestone"><p class="ui-history__year">${esc(item[0])}</p><h3>${esc(item[1])}</h3><p>${esc(item[2])}</p></article>`).join('')}</div>`}
function periodCard(period,index){return`<article class="ui-disclosure" data-ui-disclosure="history-${index}"><button class="ui-disclosure__button" type="button" aria-expanded="false" data-ui-disclosure-button><span class="ui-disclosure__copy"><span class="ui-disclosure__eyebrow">${esc(period.period)}</span><strong class="ui-disclosure__title">${esc(period.title)}</strong><span class="ui-disclosure__meta">${period.milestones.length} milestone${period.milestones.length===1?'':'s'}</span></span>${chevron}</button><div class="ui-disclosure__panel"><div class="ui-disclosure__panel-inner"><div class="ui-disclosure__body"><div class="ui-history__context"><span>At this time</span><p>${esc(period.context)}</p></div>${visual(period)}${milestones(period)}</div></div></div></article>`}

export async function mountIhgHistoryRoute(host){
  await ensureStyle();
  const latest=IHG_HISTORY_PERIODS.at(-1)?.milestones?.at(-1)?.[0]||'2026';
  const route=document.createElement('section');route.className='ui-history';
  route.innerHTML=`<header class="ui-route-hero"><div class="ui-route-hero__head"><div><p class="ui-eyebrow">IHG Hotels &amp; Resorts</p><h1 class="ui-title">Our history</h1></div><a class="ui-utility-action" href="/brand" data-ui-route="brand">Back to Brand</a></div><p class="ui-copy">From a Burton-on-Trent brewery in 1777 to a global hospitality group.</p><div class="ui-history__summary"><div><span>Story begins</span><b>1777</b></div><div><span>IHG is born</span><b>2003</b></div><div><span>Latest milestone</span><b>${esc(latest)}</b></div></div></header><div class="ui-history__list" aria-label="Historical periods">${IHG_HISTORY_PERIODS.map(periodCard).join('')}</div><aside class="ui-history__source" aria-label="Source"><span>Source</span><strong>IHG Hotels &amp; Resorts — Our history</strong><p>Milestones and selected archive images are sourced from IHG plc.</p><a href="${esc(IHG_HISTORY_SOURCE)}" target="_blank" rel="noopener noreferrer">View official history →</a></aside>`;
  host.replaceChildren(route);
  const onClick=event=>{const button=event.target.closest('[data-ui-disclosure-button]');if(!button)return;const card=button.closest('[data-ui-disclosure]'),open=!card.classList.contains('is-open');route.querySelectorAll('[data-ui-disclosure].is-open').forEach(other=>{if(other===card)return;other.classList.remove('is-open');other.querySelector('[data-ui-disclosure-button]')?.setAttribute('aria-expanded','false')});card.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(()=>card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}))};
  route.addEventListener('click',onClick);
  return()=>{route.removeEventListener('click',onClick);route.remove()};
}
