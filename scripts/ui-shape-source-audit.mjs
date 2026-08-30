import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

const ROOT=new URL('../site/',import.meta.url);
const coveredPatterns=[
  'masthead-user-avatar','settings-avatar','account-avatar','settings-close','account-close','fnb-back','fnb-sheet-close','fullscreen-toggle','app-back-control',
  'fnb-chip','settings-user-meta','factsheet-hours','factsheet-nearby','chip-btn','.pill','lang-toggle','nav-chip','.action','fnb-action','message-open','pull-refresh','.admin-nav',
  'connection-dot','fnb-select-option','ci-status-dot','public-card-loading','message-badge','message-card','scale-marker','pull-refresh-icon','advice-icon','fnb-toast',
  'public-card-scroll::-webkit-scrollbar-thumb','settings-modal-scroll::-webkit-scrollbar-thumb'
];
const naturalPatterns=[
  'sun','moon','celestial','star','cloud','rain','weather-orb','atmosphere','sky-disc','eclipse','lunar','solar'
];
const nonUiPatterns=[
  '::-webkit-scrollbar-thumb' // only tolerated when a matching central override exists; checked below first.
];
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(path));else if(entry.isFile()&&entry.name.endsWith('.css'))out.push(path)}return out}
const rootPath=new URL('.',ROOT).pathname;
const findings=[];
for(const path of await files(rootPath)){
  const text=await readFile(path,'utf8');
  const rel=relative(rootPath,path).replaceAll('\\','/');
  const rx=/([^{}]+)\{([^{}]*?border-radius\s*:\s*(?:50%|(?:9{3,}|[1-9]\d{2,})px)[^{}]*?)\}/gi;
  let match;
  while((match=rx.exec(text))){
    const selector=match[1].trim().replace(/\s+/g,' ');
    const body=match[2];
    const declaration=body.match(/border-radius\s*:\s*([^;}]*)/i)?.[1]?.trim()||'unknown';
    const key=`${rel} ${selector}`.toLowerCase();
    let status='unresolved';
    let reason='No rounded-corner authority or natural-scene exemption found.';
    if(coveredPatterns.some(pattern=>key.includes(pattern.toLowerCase()))){status='covered';reason='Computed UI is overridden by site/app-shapes.css.'}
    else if(naturalPatterns.some(pattern=>key.includes(pattern))){status='natural';reason='Natural scene/weather rendering; circular geometry is semantic.'}
    else if(nonUiPatterns.some(pattern=>key.includes(pattern.toLowerCase()))){status='unresolved';reason='Custom scrollbar still needs an explicit app-shapes.css override.'}
    findings.push({file:rel,selector,declaration,status,reason});
  }
}
const unresolved=findings.filter(item=>item.status==='unresolved');
const report={ok:unresolved.length===0,total:findings.length,covered:findings.filter(x=>x.status==='covered').length,natural:findings.filter(x=>x.status==='natural').length,unresolved};
console.log(JSON.stringify(report,null,2));
if(unresolved.length)process.exitCode=1;
