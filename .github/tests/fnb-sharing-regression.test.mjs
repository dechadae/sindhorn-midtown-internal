import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const css=await readFile('site/fnb-refinements.css','utf8');
const base=await readFile('site/fnb.css','utf8');
const ui=await readFile('site/fnb-share-ui.js','utf8');
const fnb=await readFile('site/fnb.js','utf8');
const manifest=JSON.parse(await readFile('site/manifest.webmanifest','utf8'));
assert.match(base,/rgba\(24,20,32,\.72\)/,'fixture: previous dark overlay missing from base CSS');
assert.match(css,/\.fnb-route::before\{content:none!important;background:none!important\}/,'heavy F&B route dimmer must be disabled');
assert.match(css,/text-transform:none!important/,'action controls must preserve sentence/title case');
assert.match(ui,/const SHARE_LABEL='Share'/,'Share label must be sentence case');
assert.match(ui,/fnb-hero-utility/,'page Share belongs in the hero utility row');
assert.match(ui,/fnb-detail-utility/,'detail Share belongs beside the back action');
for(const label of ['>Show full<',"?'Show full':'Show less'",'>Add / change artwork link<','>Save<'])assert(fnb.includes(label),`expected sentence-case action missing: ${label}`);
for(const bad of ['>SHOW FULL<','>SHOW LESS<','>ADD / CHANGE ARTWORK LINK<','>SAVE<'])assert(!fnb.includes(bad),`forced uppercase action regressed: ${bad}`);
assert.match(css,/inset:0!important/,'modal scrim must cover the viewport');
assert.match(css,/place-items:center!important/,'modal must be centered');
assert.match(css,/height:100dvh!important/,'modal scrim must use full usable viewport');
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');

const temp=await mkdtemp(join(tmpdir(),'fnb-share-'));
const run=spawnSync(process.execPath,['scripts/generate-fnb-share.mjs',temp],{encoding:'utf8',env:{...process.env,PUBLIC_ORIGIN:'https://preview.example.test'}});
assert.equal(run.status,0,run.stderr||run.stdout);

const publicRuntime=await readFile(join(temp,'fnb-runtime.js'),'utf8');
const publicData=await readFile(join(temp,'fnb-public-data.js'),'utf8');
const publicShareUi=await readFile(join(temp,'fnb-share-ui-public.js'),'utf8');
const publicCss=await readFile(join(temp,'fnb-public.css'),'utf8');
assert.match(publicRuntime,/const TEMPLATE=`/,'public share must reuse authenticated F&B route runtime');
assert.match(publicRuntime,/fnb-card-button/,'authenticated card renderer must be preserved');
assert.match(publicRuntime,/fnb-detail-title/,'authenticated detail renderer must be preserved');
assert.match(publicRuntime,/fnb-section-rail/,'authenticated detail renderer remains source, even though public CSS hides its rail');
assert.match(publicRuntime,/import \{FNB_PROMOTIONS as DATA\} from '.\/fnb-public-data\.js'/,'public runtime must use allowlisted data');
assert.doesNotMatch(publicRuntime,/sindhorn-midtown:fnb-local/,'public runtime must not read private device state');
assert.doesNotMatch(publicRuntime,/localStorage\.getItem/,'public runtime must not hydrate device-only F&B state');
assert.match(publicRuntime,/const editor=false/,'public runtime must never grant edit capability');
assert.match(publicCss,/\.masthead-inner\{min-height:54px;padding-top:8px;padding-bottom:8px/,'public masthead must copy Pack 46 mobile geometry');
assert.match(publicCss,/\.brand-lockup\{position:relative;width:clamp\(108px,28vw,136px\)/,'public logo must copy Pack 46 lockup sizing');
assert.match(publicCss,/#app-header\{position:sticky;top:0;z-index:120;isolation:isolate\}/,'public header host must copy Pack 46 sticky behavior');
assert.match(publicCss,/\.fnb-section-rail\{display:none!important/,'public detail section rail must be hidden');
assert.match(publicCss,/-webkit-tap-highlight-color:transparent!important/,'public controls must suppress browser tap highlight');
assert.match(publicCss,/-webkit-appearance:none;appearance:none/,'public controls must remove native browser control chrome');
assert.match(publicCss,/\.fnb-task-toggle\{display:none!important\}/,'public artwork check controls must be hidden');
assert.match(publicCss,/\[data-folder-edit\]/,'public artwork editor UI must be hidden');
assert.match(publicShareUi,/\.\/fnb-public-data\.js/,'public Share UI must use allowlisted data');

for(const token of ['artworkUrl','sharepoint.com','1drv.ms','onedrive.live.com','employee_number','auth-client','login.html'])assert(!publicData.toLowerCase().includes(token.toLowerCase()),`public data leaked forbidden token ${token}`);

const pages=[['fnb.html','F&amp;B Promotions | Sindhorn Midtown'],['fnb/fried-chicken-waffles.html','Fried Chicken &amp; Waffles | Sindhorn Midtown'],['fnb/sunset-cocktails.html','Sunset Cocktails | Sindhorn Midtown']];
for(const [path,title] of pages){
  const html=await readFile(join(temp,path),'utf8');
  assert.match(html,new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</title>`),`${path}: title missing`);
  assert.match(html,/<meta property="og:title"/,`${path}: og:title missing`);
  assert.match(html,/<meta property="og:url"/,`${path}: og:url missing`);
  assert.match(html,/https:\/\/preview\.example\.test\/share\/fnb/,`${path}: canonical preview origin missing`);
  assert.match(html,/id="environmentStage"/,`${path}: must reuse production atmosphere layer`);
  assert.match(html,/id="app-header"/,`${path}: must use authenticated header host`);
  assert.match(html,/class="masthead"/,`${path}: must use authenticated masthead markup`);
  assert.match(html,/class="brand-lockup"/,`${path}: must use authenticated brand lockup markup`);
  assert.doesNotMatch(html,/masthead-tools/,`${path}: public masthead must omit employee/fullscreen tools`);
  assert.match(html,/fnb-public\.css\?v=4/,`${path}: public CSS must be cache-busted`);
  assert.match(html,/fnb-public-shell\.js\?v=4/,`${path}: public shell must be cache-busted`);
  for(const token of ['og:image','twitter:image','sharepoint.com','1drv.ms','onedrive.live.com','employee_number','Add / change artwork link','auth-client','login.html','id="app-footer"'])assert(!html.toLowerCase().includes(token.toLowerCase()),`${path}: forbidden public token ${token}`)
}
await rm(temp,{recursive:true,force:true});
console.log('F&B share/refinement regression passed');
