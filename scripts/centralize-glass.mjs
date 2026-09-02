import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,value)=>fs.writeFileSync(path,value);
const escapeRe=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function replaceRequired(source,from,to,label,min=1){
  const count=source.split(from).length-1;
  if(count<min)throw new Error(`${label}: expected at least ${min} match(es), found ${count}`);
  return source.split(from).join(to);
}
function removeRequired(source,value,label){return replaceRequired(source,value,'',label,1)}
function mutate(path,fn){
  const before=read(path),after=fn(before);
  if(after===before)throw new Error(`${path}: migration made no changes`);
  write(path,after);
  console.log(`updated ${path}`);
}
function ensureFilterInRule(source,selector,token='--app-glass-surface-filter'){
  const re=new RegExp(`${escapeRe(selector)}\\{([^}]*)\\}`);
  const match=source.match(re);
  if(!match)throw new Error(`${selector}: rule not found`);
  if(match[1].includes('backdrop-filter:'))return source;
  const declaration=`backdrop-filter:var(${token});-webkit-backdrop-filter:var(${token});`;
  return source.replace(re,`${selector}{${match[1]}${declaration}}`);
}

mutate('site/fnb.css',source=>{
  source=replaceRequired(source,'--fnb-glass:rgba(46,39,59,.55);','--fnb-glass:var(--app-glass-surface-fill);','F&B surface token');
  source=replaceRequired(source,'--fnb-glass-brd:rgba(250,247,245,.14);','--fnb-glass-brd:var(--app-glass-surface-border);','F&B border token');
  source=replaceRequired(source,'isolation:isolate','isolation:auto','F&B route isolation');
  source=replaceRequired(source,'.fnb-route::before{content:"";position:fixed;z-index:-1;inset:0;background:linear-gradient(180deg,rgba(24,20,32,.72),rgba(24,20,32,.5) 30%,rgba(24,20,32,.62) 70%,rgba(24,20,32,.86));pointer-events:none}', '.fnb-route::before{content:none}', 'F&B route overlay');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','F&B CI surface filter',3);
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','F&B detail rail filter');
  for(const selector of ['.fnb-select select','.fnb-chip','.fnb-back','.fnb-action','.fnb-link-field input'])source=ensureFilterInRule(source,selector,'--app-glass-control-filter');
  for(const selector of ['.fnb-empty','.fnb-folder-empty'])source=ensureFilterInRule(source,selector);
  return source;
});

mutate('site/fnb-approved-polish.css',source=>{
  source=removeRequired(source,'.fnb-card,.fnb-text-card,.fnb-art-card{background:rgba(46,39,59,.66);backdrop-filter:none;-webkit-backdrop-filter:none}\n','Remove F&B blur-disabling override');
  source=replaceRequired(source,'background:rgba(46,39,59,.72);color:var(--sm-text);','background:var(--app-glass-control-fill);color:var(--sm-text);','F&B selector control fill');
  source=ensureFilterInRule(source,'.fnb-select-trigger','--app-glass-control-filter');
  return source;
});

mutate('site/fnb-refinements.css',source=>{
  source=replaceRequired(source,'/* One atmosphere: the F&B route must not dim the persistent WebGL scene. */\n.fnb-route{isolation:auto!important}\n.fnb-route::before{content:none!important;background:none!important}\n.fnb-card,.fnb-text-card,.fnb-art-card{background:rgba(46,39,59,.48)!important}\n.fnb-folder-empty{background:rgba(46,39,59,.46)!important}\n','/* Atmosphere and glass material are owned by fnb.css + app-glass.css. */\n','Remove F&B material patch layer');
  source=replaceRequired(source,'background:rgba(46,39,59,.44);color:var(--sm-text);','background:var(--app-glass-control-fill);color:var(--sm-text);backdrop-filter:var(--app-glass-control-filter);-webkit-backdrop-filter:var(--app-glass-control-filter);','F&B framed action material');
  return source;
});

mutate('site/settings.css',source=>{
  source=replaceRequired(source,'--settings-glass:rgba(46,39,59,.55);','--settings-glass:var(--app-glass-surface-fill);','Settings surface token');
  source=replaceRequired(source,'--settings-glass-brd:rgba(250,247,245,.14);','--settings-glass-brd:var(--app-glass-surface-border);','Settings border token');
  source=replaceRequired(source,'isolation:isolate','isolation:auto','Settings route isolation');
  source=replaceRequired(source,'.settings-route::before{content:"";position:fixed;z-index:-1;inset:0;background:linear-gradient(180deg,rgba(24,20,32,.72),rgba(24,20,32,.50) 30%,rgba(24,20,32,.62) 70%,rgba(24,20,32,.86));pointer-events:none}', '.settings-route::before{content:none}', 'Settings route overlay');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','Settings CI surface filter',4);
  for(const selector of ['.settings-primary','.settings-close','.settings-field input','.settings-status','.settings-dialog-actions button,.settings-code-actions button'])source=ensureFilterInRule(source,selector,'--app-glass-control-filter');
  return source;
});

mutate('site/settings-refinements.css',source=>{
  source=replaceRequired(source,'background:rgba(229,236,190,.10)!important;','background:rgba(229,236,190,.10)!important;\n  backdrop-filter:var(--app-glass-control-filter)!important;\n  -webkit-backdrop-filter:var(--app-glass-control-filter)!important;','Settings primary control blur');
  source=replaceRequired(source,'background:rgba(46,39,59,.42)!important;','background:var(--app-glass-control-fill)!important;','Settings quiet control fill');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18)!important;\n  -webkit-backdrop-filter:blur(18px) saturate(1.18)!important;','backdrop-filter:var(--app-glass-control-filter)!important;\n  -webkit-backdrop-filter:var(--app-glass-control-filter)!important;','Settings quiet control filter');
  return source;
});

mutate('site/business-dashboard.css',source=>{
  source=replaceRequired(source,'--bd-glass:rgba(46,39,59,.48);','--bd-glass:var(--app-glass-surface-fill);','Today surface token');
  source=replaceRequired(source,'--bd-border:var(--app-control-border,rgba(250,247,245,.14));','--bd-border:var(--app-glass-surface-border);','Today border token');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.16);-webkit-backdrop-filter:blur(18px) saturate(1.16)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','Today CI surface filter',3);
  for(const selector of ['.bd-flag','.bd-disclosure','.bd-benchmark-grid','.bd-empty'])source=ensureFilterInRule(source,selector);
  return source;
});

mutate('site/brand.css',source=>{
  source=replaceRequired(source,'--brand-glass:rgba(46,39,59,.48);--brand-border:rgba(250,247,245,.14);','--brand-glass:var(--app-glass-surface-fill);--brand-border:var(--app-glass-surface-border);','Brand glass tokens');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','Brand CI filter');
  return source;
});

mutate('site/hotel-factsheet.css',source=>{
  source=replaceRequired(source,'--fs-glass:rgba(46,39,59,.55);--fs-border:rgba(250,247,245,.14);','--fs-glass:var(--app-glass-surface-fill);--fs-border:var(--app-glass-surface-border);','Factsheet glass tokens');
  source=replaceRequired(source,'background:rgba(46,39,59,.48);box-shadow:inset 0 1px 0 rgba(250,247,245,.025);','background:var(--fs-glass);box-shadow:inset 0 1px 0 rgba(250,247,245,.025);','Factsheet room surface');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','Factsheet CI filter',2);
  for(const selector of ['.factsheet-picture','.factsheet-room-card'])source=ensureFilterInRule(source,selector);
  return source;
});

mutate('site/ihg-history.css',source=>{
  source=replaceRequired(source,'--ihg-history-surface:rgba(46,39,59,.48);','--ihg-history-surface:var(--app-glass-surface-fill);','History surface token');
  source=replaceRequired(source,'--ihg-history-border:rgba(250,247,245,.14);','--ihg-history-border:var(--app-glass-surface-border);','History border token');
  for(const selector of ['.ihg-history-card','.ihg-history-source'])source=ensureFilterInRule(source,selector);
  return source;
});

mutate('site/ci.css',source=>{
  source=replaceRequired(source,'--ci-glass:rgba(46,39,59,.48);','--ci-glass:var(--app-glass-surface-fill);','CI surface token');
  source=replaceRequired(source,'--ci-border:rgba(250,247,245,.14);','--ci-border:var(--app-glass-surface-border);','CI border token');
  source=replaceRequired(source,'backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)','backdrop-filter:var(--app-glass-surface-filter);-webkit-backdrop-filter:var(--app-glass-surface-filter)','CI canonical filter',2);
  for(const selector of ['.ci-index button','.ci-identity-lockup','.ci-token','.ci-image-demo','.ci-motion-step','.ci-primary'])source=ensureFilterInRule(source,selector,selector==='.ci-index button'||selector==='.ci-primary'?'--app-glass-control-filter':'--app-glass-surface-filter');
  return source;
});

mutate('site/ui-system-registry.js',source=>{
  source=replaceRequired(source,"{name:'--app-glass-surface-fill',label:'Glass surface fill',kind:'color',fallback:'rgba(46,39,59,.64)'},","{name:'--app-glass-surface-fill',label:'Glass surface fill',kind:'color',fallback:'rgba(46,39,59,.48)'},",'UI Library surface token');
  source=replaceRequired(source,"{name:'--app-glass-surface-filter',label:'Glass surface filter',kind:'material',fallback:'blur(32px) saturate(.86) brightness(.92)'},","{name:'--app-glass-surface-filter',label:'Glass surface filter',kind:'material',fallback:'blur(18px) saturate(1.18)'},",'UI Library surface filter');
  source=replaceRequired(source,"{name:'--app-glass-control-filter',label:'Glass control filter',kind:'material',fallback:'blur(20px) saturate(.92) brightness(.95)'},","{name:'--app-glass-control-filter',label:'Glass control filter',kind:'material',fallback:'blur(18px) saturate(1.18)'},",'UI Library control filter');
  return source;
});

for(const path of ['site/app-glass.css','site/fnb.css','site/fnb-approved-polish.css','site/fnb-refinements.css','site/settings.css','site/settings-refinements.css','site/business-dashboard.css','site/brand.css','site/hotel-factsheet.css','site/ihg-history.css','site/ci.css']){
  const source=read(path);
  if(/backdrop-filter:none[^;]*;?-webkit-backdrop-filter:none/.test(source)&&!path.endsWith('fnb-refinements.css'))console.warn(`${path}: contains an explicit no-blur rule; review if surface is opaque/utility`);
}

console.log('CI glass source migration complete.');
