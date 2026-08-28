import {FNB_PROMOTIONS as DATA} from './fnb-data.js';

const STATE_KEY='sindhorn-midtown:fnb-local:v1';
const OUTLETS=['ALL','ANJU',"Bangkok'78",'Sip & Co.','Horizon Pool Bar','The Lobby Lounge'];
const MONTHS=['ALL','SEP','OCT','NOV','DEC'];
const MONTH_INDEX={SEP:8,OCT:9,NOV:10,DEC:11};

function ensureStylesheet(){
  if(document.querySelector('link[data-fnb-style]'))return Promise.resolve();
  return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/fnb.css?v=1';link.dataset.fnbStyle='true';link.onload=resolve;link.onerror=resolve;document.head.appendChild(link)});
}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function safeFolder(value){if(!value)return null;try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname.endsWith('sharepoint.com')||url.hostname.endsWith('1drv.ms')||url.hostname.endsWith('onedrive.live.com'))?url.href:null}catch(_){return null}}
function bangkokToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),map={};parts.forEach(part=>map[part.type]=part.value);return new Date(`${map.year}-${map.month}-${map.day}T00:00:00+07:00`)}
function campaignInMonth(campaign,key){if(key==='ALL')return true;const month=MONTH_INDEX[key],from=new Date(2026,month,1),to=new Date(2026,month+1,0,23,59,59),start=new Date(campaign.start+'T00:00:00'),end=new Date(campaign.end+'T23:59:59');return start<=to&&end>=from}
function campaignStatus(campaign,today){const start=new Date(campaign.start+'T00:00:00+07:00'),end=new Date(campaign.end+'T23:59:59+07:00');if(today<start)return'UPCOMING';if(today<=end)return'LIVE';return'ENDED'}
function campaignRelative(campaign,today){const start=new Date(campaign.start+'T00:00:00+07:00'),days=Math.ceil((start-today)/86400000);if(days>1)return`Starts in ${days} days`;if(days===1)return'Starts tomorrow';if(days===0)return'Starts today';const end=new Date(campaign.end+'T23:59:59+07:00');return today<=end?'Live now':'Ended'}
function statusLabel(status){return status==='LIVE'?'Live':status==='ENDED'?'Ended':'Upcoming'}
function uniqueValue(values,fallback='Varies by outlet'){const unique=[...new Set(values)];return unique.length===1?unique[0]:fallback}

const TEMPLATE=`
<section class="fnb-route" aria-labelledby="fnbTitle">
  <div class="fnb-index" data-index>
    <header class="fnb-hero">
      <p class="fnb-eyebrow">Food &amp; Beverage</p>
      <h1 id="fnbTitle">Promotions</h1>
      <div class="fnb-period">September – December 2026</div>
      <div class="fnb-summary" data-summary></div>
    </header>
    <div class="fnb-control">
      <label class="fnb-select"><span class="fnb-select-label">Outlet</span><select data-outlet-select aria-label="Filter by outlet">${OUTLETS.map(outlet=>`<option value="${esc(outlet)}">${esc(outlet==='ALL'?'All outlets':outlet)}</option>`).join('')}</select></label>
      <label class="fnb-select"><span class="fnb-select-label">Month</span><select data-month-select aria-label="Filter by month">${MONTHS.map(key=>`<option value="${key}">${key==='ALL'?'All months':key[0]+key.slice(1).toLowerCase()}</option>`).join('')}</select></label>
    </div>
    <div class="fnb-card-list" data-cards></div>
  </div>
  <div class="fnb-detail" data-detail hidden></div>
  <nav class="fnb-section-rail" data-section-rail aria-label="Promotion sections">
    <button class="fnb-chip is-active" type="button" data-section="overview">Overview</button>
    <button class="fnb-chip" type="button" data-section="brief">Brief</button>
    <button class="fnb-chip" type="button" data-section="copy">Copy</button>
    <button class="fnb-chip" type="button" data-section="artwork">Artwork</button>
  </nav>
  <div class="fnb-sheet-layer" data-sheet-layer aria-hidden="true">
    <section class="fnb-sheet" role="dialog" aria-modal="true" aria-labelledby="fnbSheetTitle">
      <div class="fnb-sheet-head"><h2 id="fnbSheetTitle" data-sheet-title>More</h2><button class="fnb-sheet-close" type="button" data-sheet-close aria-label="Close">×</button></div>
      <div data-sheet-body></div>
    </section>
  </div>
  <div class="fnb-toast" data-toast hidden></div>
</section>`;

export async function mountFnbRoute(root,{profile}={}){
  await ensureStylesheet();
  let disposed=false,filter='ALL',month='ALL',current=null,indexScroll=0,observer=null;
  const openActivations=new Set();
  const editor=String(profile?.employee_number||'')==='10639'||String(profile?.employee_number||'')==='CI-SMOKE-TEST';
  let state={checks:{},links:{}};
  try{const saved=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');state={checks:saved.checks||{},links:saved.links||{}}}catch(_){}
  const today=bangkokToday();
  root.innerHTML=TEMPLATE;
  const route=root.querySelector('.fnb-route');route.classList.toggle('is-editor',editor);
  const q=selector=>route.querySelector(selector),qa=selector=>[...route.querySelectorAll(selector)];

  function save(){try{localStorage.setItem(STATE_KEY,JSON.stringify(state))}catch(_){}}
  function isDone(id){return!!state.checks[id]}
  function linkFor(activation){return Object.prototype.hasOwnProperty.call(state.links,activation.id)?state.links[activation.id]:activation.artworkUrl}
  function visibleActivations(campaign,respectFilter=true){return campaign.activations.filter(activation=>!respectFilter||filter==='ALL'||activation.outlet===filter)}
  function counts(campaign,respectFilter=true){let total=0,done=0;visibleActivations(campaign,respectFilter).forEach(activation=>activation.artworks.forEach(item=>{total++;if(isDone(item.id))done++}));return{total,done}}
  function filteredCampaigns(){return DATA.filter(campaign=>(filter==='ALL'||campaign.activations.some(activation=>activation.outlet===filter))&&campaignInMonth(campaign,month))}
  function outlets(campaign){return campaign.activations.map(activation=>activation.outlet).join(' + ')}
  function existingLinks(campaign){return campaign.activations.map(activation=>({activation,url:safeFolder(linkFor(activation))})).filter(item=>item.url)}
  function toast(message){const el=q('[data-toast]');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{if(el.isConnected)el.hidden=true},2100)}

  function renderFilters(){const select=q('[data-outlet-select]');if(select.value!==filter)select.value=filter}
  function renderMonthRail(){const select=q('[data-month-select]');if(select.value!==month)select.value=month}
  function statBlock(label,value){return`<div class="fnb-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
  function renderSummary(){const campaigns=filteredCampaigns();let total=0,done=0,live=0;campaigns.forEach(campaign=>{const n=counts(campaign,true);total+=n.total;done+=n.done;if(campaignStatus(campaign,today)==='LIVE')live++});q('[data-summary]').innerHTML=statBlock('Promotions',campaigns.length)+statBlock('Live now',live)+statBlock('Artwork done',`${done}/${total}`)}
  function cardHTML(campaign){const n=counts(campaign,true),percent=n.total?n.done/n.total*100:0,status=campaignStatus(campaign,today);return`<article class="fnb-card fnb-status-${status.toLowerCase()}"><button class="fnb-card-button" type="button" data-open="${esc(campaign.id)}"><div class="fnb-card-status"><span class="fnb-utility fnb-status-${status.toLowerCase()}">${status}</span><span class="fnb-card-relative">${esc(campaignRelative(campaign,today))}</span></div><h2 class="fnb-card-title">${esc(campaign.title)}</h2><p class="fnb-card-outlets">${esc(outlets(campaign))}</p><p class="fnb-card-date">${esc(campaign.dateLabel)}</p><div class="fnb-progress"><div class="fnb-progress-meta"><span>Artwork</span><b>${n.done} / ${n.total}</b></div><div class="fnb-progress-track"><i style="width:${percent}%"></i></div></div><div class="fnb-card-foot"><span>${esc(campaign.summary)}</span><span class="fnb-chevron">›</span></div></button></article>`}
  function renderCards(){const campaigns=filteredCampaigns();q('[data-cards]').innerHTML=campaigns.length?campaigns.map(cardHTML).join(''):'<div class="fnb-empty">No promotions match these filters.</div>'}
  function renderIndex(){renderFilters();renderMonthRail();renderSummary();renderCards()}

  function taskRows(activation){return activation.artworks.map(item=>`<div class="fnb-task${isDone(item.id)?' is-done':''}"><button class="fnb-task-toggle" type="button" data-task="${esc(item.id)}" ${editor?'':'disabled'} aria-label="${isDone(item.id)?'Mark pending':'Mark complete'}"></button><span class="fnb-task-name">${esc(item.name)}</span></div>`).join('')}
  function activationHTML(activation){const total=activation.artworks.length,done=activation.artworks.filter(item=>isDone(item.id)).length,complete=total>0&&done===total,open=openActivations.has(activation.id);return`<article class="fnb-art-card${complete?' is-complete':''}${open?' is-open':''}" data-activation="${esc(activation.id)}"><button class="fnb-art-head" type="button" data-art-toggle aria-expanded="${open}"><span class="fnb-art-head-text"><strong>${esc(activation.outlet)}</strong><span class="fnb-art-meta">${esc(activation.time)} · IHG One Rewards ${esc(activation.discount)}</span></span><span class="fnb-art-tally">${done}/${total}<i>${complete?'✓':''}</i></span><span class="fnb-art-chevron" aria-hidden="true"></span></button><div class="fnb-task-list">${taskRows(activation)}</div></article>`}
  function textCard(label,text,lang=''){const labelHTML=label?`<p class="fnb-text-label">${esc(label)}</p>`:'';if(!text)return`<article class="fnb-text-card">${labelHTML}<div class="fnb-text-copy fnb-missing"${lang?` lang="${lang}"`:''}>${lang==='th'?'Thai copy was not supplied in the source workbook.':'Not supplied in the source workbook.'}</div></article>`;const expandable=text.length>380||text.split('\n').length>8;return`<article class="fnb-text-card">${labelHTML}<div class="fnb-text-copy${expandable?' is-collapsed':''}"${lang?` lang="${lang}"`:''}>${esc(text)}</div>${expandable?'<button class="fnb-expand" type="button">Show full</button>':''}</article>`}
  function briefHTML(campaign){const specific=campaign.activations.some(activation=>activation.brief);return specific?campaign.activations.map(activation=>`<div class="fnb-copy-outlet">${esc(activation.outlet)}</div>${textCard('',activation.brief||campaign.brief)}`).join(''):textCard('',campaign.brief)}
  function copyHTML(campaign){const specific=campaign.activations.some(activation=>activation.copyEn||activation.copyTh);let html='';if(specific){html=`<div class="fnb-copy-outlet">Campaign / Master copy</div>${textCard('English',campaign.copyEn)}${textCard('Thai',campaign.copyTh,'th')}`;html+=campaign.activations.filter(activation=>activation.copyEn||activation.copyTh).map(activation=>`<div class="fnb-copy-outlet">${esc(activation.outlet)}</div>${textCard('English',activation.copyEn)}${textCard('Thai',activation.copyTh,'th')}`).join('');return html}return`${textCard('English',campaign.copyEn)}${textCard('Thai',campaign.copyTh,'th')}`}
  function folderHTML(campaign){const links=existingLinks(campaign);let html='<div class="fnb-folder">';if(links.length)html+=`<button class="fnb-action is-primary" type="button" data-folder-open><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>View artwork folder${links.length>1?'s':''}</button>`;else html+='<div class="fnb-folder-empty"><span>Artwork folder</span><small>Not linked yet</small></div>';if(editor)html+=`<button class="fnb-action" type="button" data-folder-edit><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>Add / change artwork link</button>`;return html+'</div>'}
  function detailHTML(campaign){const n=counts(campaign,false),status=campaignStatus(campaign,today),time=uniqueValue(campaign.activations.map(activation=>activation.time)),discount=uniqueValue(campaign.activations.map(activation=>activation.discount));return`<div id="overview" class="fnb-detail-head fnb-section"><button class="fnb-back" type="button" data-back aria-label="Back to promotions"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><p class="fnb-eyebrow fnb-status-${status.toLowerCase()}">${status}</p><h1 class="fnb-detail-title">${esc(campaign.title)}</h1><p class="fnb-detail-date">${esc(campaign.dateLabel)}</p><div class="fnb-facts"><div class="fnb-fact"><span>Outlet</span><b>${esc(outlets(campaign))}</b></div><div class="fnb-fact"><span>Time</span><b>${esc(time)}</b></div><div class="fnb-fact"><span>IHG One Rewards</span><b>${esc(discount)}</b></div><div class="fnb-fact"><span>Updated</span><b>28 August 2026</b></div></div></div><section id="brief" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">01 · Promotion brief</p></div>${briefHTML(campaign)}</section><section id="copy" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">02 · Copy</p></div>${copyHTML(campaign)}</section><section id="artwork" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">03 · Artwork</p><span class="fnb-section-count">${n.done} / ${n.total} complete</span></div>${campaign.activations.map(activation=>activationHTML(activation)).join('')}${folderHTML(campaign)}</section>`}

  function setSectionActive(id){qa('[data-section]').forEach(button=>button.classList.toggle('is-active',button.dataset.section===id))}
  function observeDetail(){observer?.disconnect();observer=new IntersectionObserver(entries=>{const hit=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))[0];if(hit)setSectionActive(hit.target.id)},{rootMargin:'-22% 0px -64% 0px',threshold:[0,.08]});['overview','brief','copy','artwork'].forEach(id=>{const el=q('#'+id);if(el)observer.observe(el)})}
  function openDetail(id,{scrollTop=true}={}){const campaign=DATA.find(item=>item.id===id);if(!campaign)return;if(!current)indexScroll=scrollY;current=campaign;q('[data-index]').hidden=true;const detail=q('[data-detail]');detail.innerHTML=detailHTML(campaign);detail.hidden=false;document.body.dataset.fnbDetail='true';setSectionActive('overview');bindDetail();observeDetail();if(scrollTop)scrollTo({top:0,behavior:'auto'})}
  function closeDetail(){current=null;observer?.disconnect();observer=null;q('[data-detail]').hidden=true;q('[data-detail]').replaceChildren();q('[data-index]').hidden=false;delete document.body.dataset.fnbDetail;requestAnimationFrame(()=>scrollTo({top:indexScroll,behavior:'auto'}))}

  function openSheet(title,html){q('[data-sheet-title]').textContent=title;q('[data-sheet-body]').innerHTML=html;const layer=q('[data-sheet-layer]');layer.classList.add('is-open');layer.setAttribute('aria-hidden','false')}
  function closeSheet(){const layer=q('[data-sheet-layer]');layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true')}
  function openFolderList(){if(!current)return;const links=existingLinks(current);openSheet('Artwork folders',`<div class="fnb-link-list">${links.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noopener"><span>${esc(item.activation.outlet)}</span><span>Open ↗</span></a>`).join('')}</div>`)}
  function openLinkEditor(){if(!current||!editor)return;openSheet('Artwork links',current.activations.map(activation=>`<div class="fnb-link-field"><label>${esc(activation.outlet)}</label><input type="url" inputmode="url" data-link="${esc(activation.id)}" value="${esc(linkFor(activation)||'')}" placeholder="Paste OneDrive or SharePoint folder URL"></div>`).join('')+'<p class="fnb-sheet-note">Saved on this device only.</p><button class="fnb-action is-primary" type="button" data-save-links>Save</button>')}
  function bindDetail(){const detail=q('[data-detail]');detail.querySelector('[data-back]')?.addEventListener('click',closeDetail);detail.querySelectorAll('[data-art-toggle]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('.fnb-art-card'),id=card.dataset.activation,open=card.classList.toggle('is-open');if(open)openActivations.add(id);else openActivations.delete(id);button.setAttribute('aria-expanded',String(open))}));detail.querySelectorAll('.fnb-expand').forEach(button=>button.addEventListener('click',()=>{const copy=button.previousElementSibling,collapsed=copy.classList.toggle('is-collapsed');button.textContent=collapsed?'Show full':'Show less'}));detail.querySelectorAll('[data-task]').forEach(button=>{if(!editor)return;button.addEventListener('click',()=>{state.checks[button.dataset.task]=!state.checks[button.dataset.task];save();const id=current?.id;renderIndex();if(id)openDetail(id,{scrollTop:false})})});detail.querySelector('[data-folder-open]')?.addEventListener('click',()=>{const links=existingLinks(current);if(links.length===1)window.open(links[0].url,'_blank','noopener');else openFolderList()});detail.querySelector('[data-folder-edit]')?.addEventListener('click',openLinkEditor)}

  const onClick=event=>{
    const card=event.target.closest('[data-open]');if(card){openDetail(card.dataset.open);return}
    const section=event.target.closest('[data-section]');if(section&&current){q('#'+section.dataset.section)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return}
    if(event.target.closest('[data-sheet-close]')||event.target===q('[data-sheet-layer]')){closeSheet();return}
    if(event.target.closest('[data-save-links]')){let bad=false;q('[data-sheet-body]').querySelectorAll('[data-link]').forEach(input=>{const value=input.value.trim();if(value&&!safeFolder(value)){bad=true;input.focus();return}state.links[input.dataset.link]=value||null});if(bad){toast('Use a OneDrive or SharePoint https link');return}save();closeSheet();const id=current?.id;renderIndex();if(id)openDetail(id,{scrollTop:false});toast('Artwork links saved on this device')}
  };
  route.addEventListener('click',onClick);
  const onChange=event=>{
    if(event.target.matches('[data-outlet-select]')){filter=event.target.value;renderIndex();return}
    if(event.target.matches('[data-month-select]')){month=event.target.value;renderIndex();return}
  };
  route.addEventListener('change',onChange);
  renderIndex();

  return()=>{disposed=true;void disposed;route.removeEventListener('click',onClick);route.removeEventListener('change',onChange);observer?.disconnect();clearTimeout(toast.timer);delete document.body.dataset.fnbDetail};
}
