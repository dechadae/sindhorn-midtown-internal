import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const refinements=await readFile('site/fnb-refinements.css','utf8');
const base=await readFile('site/fnb.css','utf8');
const stability=await readFile('site/fnb-layout-stability.css','utf8');
const shareUi=await readFile('site/fnb-share-ui.js','utf8');
const sync=await readFile('site/fnb-artwork-sync.js','utf8');
const fnb=await readFile('site/fnb.js','utf8');
const adapter=await readFile('site/fnb-data.js','utf8');
const manifest=JSON.parse(await readFile('site/manifest.webmanifest','utf8'));

assert.match(base,/rgba\(24,20,32,\.72\)/,'fixture: previous dark overlay missing from base CSS');
assert.match(refinements,/\.fnb-route::before\{content:none!important;background:none!important\}/,'heavy F&B route dimmer must be disabled');
assert.match(refinements,/text-transform:none!important/,'action controls must preserve sentence/title case');
assert.match(shareUi,/const SHARE_LABEL='Share'/,'Share label must be sentence case');
assert.match(shareUi,/hero\.appendChild\(button\('page'\)\)/,'page Share must attach directly to the hero overlay host');
assert.match(shareUi,/head\.appendChild\(button\('promotion',item\.id\)\)/,'detail Share must attach directly to the detail-head overlay host');
assert.match(stability,/\.fnb-hero>\.fnb-share-button/,'page Share must use the live reserved overlay selector');
assert.match(stability,/\.fnb-detail-head>\.fnb-share-button/,'detail Share must use the live reserved overlay selector');
assert.match(stability,/position:absolute!important/,'async Share controls must stay out of document flow');
assert.match(stability,/\.fnb-card-button\{padding-bottom:62px!important\}/,'authenticated cards must reserve the action row');
assert.match(shareUi,/fnb-card-actions/,'authenticated card actions must use the reserved action row');
assert.match(shareUi,/folderControl\(item\)/,'authenticated cards must expose artwork folders when available');
assert.match(shareUi,/initFnbArtworkSync/,'F&B UI must initialize shared artwork completion state');
assert.match(sync,/sindhorn_fnb_artwork_status_read/,'shared artwork sync must read authoritative status');
assert.match(sync,/sindhorn_fnb_artwork_status_write/,'authenticated editor must persist authoritative status');
assert.match(sync,/new MutationObserver/,'detail artwork sync must observe dynamically rendered detail DOM');
assert.match(sync,/if\(total===0\)\{card\.hidden=true/,'zero-artwork outlet groups must be hidden');
assert.match(sync,/\.fnb-art-card:not\(:has\(\.fnb-task\)\)\{display:none!important\}/,'zero-artwork groups need a render-safe hide guard');
assert.match(fnb,/taskId=button\.dataset\.task,next=!row\?\.classList\.contains\('is-done'\)/,'checkbox toggles must derive the next value from the rendered shared state');
assert.doesNotMatch(fnb,/state\.checks\[button\.dataset\.task\]=!state\.checks\[button\.dataset\.task\];save\(\);const id=current\?\.id;renderIndex\(\);if\(id\)openDetail/,'checkbox toggles must not rebuild the detail DOM');
assert.match(adapter,/Canonical business content lives in Supabase/,'F&B adapter must state Supabase authority');
assert.match(adapter,/sindhorn_fnb_read_model/,'authenticated F&B runtime must use the protected read model');
assert.match(adapter,/sindhorn_fnb_public_read_model/,'adapter must have explicit public fallback read model');
assert.match(adapter,/sindhorn-midtown:fnb-dataset:v2/,'adapter must keep last-known-good F&B data');
assert.match(adapter,/In-room Dining/,'valid workbook outlet must be supported');
assert.match(adapter,/Offline · showing last saved F&B data/,'offline cache must be visible as stale data');
for(const label of ['>Show full<',"?'Show full':'Show less'",'>Add / change artwork link<','>Save<'])assert(fnb.includes(label),`expected sentence-case action missing: ${label}`);
for(const bad of ['>SHOW FULL<','>SHOW LESS<','>ADD / CHANGE ARTWORK LINK<','>SAVE<'])assert(!fnb.includes(bad),`forced uppercase action regressed: ${bad}`);
assert.match(refinements,/inset:0!important/,'modal scrim must cover the viewport');
assert.match(refinements,/place-items:center!important/,'modal must be centered');
assert.match(refinements,/height:100dvh!important/,'modal scrim must use full usable viewport');
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');

const temp=await mkdtemp(join(tmpdir(),'fnb-share-'));
const run=spawnSync(process.execPath,['scripts/generate-fnb-share.mjs',temp],{encoding:'utf8',env:{...process.env,PUBLIC_ORIGIN:'https://preview.example.test'}});
assert.equal(run.status,0,run.stderr||run.stdout);
const report=JSON.parse(run.stdout.trim().split('\n').at(-1));
assert.equal(report.promotions,18,'public snapshot must include all Sep–Dec promotions');
assert.equal(report.activations,21,'public snapshot must reflect normalized activation rows');
assert.equal(report.artworks,61,'public snapshot must preserve artwork requirements');
assert.equal(report.artworkLinks,4,'public snapshot must include workbook artwork links');
assert.ok(Number.isInteger(report.presentationPack)&&report.presentationPack>0,'generator must bind to the enabled presentation pack');

const publicRuntime=await readFile(join(temp,'fnb-runtime.js'),'utf8');
const publicData=await readFile(join(temp,'fnb-public-data.js'),'utf8');
const publicShell=await readFile(join(temp,'fnb-public-shell.js'),'utf8');
const publicShareUi=await readFile(join(temp,'fnb-share-ui-public.js'),'utf8');
const publicCss=await readFile(join(temp,'fnb-public.css'),'utf8');
const livePackCss=await readFile(join(temp,'fnb-live-pack.css'),'utf8');

/* The public renderer is the live renderer, not a second card implementation. */
assert.match(publicRuntime,/const TEMPLATE=`/,'public share must reuse authenticated F&B route runtime');
assert.match(publicRuntime,/fnb-card-button/,'authenticated card renderer must be preserved');
assert.match(publicRuntime,/fnb-detail-title/,'authenticated detail renderer must be preserved');
assert.match(publicRuntime,/fnb-section-rail/,'authenticated detail renderer remains the source');
assert.match(publicRuntime,/import \{FNB_PROMOTIONS as DATA\} from '.\/fnb-public-data\.js'/,'public runtime must use public data');
assert.doesNotMatch(publicRuntime,/sindhorn-midtown:fnb-local/,'public runtime must not read private device state');
assert.doesNotMatch(publicRuntime,/localStorage\.getItem/,'public runtime must not hydrate device-only F&B state');
assert.match(publicRuntime,/const editor=false/,'public runtime must never grant edit capability');

/* Header geometry comes from the enabled pack copied byte-for-byte at generation time. */
assert.match(livePackCss,/\.masthead-inner,#route-view\{/,'generated share must contain enabled-pack shell geometry');
assert.match(livePackCss,/\.brand-lockup\{/,'generated share must contain enabled-pack brand geometry');
assert.match(livePackCss,/--font-ui:\\?"LINE Seed Sans TH/,'generated share must carry the live font authority');
assert.match(livePackCss,/-webkit-tap-highlight-color:transparent/,'public share must inherit the live tap-highlight suppression');

/* Public CSS is only a read-only subtraction layer. */
assert.match(publicCss,/#app-footer[^}]*display:none!important/,'public app footer must be hidden');
assert.match(publicCss,/\.masthead-user[^}]*\.masthead-tools\{display:none!important\}/,'public employee/avatar tools must be hidden');
assert.doesNotMatch(publicCss,/\.fnb-card-actions[^}]*display:none!important/,'public promotion cards must keep the live Artwork folder + Share action row');
assert.doesNotMatch(publicCss,/\.fnb-card-button\{padding-bottom:16px!important\}/,'public cards must retain live action-row spacing');
assert.match(publicShareUi,/folderControl\(item\)/,'public compact cards must expose artwork-folder access when available');
assert.match(publicShareUi,/actions\.appendChild\(button\('promotion',id\)\)/,'public compact cards must expose promotion Share');
assert.match(publicCss,/\.fnb-section-rail\{display:none!important/,'public detail section rail must be hidden');
assert.match(publicCss,/-webkit-appearance:none;appearance:none/,'public controls must remove native browser control chrome');
assert.doesNotMatch(publicCss,/\.fnb-task-toggle\{display:none!important\}/,'public artwork status checkboxes must remain visible');
assert.match(publicCss,/\.fnb-task-toggle\{display:grid!important;[^}]*pointer-events:none!important\}/,'public artwork status checkboxes must be visible but non-interactive');
assert.match(publicCss,/\.fnb-task-toggle::before\{content:"☐"!important\}/,'public pending artwork must use a gray empty checkbox');
assert.match(publicCss,/\.fnb-task\.is-done \.fnb-task-toggle::before\{content:"☑"!important\}/,'public completed artwork must use a gray checked checkbox');
assert.match(publicRuntime,/\$\{editor\?'':'disabled'\}/,'public renderer must keep artwork checkboxes disabled');
assert.match(publicCss,/\[data-folder-edit\]/,'public artwork editor UI must be hidden');
assert.match(publicCss,/\.fnb-data-updated\{/,'public freshness timestamp must keep restrained treatment');
assert.doesNotMatch(publicCss,/\[data-folder-open\][^}]*display:none/,'public artwork folder open action must remain visible');
assert.doesNotMatch(publicCss,/\.fnb-sheet-layer[^}]*display:none/,'public multi-folder modal must remain available');
assert.doesNotMatch(publicCss,/\.masthead-inner\{min-height:/,'public layer must not maintain a second masthead geometry');
assert.doesNotMatch(publicCss,/\.brand-lockup\{position:/,'public layer must not maintain a second logo geometry');

assert.match(publicShareUi,/\.\/fnb-public-data\.js/,'public Share UI must use public data');
assert.match(publicShareUi,/\/fnb-artwork-sync\.js/,'public Share UI must consume shared completion state');
assert.match(publicData,/sindhorn_fnb_public_read_model/,'public data must refresh from Supabase at runtime');
assert.match(publicData,/FNB_DATA_UPDATED_AT/,'public data must expose Supabase content freshness');
assert.match(publicData,/sharepoint\.com/i,'public data snapshot must include IHG-gated artwork folder links');
assert.match(publicData,/artworkUrl/,'public data must retain permitted artwork-folder URLs');
assert.match(publicShell,/FNB_DATA_UPDATED_AT/,'public shell must consume content freshness');
assert.match(publicShell,/data-fnb-data-updated/,'public shell must render the freshness timestamp under the period');
assert.match(publicShell,/fnbPublicUpdated/,'public detail must expose a dated-and-timed Updated fact');
for(const token of ['employee_number','auth-client','login.html','service_role'])assert(!publicData.toLowerCase().includes(token.toLowerCase()),`public data leaked forbidden token ${token}`);

const pages=[['fnb.html','F&amp;B Promotions | Sindhorn Midtown'],['fnb/fried-chicken-waffles.html','Fried Chicken &amp; Waffles | Sindhorn Midtown'],['fnb/sunset-cocktails.html','Sunset Cocktails | Sindhorn Midtown']];
for(const [path,title] of pages){
  const html=await readFile(join(temp,path),'utf8');
  assert.match(html,new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</title>`),`${path}: title missing`);
  assert.match(html,/<meta property="og:title"/,`${path}: og:title missing`);
  assert.match(html,/<meta property="og:url"/,`${path}: og:url missing`);
  assert.match(html,/https:\/\/preview\.example\.test\/share\/fnb/,`${path}: canonical preview origin missing`);
  assert.match(html,/id="environmentStage"/,`${path}: must reuse production atmosphere layer`);
  assert.match(html,/id="app-header"/,`${path}: must use live header host`);
  assert.match(html,/class="masthead"/,`${path}: must use live masthead structure`);
  assert.match(html,/class="brand-lockup"/,`${path}: must use live brand lockup structure`);
  assert.doesNotMatch(html,/masthead-tools/,`${path}: public masthead must omit employee/private tools`);
  assert.match(html,/\/shell\.css\?v=3/,`${path}: public shell must load authenticated shell base`);
  assert.match(html,/\/fnb-approved-polish\.css\?v=2/,`${path}: approved live F&B polish missing`);
  assert.match(html,/\/fnb-refinements\.css\?v=1/,`${path}: live F&B refinements missing`);
  assert.match(html,/\/fnb-layout-stability\.css\?v=1/,`${path}: live async layout stability missing`);
  assert.match(html,/\/share\/fnb-live-pack\.css\?v=\d+/,`${path}: live presentation pack CSS missing`);
  assert.match(html,/\/share\/fnb-public\.css\?v=9/,`${path}: public subtraction layer missing`);
  assert.match(html,/\/share\/fnb-public-shell\.js\?v=9/,`${path}: current public shell missing`);
  assert.doesNotMatch(html,/href="\/fnb\.css/,'public HTML must let the cloned runtime load fnb.css in the same order as authenticated F&B');
  for(const token of ['og:image','twitter:image','employee_number','Add / change artwork link','auth-client','login.html','id="app-footer"'])assert(!html.toLowerCase().includes(token.toLowerCase()),`${path}: forbidden public token ${token}`)
}
await rm(temp,{recursive:true,force:true});
console.log('F&B live-renderer/public-share parity regression passed');
