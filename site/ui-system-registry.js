export const UI_SYSTEM_VERSION='1.0.0-preview';
export const UI_SYSTEM_CAPABILITY='developer.ui_library';

export const UI_SYSTEM_SECTIONS=Object.freeze([
  ['identity','Identity'],['foundations','Foundations'],['typography','Typography'],['layout','Layout'],
  ['heroes','Heroes'],['surfaces','Surfaces & Cards'],['actions','Actions'],['navigation','Navigation'],
  ['selectors','Filters & Chips'],['disclosures','Disclosures'],['forms','Forms'],['dialogs','Dialogs'],
  ['tables','Tables & Data'],['imagery','Imagery'],['states','States'],['motion','Motion & Accessibility'],
  ['blueprint','New Page Blueprint'],['rules','Rules & Ownership']
].map(([id,label],index)=>Object.freeze({id,label,index:index+1})));

export const UI_SYSTEM_TOKENS=Object.freeze([
  {name:'--sm-text',label:'Primary text',kind:'color',fallback:'#FAF7F5'},
  {name:'--app-control-accent',label:'Accent / focus',kind:'color',fallback:'#E5ECBE'},
  {name:'--app-control-glass',label:'Control glass',kind:'color',fallback:'rgba(46,39,59,.55)'},
  {name:'--app-control-border',label:'Control border',kind:'color',fallback:'rgba(250,247,245,.14)'},
  {name:'--route-hero-muted',label:'Muted copy',kind:'color',fallback:'rgba(250,247,245,.66)'},
  {name:'--app-control-motion-fast',label:'Fast press',kind:'motion',fallback:'160ms'},
  {name:'--app-control-motion-base',label:'Base state',kind:'motion',fallback:'260ms'},
  {name:'--app-transition-ms',label:'Route transition',kind:'motion',fallback:'280ms'},
  {name:'--app-back-size',label:'Back control size',kind:'size',fallback:'36px'},
  {name:'--app-back-radius',label:'Back control radius',kind:'size',fallback:'12px'}
]);

export const UI_SYSTEM_RULES=Object.freeze([
  ['Use LINE Seed Sans TH only.','Production ships real weights 100 / 400 / 700; never introduce another UI font.'],
  ['Use zero character tracking.','letter-spacing stays 0 across headings, body, labels and controls.'],
  ['Keep one persistent authenticated shell.','Authenticated routes replace only #route-view; header, footer, auth and atmosphere stay mounted.'],
  ['Do not paint a route-wide dark overlay.','The Bangkok atmosphere is the visual ground; use translucent structural surfaces above it.'],
  ['Use the shared hero authority.','F&B geometry is canonical through route-hero-standard.css.'],
  ['Use the shared control authority.','Back and quiet actions come from app-controls.css; do not redraw them per route.'],
  ['Reuse before creating.','If a proven card, selector, dialog or disclosure already exists, consume it instead of approximating it.'],
  ['Keep Settings navigation fixed.','The secondary Settings rail is always Account / People / Comms / System. Authorization changes content, never rail geometry.'],
  ['Use capability-driven privileged UI.','Developer UI Library access is granted by developer.ui_library; hiding a card is not the only route gate.'],
  ['Respect reduced motion.','State remains understandable while transforms/transitions are suppressed when the user requests reduced motion.'],
  ['Design mobile first.','Validate 360px, 390px and 768px before treating a component as canonical.'],
  ['Use the router for authenticated navigation.','Never create a second authenticated HTML document or same-origin full-document navigation.']
]);

export const UI_SYSTEM_OWNERSHIP=Object.freeze([
  ['Typography','site/fonts.css'],['Persistent shell','site/shell.css + site/bootstrap.js'],
  ['Route registry','site/route-registry.js'],['Route transition','site/app-transitions.js + site/app-transitions.css'],
  ['Route hero','site/route-hero-standard.css'],['Back / quiet controls','site/app-controls.css'],
  ['Main + contextual footer','site/footer-route-guard.js + site/footer-route-guard.css'],
  ['F&B cards / selectors','site/fnb.css + site/fnb-approved-polish.css + site/fnb-refinements.css'],
  ['Settings renderer','site/settings.js + site/settings-route-v3.js'],['Settings dialogs','site/settings-dialog-standard.js + site/settings-dialog-standard.css'],
  ['Brand cards','site/brand.css'],['History disclosures','site/ihg-history.js + site/ihg-history.css'],
  ['Factsheet tables / room cards','site/hotel-factsheet.js + site/hotel-factsheet.css'],
  ['Developer CI registry','site/ui-system-registry.js'],['Developer CI renderer','site/ci.js + site/ci.css']
]);

export const NEW_PAGE_BLUEPRINT=`import {loadSettingsAuthority} from './capabilities.js';

export async function mountExampleRoute(root){
  // 1. Register /example in route-registry.js.
  // 2. Never create another authenticated HTML document.
  // 3. Reuse the persistent shell and shared route transition.
  root.innerHTML = \`
    <section class="example-route">
      <header class="fnb-hero">
        <p class="fnb-eyebrow">Section</p>
        <h1>Page Title</h1>
        <p class="fnb-period">Short supporting copy.</p>
      </header>
      <main>...</main>
    </section>\`;
  return ()=>{};
}`;

export const COMPONENT_CODE=Object.freeze({
  back:`<button class="app-back-control" type="button" aria-label="Back">\n  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>\n</button>`,
  quiet:`<button class="app-quiet-action" type="button">\n  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M7 10l5-5 5 5"/></svg>\n  <span>Back to top</span>\n</button>`,
  hero:`<header class="fnb-hero">\n  <p class="fnb-eyebrow">Section</p>\n  <h1>Page Title</h1>\n  <p class="fnb-period">Supporting copy.</p>\n</header>`,
  card:`<article class="fnb-card">\n  <button class="fnb-card-button" type="button">\n    <div class="fnb-card-status"><span class="fnb-card-status-label">Upcoming</span></div>\n    <h2 class="fnb-card-title">Actionable Card</h2>\n    <p class="fnb-card-copy">Use this when the whole surface is actionable.</p>\n  </button>\n</article>`,
  select:`<div class="fnb-select">\n  <button class="fnb-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">\n    <span>All outlets</span>\n    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>\n  </button>\n</div>`,
  input:`<div class="settings-field">\n  <label>Label</label>\n  <input type="text" placeholder="Value">\n</div>`,
  navigation:`<a href="/brand" data-app-route="brand">Brand</a>`,
  disclosure:`<button type="button" aria-expanded="false">\n  <span>Disclosure title</span>\n  <span aria-hidden="true">›</span>\n</button>`,
  image:`<img src="..." alt="Descriptive alternative text" loading="lazy">`
});
