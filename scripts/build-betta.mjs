#!/usr/bin/env node
/* Build the public evidence page for the Betta test: /betta (site/betta.html).

   Published third as "03 Betta"; "IDUI Test 04" in its own record (PROTOCOL.md
   amendment A4). The page is docs/idui/betta-body.html - library classes only,
   no CSS of its own - with every number read from the pinned states named by
   idui-core/evidence/generative/published.json, so the page cannot drift from
   what was measured. Keep rates are recomputed from the raw judgement CSVs and
   the build refuses if the summary state disagrees with them; kappa is
   recomputed from the two blind rating files, which are pinned here by hash
   because they carry no state field for the manifest. The two figures are
   copied to site/assets/betta/. The shell comes from public-doc-page.mjs, the
   same as /idui, /evidence and /origarium.

     node scripts/build-betta.mjs          rebuild the page and its images
     node scripts/build-betta.mjs --check  fail if either is stale */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {docPage} from './public-doc-page.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const RUN=path.join(ROOT,'idui-core/evidence/generative');
const SRC=path.join(ROOT,'docs/idui/betta-body.html');
const OUT=path.join(SITE,'betta.html');
const IMG_OUT=path.join(SITE,'assets/betta');
const check=process.argv.includes('--check');

/* The commit that froze the claim (PROTOCOL.md A1); the page cites it, so the
   protocol must still say so. */
const CLAIM_COMMIT='93971ec';
/* Files the page reads that are not manifest states: frozen when written, so
   they are pinned here and the build refuses if one has moved. */
const PINNED={
  'blind-20260907/claude-ratings.json':'0cd6e2132d534eecedc275cf67028a3dc3cfec7b680ac19c7e143cc5a6fcf3b4',
  'blind-20260907/owner-ratings.json':'81f2c084e20372867ac33af61d37d50c6eaca779b98c3e9ecdc784b6d38a2776',
  'editorial-20260907.md':'4c6641f0306ce45d5b17ac2f43267d934634b334fae9edb871b143d9447013f3',
};

const read=p=>fs.readFileSync(p,'utf8');
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const fail=msg=>{console.error(`build-betta: ${msg}`);process.exit(1)};
const sw=read(path.join(SITE,'sw.js')).match(/const VERSION='([^']+)'/)?.[1];
if(!sw)fail('sw.js: VERSION not found');
const swShort=sw.replace(/^sindhorn-midtown-internal-pwa-/,'');

if(!read(path.join(RUN,'PROTOCOL.md')).includes(CLAIM_COMMIT))fail(`PROTOCOL.md no longer names ${CLAIM_COMMIT}`);
const pinned=rel=>{const buf=fs.readFileSync(path.join(RUN,rel));const got=sha256(buf);
  if(got!==PINNED[rel])fail(`${rel} has moved: sha256 ${got}, pinned ${PINNED[rel]}`);
  return buf.toString('utf8');};

/* published.json is a manifest, not a result: each experimental state is its
   own immutable file, hashed there, and scripts/evidence-append-only.mjs
   proves none has moved. */
const manifest=JSON.parse(read(path.join(RUN,'published.json')));
const state=name=>{const s=manifest.states.find(s=>s.state===name);
  if(!s)fail(`published.json declares no "${name}" state`);
  return JSON.parse(read(path.join(RUN,s.file)));};
const tierA=state('tier-a-20260908-metal-v5'),tierA1=state('tier-a-20260907-metal'),
  det=state('determinism-20260907'),variety=state('variety-20260908'),
  keep=state('keep-rate-20260908'),phone=state('phone-verdicts-20260908');

const n=v=>Number(v).toLocaleString('en-US');
const pct=(k,t)=>`${Math.round(k/t*100)}%`;
const pctN=(k,t)=>Math.round(k/t*100);
const same=(a,b,what)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail(`${what}: recomputed ${JSON.stringify(a)} but the state says ${JSON.stringify(b)}`)};

/* Keep rates are recomputed from the raw rows, each CSV checked against the
   hash the summary state recorded for it. */
const rows=entry=>{const buf=fs.readFileSync(path.join(RUN,entry.file));
  if(sha256(buf)!==entry.sha256)fail(`${entry.file} has moved from the hash keep-rate-20260908.json recorded`);
  const lines=buf.toString('utf8').trim().split('\n');
  if(lines[0]!=='arm,seed,composition,verdict')fail(`${entry.file}: unexpected header ${lines[0]}`);
  const out=lines.slice(1).map(l=>{const [arm,seed,composition,verdict]=l.split(',');return {arm,seed,composition,verdict}});
  if(out.length!==entry.rows)fail(`${entry.file}: ${out.length} rows, state says ${entry.rows}`);
  return out;};
const tally=(list,key)=>{const t={};for(const r of list){const k=r[key];t[k]??={n:0,keep:0,reject:0};t[k].n++;t[k][r.verdict]++}return t};
const [r1rows,r2rows]=keep.raw_files.map(rows);
const r1arm=tally(r1rows,'arm'),r1comp=tally(r1rows,'composition'),r2arm=tally(r2rows,'arm');
for(const k of Object.keys(keep.round1.by_arm))same(r1arm[k],keep.round1.by_arm[k],`round one arm ${k}`);
for(const k of Object.keys(keep.round1.by_composition))same(r1comp[k],keep.round1.by_composition[k],`round one composition ${k}`);
for(const k of Object.keys(keep.round2.by_arm))same(r2arm[k],keep.round2.by_arm[k],`round two arm ${k}`);
const r2lockedComp=tally(r2rows.filter(r=>r.composition!=='r'),'composition');
for(const k of Object.keys(keep.round2.by_composition_locked_arms))same(r2lockedComp[k],keep.round2.by_composition_locked_arms[k],`round two locked composition ${k}`);

const arm=t=>({n:n(t.n),keep:n(t.keep),rate:pct(t.keep,t.n)});
const pool=(...ts)=>ts.reduce((a,t)=>({n:a.n+t.n,keep:a.keep+t.keep}),{n:0,keep:0});
/* pooled C is round one C plus round two C-locked: same constitution, same
   eight crops (keep.pooled_note); C-random stays on its own */
const pooled={A:pool(r1arm.A,r2arm.A),B:pool(r1arm.B,r2arm.B),C:pool(r1arm.C,r2arm['C-locked'])};
const macTotal=r1rows.length+r2rows.length;
/* two-proportion z, descriptive only: neither comparison was pre-registered */
const z=(p,q)=>{const pp=(p.keep+q.keep)/(p.n+q.n);const se=Math.sqrt(pp*(1-pp)*(1/p.n+1/q.n));
  return ((p.keep/p.n-q.keep/q.n)/se).toFixed(1)};
const compIds=Object.keys(r1comp).sort((a,b)=>a-b);
const compRate=id=>r1comp[id].keep/r1comp[id].n;
const compMin=compIds.reduce((m,id)=>compRate(id)<compRate(m)?id:m),compMax=compIds.reduce((m,id)=>compRate(id)>compRate(m)?id:m);
const pooledRates=Object.values(pooled).map(t=>pctN(t.keep,t.n));

/* phone: rows by build, totals re-added and checked against the state */
const counted=phone.rows.filter(r=>r.counted),excluded=phone.rows.filter(r=>!r.counted);
const sum=(list,k)=>list.reduce((a,r)=>a+r[k],0);
same({n:sum(counted,'n'),keep:sum(counted,'keep'),reject:sum(counted,'reject')},phone.totals.counted,'phone counted totals');
same({n:sum(excluded,'n'),keep:sum(excluded,'keep'),reject:sum(excluded,'reject')},phone.totals.excluded,'phone excluded totals');
if(sum(phone.rows,'n')!==phone.totals.all_rows)fail('phone all_rows disagrees with its rows');
if(phone.rows.length!==5)fail(`phone-verdicts: ${phone.rows.length} rows, the page lays out five`);
const phoneRow=r=>({build:r.build,label:r.counted?r.build:`${r.build} · excluded`,n:n(r.n),keep:n(r.keep),rate:pct(r.keep,r.n)});
const phoneRate=pctN(phone.totals.counted.keep,phone.totals.counted.n);

/* blind: Claude's 1-5 ratings against the owner's rejections, recomputed */
const claude=JSON.parse(pinned('blind-20260907/claude-ratings.json')),owner=JSON.parse(pinned('blind-20260907/owner-ratings.json'));
const frames=Object.keys(claude.ratings);
if(frames.length!==owner.rejected.length+owner.accepted.length)fail('blind: the two raters cover different frames');
const kappa=cut=>{let aa=0,ar=0,ra=0,rr=0;
  for(const f of frames){const c=claude.ratings[f]>=cut,o=!owner.rejected.includes(f);
    if(c&&o)aa++;else if(c)ar++;else if(o)ra++;else rr++}
  const N=frames.length,po=(aa+rr)/N,pe=((aa+ar)/N)*((aa+ra)/N)+((ra+rr)/N)*((ar+rr)/N);
  return {aa,ar,ra,rr,N,po,pe,k:(po-pe)/(1-pe)}};
const k3=kappa(3),k4=kappa(4);

/* editorial: the first accepted result, at v4 */
const ed=pinned('editorial-20260907.md').match(/\*\*(\d+) of (\d+) accepted\./);
if(!ed)fail('editorial-20260907.md: "N of M accepted" not found');

const detSeeds=det.method.sample.match(/seeds 0\.\.(\d+)/),detParams=det.method.sample.match(/all (\d+) constitution-owned parameters/);
if(!detSeeds||!detParams)fail('determinism: method.sample no longer states seeds and parameters');
const varSeeds=variety.method.sample.match(/(\d+) seeds per arm/),varDims=variety.method.sample.match(/(\d+) numeric dimensions/);
if(!varSeeds||!varDims)fail('variety: method.sample no longer states seeds and dimensions');
const fig=verdict=>{const f=keep.figures.find(f=>f.verdict===verdict);if(!f)fail(`keep-rate figures: no ${verdict} frame`);return f};
const kept=fig('keep'),rejected=fig('reject');
const FIGURES=[kept,rejected].map(f=>[f.file,path.basename(f.file)]);

const values={
  sw:swShort,
  claim:{frozen:CLAIM_COMMIT},
  tierA:{seeds:n(tierA.run.seeds),violations:n(tierA.run.violations_total),collisions:n(tierA.run.seed_collisions),
    elapsed:tierA.run.elapsed_seconds,version:tierA.constitution.version,sha8:tierA.constitution.sha256.slice(0,8)},
  tierA1:{version:tierA1.constitution.version,violations:n(tierA1.run.violations_total),seeds:n(tierA1.run.seeds)},
  det:{values:n(det.result.values_compared),differing:n(det.result.differing_values),seeds:n(Number(detSeeds[1])+1),params:n(detParams[1])},
  variety:{aPct:pct(variety.arms.a.relative_to_a,1),bPct:pct(variety.arms.b.relative_to_a,1),cPct:pct(variety.arms.c.relative_to_a,1),
    seedsPerArm:n(varSeeds[1]),dims:n(varDims[1])},
  r1:{A:arm(r1arm.A),B:arm(r1arm.B),C:arm(r1arm.C)},
  r2:{A:arm(r2arm.A),B:arm(r2arm.B),Clocked:arm(r2arm['C-locked']),Crandom:arm(r2arm['C-random'])},
  pooled:{A:arm(pooled.A),B:arm(pooled.B),C:arm(pooled.C),total:n(macTotal),
    span:Math.max(...pooledRates)-Math.min(...pooledRates)},
  z:{bVsC:z(pooled.B,pooled.C),aVsC:z(pooled.A,pooled.C)},
  comp:Object.fromEntries([
    ...compIds.map(id=>[id,arm(r1comp[id])]),
    ['min',{id:compMin,rate:pct(r1comp[compMin].keep,r1comp[compMin].n)}],
    ['max',{id:compMax,rate:pct(r1comp[compMax].keep,r1comp[compMax].n)}],
    ['span',pctN(r1comp[compMax].keep,r1comp[compMax].n)-pctN(r1comp[compMin].keep,r1comp[compMin].n)],
  ]),
  phone:{total:n(phone.totals.all_rows),n:n(phone.totals.counted.n),keep:n(phone.totals.counted.keep),reject:n(phone.totals.counted.reject),
    rate:`${phoneRate}%`,excluded:n(phone.totals.excluded.n),
    ...Object.fromEntries(phone.rows.map((r,i)=>[`b${i}`,phoneRow(r)]))},
  surface:{span:pctN(pooled.C.keep,pooled.C.n)-phoneRate},
  blind:{n:k3.N,aa:k3.aa,ar:k3.ar,ra:k3.ra,rr:k3.rr,agree:k3.aa+k3.rr,
    po:k3.po.toFixed(2),pe:k3.pe.toFixed(2),kappa:k3.k.toFixed(2),kappaStrict:k4.k.toFixed(2),
    claudeAccept:pct(k3.aa+k3.ar,k3.N),ownerAccept:pct(k3.aa+k3.ra,k3.N)},
  editorial:{accepted:ed[1],shown:ed[2]},
  figures:{kept:{seed:kept.seed,composition:kept.composition},rejected:{seed:rejected.seed,composition:rejected.composition}},
};

const lookup=key=>key.split('.').reduce((o,k)=>o?.[k],values);
const missing=[];
const body=read(SRC).replace(/\{\{([\w.]+)\}\}/g,(_m,key)=>{const v=lookup(key);if(v===undefined){missing.push(key);return _m}return String(v)});
if(missing.length)fail('betta-body.html: unknown placeholders '+[...new Set(missing)].join(', '));

const html=docPage({
  title:'Valid By Construction; Taste Not Guaranteed | Sindhorn Midtown',
  description:'IDUI Test 04, published as 03 Betta: a constitution governing a wallpaper generator. Every sampled seed valid on first generation and deterministic across two languages; the owner’s keep rate unmoved by the constitution, and a model’s taste at chance against the owner’s.',
  slug:'betta',
  body:body.trim(),
  comment:`  IDUI Test 04 - Betta, published as 03 Betta, built by scripts/build-betta.mjs from\n  docs/idui/betta-body.html and the states published.json pins, with ${sw}. Library classes only.`,
});

const stale=[];
for(const [from,to] of FIGURES){
  const src=fs.readFileSync(path.join(RUN,from));const dest=path.join(IMG_OUT,to);
  if(check){if(!fs.existsSync(dest)||!src.equals(fs.readFileSync(dest)))stale.push(`site/assets/betta/${to}`)}
  else{fs.mkdirSync(IMG_OUT,{recursive:true});fs.writeFileSync(dest,src)}
}
if(check){
  if((fs.existsSync(OUT)?read(OUT):'')!==html)stale.push('site/betta.html');
  if(stale.length){console.error(`${stale.join(', ')} stale for ${sw}: run node scripts/build-betta.mjs and commit`);process.exit(1)}
  console.log(JSON.stringify({ok:true,mode:'check',sw,bytes:html.length}));
}else{
  fs.writeFileSync(OUT,html);
  console.log(JSON.stringify({ok:true,sw:swShort,bytes:html.length,out:path.relative(ROOT,OUT),images:FIGURES.length,
    pooled:{A:values.pooled.A.rate,B:values.pooled.B.rate,C:values.pooled.C.rate},kappa:values.blind.kappa}));
}
