import {IHG_HISTORY_PERIODS,IHG_HISTORY_SOURCE} from './ihg-history-data.js';

const STYLE_ID='ihg-history-style';
const SOURCE_LABEL='IHG Hotels & Resorts — Our history';
const DISCLOSURE_MS=420;
const SCROLL_SETTLE_MS=1800;
const HISTORY_PERIOD_IMAGES=Object.freeze({
  '1777–1899':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1770.jpg?h=422&iar=0&w=750',caption:'IHG history archive · 1777'}),
  '1900–1949':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1946.jpg?h=422&iar=0&w=750',caption:'IHG history archive · 1946'}),
  '1950–1959':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1952.jpg?h=750&iar=0&w=750',caption:'IHG history archive · 1952'}),
  '1960–1969':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1961.jpg?h=750&iar=0&w=750',caption:'IHG history archive · 1961'}),
  '1970–1979':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1972.jpg?h=422&iar=0&w=750',caption:'IHG history archive · 1972'}),
  '1980–1989':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1981.jpg?h=750&iar=0&w=750',caption:'IHG history archive · 1981'}),
  '1990–1999':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-1990.jpg?h=750&iar=0&w=750',caption:'IHG history archive · 1990'}),
  '2000–2009':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-2000.png?h=750&iar=0&w=750',caption:'IHG history archive · 2000'}),
  '2010–2019':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/img-2010.jpg?h=750&iar=0&w=750',caption:'IHG history archive · 2010'}),
  '2020–Present':Object.freeze({src:'https://www.ihgplc.com/~/media/Images/I/Ihg-Plc/images/about-us/our-history/history-images/history-2.jpg?h=422&iar=0&w=750',caption:'IHG history archive · 2021'})
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
    link.href='/ihg-history.css?v=3';
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',resolve,{once:true});
    document.head.appendChild(link);
  });
}

function esc(value=''){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function periodImageMarkup(period){
  const visual=HISTORY_PERIOD_IMAGES[period.period];
  if(!visual)return'';
  return `<figure class="ihg-history-visual ihg-history-period-visual">
    <img src="${esc(visual.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer-when-downgrade">
    <figcaption>${esc(visual.caption)}</figcaption>
  </figure>`;
}

function milestoneMarkup(item,index){
  return `<article class="ihg-history-milestone${index===0?' is-first':''}">
    <p class="ihg-history-year">${esc(item[0])}</p>
    <h3>${esc(item[1])}</h3>
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
        ${periodImageMarkup(period)}
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

function reducedMotion(){
  return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function persistentHeaderOffset(){
  const header=document.getElementById('app-header');
  if(!header)return 0;
  const position=getComputedStyle(header).position;
  if(position!=='fixed'&&position!=='sticky')return 0;
  return Math.max(0,header.getBoundingClientRect().bottom);
}

function desiredCardTop(){
  return persistentHeaderOffset()+10;
}

function wait(ms){
  return new Promise(resolve=>window.setTimeout(resolve,ms));
}

function clearScrollRunway(list){
  if(list)list.style.paddingBottom='';
}

function prepareScrollRunway(root,card){
  const list=root.querySelector('.ihg-history-list');
  if(!list)return null;
  clearScrollRunway(list);
  const target=Math.max(0,window.scrollY+card.getBoundingClientRect().top-desiredCardTop());
  const needed=Math.ceil(target+window.innerHeight-document.documentElement.scrollHeight+18);
  if(needed>0)list.style.paddingBottom=`${needed}px`;
  return list;
}

function scrollCardToTop(card){
  const expected=desiredCardTop();
  const top=Math.max(0,window.scrollY+card.getBoundingClientRect().top-expected);
  const behavior=reducedMotion()?'auto':'smooth';
  if(behavior==='auto'||Math.abs(card.getBoundingClientRect().top-expected)<=2){
    window.scrollTo({top,behavior:'auto'});
    return Promise.resolve();
  }
  return new Promise(resolve=>{
    const started=performance.now();
    let stableFrames=0;
    const settle=()=>{
      const delta=Math.abs(card.getBoundingClientRect().top-expected);
      stableFrames=delta<=3?stableFrames+1:0;
      if(stableFrames>=3||performance.now()-started>=SCROLL_SETTLE_MS){
        resolve();
        return;
      }
      requestAnimationFrame(settle);
    };
    window.scrollTo({top,behavior});
    requestAnimationFrame(settle);
  });
}

export async function mountIhgHistoryRoute(root){
  await ensureStylesheet();
  document.body.dataset.ihgHistory='true';
  root.innerHTML=template();
  root.querySelectorAll('.ihg-history-card').forEach(card=>setExpanded(card,false));

  let interactionId=0;
  let pendingCard=null;
  let activeRunway=null;
  let runwayCleanupTimer=0;

  const resetPending=()=>{
    pendingCard?.classList.remove('is-preparing');
    pendingCard=null;
    clearTimeout(runwayCleanupTimer);
    runwayCleanupTimer=0;
    clearScrollRunway(activeRunway);
    activeRunway=null;
  };

  const onClick=event=>{
    const button=event.target.closest('.ihg-history-card-button');
    if(!button||!root.contains(button))return;
    const card=button.closest('.ihg-history-card');
    const isOpen=button.getAttribute('aria-expanded')==='true';
    const token=++interactionId;
    resetPending();

    if(isOpen){
      setExpanded(card,false);
      return;
    }

    const openCards=[...root.querySelectorAll('.ihg-history-card.is-open')].filter(other=>other!==card);
    openCards.forEach(other=>setExpanded(other,false));
    pendingCard=card;
    card.classList.add('is-preparing');

    void (async()=>{
      if(openCards.length&&!reducedMotion())await wait(DISCLOSURE_MS+20);
      if(token!==interactionId)return;

      const runway=prepareScrollRunway(root,card);
      activeRunway=runway;
      await scrollCardToTop(card);
      if(token!==interactionId){
        clearScrollRunway(runway);
        return;
      }

      setExpanded(card,true);
      card.classList.remove('is-preparing');
      pendingCard=null;
      activeRunway=null;
      runwayCleanupTimer=window.setTimeout(()=>clearScrollRunway(runway),reducedMotion()?0:DISCLOSURE_MS+30);
    })();
  };
  root.addEventListener('click',onClick);

  return ()=>{
    interactionId+=1;
    resetPending();
    root.removeEventListener('click',onClick);
    delete document.body.dataset.ihgHistory;
  };
}
