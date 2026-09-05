/* The Pages worker (advanced mode): the Betta satellite proxy and, since
   r31, the digital business card.

   /<slug> is the app shell in public mode, cut from index.html per request
   by site/public-page.js (the same transformation the F&B share is built
   with) with the card's own title and Open Graph tags and the card as a
   bootstrap script, so the link unfurls and the page paints without a
   second round trip. /<slug>.vcf is the saved contact. Both read
   public.sindhorn_public_business_card with the publishable key: the
   function answers only for a published card of an active employee, and
   the visibility gating is the database's. An unknown slug answers with
   the shell as it is, so the page module shows its unavailable state.
   Everything else is the static site (site/_routes.json sends it here;
   env.ASSETS serves it unchanged). */
import {publicPage,PUBLIC_SITE_NAME} from './public-page.js';
import {buildVCard,vCardFilename,isBusinessCardSlug} from './business-card-core.js';

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const CARD_RPC='sindhorn_public_business_card';
const CARD_PATH=/^\/([a-z0-9]{6})(\.vcf)?$/;

const JMA_ORIGIN='https://www.data.jma.go.jp/mscweb/data/himawari';
const SOURCE='JMA Himawari-9 High-Resolution Asia 1';
const SECTOR='High-Resolution Asia 1';
const BOUNDS={west:99,east:110,north:16,south:7};
const BANDS=new Set(['b03','b08','b13']);
const MAX_LATEST_AGE_MINUTES=120;

function json(body,status=200,cache='no-store'){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':cache,
      'x-content-type-options':'nosniff'
    }
  });
}
function pad(value){return String(value).padStart(2,'0')}
function utcStamp(date){
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}
function slotFor(date){return `${pad(date.getUTCHours())}${pad(Math.floor(date.getUTCMinutes()/10)*10)}`}
function roundedSlot(date){
  const value=new Date(date);
  value.setUTCSeconds(0,0);
  value.setUTCMinutes(Math.floor(value.getUTCMinutes()/10)*10);
  return value;
}
function frameUrl(band,slot){
  return `${JMA_ORIGIN}/img/ha1/ha1_${band}_${slot}.jpg`;
}
function parseModified(response){
  const text=response.headers.get('last-modified');
  if(!text)return null;
  const ms=Date.parse(text);
  return Number.isFinite(ms)?new Date(ms):null;
}
async function fetchFrame(band,slot){
  return fetch(frameUrl(band,slot),{
    headers:{accept:'image/jpeg'},
    cf:{cacheTtl:0,cacheEverything:false}
  });
}
function isFreshCandidate(response,candidate,now){
  if(!response.ok)return false;
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('image'))return false;
  const modified=parseModified(response);
  if(!modified)return false;
  const modifiedAge=(now.getTime()-modified.getTime())/60000;
  const candidateAge=(now.getTime()-candidate.getTime())/60000;
  if(modifiedAge< -10||modifiedAge>MAX_LATEST_AGE_MINUTES)return false;
  if(candidateAge< -1||candidateAge>MAX_LATEST_AGE_MINUTES)return false;
  return true;
}

async function latest(){
  const now=new Date();
  const base=roundedSlot(now);
  for(let back=0;back<=MAX_LATEST_AGE_MINUTES;back+=10){
    const candidate=new Date(base.getTime()-back*60000);
    const slot=slotFor(candidate);
    let response;
    try{response=await fetchFrame('b13',slot)}catch{continue}
    if(!isFreshCandidate(response,candidate,now)){
      try{await response.body?.cancel()}catch{}
      continue;
    }
    const modified=parseModified(response);
    try{await response.body?.cancel()}catch{}
    const observedAt=utcStamp(candidate);
    return json({
      ok:true,
      satellite:'Himawari-9',
      provider:'JMA',
      source:SOURCE,
      sector:SECTOR,
      bounds:BOUNDS,
      observedAt,
      date:observedAt,
      sourceLastModified:modified?utcStamp(modified):null,
      slot,
      cadenceMinutes:10
    },200,'public, max-age=35, s-maxage=35, stale-while-revalidate=30');
  }
  return json({ok:false,error:'Fresh JMA Himawari High-Resolution Asia 1 frame unavailable',source:SOURCE},502);
}

async function frame(url){
  const band=(url.searchParams.get('band')||'').toLowerCase();
  const slot=url.searchParams.get('time')||'';
  if(!BANDS.has(band))return json({ok:false,error:'unsupported band'},400);
  if(!/^\d{4}$/.test(slot)||Number(slot.slice(0,2))>23||Number(slot.slice(2))>59||Number(slot.slice(2))%10!==0){
    return json({ok:false,error:'invalid time slot'},400);
  }
  let response;
  try{response=await fetchFrame(band,slot)}catch{return json({ok:false,error:'JMA Himawari frame fetch failed',band,slot},502)}
  if(!response.ok)return json({ok:false,error:'JMA Himawari frame unavailable',band,slot,status:response.status},502);
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('image'))return json({ok:false,error:'JMA Himawari response was not an image',band,slot},502);
  const headers=new Headers();
  headers.set('content-type',contentType||'image/jpeg');
  headers.set('cache-control','public, max-age=90, s-maxage=180, stale-while-revalidate=120');
  headers.set('x-content-type-options','nosniff');
  headers.set('x-betta-satellite-source','JMA-Himawari-HA1');
  headers.set('x-betta-satellite-band',band);
  headers.set('x-betta-satellite-sector','ha1');
  const modified=response.headers.get('last-modified');
  if(modified)headers.set('last-modified',modified);
  const etag=response.headers.get('etag');
  if(etag)headers.set('etag',etag);
  return new Response(response.body,{status:200,headers});
}

async function readCard(slug){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${CARD_RPC}`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({p_slug:slug}),
    cf:{cacheTtl:0,cacheEverything:false}
  });
  if(!response.ok)throw new Error(`card read HTTP ${response.status}`);
  const card=await response.json();
  return card&&typeof card==='object'&&card.slug===slug&&card.displayName?card:null;
}
const privateHeaders={'cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'};

async function vcard(slug){
  let card;
  try{card=await readCard(slug)}catch{return new Response('Business card unavailable',{status:502,headers:{...privateHeaders,'content-type':'text/plain; charset=utf-8'}})}
  if(!card)return new Response('Business card not found',{status:404,headers:{...privateHeaders,'content-type':'text/plain; charset=utf-8'}});
  return new Response(buildVCard(card),{status:200,headers:{
    ...privateHeaders,
    'content-type':'text/vcard; charset=UTF-8',
    'content-disposition':`attachment; filename="${vCardFilename(card.displayName)}"`
  }});
}
async function cardPage(request,env,slug){
  const shell=await env.ASSETS.fetch(new Request(new URL('/',request.url),{headers:request.headers}));
  const index=await shell.text();
  let card=null;
  try{card=await readCard(slug)}catch{card=null}
  let html;
  if(card){
    const title=`${card.displayName} | ${card.hotelName||PUBLIC_SITE_NAME}`;
    const description=[card.positionTitle,card.hotelName].filter(Boolean).join(' · ')||PUBLIC_SITE_NAME;
    html=publicPage(index,{mode:'card',id:slug,title,url:new URL(`/${slug}`,request.url).href,description,robots:true,bootstrap:{id:'businessCardBootstrap',data:card}});
  }else{
    html=publicPage(index,{mode:'card',id:slug,title:`Business card | ${PUBLIC_SITE_NAME}`,url:new URL(`/${slug}`,request.url).href,description:PUBLIC_SITE_NAME,robots:true});
  }
  return new Response(html,{status:200,headers:{...privateHeaders,'content-type':'text/html; charset=utf-8'}});
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/betta-satellite'){
      if(request.method!=='GET')return json({ok:false,error:'method not allowed'},405);
      const kind=url.searchParams.get('kind')||'latest';
      if(kind==='latest')return latest();
      if(kind==='frame')return frame(url);
      return json({ok:false,error:'unsupported kind'},400);
    }
    const card=url.pathname.match(CARD_PATH);
    if(card&&isBusinessCardSlug(card[1])&&(request.method==='GET'||request.method==='HEAD')){
      return card[2]?vcard(card[1]):cardPage(request,env,card[1]);
    }
    return env.ASSETS.fetch(request);
  }
};
