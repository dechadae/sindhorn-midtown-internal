import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const route=read('site/route-registry.js');
const redirects=read('site/_redirects');
const footer=read('site/footer-route-guard.js');
const settingsRoute=read('site/settings-route-v3.js');
const settingsEnhancer=read('site/settings-system-library.js');
const registry=read('site/ui-system-registry.js');
const ci=read('site/ci.js');
const ciCss=read('site/ci.css');
const hero=read('site/route-hero-standard.css');
const index=read('site/index.html');
const override=read('docs/SETTINGS-FIXED-RAIL-AND-DEVELOPER-CI-OVERRIDE-20260830.md');

assert(route.includes("ci:Object.freeze({path:'/ci'"),'CI route missing');
assert(route.includes("module:'./ci.js?v=1'"),'CI module cache pin missing');
assert(redirects.includes('/ci / 200'),'CI SPA rewrite missing');
assert(footer.includes("path==='/ci')return'settings'"),'CI footer state must not mark Today current');
assert(settingsRoute.includes("mountSettingsSystemLibrary"),'Settings System enhancer not mounted');
assert(settingsRoute.includes('/settings-system-library.css?v=1'),'Settings System enhancer stylesheet missing');
assert(settingsEnhancer.includes("const UI_LIBRARY_CAPABILITY='developer.ui_library'"),'Developer capability gate missing');
assert(settingsEnhancer.includes("{key:'account',label:'Account'}")&&settingsEnhancer.includes("{key:'people',label:'People'}")&&settingsEnhancer.includes("{key:'comms',label:'Comms'}")&&settingsEnhancer.includes("{key:'system',label:'System'}"),'Fixed four Settings sections missing');
assert(settingsEnhancer.indexOf("{key:'account'")<settingsEnhancer.indexOf("{key:'people'")&&settingsEnhancer.indexOf("{key:'people'")<settingsEnhancer.indexOf("{key:'comms'")&&settingsEnhancer.indexOf("{key:'comms'")<settingsEnhancer.indexOf("{key:'system'"),'Settings fixed section order changed');
assert(registry.includes("UI_SYSTEM_CAPABILITY='developer.ui_library'"),'UI registry capability mismatch');
assert((registry.match(/\['[a-z]+','[^']+'\]/g)||[]).length>=18,'UI registry does not expose the planned section set');
for(const name of ['Identity','Foundations','Typography','Layout','Heroes','Surfaces & Cards','Actions','Navigation','Filters & Chips','Disclosures','Forms','Dialogs','Tables & Data','Imagery','States','Motion & Accessibility','New Page Blueprint','Rules & Ownership'])assert(registry.includes(name),`Missing UI Library section ${name}`);
assert(hero.includes('.app-route-hero')&&hero.includes('.app-route-eyebrow')&&hero.includes('.app-route-title')&&hero.includes('.app-route-copy'),'Semantic shared hero API missing');
assert(index.includes('/route-hero-standard.css?v=4'),'Shared hero cache version not bumped');
assert(ci.includes('loadSettingsAuthority({force:true})')&&ci.includes('hasCapability(UI_SYSTEM_CAPABILITY,authority)'),'CI route does not independently authorize');
assert(ci.includes("history.replaceState({route:'settings'},'', '/settings?section=system')"),'Unauthorized CI fallback must return to Settings System');
for(const liveClass of ['app-back-control','app-quiet-action','fnb-card','fnb-select','factsheet-room-card','settings-field','settings-dialog','factsheet-table-wrap'])assert(ci.includes(liveClass),`CI is missing live specimen ${liveClass}`);
assert(ci.includes('getComputedStyle')&&ci.includes('Design system status · PASS'),'Live drift checks missing');
assert(ciCss.includes('.ci-route::before{content:none!important'),'CI route overlay guard missing');
assert(!/letter-spacing\s*:\s*(?!0(?:!important)?[;\}])/.test(ciCss),'CI documentation introduced non-zero tracking');
assert(override.includes('Account / People / Comms / System')&&override.includes('developer.ui_library'),'Architecture override incomplete');

for(const file of ['site/ci.js','site/ci.css','site/ui-system-registry.js','site/settings-system-library.js','site/settings-system-library.css']){
  const text=read(file);
  assert(!/[\u0E00-\u0E7F]/.test(text),`Thai UI chrome detected in ${file}`);
  assert(!/Poppins|Noto Sans|IBM Plex|Vignette Sans/i.test(text),`Disallowed font reference in ${file}`);
}

console.log(JSON.stringify({ok:true,route:'/ci',capability:'developer.ui_library',settingsRail:['Account','People','Comms','System'],sections:18,semanticHero:true}));
