import {FNB_PROMOTIONS as DATA} from './fnb-data.js';

const STATE_KEY='sindhorn-midtown:fnb-local:v1';
const OUTLETS=['ALL','ANJU',"Bangkok'78",'Sip & Co.','Horizon Pool Bar','The Lobby Lounge'];
const MONTHS=['ALL','SEP','OCT','NOV','DEC'];
const MONTH_INDEX={SEP:8,OCT:9,NOV:10,DEC:11};

function ensureStylesheet(){
  if(document.querySelector('link[data-fnb-style]'))return Promise.resolve();
  return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/fnb.css?v=2&ui=2';link.dataset.fnbStyle='true';link.onload=resolve;link.onerror=resolve;document.head.appendChild(link)});
}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function safeFolder(value){if(!value)return null;try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname.endsWith('sharepoint.com')||url.hostname.endsWith('1drv.ms')||url.hostname.endsWith('onedrive.live.com'))?url.href:null}catch(_){return null}}
function bangkokToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),map={};parts.forEach(part=>map[part.type]=part.value);return new Date(`${map.year}-${map.month}-${map.day}T00:00:00+07:00`)}
function campaignInMonth(campaign,key){if(key==='ALL')return true;const month=MONTH_INDEX[key],from=new Date(2026,month,1),to=new Date(2026,month+1,0,23,59,59),start=new Date(campaign.start+'T00:00:00'),end=new Date(campaign.end+'T23:59:59');return start<=to&&end>=from}
function campaignStatus(campaign,today){const start=new Date(campaign.start+'T00:00:00+07:00'),end=new Date(campaign.end+'T23:59:59+07:00');if(today<start)return'UPCOMING';if(today<=end)return'LIVE';return'ENDED'}
function campaignRelative(campaign,today){const start=new Date(campaign.start+'T00:00:00+07:00'),days=Math.ceil((start-today)/86400000);if(days>1)return`Starts in ${days} days`;if(days===1)return'Starts tomorrow';if(days===0)return'Starts today';const end=new Date(campaign.end+'T23:59:59+07:00');return today<=end?'Live now':'Ended'}
function statusLabel(status){return status==='LIVE'?'Live':status==='ENDED'?'Ended':'Upcoming'}
function uniqueValue(values,fallback='Varies by outlet'){const unique=[...new Set(values)];return unique.length===1?unique[0]:fallback}
function outletLabel(value){return value==='ALL'?'All outlets':value}
function monthLabel(value){return value==='ALL'?'All months':value[0]+value.slice(1).toLowerCase()}
function filterField(kind,label,values,selected,labelFor){const menuId=`fnb-${kind}-menu`;return`<div class="fnb-select" data-filter-field="${kind}"><span class="fnb-select-label">${esc(label)}</span><button class="fnb-select-trigger" type="button" data-filter-trigger="${kind}" aria-label="${esc(label)} filter" aria-haspopup="listbox" aria-expanded="false" aria-controls="${menuId}"><span data-filter-value>${esc(labelFor(selected))}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><select data-${kind}-select hidden tabindex="-1" aria-hidden="true">${values.map(value=>`<option value="${esc(value)}">${esc(labelFor(value))}</option>`).join('')}</select><div class="fnb-select-menu" id="${menuId}" role="listbox" aria-label="${esc(label)}" aria-hidden="true">${values.map(value=>`<button class="fnb-select-option${value===selected?' is-selected':''}" type="button" role="option" aria-selected="${value===selected}" data-filter-option="${kind}" data-value="${esc(value)}"><span>${esc(labelFor(value))}</span><i aria-hidden="true"></i></button>`).join('')}</div></div>`}

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
      ${filterField('outlet','Outlet',OUTLETS,'ALL',outletLabel)}
      ${filterField('month','Month',MONTHS,'ALL',monthLabel)}
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
  let disposed=false,filter='ALL',month='ALL',current=null,indexScroll=0,scrollSpyRaf=0,viewAnimating=false,sectionTarget=null,sectionTargetTimer=0;
  const openActivations=new Set();
  const editor=String(profile?.employee_number||'')==='10639';
  let state={checks:{},links:{}};
  try{const saved=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');state={checks:saved.checks||{},links:saved.links||{}}}catch(_){}
  const today=bangkokToday();
  root.innerHTML=TEMPLATE;
  const route=root.querySelector('.fnb-route');route.classList.toggle('is-editor',editor);
  const q=selector=>route.querySelector(selector),qa=selector=>[...route.querySelectorAll(selector)];
  const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function animateView(el,keyframes,duration){
    if(!el||reducedMotion()||typeof el.animate!=='function')return;
    try{await el.animate(keyframes,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}).finished}catch(_){}
  }
  function animateCardsIn(){
    if(reducedMotion())return;
    qa('.fnb-card').forEach((card,index)=>{try{card.animate([{opacity:.01,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:Math.min(index,6)*34,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'})}catch(_){}})
  }

  function save(){try{localStorage.setItem(STATE_KEY,JSON.stringify(state))}catch(_){}}
  function isDone(id){return!!state.checks[id]}
  function linkFor(activation){return Object.prototype.hasOwnProperty.call(state.links,activation.id)?state.links[activation.id]:activation.artworkUrl}
  function visibleActivations(campaign,respectFilter=true){return campaign.activations.filter(activation=>!respectFilter||filter==='ALL'||activation.outlet===filter)}
  function counts(campaign,respectFilter=true){let total=0,done=0;visibleActivations(campaign,respectFilter).forEach(activation=>activation.artworks.forEach(item=>{total++;if(isDone(item.id))done++}));return{total,done}}
  function filteredCampaigns(){return DATA.filter(campaign=>(filter==='ALL'||campaign.activations.some(activation=>activation.outlet===filter))&&campaignInMonth(campaign,month))}
  function outlets(campaign){return campaign.activations.map(activation=>activation.outlet).join(' + ')}
  function existingLinks(campaign){return campaign.activations.map(activation=>({activation,url:safeFolder(linkFor(activation))})).filter(item=>item.url)}
  function toast(message){const el=q('[data-toast]');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{if(el.isConnected)el.hidden=true},2100)}

  function closeFilterMenus(except=null){qa('[data-filter-field]').forEach(field=>{if(field.dataset.filterField===except)return;field.classList.remove('is-open');field.querySelector('[data-filter-trigger]')?.setAttribute('aria-expanded','false');field.querySelector('.fnb-select-menu')?.setAttribute('aria-hidden','true')})}
  function toggleFilterMenu(kind){const field=q(`[data-filter-field="${kind}"]`),trigger=field?.querySelector('[data-filter-trigger]'),menu=field?.querySelector('.fnb-select-menu');if(!field||!trigger||!menu)return;const open=!field.classList.contains('is-open');closeFilterMenus(kind);field.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-hidden',String(!open));if(open)requestAnimationFrame(()=>field.querySelector('.fnb-select-option.is-selected')?.focus({preventScroll:true}))}
  function renderFilterField(kind,value,labelFor){const field=q(`[data-filter-field="${kind}"]`);if(!field)return;const select=field.querySelector(`select[data-${kind}-select]`);if(select&&select.value!==value)select.value=value;const valueNode=field.querySelector('[data-filter-value]');if(valueNode)valueNode.textContent=labelFor(value);field.querySelectorAll('[data-filter-option]').forEach(option=>{const selected=option.dataset.value===value;option.classList.toggle('is-selected',selected);option.setAttribute('aria-selected',String(selected))})}
  function renderFilters(){renderFilterField('outlet',filter,outletLabel);renderFilterField('month',month,monthLabel)}
  function statBlock(label,value){return`<div class="fnb-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
  function renderSummary(){const campaigns=filteredCampaigns();let total=0,done=0,live=0;campaigns.forEach(campaign=>{const n=counts(campaign,true);total+=n.total;done+=n.done;if(campaignStatus(campaign,today)==='LIVE')live++});q('[data-summary]').innerHTML=statBlock('Promotions',campaigns.length)+statBlock('Live now',live)+statBlock('Artwork done',`${done}/${total}`)}
  function cardHTML(campaign){const n=counts(campaign,true),percent=n.total?n.done/n.total*100:0,status=campaignStatus(campaign,today);return`<article class="fnb-card fnb-status-${status.toLowerCase()}"><button class="fnb-card-button" type="button" data-open="${esc(campaign.id)}"><div class="fnb-card-status"><span class="fnb-utility fnb-status-${status.toLowerCase()}">${status}</span><span class="fnb-card-relative">${esc(campaignRelative(campaign,today))}</span></div><h2 class="fnb-card-title">${esc(campaign.title)}</h2><p class="fnb-card-outlets">${esc(outlets(campaign))}</p><p class="fnb-card-date">${esc(campaign.dateLabel)}</p><div class="fnb-progress"><div class="fnb-progress-meta"><span>Artwork</span><b>${n.done} / ${n.total}</b></div><div class="fnb-progress-track"><i style="width:${percent}%"></i></div></div><div class="fnb-card-foot"><span>${esc(campaign.summary)}</span><span class="fnb-chevron">›</span></div></button></article>`}
  function renderCards(){const campaigns=filteredCampaigns();q('[data-cards]').innerHTML=campaigns.length?campaigns.map(cardHTML).join(''):'<div class="fnb-empty">No promotions match these filters.</div>';requestAnimationFrame(animateCardsIn)}
  function renderIndex(){renderFilters();renderSummary();renderCards()}

  function taskRows(activation){return activation.artworks.map(item=>`<div class="fnb-task${isDone(item.id)?' is-done':''}"><button class="fnb-task-toggle" type="button" data-task="${esc(item.id)}" ${editor?'':'disabled'} aria-label="${isDone(item.id)?'Mark pending':'Mark complete'}"></button><span class="fnb-task-name">${esc(item.name)}</span></div>`).join('')}
  function activationHTML(activation){const total=activation.artworks.length,done=activation.artworks.filter(item=>isDone(item.id)).length,complete=total>0&&done===total,open=openActivations.has(activation.id);return`<article class="fnb-art-card${complete?' is-complete':''}${open?' is-open':''}" data-activation="${esc(activation.id)}"><button class="fnb-art-head" type="button" data-art-toggle aria-expanded="${open}"><span class="fnb-art-head-text"><strong>${esc(activation.outlet)}</strong><span class="fnb-art-meta">${esc(activation.time)} · IHG One Rewards ${esc(activation.discount)}</span></span><span class="fnb-art-tally">${done}/${total}<i>${complete?'✓':''}</i></span><span class="fnb-art-chevron" aria-hidden="true"></span></button><div class="fnb-task-list">${taskRows(activation)}</div></article>`}
  function textCard(label,text,lang=''){const labelHTML=label?`<p class="fnb-text-label">${esc(label)}</p>`:'';if(!text)return`<article class="fnb-text-card">${labelHTML}<div class="fnb-text-copy fnb-missing"${lang?` lang="${lang}"`:''}>${lang==='th'?'Thai copy was not supplied in the source workbook.':'Not supplied in the source workbook.'}</div></article>`;const expandable=text.length>380||text.split('\n').length>8;return`<article class="fnb-text-card">${labelHTML}<div class="fnb-text-copy${expandable?' is-collapsed':''}"${lang?` lang="${lang}"`:''}>${esc(text)}</div>${expandable?'<button class="fnb-expand" type="button" aria-expanded="false">Show full</button>':''}</article>`}
  function briefHTML(campaign){const specific=campaign.activations.some(activation=>activation.brief);return specific?campaign.activations.map(activation=>`<div class="fnb-copy-outlet">${esc(activation.outlet)}</div>${textCard('',activation.brief||campaign.brief)}`).join(''):textCard('',campaign.brief)}
  function copyHTML(campaign){const specific=campaign.activations.some(activation=>activation.copyEn||activation.copyTh);let html='';if(specific){html=`<div class="fnb-copy-outlet">Campaign / Master copy</div>${textCard('English',campaign.copyEn)}${textCard('Thai',campaign.copyTh,'th')}`;html+=campaign.activations.filter(activation=>activation.copyEn||activation.copyTh).map(activation=>`<div class="fnb-copy-outlet">${esc(activation.outlet)}</div>${textCard('English',activation.copyEn)}${textCard('Thai',activation.copyTh,'th')}`).join('');return html}return`${textCard('English',campaign.copyEn)}${textCard('Thai',campaign.copyTh,'th')}`}
  function folderHTML(campaign){const links=existingLinks(campaign);let html='<div class="fnb-folder">';if(links.length)html+=`<button class="fnb-action is-primary" type="button" data-folder-open><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>View artwork folder${links.length>1?'s':''}</button>`;else html+='<div class="fnb-folder-empty"><span>Artwork folder</span><small>Not linked yet</small></div>';if(editor)html+=`<button class="fnb-action" type="button" data-folder-edit><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>Add / change artwork link</button>`;return html+'</div>'}
  function detailHTML(campaign){const n=counts(campaign,false),status=campaignStatus(campaign,today),time=uniqueValue(campaign.activations.map(activation=>activation.time)),discount=uniqueValue(campaign.activations.map(activation=>activation.discount));return`<div id="overview" class="fnb-detail-head fnb-section"><button class="fnb-back" type="button" data-back aria-label="Back to promotions"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><p class="fnb-eyebrow fnb-status-${status.toLowerCase()}">${status}</p><h1 class="fnb-detail-title">${esc(campaign.title)}</h1><p class="fnb-detail-date">${esc(campaign.dateLabel)}</p><div class="fnb-facts"><div class="fnb-fact"><span>Outlet</span><b>${esc(outlets(campaign))}</b></div><div class="fnb-fact"><span>Time</span><b>${esc(time)}</b></div><div class="fnb-fact"><span>IHG One Rewards</span><b>${esc(discount)}</b></div><div class="fnb-fact"><span>Updated</span><b>28 August 2026</b></div></div></div><section id="brief" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">01 · Promotion brief</p></div>${briefHTML(campaign)}</section><section id="copy" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">02 · Copy</p></div>${copyHTML(campaign)}</section><section id="artwork" class="fnb-section"><div class="fnb-section-head"><p class="fnb-section-kicker">03 · Artwork</p><span class="fnb-section-count">${n.done} / ${n.total} complete</span></div>${campaign.activations.map(activation=>activationHTML(activation)).join('')}${folderHTML(campaign)}</section>`}

  function setSectionActive(id){qa('[data-section]').forEach(button=>{const active=button.dataset.section===id;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current')})}
  function holdSectionTarget(id){sectionTarget=id;clearTimeout(sectionTargetTimer);setSectionActive(id);sectionTargetTimer=setTimeout(()=>{sectionTarget=null;updateSectionFromScroll()},900)}
  function releaseSectionTarget(){if(!sectionTarget)return;clearTimeout(sectionTargetTimer);sectionTargetTimer=0;sectionTarget=null;updateSectionFromScroll()}
  function updateSectionFromScroll(){
    if(!current)return;
    if(sectionTarget){setSectionActive(sectionTarget);return}
    const ids=['overview','brief','copy','artwork'];
    const probe=Math.min(innerHeight*.30,238);
    let active='overview';
    const atBottom=scrollY+innerHeight>=document.documentElement.scrollHeight-36;
    if(atBottom)active='artwork';
    else ids.forEach(id=>{const el=q('#'+id);if(el&&el.getBoundingClientRect().top<=probe)active=id});
    setSectionActive(active)
  }
  function scheduleScrollSpy(){if(scrollSpyRaf)return;scrollSpyRaf=requestAnimationFrame(()=>{scrollSpyRaf=0;updateSectionFromScroll()})}
  function observeDetail(){requestAnimationFrame(updateSectionFromScroll)}
  async function openDetail(id,{scrollTop=true,animate=null}={}){
    if(viewAnimating)return;
    const campaign=DATA.find(item=>item.id===id);if(!campaign)return;
    const shouldAnimate=animate??scrollTop,index=q('[data-index]'),detail=q('[data-detail]');
    if(!current)indexScroll=scrollY;viewAnimating=true;closeFilterMenus();
    if(shouldAnimate)await animateView(index,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-14px)'}],180);
    current=campaign;index.hidden=true;detail.innerHTML=detailHTML(campaign);detail.hidden=false;document.body.dataset.fnbDetail='true';setSectionActive('overview');bindDetail();
    if(scrollTop)scrollTo({top:0,behavior:'auto'});observeDetail();
    if(shouldAnimate)await animateView(detail,[{opacity:.02,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],300);
    viewAnimating=false
  }
  async function closeDetail(){
    if(viewAnimating)return;viewAnimating=true;releaseSectionTarget();
    const detail=q('[data-detail]'),index=q('[data-index]');
    await animateView(detail,[{opacity:1,transform:'translateX(0)'},{opacity:.02,transform:'translateX(16px)'}],180);
    current=null;detail.hidden=true;detail.replaceChildren();index.hidden=false;delete document.body.dataset.fnbDetail;scrollTo({top:indexScroll,behavior:'auto'});
    await animateView(index,[{opacity:.02,transform:'translateX(-12px)'},{opacity:1,transform:'translateX(0)'}],280);
    viewAnimating=false
  }

  function openSheet(title,html){q('[data-sheet-title]').textContent=title;q('[data-sheet-body]').innerHTML=html;const layer=q('[data-sheet-layer]');layer.classList.add('is-open');layer.setAttribute('aria-hidden','false')}
  function closeSheet(){const layer=q('[data-sheet-layer]');layer.classList.remove('is-open');layer.setAttribute('aria-hidden','true')}
  function openFolderList(){if(!current)return;const links=existingLinks(current);openSheet('Artwork folders',`<div class="fnb-link-list">${links.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noopener"><span>${esc(item.activation.outlet)}</span><span>Open ↗</span></a>`).join('')}</div>`)}
  function openLinkEditor(){if(!current||!editor)return;openSheet('Artwork links',current.activations.map(activation=>`<div class="fnb-link-field"><label>${esc(activation.outlet)}</label><input type="url" inputmode="url" data-link="${esc(activation.id)}" value="${esc(linkFor(activation)||'')}" placeholder="Paste OneDrive or SharePoint folder URL"></div>`).join('')+'<p class="fnb-sheet-note">Saved on this device only.</p><button class="fnb-action is-primary" type="button" data-save-links>Save</button>')}
  function bindDetail(){const detail=q('[data-detail]');detail.querySelector('[data-back]')?.addEventListener('click',closeDetail);detail.querySelectorAll('[data-art-toggle]').forEach(button=>button.addEventListener('click',()=>{const card=button.closest('.fnb-art-card'),id=card.dataset.activation,open=card.classList.toggle('is-open');if(open)openActivations.add(id);else openActivations.delete(id);button.setAttribute('aria-expanded',String(open))}));detail.querySelectorAll('.fnb-expand').forEach(button=>button.addEventListener('click',()=>{const copy=button.previousElementSibling,collapsed=copy.classList.toggle('is-collapsed');button.textContent=collapsed?'Show full':'Show less';button.setAttribute('aria-expanded',String(!collapsed))}));detail.querySelectorAll('[data-task]').forEach(button=>{if(!editor)return;button.addEventListener('click',()=>{state.checks[button.dataset.task]=!state.checks[button.dataset.task];save();const id=current?.id;renderIndex();if(id)openDetail(id,{scrollTop:false})})});detail.querySelector('[data-folder-open]')?.addEventListener('click',()=>{const links=existingLinks(current);if(links.length===1)window.open(links[0].url,'_blank','noopener');else openFolderList()});detail.querySelector('[data-folder-edit]')?.addEventListener('click',openLinkEditor)}

  const onClick=event=>{
    const option=event.target.closest('[data-filter-option]');if(option){const kind=option.dataset.filterOption,value=option.dataset.value;if(kind==='outlet')filter=value;else if(kind==='month')month=value;closeFilterMenus();renderIndex();q(`[data-filter-trigger="${kind}"]`)?.focus({preventScroll:true});return}
    const trigger=event.target.closest('[data-filter-trigger]');if(trigger){toggleFilterMenu(trigger.dataset.filterTrigger);return}
    closeFilterMenus();
    const card=event.target.closest('[data-open]');if(card){openDetail(card.dataset.open);return}
    const section=event.target.closest('[data-section]');if(section&&current){const id=section.dataset.section,target=q('#'+id);holdSectionTarget(id);if(target){const top=Math.max(0,target.getBoundingClientRect().top+scrollY-72);scrollTo({top,behavior:reducedMotion()?'auto':'smooth'});if(reducedMotion())releaseSectionTarget()}return}
    if(event.target.closest('[data-sheet-close]')||event.target===q('[data-sheet-layer]')){closeSheet();return}
    if(event.target.closest('[data-save-links]')){let bad=false;q('[data-sheet-body]').querySelectorAll('[data-link]').forEach(input=>{const value=input.value.trim();if(value&&!safeFolder(value)){bad=true;input.focus();return}state.links[input.dataset.link]=value||null});if(bad){toast('Use a OneDrive or SharePoint https link');return}save();closeSheet();const id=current?.id;renderIndex();if(id)openDetail(id,{scrollTop:false});toast('Artwork links saved on this device')}
  };
  route.addEventListener('click',onClick);
  const onKeyDown=event=>{if(event.key==='Escape'){closeFilterMenus();return}const option=event.target.closest?.('[data-filter-option]');if(!option)return;const options=[...option.closest('.fnb-select-menu').querySelectorAll('[data-filter-option]')],index=options.indexOf(option);let next=-1;if(event.key==='ArrowDown')next=Math.min(options.length-1,index+1);else if(event.key==='ArrowUp')next=Math.max(0,index-1);else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else return;event.preventDefault();options[next]?.focus({preventScroll:true})};
  const onChange=event=>{
    if(event.target.matches('[data-outlet-select]')){filter=event.target.value;renderIndex();return}
    if(event.target.matches('[data-month-select]')){month=event.target.value;renderIndex();return}
  };
  route.addEventListener('keydown',onKeyDown);
  route.addEventListener('change',onChange);
  addEventListener('scroll',scheduleScrollSpy,{passive:true});
  addEventListener('scrollend',releaseSectionTarget,{passive:true});
  addEventListener('resize',scheduleScrollSpy,{passive:true});
  renderIndex();

  return()=>{disposed=true;void disposed;route.removeEventListener('click',onClick);route.removeEventListener('keydown',onKeyDown);route.removeEventListener('change',onChange);removeEventListener('scroll',scheduleScrollSpy);removeEventListener('scrollend',releaseSectionTarget);removeEventListener('resize',scheduleScrollSpy);if(scrollSpyRaf)cancelAnimationFrame(scrollSpyRaf);clearTimeout(sectionTargetTimer);clearTimeout(toast.timer);delete document.body.dataset.fnbDetail};
}
