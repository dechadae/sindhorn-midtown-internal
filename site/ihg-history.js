import {IHG_HISTORY_PERIODS,IHG_HISTORY_SOURCE} from './ihg-history-data.js';

const STYLE_ID='ihg-history-style';
const SOURCE_LABEL='IHG Hotels & Resorts — Our history';
const HISTORY_IMAGES=Object.freeze({
  'The InterContinental brand is founded':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1946.jpg?h=422&iar=0&w=750',caption:'IHG archive · InterContinental, 1946'}),
  'Holiday Inn opens in Memphis':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1952.jpg?h=750&iar=0&w=750',caption:'IHG archive · Holiday Inn, 1952'}),
  'IHG becomes IHG Hotels & Resorts':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/history-2.jpg?h=422&iar=0&w=750',caption:'IHG archive · Brand identity, 2021'})
});

function ensureStylesheet(){
  const existing=document.getElementById(STYLE_ID);
  if(existing?.sheet)return Promise.resolve();
  if(existing)return new Promise(resolve=>{
    existing.addEventListener('load',resolve,{once:true});
    existing.addEventListener('error',resolve,{once:true});
  });
  return new Promise(resolve=>{
    const link=document.createElement('link');
    link.id=STYLE_ID;
    link.rel='stylesheet';
    link.href='/ihg-history.css?v=2';
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',resolve,{once:true});
    document.head.appendChild(link);
  });
}

function esc(value=''){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function imageMarkup(item){
  const visual=HISTORY_IMAGES[item[1]];
  if(!visual)return'';
  return `<figure class="ihg-history-visual">
    <img src="${esc(visual.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer-when-downgrade">
    <figcaption>${esc(visual.caption)}</figcaption>
  </figure>`;
}

function milestoneMarkup(item,index){
  return `<article class="ihg-history-milestone${index===0?' is-first':''}">
    <p class="ihg-history-year">${esc(item[0])}</p>
    <h3>${esc(item[1])}</h3>
    ${imageMarkup(item)}
    <p>${esc(item[2])}</p>
  </article>`;
}

function periodMarkup(period,index){
  const id=`ihg-history-period-${index+1}`;
  const buttonId=`${id}-button`;
  return `<article class="ihg-history-card" data-history-period="${index}">
    <button class="ihg-history-card-button" id="${buttonId}" type="button" aria-expanded="false" aria-controls="${id}">
      <span class="ihg-history-card-copy">
        <span class="ihg-history-period">${esc(period.period)}</span>
        <strong>${esc(period.title)}</strong>
        <span class="ihg-history-count">${period.milestones.length} milestone${period.milestones.length===1?'':'s'}</span>
      </span>
      <svg class="ihg-history-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>
    </button>
    <div class="ihg-history-panel" id="${id}" role="region" aria-labelledby="${buttonId}" aria-hidden="true">
      <div class="ihg-history-panel-inner">
        <div class="ihg-history-context">
          <span>At this time</span>
          <p>${esc(period.context)}</p>
        </div>
        <div class="ihg-history-milestones">${period.milestones.map(milestoneMarkup).join('')}</div>
      </div>
    </div>
  </article>`;
}

function template(){
  return `<section class="ihg-history-route" aria-labelledby="ihg-history-title">
    <div class="ihg-history-hero">
      <p class="ihg-history-eyebrow">IHG Hotels &amp; Resorts</p>
      <h1 id="ihg-history-title">Our history</h1>
      <p class="ihg-history-intro">From a Burton-on-Trent brewery in 1777 to a global hospitality group.</p>
      <div class="ihg-history-summary" aria-label="History summary">
        <div class="ihg-history-stat"><span>Story begins</span><b>1777</b></div>
        <div class="ihg-history-stat"><span>IHG is born</span><b>2003</b></div>
        <div class="ihg-history-stat"><span>Latest milestone</span><b>2026</b></div>
      </div>
    </div>
    <div class="ihg-history-list" aria-label="Historical periods">${IHG_HISTORY_PERIODS.map(periodMarkup).join('')}</div>
    <aside class="ihg-history-source" aria-label="Source">
      <span>Source</span>
      <strong>${SOURCE_LABEL}</strong>
      <p class="ihg-history-source-note">Milestones and selected archive images are sourced from IHG plc.</p>
      <a href="${IHG_HISTORY_SOURCE}" target="_blank" rel="noopener noreferrer">View official history <span aria-hidden="true">→</span></a>
    </aside>
  </section>`;
}

function setExpanded(card,expanded){
  const button=card.querySelector('.ihg-history-card-button');
  const panel=card.querySelector('.ihg-history-panel');
  if(!button||!panel)return;
  card.classList.toggle('is-open',expanded);
  button.setAttribute('aria-expanded',expanded?'true':'false');
  panel.setAttribute('aria-hidden',expanded?'false':'true');
  if('inert'in panel)panel.inert=!expanded;
}

export async function mountIhgHistoryRoute(root){
  await ensureStylesheet();
  document.body.dataset.ihgHistory='true';
  root.innerHTML=template();
  root.querySelectorAll('.ihg-history-card').forEach(card=>setExpanded(card,false));

  const onClick=event=>{
    const button=event.target.closest('.ihg-history-card-button');
    if(!button||!root.contains(button))return;
    const card=button.closest('.ihg-history-card');
    const opening=button.getAttribute('aria-expanded')!=='true';
    const before=card.getBoundingClientRect().top;
    if(opening){
      root.querySelectorAll('.ihg-history-card.is-open').forEach(other=>{if(other!==card)setExpanded(other,false)});
    }
    setExpanded(card,opening);
    if(opening){
      requestAnimationFrame(()=>{
        const delta=card.getBoundingClientRect().top-before;
        if(Math.abs(delta)>1)window.scrollBy(0,delta);
      });
    }
  };
  root.addEventListener('click',onClick);

  return ()=>{
    root.removeEventListener('click',onClick);
    delete document.body.dataset.ihgHistory;
  };
}
