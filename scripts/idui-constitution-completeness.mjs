import {readFile,readdir} from 'node:fs/promises';

/* A constitution is complete when it declares every token the core reads,
   and honest when it declares nothing the core never reads (r33). The core
   declares no root value of its own since r33; the one subtraction is the
   selector's runtime geometry, which app-select.js writes on the element.
   Fails the deploy guard on any gap or any orphan in any constitution under
   idui-core/constitutions/. */
const ROOT=new URL('../',import.meta.url);
const core=['app-glass.css','app-components.css','app-compositions.css','app-shell.css'];
let coreText='';
for(const f of core)coreText+=await readFile(new URL(`idui-core/${f}`,ROOT),'utf8');
const declared=new Set([...coreText.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
const consumed=new Set([...coreText.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]));
/* app-select.js sets the menu's anchor geometry on the element at runtime. */
const runtime=t=>t.startsWith('--app-select-');
const required=[...consumed].filter(t=>!declared.has(t)&&!runtime(t)).sort();
const report={ok:true,required:required.length,constitutions:{}};
const names=(await readdir(new URL('idui-core/constitutions/',ROOT),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name);
for(const name of names){
  let text='';
  for(const f of ['app-tokens.css','fonts.css'])text+=await readFile(new URL(`idui-core/constitutions/${name}/${f}`,ROOT),'utf8').catch(()=>'');
  const has=new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
  const missing=required.filter(t=>!has.has(t));
  const unused=[...has].filter(t=>!consumed.has(t)).sort();
  report.constitutions[name]={missing,unconsumed:unused};
  if(missing.length||unused.length)report.ok=false;
}
console.log(JSON.stringify(report,null,1));
if(!report.ok)process.exitCode=1;
