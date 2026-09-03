/* Centralization ratchet.

   The app does not satisfy the target architecture yet - 715 !important, 36
   stylesheets, 11 card implementations - so these cannot be absolute rules or
   the build would fail on day one. They are a ratchet instead: the committed
   baseline records today's numbers, and a change may improve any metric or
   leave it alone, never worsen it.

   This exists because the previous from-scratch rebuild lost a race it could
   not win: the live app gained roughly 200 commits in five days while the
   rebuild stood still. Freezing duplication is what makes migration finish.

   When a phase lands an improvement, run with --update to lower the baseline.
   The baseline may only move down; the script refuses to raise it.
*/
import fs from 'node:fs';
import path from 'node:path';

const SITE=path.resolve('site');
const BASELINE=path.resolve('ui-centralization-budget.json');
const CANONICAL_MATERIAL='app-glass.css';
const PATCH_PATTERN=/-(refinements|fixes|polish|standard|stability)\.css$/;
/* Foundation stylesheets are shared infrastructure and are expected to GROW as
   route CSS is absorbed into them. Counting all stylesheets together would make
   the ratchet block the very files that let route CSS be deleted. */
const FOUNDATION=new Set(['app-tokens.css','app-glass.css','app-controls.css','app-shapes.css','app-components.css','ci-library.css','app-transitions.css','fonts.css','shell.css']);

const read=f=>fs.readFileSync(path.join(SITE,f),'utf8');
const cssFiles=fs.readdirSync(SITE).filter(f=>f.endsWith('.css')).sort();
const htmlFiles=fs.readdirSync(SITE).filter(f=>f.endsWith('.html')).sort();
const allCss=cssFiles.map(read).join(' ');

const rulesWith=(text,prop)=>[...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[2].includes(prop)).length;
// Counts distinct HARD-CODED values, ignoring var() references. A token
// reference is compliance with the scale, not a new value: counting it as one
// made migrating a literal to a token score as a regression, which is exactly
// backwards. What this must measure is how many off-scale values remain.
const distinct=prop=>new Set([...allCss.matchAll(new RegExp(prop+'\\s*:\\s*([^;}]+)','g'))]
  .map(m=>m[1].trim().replace('!important','').trim())
  .filter(value=>!value.includes('var(--'))).size;
// Counts distinct component names that actually IMPLEMENT the appearance -
// a rule declaring fill, edge or backdrop - not every class whose name happens
// to end in the suffix. Once a route hands its material to .app-card and keeps
// only padding/radius, its class stops being an implementation and stops
// counting, which is the whole point of the migration. A newly painted card
// still counts, so this stays strictly harder to regress past, not easier.
const implementations=suffix=>{
  const names=new Set();
  for(const m of allCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(!/(?:^|;|\s)(?:background|background-color|border|border-color|backdrop-filter)\s*:/.test(m[2]))continue;
    for(const cls of m[1].match(new RegExp('\\.[a-z]+-'+suffix+'\\b','g'))||[])names.add(cls);
  }
  return names.size;
};

const measured={
  foundationCssFiles: cssFiles.filter(f=>FOUNDATION.has(f)).length,
  routeCssFiles: cssFiles.filter(f=>!FOUNDATION.has(f)).length,
  important: cssFiles.reduce((n,f)=>n+(read(f).match(/!important/g)||[]).length,0),
  backdropOutsideCanonical: cssFiles.filter(f=>f!==CANONICAL_MATERIAL).reduce((n,f)=>n+rulesWith(read(f),'backdrop-filter'),0),
  patchLayerFiles: cssFiles.filter(f=>PATCH_PATTERN.test(f)).length,
  inlineStyleBlocks: htmlFiles.reduce((n,f)=>n+(read(f).match(/<style/g)||[]).length,0),
  inlineStyleAttrs: htmlFiles.reduce((n,f)=>n+(read(f).match(/style="/g)||[]).length,0),
  distinctFontSizes: distinct('font-size'),
  distinctRadii: distinct('border-radius'),
  cardImplementations: implementations('card'),
  heroImplementations: implementations('hero')
};

if(!fs.existsSync(BASELINE)){
  fs.writeFileSync(BASELINE,JSON.stringify({note:'Centralization ratchet. Values may only decrease. See scripts/ui-centralization-budget.mjs',metrics:measured},null,2)+'\n');
  console.log('Baseline created.');
  console.log(JSON.stringify(measured,null,2));
  process.exit(0);
}

const baseline=JSON.parse(fs.readFileSync(BASELINE,'utf8')).metrics;
const GROWABLE=new Set(['foundationCssFiles']);
const rows=Object.keys(measured).map(key=>({key,was:baseline[key],now:measured[key],delta:measured[key]-(baseline[key]??measured[key])}));
const worse=rows.filter(r=>r.delta>0&&!GROWABLE.has(r.key));
const better=rows.filter(r=>r.delta<0);

const pad=(s,n)=>String(s).padEnd(n);
console.log(`${pad('METRIC',28)}${pad('BASELINE',10)}${pad('NOW',8)}CHANGE`);
for(const r of rows){
  const mark=r.delta>0?(GROWABLE.has(r.key)?'  (allowed to grow)':'  WORSE'):r.delta<0?'  better':'';
  console.log(`${pad(r.key,28)}${pad(r.was,10)}${pad(r.now,8)}${r.delta>0?'+':''}${r.delta}${mark}`);
}

/* A brand new patch-layer stylesheet is refused outright, not ratcheted:
   the eight that exist are grandfathered until their consumers migrate. */
const knownPatches=new Set(JSON.parse(fs.readFileSync(BASELINE,'utf8')).patchLayerFiles||[]);
const currentPatches=cssFiles.filter(f=>PATCH_PATTERN.test(f));
const newPatches=knownPatches.size?currentPatches.filter(f=>!knownPatches.has(f)):[];

if(process.argv.includes('--update')){
  if(worse.length){console.error('\nRefusing to raise the baseline. Fix the regressions first.');process.exit(1)}
  const doc=JSON.parse(fs.readFileSync(BASELINE,'utf8'));
  doc.metrics=measured; doc.patchLayerFiles=currentPatches;
  fs.writeFileSync(BASELINE,JSON.stringify(doc,null,2)+'\n');
  console.log(`\nBaseline lowered (${better.length} metric(s) improved).`);
  process.exit(0);
}

if(newPatches.length){
  console.error(`\nNew patch-layer stylesheet(s): ${newPatches.join(', ')}`);
  console.error('Fold the rules into the component that owns them instead.');
  process.exit(1);
}
if(worse.length){
  console.error(`\n${worse.length} metric(s) regressed: ${worse.map(r=>`${r.key} +${r.delta}`).join(', ')}`);
  console.error('Centralization is a ratchet - these may only fall. Fix the change, or justify and lower the baseline with --update.');
  process.exit(1);
}
console.log(`\nOK. ${better.length} improved, ${rows.length-better.length} unchanged, 0 regressed.`);
