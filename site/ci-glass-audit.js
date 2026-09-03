import {UI_SYSTEM_SECTIONS} from './ui-system-registry.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function glassSectionMarkup(){
  const meta=UI_SYSTEM_SECTIONS.find(item=>item.id==='glass');
  return`<section class="ci-section" id="ci-glass" data-ci-section="glass">
    <header class="ci-section-head">
      <p class="ci-kicker">${String(meta?.index||3).padStart(2,'0')} · ${esc(meta?.label||'Glass Material')}</p>
      <h2>One Frosted Material</h2>
      <p class="ci-section-lede">CI is the visual authority for every translucent surface in the authenticated app: 30% Vignette purple over the live atmosphere with the proven 18px blur and 1.18 saturation. Header, footer, cards, controls, chips and fields consume this same material. Fully transparent utility actions are exempt.</p>
    </header>
    <div class="ci-grid">
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Canonical surface</span><span>30% fill · 18px blur</span></div>
        <article class="fnb-text-card app-glass-surface"><p class="fnb-text-label">Frosted, not painted</p><div class="fnb-text-copy">The Betta remains visible through the surface, while its detail is softened by the same blur used everywhere else in the app.</div></article>
      </div>
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Canonical controls</span><span>same material</span></div>
        <div class="ci-actions">
          <button class="app-back-control app-glass-control" type="button" aria-label="Glass back control specimen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
          <button class="fnb-chip is-active app-glass-control" type="button">Glass chip</button>
          <button class="settings-primary app-glass-control" type="button">Glass action</button>
        </div>
        <p class="ci-note">Surface and control geometry stays component-owned. Pigment and backdrop treatment come only from app-glass.css.</p>
      </div>
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Persistent shell</span><span>same frost</span></div>
        <p class="ci-note">The hotel masthead and global footer are no longer separate opaque purple materials. app-glass-runtime.js assigns the same canonical surface material to both.</p>
      </div>
      <div class="ci-specimen">
        <div class="ci-specimen-label"><span>Image frame</span><span>Factsheet authority</span></div>
        <figure class="factsheet-picture app-glass-surface" data-ci-glass-picture><div style="height:112px;background:linear-gradient(135deg,rgba(250,247,245,.16),rgba(229,236,190,.08))" aria-hidden="true"></div><figcaption>Official image · translucent frame</figcaption></figure>
      </div>
    </div>
  </section>`;
}

function styleValue(node,key){
  if(!node)return'element missing';
  const style=getComputedStyle(node);
  if(key==='filter')return String(style.backdropFilter||style.webkitBackdropFilter||'none');
  if(key==='background')return String(style.backgroundColor||'transparent');
  return'';
}
function hasBlur(node){return /blur\(18px\)/i.test(styleValue(node,'filter'))}
function alphaOf(node){
  const value=styleValue(node,'background');
  const match=value.match(/rgba?\([^)]*?(?:,|\s\/\s*)(0?\.\d+|1(?:\.0+)?)\s*\)$/i);
  if(match)return Number(match[1]);
  if(/^rgb\(/i.test(value))return 1;
  return NaN;
}
function hasCanonicalAlpha(node){const alpha=alphaOf(node);return Number.isFinite(alpha)&&Math.abs(alpha-.30)<=.02}

function glassChecks(route){
  const shellHeader=document.querySelector('.masthead');
  const shellFooter=document.querySelector('.app-tabbar,.shell-footer-rail');
  const surface=route.querySelector('#ci-glass .fnb-text-card');
  const targets=[
    ['Canonical CI surface uses 18px blur',surface,hasBlur(surface)?styleValue(surface,'filter'):'missing 18px blur'],
    ['Canonical CI surface uses 30% fill',surface,styleValue(surface,'background')],
    ['Glass card uses canonical blur',route.querySelector('#ci-surfaces .fnb-card'),styleValue(route.querySelector('#ci-surfaces .fnb-card'),'filter')],
    ['Glass chip uses canonical blur',route.querySelector('#ci-selectors .fnb-chip'),styleValue(route.querySelector('#ci-selectors .fnb-chip'),'filter')],
    ['Back control uses canonical blur',route.querySelector('#ci-actions .app-back-control'),styleValue(route.querySelector('#ci-actions .app-back-control'),'filter')],
    ['Selector uses canonical blur',route.querySelector('#ci-selectors .fnb-select-trigger'),styleValue(route.querySelector('#ci-selectors .fnb-select-trigger'),'filter')],
    ['Disclosure uses canonical blur',route.querySelector('#ci-disclosures .factsheet-room-card'),styleValue(route.querySelector('#ci-disclosures .factsheet-room-card'),'filter')],
    ['Factsheet image frame uses canonical blur',route.querySelector('[data-ci-glass-picture]'),styleValue(route.querySelector('[data-ci-glass-picture]'),'filter')],
    ['Persistent header inherits canonical frost',shellHeader,`${styleValue(shellHeader,'background')} · ${styleValue(shellHeader,'filter')}`],
    ['Persistent footer inherits canonical frost',shellFooter,`${styleValue(shellFooter,'background')} · ${styleValue(shellFooter,'filter')}`]
  ];
  return targets.map(([label,node,value],index)=>{
    let ok=Boolean(node)&&hasBlur(node);
    if(index===1)ok=Boolean(node)&&hasCanonicalAlpha(node);
    if(index===8||index===9)ok=Boolean(node)&&hasBlur(node)&&hasCanonicalAlpha(node);
    return[label,ok,value];
  });
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
    library.glass={fill:'--app-glass-fill',filter:'--app-glass-filter',owner:'site/app-glass.css + site/app-glass-runtime.js'};
  }
  requestAnimationFrame(()=>runChecks());

  return()=>{
    section?.remove();
    if(library&&library.runChecks===runChecks&&baseRunChecks)library.runChecks=baseRunChecks;
    if(library?.glass)delete library.glass;
  };
}
