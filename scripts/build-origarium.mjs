#!/usr/bin/env node
/* Build the public evidence page for Test 02: /origarium (site/origarium.html).

   The page is docs/idui/origarium-body.html - library classes only, no CSS of
   its own - with every number read from the pinned runs in
   idui-core/evidence/origarium/, so the page cannot drift from what was
   measured. The screenshots are copied to site/assets/origarium/. The shell
   comes from public-doc-page.mjs, the same as /idui and /evidence.

     node scripts/build-origarium.mjs          rebuild the page and its images
     node scripts/build-origarium.mjs --check  fail if either is stale */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {docPage} from './public-doc-page.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const RUN=path.join(ROOT,'idui-core/evidence/origarium');
const SRC=path.join(ROOT,'docs/idui/origarium-body.html');
const OUT=path.join(SITE,'origarium.html');
const IMG_OUT=path.join(SITE,'assets/origarium');
const SHOTS=[
  ['shots/before-reader-390-top.png','before-reader-390-top.png'],
  ['shots/after-390-top.png','after-390-top.png'],
  ['shots/after-reader-390-top.png','after-reader-390-top.png'],
  ['candidate-a/reader-390.png','candidate-a-reader-390.png'],
];
const check=process.argv.includes('--check');

const read=p=>fs.readFileSync(p,'utf8');
const sw=read(path.join(SITE,'sw.js')).match(/const VERSION='([^']+)'/)?.[1];
if(!sw){console.error('sw.js: VERSION not found');process.exit(1)}
const swShort=sw.replace(/^sindhorn-midtown-internal-pwa-/,'');

const before=JSON.parse(read(path.join(RUN,'before.json')));
const scale=JSON.parse(read(path.join(RUN,'scale/scale.json')));
const hostile=JSON.parse(read(path.join(RUN,'scale/hostile.json')));
const n=v=>Number(v).toLocaleString('en-US');
/* how many of a run's cards carried no failure at all */
const valid=(run,view,total)=>total-new Set(run.viewports[view].failures.map(f=>f.index)).size;

const b=before.rendered['390'], a=before.after.rendered['390'];
const values={
  sw:swShort,
  sourceMd5:before.source.md5.slice(0,8),
  runDate:new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'long',day:'numeric'}).format(new Date(before.measuredAt)),
  tokens:'79',
  before:{
    pageCssBytes:n(before.markup.pageCss.bytes),pageCssRules:n(before.markup.pageCss.rules),
    styleBlocks:n(before.markup.styleBlocks),appearance:n(before.discretionary.total),
    blurRecipes:n(b.backdropFilters.length),nestedGlass:n(b.nestedGlass.length??b.nestedGlass),
    fontSizes:n(b.fontSizes.length),errors:n(b.errors.length),
  },
  after:{
    pageCssBytes:n(before.after.markup.pageCss.bytes),appearance:n(before.after.discretionary.total),
    scriptStyle:n(before.after.scriptStyle),
    blurRecipes:n(a.backdropFilters.length),nestedGlass:n(a.nestedGlass.length??a.nestedGlass),
    fontSizes:n(a.fontSizes.length),errors:n(a.errors.length),
  },
  scale:{
    origarium390:n(valid(scale.origarium,'390',100)),idui390:n(valid(scale.idui,'390',100)),
    origarium1240:n(valid(scale.origarium,'1240',100)),idui1240:n(valid(scale.idui,'1240',100)),
    origariumReader:n(scale.origarium.reader.opened),iduiReader:n(scale.idui.reader.opened),
  },
  hostile:{
    origariumBefore:n(valid(hostile.beforeRepair.origarium,'390',22)),iduiBefore:n(valid(hostile.beforeRepair.idui,'390',22)),
    origariumAfter:n(valid(hostile.afterRepair.origarium,'390',22)),iduiAfter:n(valid(hostile.afterRepair.idui,'390',22)),
    origariumOverflow:n(hostile.beforeRepair.origarium.viewports['390'].overflow),
    iduiOverflow:n(hostile.beforeRepair.idui.viewports['390'].overflow),
  },
};

const lookup=key=>key.split('.').reduce((o,k)=>o?.[k],values);
const missing=[];
const body=read(SRC).replace(/\{\{([\w.]+)\}\}/g,(_m,key)=>{const v=lookup(key);if(v===undefined){missing.push(key);return _m}return String(v)});
if(missing.length){console.error('origarium-body.html: unknown placeholders '+[...new Set(missing)].join(', '));process.exit(1)}

const html=docPage({
  title:'Held With Nine Corrections | Sindhorn Midtown',
  description:'IDUI Test 02: an editorial archive and long-form reader rebuilt on the core. Structural conformance complete, editorial parity partial at seventy per cent, with both scale runs and the rejected candidate kept.',
  slug:'origarium',
  body:body.trim(),
  comment:`  IDUI Test 02 - Origarium Papers, built by scripts/build-origarium.mjs from\n  docs/idui/origarium-body.html and the pinned runs, with ${sw}. Library classes only.`,
});

const stale=[];
for(const [from,to] of SHOTS){
  const src=fs.readFileSync(path.join(RUN,from));const dest=path.join(IMG_OUT,to);
  if(check){if(!fs.existsSync(dest)||!src.equals(fs.readFileSync(dest)))stale.push(`site/assets/origarium/${to}`)}
  else{fs.mkdirSync(IMG_OUT,{recursive:true});fs.writeFileSync(dest,src)}
}
if(check){
  if((fs.existsSync(OUT)?read(OUT):'')!==html)stale.push('site/origarium.html');
  if(stale.length){console.error(`${stale.join(', ')} stale for ${sw}: run node scripts/build-origarium.mjs and commit`);process.exit(1)}
  console.log(JSON.stringify({ok:true,mode:'check',sw,bytes:html.length}));
}else{
  fs.writeFileSync(OUT,html);
  console.log(JSON.stringify({ok:true,sw:swShort,bytes:html.length,out:path.relative(ROOT,OUT),images:SHOTS.length}));
}
