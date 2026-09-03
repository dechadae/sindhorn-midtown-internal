/* Assign the one canonical glass material to all translucent app components.
   This file owns material classification only. Component geometry/content stays
   with each route. New translucent components should add app-glass-surface or
   app-glass-control directly; this registry keeps existing app surfaces aligned. */

const SURFACE_SELECTORS=[
  /* persistent shell */
  '.masthead','.app-tabbar','.shell-footer-rail',
  /* Today / business dashboard */
  '.bd-metric','.bd-flag','.bd-summary-surface','.bd-disclosure','.bd-benchmark-grid','.bd-outlook-card','.bd-empty',
  /* F&B */
  '.fnb-card','.fnb-text-card','.fnb-art-card','.fnb-empty','.fnb-folder-empty','.fnb-section-rail',
  /* Settings */
  '.settings-avatar','.settings-user-card','.settings-state','.settings-planned','.settings-system-library-card','.settings-guide-card',
  /* Brand / Factsheet / History */
  '.brand-card','.factsheet-table-wrap tbody th','.factsheet-picture','.factsheet-card','.factsheet-room-card','.factsheet-disclosure','.ihg-history-card','.ihg-history-source','.ihg-history-visual',
  /* Messages */
  '.message-card',
  /* CI / developer UI */
  /* CI documentation cards sit directly on the route, so they touch the atmosphere and are
     glass. .ci-specimen is deliberately absent: it is a frame that wraps glass specimens. */
  '.ci-doc-card','.ci-rule','.ci-state-card','.ci-owner-card',
  '.ci-status','.ci-identity-lockup','.ci-token','.ci-image-demo','.ci-motion-step',
  /* onboarding / admin */
  '.onboarding-complete','.signed-card','.admin-panel'
].join(',');

const CONTROL_SELECTORS=[
  /* shared/back */
  '.app-back-control','.fnb-back',
  /* F&B */
  '.fnb-chip','.fnb-select select','.fnb-select-trigger','.fnb-expand','.fnb-link-field input','.fnb-action:not(.app-utility-action)',
  /* Settings */
  '.settings-primary','.settings-quiet-action:not(.app-utility-action)','.settings-add','.settings-search','.settings-close','.settings-field input','.settings-status','.settings-dialog-actions button','.settings-code-actions button','.business-card-settings-actions button',
  /* Messages */
  '.message-clear',
  /* CI */
  '.ci-index button','.ci-copy-code','.ci-primary',
  /* onboarding / generic */
  '.onboarding-close','.onboarding-secondary','.onboarding-quiet','.field input','.field select','.chip-btn','.public-card-action'
].join(',');

/* THE RULE: glass only where it touches the atmosphere.

   backdrop-filter cannot sample past an ancestor that already has one, so a
   glass element inside a glass element renders as a flat fill however it is
   styled. Measured: an identical dropdown blurred on /fnb and not at all on
   /ci, purely because the CI specimen container was itself glass.

   The registry already decides who gets the material, so it is also the right
   place to refuse it. Skipping the stamp here needs no CSS override and no
   !important - and because nested glass was already rendering as its flat
   fill, refusing it is visually identical. */
function hasGlassAncestor(node){
  for(let parent=node.parentElement;parent;parent=parent.parentElement){
    if(parent.classList?.contains('app-glass-surface')||parent.classList?.contains('app-glass-control'))return true;
  }
  return false;
}

function assign(root){
  if(!root?.querySelectorAll)return;
  if(root.matches?.(SURFACE_SELECTORS)&&!hasGlassAncestor(root))root.classList.add('app-glass-surface');
  if(root.matches?.(CONTROL_SELECTORS)&&!root.matches('.app-utility-action,.app-quiet-action')&&!hasGlassAncestor(root))root.classList.add('app-glass-control');
  root.querySelectorAll(SURFACE_SELECTORS).forEach(node=>{if(!hasGlassAncestor(node))node.classList.add('app-glass-surface')});
  root.querySelectorAll(CONTROL_SELECTORS).forEach(node=>{
    if(node.matches('.app-utility-action,.app-quiet-action'))return;
    if(hasGlassAncestor(node))return;
    node.classList.add('app-glass-control');
  });
  root.querySelectorAll('.app-utility-action,.app-quiet-action').forEach(node=>{
    node.classList.remove('app-glass-surface','app-glass-control');
  });
}

export function applyGlassMaterial(root=document){assign(root)}

export function initGlassMaterial(hosts=[]){
  const roots=(Array.isArray(hosts)?hosts:[hosts]).filter(Boolean);
  roots.forEach(assign);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){if(node.nodeType===1)assign(node)}
    }
  });
  roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
  document.addEventListener('sindhorn:route-mounted',()=>roots.forEach(assign));
  document.addEventListener('sindhorn:pack-updated',()=>roots.forEach(assign));
  return()=>observer.disconnect();
}
