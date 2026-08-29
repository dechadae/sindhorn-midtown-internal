const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const SLUG_RE=/^[a-z0-9]{6}$/;
const VCF_RE=/^([a-z0-9]{6})\.vcf$/;

function html(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function jsonForHtml(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')}
function vText(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function vLineValue(value){return String(value??'').replace(/[\r\n]/g,'').trim()}
function splitContactName(displayName){
  const parts=String(displayName||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return{given:'',family:'',additional:''};
  if(parts.length===1)return{given:parts[0],family:'',additional:''};
  return{given:parts[0],family:parts.at(-1),additional:parts.slice(1,-1).join(' ')};
}
function buildVCard(card){
  const name=splitContactName(card.displayName),lines=['BEGIN:VCARD','VERSION:3.0'];
  lines.push(`N:${vText(name.family)};${vText(name.given)};${vText(name.additional)};;`);
  lines.push(`FN:${vText(card.displayName)}`);
  if(card.positionTitle)lines.push(`TITLE:${vText(card.positionTitle)}`);
  lines.push(`ORG:${vText(card.hotelName)}`);
  if(card.workEmail)lines.push(`EMAIL;TYPE=WORK:${vLineValue(card.workEmail)}`);
  if(card.businessMobile)lines.push(`TEL;TYPE=WORK,CELL:${vLineValue(card.businessMobile)}`);
  if(card.directPhone)lines.push(`TEL;TYPE=WORK:${vLineValue(card.directPhone)}`);
  if(card.hotelMainPhone&&card.hotelMainPhone!==card.directPhone)lines.push(`TEL;TYPE=WORK:${vLineValue(card.hotelMainPhone)}`);
  if(card.hotelAddress){
    lines.push(`ADR;TYPE=WORK:;;${vText(card.hotelAddress)};;;;`);
    lines.push(`LABEL;TYPE=WORK:${vText(card.hotelAddress)}`);
  }
  if(card.hotelWebsite)lines.push(`URL:${vLineValue(card.hotelWebsite)}`);
  lines.push('END:VCARD','');
  return lines.join('\r\n');
}
function vCardFilename(displayName){
  const name=String(displayName||'business-card').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'business-card';
  return `${name}.vcf`;
}

async function fetchCard(slug){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/sindhorn_public_business_card`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},
    body:JSON.stringify({p_slug:slug}),
    cf:{cacheTtl:0}
  });
  if(!response.ok)return null;
  try{return await response.json()}catch(_){return null}
}

function vcfHeaders(card){
  return new Headers({
    'content-type':'text/vcard; charset=UTF-8',
    'content-disposition':`attachment; filename="${vCardFilename(card.displayName).replace(/"/g,'')}"`,
    'cache-control':'no-store',
    'x-robots-tag':'noindex, nofollow, noarchive',
    'referrer-policy':'no-referrer'
  });
}

export async function onRequest(context){
  if(context.request.method!=='GET'&&context.request.method!=='HEAD')return context.next();
  const raw=String(context.params.slug||'').toLowerCase();
  const vcfMatch=raw.match(VCF_RE);
  const isVcf=Boolean(vcfMatch);
  const slug=isVcf?vcfMatch[1]:raw;
  if(!SLUG_RE.test(slug))return context.next();

  const card=await fetchCard(slug);
  if(!card)return context.next();

  if(isVcf){
    const headers=vcfHeaders(card);
    if(context.request.method==='HEAD')return new Response(null,{status:200,headers});
    return new Response(buildVCard(card),{status:200,headers});
  }

  const assetUrl=new URL('/business-card.html',context.request.url);
  const asset=await context.env.ASSETS.fetch(assetUrl);
  if(!asset.ok)return asset;
  if(context.request.method==='HEAD'){
    const headers=new Headers(asset.headers);headers.set('cache-control','no-store');headers.set('x-robots-tag','noindex, nofollow, noarchive');
    return new Response(null,{status:200,headers});
  }

  const title=`${card.displayName} | ${card.hotelName}`;
  const description=[card.positionTitle,card.hotelName].filter(Boolean).join(' · ');
  const source=await asset.text();
  const output=source
    .replaceAll('__BC_TITLE__',html(title))
    .replaceAll('__BC_DESCRIPTION__',html(description))
    .replace('<!--BUSINESS_CARD_BOOTSTRAP-->',`<script type="application/json" id="businessCardBootstrap">${jsonForHtml(card)}</script>`);
  const headers=new Headers(asset.headers);
  headers.set('content-type','text/html; charset=UTF-8');
  headers.set('cache-control','no-store');
  headers.set('x-robots-tag','noindex, nofollow, noarchive');
  headers.set('referrer-policy','strict-origin-when-cross-origin');
  return new Response(output,{status:200,headers});
}
