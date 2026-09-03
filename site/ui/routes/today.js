import {loadBusinessDashboard,clearBusinessDashboardCache} from '../../business-dashboard-data.js';

let stylesPromise=null;
let activeController=null;
const openDisclosures=new Set();

const STYLE_DEPS=Object.freeze([
  ['data-ui-tokens','/ui/tokens.css'],
  ['data-ui-materials','/ui/materials.css'],
  ['data-ui-components','/ui/components.css'],
  ['data-ui-motion','/ui/motion.css'],
  ['data-ui-today','/ui/routes/today.css']
]);

function ensureStyles(){
  if(stylesPromise)return stylesPromise;
  stylesPromise=Promise.all(STYLE_DEPS.map(([attribute,href])=>{
    const existing=document.querySelector(`link[${attribute}]`);
    if(existing)return existing.sheet?Promise.resolve():new Promise(resolve=>{
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',resolve,{once:true});
    });
    return new Promise(resolve=>{
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=href;
      link.setAttribute(attribute,'true');
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',resolve,{once:true});
      document.head.appendChild(link);
    });
  })).catch(error=>{stylesPromise=null;throw error});
  return stylesPromise;
}

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const chevron='<svg class="ui-disclosure__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg>';

function money(value,{compact=false,signed=false}={}){
  const n=number(value);if(n===null)return'—';
  const abs=Math.abs(n),sign=n<0?'−':signed&&n>0?'+':'';
  let body;
  if(compact&&abs>=1_000_000)body=`${(abs/1_000_000).toFixed(abs>=10_000_000?1:2).replace(/\.0+$/,'')}M`;
  else if(compact&&abs>=100_000)body=`${Math.round(abs/1000)}K`;
  else body=Math.round(abs).toLocaleString('en-US');
  return`${sign}฿${body}`;
}
function integer(value,{signed=false}={}){
  const n=number(value);if(n===null)return'—';
  const sign=n<0?'−':signed&&n>0?'+':'';
  return`${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
function percent(value,{signed=false,digits=1}={}){
  const n=number(value);if(n===null)return'—';
  const p=n*100,sign=p<0?'−':signed&&p>0?'+':'';
  return`${sign}${Math.abs(p).toFixed(digits)}%`;
}
function dateLabel(value,{monthOnly=false}={}){
  const raw=String(value||'').slice(0,10);
  const date=new Date(`${raw}${monthOnly?'-01':''}T00:00:00+07:00`);
  if(Number.isNaN(date.valueOf()))return String(value||'');
  return new Intl.DateTimeFormat('en-GB',monthOnly?{month:'short',year:'2-digit'}:{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(date);
}
function shortDate(value){
  const raw=String(value||'').slice(0,10);
  const date=new Date(`${raw}T00:00:00+07:00`);
  if(Number.isNaN(date.valueOf()))return String(value||'');
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(date);
}
function dateTime(value){
  const date=new Date(value);
  if(Number.isNaN(date.valueOf()))return String(value||'');
  const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(date);
  const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(date);
  return`${day} · ${time} ICT`;
}
function sourceFor(data,type){return(data.sources||[]).find(source=>source?.type===type)||null}
function currentRooms(data){
  const month=String(data.businessDate||'').slice(0,7);
  return data.rooms?.months?.find(item=>String(item?.stayMonth||'').slice(0,7)===month)||data.rooms?.months?.[0]||null;
}
function variance(actual,reference,{kind='money'}={}){
  const a=number(actual),r=number(reference);if(a===null||r===null)return'—';
  const diff=a-r;
  if(kind==='percent')return`${diff>=0?'+':'−'}${Math.abs(diff*100).toFixed(1)} pp`;
  if(kind==='integer')return integer(diff,{signed:true});
  return money(diff,{compact:true,signed:true});
}
function sectionHead(kicker,title,copy=''){
  return`<header class="ui-today__section-head"><p class="ui-today__section-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2>${copy?`<p>${esc(copy)}</p>`:''}</header>`;
}
function metric(label,value,copy='',meta=''){
  return`<article class="ui-card ui-card--metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${copy?`<p>${esc(copy)}</p>`:''}${meta?`<small>${esc(meta)}</small>`:''}</article>`;
}
function comparisonRow(label,actual,reference,{kind='money',referenceLabel='Forecast'}={}){
  const format=kind==='percent'?percent:kind==='integer'?integer:value=>money(value,{compact:true});
  return`<div class="ui-today__row"><div><span>${esc(label)}</span><strong>${esc(format(actual))}</strong></div><div><span>${esc(referenceLabel)}</span><b>${esc(format(reference))}</b></div><em>${esc(variance(actual,reference,{kind}))}</em></div>`;
}
function disclosure({key,eyebrow,title,meta='',body}){
  const open=openDisclosures.has(key);
  return`<article class="ui-disclosure${open?' is-open':''}" data-ui-disclosure="${esc(key)}"><button class="ui-disclosure__button" type="button" aria-expanded="${open?'true':'false'}" data-ui-disclosure-button><span class="ui-disclosure__copy"><span class="ui-disclosure__eyebrow">${esc(eyebrow)}</span><strong class="ui-disclosure__title">${esc(title)}</strong>${meta?`<span class="ui-disclosure__meta">${esc(meta)}</span>`:''}</span>${chevron}</button><div class="ui-disclosure__panel"><div class="ui-disclosure__panel-inner"><div class="ui-disclosure__body">${body}</div></div></div></article>`;
}

function renderHero(data){
  const fnbSource=sourceFor(data,'fnb_xlsx');
  const roomsSource=sourceFor(data,'rooms_pdf');
  const pickupTo=roomsSource?.metadata?.pickupTo;
  const roomsCarried=Boolean(roomsSource?.metadata?.carriedForwardFromRun);
  return`<header class="ui-route-hero"><p class="ui-eyebrow">Today</p><h1 class="ui-title">Hotel Business</h1><p class="ui-copy">${esc(dateLabel(data.businessDate))} · Daily operating pulse from approved F&amp;B and Rooms reports.</p><div class="ui-today__hero-meta"><div><span>Data updated</span><strong>${esc(dateTime(data.publishedAt||data.importedAt))}</strong><small>${esc(data.validationStatus==='passed_with_warnings'?'Validated with source warnings':'Validated')}</small></div><div><span>F&amp;B report</span><strong>${esc(shortDate(fnbSource?.detectedReportDate||data.businessDate))}</strong><small>Revision ${esc(data.revision)}</small></div><div><span>Rooms report</span><strong>${esc(shortDate(roomsSource?.detectedReportDate||data.businessDate))}</strong><small>${esc(`${pickupTo?`Pickup through ${shortDate(pickupTo)}`:'Approved source'}${roomsCarried?' · carried forward unchanged':''}`)}</small></div></div></header>`;
}
function renderGlance(data){
  const summary=data.fnb?.summary||{},daily=summary.daily||{},mtd=summary.mtd||{};
  const room=currentRooms(data),otb=room?.otb||{},pickup=room?.pickup||{};
  const fnbSource=sourceFor(data,'fnb_xlsx'),roomsSource=sourceFor(data,'rooms_pdf');
  return`<section class="ui-today__section">${sectionHead('01 · Business pulse','At a Glance')}<div class="ui-today__domain"><div class="ui-today__domain-head"><span>Food &amp; Beverage</span><small>${esc(shortDate(fnbSource?.detectedReportDate||data.businessDate))}</small></div><div class="ui-today__metric-grid">${metric('Today Revenue',money(daily.revenue,{compact:true}),`${variance(daily.revenue,daily.forecast)} vs forecast`)}${metric('MTD Revenue',money(mtd.revenue,{compact:true}),`${variance(mtd.revenue,mtd.forecast)} vs forecast`)}</div></div><div class="ui-today__domain"><div class="ui-today__domain-head"><span>Rooms</span><small>${esc(shortDate(roomsSource?.detectedReportDate||data.businessDate))}</small></div><div class="ui-today__metric-grid ui-today__metric-grid--4">${metric('Occupancy OTB',percent(otb.occupancy),room?`${variance(otb.occupancy,room.forecast?.occupancy,{kind:'percent'})} vs forecast`:'')}${metric('ADR',money(otb.adr),room?`${variance(otb.adr,room.forecast?.adr)} vs forecast`:'')}${metric('RevPAR',money(otb.revpar),room?`${variance(otb.revpar,room.forecast?.revpar)} vs forecast`:'')}${metric('24h Pickup',`${integer(pickup.rns,{signed:true})} RN`,money(pickup.revenue,{compact:true,signed:true}),pickup.adr?`Pickup ADR ${money(pickup.adr)}`:'')}</div></div></section>`;
}
function renderFlags(data){
  const flags=Array.isArray(data.flags)?data.flags:[];
  if(!flags.length)return'';
  const groups=new Map();
  flags.forEach(flag=>{const key=String(flag.domain||'Other').toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(flag)});
  return`<section class="ui-today__section">${sectionHead('02 · Exceptions','Needs Attention','Rule-based exceptions from the approved daily dataset.')}<div class="ui-today__domain">${[...groups.entries()].map(([domain,items])=>`<div><div class="ui-today__domain-head"><span>${esc(domain==='fnb'?'Food & Beverage':domain==='rooms'?'Rooms':domain)}</span><small>${items.length} exception${items.length===1?'':'s'}</small></div><div class="ui-today__flag-list">${items.map(flag=>`<article class="ui-card ui-today__flag"><div><strong>${esc(flag.title)}</strong><p>${esc(flag.detail)}</p></div>${flag.payload?.variancePct!==undefined?`<b>${esc(percent(flag.payload.variancePct,{signed:true}))}</b>`:''}</article>`).join('')}</div></div>`).join('')}</div></section>`;
}
function outletDisclosure(outlet){
  const dayparts=Array.isArray(outlet.dayparts)?outlet.dayparts:[];
  const body=`<div class="ui-today__mini-grid"><div class="ui-today__mini"><span>Forecast</span><b>${esc(number(outlet.forecast)>0?money(outlet.forecast,{compact:true}):'—')}</b></div><div class="ui-today__mini"><span>Covers</span><b>${esc(integer(outlet.covers))}</b></div><div class="ui-today__mini"><span>Food</span><b>${esc(money(outlet.foodNet,{compact:true}))}</b></div><div class="ui-today__mini"><span>Beverage</span><b>${esc(money(outlet.beverageNet,{compact:true}))}</b></div></div>${dayparts.map(day=>`<div class="ui-today__daypart"><div><span>${esc(day.label)}</span><b>${esc(money(day.revenue,{compact:true}))}</b></div><small>${esc(integer(day.covers))} covers · Food ${esc(money(day.foodNet,{compact:true}))} · Beverage ${esc(money(day.beverageNet,{compact:true}))}</small></div>`).join('')}`;
  return disclosure({key:`outlet:${outlet.key||outlet.label}`,eyebrow:outlet.label,title:money(outlet.revenue,{compact:true}),meta:number(outlet.forecast)>0?`${variance(outlet.revenue,outlet.forecast)} vs forecast`:'Forecast not loaded',body});
}
function renderFnb(data){
  const summary=data.fnb?.summary||{},daily=summary.daily||{},outlets=Array.isArray(data.fnb?.outlets)?data.fnb.outlets:[];
  return`<section class="ui-today__section">${sectionHead('03 · Food & Beverage','F&B Today','Daily actual against source forecast, then outlet detail on demand.')}<article class="ui-card ui-today__summary"><div class="ui-today__summary-main"><span>Total F&B</span><strong>${esc(money(daily.revenue))}</strong><p>${esc(`${variance(daily.revenue,daily.forecast)} vs forecast`)}</p></div><div class="ui-today__comparison">${comparisonRow('Food',daily.food,daily.foodForecast)}${comparisonRow('Beverage',daily.beverage,daily.beverageForecast)}${comparisonRow('Other',daily.other,daily.otherForecast)}<div class="ui-today__row"><div><span>Discounts</span><strong>${esc(money(-Math.abs(number(daily.otherDiscount)||0),{compact:true}))}</strong></div><div><span>Covers</span><b>${esc(integer(daily.covers))}</b></div><em>${esc(`${integer(daily.coverForecast)} fcst`)}</em></div></div></article>${outlets.length?`<h3 class="ui-today__subhead">Outlet Performance</h3><div class="ui-today__disclosure-list">${outlets.map(outletDisclosure).join('')}</div>`:''}</section>`;
}
function renderRooms(data){
  const room=currentRooms(data);if(!room)return'';
  const otb=room.otb||{},forecast=room.forecast||{},budget=room.budget||{},stly=room.stly||{},lastYear=room.lastYear||{},pickup=room.pickup||{};
  return`<section class="ui-today__section">${sectionHead('04 · Rooms / Revenue','Current Month',`${dateLabel(room.stayMonth,{monthOnly:true})} on-the-books position and 24-hour pickup.`)}<article class="ui-card ui-today__summary"><div class="ui-today__summary-main"><span>Room Revenue OTB</span><strong>${esc(money(otb.revenue,{compact:true}))}</strong><p>${esc(`${variance(otb.revenue,forecast.revenue)} vs forecast`)}</p></div><div class="ui-today__comparison">${comparisonRow('Occupancy',otb.occupancy,forecast.occupancy,{kind:'percent'})}${comparisonRow('ADR',otb.adr,forecast.adr)}${comparisonRow('RevPAR',otb.revpar,forecast.revpar)}${comparisonRow('Room Nights',otb.rns,forecast.rns,{kind:'integer'})}</div></article><div class="ui-today__benchmark-grid"><article class="ui-card ui-today__benchmark"><span>Budget revenue</span><b>${esc(money(budget.revenue,{compact:true}))}</b></article><article class="ui-card ui-today__benchmark"><span>STLY revenue</span><b>${esc(money(stly.revenue,{compact:true}))}</b></article><article class="ui-card ui-today__benchmark"><span>Last year revenue</span><b>${esc(money(lastYear.revenue,{compact:true}))}</b></article><article class="ui-card ui-today__benchmark"><span>24h pickup</span><b>${esc(`${integer(pickup.rns,{signed:true})} RN · ${money(pickup.revenue,{compact:true,signed:true})}`)}</b></article></div></section>`;
}
function renderOutlook(data){
  const current=String(data.businessDate||'').slice(0,7);
  const months=(data.rooms?.months||[]).filter(item=>String(item?.stayMonth||'').slice(0,7)>current);
  if(!months.length)return'';
  return`<section class="ui-today__section">${sectionHead('05 · Forward outlook','Next Months','OTB position against forecast; detailed month data remains compact.')}<div class="ui-today__outlook-list">${months.map(month=>{const forecastLoaded=(number(month.forecast?.rns)||0)>0||(number(month.forecast?.revenue)||0)>0;return`<article class="ui-card ui-today__outlook-card"><div class="ui-today__outlook-top"><span>${esc(dateLabel(month.stayMonth,{monthOnly:true}))}</span><strong>${esc(percent(month.otb?.occupancy))}</strong></div><p>${esc(forecastLoaded?`${variance(month.otb?.occupancy,month.forecast?.occupancy,{kind:'percent'})} vs occupancy forecast`:'Forecast not loaded')}</p><div class="ui-today__mini-grid"><div class="ui-today__mini"><span>Revenue OTB</span><b>${esc(money(month.otb?.revenue,{compact:true}))}</b></div><div class="ui-today__mini"><span>Room nights</span><b>${esc(integer(month.otb?.rns))}</b></div><div class="ui-today__mini"><span>ADR</span><b>${esc(money(month.otb?.adr))}</b></div><div class="ui-today__mini"><span>24h pickup</span><b>${esc(`${integer(month.pickup?.rns,{signed:true})} RN`)}</b></div></div></article>`}).join('')}</div></section>`;
}
function render(data){return`${renderHero(data)}${renderGlance(data)}${renderFlags(data)}${renderFnb(data)}${renderRooms(data)}${renderOutlook(data)}`}
function loadingMarkup(){return`<section class="ui-today" aria-busy="true"><header class="ui-route-hero"><div class="ui-skeleton ui-skeleton--line"></div><div class="ui-skeleton ui-skeleton--title"></div><div class="ui-skeleton ui-skeleton--line"></div></header><div class="ui-skeleton-stack"><div class="ui-skeleton ui-skeleton--card"></div><div class="ui-skeleton ui-skeleton--card"></div><div class="ui-skeleton ui-skeleton--card"></div></div></section>`}
function errorMarkup(message){return`<section class="ui-today"><header class="ui-route-hero"><p class="ui-eyebrow">Today</p><h1 class="ui-title">Hotel Business</h1><p class="ui-copy">Daily business data is temporarily unavailable.</p></header><article class="ui-card ui-today__state"><h2>Unable to load report</h2><p>${esc(message||'The approved daily business report could not be loaded.')}</p><button class="ui-button ui-button--primary" type="button" data-ui-today-retry>Retry</button></article></section>`}

async function refresh(route,{force=false}={}){
  route.setAttribute('aria-busy','true');
  try{
    if(force)clearBusinessDashboardCache();
    const data=await loadBusinessDashboard({force});
    if(!route.isConnected)return;
    route.innerHTML=render(data);
    route.dataset.businessDate=data.businessDate||'';
    document.dispatchEvent(new CustomEvent('sindhorn:business-dashboard-loaded',{detail:{businessDate:data.businessDate,revision:data.revision,publishedAt:data.publishedAt||data.importedAt}}));
  }catch(error){if(route.isConnected)route.outerHTML=errorMarkup(error?.message)}
  finally{route?.removeAttribute?.('aria-busy')}
}

function toggleDisclosure(button){
  const card=button.closest('[data-ui-disclosure]');if(!card)return;
  const key=card.dataset.uiDisclosure||'';
  const open=!card.classList.contains('is-open');
  card.classList.toggle('is-open',open);
  button.setAttribute('aria-expanded',open?'true':'false');
  if(open)openDisclosures.add(key);else openDisclosures.delete(key);
}

export async function mountTodayRoute(host){
  await ensureStyles();
  host.innerHTML=loadingMarkup();
  let route=host.querySelector('.ui-today');
  const onClick=event=>{
    const disclosureButton=event.target.closest('[data-ui-disclosure-button]');
    if(disclosureButton&&host.contains(disclosureButton)){toggleDisclosure(disclosureButton);return}
    if(event.target.closest('[data-ui-today-retry]')){
      host.innerHTML=loadingMarkup();
      route=host.querySelector('.ui-today');
      void refresh(route,{force:true});
    }
  };
  const onRefreshRequest=()=>{if(route?.isConnected)void refresh(route,{force:true})};
  host.addEventListener('click',onClick);
  document.addEventListener('sindhorn:business-dashboard-refresh-request',onRefreshRequest);
  await refresh(route);
  activeController={refresh:()=>route?.isConnected?refresh(route,{force:true}):Promise.resolve()};
  window.SindhornBusinessDashboard=activeController;
  return()=>{
    host.removeEventListener('click',onClick);
    document.removeEventListener('sindhorn:business-dashboard-refresh-request',onRefreshRequest);
    if(window.SindhornBusinessDashboard===activeController)delete window.SindhornBusinessDashboard;
    activeController=null;
    host.replaceChildren();
  };
}
