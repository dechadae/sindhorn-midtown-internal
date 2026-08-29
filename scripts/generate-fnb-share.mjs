import {mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {FNB_PROMOTIONS} from '../site/fnb-data.js';

const OUTPUT=resolve(process.argv[2]||'site/share');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://sindhorn-midtown-internal.pages.dev').replace(/\/$/,'');
const SITE='Sindhorn Midtown';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safePromotion=item=>({
  id:String(item.id),title:String(item.title),start:String(item.start),end:String(item.end),dateLabel:String(item.dateLabel),summary:String(item.summary||''),brief:String(item.brief||''),copyEn:String(item.copyEn||''),copyTh:String(item.copyTh||''),
  activations:(item.activations||[]).map(a=>({id:String(a.id||''),outlet:String(a.outlet||''),time:String(a.time||''),discount:String(a.discount||''),brief:String(a.brief||''),copyEn:String(a.copyEn||''),copyTh:String(a.copyTh||''),artworks:(a.artworks||[]).map(x=>({id:String(x.id||''),name:String(x.name||'')}))}))
});
const PUBLIC=FNB_PROMOTIONS.map(safePromotion);
const meta=(title,url,description)=>`<title>${esc(title)}</title>\n<meta name="description" content="${esc(description)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:type" content="website">\n<meta property="og:url" content="${esc(url)}">\n<meta property="og:description" content="${esc(description)}">`;
const shell=(title,url,description,id='')=>`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2E273B">
<meta name="color-scheme" content="dark">
${meta(title,url,description)}
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/line-seed-sans-th-regular.woff2">
<link rel="preload" as="image" href="/assets/brand/sindhorn-midtown-vignette-white.png">
<link rel="stylesheet" href="/fonts.css?v=1">
<link rel="stylesheet" href="/environment.css?v=2">
<link rel="stylesheet" href="/fnb.css?v=2&ui=2">
<link rel="stylesheet" href="/fnb-approved-polish.css?v=2">
<link rel="stylesheet" href="/fnb-refinements.css?v=1">
<link rel="stylesheet" href="/share/fnb-public.css?v=2">
</head>
<body data-route="fnb" data-fnb-public="true"${id?` data-public-promotion="${esc(id)}"`:''}>
<div class="environment-stage" id="environmentStage" hidden aria-hidden="true"><canvas class="environment-canvas" id="environmentCanvas"></canvas></div>
<header class="public-app-header"><img src="/assets/brand/sindhorn-midtown-vignette-white.png" alt="Sindhorn Midtown · Vignette Collection"></header>
<main id="route-view" aria-live="polite"></main>
<script type="module" src="/share/fnb-public-shell.js?v=2"></script>
</body>
</html>\n`;

await rm(OUTPUT,{recursive:true,force:true});
await mkdir(join(OUTPUT,'fnb'),{recursive:true});

await writeFile(join(OUTPUT,'fnb-public-data.js'),`export const FNB_PROMOTIONS=${JSON.stringify(PUBLIC)};\n`);

let runtime=await readFile('site/fnb.js','utf8');
runtime=runtime.replace("import {FNB_PROMOTIONS as DATA} from './fnb-data.js';","import {FNB_PROMOTIONS as DATA} from './fnb-public-data.js';");
runtime=runtime.replace(/^const STATE_KEY=.*\n/m,'');
runtime=runtime.replace(/const editor=String\(profile\?\.employee_number\|\|''\)==='10639';/,'const editor=false;');
runtime=runtime.replace(/let state=\{checks:\{\},links:\{\}\};\s*try\{const saved=JSON\.parse\(localStorage\.getItem\([^\n]+?\}\s*catch\(_\)\{\}/s,'let state={checks:{},links:{}};');
runtime=runtime.replace(/function save\(\)\{try\{localStorage\.setItem\([^\n]+?\}\s*catch\(_\)\{\}\}/s,'function save(){}');
if(runtime.includes('sindhorn-midtown:fnb-local'))throw new Error('public runtime still references private F&B local state');
await writeFile(join(OUTPUT,'fnb-runtime.js'),runtime);

let shareUi=await readFile('site/fnb-share-ui.js','utf8');
shareUi=shareUi.replace("import {FNB_PROMOTIONS as DATA} from './fnb-data.js';","import {FNB_PROMOTIONS as DATA} from './fnb-public-data.js';");
await writeFile(join(OUTPUT,'fnb-share-ui-public.js'),shareUi);

const css=`:root{--sm-text:#FAF7F5;--sm-gutter:20px;--public-header-h:84px}html,body{min-height:100%;margin:0;background:#2E273B;color:var(--sm-text);letter-spacing:0!important}html{-webkit-tap-highlight-color:transparent}body[data-fnb-public="true"]{overflow-x:hidden}body[data-fnb-public="true"] *,body[data-fnb-public="true"] *::before,body[data-fnb-public="true"] *::after{-webkit-tap-highlight-color:transparent!important}body[data-fnb-public="true"] button,body[data-fnb-public="true"] a{-webkit-appearance:none;appearance:none}body[data-fnb-public="true"] button:focus:not(:focus-visible),body[data-fnb-public="true"] a:focus:not(:focus-visible){outline:none!important;box-shadow:none!important}.environment-stage{position:fixed!important;inset:0!important;z-index:0!important}.public-app-header{position:relative;z-index:20;height:var(--public-header-h);box-sizing:border-box;padding:10px var(--sm-gutter);display:flex;align-items:center;background:#2E273B;border-bottom:1px solid rgba(250,247,245,.08)}.public-app-header img{display:block;width:116px;height:auto;object-fit:contain}body[data-fnb-public="true"] #route-view{position:relative;z-index:2;box-sizing:border-box;min-height:calc(100dvh - var(--public-header-h));padding:0 var(--sm-gutter) max(38px,env(safe-area-inset-bottom));background:transparent}body[data-fnb-public="true"] .fnb-route{min-height:calc(100dvh - var(--public-header-h))}body[data-fnb-public="true"] .fnb-task-toggle{display:none!important}body[data-fnb-public="true"] .fnb-task{grid-template-columns:minmax(0,1fr)!important;padding-left:0!important}body[data-fnb-public="true"] [data-folder-edit],body[data-fnb-public="true"] [data-folder-open],body[data-fnb-public="true"] [data-save-links],body[data-fnb-public="true"] .fnb-sheet-layer{display:none!important}body[data-fnb-public="true"] .fnb-section-rail{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}body[data-fnb-public="true"][data-fnb-detail="true"] #route-view{padding-bottom:max(38px,env(safe-area-inset-bottom))!important}body[data-fnb-public="true"] .fnb-back,body[data-fnb-public="true"] .fnb-action-control,body[data-fnb-public="true"] .fnb-chip{color:inherit}body[data-fnb-public="true"] .fnb-back:active,body[data-fnb-public="true"] .fnb-action-control:active{outline:none!important;box-shadow:none!important}@media(min-width:700px){:root{--sm-gutter:32px}.public-app-header img{width:116px}body[data-fnb-public="true"] #route-view{max-width:760px;margin:0 auto}}`;
await writeFile(join(OUTPUT,'fnb-public.css'),css);

const publicShell=`import {initEnvironment} from '/environment.js';\nimport {mountFnbRoute} from './fnb-runtime.js';\nimport './fnb-share-ui-public.js';\ndocument.body.dataset.route='fnb';\nawait initEnvironment();\nconst root=document.getElementById('route-view');\nawait mountFnbRoute(root,{profile:null});\ndocument.dispatchEvent(new CustomEvent('sindhorn:route-mounted',{detail:{route:'fnb',public:true}}));\nconst id=document.body.dataset.publicPromotion||'';\nif(id){await new Promise(requestAnimationFrame);const opener=root.querySelector('[data-open="'+CSS.escape(id)+'"]');if(opener)opener.click();}\n`;
await writeFile(join(OUTPUT,'fnb-public-shell.js'),publicShell);

await writeFile(join(OUTPUT,'fnb.html'),shell(`F&B Promotions | ${SITE}`,`${ORIGIN}/share/fnb`,'Food & Beverage promotions at Sindhorn Midtown Bangkok.'));
for(const item of PUBLIC){const title=`${item.title} | ${SITE}`,url=`${ORIGIN}/share/fnb/${item.id}`,description=item.summary||`Food & Beverage promotion at ${SITE}.`;await writeFile(join(OUTPUT,'fnb',`${item.id}.html`),shell(title,url,description,item.id))}
console.log(`generated ${PUBLIC.length+1} public F&B share documents using the authenticated F&B runtime`);
