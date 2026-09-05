#!/usr/bin/env node
/* Build the public evidence page: /evidence (site/evidence.html), r34.

   The page is docs/idui/evidence-body.html - library classes only, no CSS
   of its own - with every number read from the pinned rebuild run,
   idui-core/evidence/rebuild/comparison.json, so the page can never drift
   from the measurement it reports. The four first-screen captures are
   copied to site/assets/evidence/. The page shell (stylesheets, live sky
   atmosphere, the share pages' masthead) comes from public-doc-page.mjs,
   the same as /idui.

     node scripts/build-evidence.mjs          rebuild site/evidence.html and its images
     node scripts/build-evidence.mjs --check  fail if the committed page or images are stale */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {docPage} from './public-doc-page.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const RUN=path.join(ROOT,'idui-core/evidence/rebuild');
const SRC=path.join(ROOT,'docs/idui/evidence-body.html');
const OUT=path.join(SITE,'evidence.html');
const IMG_OUT=path.join(SITE,'assets/evidence');
const SHOTS=['before-390-top.png','after-390-top.png','before-1240-top.png','after-1240-top.png'];
const check=process.argv.includes('--check');

const read=p=>fs.readFileSync(p,'utf8');
const sw=read(path.join(SITE,'sw.js')).match(/const VERSION='([^']+)'/)?.[1];
if(!sw){console.error('sw.js: VERSION not found');process.exit(1)}
const swShort=sw.replace(/^sindhorn-midtown-internal-pwa-/,'');

const c=JSON.parse(read(path.join(RUN,'comparison.json')));
const n=v=>Number(v).toLocaleString('en-US');
const side=(x,r=x.render390.rendered)=>({
  pageCssBytes:n(x.markup.pageCss.bytes),pageCssRules:n(x.markup.pageCss.rules),styleBlocks:n(x.markup.styleBlocks),
  media:n(x.markup.pageCss.media),important:n(x.markup.pageCss.important),inline:n(x.markup.inlineStyleAttrs),
  literalFontSizes:n(x.markup.pageCss.literalFontSizes),literalRadii:n(x.markup.pageCss.literalRadii),backdropDecls:n(x.markup.pageCss.backdropFilters),
  markupBytes:n(x.markup.bytes),behaviorJs:n(x.behaviorJs),
  discretionary:n(x.discretionary.total),
  discretionaryBreakdown:Object.entries(x.discretionary.byProperty||{}).slice(0,8).map(([k,v])=>`${v} ${k}`).join(', ')+(Object.keys(x.discretionary.byProperty||{}).length>8?'…':''),
  semantic:n(x.semantic.total),semanticClasses:n(x.semantic.classes),semanticAttrs:n(x.semantic.dataAttributeNames),
  fontSizes:n(r.fontSizes.length),fontSizes1240:n(x.render1240.rendered.fontSizes.length),fontWeights:n(r.fontWeights.length),
  letterSpacings:n(r.letterSpacings.length),radii:n(r.radii.length),
  blurRecipes:n(r.backdropFilters.length),blurList:r.backdropFilters.map(v=>`<code>${v}</code>`).join(', '),
  backdropCount:n(r.backdropCount),nestedGlass:n(r.nestedGlass),runtimeInline:n(r.runtimeInline.length),sheets:n(r.sheets.length),
  docHeight:n(r.docHeight),docHeight1240:n(x.render1240.rendered.docHeight),errors:n(x.render390.errors.length)
});
const prop=Object.fromEntries(Object.entries(c.before.propagation).map(([k,v])=>[k.replace(/ (\w)/g,(_m,ch)=>ch.toUpperCase()),{page:n(v.page),header:n(v.header),total:n(v.total)}]));
const shared=c.after.sharedCss;
const totalBytes=shared.core.bytes+shared.constitution.bytes;
const clock=new Date(c.clock);
const bkk=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',hour12:false});
const values={
  sw,period:c.period,
  clock:`${bkk.format(clock)} +07:00`,
  runDate:new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'long',day:'numeric'}).format(clock),
  before:side(c.before),after:side(c.after),prop,
  sharedCoreBytes:n(shared.core.bytes),sharedCoreRules:n(shared.core.rules),
  constitutionBytes:n(shared.constitution.bytes),constitutionRules:n(shared.constitution.rules),
  sharedTotalBytes:n(totalBytes),sharedTotalRules:n(shared.core.rules+shared.constitution.rules),
  loadRatio:(totalBytes/c.before.markup.pageCss.bytes).toFixed(1)
};
const lookup=key=>key.split('.').reduce((o,k)=>o?.[k],values);
const missing=[];
const body=read(SRC).replace(/\{\{([\w.]+)\}\}/g,(_m,key)=>{const v=lookup(key);if(v===undefined){missing.push(key);return _m}return String(v)});
if(missing.length){console.error('evidence-body.html: unknown placeholders '+[...new Set(missing)].join(', '));process.exit(1)}

const html=docPage({
  title:'The Rebuild Test | Sindhorn Midtown',
  description:'IDUI evidence: one Flipgazine page rebuilt through its own constitution on the IDUI core, measured before and after in the same browser on the same clock. Wins, losses and nine core falsifications.',
  slug:'evidence',
  body:body.trim(),
  comment:`  The Rebuild Test - IDUI evidence, built by scripts/build-evidence.mjs from docs/idui/evidence-body.html\n  and idui-core/evidence/rebuild/comparison.json with ${sw}. Library classes only; the atmosphere is live.`
});

const stale=[];
for(const name of SHOTS){
  const src=fs.readFileSync(path.join(RUN,'shots',name));const dest=path.join(IMG_OUT,name);
  if(check){if(!fs.existsSync(dest)||!src.equals(fs.readFileSync(dest)))stale.push(`site/assets/evidence/${name}`)}
  else{fs.mkdirSync(IMG_OUT,{recursive:true});fs.writeFileSync(dest,src)}
}
if(check){
  if((fs.existsSync(OUT)?read(OUT):'')!==html)stale.push('site/evidence.html');
  if(stale.length){console.error(`${stale.join(', ')} stale for ${sw}: run node scripts/build-evidence.mjs and commit`);process.exit(1)}
  console.log(JSON.stringify({ok:true,mode:'check',sw,bytes:html.length}));
}else{
  fs.writeFileSync(OUT,html);
  console.log(JSON.stringify({ok:true,sw:swShort,bytes:html.length,out:path.relative(ROOT,OUT),images:SHOTS.length}));
}
