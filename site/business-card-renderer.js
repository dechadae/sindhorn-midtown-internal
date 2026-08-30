import {businessCardUrl,businessCardVcfUrl,primaryPhone} from './business-card-core.js';
import {qrStyledSvg} from './qr-v6.js?v=2';

export const BUSINESS_CARD_HOTEL_NAME='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
export const BUSINESS_CARD_HOTEL_LOGO='/assets/brand/sindhorn-midtown-vignette-white.png';

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function telHref(value){const raw=String(value||'').trim();if(!raw)return'';const prefix=raw.startsWith('+')?'+':'';return`tel:${prefix}${raw.replace(/\D/g,'')}`}
function emailHref(value){return value?`mailto:${encodeURIComponent(String(value).trim())}`:''}
function safeLogoPath(value){const path=String(value||'');return /^\/assets\/brand\/[a-z0-9._-]+$/i.test(path)?path:BUSINESS_CARD_HOTEL_LOGO}
function hotelNameHtml(value){const name=String(value||BUSINESS_CARD_HOTEL_NAME).trim(),comma=name.indexOf(',');return comma<0?esc(name):`${esc(name.slice(0,comma+1))}<br>${esc(name.slice(comma+1).trim())}`}
function websiteLabel(value){try{return new URL(value).hostname.replace(/^www\./,'')||'Hotel website'}catch(_){return'Hotel website'}}
function balancedNameHtml(value){
  const name=String(value||'').trim().toUpperCase(),words=name.split(/\s+/).filter(Boolean);
  if(words.length<2||name.length<=18)return esc(name);
  let split=1,best=Infinity;
  for(let index=1;index<words.length;index+=1){const left=words.slice(0,index).join(' '),right=words.slice(index).join(' '),delta=Math.abs(left.length-right.length);if(delta<best){best=delta;split=index}}
  return`${esc(words.slice(0,split).join(' '))}<br>${esc(words.slice(split).join(' '))}`;
}
function detail(label,value,href='',displayValue=value){if(!value)return'';const body=href?`<a href="${esc(href)}">${esc(displayValue)}</a>`:`<b>${esc(displayValue)}</b>`;return`<div class="public-card-detail"><span>${esc(label)}</span>${body}</div>`}

export function normalizeSelfBusinessCard(data){
  const card=data?.card||{},hotel=data?.hotel||{},vis=card.fieldVisibility||{};
  return{
    slug:card.publicSlug||card.slug||'',
    displayName:card.displayName||'',
    positionTitle:vis.positionTitle===false?null:card.positionTitle,
    workEmail:vis.workEmail===false?null:card.workEmail,
    businessMobile:vis.businessMobile===false?null:card.businessMobile,
    directPhone:vis.directPhone===false?null:card.directPhone,
    hotelName:hotel.hotelName||BUSINESS_CARD_HOTEL_NAME,
    hotelMainPhone:vis.hotelPhone===false?null:hotel.hotelMainPhone,
    hotelAddress:vis.hotelAddress===false?null:hotel.hotelAddress,
    hotelWebsite:vis.hotelWebsite===false?null:hotel.hotelWebsite,
    hotelLogoPath:hotel.hotelLogoPath||BUSINESS_CARD_HOTEL_LOGO
  };
}

export function renderBusinessCardMarkup(card,{origin=location.origin,closeMarkup=''}={}){
  const phone=primaryPhone(card),call=telHref(phone),email=emailHref(card.workEmail),url=businessCardUrl(origin,card.slug),vcfUrl=businessCardVcfUrl(origin,card.slug),hotelName=card.hotelName||BUSINESS_CARD_HOTEL_NAME,logo=safeLogoPath(card.hotelLogoPath);
  let qr='';try{qr=qrStyledSvg(url)}catch(_){qr='<span class="public-card-qr-error">QR unavailable</span>'}
  return`<section class="public-card-panel" aria-labelledby="publicCardName">
    ${closeMarkup}
    <header class="public-card-head">
      <p class="public-card-kicker">Digital business card</p>
      <h1 id="publicCardName">${balancedNameHtml(card.displayName)}</h1>
      ${card.positionTitle?`<p class="public-card-title">${esc(card.positionTitle)}</p>`:''}
      <p class="public-card-hotel">${hotelNameHtml(hotelName)}</p>
    </header>
    <div class="public-card-qr" data-card-qr>${qr}</div>
    <div class="public-card-logo-wrap"><img class="public-card-logo" src="${esc(logo)}" alt="${esc(hotelName)}"></div>
    <div class="public-card-details">
      ${detail('Work email',card.workEmail,email)}
      ${detail('Business mobile',card.businessMobile,telHref(card.businessMobile))}
      ${detail('Direct phone',card.directPhone,telHref(card.directPhone))}
      ${detail('Hotel telephone',card.hotelMainPhone,telHref(card.hotelMainPhone))}
      ${detail('Hotel address',card.hotelAddress)}
      ${detail('Hotel website',card.hotelWebsite,card.hotelWebsite,websiteLabel(card.hotelWebsite))}
    </div>
    <div class="public-card-actions">
      <a class="public-card-action" href="${esc(vcfUrl)}" data-add-contact>Add to contacts</a>
      ${call?`<a class="public-card-action" href="${esc(call)}" data-call>Call</a>`:''}
      ${email?`<a class="public-card-action" href="${esc(email)}" data-email>Email</a>`:''}
      <button class="public-card-action" type="button" data-share-card>Share</button>
    </div>
    <p class="public-card-status" data-card-status role="status" aria-live="polite"></p>
    <footer><span>Business card · </span><a href="${esc(url)}">${esc(card.slug)}</a></footer>
  </section>`;
}

export function businessCardSharePayload(card,{origin=location.origin}={}){
  const url=businessCardUrl(origin,card.slug),hotel=card.hotelName||BUSINESS_CARD_HOTEL_NAME;
  return{title:`${card.displayName} | ${hotel}`,text:[card.displayName,card.positionTitle,hotel].filter(Boolean).join(' · '),url};
}
