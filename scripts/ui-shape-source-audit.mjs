import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

const ROOT=new URL('../site/',import.meta.url);
/* Rounded, never circular: a 50% or 999px radius in site CSS is a finding
   unless it draws a natural thing (the sun, the moon, a cloud). The legacy
   override sheet (app-shapes.css) that used to excuse the old routes' circles
   went with those routes in r31; nothing is "covered" any more. */
const naturalPatterns=[
  'sun','moon','celestial','star','cloud','rain','weather-orb','atmosphere','sky-disc','eclipse','lunar','solar'
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
    if(naturalPatterns.some(pattern=>key.includes(pattern))){status='natural';reason='Natural scene/weather rendering; circular geometry is semantic.'}
    findings.push({file:rel,selector,declaration,status,reason});
  }
}
const unresolved=findings.filter(item=>item.status==='unresolved');
const report={ok:unresolved.length===0,total:findings.length,natural:findings.filter(x=>x.status==='natural').length,unresolved};
console.log(JSON.stringify(report,null,2));
if(unresolved.length)process.exitCode=1;
