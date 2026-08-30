export function isBusinessCardSlug(value){return /^[a-z0-9]{6}$/.test(String(value||''))}

export function businessCardUrl(origin,slug){
  const safeOrigin=String(origin||'').replace(/\/+$/,'');
  const safeSlug=String(slug||'').toLowerCase();
  if(!isBusinessCardSlug(safeSlug))throw new Error('invalid_business_card_slug');
  return `${safeOrigin}/${safeSlug}`;
}

export function businessCardVcfUrl(origin,slug){
  return `${businessCardUrl(origin,slug)}.vcf`;
}

function vText(value){
  return String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
}
function vLineValue(value){return String(value??'').replace(/[\r\n]/g,'').trim()}

export function splitContactName(displayName){
  const parts=String(displayName||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return{given:'',family:'',additional:''};
  if(parts.length===1)return{given:parts[0],family:'',additional:''};
  return{given:parts[0],family:parts.at(-1),additional:parts.slice(1,-1).join(' ')};
}

export function primaryPhone(card){return card?.businessMobile||card?.directPhone||card?.hotelMainPhone||''}

export function buildVCard(card){
  if(!card?.displayName||!card?.hotelName)throw new Error('business_card_identity_required');
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

export function vCardFilename(displayName){
  const base=String(displayName||'business-card').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'business-card';
  return `${base}.vcf`;
}
