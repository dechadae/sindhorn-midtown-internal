import {UI_SYSTEM_SECTIONS} from './ui-system-registry.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function glassSectionMarkup(){
  const meta=UI_SYSTEM_SECTIONS.find(item=>item.id==='glass');
  return`<section class="ci-section" id="ci-glass" data-ci-section="glass">
    <header class="ci-section-head">
      <p class="ci-kicker">${String(meta?.index||3).padStart(2,'0')} · ${esc(meta?.label||'Glass Material')}</p>
      <h2>Translucency Always Blurs</h2>
      <p class="ci-section-lede">Any card, button, chip, field, menu, image frame or navigation item that intentionally shows the live atmosphere through its fill uses the centralized glass material. Fully transparent controls and opaque surfaces are exempt.</p>
    </header>
    <div class="ci-grid">
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Surface material</span><span>app-glass.css</span></div>
        <article class="fnb-text-card"><p class="fnb-text-label">18px surface blur</p><div class="fnb-text-copy">Structural glass keeps the Betta atmosphere visible while separating readable content from motion behind it.</div></article>
      </div>
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Control material</span><span>12px compact blur</span></div>
        <div class="ci-actions">
          <button class="app-back-control" type="button" aria-label="Glass back control specimen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
          <button class="fnb-chip is-active" type="button">Glass chip</button>
          <button class="settings-primary" type="button">Glass action</button>
        </div>
        <p class="ci-note">Blur changes material only. Geometry, colour, copy, hit area and component interaction remain owned by their existing authorities.</p>
      </div>
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Image frame</span><span>Factsheet authority</span></div>
        <figure class="factsheet-picture" data-ci-glass-picture><div style="height:112px;background:linear-gradient(135deg,rgba(250,247,245,.16),rgba(229,236,190,.08))" aria-hidden="true"></div><figcaption>Official image · translucent frame</figcaption></figure>
        <p class="ci-note">The image itself may be opaque. Any visible translucent frame or caption around it still uses the surface blur.</p>
      </div>
    </div>
  </section>`;
}

function filterValue(node){
  if(!node)return'element missing';
  const style=getComputedStyle(node);
  return String(style.backdropFilter||style.webkitBackdropFilter||'none');
}
function hasBlur(node){return /blur\((?!0(?:px)?\))/i.test(filterValue(node))}

function glassChecks(route){
  const targets=[
    ['Glass card blur is active',route.querySelector('#ci-surfaces .fnb-card')],
    ['Glass chip blur is active',route.querySelector('#ci-selectors .fnb-chip')],
    ['Back-control blur is active',route.querySelector('#ci-actions .app-back-control')],
    ['Primary-action blur is active',route.querySelector('#ci-actions .settings-primary:not(:disabled)')],
    ['Selector blur is active',route.querySelector('#ci-selectors .fnb-select-trigger')],
    ['Disclosure-card blur is active',route.querySelector('#ci-disclosures .factsheet-room-card')],
    ['Factsheet image-frame blur is active',route.querySelector('[data-ci-glass-picture]')],
    ['CI structural glass blur is active',route.querySelector('.ci-status')],
    ['CI navigation-chip blur is active',route.querySelector('.ci-index button')]
  ];
  return targets.map(([label,node])=>[label,Boolean(node)&&hasBlur(node),filterValue(node)]);
}

function appendChecks(route,baseResult){
  const list=route.querySelector('[data-ci-check-list]');
  if(!list)return baseResult;
  list.querySelectorAll('[data-ci-glass-check]').forEach(node=>node.remove());
  const extra=glassChecks(route);
  list.insertAdjacentHTML('beforeend',extra.map(([label,ok,value])=>`<div class="ci-check" data-ci-glass-check data-ok="${ok}"><i>${ok?'✓':'×'}</i><span>${esc(label)}</span><code>${esc(value)}</code></div>`).join(''));
  const checks=[...(baseResult?.checks||[]),...extra];
  const failed=checks.filter(([,ok])=>!ok);
  const status=route.querySelector('[data-ci-status]');
  if(status)status.dataset.tone=failed.length?'error':'pass';
  const title=route.querySelector('[data-ci-status-title]');
  if(title)title.textContent=failed.length?`${failed.length} design drift check${failed.length===1?'':'s'} failed`:'Design system status · PASS';
  const count=route.querySelector('[data-ci-status-count]');
  if(count)count.textContent=`${checks.length-failed.length}/${checks.length}`;
  return{checks,failed};
}

export function mountCiGlassAudit(route){
  if(!route)return()=>{};
  const foundations=route.querySelector('#ci-foundations');
  const section=document.createRange().createContextualFragment(glassSectionMarkup()).firstElementChild;
  foundations?.after(section);

  const library=window.SindhornUiLibrary;
  const baseRunChecks=library?.runChecks?.bind(library);
  const runChecks=()=>appendChecks(route,baseRunChecks?baseRunChecks():{checks:[],failed:[]});
  if(library){
    library.runChecks=runChecks;
    library.glass={surfaceFilter:'--app-glass-surface-filter',controlFilter:'--app-glass-control-filter',owner:'site/app-glass.css'};
  }
  requestAnimationFrame(()=>runChecks());

  return()=>{
    section?.remove();
    if(library&&library.runChecks===runChecks&&baseRunChecks)library.runChecks=baseRunChecks;
    if(library?.glass)delete library.glass;
  };
}
