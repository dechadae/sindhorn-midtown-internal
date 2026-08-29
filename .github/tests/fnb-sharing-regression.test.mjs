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
for(const label of ['>Show full<',"?'Show full':'Show less'",'>Add / change artwork link<','>Save<'])assert(fnb.includes(label),`expected sentence-case action missing: ${label}`);
for(const bad of ['>SHOW FULL<','>SHOW LESS<','>ADD / CHANGE ARTWORK LINK<','>SAVE<'])assert(!fnb.includes(bad),`forced uppercase action regressed: ${bad}`);
assert.match(css,/inset:0!important/,'modal scrim must cover the viewport');
assert.match(css,/place-items:center!important/,'modal must be centered');
assert.match(css,/height:100dvh!important/,'modal scrim must use full usable viewport');
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
const temp=await mkdtemp(join(tmpdir(),'fnb-share-'));
const run=spawnSync(process.execPath,['scripts/generate-fnb-share.mjs',temp],{encoding:'utf8',env:{...process.env,PUBLIC_ORIGIN:'https://preview.example.test'}});
assert.equal(run.status,0,run.stderr||run.stdout);
const files=['index.html','fried-chicken-waffles/index.html','sunset-cocktails/index.html'];
const forbidden=['og:image','twitter:image','artworkUrl','sharepoint.com','1drv.ms','onedrive.live.com','employee_number','sindhorn-midtown:fnb-local','Add / change artwork link','auth-client','login.html'];
for(const path of files){
  const html=await readFile(join(temp,path),'utf8');
  assert.match(html,/<title>[^<]+<\/title>/,`${path}: title missing`);
  assert.match(html,/<meta property="og:title"/,`${path}: og:title missing`);
  assert.match(html,/<meta property="og:url"/,`${path}: og:url missing`);
  assert.match(html,/https:\/\/preview\.example\.test\/share\/fnb/,`${path}: canonical preview origin missing`);
  for(const token of forbidden)assert(!html.toLowerCase().includes(token.toLowerCase()),`${path}: forbidden public token ${token}`)
}
const fried=await readFile(join(temp,'fried-chicken-waffles/index.html'),'utf8');
assert.match(fried,/<title>Fried Chicken &amp; Waffles \| Sindhorn Midtown<\/title>/);
assert.match(fried,/Sip &amp; Co\./);
assert.match(fried,/Promotion brief/);
await rm(temp,{recursive:true,force:true});
console.log('F&B share/refinement regression passed');
