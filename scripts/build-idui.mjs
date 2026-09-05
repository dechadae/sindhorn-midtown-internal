/* Invariant-Driven UI (IDUI) export. docs/idui/idui-body.html is the source:
   library classes only, no presentation of its own. This script wraps it in
   the app's own foundation files - the seven CSS files every page loads, taken
   verbatim from site/ - with the fonts and the logo embedded, so the document
   opens offline and always shows the library as it ships. The stamp is the
   service-worker VERSION, so a release that changes nothing the document
   shows still re-stamps it.

   The same body is also the public document at /idui (site/idui.html, r34):
   the seven stylesheets linked rather than embedded, the live sky atmosphere
   in place of the still gradient, and the share pages' masthead
   (scripts/public-doc-page.mjs). One source, two outputs, one --check.

     node scripts/build-idui.mjs            rebuild docs/idui/IDUI-v0.1.html and site/idui.html
     node scripts/build-idui.mjs --check    fail if either committed output is stale
     node scripts/build-idui.mjs --downloads  also copy the export to ~/Downloads */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {docPage} from './public-doc-page.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const SRC=path.join(ROOT,'docs/idui/idui-body.html');
const OUT=path.join(ROOT,'docs/idui/IDUI-v0.1.html');
const SITE_OUT=path.join(SITE,'idui.html');
const check=process.argv.includes('--check');
const downloads=process.argv.includes('--downloads');

const read=p=>fs.readFileSync(p,'utf8');
const dataUri=(p,mime)=>`data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const sw=read(path.join(SITE,'sw.js')).match(/const VERSION='([^']+)'/)?.[1];
if(!sw){console.error('sw.js: VERSION not found');process.exit(1)}
// The document shows the release part of the version; the head comment keeps the full string.
const swShort=sw.replace(/^sindhorn-midtown-internal-pwa-/,'');

// Foundation files, in the order every app page loads them.
const FILES=['fonts.css','app-tokens.css','app-glass.css','app-components.css','app-compositions.css','app-shell.css','ci-library.css'];
let styles='';const leftover=[];
for(const name of FILES){
  let css=read(path.join(SITE,name));
  if(name==='fonts.css')css=css.replace(/url\((["']?)\/?(assets\/fonts\/[^"')]+\.woff2)\1\)/g,(_m,_q,p)=>`url(${dataUri(path.join(SITE,p),'font/woff2')})`);
  for(const m of css.matchAll(/url\(([^)]*)\)/g))if(!m[1].startsWith('data:'))leftover.push(`${name}: ${m[1]}`);
  styles+=`\n<style>\n/* ===== ${name} — verbatim snapshot from site/${name} as shipped with ${sw}. Exported copy; the app loads the file, not this block. ===== */\n${css.trim()}\n</style>\n`;
}
if(leftover.length){console.error('Non-data url() references left in CSS:\n  '+leftover.join('\n  '));process.exit(1)}

const logo=dataUri(path.join(SITE,'assets/brand/sindhorn-midtown-vignette-white.png'),'image/png');
const body=read(SRC).replace('__LOGO__',logo).replaceAll('__SW__',swShort);
if(body.includes('__'+'LOGO__')||/__[A-Z]+__/.test(body.replace(/data:[^"']+/g,''))){console.error('idui-body.html: unresolved placeholder');process.exit(1)}

const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#2E273B">
<title>Invariant-Driven UI</title>
<!--
  Invariant-Driven UI (IDUI) v0.1 — Sindhorn Midtown Internal.
  Self-contained export built by scripts/build-idui.mjs from docs/idui/idui-body.html. The seven
  <style> blocks below are the app's own foundation files as shipped with ${sw}; fonts and the
  logo are embedded as data URIs so the file opens offline. The document declares no CSS of its
  own: every element is a library class. The Betta WebGL atmosphere is replaced by a still SVG
  gradient inside the same .environment-stage; its gradient stops are image data, not styling.
-->
${styles}
</head>
<body>
${body}
</body>
</html>
`;
/* The public document: the export's still gradient and its own masthead are
   the body's; the site page takes the live stage and the share masthead
   from public-doc-page.mjs instead. */
const cut=(text,pattern,what)=>{const next=text.replace(pattern,'');if(next===text)throw new Error(`idui-body.html: ${what} not found`);return next};
let siteBody=read(SRC).replaceAll('__SW__',swShort);
siteBody=cut(siteBody,/<div class="environment-stage"[\s\S]*?<\/svg>\n<\/div>\n/,'still atmosphere');
siteBody=cut(siteBody,/<header class="app-masthead">[\s\S]*?<\/header>\n/,'masthead');
if(siteBody.includes('__LOGO__'))throw new Error('idui-body.html: the logo is used outside the masthead');
const site=docPage({
  title:'Invariant-Driven UI | Sindhorn Midtown',
  description:'Pages compose. Primitives behave. Invariants style. Contracts validate. The design and development method behind Sindhorn Midtown Internal, written from the production code.',
  slug:'idui',
  body:siteBody.trim(),
  comment:`  Invariant-Driven UI (IDUI) v0.1 - the public document, built by scripts/build-idui.mjs from\n  docs/idui/idui-body.html with ${sw}. Library classes only; the atmosphere is live.`
});

if(check){
  const stale=[];
  if((fs.existsSync(OUT)?read(OUT):'')!==html)stale.push('docs/idui/IDUI-v0.1.html');
  if((fs.existsSync(SITE_OUT)?read(SITE_OUT):'')!==site)stale.push('site/idui.html');
  if(stale.length){console.error(`${stale.join(' and ')} stale for ${sw}: run node scripts/build-idui.mjs and commit`);process.exit(1)}
  console.log(JSON.stringify({ok:true,mode:'check',sw,bytes:html.length,siteBytes:site.length}));
}else{
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,html);fs.writeFileSync(SITE_OUT,site);
  if(downloads)fs.writeFileSync(path.join(os.homedir(),'Downloads/IDUI-v0.1.html'),html);
  console.log(JSON.stringify({ok:true,sw,bytes:html.length,out:path.relative(ROOT,OUT),siteBytes:site.length,siteOut:path.relative(ROOT,SITE_OUT),downloads}));
}
