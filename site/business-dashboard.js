import {loadBusinessDashboard,clearBusinessDashboardCache} from './business-dashboard-data.js';
import {applyBusinessDashboardMotion} from './business-dashboard-motion.js';

let stylesPromise=null;
let activeController=null;
const openDisclosureKeys=new Set();

const STYLE_DEPS=Object.freeze([
  ['data-business-dashboard-disclosure-style','/hotel-factsheet.css?v=2'],
  ['data-business-dashboard-style','/business-dashboard.css?v=4'],
  ['data-business-dashboard-motion-style','/business-dashboard-motion.css?v=1']
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
const num=value=>Number.isFinite(Number(value))?Number(value):null;
const disclosureChevron='<svg class="factsheet-room-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg>';

function money(value,{compact=false,signed=false}={}){
  const n=num(value);
  if(n===null)return'—';
  const abs=Math.abs(n),sign=n<0?'−':signed&&n>0?'+':'';
  let body;
  if(compact&&abs>=1_000_000)body=`${(abs/1_000_000).toFixed(abs>=10_000_000?1:2).replace(/\.0+$/,'')}M`;
  else if(compact&&abs>=100_000)body=`${Math.round(abs/1000)}K`;
  else body=Math.round(abs).toLocaleString('en-US');
  return`${sign}฿${body}`;
}
function integer(value,{signed=false}={}){
  const n=num(value);if(n===null)return'—';
  const sign=n<0?'−':signed&&n>0?'+':'';
  return`${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
function percent(value,{signed=false,digits=1}={}){
  const n=num(value);if(n===null)return'—';
  const p=n*100,sign=p<0?'−':signed&&p>0?'+':'';
  return`${sign}${Math.abs(p).toFixed(digits)}%`;
}
function dateLabel(value,{monthOnly=false}={}){
  const d=new Date(`${String(value).slice(0,10)}T00:00:00+07:00`);
  if(Number.isNaN(d.valueOf()))return String(value||'');
  return new Intl.DateTimeFormat('en-GB',monthOnly?{month:'short',year:'2-digit'}:{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(d);
}
function shortDateLabel(value){
  const raw=String(value||'').slice(0,10);
  const d=new Date(`${raw}T00:00:00+07:00`);
  if(Number.isNaN(d.valueOf()))return String(value||'');
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(d);
}
function dateTimeLabel(value){
  const d=new Date(value);
  if(Number.isNaN(d.valueOf()))return String(value||'');
  const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(d);
  const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);
  return`${date} · ${time} ICT`;
}
function sourceFor(data,type){return(data.sources||[]).find(source=>source?.type===type)||null}
function variance(actual,forecast,{moneyValue=true}={}){
  const a=num(actual),f=num(forecast);
  if(a===null||f===null||f===0)return'No forecast comparison';
  const diff=a-f,pct=diff/f;
  return`${moneyValue?money(diff,{compact:true,signed:true}):integer(diff,{signed:true})} · ${percent(pct,{signed:true})} vs forecast`;
}
function sectionHead(kicker,title,copy=''){
  return`<header class="bd-section-head"><p class="bd-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2>${copy?`<p>${esc(copy)}</p>`:''}</header>`;
}
function varianceTrack(actual,reference,{referencePosition=80}={}){
  const a=num(actual),r=num(reference);
  if(a===null||r===null||r<=0)return'';
  const position=Math.max(0,Math.min(100,(a/r)*referencePosition));
  return`<div class="bd-variance-track" aria-hidden="true"><span class="bd-variance-reference" style="--bd-reference:${referencePosition}"></span><span class="bd-variance-actual" style="--bd-position:${position.toFixed(2)}"></span></div>`;
}
function motionValue(key,value,format,{pickup=false}={}){
  const n=num(value);
  const attrs=n===null?'':` data-bd-motion-key="${esc(key)}" data-bd-motion-value="${esc(n)}" data-bd-motion-format="${esc(format)}"${pickup?' data-bd-pickup="true"':''}`;
  return{attrs};
}
function metricCard({label,value,comparison='',meta='',motionKey='',motionValue:rawValue=null,motionFormat='',pickup=false,trackActual=null,trackReference=null}){
  const motion=motionKey?motionValue(motionKey,rawValue,motionFormat,{pickup}):{attrs:''};
  return`<article class="bd-metric"${pickup?' data-bd-pickup-card="true"':''}><span>${esc(label)}</span><strong${motion.attrs}>${esc(value)}</strong>${comparison?`<p>${esc(comparison)}</p>`:''}${meta?`<small>${esc(meta)}</small>`:''}${trackActual!==null&&trackReference!==null?varianceTrack(trackActual,trackReference):''}</article>`;
}
function comparisonRow(label,actual,reference,{kind='money',referenceLabel='Forecast'}={}){
  const a=num(actual),r=num(reference),diff=a!==null&&r!==null?a-r:null;
  const f=kind==='percent'?v=>percent(v):kind==='integer'?v=>integer(v):v=>money(v,{compact:true});
  const delta=diff===null?'—':kind==='percent'?`${diff>=0?'+':'−'}${Math.abs(diff*100).toFixed(1)} pp`:kind==='integer'?integer(diff,{signed:true}):money(diff,{compact:true,signed:true});
  return`<div class="bd-comparison-row"><div><span>${esc(label)}</span><strong>${esc(f(a))}</strong></div><div class="bd-comparison-reference"><span>${esc(referenceLabel)}</span><b>${esc(f(r))}</b></div><div class="bd-comparison-delta">${esc(delta)}</div></div>`;
}
function currentRooms(data){
  const month=String(data.businessDate).slice(0,7);
  return data.rooms?.months?.find(item=>String(item.stayMonth).slice(0,7)===month)||data.rooms?.months?.[0]||null;
}
function disclosureCard({key,className='',eyebrow,title,meta='',body}){
  const disclosureKey=String(key||`${className}:${eyebrow}:${title}`),open=openDisclosureKeys.has(disclosureKey);
  return`<article class="factsheet-room-card bd-disclosure ${esc(className)}${open?' is-open':''}" data-bd-disclosure-key="${esc(disclosureKey)}"><button class="factsheet-room-card-button bd-disclosure-button" type="button" aria-expanded="${String(open)}" data-bd-disclosure-button><span class="factsheet-room-card-copy"><span class="factsheet-room-index">${esc(eyebrow)}</span><strong>${esc(title)}</strong>${meta?`<span class="factsheet-room-bed">${esc(meta)}</span>`:''}</span>${disclosureChevron}</button><div class="factsheet-room-panel bd-disclosure-panel"><div class="factsheet-room-panel-inner"><div class="bd-disclosure-body">${body}</div></div></div></article>`;
}
function renderHero(data){
  const fnbSource=sourceFor(data,'fnb_xlsx'),roomsSource=sourceFor(data,'rooms_pdf'),roomsCarried=Boolean(roomsSource?.metadata?.carriedForwardFromRun),pickupTo=roomsSource?.metadata?.pickupTo;
  return`<header class="app-route-hero bd-hero"><p class="app-route-eyebrow">Today</p><h1 class="app-route-title">Hotel Business</h1><p class="app-route-copy">${esc(dateLabel(data.businessDate))} · Daily operating pulse from approved F&amp;B and Rooms reports.</p><div class="bd-update-stamp"><span>Data updated</span><strong>${esc(dateTimeLabel(data.publishedAt||data.importedAt))}</strong><small>${esc(data.validationStatus==='passed_with_warnings'?'Validated with source warnings':'Validated')}</small></div><div class="bd-source-freshness"><div class="bd-source-freshness-row"><span>F&amp;B report</span><div><strong>${esc(shortDateLabel(fnbSource?.detectedReportDate||data.businessDate))}</strong><small>Revision ${esc(data.revision)}</small></div></div><div class="bd-source-freshness-row"><span>Rooms report</span><div><strong>${esc(shortDateLabel(roomsSource?.detectedReportDate||data.businessDate))}</strong><small>${esc(`${pickupTo?`Pickup through ${shortDateLabel(pickupTo)}`:'Approved source'}${roomsCarried?' · carried forward unchanged':''}`)}</small></div></div></div></header>`;
}
function renderGlance(data){
  const f=data.fnb?.summary||{},daily=f.daily||{},mtd=f.mtd||{},rooms=currentRooms(data),otb=rooms?.otb||{},pickup=rooms?.pickup||{};
  const occDelta=rooms&&num(otb.occupancy)!==null&&num(rooms.forecast?.occupancy)!==null?num(otb.occupancy)-num(rooms.forecast?.occupancy):null;
  const fnbSource=sourceFor(data,'fnb_xlsx'),roomsSource=sourceFor(data,'rooms_pdf');
  return`<section class="bd-section bd-glance">${sectionHead('01 · Business pulse','At a Glance')}<div class="bd-glance-group" data-domain="fnb"><header class="bd-domain-head"><span>Food &amp; Beverage</span><small>${esc(shortDateLabel(fnbSource?.detectedReportDate||data.businessDate))}</small></header><div class="bd-metric-grid" data-domain="fnb">${metricCard({label:'Today Revenue',value:money(daily.revenue,{compact:true}),comparison:variance(daily.revenue,daily.forecast),motionKey:'fnb.daily.revenue',motionValue:daily.revenue,motionFormat:'money-compact',trackActual:daily.revenue,trackReference:daily.forecast})}${metricCard({label:'MTD Revenue',value:money(mtd.revenue,{compact:true}),comparison:variance(mtd.revenue,mtd.forecast),motionKey:'fnb.mtd.revenue',motionValue:mtd.revenue,motionFormat:'money-compact',trackActual:mtd.revenue,trackReference:mtd.forecast})}</div></div><div class="bd-glance-group" data-domain="rooms"><header class="bd-domain-head"><span>Rooms</span><small>${esc(shortDateLabel(roomsSource?.detectedReportDate||data.businessDate))}</small></header><div class="bd-metric-grid" data-domain="rooms">${metricCard({label:'Occupancy OTB',value:percent(otb.occupancy),comparison:occDelta===null?'':`${occDelta>=0?'+':'−'}${Math.abs(occDelta*100).toFixed(1)} pp vs forecast`,motionKey:'rooms.current.occupancy',motionValue:otb.occupancy,motionFormat:'percent',trackActual:otb.occupancy,trackReference:rooms?.forecast?.occupancy})}${metricCard({label:'ADR',value:money(otb.adr),comparison:rooms?`${money(num(otb.adr)-num(rooms.forecast?.adr),{compact:true,signed:true})} vs forecast`:'',motionKey:'rooms.current.adr',motionValue:otb.adr,motionFormat:'money',trackActual:otb.adr,trackReference:rooms?.forecast?.adr})}${metricCard({label:'RevPAR',value:money(otb.revpar),comparison:rooms?`${money(num(otb.revpar)-num(rooms.forecast?.revpar),{compact:true,signed:true})} vs forecast`:'',motionKey:'rooms.current.revpar',motionValue:otb.revpar,motionFormat:'money',trackActual:otb.revpar,trackReference:rooms?.forecast?.revpar})}${metricCard({label:'24h Pickup',value:`${integer(pickup.rns,{signed:true})} RN`,comparison:money(pickup.revenue,{compact:true,signed:true}),meta:pickup.adr?`Pickup ADR ${money(pickup.adr)}`:'',motionKey:'rooms.current.pickup.rns',motionValue:pickup.rns,motionFormat:'integer-rn-signed',pickup:true})}</div></div></section>`;
}
function renderFlags(data){
  const flags=Array.isArray(data.flags)?data.flags:[];
  if(!flags.length)return'';
  const groups=new Map();
  for(const flag of flags){const key=String(flag.domain||'other').toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(flag)}
  return`<section class="bd-section">${sectionHead('02 · Exceptions','Needs Attention','Rule-based exceptions from the approved daily dataset.')}<div class="bd-flag-groups">${[...groups.entries()].map(([domain,items])=>`<div class="bd-flag-group"><div class="bd-domain-head bd-domain-head-compact"><span>${esc(domain==='fnb'?'Food & Beverage':domain==='rooms'?'Rooms':domain)}</span><small>${items.length} exception${items.length===1?'':'s'}</small></div><div class="bd-flag-list">${items.map(flag=>`<article class="bd-flag" data-bd-flag-key="${esc(`${domain}:${flag.scopeKey||flag.scope_key||flag.title||''}:${flag.metricKey||flag.metric_key||''}`)}" data-severity="${esc(flag.severity)}"><div><strong>${esc(flag.title)}</strong><p>${esc(flag.detail)}</p></div>${flag.payload?.variancePct!==undefined?`<b>${esc(percent(flag.payload.variancePct,{signed:true}))}</b>`:''}</article>`).join('')}</div></div>`).join('')}</div></section>`;
}
function renderOutlet(outlet){
  const dayparts=Array.isArray(outlet.dayparts)?outlet.dayparts:[];
  const body=`<div class="bd-mini-grid"><div><span>Forecast</span><b>${esc(num(outlet.forecast)>0?money(outlet.forecast,{compact:true}):'—')}</b></div><div><span>Covers</span><b>${esc(integer(outlet.covers))}</b></div><div><span>Food</span><b>${esc(money(outlet.foodNet,{compact:true}))}</b></div><div><span>Beverage</span><b>${esc(money(outlet.beverageNet,{compact:true}))}</b></div></div>${dayparts.map(day=>`<div class="bd-daypart"><div><span>${esc(day.label)}</span><b>${esc(money(day.revenue,{compact:true}))}</b></div><small>${esc(integer(day.covers))} covers · Food ${esc(money(day.foodNet,{compact:true}))} · Beverage ${esc(money(day.beverageNet,{compact:true}))}</small></div>`).join('')}`;
  return disclosureCard({key:`outlet:${outlet.key}`,className:'bd-outlet',eyebrow:outlet.label,title:money(outlet.revenue,{compact:true}),meta:num(outlet.forecast)>0?variance(outlet.revenue,outlet.forecast):'Forecast not loaded',body});
}
function renderFnb(data){
  const s=data.fnb?.summary||{},d=s.daily||{},outlets=data.fnb?.outlets||[],totalMotion=motionValue('fnb.daily.total',d.revenue,'money');
  return`<section class="bd-section">${sectionHead('03 · Food & Beverage','F&B Today','Daily actual against source forecast, then outlet detail on demand.')}<div class="bd-summary-surface"><div class="bd-summary-main"><span>Total F&B</span><strong${totalMotion.attrs}>${esc(money(d.revenue))}</strong><p>${esc(variance(d.revenue,d.forecast))}</p>${varianceTrack(d.revenue,d.forecast)}</div><div class="bd-comparison-stack">${comparisonRow('Food',d.food,d.foodForecast)}${comparisonRow('Beverage',d.beverage,d.beverageForecast)}${comparisonRow('Other',d.other,d.otherForecast)}<div class="bd-comparison-row"><div><span>Discounts</span><strong>${esc(money(-Math.abs(num(d.otherDiscount)||0),{compact:true}))}</strong></div><div class="bd-comparison-reference"><span>Covers</span><b>${esc(integer(d.covers))}</b></div><div class="bd-comparison-delta">${esc(integer(d.coverForecast))} fcst</div></div></div></div><h3 class="bd-subhead">Outlet Performance</h3><div class="bd-disclosure-list">${outlets.map(renderOutlet).join('')}</div></section>`;
}
function renderRooms(data){
  const room=currentRooms(data);if(!room)return'';
  const o=room.otb||{},f=room.forecast||{},b=room.budget||{},s=room.stly||{},ly=room.lastYear||{},p=room.pickup||{},revenueMotion=motionValue('rooms.current.revenue',o.revenue,'money-compact'),pickupRevenueMotion=motionValue('rooms.current.pickup.revenue',p.revenue,'money-compact-signed',{pickup:true});
  return`<section class="bd-section">${sectionHead('04 · Rooms / Revenue','Current Month',`${dateLabel(room.stayMonth,{monthOnly:true})} on-the-books position and 24-hour pickup.`)}<div class="bd-summary-surface"><div class="bd-summary-main"><span>Room Revenue OTB</span><strong${revenueMotion.attrs}>${esc(money(o.revenue,{compact:true}))}</strong><p>${esc(variance(o.revenue,f.revenue))}</p>${varianceTrack(o.revenue,f.revenue)}</div><div class="bd-comparison-stack">${comparisonRow('Occupancy',o.occupancy,f.occupancy,{kind:'percent'})}${comparisonRow('ADR',o.adr,f.adr)}${comparisonRow('RevPAR',o.revpar,f.revpar)}${comparisonRow('Room Nights',o.rns,f.rns,{kind:'integer'})}</div></div><div class="bd-benchmark-grid"><div><span>Budget revenue</span><b>${esc(money(b.revenue,{compact:true}))}</b></div><div><span>STLY revenue</span><b>${esc(money(s.revenue,{compact:true}))}</b></div><div><span>Last year revenue</span><b>${esc(money(ly.revenue,{compact:true}))}</b></div><div><span>24h pickup</span><b><span>${esc(`${integer(p.rns,{signed:true})} RN`)}</span> · <span${pickupRevenueMotion.attrs}>${esc(money(p.revenue,{compact:true,signed:true}))}</span></b></div></div></section>`;
}
function outlookTrack(actual,forecast,loaded){
  if(!loaded)return'';
  const a=num(actual),f=num(forecast);if(a===null||f===null||f<=0)return'';
  const position=Math.max(0,Math.min(100,(a/f)*80));
  return`<div class="bd-outlook-track" aria-hidden="true"><span class="bd-outlook-reference"></span><span class="bd-outlook-marker" style="--bd-outlook-position:${position.toFixed(2)}"></span></div>`;
}
function renderOutlook(data){
  const current=String(data.businessDate).slice(0,7),months=(data.rooms?.months||[]).filter(item=>String(item.stayMonth).slice(0,7)>current);
  return`<section class="bd-section">${sectionHead('05 · Forward outlook','Next Months','OTB position against forecast; detailed market segments stay collapsed below.')}<div class="bd-outlook-strip">${months.map(m=>{const forecastLoaded=(num(m.forecast?.rns)||0)>0||(num(m.forecast?.revenue)||0)>0,monthKey=String(m.stayMonth).slice(0,7),occMotion=motionValue(`rooms.${monthKey}.occupancy`,m.otb?.occupancy,'percent');return`<article class="bd-outlook-card"><span>${esc(dateLabel(m.stayMonth,{monthOnly:true}))}</span><strong${occMotion.attrs}>${esc(percent(m.otb?.occupancy))}</strong><p>${forecastLoaded?`${esc(percent(m.forecast?.occupancy))} forecast occupancy`:'Forecast not loaded'}</p>${outlookTrack(m.otb?.occupancy,m.forecast?.occupancy,forecastLoaded)}<dl><div><dt>OTB Revenue</dt><dd>${esc(money(m.otb?.revenue,{compact:true}))}</dd></div><div><dt>Forecast</dt><dd>${forecastLoaded?esc(money(m.forecast?.revenue,{compact:true})):'—'}</dd></div><div><dt>24h Pickup</dt><dd>${esc(`${integer(m.pickup?.rns,{signed:true})} RN`)}</dd></div></dl></article>`}).join('')}</div></section>`;
}
function renderSegments(data){
  const current=String(data.businessDate).slice(0,7),keys=new Set(['transient','corporate','wholesale','package','pnp_disc','group','airline_crew']),segments=(data.rooms?.segments||[]).filter(s=>String(s.stayMonth).slice(0,7)===current&&keys.has(s.key)),body=segments.map(s=>`<div class="bd-segment-row"><div><span>${esc(s.label)}</span><strong>${esc(`${integer(s.otb?.rns)} RN`)}</strong></div><div><span>OTB</span><b>${esc(money(s.otb?.revenue,{compact:true}))}</b></div><div><span>Forecast</span><b>${esc(money(s.forecast?.revenue,{compact:true}))}</b></div><div><span>24h</span><b>${esc(`${integer(s.pickup?.rns,{signed:true})} RN`)}</b></div></div>`).join('');
  return`<section class="bd-section">${sectionHead('06 · Market mix','Market Segment Detail','Source hierarchy retained; headline segment detail is collapsed by default.')}${disclosureCard({key:'segments:current',className:'bd-segment-group',eyebrow:'Current month',title:'Open segment mix',meta:`${segments.length} headline segments`,body})}</section>`;
}
function renderNotes(data){
  const notes=data.fnb?.notes||[],groups=new Map();
  for(const note of notes){if(!groups.has(note.outletKey))groups.set(note.outletKey,{key:note.outletKey,label:note.outlet,items:[]});groups.get(note.outletKey).items.push(note)}
  if(!groups.size)return'';
  return`<section class="bd-section">${sectionHead('07 · Daily operations','Operations Notes','Original hotel comments, grouped by outlet and daypart.')}<div class="bd-disclosure-list">${[...groups.values()].map(group=>disclosureCard({key:`note:${group.key}`,className:'bd-note',eyebrow:'Outlet',title:group.label,meta:`${group.items.length} note${group.items.length===1?'':'s'}`,body:group.items.map(note=>`<article class="bd-note-item"><span>${esc(note.daypart)}</span><p>${esc(note.displayText)}</p></article>`).join('')})).join('')}</div></section>`;
}
function renderSources(data){return`<footer class="bd-source"><span>Updated ${esc(dateTimeLabel(data.publishedAt||data.importedAt))} · revision ${esc(data.revision)}</span><p>${(data.sources||[]).map(source=>esc(source.filename)).join(' · ')}</p></footer>`}
function render(data){return`${renderHero(data)}${renderGlance(data)}${renderFlags(data)}${renderFnb(data)}${renderRooms(data)}${renderOutlook(data)}${renderSegments(data)}${renderNotes(data)}${renderSources(data)}`}
function errorMarkup(message){return`<header class="app-route-hero"><p class="app-route-eyebrow">Today</p><h1 class="app-route-title">Hotel Business</h1><p class="app-route-copy">Daily business data is temporarily unavailable.</p></header><section class="bd-empty"><strong>Unable to load the approved report</strong><p>${esc(message||'Try again when the connection is available.')}</p><button class="app-quiet-action" type="button" data-bd-retry><span>Try again</span></button></section>`}
function toggleDisclosure(button){
  const card=button.closest('.bd-disclosure');if(!card)return;
  const open=button.getAttribute('aria-expanded')!=='true',key=card.dataset.bdDisclosureKey;
  button.setAttribute('aria-expanded',String(open));card.classList.toggle('is-open',open);
  if(key){if(open)openDisclosureKeys.add(key);else openDisclosureKeys.delete(key)}
}
async function refreshRoute(host,{force=false,reason='load'}={}){
  if(!host?.isConnected)return;
  host.setAttribute('aria-busy','true');
  try{
    if(force)clearBusinessDashboardCache();
    const data=await loadBusinessDashboard({force});
    if(!host.isConnected)return;
    host.removeAttribute('data-bd-motion-ready');
    host.innerHTML=render(data);
    host.dataset.businessDate=data.businessDate||'';
    requestAnimationFrame(()=>applyBusinessDashboardMotion(host,data,{reason}));
    document.dispatchEvent(new CustomEvent('sindhorn:business-dashboard-loaded',{detail:{businessDate:data.businessDate,revision:data.revision,publishedAt:data.publishedAt||data.importedAt}}));
  }catch(error){if(host.isConnected)host.innerHTML=errorMarkup(error?.message)}finally{host?.removeAttribute('aria-busy')}
}

export async function mountBusinessDashboardRoute(host){
  await ensureStyles();
  const route=document.createElement('section');
  route.className='business-dashboard-route';
  route.innerHTML='<header class="app-route-hero"><p class="app-route-eyebrow">Today</p><h1 class="app-route-title">Hotel Business</h1><p class="app-route-copy">Loading the latest approved daily business report…</p></header>';
  host.appendChild(route);
  const onClick=event=>{
    const disclosure=event.target.closest('[data-bd-disclosure-button]');
    if(disclosure&&route.contains(disclosure)){toggleDisclosure(disclosure);return}
    if(event.target.closest('[data-bd-retry]'))refreshRoute(route,{force:true,reason:'retry'});
  };
  const onRefreshRequest=()=>refreshRoute(route,{force:true,reason:'external'});
  route.addEventListener('click',onClick);
  document.addEventListener('sindhorn:business-dashboard-refresh-request',onRefreshRequest);
  await refreshRoute(route,{reason:'load'});
  activeController={refresh:()=>refreshRoute(route,{force:true,reason:'manual'})};
  window.SindhornBusinessDashboard=activeController;
  return()=>{
    route.removeEventListener('click',onClick);
    document.removeEventListener('sindhorn:business-dashboard-refresh-request',onRefreshRequest);
    if(window.SindhornBusinessDashboard===activeController)delete window.SindhornBusinessDashboard;
    activeController=null;
    route.remove();
  };
}
