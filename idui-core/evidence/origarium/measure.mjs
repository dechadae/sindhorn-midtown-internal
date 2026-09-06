/* Measures the Origarium "Papers" page — Test 03, before side.

   The harness is Origarium's; the metric definitions are not. Everything that
   produces a number comes from ../metrics.mjs, the same module the Flipgazine
   rebuild imports, so the two tests can be compared without measuring the
   measurer (PROTOCOL.md amendment A1).

   The page is served from the frozen snapshot in source/, not from the live
   row. Two things are blocked at the network layer rather than trusted:

     1. Every write. The page carries a POST to increment_site_visits, and
        these rows belong to another application on a shared project. Any
        non-GET to Supabase is aborted and recorded. The page does not fire
        that POST under this harness, so the guard is demonstrated rather than
        assumed: each run makes a deliberate write attempt of its own and
        requires it to be refused. A run where the probe succeeds is invalid.
     2. Every Supabase read, answered locally, so nothing depends on live data.

   Google Fonts and the supabase-js bundle are allowed through: the page's
   typography is half of what is being measured, and both are read-only. The
   run is therefore not hermetic, which is recorded in the output.

     node idui-core/evidence/origarium/measure.mjs      # from the repo root */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {cssMetrics,markupMetrics,discretionary,semantic,RENDER} from '../metrics.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const srcDir=path.join(here,'source');
const VIEWPORTS=[{name:'390',width:390,height:844},{name:'768',width:768,height:1024},{name:'1240',width:1240,height:900}];

const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  const file=path.join(srcDir,name==='/'||name==='/papers'?'papers.html':name);
  try{
    const body=await readFile(file);
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});
    res.end(body);
  }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;

const browser=await chromium.launch().catch(()=>chromium.launch({channel:'chrome'}));
const writesAttempted=[],supabaseSeen=[],probes=[];

async function open({width,height}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  /* Nothing this run does may change another application's data. Every
     Supabase request is recorded, not only the writes: "no write observed" is
     worthless if the guard was never exercised, and a first version of this
     harness reported a clean run only because it closed the page before the
     page's own POST had fired. The run asserts both halves - a write was
     attempted and refused, and none succeeded. */
  await context.route('**://*.supabase.co/**',route=>{
    const request=route.request(),seen=`${request.method()} ${request.url().split('/').pop().split('?')[0]}`;
    supabaseSeen.push(seen);
    if(request.method()!=='GET'){writesAttempted.push(seen);return route.abort()}
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.goto(`${base}/papers`,{waitUntil:'networkidle'});
  /* Long enough for the page's deferred calls. */
  await page.waitForTimeout(4000);
  return {context,page,errors};
}

const html=await readFile(path.join(srcDir,'papers.html'),'utf8');
const pageCss=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');

const results={
  test:'IDUI Test 03 — Origarium Papers',
  side:'before',
  measuredAt:new Date().toISOString(),
  source:{path:'/papers.html',version:59,characters:58319,md5:'7fc246e81d09a1e9a84488b5b068f15e'},
  hermetic:false,
  hermeticNote:'Google Fonts and the supabase-js bundle load from the network; every Supabase call is intercepted, reads answered empty and writes aborted.',
  markup:markupMetrics(html),
  discretionary:discretionary(pageCss,html),
  semantic:semantic(html),
  rendered:{},
};

await mkdir(path.join(here,'shots'),{recursive:true});
for(const viewport of VIEWPORTS){
  const {context,page,errors}=await open(viewport);
  /* Measure first: the probe below deliberately fails a fetch, and its console
     error is the harness's, not the page's. */
  results.rendered[viewport.name]={...await page.evaluate(RENDER),errors:[...errors]};
  await page.screenshot({path:path.join(here,`shots/before-${viewport.name}-top.png`)});
  /* Demonstrate the guard on every run rather than trusting it. */
  probes.push(await page.evaluate(async()=>{
    try{const r=await fetch('https://sjpvhgxacsiorrtijqua.supabase.co/rest/v1/rpc/increment_site_visits',{method:'POST',body:'{}'});return {refused:false,status:r.status}}
    catch(error){return {refused:true,reason:String(error.message).slice(0,60)}}
  }));
  await context.close();
}
results.supabaseRequests=[...new Set(supabaseSeen)];
results.writesRefused=[...new Set(writesAttempted)];
/* Valid only if the guard was exercised and nothing got through it. */
results.writeProbes=probes;
results.guardExercised=supabaseSeen.length>0;
results.everyProbeRefused=probes.length===VIEWPORTS.length&&probes.every(p=>p.refused);
results.valid=results.guardExercised&&results.everyProbeRefused;

await browser.close();
server.close();
await writeFile(path.join(here,'before.json'),JSON.stringify(results,null,1));

const r=results.rendered['390'];
console.log(JSON.stringify({
  valid:results.valid,
  guardExercised:results.guardExercised,
  everyWriteProbeRefused:results.everyProbeRefused,
  writesRefused:results.writesRefused,
  pageCssBytes:results.markup.pageCss.bytes,
  pageCssRules:results.markup.pageCss.rules,
  styleBlocks:results.markup.styleBlocks,
  inlineStyleAttrs:results.markup.inlineStyleAttrs,
  appearanceDecisions:results.discretionary.total,
  semanticDeclarations:results.semantic.total,
  fontSizes:r.fontSizes.length,fontWeights:r.fontWeights.length,radii:r.radii.length,
  blurRecipes:r.backdropFilters.length,nestedGlass:r.nestedGlass.length??r.nestedGlass,
  errors:r.errors.length,
},null,1));
