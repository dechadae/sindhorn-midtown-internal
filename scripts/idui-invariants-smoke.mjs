import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

/* IDUI invariants that a static read can decide (r32). The material, the
   scale, the file boundary and the shape already have their gates
   (ui-centralization-budget, page-centralization-audit, ui-shape-source-audit,
   font-architecture); this one closes the two that were "none automated":

   7  Variants are attributes, not classes. Every [data-*] the foundation
      styles is a word from one vocabulary - a variant the markup chooses or
      a state a script stamps - and no .app-* class carries a --modifier.
   8  Both-or-neither. Actions that share a row share a weight: a row holds
      framed buttons (.app-primary) or frameless utilities
      (.app-utility-action), never one beside the other. A hero head and a
      dialog foot (and the row inside it) are where the rule says neither:
      the lone action there (Share, Sign out, Cancel) is a dismissal or a
      utility by position, so a primary may sit next to it.

   Reads the foundation sheets, the shell and page markup, and the page
   modules' template literals (a tag walker, not a parser: a template that
   opens a row and closes it in the same string is what the modules write). */
const SITE=new URL('../site/',import.meta.url).pathname;
const FOUNDATION=['app-tokens.css','app-glass.css','app-components.css','app-compositions.css','app-shell.css','fonts.css','ci-library.css'];
const VARIANTS=['tone','size','width','columns','mode','open','compact','direction','split','rule','icon','stagger'];
const STATES=['view','run','set','locked','ready','public','view-demo'];
const ROWS=['app-row','app-utility-row','app-action-card-actions','app-dialog-actions','app-hero-head'];
const NEITHER=['app-hero-head','app-dialog-actions'];
const PRIMARY='app-primary',UTILITY='app-utility-action';

const findings=[];
const note=(file,rule,detail)=>findings.push({file,rule,detail});

/* 7 · the vocabulary */
for(const name of FOUNDATION){
  const css=await readFile(join(SITE,name),'utf8').then(s=>s.replace(/\/\*[\s\S]*?\*\//g,''));
  for(const m of css.matchAll(/\[data-([a-z-]+)/g)){
    const word=m[1];
    if(!VARIANTS.includes(word)&&!STATES.includes(word))note(name,'7 grammar',`[data-${word}] is not in the variant or state vocabulary`);
  }
  for(const m of css.matchAll(/\.app-[a-z0-9-]*?--[a-z0-9-]+/g))note(name,'7 grammar',`${m[0]} is a modifier class; variants are attributes`);
  if(name!=='app-tokens.css')for(const m of css.matchAll(/min-height\s*:\s*(\d+px)/g))note(name,'3 scale',`min-height:${m[1]} is a literal; heights are tokens`);
}

/* 8 · both-or-neither */
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(/\.(html|js)$/.test(e.name)&&!/\.min\.js$|^sw\.js$|^_worker\.js$/.test(e.name))out.push(p)}return out}
const tagRx=/<(\/?)([a-z][a-z0-9-]*)\b([^<>]*?)\/?>/gi;
function walk(text,file){
  const stack=[];
  let m;
  while((m=tagRx.exec(text))){
    const[,close,tag,attrs]=m;
    if(/^(br|img|input|hr|meta|link|path|circle|rect|line|polyline|use|wbr|source)$/i.test(tag)&&!close)continue;
    if(close){
      const at=stack.map(f=>f.tag).lastIndexOf(tag.toLowerCase());
      if(at<0)continue;
      for(const frame of stack.splice(at))judge(frame,file);
      continue;
    }
    /* a template's ${...} inside a class attribute is a variant the page
       decides at run time; the class words around it are what is read */
    const classes=(attrs.match(/class="([^"]*)"/)?.[1]||'').replace(/\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,' ').split(/\s+/);
    const row=ROWS.find(r=>classes.includes(r));
    const frame={tag:tag.toLowerCase(),line:text.slice(0,m.index).split('\n').length,row,neither:NEITHER.includes(row)||stack.some(f=>f.neither),primary:0,utility:0};
    const holder=[...stack].reverse().find(f=>f.row);
    if(holder){if(classes.includes(PRIMARY))holder.primary++;if(classes.includes(UTILITY))holder.utility++}
    if(/\/>$/.test(m[0]))continue;
    stack.push(frame);
  }
  for(const frame of stack)judge(frame,file);
}
function judge(frame,file){
  if(!frame.row||frame.neither)return;
  if(frame.primary&&frame.utility)note(file,'8 both-or-neither',`line ${frame.line}: .${frame.row} holds ${frame.primary} primary and ${frame.utility} utility action(s)`);
}
for(const path of await files(SITE)){
  const rel=relative(SITE,path).replaceAll('\\','/');
  if(rel.startsWith('betta-')||rel.startsWith('vendor/'))continue;
  walk(await readFile(path,'utf8'),rel);
}
for(const path of ['../docs/idui/idui-body.html']){
  const abs=new URL(path,new URL('../site/',import.meta.url)).pathname;
  walk(await readFile(abs,'utf8'),relative(join(SITE,'..'),abs));
}

console.log(JSON.stringify({ok:findings.length===0,foundation:FOUNDATION.length,variants:VARIANTS,states:STATES,findings},null,2));
if(findings.length)process.exitCode=1;
