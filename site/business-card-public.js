import {businessCardUrl,businessCardVcfUrl,isBusinessCardSlug,primaryPhone} from './business-card-core.js';
import {qrSvg} from './qr-v6.js';

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const HOTEL_NAME='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
const HOTEL_LOGO='/assets/brand/sindhorn-midtown-vignette-white.png';
const root=document.querySelector('[data-business-card-root]');
const slug=location.pathname.replace(/^\/+|\/+$/g,'').replace(/\.vcf$/,'').toLowerCase();
let card=null,statusTimer=0;

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function telHref(value){const raw=String(value||'').trim();if(!raw)return'';const prefix=raw.startsWith('+')?'+':'';return`tel:${prefix}${raw.replace(/\D/g,'')}`}
function emailHref(value){return value?`mailto:${encodeURIComponent(String(value).trim())}`:''}
function safeLogoPath(value){const path=String(value||'');return /^\/assets\/brand\/[a-z0-9._-]+$/i.test(path)?path:HOTEL_LOGO}
function bootstrapCard(){const node=document.getElementById('businessCardBootstrap');if(!node)return null;try{return JSON.parse(node.textContent||'null')}catch(_){return null}}
async function fetchPublicCard(){try{const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/sindhorn_public_business_card`,{method:'POST',headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},body:JSON.stringify({p_slug:slug}),cache:'no-store'});if(!response.ok)return null;return await response.json()}catch(_){return null}}
async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch(_){}const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}area.remove();return ok}
function showStatus(message){const node=root?.querySelector('[data-card-status]');if(!node)return;node.textContent=message;node.dataset.show='true';clearTimeout(statusTimer);statusTimer=setTimeout(()=>{node.dataset.show='false'},1800)}
function unavailable(){if(!root)return;root.innerHTML=`<section class="public-card-unavailable"><p class="public-card-kicker">Business card</p><h1>Card unavailable</h1><p>This business card is not published or is no longer active.</p><span>${esc(HOTEL_NAME)}</span></section>`}
function detail(label,value,href=''){if(!value)return'';const body=href?`<a href="${esc(href)}">${esc(value)}</a>`:`<b>${esc(value)}</b>`;return`<div class="public-card-detail"><span>${esc(label)}</span>${body}</div>`}

function render(){
  if(!root||!card){unavailable();return}
  const phone=primaryPhone(card),call=telHref(phone),email=emailHref(card.workEmail),url=businessCardUrl(location.origin,card.slug),vcfUrl=businessCardVcfUrl(location.origin,card.slug),logo=safeLogoPath(card.hotelLogoPath);
  let qr='';
  try{qr=qrSvg(url,{foreground:'#17131F',background:'#FFFFFF',quiet:4}).replace('One-time sign-in QR code','Business card QR code')}catch(_){qr='<span class="public-card-qr-error">QR unavailable</span>'}
  root.innerHTML=`<section class="public-card-panel" aria-labelledby="publicCardName">
    <header class="public-card-head">
      <p class="public-card-kicker">Digital business card</p>
      <h1 id="publicCardName">${esc(card.displayName).toUpperCase()}</h1>
      ${card.positionTitle?`<p class="public-card-title">${esc(card.positionTitle)}</p>`:''}
      <p class="public-card-hotel">${esc(card.hotelName||HOTEL_NAME)}</p>
    </header>
    <div class="public-card-qr" data-card-qr>${qr}</div>
    <div class="public-card-logo-wrap"><img class="public-card-logo" src="${esc(logo)}" alt="${esc(card.hotelName||HOTEL_NAME)}"></div>
    <div class="public-card-details">
      ${detail('Work email',card.workEmail,email)}
      ${detail('Business mobile',card.businessMobile,telHref(card.businessMobile))}
      ${detail('Direct phone',card.directPhone,telHref(card.directPhone))}
      ${detail('Hotel telephone',card.hotelMainPhone,telHref(card.hotelMainPhone))}
      ${detail('Hotel address',card.hotelAddress)}
      ${detail('Hotel website',card.hotelWebsite,card.hotelWebsite)}
    </div>
    <div class="public-card-actions">
      <a class="public-card-action" href="${esc(vcfUrl)}" data-add-contact>Add to contacts</a>
      ${call?'<a class="public-card-action" data-call>Call</a>':''}
      ${email?'<a class="public-card-action" data-email>Email</a>':''}
      <button class="public-card-action" type="button" data-share-card>Share</button>
    </div>
    <p class="public-card-status" data-card-status role="status" aria-live="polite"></p>
    <footer><span>${esc(url.replace(/^https?:\/\//,''))}</span></footer>
  </section>`;
  const callNode=root.querySelector('[data-call]');if(callNode)callNode.href=call;
  const emailNode=root.querySelector('[data-email]');if(emailNode)emailNode.href=email;
}

async function shareCard(){
  const url=businessCardUrl(location.origin,card.slug),title=`${card.displayName} | ${card.hotelName}`,text=[card.displayName,card.positionTitle,card.hotelName].filter(Boolean).join(' · ');
  if(typeof navigator.share==='function'){try{await navigator.share({title,text,url});return}catch(error){if(error?.name==='AbortError')return}}
  showStatus(await copyText(url)?'Link copied':'Copy link failed');
}
async function load(){if(!isBusinessCardSlug(slug)){unavailable();return}card=bootstrapCard()||await fetchPublicCard();if(!card){unavailable();return}render()}
root?.addEventListener('click',event=>{if(event.target.closest('[data-share-card]'))void shareCard()});
load();
