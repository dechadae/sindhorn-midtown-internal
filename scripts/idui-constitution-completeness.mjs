import {readFile,readdir} from 'node:fs/promises';

/* A constitution is complete when it declares every token the core reads,
   and honest when it declares nothing the core never reads (r33). The core
   declares no root value of its own since r33; the one subtraction is the
   selector's runtime geometry, which app-select.js writes on the element.
   Fails the deploy guard on any gap or any orphan in any constitution under
   idui-core/constitutions/.

   It also proves each declaration can actually be read. Scanning for the text
   of a token says it was written, not that it applies: r41 put four
   --app-document-* declarations loose inside @media(prefers-reduced-motion) in
   two constitutions, outside any selector, where the parser drops them. Nothing
   consumed them in those products, so nothing looked wrong for six releases.
   A declaration outside a rule is now a failure, not a silence (r50). */
const ROOT=new URL('../',import.meta.url);
/* app-extended.css is core too - capabilities Sindhorn does not link but other
   constitutions use - so its tokens stay governed by the same completeness
   rule. Only the shipped stylesheet list changed in r52, not what is core. */
const core=['app-glass.css','app-components.css','app-compositions.css','app-shell.css','app-extended.css'];
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
  /* Walk the braces: a custom property declared with no rule around it, or
     directly inside an at-rule, never reaches the cascade. */
  const bare=[];
  {
    const src=text.replace(/\/\*[\s\S]*?\*\//g,'');
    const stack=[];let sel='';
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(ch==='{'){stack.push(sel.split(/[;}]/).pop().trim());sel='';continue}
      if(ch==='}'){stack.pop();sel='';continue}
      const m=/^(--[\w-]+)\s*:/.exec(src.slice(i));
      if(m){
        const inner=stack[stack.length-1];
        if(!stack.length||!inner||inner.startsWith('@'))bare.push(m[1]);
        i+=m[0].length-1;sel='';continue;
      }
      sel+=ch;
    }
  }
  const missing=required.filter(t=>!has.has(t));
  const unused=[...has].filter(t=>!consumed.has(t)).sort();
  report.constitutions[name]={missing,unconsumed:unused,...(bare.length?{outsideAnyRule:[...new Set(bare)]}:{})};
  if(missing.length||unused.length||bare.length)report.ok=false;
}
console.log(JSON.stringify(report,null,1));
if(!report.ok)process.exitCode=1;
