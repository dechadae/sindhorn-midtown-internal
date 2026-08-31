import fs from 'node:fs/promises';

const [registry,routeRegistry,dashboardJs,dashboardCss,motionJs,motionCss,ciSpecimenFixes]=await Promise.all([
  fs.readFile('site/ui-system-registry.js','utf8'),
  fs.readFile('site/route-registry.js','utf8'),
  fs.readFile('site/business-dashboard.js','utf8'),
  fs.readFile('site/business-dashboard.css','utf8'),
  fs.readFile('site/business-dashboard-motion.js','utf8'),
  fs.readFile('site/business-dashboard-motion.css','utf8'),
  fs.readFile('site/ci-specimen-fixes.css','utf8')
]);

const checks=[];
const assert=(condition,key,detail)=>{checks.push({key,ok:Boolean(condition),detail});if(!condition)throw new Error(`${key}: ${detail}`)};

const ciRules=[
  'Use LINE Seed Sans TH only.',
  'Use zero character tracking.',
  'Use rounded corners, never circular UI chrome.',
  'Keep one persistent authenticated shell.',
  'Do not paint a route-wide dark overlay.',
  'Use the shared hero authority.',
  'Use the shared control authority.',
  'Reuse before creating.',
  'Respect reduced motion.',
  'Design mobile first.',
  'Use the router for authenticated navigation.'
];
for(const rule of ciRules)assert(registry.includes(rule),`ci-rule:${rule}`,'Current UI Library registry must still expose the audited rule.');

assert(/today:Object\.freeze\(\{path:'\/',title:'Today \| Sindhorn Midtown Internal',kind:'local',module:'\.\/business-dashboard\.js\?v=4'/.test(routeRegistry),'router','Today is a local authenticated route in the shared shell with the v4 motion cache lineage.');
assert(dashboardJs.includes('app-route-hero')&&dashboardJs.includes('app-route-eyebrow')&&dashboardJs.includes('app-route-title')&&dashboardJs.includes('app-route-copy'),'shared-hero','Dashboard consumes the semantic route-hero API.');
assert(dashboardJs.includes('app-quiet-action'),'shared-control','Retry uses the centralized quiet-action control.');
assert(dashboardJs.includes('factsheet-room-card')&&dashboardJs.includes('factsheet-room-card-button')&&dashboardJs.includes('factsheet-room-panel'),'shared-disclosure','Expandable dashboard data reuses the CI-listed Factsheet disclosure component.');
assert(dashboardJs.includes('aria-expanded="${String(open)}"')&&dashboardJs.includes('data-bd-disclosure-button')&&dashboardJs.includes('openDisclosureKeys'),'disclosure-a11y','Disclosure buttons expose explicit expanded state and preserve it across shell remounts.');
assert(!dashboardJs.includes('<details'),'no-parallel-disclosure','Dashboard does not introduce a second native-details disclosure language.');
assert(dashboardCss.includes('font:400 14px/1.55 var(--font-ui)'),'font-authority','Dashboard inherits the app LINE Seed Sans TH font token.');
assert(dashboardCss.includes('letter-spacing:0!important'),'tracking','Dashboard enforces zero character tracking.');
assert(!/border-radius\s*:\s*(?:50%|999px|9999px)/i.test(dashboardCss+motionCss),'shape-language','Dashboard adds no circular or capsule UI chrome.');
assert(dashboardCss.includes('content:none!important')&&dashboardCss.includes('background:none!important'),'atmosphere','Dashboard paints no route-wide veil over the persistent WebGL atmosphere.');
assert(dashboardCss.includes('--bd-glass:rgba(46,39,59,.48)')&&dashboardCss.includes('var(--app-control-border')&&dashboardCss.includes('var(--route-hero-accent')&&dashboardCss.includes('var(--app-control-motion-base'),'semantic-tokens','Information surfaces match the CI material while border, accent and motion remain tied to central UI authorities.');
assert(dashboardCss.includes('--fs-disclosure:420ms'),'disclosure-motion','Dashboard shared disclosures keep the established 420ms rhythm.');
assert(ciSpecimenFixes.includes('--fs-ease:cubic-bezier(.22,1,.36,1)')&&ciSpecimenFixes.includes('--fs-disclosure:420ms')&&ciSpecimenFixes.includes('--fs-border:var(--ci-border)'),'ci-specimen-token-bridge','The UI Library host supplies canonical Factsheet tokens so its living disclosure specimen renders the real production interaction.');
assert(/@media\(prefers-reduced-motion:reduce\)/.test(dashboardCss)&&/@media\(prefers-reduced-motion:reduce\)/.test(motionCss),'reduced-motion','Base dashboard and motion layer both suppress non-essential motion when reduced motion is requested.');
assert(/@media\(min-width:700px\)/.test(dashboardCss)&&/@media\(max-width:359px\)/.test(dashboardCss),'responsive-contract','Dashboard includes explicit compact and wide responsive behavior for the 360/390/768 validation matrix.');
assert(dashboardJs.includes('applyBusinessDashboardMotion')&&dashboardJs.includes('data-bd-motion-key'),'semantic-motion','Business motion is wired to actual business values rather than decorative looping effects.');
assert(motionJs.includes('sindhorn-business-dashboard-motion-v2')&&motionJs.includes('publicationChanged')&&motionJs.includes('data-bd-flag-key'),'motion-state','Motion compares approved publication snapshots and only promotes newly appearing exception states.');
assert(motionCss.includes('bdGroupReveal')&&motionCss.includes('bdFreshSweep'),'motion-language','Grouped reveal and one-time freshness confirmation are present.');
assert(!motionCss.includes('.bd-variance-track{')&&!motionCss.includes('.bd-outlook-track{')&&!motionCss.includes('.bd-outlook-marker{'),'no-progress-tracks','Progress-style KPI and forward-outlook tracks are intentionally not rendered.');
assert(!/animation\s*:[^;]*(infinite|linear\s+infinite)/i.test(motionCss),'no-looping-motion','Dashboard motion contains no perpetual animation loop.');

console.log(JSON.stringify({ok:true,source:'site/ui-system-registry.js',checks},null,2));
