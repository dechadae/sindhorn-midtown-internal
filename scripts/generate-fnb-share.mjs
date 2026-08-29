import {mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {FNB_PROMOTIONS} from '../site/fnb-data.js';

const DEFAULT_OUTPUT=process.argv[2]===undefined;
const OUTPUT=resolve(process.argv[2]||'site/share');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://sindhorn-midtown-internal.pages.dev').replace(/\/$/,'');
const SITE='Sindhorn Midtown';

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function publicPromotion(item){return Object.freeze({
  id:String(item.id),title:String(item.title),dateLabel:String(item.dateLabel),summary:String(item.summary||''),
  brief:String(item.brief||''),copyEn:String(item.copyEn||''),copyTh:String(item.copyTh||''),
  activations:item.activations.map(a=>Object.freeze({outlet:String(a.outlet||''),time:String(a.time||''),discount:String(a.discount||'')}))
})}
const PUBLIC=FNB_PROMOTIONS.map(publicPromotion);
function canonical(path){return `${ORIGIN}${path}`}
function meta(title,url,description){return `<title>${esc(title)}</title>\n<meta name="description" content="${esc(description)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:type" content="website">\n<meta property="og:url" content="${esc(url)}">\n<meta property="og:description" content="${esc(description)}">`}
function shell(title,url,description,body){return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#2E273B">\n${meta(title,url,description)}\n<link rel="stylesheet" href="/fonts.css?v=1">\n<link rel="stylesheet" href="/share/fnb-share.css?v=1">\n</head>\n<body>\n<main class="public-fnb">${body}</main>\n</body>\n</html>\n`}
function activationList(item){return `<ul class="public-fnb-facts">${item.activations.map(a=>`<li><span>Outlet</span><strong>${esc(a.outlet)}</strong><small>${esc(a.time)} · IHG One Rewards ${esc(a.discount)}</small></li>`).join('')}</ul>`}
function indexPage(){
  const title=`F&B Promotions | ${SITE}`,url=canonical('/share/fnb'),description='Food & Beverage promotions at Sindhorn Midtown Bangkok.';
  const cards=PUBLIC.map(item=>`<article class="public-fnb-card"><p class="public-fnb-label">Promotion</p><h2><a href="/share/fnb/${encodeURIComponent(item.id)}">${esc(item.title)}</a></h2><p class="public-fnb-date">${esc(item.dateLabel)}</p><p>${esc(item.summary)}</p><p class="public-fnb-outlets">${esc([...new Set(item.activations.map(a=>a.outlet))].join(' · '))}</p></article>`).join('');
  return shell(title,url,description,`<header class="public-fnb-hero"><p class="public-fnb-label">Sindhorn Midtown · Food & Beverage</p><h1>Promotions</h1><p>September – December 2026</p></header><section class="public-fnb-grid" aria-label="Promotions">${cards}</section>`)
}
function detailPage(item){
  const title=`${item.title} | ${SITE}`,url=canonical(`/share/fnb/${item.id}`),description=item.summary||`Food & Beverage promotion at ${SITE}.`;
  const thai=item.copyTh?`<section><p class="public-fnb-label">Thai copy</p><div class="public-fnb-copy" lang="th">${esc(item.copyTh)}</div></section>`:'';
  return shell(title,url,description,`<a class="public-fnb-back" href="/share/fnb">← All promotions</a><header class="public-fnb-hero"><p class="public-fnb-label">Food & Beverage promotion</p><h1>${esc(item.title)}</h1><p class="public-fnb-date">${esc(item.dateLabel)}</p><p class="public-fnb-summary">${esc(item.summary)}</p>${activationList(item)}</header><section><p class="public-fnb-label">Promotion brief</p><div class="public-fnb-copy">${esc(item.brief)}</div></section><section><p class="public-fnb-label">English copy</p><div class="public-fnb-copy">${esc(item.copyEn)}</div></section>${thai}`)
}
const CSS=`:root{font-family:var(--font-ui);color:#FAF7F5;background:#2E273B;letter-spacing:0}*{box-sizing:border-box;letter-spacing:0!important}body{margin:0;background:#2E273B;color:#FAF7F5}.public-fnb{width:min(100% - 32px,760px);margin:0 auto;padding:42px 0 64px}.public-fnb-hero{padding:18px 0 26px;border-bottom:1px solid rgba(250,247,245,.14)}.public-fnb-label{margin:0 0 10px;color:#E5ECBE;font-size:10px;text-transform:uppercase}.public-fnb h1{margin:0;font-size:clamp(36px,11vw,64px);font-weight:100;line-height:1.02}.public-fnb h2{margin:4px 0 8px;font-size:22px;font-weight:400;line-height:1.18}.public-fnb a{color:inherit}.public-fnb-grid{display:grid;gap:12px;padding-top:18px}.public-fnb-card{padding:18px;border:1px solid rgba(250,247,245,.14);border-radius:16px;background:rgba(250,247,245,.04)}.public-fnb-card p{margin:8px 0;color:rgba(250,247,245,.76);line-height:1.55}.public-fnb-date,.public-fnb-outlets{font-size:13px;color:rgba(250,247,245,.62)!important}.public-fnb-back{display:inline-block;margin-bottom:22px;font-size:13px;text-decoration:none}.public-fnb-summary{font-size:16px;line-height:1.55;color:rgba(250,247,245,.82)}.public-fnb-facts{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:1px}.public-fnb-facts li{padding:12px 0;border-top:1px solid rgba(250,247,245,.12)}.public-fnb-facts span,.public-fnb-facts strong,.public-fnb-facts small{display:block}.public-fnb-facts span{font-size:9px;text-transform:uppercase;color:rgba(250,247,245,.5)}.public-fnb-facts strong{margin-top:3px;font-size:14px;font-weight:400}.public-fnb-facts small{margin-top:3px;color:rgba(250,247,245,.62)}.public-fnb section{padding:26px 0;border-bottom:1px solid rgba(250,247,245,.12)}.public-fnb-copy{white-space:pre-line;font-size:14px;line-height:1.7;color:rgba(250,247,245,.82)}@media(min-width:680px){.public-fnb-grid{grid-template-columns:1fr 1fr}}`;

await rm(OUTPUT,{recursive:true,force:true});await mkdir(OUTPUT,{recursive:true});
if(DEFAULT_OUTPUT){
  await writeFile(join(OUTPUT,'fnb.html'),indexPage());
  await writeFile(join(OUTPUT,'fnb-share.css'),CSS);
  const detailDir=join(OUTPUT,'fnb');await mkdir(detailDir,{recursive:true});
  for(const item of PUBLIC)await writeFile(join(detailDir,`${item.id}.html`),detailPage(item));
}else{
  await writeFile(join(OUTPUT,'index.html'),indexPage());await writeFile(join(OUTPUT,'share.css'),CSS);
  for(const item of PUBLIC){const dir=join(OUTPUT,item.id);await mkdir(dir,{recursive:true});await writeFile(join(dir,'index.html'),detailPage(item))}
}
console.log(`generated ${PUBLIC.length+1} public F&B share pages at ${OUTPUT}`);
