import {readFile} from 'node:fs/promises';

/* idui-core/ is the method's transferable part, copied verbatim from the
   shipped foundation (r32): the four core sheets and the Sindhorn
   constitution. A copy that drifts from site/ is a second source of truth,
   so the deploy guard fails on any byte of difference. Edit site/, then
   `node scripts/idui-core-parity-smoke.mjs --sync` to recopy. */
const ROOT=new URL('../',import.meta.url);
export const PAIRS=[
  ['site/app-glass.css','idui-core/app-glass.css'],
  ['site/app-components.css','idui-core/app-components.css'],
  ['site/app-compositions.css','idui-core/app-compositions.css'],
  ['site/app-shell.css','idui-core/app-shell.css'],
  ['site/app-tokens.css','idui-core/constitutions/sindhorn/app-tokens.css'],
  ['site/fonts.css','idui-core/constitutions/sindhorn/fonts.css']
];
const sync=process.argv.includes('--sync');
const drift=[];
for(const [source,copy] of PAIRS){
  const a=await readFile(new URL(source,ROOT),'utf8');
  const b=await readFile(new URL(copy,ROOT),'utf8').catch(()=>null);
  if(a===b)continue;
  if(sync){const {writeFile}=await import('node:fs/promises');await writeFile(new URL(copy,ROOT),a);console.log(`synced ${copy}`);continue}
  drift.push(copy);
}
console.log(JSON.stringify({ok:drift.length===0,pairs:PAIRS.length,drift}));
if(drift.length)process.exitCode=1;
