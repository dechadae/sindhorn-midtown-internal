import {createHash} from 'node:crypto';
import {mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const OUTPUT=resolve(process.argv[2]||'site/share');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://sindhorn-midtown-internal.pages.dev').replace(/\/$/,'');
const SITE='Sindhorn Midtown';
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const FNB_RPC='sindhorn_fnb_public_read_model';
const PACK_TABLE='sindhorn_app_files';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha256=value=>createHash('sha256').update(value).digest('hex');

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
async function supabase(path,options={}){
  const headers={apikey:SUPABASE_KEY,...options.headers};
  return fetch(`${SUPABASE_URL}${path}`,{...options,headers})
}
async function fetchPublic(){
  const response=await supabase(`/rest/v1/rpc/${FNB_RPC}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  if(!response.ok)throw new Error(`Supabase F&B public read HTTP ${response.status}`);
  return validate(await response.json())
}
async function fetchLivePresentation(){
  const latest=await supabase(`/rest/v1/${PACK_TABLE}?select=pack_id&enabled=eq.true&order=pack_id.desc&limit=1`,{cache:'no-store'});
  if(!latest.ok)throw new Error(`Supabase presentation lookup HTTP ${latest.status}`);
  const latestRows=await latest.json(),packId=Number(latestRows?.[0]?.pack_id);
  if(!Number.isInteger(packId)||packId<1)throw new Error('No enabled Sindhorn presentation pack');
  const response=await supabase(`/rest/v1/${PACK_TABLE}?select=pack_id,path,content,content_type,content_sha256,enabled&pack_id=eq.${packId}&enabled=eq.true&order=path.asc`,{cache:'no-store'});
  if(!response.ok)throw new Error(`Supabase presentation pack HTTP ${response.status}`);
  const rows=await response.json(),map=Object.fromEntries(rows.map(row=>[row.path,row]));
  for(const path of ['header.html','ui.css']){
    const row=map[path];
    if(!row||typeof row.content!=='string'||sha256(row.content)!==row.content_sha256)throw new Error(`Invalid live presentation resource ${path}`)
  }
  return{packId,header:map['header.html'].content,uiCss:map['ui.css'].content}
}
function safePromotion(item){return{
  id:String(item.id),title:String(item.title),start:String(item.start),end:String(item.end),dateLabel:String(item.dateLabel||''),summary:String(item.summary||''),brief:String(item.brief||''),copyEn:String(item.copyEn||''),copyTh:String(item.copyTh||''),updatedAt:String(item.updatedAt||''),displayOutlets:Array.isArray(item.displayOutlets)?item.displayOutlets.map(String):[],
  activations:(item.activations||[]).map(a=>({id:String(a.id||''),outlet:String(a.outlet||''),time:String(a.time||''),discount:String(a.discount||''),brief:String(a.brief||''),copyEn:String(a.copyEn||''),copyTh:String(a.copyTh||''),artworkUrl:a.artworkUrl?String(a.artworkUrl):null,artworks:(a.artworks||[]).map(x=>({id:String(x.id||''),name:String(x.name||''),dimensions:x.dimensions?String(x.dimensions):null,notes:x.notes?String(x.notes):null}))}))
}}
const [PUBLIC_RAW,LIVE_PACK]=await Promise.all([fetchPublic(),fetchLivePresentation()]);
const PUBLIC=PUBLIC_RAW.map(safePromotion);
const meta=(title,url,description)=>`<title>${esc(title)}</title>\n<meta name="description" content="${esc(description)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:type" content="website">\n<meta property="og:url" content="${esc(url)}">\n<meta property="og:description" content="${esc(description)}">`;

/* Same masthead/brand structure as the authenticated pack, intentionally without the
   employee tools block. The live Pack CSS below owns all header geometry. */
const header=`<header id="app-header"><div class="masthead" role="banner"><div class="masthead-inner"><div class="brand-lockup"><span class="screen-reader" role="img" aria-label="Sindhorn Midtown Hotel Bangkok, Vignette Collection"></span><img class="logo-light" src="/assets/brand/sindhorn-midtown-vignette-black.png" width="1200" height="600" alt="" aria-hidden="true"><img class="logo-dark" src="/assets/brand/sindhorn-midtown-vignette-white.png" width="1200" height="600" alt="" aria-hidden="true"></div></div><div class="fg-progress-rule" aria-hidden="true"><i></i></div></div></header>`;
const shell=(title,url,description,id='')=>`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2E273B">
<meta name="color-scheme" content="dark">
${meta(title,url,description)}
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-regular.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-thin.woff2">
<link rel="preload" as="image" href="/assets/brand/sindhorn-midtown-vignette-white.png">
<link rel="stylesheet" href="/fonts.css?v=1">
<link rel="stylesheet" href="/shell.css?v=3">
<link rel="stylesheet" href="/environment.css?v=2">
<link rel="stylesheet" href="/fnb-approved-polish.css?v=2">
<link rel="stylesheet" href="/fnb-refinements.css?v=1">
<link rel="stylesheet" href="/fnb-layout-stability.css?v=1">
<link rel="stylesheet" href="/share/fnb-live-pack.css?v=${LIVE_PACK.packId}">
<link rel="stylesheet" href="/share/fnb-public.css?v=7">
</head>
<body data-route="fnb" data-fnb-public="true" data-presentation-pack="${LIVE_PACK.packId}"${id?` data-public-promotion="${esc(id)}"`:''}>
<div class="environment-stage" id="environmentStage" hidden aria-hidden="true"><canvas class="environment-canvas" id="environmentCanvas"></canvas></div>
${header}
<main id="route-view" aria-live="polite"></main>
<script type="module" src="/share/fnb-public-shell.js?v=9"></script>
</body>
</html>\n`;

await rm(OUTPUT,{recursive:true,force:true});
await mkdir(join(OUTPUT,'fnb'),{recursive:true});
await writeFile(join(OUTPUT,'fnb-live-pack.css'),LIVE_PACK.uiCss);

const publicData=`const SUPABASE_URL=${JSON.stringify(SUPABASE_URL)};\nconst SUPABASE_KEY=${JSON.stringify(SUPABASE_KEY)};\nconst SNAPSHOT=${JSON.stringify(PUBLIC)};\nfunction valid(data){return Array.isArray(data)&&data.length>0&&data.every(p=>p&&p.id&&p.title&&Array.isArray(p.activations));}\nfunction parseUpdated(value){const text=String(value||'').trim();if(!text)return null;const zoned=/(?:z|[+-]\\d\\d:?\\d\\d)$/i.test(text)?text:text+'+07:00';const date=new Date(zoned);return Number.isNaN(date.valueOf())?null:date;}\nfunction latestUpdated(data){let latest=null;for(const item of data||[]){const date=parseUpdated(item?.updatedAt);if(date&&(!latest||date>latest))latest=date}return latest?latest.toISOString():null;}\nasync function live(){try{const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/${FNB_RPC}',{method:'POST',cache:'no-store',headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},body:'{}'});if(!r.ok)return null;const d=await r.json();return valid(d)?d:null}catch(_){return null}}\nexport const FNB_PROMOTIONS=(await live())||SNAPSHOT;\nexport const FNB_DATA_UPDATED_AT=latestUpdated(FNB_PROMOTIONS);\n`;
await writeFile(join(OUTPUT,'fnb-public-data.js'),publicData);

/* Public renderer is the authenticated renderer with only persistence/edit capability removed. */
let runtime=await readFile('site/fnb.js','utf8');
runtime=runtime.replace("import {FNB_PROMOTIONS as DATA} from './fnb-data.js';","import {FNB_PROMOTIONS as DATA} from './fnb-public-data.js';");
runtime=runtime.replace(/^const STATE_KEY=.*\n/m,'');
runtime=runtime.replace(/const editor=String\(profile\?\.employee_number\|\|''\)==='10639';/,'const editor=false;');
runtime=runtime.replace(/let state=\{checks:\{\},links:\{\}\};\s*try\{const saved=JSON\.parse\(localStorage\.getItem\([^\n]+?\}\s*catch\(_\)\{\}/s,'let state={checks:{},links:{}};');
runtime=runtime.replace(/function save\(\)\{try\{localStorage\.setItem\([^\n]+?\}\s*catch\(_\)\{\}\}/s,'function save(){}');
if(runtime.includes('sindhorn-midtown:fnb-local'))throw new Error('public runtime still references private F&B local state');
await writeFile(join(OUTPUT,'fnb-runtime.js'),runtime);

/* Keep the same asynchronous Share placement as live. The card action row it creates is
   intentionally hidden by the public-only CSS, while hero/detail Share remains live-parity. */
let shareUi=await readFile('site/fnb-share-ui.js','utf8');
shareUi=shareUi.replace("import {FNB_PROMOTIONS as DATA} from './fnb-data.js';","import {FNB_PROMOTIONS as DATA} from './fnb-public-data.js';");
await writeFile(join(OUTPUT,'fnb-share-ui-public.js'),shareUi);

/* Public-only delta. Everything visual above this layer is the current live pack + the
   exact authenticated F&B styles. We remove only private/edit surfaces and the two
   footer surfaces requested for read-only sharing: app footer and card action footer. */
const css=`body[data-fnb-public="true"]{padding-bottom:0!important;overflow-x:hidden!important}
body[data-fnb-public="true"] #app-footer,body[data-fnb-public="true"] .app-tabbar{display:none!important}
body[data-fnb-public="true"] .masthead-user,body[data-fnb-public="true"] .masthead-tools{display:none!important}
body[data-fnb-public="true"] #route-view{min-height:calc(100dvh - 54px)!important;padding-bottom:max(38px,env(safe-area-inset-bottom))!important;background:transparent!important}
body[data-fnb-public="true"] .fnb-route{min-height:calc(100dvh - 54px)}
body[data-fnb-public="true"] button,body[data-fnb-public="true"] a{-webkit-appearance:none;appearance:none}
body[data-fnb-public="true"] button:focus:not(:focus-visible),body[data-fnb-public="true"] a:focus:not(:focus-visible){outline:none!important;box-shadow:none!important}
body[data-fnb-public="true"] .fnb-task-toggle{display:none!important}
body[data-fnb-public="true"] .fnb-task{grid-template-columns:minmax(0,1fr)!important;padding-left:0!important}
body[data-fnb-public="true"] [data-folder-edit],body[data-fnb-public="true"] [data-save-links]{display:none!important}
body[data-fnb-public="true"] .fnb-section-rail{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
body[data-fnb-public="true"] .fnb-card-actions{display:none!important}
body[data-fnb-public="true"] .fnb-card-button{padding-bottom:16px!important}
body[data-fnb-public="true"][data-fnb-detail="true"] #route-view{padding-bottom:max(38px,env(safe-area-inset-bottom))!important}
body[data-fnb-public="true"] .fnb-back,body[data-fnb-public="true"] .fnb-action-control,body[data-fnb-public="true"] .fnb-chip{color:inherit}
body[data-fnb-public="true"] .fnb-back:active,body[data-fnb-public="true"] .fnb-action-control:active{outline:none!important;box-shadow:none!important}
body[data-fnb-public="true"] .fnb-data-updated{font-size:12px;line-height:1.35;opacity:.72;margin:5px 0 0;letter-spacing:0!important}
`;
await writeFile(join(OUTPUT,'fnb-public.css'),css);

const publicShell=`import {initEnvironment} from '/environment.js';\nimport {mountFnbRoute} from './fnb-runtime.js';\nimport {FNB_PROMOTIONS,FNB_DATA_UPDATED_AT} from './fnb-public-data.js';\nimport './fnb-share-ui-public.js?v=4';\nfunction formatParts(value){if(!value)return null;const date=new Date(value);if(Number.isNaN(date.valueOf()))return null;const day=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(date);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'numeric',minute:'2-digit',hour12:true}).format(date).toLowerCase();return{day,time,index:'Updated '+day+' · '+time,detail:day+' · '+time};}\nfunction patchFreshness(root){const global=formatParts(FNB_DATA_UPDATED_AT),period=root.querySelector('.fnb-period');if(period&&global){let stamp=period.parentElement?.querySelector('[data-fnb-data-updated]');if(!stamp){stamp=document.createElement('div');stamp.className='fnb-data-updated';stamp.dataset.fnbDataUpdated='true';period.insertAdjacentElement('afterend',stamp)}if(stamp.textContent!==global.index)stamp.textContent=global.index;}const title=root.querySelector('.fnb-detail:not([hidden]) .fnb-detail-title')?.textContent?.trim();if(!title)return;const requested=document.body.dataset.publicPromotion||'';const item=FNB_PROMOTIONS.find(p=>p.id===requested)||FNB_PROMOTIONS.find(p=>p.title===title);const current=formatParts(item?.updatedAt||FNB_DATA_UPDATED_AT);if(!current)return;for(const fact of root.querySelectorAll('.fnb-detail:not([hidden]) .fnb-fact')){if(fact.querySelector('span')?.textContent?.trim()!=='Updated')continue;const value=fact.querySelector('b');if(value&&value.textContent!==current.detail){value.textContent=current.detail;value.dataset.fnbPublicUpdated='true';}}}\ndocument.body.dataset.route='fnb';\nawait initEnvironment();\nconst root=document.getElementById('route-view');\nawait mountFnbRoute(root,{profile:null});\npatchFreshness(root);\nconst freshnessObserver=new MutationObserver(()=>patchFreshness(root));freshnessObserver.observe(root,{childList:true,subtree:true});\ndocument.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:'fnb',public:true}}));\nconst id=document.body.dataset.publicPromotion||'';\nif(id){await new Promise(requestAnimationFrame);const opener=root.querySelector('[data-open="'+CSS.escape(id)+'"]');if(opener)opener.click();}\n`;
await writeFile(join(OUTPUT,'fnb-public-shell.js'),publicShell);

await writeFile(join(OUTPUT,'fnb.html'),shell(`F&B Promotions | ${SITE}`,`${ORIGIN}/share/fnb`,'Food & Beverage promotions at Sindhorn Midtown Bangkok.'));
for(const item of PUBLIC){const title=`${item.title} | ${SITE}`,url=`${ORIGIN}/share/fnb/${item.id}`,description=item.summary||`Food & Beverage promotion at ${SITE}.`;await writeFile(join(OUTPUT,'fnb',`${item.id}.html`),shell(title,url,description,item.id))}
console.log(JSON.stringify({generated:PUBLIC.length+1,promotions:PUBLIC.length,activations:PUBLIC.reduce((n,p)=>n+p.activations.length,0),artworks:PUBLIC.reduce((n,p)=>n+p.activations.reduce((m,a)=>m+a.artworks.length,0),0),artworkLinks:PUBLIC.reduce((n,p)=>n+p.activations.filter(a=>a.artworkUrl).length,0),presentationPack:LIVE_PACK.packId}));
