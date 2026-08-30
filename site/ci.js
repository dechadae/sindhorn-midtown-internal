import {loadSettingsAuthority,hasCapability} from './capabilities.js';
import {openSettingsDialog,closeSettingsDialog} from './settings-dialog-standard.js?v=1';
import {HOTEL_FACTSHEET_IMAGES} from './hotel-factsheet-data.js';
import {
  UI_SYSTEM_VERSION,UI_SYSTEM_CAPABILITY,UI_SYSTEM_SECTIONS,UI_SYSTEM_TOKENS,
  UI_SYSTEM_COMPONENTS,UI_SYSTEM_RULES,UI_SYSTEM_OWNERSHIP,NEW_PAGE_BLUEPRINT,COMPONENT_CODE
} from './ui-system-registry.js';

let stylesPromise=null;
const STYLE_DEPS=Object.freeze([
  ['data-ci-route-style','/ci.css?v=1'],
  ['data-ci-fnb-style','/fnb.css?v=7'],
  ['data-ci-settings-style','/settings.css?v=2'],
  ['data-ci-settings-dialog-style','/settings-dialog-standard.css?v=1&r=6'],
  ['data-ci-factsheet-style','/hotel-factsheet.css?v=2']
]);
function ensureStyles(){
  if(stylesPromise)return stylesPromise;
  stylesPromise=Promise.all(STYLE_DEPS.map(([attribute,href])=>{
    const existing=document.querySelector(`link[${attribute}]`);if(existing)return existing.sheet?Promise.resolve():new Promise(resolve=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})});
    return new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(attribute,'true');link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});document.head.appendChild(link)});
  })).catch(error=>{stylesPromise=null;throw error});
  return stylesPromise;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const backIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';
const upIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M7 10l5-5 5 5"/></svg>';
const selectIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>';

function codeDetails(code,label='Canonical code'){
  return`<details class="ci-code-disclosure"><summary>${esc(label)}</summary><div class="ci-code-wrap"><button class="ci-copy-code" type="button" data-ci-copy>Copy</button><pre><code>${esc(code)}</code></pre></div></details>`;
}
function sectionHead(section,title,lede){return`<header class="ci-section-head"><p class="ci-kicker">${String(section.index).padStart(2,'0')} · ${esc(section.label)}</p><h2>${esc(title)}</h2><p class="ci-section-lede">${esc(lede)}</p></header>`}
function section(id,title,lede,content){const meta=UI_SYSTEM_SECTIONS.find(item=>item.id===id);return`<section class="ci-section" id="ci-${esc(id)}" data-ci-section="${esc(id)}">${sectionHead(meta,title,lede)}${content}</section>`}
function tokenMarkup(){return UI_SYSTEM_TOKENS.map(token=>`<article class="ci-token" data-kind="${esc(token.kind)}" data-ci-token="${esc(token.name)}"><div class="ci-token-swatch" data-ci-token-swatch></div><strong>${esc(token.label)}</strong><code>${esc(token.name)}</code><small data-ci-token-value>${esc(token.fallback)}</small></article>`).join('')}
function componentDocs(){return UI_SYSTEM_COMPONENTS.map(item=>`<article class="ci-doc-card"><div class="ci-doc-label"><span>${esc(item.label)}</span><span>${esc(item.owner.split(' + ')[0])}</span></div><h3>${esc(item.label)}</h3><code class="ci-doc-selector">${esc(item.selector)}</code><div class="ci-doc-meta"><div><span>Use</span><b>${esc(item.use)}</b></div><div><span>Avoid</span><b>${esc(item.avoid)}</b></div><div><span>A11y</span><b>${esc(item.a11y)}</b></div><div><span>Owner</span><b>${esc(item.owner)}</b></div></div></article>`).join('')}
function rulesMarkup(){return UI_SYSTEM_RULES.map(([rule,why])=>`<article class="ci-rule"><i>◇</i><div><strong>${esc(rule)}</strong><p>${esc(why)}</p></div></article>`).join('')}
function ownershipMarkup(){return UI_SYSTEM_OWNERSHIP.map(([system,owner])=>`<div class="ci-owner-row"><span>${esc(system)}</span><code>${esc(owner)}</code></div>`).join('')}

function heroSection(){return section('heroes','One Route Hero','New pages consume the semantic app-route hero API. Existing F&B, Brand, History, Factsheet, Messages and Settings selectors remain compatibility aliases to the same authority.',`
  <div class="ci-specimen"><div class="ci-specimen-label"><span>Live specimen</span><span>route-hero-standard.css</span></div><div class="ci-specimen-stage">
    <header class="app-route-hero"><p class="app-route-eyebrow">Employee Resource</p><h1 class="app-route-title">Page Title</h1><p class="app-route-copy">One short sentence explains the purpose of the route.</p></header>
  </div>${codeDetails(COMPONENT_CODE.hero)}</div>`)}
function surfaceSection(){return section('surfaces','Cards Communicate Role','A surface looks actionable only when it is actionable. F&B remains the authority for the app’s compact glass card; informational surfaces keep the same material without a press promise.',`
  <div class="ci-grid">
    <div class="ci-specimen"><div class="ci-specimen-label"><span>Actionable card</span><span>F&B authority</span></div><div class="ci-specimen-stage"><article class="fnb-card"><button class="fnb-card-button" type="button" data-ci-demo-action><div class="fnb-card-status"><span class="fnb-text-label">Upcoming</span><span class="fnb-card-relative">Starts soon</span></div><h3 class="fnb-card-title">Actionable Card</h3><p class="fnb-card-outlets">Whole surface opens a detail or route.</p><div class="fnb-card-foot"><span>Open detail</span><span class="fnb-chevron">›</span></div></button></article></div>${codeDetails(COMPONENT_CODE.card)}</div>
    <div class="ci-specimen"><div class="ci-specimen-label"><span>Information surface</span><span>No press state</span></div><div class="ci-specimen-stage"><article class="fnb-text-card"><p class="fnb-text-label">Reference</p><div class="fnb-text-copy">Use a non-actionable surface when the content is the destination. Do not attach a chevron or hover lift unless the user can act on the whole object.</div></article></div></div>
  </div>
  <div class="ci-component-list" style="margin-top:9px">${componentDocs()}</div>`)}
function actionSection(){return section('actions','One Tactile Language','Compact controls share the same press, focus and reduced-motion behavior. Size and emphasis change by role; the interaction grammar does not.',`
  <div class="ci-specimen"><div class="ci-specimen-label"><span>Live controls</span><span>Central owners</span></div><div class="ci-actions">
    <button class="app-back-control" type="button" aria-label="Back control specimen" data-ci-demo-action>${backIcon}</button>
    <button class="app-quiet-action" type="button" data-ci-demo-action>${upIcon}<span>Quiet action</span></button>
    <button class="settings-primary" type="button" data-ci-demo-action>Primary action</button>
    <button class="settings-primary" type="button" disabled>Disabled</button>
  </div>${codeDetails(COMPONENT_CODE.back+'\n\n'+COMPONENT_CODE.quiet)}</div>`)}
function selectorSection(){return section('selectors','Filters and Chips','Use the proven F&B selector for compact finite choices. Chips are metadata or explicit filter controls—not decoration applied to every short label.',`
  <div class="ci-grid">
    <div class="ci-specimen"><div class="ci-specimen-label"><span>Selector</span><span>F&B component</span></div><div class="ci-specimen-stage ci-select-demo"><div class="fnb-select" data-ci-select><button class="fnb-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" data-ci-select-trigger><span data-ci-select-value>All outlets</span>${selectIcon}</button><div class="fnb-select-menu" role="listbox" aria-hidden="true" data-ci-select-menu><button class="fnb-select-option is-selected" type="button" role="option" aria-selected="true" data-ci-option="All outlets"><span>All outlets</span><i aria-hidden="true"></i></button><button class="fnb-select-option" type="button" role="option" aria-selected="false" data-ci-option="Bangkok'78"><span>Bangkok'78</span><i aria-hidden="true"></i></button><button class="fnb-select-option" type="button" role="option" aria-selected="false" data-ci-option="ANJU"><span>ANJU</span><i aria-hidden="true"></i></button></div></div></div>${codeDetails(COMPONENT_CODE.select)}</div>
    <div class="ci-specimen"><div class="ci-specimen-label"><span>Chips</span><span>Metadata / filters</span></div><div class="ci-chip-row"><button class="fnb-chip is-active" type="button">Active</button><button class="fnb-chip" type="button">Bangkok'78</button><button class="fnb-chip" type="button">September</button></div><p class="ci-note">Do not turn ordinary navigation, paragraphs or every category label into pills.</p></div>
  </div>`)}
function disclosureSection(){return section('disclosures','Expandable Content Has One Rhythm','A disclosure keeps the full content in the DOM, exposes aria-expanded, rotates the same chevron language and uses the established 420ms rhythm.',`
  <div class="ci-specimen ci-disclosure-demo"><div class="ci-specimen-label"><span>Room-style disclosure</span><span>Factsheet component</span></div><article class="factsheet-room-card" data-ci-disclosure><button class="factsheet-room-card-button" type="button" aria-expanded="false" data-ci-disclosure-button><span class="factsheet-room-card-copy"><span class="factsheet-room-index">01 · Example</span><strong>Expandable Reference</strong><span class="factsheet-room-bed">Tap to reveal structured detail</span></span><svg class="factsheet-room-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l5 5-5 5"/></svg></button><div class="factsheet-room-panel"><div class="factsheet-room-panel-inner"><div class="factsheet-room-context"><span>Details</span><ul><li>Content stays in the same card.</li><li>The control owns aria-expanded.</li><li>Reduced motion removes transition without hiding state.</li></ul></div></div></div></article>${codeDetails(COMPONENT_CODE.disclosure)}</div>`)}
function formSection(){return section('forms','Forms Stay Quiet and Explicit','Labels remain visible, focus uses Sorbet, and validation augments rather than replaces the field. Placeholder text is supporting copy—not the label.',`
  <div class="ci-specimen"><div class="ci-specimen-label"><span>Fields</span><span>Settings authority</span></div><div class="ci-form-demo"><div class="settings-field"><label for="ciName">Display name</label><input id="ciName" type="text" value="Sindhorn Midtown"></div><div class="settings-field"><label for="ciEmail">Work email</label><input id="ciEmail" type="email" value="name@ihg.com"></div><div class="settings-field"><label for="ciError">Validation state</label><input id="ciError" type="text" value="Needs attention" aria-invalid="true" aria-describedby="ciErrorText"><span class="ci-inline-error" id="ciErrorText">Explain what the user can correct.</span></div><div class="settings-field"><label for="ciDisabled">Disabled</label><input id="ciDisabled" type="text" value="Unavailable" disabled></div></div>${codeDetails(COMPONENT_CODE.input)}</div>`)}
function dialogSection(){return section('dialogs','Dialogs Use the Settings Standard','Editing and bounded secondary tasks use the centralized dialog controller. Do not create another scroll-lock, backdrop or open/close animation.',`
  <div class="ci-specimen"><div class="ci-specimen-label"><span>Dialog launcher</span><span>settings-dialog-standard</span></div><button class="settings-primary" type="button" data-ci-open-dialog>Open dialog specimen</button><p class="ci-note">The specimen uses the same native dialog and centralized controller used by Settings.</p></div>`)}
function tableSection(){return section('tables','Dense Data Scrolls, It Does Not Collapse','Keep headers semantic and numeric columns readable. On small screens, horizontal scrolling is preferable to illegible compression.',`
  <div class="ci-specimen ci-table-demo"><div class="ci-specimen-label" style="padding:15px 16px 0"><span>Capacity table</span><span>Factsheet pattern</span></div><div class="factsheet-table-wrap"><table><thead><tr><th>Room</th><th>Class</th><th>Theatre</th><th>Banquet</th><th>Cocktail</th></tr></thead><tbody><tr><th>Veha<small>30th · 172.5 sqm</small></th><td>60</td><td>108</td><td>110</td><td>120</td></tr><tr><th>Midtown 1<small>2nd · 45 sqm</small></th><td>16</td><td>43</td><td>24</td><td>—</td></tr></tbody></table></div></div>`)}
function imagerySection(){const image=HOTEL_FACTSHEET_IMAGES.overview;return section('imagery','Images Support the Reference','Use official hotel imagery where content requires it, preserve an intentional aspect ratio, provide useful alt text and label external source provenance when relevant.',`
  <div class="ci-grid"><figure class="ci-image-demo"><img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy"><figcaption>Official hotel image · cover crop</figcaption></figure><div class="ci-specimen"><div class="ci-specimen-label"><span>Rules</span><span>Content imagery</span></div><dl class="ci-fact-list"><div><dt>Fit</dt><dd>Use object-fit: cover for editorial crops; contain only when the entire object must remain visible.</dd></div><div><dt>Radius</dt><dd>Match the 14px card/image surface family unless the component owner says otherwise.</dd></div><div><dt>Alt</dt><dd>Describe the information the image contributes. Decorative images use empty alt text.</dd></div><div><dt>Loading</dt><dd>Lazy-load below-the-fold imagery; do not lazy-load the primary above-the-fold identity asset.</dd></div></dl>${codeDetails(COMPONENT_CODE.image)}</div></div>`)}
function navigationSection(){return section('navigation','Navigation Geometry Never Depends on Permission','The persistent footer owns global routes. Settings always shows Account / People / Comms / System; capabilities decide what those sections render, not whether the four-tab rail changes shape.',`
  <div class="ci-grid"><div class="ci-specimen"><div class="ci-specimen-label"><span>Global footer</span><span>Live below this page</span></div><dl class="ci-fact-list" data-ci-footer-facts></dl><p class="ci-note">The actual persistent footer at the bottom of the viewport is the live specimen. CI does not draw a second imitation.</p></div><div class="ci-specimen"><div class="ci-specimen-label"><span>Settings rail</span><span>Fixed invariant</span></div><div class="ci-grid-2"><span class="ci-state-card"><strong>Account</strong></span><span class="ci-state-card"><strong>People</strong></span><span class="ci-state-card"><strong>Comms</strong></span><span class="ci-state-card"><strong>System</strong></span></div><p class="ci-note">Unauthorized sections are blank. The four-tab navigation remains stable.</p></div></div>${codeDetails(COMPONENT_CODE.navigation,'Authenticated route link')}`)}
function stateSection(){return section('states','Operational States Stay Calm','Loading, empty, success, error, offline and disabled states should explain what happened and what the employee can do next without changing the product’s visual language.',`
  <div class="ci-state-grid"><article class="ci-state-card"><span>Loading</span><strong>Loading employees…</strong><p>Reserve final geometry where possible; avoid late layout jumps.</p></article><article class="ci-state-card"><span>Empty</span><strong>No messages yet</strong><p>State the absence plainly. Do not manufacture decorative content.</p></article><article class="ci-state-card" data-tone="success"><span>Success</span><strong>Saved</strong><p>Confirm the meaningful result, then return control to the user.</p></article><article class="ci-state-card" data-tone="error"><span>Error</span><strong>Could not save</strong><p>Explain the recoverable action instead of exposing transport internals.</p></article></div>`)}
function motionSection(){return section('motion','Motion Explains State','Press feedback is immediate, component state settles with one easing family, disclosures are deliberate, and route navigation remains the separate persistent-shell crossfade.',`
  <div class="ci-motion-demo"><div class="ci-motion-step"><b>160</b><span>Press ms</span></div><div class="ci-motion-step"><b>260</b><span>State ms</span></div><div class="ci-motion-step"><b>420</b><span>Disclosure ms</span></div><div class="ci-motion-step"><b>280</b><span>Route ms</span></div></div><div class="ci-specimen" style="margin-top:9px"><div class="ci-specimen-label"><span>Accessibility</span><span data-ci-motion-preference>Motion preference</span></div><dl class="ci-fact-list"><div><dt>Focus</dt><dd>Every actionable keyboard target exposes a visible focus state.</dd></div><div><dt>Touch</dt><dd>Targets keep practical mobile hit areas even when the visual icon is compact.</dd></div><div><dt>Reduced</dt><dd>Suppress transforms/transitions while preserving visible state changes.</dd></div><div><dt>Semantics</dt><dd>Use buttons for actions, links for navigation, and native dialog/table semantics where available.</dd></div></dl></div>`)}
function blueprintSection(){const steps=['Register the route in route-registry.js.','Mount into #route-view; never add another authenticated HTML page.','Start with the semantic app-route hero.','Reuse an existing card, selector, disclosure, dialog or table before creating a component.','Navigate through the SPA router / data-app-route.','Keep the persistent header, atmosphere and global footer untouched.','Use the centralized interaction/focus tokens and respect reduced motion.','Validate 360px, 390px and 768px with no horizontal page overflow.','Add deterministic contract and browser smoke coverage.','Update this registry only when a new reusable UI role is genuinely introduced.'];return section('blueprint','Build a New Page Without Relearning the App','This is the implementation checklist for future authenticated pages. Copy the skeleton, then replace content—not the system.',`
  <div class="ci-blueprint"><ol class="ci-blueprint-steps">${steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="ci-specimen">${codeDetails(NEW_PAGE_BLUEPRINT,'Starter route')}</div></div>`)}
function ruleSection(){return section('rules','What Holds the System Together','The CI page is an executable contract, not moodboard inspiration. Owners below are the files to change when the system changes; new routes consume them instead of copying them.',`
  <div class="ci-rule-list">${rulesMarkup()}</div><div class="ci-specimen" style="margin-top:9px"><div class="ci-specimen-label"><span>Ownership map</span><span>Change the owner, not copies</span></div><div class="ci-owner-list">${ownershipMarkup()}</div></div>`)}

function renderPage(authority){
  const profile=authority.profile||{};
  return`<section class="ci-route" aria-labelledby="ciTitle">
    <header class="app-route-hero">
      <button class="app-back-control" type="button" aria-label="Back to Settings System" data-ci-back>${backIcon}</button>
      <p class="app-route-eyebrow">Developer UI Library</p>
      <h1 class="app-route-title" id="ciTitle">Sindhorn Midtown UI Library</h1>
      <p class="app-route-copy">Living corporate identity, UX components, code standards and the canonical blueprint for every new employee-app page.</p>
      <div class="ci-hero-meta"><div><span>System</span><b>${esc(UI_SYSTEM_VERSION)}</b></div><div><span>Access</span><b>Developer only</b></div><div><span>Font</span><b>LINE Seed Sans TH</b></div><div><span>Sections</span><b>${UI_SYSTEM_SECTIONS.length}</b></div></div>
    </header>
    <div class="ci-status" data-ci-status><div class="ci-status-head"><div class="ci-status-title"><i class="ci-status-dot"></i><strong data-ci-status-title>Checking live system…</strong></div><span class="ci-status-count" data-ci-status-count></span></div><div class="ci-check-list" data-ci-check-list></div></div>
    <nav class="ci-index" aria-label="UI Library sections">${UI_SYSTEM_SECTIONS.map(item=>`<button type="button" data-ci-jump="${esc(item.id)}">${String(item.index).padStart(2,'0')} ${esc(item.label)}</button>`).join('')}</nav>
    ${section('identity','The App Identity','This library documents the Sindhorn Midtown Internal product identity. The persistent hotel masthead above is the actual production header; routes never duplicate it.',`<div class="ci-grid"><div class="ci-identity-lockup"><img src="/assets/brand/sindhorn-midtown-vignette-white.png" alt="Sindhorn Midtown, Vignette Collection"></div><div class="ci-specimen"><div class="ci-specimen-label"><span>Identity contract</span><span>Persistent shell</span></div><dl class="ci-fact-list"><div><dt>Product</dt><dd>Sindhorn Midtown Internal</dd></div><div><dt>Hotel</dt><dd>Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG</dd></div><div><dt>Account</dt><dd>${esc(profile.displayName||profile.employeeNumber||'Developer')}</dd></div><div><dt>Header</dt><dd>Mounted once by the authenticated shell</dd></div></dl></div></div>`)}
    ${section('foundations','Live Foundations','These values are read from the same computed custom properties the product uses. A CI swatch is never a separately typed colour reference.',`<div class="ci-token-grid">${tokenMarkup()}</div><p class="ci-note">The Bangkok atmosphere is the page ground. Routes use transparent backgrounds and structural glass; never add a route-wide black veil.</p>`)}
    ${section('typography','One Typeface, Clear Roles','LINE Seed Sans TH is the sole production family for English and Thai. Real weights are 100 / 400 / 700; application chrome keeps zero tracking.',`<div class="ci-type-stack"><div class="ci-type-row"><span class="ci-type-meta">Page title<br>400</span><span class="ci-type-page">Hotel Factsheet</span></div><div class="ci-type-row"><span class="ci-type-meta">Section<br>400</span><span class="ci-type-section">Rooms &amp; Suites</span></div><div class="ci-type-row"><span class="ci-type-meta">Card<br>400</span><span class="ci-type-card">Fried Chicken &amp; Waffles</span></div><div class="ci-type-row"><span class="ci-type-meta">Body<br>400</span><span class="ci-type-body">Concise operational copy stays readable over the live atmosphere.</span></div><div class="ci-type-row"><span class="ci-type-meta">Label<br>400</span><span class="ci-type-label">Meeting Capacity</span></div><div class="ci-type-row"><span class="ci-type-meta">Data<br>tabular</span><span class="ci-type-data">393</span></div></div>`)}
    ${section('layout','Mobile First, One Reading Column','The shell owns the content width and gutter. New pages should expand the same composition on larger screens rather than switch to a different dashboard aesthetic.',`<div class="ci-specimen"><div class="ci-specimen-label"><span>Viewport specimen</span><span data-ci-viewport-label>390px</span></div><div class="ci-viewport-controls"><button type="button" data-ci-width="360">360</button><button type="button" data-ci-width="390" aria-pressed="true">390</button><button type="button" data-ci-width="768">768</button></div><div class="ci-resize-shell"><div class="ci-resize-stage" data-ci-resize-stage><div class="ci-ruler"><div class="ci-ruler-line"></div><div class="ci-ruler-copy"><span>Shell gutter</span><span>Content measure</span><span>Shell gutter</span></div></div><article class="fnb-text-card"><p class="fnb-text-label">Responsive surface</p><div class="fnb-text-copy">The same component adapts; it does not become a different visual system.</div></article></div></div></div>`)}
    ${heroSection()}
    ${surfaceSection()}
    ${actionSection()}
    ${navigationSection()}
    ${selectorSection()}
    ${disclosureSection()}
    ${formSection()}
    ${dialogSection()}
    ${tableSection()}
    ${imagerySection()}
    ${stateSection()}
    ${motionSection()}
    ${blueprintSection()}
    ${ruleSection()}
    <div class="ci-end-actions"><span class="ci-end-note">One source · live specimens · automated contract</span><button class="app-quiet-action" type="button" data-ci-top>${upIcon}<span>Back to top</span></button></div>
    <dialog class="settings-dialog" data-ci-dialog><div class="settings-dialog-body"><div class="settings-dialog-head"><div><p class="settings-dialog-kicker">UI Library</p><h2>Dialog Specimen</h2></div><button class="settings-close" type="button" data-ci-dialog-close aria-label="Close">×</button></div><p class="settings-support">This is the same dialog surface and controller used by Settings. New features should consume the owner instead of building another modal.</p><div class="settings-dialog-actions"><button class="settings-primary" type="button" data-ci-dialog-done>Done</button></div></div></dialog>
  </section>`;
}

function computedTokenValue(name,fallback){const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();return value||fallback}
function hydrateTokens(route){route.querySelectorAll('[data-ci-token]').forEach(card=>{const token=UI_SYSTEM_TOKENS.find(item=>item.name===card.dataset.ciToken);if(!token)return;const value=computedTokenValue(token.name,token.fallback),swatch=card.querySelector('[data-ci-token-swatch]'),label=card.querySelector('[data-ci-token-value]');label.textContent=value;if(token.kind==='color')swatch.style.setProperty('--ci-token-value',value);else swatch.textContent=value})}
function hydrateFooterFacts(route){const footer=document.getElementById('app-footer'),labels=[...footer?.querySelectorAll('.app-tabbar .nav-chip span')||[]].map(node=>node.textContent.trim());const host=route.querySelector('[data-ci-footer-facts]');if(!host)return;host.innerHTML=`<div><dt>Items</dt><dd>${esc(labels.join(' / ')||'Unavailable')}</dd></div><div><dt>Owner</dt><dd>footer-route-guard.js + footer-route-guard.css</dd></div><div><dt>Rails</dt><dd>Global plus F&amp;B / Settings context only when required</dd></div><div><dt>Position</dt><dd>Persistent; route content never owns the painted footer</dd></div>`}
function runChecks(route){
  const title=route.querySelector('.app-route-title'),back=route.querySelector('.app-back-control'),rootStyle=getComputedStyle(document.documentElement),titleStyle=getComputedStyle(title),backStyle=getComputedStyle(back),routeBefore=getComputedStyle(route,'::before'),footerLabels=[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(node=>node.textContent.trim()).join('|'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const expectedTransition=reduced?'1ms':'280ms';
  const checks=[
    ['LINE Seed Sans TH is active',getComputedStyle(route).fontFamily.includes('LINE Seed Sans TH'),getComputedStyle(route).fontFamily],
    ['Hero title uses regular weight',titleStyle.fontWeight==='400',titleStyle.fontWeight],
    ['Hero title tracking is zero',titleStyle.letterSpacing==='0px'||titleStyle.letterSpacing==='normal',titleStyle.letterSpacing],
    ['Back control is 36 × 36',Math.round(parseFloat(backStyle.width))===36&&Math.round(parseFloat(backStyle.height))===36,`${backStyle.width} × ${backStyle.height}`],
    ['Back control radius is 12px',Math.round(parseFloat(backStyle.borderRadius))===12,backStyle.borderRadius],
    ['Route transition token is canonical',rootStyle.getPropertyValue('--app-transition-ms').trim()===expectedTransition,rootStyle.getPropertyValue('--app-transition-ms').trim()],
    ['Global footer has four canonical items',footerLabels==='Today|F&B|Messages|Brand',footerLabels],
    ['Persistent header is singular',document.querySelectorAll('#app-header').length===1,String(document.querySelectorAll('#app-header').length)],
    ['Persistent footer is singular',document.querySelectorAll('#app-footer').length===1,String(document.querySelectorAll('#app-footer').length)],
    ['CI paints no route-wide overlay',routeBefore.content==='none'||routeBefore.content==='normal'||routeBefore.content==='""',routeBefore.content]
  ];
  const failed=checks.filter(([,ok])=>!ok),status=route.querySelector('[data-ci-status]');status.dataset.tone=failed.length?'error':'pass';route.querySelector('[data-ci-status-title]').textContent=failed.length?`${failed.length} design drift check${failed.length===1?'':'s'} failed`:'Design system status · PASS';route.querySelector('[data-ci-status-count]').textContent=`${checks.length-failed.length}/${checks.length}`;route.querySelector('[data-ci-check-list]').innerHTML=checks.map(([label,ok,value])=>`<div class="ci-check" data-ok="${ok}"><i>${ok?'✓':'×'}</i><span>${esc(label)}</span><code>${esc(value)}</code></div>`).join('');return{checks,failed};
}
async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch(_){}const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
async function goToSettingsSystem(){
  history.pushState({route:'settings'},'', '/settings?section=system');
  if(window.SindhornNavigation?.transitionToRoute)return window.SindhornNavigation.transitionToRoute('settings',{historyMode:null,scroll:true});
  location.assign('/settings?section=system');
}
async function rejectUnauthorized(host){
  host.replaceChildren();history.replaceState({route:'settings'},'', '/settings?section=system');
  if(window.SindhornNavigation?.transitionToRoute)return window.SindhornNavigation.transitionToRoute('settings',{historyMode:null,scroll:true});
  location.replace('/settings?section=system');
}

export async function mountCiRoute(host){
  const authority=await loadSettingsAuthority({force:true});
  if(!hasCapability(UI_SYSTEM_CAPABILITY,authority)){await rejectUnauthorized(host);return()=>{}}
  await ensureStyles();
  host.innerHTML=renderPage(authority);
  const route=host.querySelector('.ci-route'),cleanup=[];const on=(node,event,handler,options)=>{node?.addEventListener(event,handler,options);cleanup.push(()=>node?.removeEventListener(event,handler,options))};
  hydrateTokens(route);hydrateFooterFacts(route);requestAnimationFrame(()=>runChecks(route));
  route.querySelector('[data-ci-motion-preference]').textContent=reducedMotion()?'Reduced motion active':'Full motion active';

  on(route.querySelector('[data-ci-back]'),'click',()=>{void goToSettingsSystem()});
  on(route.querySelector('[data-ci-top]'),'click',()=>scrollTo({top:0,behavior:reducedMotion()?'auto':'smooth'}));
  route.querySelectorAll('[data-ci-jump]').forEach(button=>on(button,'click',()=>document.getElementById(`ci-${button.dataset.ciJump}`)?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'start'})));
  route.querySelectorAll('[data-ci-copy]').forEach(button=>on(button,'click',async()=>{const value=button.closest('.ci-code-wrap')?.querySelector('code')?.textContent||'';const ok=await copyText(value);button.textContent=ok?'Copied':'Copy failed';setTimeout(()=>{if(route.isConnected)button.textContent='Copy'},1100)}));
  route.querySelectorAll('[data-ci-width]').forEach(button=>on(button,'click',()=>{const width=Number(button.dataset.ciWidth||390);route.style.setProperty('--ci-demo-width',`${width}px`);route.querySelector('[data-ci-viewport-label]').textContent=`${width}px`;route.querySelectorAll('[data-ci-width]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))}));
  route.querySelectorAll('[data-ci-demo-action]').forEach(button=>on(button,'click',()=>{}));

  const select=route.querySelector('[data-ci-select]'),selectTrigger=route.querySelector('[data-ci-select-trigger]'),selectMenu=route.querySelector('[data-ci-select-menu]');
  const closeSelect=()=>{select?.classList.remove('is-open');selectTrigger?.setAttribute('aria-expanded','false');selectMenu?.setAttribute('aria-hidden','true')};
  on(selectTrigger,'click',()=>{const open=!select.classList.contains('is-open');select.classList.toggle('is-open',open);selectTrigger.setAttribute('aria-expanded',String(open));selectMenu.setAttribute('aria-hidden',String(!open))});
  route.querySelectorAll('[data-ci-option]').forEach(option=>on(option,'click',()=>{route.querySelector('[data-ci-select-value]').textContent=option.dataset.ciOption;route.querySelectorAll('[data-ci-option]').forEach(item=>{const active=item===option;item.classList.toggle('is-selected',active);item.setAttribute('aria-selected',String(active))});closeSelect();selectTrigger.focus({preventScroll:true})}));
  on(document,'click',event=>{if(!event.target.closest?.('[data-ci-select]'))closeSelect()});

  const disclosure=route.querySelector('[data-ci-disclosure]'),disclosureButton=route.querySelector('[data-ci-disclosure-button]');
  on(disclosureButton,'click',()=>{const open=!disclosure.classList.contains('is-open');disclosure.classList.toggle('is-open',open);disclosureButton.setAttribute('aria-expanded',String(open))});

  const dialog=route.querySelector('[data-ci-dialog]');
  on(route.querySelector('[data-ci-open-dialog]'),'click',()=>{void openSettingsDialog(dialog)});
  on(route.querySelector('[data-ci-dialog-close]'),'click',()=>{void closeSettingsDialog(dialog)});
  on(route.querySelector('[data-ci-dialog-done]'),'click',()=>{void closeSettingsDialog(dialog)});

  window.SindhornUiLibrary={version:UI_SYSTEM_VERSION,runChecks:()=>runChecks(route),registry:{sections:UI_SYSTEM_SECTIONS,tokens:UI_SYSTEM_TOKENS,components:UI_SYSTEM_COMPONENTS}};
  document.dispatchEvent(new CustomEvent('sindhorn:ci-ready',{detail:{version:UI_SYSTEM_VERSION,checks:runChecks(route).checks.length}}));
  return()=>{cleanup.splice(0).forEach(fn=>fn());if(dialog?.open)try{dialog.close()}catch(_){}delete window.SindhornUiLibrary;route.remove()};
}
