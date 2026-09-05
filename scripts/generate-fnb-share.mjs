/* The public F&B share, generated at deploy (r30): /share/fnb and
   /share/fnb/<id> are the app shell itself, in public mode.

   Each page is site/index.html cut by site/public-page.js - the one
   transformation the business card worker (r31) also runs - with the
   promotion's own title, description, canonical and Open Graph tags read
   from the public read model, so a link unfurls before any script runs.
   <body data-public="fnb"> is what shell.js reads to run in public mode.
   The share therefore renders from the same stylesheets, atmosphere and
   page module as the app, and a shell release is a share release. Nothing
   is read from sindhorn_app_files any more; that table is gone.

     node scripts/generate-fnb-share.mjs [site/share]
     PUBLIC_ORIGIN=https://... to stamp another origin into the canonical URLs. */
import {mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {publicPage,PUBLIC_SITE_NAME as SITE} from '../site/public-page.js';

const OUTPUT=resolve(process.argv[2]||'site/share');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://sindhorn-midtown-internal.pages.dev').replace(/\/$/,'');
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const FNB_RPC='sindhorn_fnb_public_read_model';

function validIso(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))}
function validate(data){
  if(!Array.isArray(data)||!data.length)throw new Error('Supabase returned an empty F&B public dataset');
  const pids=new Set(),aids=new Set(),artids=new Set();
  for(const item of data){
    if(!item?.id||pids.has(item.id)||!item.title||!validIso(item.start)||!validIso(item.end)||item.start>item.end||!Array.isArray(item.activations))throw new Error(`Invalid public promotion ${item?.id||'<unknown>'}`);pids.add(item.id);
    for(const activation of item.activations){
      if(!activation?.id||aids.has(activation.id)||!activation.outlet||!Array.isArray(activation.artworks))throw new Error(`Invalid public activation ${activation?.id||'<unknown>'}`);aids.add(activation.id);
      for(const artwork of activation.artworks){if(!artwork?.id||artids.has(artwork.id)||!artwork.name)throw new Error(`Invalid public artwork ${artwork?.id||'<unknown>'}`);artids.add(artwork.id)}
    }
  }
  return data
}
async function fetchPublic(){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${FNB_RPC}`,{method:'POST',headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},body:'{}'});
  if(!response.ok)throw new Error(`Supabase F&B public read HTTP ${response.status}`);
  return validate(await response.json())
}
/* A promotion id is a path segment of the share URL and a file name here. */
const safeId=id=>{const value=String(id);if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(value))throw new Error(`Promotion id "${value}" cannot be a share path`);return value};

const sharePage=(index,options)=>publicPage(index,{mode:'fnb',...options});

const [PUBLIC,index]=await Promise.all([fetchPublic(),readFile('site/index.html','utf8')]);
await rm(OUTPUT,{recursive:true,force:true});
await mkdir(join(OUTPUT,'fnb'),{recursive:true});
await writeFile(join(OUTPUT,'fnb.html'),sharePage(index,{title:`F&B Promotions | ${SITE}`,url:`${ORIGIN}/share/fnb`,description:'Food & Beverage promotions at Sindhorn Midtown Bangkok.'}));
for(const item of PUBLIC){
  const id=safeId(item.id);
  await writeFile(join(OUTPUT,'fnb',`${id}.html`),sharePage(index,{title:`${item.title} | ${SITE}`,url:`${ORIGIN}/share/fnb/${id}`,description:String(item.summary||'')||`Food & Beverage promotion at ${SITE}.`,id}));
}
console.log(JSON.stringify({generated:PUBLIC.length+1,promotions:PUBLIC.length,activations:PUBLIC.reduce((n,p)=>n+p.activations.length,0),artworkLinks:PUBLIC.reduce((n,p)=>n+p.activations.filter(a=>a.artworkUrl).length,0)}));
