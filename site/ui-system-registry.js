export const UI_SYSTEM_VERSION='1.3.0-preview';
export const UI_SYSTEM_CAPABILITY='developer.ui_library';

export const UI_SYSTEM_SECTIONS=Object.freeze([
  ['identity','Identity'],['foundations','Foundations'],['glass','Glass Material'],['typography','Typography'],['layout','Layout'],
  ['heroes','Heroes'],['surfaces','Surfaces & Cards'],['actions','Actions'],['navigation','Navigation'],
  ['selectors','Filters & Chips'],['disclosures','Disclosures'],['forms','Forms'],['dialogs','Dialogs'],
  ['tables','Tables & Data'],['imagery','Imagery'],['states','States'],['motion','Motion & Accessibility'],
  ['blueprint','New Page Blueprint'],['rules','Rules & Ownership']
].map(([id,label],index)=>Object.freeze({id,label,index:index+1})));

export const UI_SYSTEM_TOKENS=Object.freeze([
  {name:'--sm-text',label:'Primary text',kind:'color',fallback:'#FAF7F5'},
  {name:'--route-hero-accent',label:'Sorbet accent',kind:'color',fallback:'#E5ECBE'},
  {name:'--route-hero-muted',label:'Muted copy',kind:'color',fallback:'rgba(250,247,245,.66)'},
  {name:'--app-control-glass',label:'Control glass',kind:'color',fallback:'rgba(46,39,59,.55)'},
  {name:'--app-glass-surface-fill',label:'Glass surface fill',kind:'color',fallback:'rgba(46,39,59,.48)'},
  {name:'--app-control-border',label:'Control border',kind:'color',fallback:'rgba(250,247,245,.14)'},
  {name:'--sm-footer-active',label:'Footer active',kind:'color',fallback:'#E5ECBE'},
  {name:'--app-glass-surface-filter',label:'Glass surface filter',kind:'material',fallback:'blur(18px) saturate(1.18)'},
  {name:'--app-glass-control-filter',label:'Glass control filter',kind:'material',fallback:'blur(18px) saturate(1.18)'},
  {name:'--app-control-motion-fast',label:'Fast press',kind:'motion',fallback:'160ms'},
  {name:'--app-control-motion-base',label:'Base state',kind:'motion',fallback:'260ms'},
  {name:'--fnb-motion-slow',label:'Disclosure',kind:'motion',fallback:'420ms'},
  {name:'--app-transition-ms',label:'Route transition',kind:'motion',fallback:'280ms'},
  {name:'--app-back-size',label:'Back control size',kind:'size',fallback:'36px'},
  {name:'--app-back-radius',label:'Back control radius',kind:'size',fallback:'12px'},
  {name:'--app-utility-height',label:'Utility action height',kind:'size',fallback:'36px'},
  {name:'--app-utility-font',label:'Utility action type',kind:'size',fallback:'12px'},
  {name:'--app-radius-avatar',label:'Avatar radius',kind:'size',fallback:'12px'},
  {name:'--app-radius-chip',label:'Compact tag radius',kind:'size',fallback:'9px'},
  {name:'--app-radius-indicator',label:'Status mark radius',kind:'size',fallback:'2px'},
  {name:'--sm-footer-height',label:'Footer rail height',kind:'size',fallback:'54px'},
  {name:'--sm-footer-item-radius',label:'Footer item radius',kind:'size',fallback:'13px'}
]);

export const UI_SYSTEM_COMPONENTS=Object.freeze([
  Object.freeze({id:'hero',label:'Route hero',selector:'.app-route-hero',owner:'site/route-hero-standard.css',use:'Every new authenticated top-level route.',avoid:'Do not invent route-specific title sizing, weights or padding.',a11y:'Exactly one route h1. Keep supporting copy concise.'}),
  Object.freeze({id:'glass',label:'Translucent glass material',selector:'Translucent cards, controls and chips',owner:'site/app-glass.css',use:'Every interface surface that intentionally reveals the atmosphere or content behind it.',avoid:'Never pair a translucent UI fill with backdrop-filter:none or omit blur from a glass control. Fully transparent utility actions are exempt.',a11y:'Material is decorative; text contrast and semantic behavior remain owned by the component.'}),
  Object.freeze({id:'back',label:'Back control',selector:'.app-back-control',owner:'site/app-controls.css',use:'Contextual return from a child/detail route.',avoid:'Do not redraw the chevron or change the 36 × 36 / 12px geometry.',a11y:'Provide an explicit aria-label and preserve a visible focus ring.'}),
  Object.freeze({id:'quiet',label:'Utility action',selector:'.app-utility-action',owner:'site/app-controls.css',use:'Low-emphasis utilities: Sign out, Share and Back to top.',avoid:'Never add a fill, border, backdrop blur or left-aligned route variant. Utility actions stay frameless and right anchored.',a11y:'Visible text plus semantic button/link behavior.'}),
  Object.freeze({id:'action-card',label:'Actionable glass card',selector:'.fnb-card + .fnb-card-button',owner:'site/fnb.css + site/fnb-approved-polish.css',use:'Whole-surface actions that open detail or another route.',avoid:'Do not make non-actionable information look tappable.',a11y:'One semantic button or link owns the entire hit area.'}),
  Object.freeze({id:'selector',label:'Selector',selector:'.fnb-select',owner:'site/fnb-approved-polish.css',use:'Compact finite filters and Settings select fields.',avoid:'Do not create a visually different dropdown for a new page.',a11y:'Trigger exposes listbox state; options remain keyboard reachable.'}),
  Object.freeze({id:'disclosure',label:'Disclosure card',selector:'.factsheet-room-card',owner:'site/hotel-factsheet.css',use:'Structured content that expands in place.',avoid:'Do not animate layout with arbitrary heights or route-specific timings.',a11y:'Button maintains aria-expanded and content remains in DOM.'}),
  Object.freeze({id:'field',label:'Form field',selector:'.settings-field',owner:'site/settings.css',use:'Settings and future authenticated forms.',avoid:'Do not remove labels in favor of placeholders.',a11y:'Associate visible labels and expose error/status text.'}),
  Object.freeze({id:'dialog',label:'Dialog / sheet',selector:'.settings-dialog',owner:'site/settings-dialog-standard.js + site/settings-dialog-standard.css',use:'Focused editing, confirmation and bounded secondary tasks.',avoid:'Do not build another modal animation or scrolling model.',a11y:'Use native dialog semantics and the centralized open/close controller.'}),
  Object.freeze({id:'table',label:'Dense data table',selector:'.factsheet-table-wrap',owner:'site/hotel-factsheet.css',use:'Capacity matrices and horizontally dense reference data.',avoid:'Do not squeeze every column until labels become unreadable.',a11y:'Preserve table headers and horizontal scroll on small screens.'}),
  Object.freeze({id:'footer',label:'Persistent footer',selector:'#app-footer .shell-footer-rail',owner:'site/footer-route-guard.js + site/footer-route-guard.css',use:'Global navigation and the approved Settings/F&B contextual rail.',avoid:'Do not create route-owned painted footers.',a11y:'Current item uses aria-current; labels remain visible.'})
]);

export const UI_SYSTEM_RULES=Object.freeze([
  ['Use LINE Seed Sans TH only.','Production ships real weights 100 / 400 / 700; never introduce another UI font.'],
  ['Use zero character tracking.','letter-spacing stays 0 across headings, body, labels and controls.'],
  ['Use rounded corners, never circular UI chrome.','Avatars, chips, badges, status marks and icon controls use app-shapes.css. Do not introduce 50% / 999px capsule geometry for interface elements. Natural sun/moon/weather rendering is exempt.'],
  ['Translucency always blurs.','If a card, button, chip, field, menu or navigation item intentionally shows the background through its fill, it consumes app-glass.css. Fully transparent utility actions are exempt.'],
  ['Utility actions are frameless and right aligned.','Sign out, Share and Back to top consume app-utility-action from app-controls.css. They have no painted background, border, shadow or backdrop blur and stay on the right edge of their action context.'],
  ['Keep one persistent authenticated shell.','Authenticated routes replace only #route-view; header, footer, auth and atmosphere stay mounted.'],
  ['Do not paint a route-wide dark overlay.','The Bangkok atmosphere is the visual ground; use translucent structural surfaces above it.'],
  ['Use the shared hero authority.','New pages use app-route-hero / app-route-eyebrow / app-route-title / app-route-copy.'],
  ['Use the shared control authority.','Back and utility actions come from app-controls.css; do not redraw them per route.'],
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
  ['Route hero','site/route-hero-standard.css'],['Back / utility controls','site/app-controls.css'],
  ['UI shape language','site/app-shapes.css'],['Glass material','site/app-glass.css'],
  ['Main + contextual footer','site/footer-route-guard.js + site/footer-route-guard.css'],
  ['F&B cards / selectors','site/fnb.css + site/fnb-approved-polish.css + site/fnb-refinements.css'],
  ['Settings renderer','site/settings.js + site/settings-route-v3.js'],['Settings dialogs','site/settings-dialog-standard.js + site/settings-dialog-standard.css'],
  ['Brand cards','site/brand.css'],['History disclosures','site/ihg-history.js + site/ihg-history.css'],
  ['Factsheet tables / room cards','site/hotel-factsheet.js + site/hotel-factsheet.css'],
  ['Developer CI registry','site/ui-system-registry.js'],['Developer CI renderer','site/ci.js + site/ci.css + site/ci-glass-audit.js']
]);

export const NEW_PAGE_BLUEPRINT=`export async function mountExampleRoute(root){
  // 1. Register /example in route-registry.js.
  // 2. Never create another authenticated HTML document.
  // 3. Reuse the persistent shell and shared route transition.
  root.innerHTML = \`
    <section class="example-route">
      <header class="app-route-hero">
        <p class="app-route-eyebrow">Section</p>
        <h1 class="app-route-title">Page Title</h1>
        <p class="app-route-copy">Short supporting copy.</p>
      </header>
      <main>...</main>
    </section>\`;
  return ()=>{};
}`;

export const COMPONENT_CODE=Object.freeze({
  back:`<button class="app-back-control" type="button" aria-label="Back">\n  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>\n</button>`,
  quiet:`<button class="app-utility-action" type="button">\n  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M7 10l5-5 5 5"/></svg>\n  <span>Back to top</span>\n</button>`,
  hero:`<header class="app-route-hero">\n  <p class="app-route-eyebrow">Section</p>\n  <h1 class="app-route-title">Page Title</h1>\n  <p class="app-route-copy">Supporting copy.</p>\n</header>`,
  card:`<article class="fnb-card">\n  <button class="fnb-card-button" type="button">\n    <div class="fnb-card-status"><span class="fnb-text-label">Upcoming</span></div>\n    <h2 class="fnb-card-title">Actionable Card</h2>\n    <p class="fnb-card-outlets">Supporting information</p>\n    <div class="fnb-card-foot"><span>Open detail</span><span class="fnb-chevron">›</span></div>\n  </button>\n</article>`,
  select:`<div class="fnb-select">\n  <button class="fnb-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">\n    <span>All outlets</span>\n    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>\n  </button>\n  <div class="fnb-select-menu" role="listbox" aria-hidden="true">…</div>\n</div>`,
  input:`<div class="settings-field">\n  <label for="fieldId">Label</label>\n  <input id="fieldId" type="text" placeholder="Value">\n</div>`,
  navigation:`<a href="/brand" data-app-route="brand">Brand</a>`,
  disclosure:`<article class="factsheet-room-card">\n  <button class="factsheet-room-card-button" type="button" aria-expanded="false">…</button>\n  <div class="factsheet-room-panel">…</div>\n</article>`,
  image:`<img src="…" alt="Descriptive alternative text" loading="lazy">`
});