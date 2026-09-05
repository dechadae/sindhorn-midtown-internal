/* The public F&B share, generated at deploy (r30): /share/fnb and
   /share/fnb/<id> are the app shell itself, in public mode.

   Each page is site/index.html with three changes and nothing else: the
   masthead tools and the navbar are gone (the logo stays as a mark, not a
   button), the PWA identity is not offered (a shared page is not the app),
   and the head carries the promotion's own title, description, canonical
   and Open Graph tags, read from the public read model so a link unfurls
   before any script runs. <body data-public="fnb"> is what shell.js reads
   to run in public mode. The share therefore renders from the same
   stylesheets, atmosphere and page module as the app, and a shell release
   is a share release. Nothing is read from sindhorn_app_files any more;
   that pack was the legacy presentation and is retired.

     node scripts/generate-fnb-share.mjs [site/share]
     PUBLIC_ORIGIN=https://... to stamp another origin into the canonical URLs. */
import {mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const OUTPUT=resolve(process.argv[2]||'site/share');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://sindhorn-midtown-internal.pages.dev').replace(/\/$/,'');
const SITE='Sindhorn Midtown';
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const FNB_RPC='sindhorn_fnb_public_read_model';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

const meta=(title,url,description)=>[
  `<title>${esc(title)}</title>`,
  `<meta name="description" content="${esc(description)}">`,
  `<link rel="canonical" href="${esc(url)}">`,
  `<meta property="og:site_name" content="${esc(SITE)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${esc(url)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta name="twitter:card" content="summary">`
].join('\n');

/* One transformation of the shell document, each step asserted so a shell
   edit that moves what this relies on fails the build rather than shipping
   a share page with the app's tools on it. */
function cut(html,pattern,replacement,what){const next=html.replace(pattern,replacement);if(next===html)throw new Error(`index.html: ${what} not found`);return next}
function sharePage(index,{title,url,description,id=''}){
  let html=index;
  html=cut(html,/<title>[^<]*<\/title>\n<meta name="description"[^>]*>/,meta(title,url,description),'title and description');
  html=cut(html,/<meta name="robots"[^>]*>\n/,'','robots');
  html=cut(html,/<!-- PWA identity[\s\S]*?<link rel="apple-touch-icon"[^>]*>\n/,`<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-192.png?v=2">\n`,'PWA identity block');
  html=cut(html,/<link rel="preconnect" href="https:\/\/sindhorn-midtown-alerts[^>]*>\n/,'','alerts preconnect');
  html=cut(html,/<link rel="modulepreload" href="\/notification-inbox\.js">\n<link rel="modulepreload" href="\/broadcast-inbox\.js">\n/,'','inbox preloads');
  html=cut(html,/<body>/,`<body data-public="fnb"${id?` data-public-id="${esc(id)}"`:''}>`,'body');
  html=cut(html,/<button class="app-masthead-home" type="button" aria-label="Home">([\s\S]*?)<\/button>/,'<div class="app-masthead-home">$1</div>','masthead home');
  html=cut(html,/\n  <div class="app-masthead-tools">[\s\S]*?\n  <\/div>\n/,'\n','masthead tools');
  html=cut(html,/<nav class="app-navbar"[\s\S]*?<\/nav>\n\n/,'','navbar');
  for(const forbidden of ['app-navbar','app-masthead-account','data-masthead-route','rel="manifest"','apple-mobile-web-app'])if(html.includes(forbidden))throw new Error(`share page still carries ${forbidden}`);
  return html
}

const [PUBLIC,index]=await Promise.all([fetchPublic(),readFile('site/index.html','utf8')]);
await rm(OUTPUT,{recursive:true,force:true});
await mkdir(join(OUTPUT,'fnb'),{recursive:true});
await writeFile(join(OUTPUT,'fnb.html'),sharePage(index,{title:`F&B Promotions | ${SITE}`,url:`${ORIGIN}/share/fnb`,description:'Food & Beverage promotions at Sindhorn Midtown Bangkok.'}));
for(const item of PUBLIC){
  const id=safeId(item.id);
  await writeFile(join(OUTPUT,'fnb',`${id}.html`),sharePage(index,{title:`${item.title} | ${SITE}`,url:`${ORIGIN}/share/fnb/${id}`,description:String(item.summary||'')||`Food & Beverage promotion at ${SITE}.`,id}));
}
console.log(JSON.stringify({generated:PUBLIC.length+1,promotions:PUBLIC.length,activations:PUBLIC.reduce((n,p)=>n+p.activations.length,0),artworkLinks:PUBLIC.reduce((n,p)=>n+p.activations.filter(a=>a.artworkUrl).length,0)}));
