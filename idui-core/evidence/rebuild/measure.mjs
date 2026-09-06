/* Measures the Flipgazine "Moving to Claude Code" page before and after the
   rebuild on idui-core, with one real browser, on the same clock.

   Before: flipgazine-source/claude-code.html composed the way the shell
   composes it (FG_HEAD, FG_HEADER), with the site_files module fetches routed
   to the local copies and every other database call answered empty — so it
   renders offline, from the snapshot periods, with no key. After: after/
   claude-code.html, which loads the core sheets and the same engines.

   Both pin the same period, so the atmosphere and palette are identical and
   the diff is the page. Output: shots/, comparison.json.

     node idui-core/evidence/rebuild/measure.mjs            # from the repo root */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {cssMetrics,markupMetrics,discretionary,semantic,propagation,RENDER} from '../metrics.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const srcDir=path.join(here,'flipgazine-source');
const PERIOD='golden-hour';
const CLOCK=new Date('2026-09-06T19:20:00+07:00');   // inside the pinned period

/* ---- compose the before page as the shell would ---- */
const [page,head,header]=await Promise.all(['claude-code.html','fg-head.html','fg-header.html'].map(f=>readFile(path.join(srcDir,f),'utf8')));
const before=page.replace('<!--FG_HEAD-->',head).replace('<!--FG_HEADER-->',header);
await mkdir(path.join(here,'before'),{recursive:true});
await writeFile(path.join(here,'before/claude-code.composed.html'),before);

/* ---- a static server for the repo ---- */
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.txt':'text/plain','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const p=path.join(repo,decodeURIComponent(new URL(req.url,'http://x').pathname));
  try{const b=await readFile(p);res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});res.end(b)}
  catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,r));
const base=`http://127.0.0.1:${server.address().port}/idui-core/evidence/rebuild`;

const browser=await chromium.launch().catch(()=>chromium.launch({channel:'chrome'}));

async function open(url,{viewport,pinPeriod=true}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});
  await ctx.clock.install({time:CLOCK});
  const errors=[];
  /* Every Supabase read the before page makes, answered from disk */
  await ctx.route('https://sjpvhgxacsiorrtijqua.supabase.co/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname.endsWith('/site_files')){
      const m=/^eq\.(.+)$/.exec(u.searchParams.get('path')||'');
      const file=m&&path.join(srcDir,path.basename(m[1]));
      try{const content=await readFile(file,'utf8');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{content}])})}
      catch{return route.fulfill({status:200,contentType:'application/json',body:'[]'})}
    }
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errors.push(String(e)));
  pg.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await pg.goto(url,{waitUntil:'load'});
  await pg.waitForFunction(()=>window.FGTheme&&document.fonts.status==='loaded',null,{timeout:20000}).catch(()=>{});
  await pg.evaluate(async()=>{await document.fonts.ready});
  if(pinPeriod) await pg.evaluate(k=>{window.FGTheme&&window.FGTheme.pin(k)},PERIOD);
  await pg.clock.runFor(3000);          // crossfade to the pinned palette, arrival
  await pg.waitForTimeout(600);
  return {ctx,pg,errors};
}

/* ---- metrics that do not depend on the browser ---- */
const results={period:PERIOD,clock:CLOCK.toISOString(),before:{},after:{}};

/* Before: page-authored CSS = the 7 style blocks in the composed page
   (the page's own + fg-head core + header styles). Shared CSS = none beyond
   those (Flipgazine ships no stylesheet file; every rule is a style block). */
results.before.markup=markupMetrics(before);
results.before.pageOwn=markupMetrics(page);           // the row as stored, before composition
/* After: page-authored CSS = 0; shared = the four core sheets + the constitution */
const after=await readFile(path.join(here,'after/claude-code.html'),'utf8');
results.after.markup=markupMetrics(after);
const coreFiles=['app-glass.css','app-components.css','app-compositions.css','app-shell.css'].map(f=>path.join(repo,'idui-core',f));
const constFiles=['app-tokens.css','fonts.css'].map(f=>path.join(repo,'idui-core/constitutions/flipgazine',f));
const coreCss=(await Promise.all(coreFiles.map(f=>readFile(f,'utf8')))).join('\n');
const constCss=(await Promise.all(constFiles.map(f=>readFile(f,'utf8')))).join('\n');
results.after.sharedCss={core:cssMetrics(coreCss),constitution:cssMetrics(constCss)};
results.before.discretionary=discretionary([...before.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),before);
results.after.discretionary=discretionary('',after);
results.before.semantic=semantic(before.slice(before.indexOf('<body')));
results.after.semantic=semantic(after.slice(after.indexOf('<body')));
results.before.propagation=propagation({page:[...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),head:[...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),header:[...header.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')});
results.after.propagation=propagation({page:'',constitution:constCss,core:coreCss});
results.after.behaviorJs=Buffer.byteLength(await readFile(path.join(here,'after/claude-code.js'),'utf8'));
results.before.behaviorJs=Buffer.byteLength(await readFile(path.join(srcDir,'fg-page-claude-code.js'),'utf8'))
  +Buffer.byteLength([...header.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'))
  +Buffer.byteLength([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'));

/* ---- rendered metrics ---- */


await mkdir(path.join(here,'shots'),{recursive:true});
async function shoot(name,url,viewport,hideEngines){
  const {ctx,pg,errors}=await open(url,{viewport});
  const rendered=await pg.evaluate(RENDER);
  /* the atmosphere and glyph field are the same engines on both pages; hide them
     for the DOM-only diff so the comparison is the page, then take the real one */
  await pg.screenshot({path:path.join(here,'shots',`${name}-${viewport.width}-top.png`),animations:'disabled'});
  await pg.addStyleTag({content:'#glCanvas,#bgLetters,.environment-stage{visibility:hidden!important}'});
  await pg.evaluate(()=>{document.querySelectorAll('#glCanvas,#bgLetters,.environment-stage').forEach(e=>e.remove())});
  await pg.screenshot({path:path.join(here,'shots',`${name}-${viewport.width}-full-dom.png`),fullPage:true,animations:'disabled',timeout:120000});
  await ctx.close();
  return {rendered,errors};
}
for(const vp of [{width:390,height:844},{width:1240,height:900}]){
  results.before['render'+vp.width]=await shoot('before',`${base}/before/claude-code.composed.html`,vp);
  results.after['render'+vp.width]=await shoot('after',`${base}/after/claude-code.html`,vp);
}
await browser.close();server.close();
await writeFile(path.join(here,'comparison.json'),JSON.stringify(results,null,2));
const b=results.before,a=results.after;
console.log(JSON.stringify({discretionary:{before:b.discretionary.total,after:a.discretionary.total},semantic:{before:b.semantic.total,after:a.semantic.total},propagation:{before:Object.fromEntries(Object.entries(b.propagation).map(([k,v])=>[k,v.total])),after:Object.fromEntries(Object.entries(a.propagation).map(([k,v])=>[k,v]))},

  before:{pageCssBytes:b.markup.pageCss.bytes,styleBlocks:b.markup.styleBlocks,rules:b.markup.pageCss.rules,important:b.markup.pageCss.important,inlineStyleAttrs:b.markup.inlineStyleAttrs,classes:b.markup.distinctClasses,errors:b.render390.errors,visible:b.render390.rendered.visible,fontSizes:b.render390.rendered.fontSizes.length,radii:b.render390.rendered.radii.length,nested:b.render390.rendered.nestedGlass,height:b.render390.rendered.docHeight,fam:b.render390.rendered.fontFamily,tokens:b.render390.rendered.tokens},
  after:{pageCssBytes:a.markup.pageCss.bytes,styleBlocks:a.markup.styleBlocks,inlineStyleAttrs:a.markup.inlineStyleAttrs,classes:a.markup.distinctClasses,sharedCoreBytes:a.sharedCss.core.bytes,constitutionBytes:a.sharedCss.constitution.bytes,errors:a.render390.errors,visible:a.render390.rendered.visible,fontSizes:a.render390.rendered.fontSizes.length,radii:a.render390.rendered.radii.length,nested:a.render390.rendered.nestedGlass,height:a.render390.rendered.docHeight,fam:a.render390.rendered.fontFamily,tokens:a.render390.rendered.tokens}
},null,1));
