import {HOTEL_FACTSHEET as DATA,HOTEL_FACTSHEET_IMAGES as IMAGES,HOTEL_FACTSHEET_SOURCES as SOURCES} from './hotel-factsheet-data.js';

const DISCLOSURE_MS=420;
const SCROLL_SETTLE_MS=1800;
let stylesPromise=null;

function ensureStyles(){
  if(document.querySelector('link[data-hotel-factsheet-style]'))return Promise.resolve();
  if(stylesPromise)return stylesPromise;
  stylesPromise=new Promise((resolve,reject)=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/hotel-factsheet.css?v=2';
    link.dataset.hotelFactsheetStyle='';
    link.onload=resolve;
    link.onerror=()=>{stylesPromise=null;reject(new Error('Hotel factsheet styles unavailable'))};
    document.head.appendChild(link);
  });
  return stylesPromise;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sourceLink=(href,label='Official source')=>`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
function picture(key){
  const image=IMAGES[key];if(!image)return'';
  return `<figure class="factsheet-picture"><img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy" decoding="async"><figcaption>${sourceLink(image.source,'Official image')}</figcaption></figure>`;
}
function sectionHead(number,label,title,count=''){
  return `<div class="factsheet-section-head"><div><p class="factsheet-section-kicker">${esc(number)} · ${esc(label)}</p><h2>${esc(title)}</h2></div>${count?`<span>${esc(count)}</span>`:''}</div>`;
}
function roomCard(room,index){
  const id=`factsheet-room-${index+1}`,buttonId=`${id}-button`;
  return `<article class="factsheet-room-card" data-factsheet-room="${index}">
    <button class="factsheet-room-card-button" id="${buttonId}" type="button" aria-expanded="false" aria-controls="${id}">
      <span class="factsheet-room-card-copy">
        <span class="factsheet-room-index">${String(index+1).padStart(2,'0')} · ${esc(room.sizeSqm)} sqm</span>
        <strong>${esc(room.name)}</strong>
        <span class="factsheet-room-bed">${esc(room.beds)}</span>
      </span>
      <svg class="factsheet-room-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>
    </button>
    <div class="factsheet-room-panel" id="${id}" role="region" aria-labelledby="${buttonId}" aria-hidden="true">
      <div class="factsheet-room-panel-inner">
        <div class="factsheet-room-context">
          <span>Room features</span>
          <ul>${room.highlights.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  </article>`;
}
function diningCard(item){
  return `<article class="factsheet-card factsheet-dining-card"><p class="factsheet-label">${esc(item.floor)}</p><h3>${esc(item.name)}</h3><p>${esc(item.concept)}</p><div class="factsheet-hours">${item.hours.map(x=>`<span>${esc(x)}</span>`).join('')}</div></article>`;
}
function facilityCard(item){
  return `<article class="factsheet-card factsheet-facility"><p class="factsheet-label">${esc(item.name)}</p><h3>${esc(item.fact)}</h3><p>${esc(item.detail)}</p></article>`;
}
function meetingRows(){
  const dash=v=>v==null?'—':esc(v);
  return DATA.meetings.spaces.map(row=>`<tr><th scope="row">${esc(row.name)}<small>${esc(row.floor)} floor · ${esc(row.sqm)} sqm</small></th><td>${dash(row.classroom)}</td><td>${dash(row.theater)}</td><td>${dash(row.banquet)}</td><td>${dash(row.halfMoon)}</td><td>${dash(row.uShape)}</td><td>${dash(row.boardroom)}</td><td>${dash(row.cocktail)}</td></tr>`).join('');
}
function bindSectionRail(route){
  const buttons=[...route.querySelectorAll('[data-factsheet-section]')],sections=[...route.querySelectorAll('[data-factsheet-section-target]')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const setActive=id=>buttons.forEach(button=>button.classList.toggle('is-active',button.dataset.factsheetSection===id));
  const onClick=event=>{
    const button=event.target.closest('[data-factsheet-section]');if(!button)return;
    const target=route.querySelector(`[data-factsheet-section-target="${CSS.escape(button.dataset.factsheetSection)}"]`);if(!target)return;
    target.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'start'});setActive(button.dataset.factsheetSection);
  };
  route.addEventListener('click',onClick);
  let observer=null;
  if('IntersectionObserver'in window){
    observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(visible)setActive(visible.target.dataset.factsheetSectionTarget);
    },{rootMargin:'-20% 0px -62% 0px',threshold:[0,.15,.4,.7]});
    sections.forEach(section=>observer.observe(section));
  }
  return()=>{route.removeEventListener('click',onClick);observer?.disconnect()};
}
function reducedMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function persistentHeaderOffset(){
  const header=document.getElementById('app-header');if(!header)return 0;
  const position=getComputedStyle(header).position;
  if(position!=='fixed'&&position!=='sticky')return 0;
  return Math.max(0,header.getBoundingClientRect().bottom);
}
function desiredCardTop(){return persistentHeaderOffset()+10}
function wait(ms){return new Promise(resolve=>window.setTimeout(resolve,ms))}
function clearScrollRunway(list){if(list)list.style.paddingBottom=''}
function prepareScrollRunway(route,card){
  const list=route.querySelector('.factsheet-room-list');if(!list)return null;
  clearScrollRunway(list);
  const target=Math.max(0,window.scrollY+card.getBoundingClientRect().top-desiredCardTop());
  const needed=Math.ceil(target+window.innerHeight-document.documentElement.scrollHeight+18);
  if(needed>0)list.style.paddingBottom=`${needed}px`;
  return list;
}
function exactCardScrollTop(card){return Math.max(0,window.scrollY+card.getBoundingClientRect().top-desiredCardTop())}
function withInstantDocumentScroll(callback){
  const element=document.documentElement,previous=element.style.scrollBehavior;
  element.style.scrollBehavior='auto';callback();element.style.scrollBehavior=previous;
}
function alignCardInstantly(card){
  const delta=card.getBoundingClientRect().top-desiredCardTop();
  if(Math.abs(delta)<=.5)return;
  withInstantDocumentScroll(()=>window.scrollBy(0,delta));
}
function holdCardAtTop(card,duration=DISCLOSURE_MS+90){
  if(reducedMotion()){alignCardInstantly(card);return Promise.resolve()}
  return new Promise(resolve=>{
    const started=performance.now();
    const keepAligned=()=>{
      alignCardInstantly(card);
      if(performance.now()-started>=duration){resolve();return}
      requestAnimationFrame(keepAligned);
    };
    requestAnimationFrame(keepAligned);
  });
}
function scrollCardToTop(card){
  const expected=desiredCardTop(),top=exactCardScrollTop(card);
  if(reducedMotion()||Math.abs(card.getBoundingClientRect().top-expected)<=2){
    withInstantDocumentScroll(()=>window.scrollTo({top,behavior:'auto'}));return Promise.resolve();
  }
  return new Promise(resolve=>{
    const started=performance.now();let stableFrames=0;
    const finish=()=>{withInstantDocumentScroll(()=>window.scrollTo({top:exactCardScrollTop(card),behavior:'auto'}));requestAnimationFrame(resolve)};
    const settle=()=>{
      const delta=Math.abs(card.getBoundingClientRect().top-expected);
      stableFrames=delta<=3?stableFrames+1:0;
      if(stableFrames>=3||performance.now()-started>=SCROLL_SETTLE_MS){finish();return}
      requestAnimationFrame(settle);
    };
    window.scrollTo({top,behavior:'smooth'});requestAnimationFrame(settle);
  });
}
function setRoomExpanded(card,expanded){
  const button=card.querySelector('.factsheet-room-card-button'),panel=card.querySelector('.factsheet-room-panel');
  if(!button||!panel)return;
  card.classList.toggle('is-open',expanded);
  button.setAttribute('aria-expanded',expanded?'true':'false');
  panel.setAttribute('aria-hidden',expanded?'false':'true');
  if('inert'in panel)panel.inert=!expanded;
}
function bindRoomAccordions(route){
  route.querySelectorAll('.factsheet-room-card').forEach(card=>setRoomExpanded(card,false));
  let interactionId=0,pendingCard=null,activeRunway=null;
  const cancelPending=()=>{pendingCard?.classList.remove('is-preparing');pendingCard=null};
  const clearActiveRunway=()=>{clearScrollRunway(activeRunway);activeRunway=null};
  const onClick=event=>{
    const button=event.target.closest('.factsheet-room-card-button');
    if(!button||!route.contains(button))return;
    const card=button.closest('.factsheet-room-card'),isOpen=button.getAttribute('aria-expanded')==='true',token=++interactionId;
    cancelPending();
    if(isOpen){setRoomExpanded(card,false);clearActiveRunway();return}
    const openCards=[...route.querySelectorAll('.factsheet-room-card.is-open')].filter(other=>other!==card);
    openCards.forEach(other=>setRoomExpanded(other,false));
    pendingCard=card;card.classList.add('is-preparing');
    void(async()=>{
      if(openCards.length&&!reducedMotion())await wait(DISCLOSURE_MS+20);
      if(token!==interactionId)return;
      clearActiveRunway();
      const runway=prepareScrollRunway(route,card);activeRunway=runway;
      await scrollCardToTop(card);
      if(token!==interactionId){if(activeRunway===runway)clearActiveRunway();return}
      setRoomExpanded(card,true);
      await holdCardAtTop(card);
      if(token!==interactionId)return;
      card.classList.remove('is-preparing');pendingCard=null;clearActiveRunway();
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(token!==interactionId)return;
      alignCardInstantly(card);
    })();
  };
  route.addEventListener('click',onClick);
  return()=>{interactionId+=1;cancelPending();clearActiveRunway();route.removeEventListener('click',onClick)};
}

export async function mountHotelFactsheetRoute(host){
  await ensureStyles();
  const h=DATA.hotel,route=document.createElement('section');
  route.className='factsheet-route';
  route.innerHTML=`
    <header class="factsheet-hero">
      <p class="factsheet-eyebrow">Sindhorn Midtown Hotel Bangkok</p>
      <h1>Hotel Factsheet</h1>
      <p class="factsheet-intro">Vignette Collection by IHG · Langsuan, Bangkok</p>
      <div class="factsheet-summary" aria-label="Hotel summary">
        <div><span>Rooms &amp; suites</span><b>${h.roomsAndSuites}</b></div>
        <div><span>Room types</span><b>${h.roomTypes}</b></div>
        <div><span>Dining venues</span><b>${h.diningVenues}</b></div>
        <div><span>Meeting capacity</span><b>${h.meetingMaxGuests}</b><small>guests</small></div>
      </div>
    </header>
    <nav class="factsheet-section-rail" aria-label="Factsheet sections">
      ${[['overview','Overview'],['stay','Stay'],['dine','Dine'],['facilities','Facilities'],['meet','Meet'],['access','Access']].map(([id,label],i)=>`<button type="button" class="${i===0?'is-active':''}" data-factsheet-section="${id}">${label}</button>`).join('')}
    </nav>

    <section class="factsheet-section" data-factsheet-section-target="overview">
      ${sectionHead('01','Overview','Hotel at a Glance')}
      ${picture('overview')}
      <div class="factsheet-facts">
        <div><span>Full identity</span><b>${esc(h.name)}</b></div>
        <div><span>Address</span><b>${esc(h.address)}</b></div>
        <div><span>Owned &amp; operated by</span><b>${esc(h.ownerOperator)}</b></div>
        <div><span>Check-in</span><b>${esc(h.checkIn)}</b></div>
        <div><span>Check-out</span><b>${esc(h.checkOut)}</b></div>
        <div><span>Telephone</span><b>${esc(h.phone)}</b></div>
      </div>
      <div class="factsheet-contact-strip"><a href="mailto:${esc(h.stayEmail)}">${esc(h.stayEmail)}</a>${sourceLink(SOURCES.overview)}</div>
    </section>

    <section class="factsheet-section" data-factsheet-section-target="stay">
      ${sectionHead('02','Stay','Rooms & Suites',`${h.roomTypes} types`)}
      ${picture('stay')}
      <p class="factsheet-section-intro">Twelve published room and suite categories. Open a category for the essential employee-facing differences.</p>
      <div class="factsheet-room-list">${DATA.rooms.map(roomCard).join('')}</div>
      <div class="factsheet-inline-source">${sourceLink(SOURCES.rooms,'Rooms & suites source')}</div>
    </section>

    <section class="factsheet-section" data-factsheet-section-target="dine">
      ${sectionHead('03','Dine','Dining',`${h.diningVenues} venues`)}
      ${picture('dine')}
      <div class="factsheet-card-grid">${DATA.dining.map(diningCard).join('')}</div>
      <div class="factsheet-contact-strip"><a href="mailto:${esc(h.diningEmail)}">${esc(h.diningEmail)}</a>${sourceLink(SOURCES.bangkok78,'Dining source')}</div>
    </section>

    <section class="factsheet-section" data-factsheet-section-target="facilities">
      ${sectionHead('04','Facilities','Facilities & Guest Experience')}
      ${picture('facilities')}
      <div class="factsheet-card-grid">${DATA.facilities.map(facilityCard).join('')}</div>
      <div class="factsheet-inline-source">${sourceLink(SOURCES.facilities,'Facilities source')} ${sourceLink(SOURCES.shuttle,'Shuttle source')}</div>
    </section>

    <section class="factsheet-section" data-factsheet-section-target="meet">
      ${sectionHead('05','Meet','Meetings & Events','up to 120')}
      ${picture('meetings')}
      <p class="factsheet-section-intro">${esc(DATA.meetings.summary)}</p>
      <details class="factsheet-disclosure factsheet-meeting" open>
        <summary><span><i>Rooms</i><strong>Published Capacity Table</strong></span><b>7 layouts</b></summary>
        <div class="factsheet-table-wrap">
          <table><thead><tr><th>Room</th><th>Class</th><th>Theatre</th><th>Banquet</th><th>Half-moon</th><th>U-shape</th><th>Board</th><th>Cocktail</th></tr></thead><tbody>${meetingRows()}</tbody></table>
        </div>
      </details>
      <div class="factsheet-card-grid factsheet-private-events">
        ${DATA.meetings.privateEvents.map(item=>`<article class="factsheet-card"><p class="factsheet-label">Private Events</p><h3>${esc(item.name)}</h3><p>${esc(item.capacity)}</p></article>`).join('')}
      </div>
      <article class="factsheet-card factsheet-included-card">
        <p class="factsheet-label">Included</p>
        <h3>Meeting Facilities</h3>
        <ul class="factsheet-included-list">${DATA.meetings.included.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
      </article>
      <div class="factsheet-contact-strip"><a href="mailto:${esc(h.commercialEmail)}">${esc(h.commercialEmail)}</a>${sourceLink(SOURCES.meetings,'Meeting source')}</div>
    </section>

    <section class="factsheet-section" data-factsheet-section-target="access">
      ${sectionHead('06','Access','Location & Contacts')}
      <div class="factsheet-bts-grid">
        ${DATA.access.bts.map(item=>`<article class="factsheet-card"><p class="factsheet-label">${esc(item.distance)} · ${esc(item.walk)}</p><h3>${esc(item.station)}</h3><p>${esc(item.exit)}</p></article>`).join('')}
      </div>
      <div class="factsheet-nearby"><p class="factsheet-label">Nearby Destinations</p><div>${DATA.access.nearby.map(item=>`<span>${esc(item)}</span>`).join('')}</div></div>
      <div class="factsheet-contacts">
        <a href="tel:+6627968888"><span>Hotel</span><b>${esc(h.phone)}</b></a>
        <a href="mailto:${esc(h.stayEmail)}"><span>Stay</span><b>${esc(h.stayEmail)}</b></a>
        <a href="mailto:${esc(h.diningEmail)}"><span>F&amp;B</span><b>${esc(h.diningEmail)}</b></a>
        <a href="mailto:${esc(h.commercialEmail)}"><span>Commercial</span><b>${esc(h.commercialEmail)}</b></a>
      </div>
      <div class="factsheet-inline-source">${sourceLink(SOURCES.location,'Location source')}</div>
    </section>
  `;
  host.appendChild(route);
  const cleanupRail=bindSectionRail(route),cleanupRooms=bindRoomAccordions(route);
  return()=>{cleanupRooms();cleanupRail();route.remove()};
}
