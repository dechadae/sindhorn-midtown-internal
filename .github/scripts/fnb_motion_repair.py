from pathlib import Path

path=Path('site/fnb.js')
text=path.read_text()
text=text.replace("link.href='/fnb.css?v=1'","link.href='/fnb.css?v=2'",1)
text=text.replace("let disposed=false,filter='ALL',month='ALL',current=null,indexScroll=0,observer=null;","let disposed=false,filter='ALL',month='ALL',current=null,indexScroll=0,scrollSpyRaf=0,viewAnimating=false;",1)
anchor="  const q=selector=>route.querySelector(selector),qa=selector=>[...route.querySelectorAll(selector)];\n"
helper='''  const q=selector=>route.querySelector(selector),qa=selector=>[...route.querySelectorAll(selector)];
  const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function animateView(el,keyframes,duration){
    if(!el||reducedMotion()||typeof el.animate!=='function')return;
    try{await el.animate(keyframes,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}).finished}catch(_){}
  }
  function animateCardsIn(){
    if(reducedMotion())return;
    qa('.fnb-card').forEach((card,index)=>{try{card.animate([{opacity:.01,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:Math.min(index,6)*34,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'})}catch(_){}})
  }
'''
if anchor not in text: raise SystemExit('fnb q anchor missing')
text=text.replace(anchor,helper,1)
old="  function renderCards(){const campaigns=filteredCampaigns();q('[data-cards]').innerHTML=campaigns.length?campaigns.map(cardHTML).join(''):'<div class=\"fnb-empty\">No promotions match these filters.</div>'}"
new="  function renderCards(){const campaigns=filteredCampaigns();q('[data-cards]').innerHTML=campaigns.length?campaigns.map(cardHTML).join(''):'<div class=\"fnb-empty\">No promotions match these filters.</div>';requestAnimationFrame(animateCardsIn)}"
if old not in text: raise SystemExit('renderCards anchor missing')
text=text.replace(old,new,1)
old='''  function setSectionActive(id){qa('[data-section]').forEach(button=>button.classList.toggle('is-active',button.dataset.section===id))}
  function observeDetail(){observer?.disconnect();observer=new IntersectionObserver(entries=>{const hit=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))[0];if(hit)setSectionActive(hit.target.id)},{rootMargin:'-22% 0px -64% 0px',threshold:[0,.08]});['overview','brief','copy','artwork'].forEach(id=>{const el=q('#'+id);if(el)observer.observe(el)})}
  function openDetail(id,{scrollTop=true}={}){const campaign=DATA.find(item=>item.id===id);if(!campaign)return;if(!current)indexScroll=scrollY;current=campaign;q('[data-index]').hidden=true;const detail=q('[data-detail]');detail.innerHTML=detailHTML(campaign);detail.hidden=false;document.body.dataset.fnbDetail='true';setSectionActive('overview');bindDetail();observeDetail();if(scrollTop)scrollTo({top:0,behavior:'auto'})}
  function closeDetail(){current=null;observer?.disconnect();observer=null;q('[data-detail]').hidden=true;q('[data-detail]').replaceChildren();q('[data-index]').hidden=false;delete document.body.dataset.fnbDetail;requestAnimationFrame(()=>scrollTo({top:indexScroll,behavior:'auto'}))}
'''
new='''  function setSectionActive(id){qa('[data-section]').forEach(button=>{const active=button.dataset.section===id;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current')})}
  function updateSectionFromScroll(){
    if(!current)return;
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
    if(!current)indexScroll=scrollY;viewAnimating=true;
    if(shouldAnimate)await animateView(index,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-14px)'}],180);
    current=campaign;index.hidden=true;detail.innerHTML=detailHTML(campaign);detail.hidden=false;document.body.dataset.fnbDetail='true';setSectionActive('overview');bindDetail();
    if(scrollTop)scrollTo({top:0,behavior:'auto'});observeDetail();
    if(shouldAnimate)await animateView(detail,[{opacity:.02,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],300);
    viewAnimating=false
  }
  async function closeDetail(){
    if(viewAnimating)return;viewAnimating=true;
    const detail=q('[data-detail]'),index=q('[data-index]');
    await animateView(detail,[{opacity:1,transform:'translateX(0)'},{opacity:.02,transform:'translateX(16px)'}],180);
    current=null;detail.hidden=true;detail.replaceChildren();index.hidden=false;delete document.body.dataset.fnbDetail;scrollTo({top:indexScroll,behavior:'auto'});
    await animateView(index,[{opacity:.02,transform:'translateX(-12px)'},{opacity:1,transform:'translateX(0)'}],280);
    viewAnimating=false
  }
'''
if old not in text: raise SystemExit('scrollspy/openDetail block missing')
text=text.replace(old,new,1)
old="    const section=event.target.closest('[data-section]');if(section&&current){q('#'+section.dataset.section)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return}"
new="    const section=event.target.closest('[data-section]');if(section&&current){const id=section.dataset.section,target=q('#'+id);setSectionActive(id);if(target){const top=Math.max(0,target.getBoundingClientRect().top+scrollY-72);scrollTo({top,behavior:reducedMotion()?'auto':'smooth'})}return}"
if old not in text: raise SystemExit('section click anchor missing')
text=text.replace(old,new,1)
old='''  route.addEventListener('change',onChange);
  renderIndex();

  return()=>{disposed=true;void disposed;route.removeEventListener('click',onClick);route.removeEventListener('change',onChange);observer?.disconnect();clearTimeout(toast.timer);delete document.body.dataset.fnbDetail};
'''
new='''  route.addEventListener('change',onChange);
  addEventListener('scroll',scheduleScrollSpy,{passive:true});
  addEventListener('resize',scheduleScrollSpy,{passive:true});
  renderIndex();

  return()=>{disposed=true;void disposed;route.removeEventListener('click',onClick);route.removeEventListener('change',onChange);removeEventListener('scroll',scheduleScrollSpy);removeEventListener('resize',scheduleScrollSpy);if(scrollSpyRaf)cancelAnimationFrame(scrollSpyRaf);clearTimeout(toast.timer);delete document.body.dataset.fnbDetail};
'''
if old not in text: raise SystemExit('cleanup anchor missing')
text=text.replace(old,new,1)
path.write_text(text)

path=Path('site/fnb.css')
text=path.read_text()
text += r'''

/* Motion + control consistency pass — responsive without feeling abrupt. */
:root{--fnb-motion-fast:160ms;--fnb-motion-base:260ms;--fnb-motion-slow:420ms;--fnb-motion-ease:cubic-bezier(.22,1,.36,1)}
.fnb-index,.fnb-detail{animation:none}
.fnb-card{transition:transform var(--fnb-motion-base) var(--fnb-motion-ease),border-color var(--fnb-motion-base) ease,background var(--fnb-motion-base) ease,box-shadow var(--fnb-motion-base) var(--fnb-motion-ease)}
.fnb-card:focus-within{border-color:rgba(var(--fnb-accent-rgb),.32);box-shadow:0 14px 34px rgba(12,9,18,.14)}
@media(hover:hover){.fnb-card:hover{transform:translateY(-2px);border-color:rgba(var(--fnb-accent-rgb),.25)}}
.fnb-card-button{transition:opacity var(--fnb-motion-fast) ease,transform var(--fnb-motion-fast) var(--fnb-motion-ease)}
.fnb-card-button:active{transform:scale(.992);opacity:.88}
.fnb-select select{transition:border-color var(--fnb-motion-base) ease,background-color var(--fnb-motion-base) ease,box-shadow var(--fnb-motion-base) ease}
.fnb-select select:focus{border-color:rgba(var(--fnb-accent-rgb),.46);box-shadow:0 0 0 3px rgba(var(--fnb-accent-rgb),.06)}
.fnb-section-rail{display:flex!important;visibility:hidden;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity var(--fnb-motion-base) ease,transform var(--fnb-motion-base) var(--fnb-motion-ease),visibility 0s linear var(--fnb-motion-base)}
body[data-fnb-detail="true"] .fnb-section-rail{visibility:visible;opacity:1;pointer-events:auto;transform:none;transition-delay:0s}
.fnb-chip,.fnb-action,.fnb-expand,.fnb-back,.fnb-sheet-close{transition:background var(--fnb-motion-base) ease,border-color var(--fnb-motion-base) ease,color var(--fnb-motion-base) ease,box-shadow var(--fnb-motion-base) var(--fnb-motion-ease),transform var(--fnb-motion-fast) var(--fnb-motion-ease),opacity var(--fnb-motion-fast) ease}
.fnb-back{border-radius:12px}
.fnb-sheet-close{border-radius:10px}
.fnb-action{border-radius:12px}
.fnb-expand{border-radius:10px}
.fnb-action:active,.fnb-expand:active,.fnb-back:active,.fnb-sheet-close:active{transform:scale(.975);opacity:.84}
.fnb-text-copy{transition:max-height var(--fnb-motion-slow) var(--fnb-motion-ease),opacity var(--fnb-motion-base) ease}
.fnb-task-list{transition:max-height var(--fnb-motion-slow) var(--fnb-motion-ease),opacity var(--fnb-motion-base) ease,padding var(--fnb-motion-slow) var(--fnb-motion-ease)}
.fnb-art-chevron{transition:transform var(--fnb-motion-base) var(--fnb-motion-ease),border-color var(--fnb-motion-base) ease}
.fnb-sheet-layer{transition:opacity var(--fnb-motion-base) ease,visibility 0s linear var(--fnb-motion-base)}
.fnb-sheet{transition:transform 340ms var(--fnb-motion-ease),opacity var(--fnb-motion-base) ease}
@media(prefers-reduced-motion:reduce){.fnb-section-rail,.fnb-card,.fnb-card-button,.fnb-select select,.fnb-chip,.fnb-action,.fnb-expand,.fnb-back,.fnb-sheet-close,.fnb-text-copy,.fnb-task-list,.fnb-art-chevron,.fnb-sheet-layer,.fnb-sheet{transition:none!important}}
'''
path.write_text(text)

path=Path('site/footer-route-guard.css')
text=path.read_text()
text += r'''

/* Shared premium control geometry + motion, loaded after the presentation pack. */
:root{--sm-control-radius:12px;--sm-motion-fast:160ms;--sm-motion-base:260ms;--sm-motion-ease:cubic-bezier(.22,1,.36,1)}
.action,.message-clear,.message-open{
  border-radius:var(--sm-control-radius)!important;
  transition:background var(--sm-motion-base) ease,border-color var(--sm-motion-base) ease,color var(--sm-motion-base) ease,box-shadow var(--sm-motion-base) var(--sm-motion-ease),transform var(--sm-motion-fast) var(--sm-motion-ease),opacity var(--sm-motion-fast) ease!important;
}
.action:active,.message-clear:active,.message-open:active{transform:scale(.98)!important;opacity:.84!important}
.fullscreen-toggle{border-radius:10px!important;transition:background var(--sm-motion-base) ease,border-color var(--sm-motion-base) ease,transform var(--sm-motion-fast) var(--sm-motion-ease)!important}
#app-footer .nav-chip{transition:background var(--sm-motion-base) var(--sm-motion-ease),box-shadow var(--sm-motion-base) var(--sm-motion-ease),color 210ms ease,transform var(--sm-motion-fast) var(--sm-motion-ease),opacity var(--sm-motion-fast) ease!important}
body[data-route="fnb"] .fnb-section-rail .fnb-chip{transition:background var(--sm-motion-base) var(--sm-motion-ease),box-shadow var(--sm-motion-base) var(--sm-motion-ease),color 210ms ease,transform var(--sm-motion-fast) var(--sm-motion-ease),opacity var(--sm-motion-fast) ease!important}
@media(prefers-reduced-motion:reduce){.action,.message-clear,.message-open,.fullscreen-toggle,#app-footer .nav-chip,body[data-route="fnb"] .fnb-section-rail .fnb-chip{transition:none!important}}
'''
path.write_text(text)

path=Path('site/footer-route-guard.js')
text=path.read_text().replace("const FOOTER_VERSION='sindhorn-footer-v5-fnb-direct';","const FOOTER_VERSION='sindhorn-footer-v6-fnb-motion';",1).replace("const FNB_MODULE_URL='/fnb.js?v=5';","const FNB_MODULE_URL='/fnb.js?v=6';",1)
path.write_text(text)

path=Path('site/index.html')
text=path.read_text().replace('/footer-route-guard.css?v=4','/footer-route-guard.css?v=5',1).replace('/footer-route-guard.js?v=5','/footer-route-guard.js?v=6',1)
path.write_text(text)

path=Path('site/sw.js')
text=path.read_text().replace("const VERSION='sindhorn-midtown-internal-pwa-v30-english-only-interface';","const VERSION='sindhorn-midtown-internal-pwa-v31-fnb-motion-preview';",1)
path.write_text(text)

path=Path('.github/workflows/fnb-live-preview.yml')
text=path.read_text()
text=text.replace("'/footer-route-guard.js?v=5'","'/footer-route-guard.js?v=6'")
text=text.replace("'/footer-route-guard.css?v=4'","'/footer-route-guard.css?v=5'")
text=text.replace("sindhorn-footer-v5-fnb-direct","sindhorn-footer-v6-fnb-motion")
text=text.replace("FNB_MODULE_URL='/fnb.js?v=5'","FNB_MODULE_URL='/fnb.js?v=6'")
text=text.replace('"${BASE_URL}/fnb.js?v=5"','"${BASE_URL}/fnb.js?v=6"')
text=text.replace('"${BASE_URL}/footer-route-guard.js?v=5"','"${BASE_URL}/footer-route-guard.js?v=6"')
text=text.replace('"${BASE_URL}/footer-route-guard.css?v=4"','"${BASE_URL}/footer-route-guard.css?v=5"')
text=text.replace('footer-route-guard.js?v=5','footer-route-guard.js?v=6')
text=text.replace('footer-route-guard.css?v=4','footer-route-guard.css?v=5')
text=text.replace('pwa-v28-footer-fnb-route-repair','pwa-v31-fnb-motion-preview')
old="if(detailState.gap<6||detailState.railRadius!=='15px'||detailState.chipRadius!=='10px'||detailState.expandRadius!=='10px')throw new Error(`Detail rail/button geometry mismatch: ${JSON.stringify(detailState)}`);"
new=old+"\n          await page.evaluate(()=>document.querySelector('#copy').scrollIntoView({behavior:'auto',block:'start'}));\n          await page.waitForTimeout(120);\n          const activeSection=await page.evaluate(()=>document.querySelector('.fnb-section-rail .is-active')?.dataset.section);\n          if(activeSection!=='copy')throw new Error(`Scrollspy mismatch: ${activeSection}`);"
if old not in text: raise SystemExit('preview assertion anchor missing')
text=text.replace(old,new,1)
path.write_text(text)
