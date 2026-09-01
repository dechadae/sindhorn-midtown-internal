import fs from 'node:fs';
import vm from 'node:vm';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
if(!BASE_URL)throw new Error('BASE_URL required');

const source=fs.readFileSync('site/sw.js','utf8');
const match=source.match(/const SHELL=(\[[\s\S]*?\]);\nfunction validResponse/);
if(!match)throw new Error('Unable to parse service-worker SHELL');
const shell=vm.runInNewContext(match[1]);
if(!Array.isArray(shell)||!shell.length)throw new Error('SHELL is empty');

function valid(path,response){
  if(!response||!response.ok)return false;
  const type=(response.headers.get('content-type')||'').toLowerCase();
  if(path==='/'||path.endsWith('.html'))return type.includes('text/html');
  if(path.endsWith('.js'))return type.includes('javascript');
  if(path.endsWith('.css'))return type.includes('text/css');
  if(path.endsWith('.webmanifest')||path.endsWith('.json'))return type.includes('json')||type.includes('manifest');
  if(path.endsWith('.png'))return type.includes('image/png');
  if(path.endsWith('.woff')||path.endsWith('.woff2'))return!type.includes('text/html');
  return!type.includes('text/html');
}

const rows=[];
const started=performance.now();
for(const [index,path] of shell.entries()){
  const itemStart=performance.now();
  let response=null,error=null,bytes=0;
  try{
    response=await fetch(`${BASE_URL}${path}`,{redirect:'follow',headers:{'cache-control':'no-cache'}});
    const body=await response.arrayBuffer();bytes=body.byteLength;
  }catch(reason){error=reason?.message||String(reason)}
  const duration=performance.now()-itemStart;
  const row={
    index:index+1,path,status:response?.status||0,ok:Boolean(response?.ok),
    valid:response?valid(path,response):false,
    contentType:response?.headers.get('content-type')||'',
    cacheControl:response?.headers.get('cache-control')||'',
    bytes,durationMs:+duration.toFixed(1),error
  };
  rows.push(row);
  console.log('SINDHORN_PRECACHE_RESOURCE '+JSON.stringify(row));
}
const total=performance.now()-started;
const invalid=rows.filter(row=>!row.valid);
const sorted=[...rows].sort((a,b)=>b.durationMs-a.durationMs);
const summary={
  count:rows.length,
  validCount:rows.length-invalid.length,
  invalidCount:invalid.length,
  totalSerialMs:+total.toFixed(1),
  averageMs:+(total/rows.length).toFixed(1),
  p95Ms:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.05))]?.durationMs??null,
  slowest:sorted.slice(0,10).map(row=>({path:row.path,durationMs:row.durationMs,status:row.status,bytes:row.bytes})),
  invalid:invalid.map(row=>({path:row.path,status:row.status,contentType:row.contentType,error:row.error}))
};
console.log('SINDHORN_PRECACHE_SUMMARY '+JSON.stringify(summary));
if(invalid.length)process.exitCode=2;
