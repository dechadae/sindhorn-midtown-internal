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
function cssMetrics(css){
  const strip=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=(strip.match(/\{[^{}]*\}/g)||[]).length;
  return {
    bytes:Buffer.byteLength(css),
    rules,
    important:(strip.match(/!important/g)||[]).length,
    media:(strip.match(/@media/g)||[]).length,
    literalFontSizes:new Set((strip.match(/font-size:\s*([^;}]+)/g)||[]).filter(v=>!/var\(/.test(v))).size,
    literalRadii:new Set((strip.match(/border-radius:\s*([^;}]+)/g)||[]).filter(v=>!/var\(/.test(v))).size,
    backdropFilters:(strip.match(/backdrop-filter:/g)||[]).length,
    hexColors:new Set((strip.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).map(s=>s.toLowerCase())).size,
  };
}
function markupMetrics(html){
  const styleBlocks=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
  const inlineStyleAttrs=(html.replace(/<code>[\s\S]*?<\/code>/g,'').match(/\sstyle="/g)||[]).length;
  const classes=new Set();
  for(const m of html.replace(/<code>[\s\S]*?<\/code>/g,'').matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c=>classes.add(c));
  return {bytes:Buffer.byteLength(html),styleBlocks:styleBlocks.length,pageCss:cssMetrics(styleBlocks.join('\n')),inlineStyleAttrs,distinctClasses:classes.size,classList:[...classes].sort()};
}

/* ---- architecture metrics ----
   Discretionary appearance decisions: declarations in page-authored CSS or
   style attributes whose value is a literal, not a token — each one is a
   choice the page made on its own. Semantic declarations: the distinct
   classes and data attributes the page must write to get its look. Change
   propagation distance: for a named visual change, how many literal
   declarations must be edited. */
const APPEARANCE=/^(font-size|font-weight|font-family|letter-spacing|line-height|color|background|background-color|border|border-color|border-radius|padding|margin|gap|box-shadow|backdrop-filter|-webkit-backdrop-filter|opacity|text-transform|width|height|min-height|max-width)$/;
function declarations(css){
  const strip=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const out=[];
  for(const m of strip.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const sel=m[1].trim();
    for(const d of m[2].split(';')){const i=d.indexOf(':');if(i<0)continue;out.push({sel,prop:d.slice(0,i).trim(),value:d.slice(i+1).trim()})}
  }
  return out;
}
function discretionary(css,html){
  const decl=declarations(css).filter(d=>APPEARANCE.test(d.prop)&&!/var\(/.test(d.value)&&!/^(0|none|inherit|transparent|currentColor|auto)$/.test(d.value));
  const inline=[...html.replace(/<code>[\s\S]*?<\/code>/g,'').matchAll(/\sstyle="([^"]*)"/g)].flatMap(m=>m[1].split(';').filter(x=>x.includes(':')));
  return {cssDecisions:decl.length,inlineDecisions:inline.length,total:decl.length+inline.length,byProperty:Object.fromEntries([...decl.reduce((m,d)=>m.set(d.prop,(m.get(d.prop)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]))};
}
function semantic(html){
  const body=html.replace(/<code>[\s\S]*?<\/code>/g,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'');
  const classes=new Set(),attrs=new Set();
  for(const m of body.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c=>classes.add(c));
  for(const m of body.matchAll(/\s(data-[a-z-]+)(?:="([^"]*)")?/g)) attrs.add(m[1]+(m[2]!==undefined?'='+m[2]:''));
  const names=new Set([...attrs].map(a=>a.split('=')[0]));
  return {classes:classes.size,dataAttributeNames:names.size,dataAttributeValues:attrs.size,total:classes.size+names.size,classList:[...classes].sort(),attrList:[...attrs].sort()};
}
/* literal declarations that must change for one named visual change */
const CHANGES={
  'chip radius':{prop:/^border-radius$/,sel:/chip|copy|mode-btn|btn|ed-switch|control|pill/i,token:/^--radius-control$/},
  'label tracking':{prop:/^letter-spacing$/,sel:/./,token:/^--tracking-label$/},
  'glass recipe':{prop:/^(-webkit-)?backdrop-filter$/,sel:/./,token:/^--app-glass-filter$/},
  'body face':{prop:/^font-family$/,sel:/./,token:/^--font-ui$/},
  'label weight':{prop:/^font-weight$/,sel:/eyebrow|nt|st|sy|chip|btn|brand|num|label/i,token:/^--weight-label$/},
};
function propagation(sources){
  const out={};
  for(const [name,c] of Object.entries(CHANGES)){
    out[name]={};
    for(const [src,css] of Object.entries(sources)){
      /* a literal declaration is one edit; a token definition is one edit;
         a declaration that consumes a token is none */
      const hits=declarations(css).filter(d=>(c.prop.test(d.prop)&&c.sel.test(d.sel)&&!/var\(/.test(d.value)&&!/^(none|0|inherit)$/.test(d.value))||c.token.test(d.prop));
      out[name][src]=hits.length;
    }
    out[name].total=Object.values(out[name]).reduce((a,b)=>a+b,0);
  }
  return out;
}

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
const RENDER=`(()=>{
  const els=[...document.querySelectorAll('body *')].filter(e=>!e.closest('#bgLetters,#glCanvas,.environment-stage,script,style,svg'));
  const vis=els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
  const set=k=>{const s=new Map();for(const e of vis){const v=getComputedStyle(e)[k];s.set(v,(s.get(v)||0)+1)}return [...s].sort((a,b)=>b[1]-a[1])};
  const bf=vis.map(e=>getComputedStyle(e).backdropFilter||getComputedStyle(e).webkitBackdropFilter).filter(v=>v&&v!=='none');
  const nested=vis.filter(e=>{const f=getComputedStyle(e).backdropFilter;if(!f||f==='none')return false;let p=e.parentElement;while(p){const g=getComputedStyle(p).backdropFilter;if(g&&g!=='none')return true;p=p.parentElement}return false}).length;
  const runtimeInline=[...document.querySelectorAll('[style]')].filter(e=>!e.closest('#bgLetters,.environment-stage')&&e.id!=='glCanvas').map(e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+'['+e.getAttribute('style').slice(0,60)+']');
  const sheets=[...document.styleSheets].map(s=>({href:s.href?s.href.split('/').slice(-3).join('/'):(s.ownerNode&&s.ownerNode.id)||'inline',rules:(()=>{try{return s.cssRules.length}catch{return -1}})()}));
  return {
    elements:els.length, visible:vis.length,
    fontSizes:set('fontSize'), fontWeights:set('fontWeight'), letterSpacings:set('letterSpacing'),
    radii:set('borderRadius').filter(([v])=>v!=='0px'), lineHeights:set('lineHeight'),
    colors:set('color'), backdropFilters:[...new Set(bf)], backdropCount:bf.length, nestedGlass:nested,
    runtimeInline, sheets, docHeight:document.documentElement.scrollHeight,
    fontFamily:getComputedStyle(document.body).fontFamily,
    tokens:Object.fromEntries(['--accent','--bg','--text','--muted','--surface','--app-accent','--app-ground','--app-text'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()]))
  };
})()`;

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
