import fs from 'node:fs/promises';

const [registry,routeRegistry,dashboardJs,dashboardCss]=await Promise.all([
  fs.readFile('site/ui-system-registry.js','utf8'),
  fs.readFile('site/route-registry.js','utf8'),
  fs.readFile('site/business-dashboard.js','utf8'),
  fs.readFile('site/business-dashboard.css','utf8')
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

assert(/today:Object\.freeze\(\{path:'\/',title:'Today \| Sindhorn Midtown Internal',kind:'local',module:'\.\/business-dashboard\.js\?v=2'/.test(routeRegistry),'router','Today is a local authenticated route in the shared shell.');
assert(dashboardJs.includes('app-route-hero')&&dashboardJs.includes('app-route-eyebrow')&&dashboardJs.includes('app-route-title')&&dashboardJs.includes('app-route-copy'),'shared-hero','Dashboard consumes the semantic route-hero API.');
assert(dashboardJs.includes('app-quiet-action'),'shared-control','Retry uses the centralized quiet-action control.');
assert(dashboardJs.includes('factsheet-room-card')&&dashboardJs.includes('factsheet-room-card-button')&&dashboardJs.includes('factsheet-room-panel'),'shared-disclosure','Expandable dashboard data reuses the CI-listed Factsheet disclosure component.');
assert(dashboardJs.includes('aria-expanded="false"')&&dashboardJs.includes('data-bd-disclosure-button'),'disclosure-a11y','Disclosure buttons expose explicit expanded state.');
assert(!dashboardJs.includes('<details'),'no-parallel-disclosure','Dashboard does not introduce a second native-details disclosure language.');
assert(dashboardCss.includes('font:400 14px/1.55 var(--font-ui)'),'font-authority','Dashboard inherits the app LINE Seed Sans TH font token.');
assert(dashboardCss.includes('letter-spacing:0!important'),'tracking','Dashboard enforces zero character tracking.');
assert(!/border-radius\s*:\s*(?:50%|999px|9999px)/i.test(dashboardCss),'shape-language','Dashboard adds no circular or capsule UI chrome.');
assert(dashboardCss.includes('content:none!important')&&dashboardCss.includes('background:none!important'),'atmosphere','Dashboard paints no route-wide veil over the persistent WebGL atmosphere.');
assert(dashboardCss.includes('var(--app-control-glass')&&dashboardCss.includes('var(--app-control-border')&&dashboardCss.includes('var(--route-hero-accent'),'semantic-tokens','Glass, border and accent values alias central UI tokens.');
assert(dashboardCss.includes('--fs-disclosure:420ms'),'disclosure-motion','Shared disclosure keeps the established 420ms rhythm.');
assert(/@media\(prefers-reduced-motion:reduce\)/.test(dashboardCss),'reduced-motion','Dashboard suppresses transitions when reduced motion is requested.');
assert(/@media\(min-width:700px\)/.test(dashboardCss)&&/@media\(max-width:359px\)/.test(dashboardCss),'responsive-contract','Dashboard includes explicit compact and wide responsive behavior for the 360/390/768 validation matrix.');

console.log(JSON.stringify({ok:true,source:'site/ui-system-registry.js',checks},null,2));
