import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [index,actionCard,brandJs,brandCss,registry,routeRegistry,settingsLibrary,shapeCss,fonts]=await Promise.all([
  read('site/index.html'),read('site/app-action-card.css'),read('site/brand.js'),read('site/brand.css'),
  read('site/ui-system-registry.js'),read('site/route-registry.js'),read('site/settings-system-library.js'),
  read('site/app-shapes.css'),read('site/fonts.css')
]);

assert(index.includes('/app-action-card.css?v=1'),'Shared action-card stylesheet is not loaded by the shell');
assert(actionCard.includes('.app-action-card{')&&actionCard.includes('.app-action-card-control{'),'Semantic action-card API is incomplete');
assert(actionCard.includes('160ms')&&actionCard.includes('260ms')&&actionCard.includes('cubic-bezier(.22,1,.36,1)'),'Action-card motion is not aligned to the tactile grammar');
assert(actionCard.includes('scale(.992)')&&actionCard.includes('prefers-reduced-motion:reduce'),'Action-card press/reduced-motion contract missing');
assert(!/border-radius\s*:\s*(50%|999(?:9)?px)/i.test(actionCard),'Action-card authority contains circular/capsule geometry');

assert((brandJs.match(/brand-card app-action-card/g)||[]).length===2,'Both Brand card containers must consume the shared primitive');
assert((brandJs.match(/brand-card-link app-action-card-control/g)||[]).length===2,'Both Brand whole-surface links must consume the shared control primitive');
assert((brandJs.match(/app-action-card-title/g)||[]).length===2,'Brand titles must use the semantic card title hook');
assert(brandJs.includes("link.href='/brand.css?v=4'"),'Brand route cache lineage was not advanced');
for(const duplicate of ['transition:transform','focus-within','scale(.992)','translateY(-2px)','border-radius:14px']){
  assert(!brandCss.includes(duplicate),`Brand still duplicates shared action-card behavior: ${duplicate}`);
}
assert(brandCss.includes('--app-action-card-filter:blur(18px) saturate(1.18)'),'Brand material variant must preserve the pre-migration blur');
assert(routeRegistry.includes("module:'./brand.js?v=4'"),'Route registry must request the migrated Brand module');

assert(registry.includes("UI_SYSTEM_VERSION='1.3.0-preview'"),'Registry version not advanced');
assert(registry.includes("selector:'.app-action-card + .app-action-card-control'"),'Registry does not identify semantic action-card authority');
assert(registry.includes("['Actionable cards','site/app-action-card.css']"),'Ownership map missing actionable-card authority');
assert(registry.includes('app-action-card app-action-card-control'),'New-page blueprint does not teach the shared actionable card');

for(const label of ['Account','People','Comms','System'])assert(settingsLibrary.includes(`label:'${label}'`),`Fixed Settings rail is missing ${label}`);
assert(settingsLibrary.indexOf("label:'Account'")<settingsLibrary.indexOf("label:'People'")&&settingsLibrary.indexOf("label:'People'")<settingsLibrary.indexOf("label:'Comms'")&&settingsLibrary.indexOf("label:'Comms'")<settingsLibrary.indexOf("label:'System'"),'Settings rail order drifted');
assert(settingsLibrary.includes("UI_LIBRARY_CAPABILITY='developer.ui_library'"),'Developer UI Library capability changed');

for(const token of ['--app-radius-avatar:12px','--app-radius-chip:9px','--app-radius-footer:13px'])assert(shapeCss.replaceAll(' ','').includes(token),`Shape token missing: ${token}`);
assert(fonts.includes('LINE Seed Sans TH'),'LINE Seed Sans TH authority missing');
assert(!/(Poppins|Noto Sans|IBM Plex|serif|monospace)/i.test(actionCard+brandCss),'New shared/Brand card CSS introduced a prohibited font family');

console.log(JSON.stringify({ok:true,registry:'1.3.0-preview',brandCards:2,sharedActionCard:true,fixedSettingsRail:['Account','People','Comms','System']}));
