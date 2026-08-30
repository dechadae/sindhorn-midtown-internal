import {isBusinessCardSlug} from './business-card-core.js';
import {BUSINESS_CARD_HOTEL_NAME,businessCardSharePayload,renderBusinessCardMarkup} from './business-card-renderer.js?v=1';
import {standardCloseButton} from './settings-dialog-standard.js?v=1';

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const root=document.querySelector('[data-business-card-root]');
const slug=location.pathname.replace(/^\/+|\/+$/g,'').replace(/\.vcf$/,'').toLowerCase();
let card=null,statusTimer=0;

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function bootstrapCard(){const node=document.getElementById('businessCardBootstrap');if(!node)return null;try{return JSON.parse(node.textContent||'null')}catch(_){return null}}
async function fetchPublicCard(){try{const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/sindhorn_public_business_card`,{method:'POST',headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},body:JSON.stringify({p_slug:slug}),cache:'no-store'});if(!response.ok)return null;return await response.json()}catch(_){return null}}
async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch(_){}const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}area.remove();return ok}
function showStatus(message){const node=root?.querySelector('[data-card-status]');if(!node)return;node.textContent=message;node.dataset.show='true';clearTimeout(statusTimer);statusTimer=setTimeout(()=>{node.dataset.show='false'},1800)}
function unavailable(){if(!root)return;root.innerHTML=`<section class="public-card-unavailable"><p class="public-card-kicker">Business card</p><h1>Card unavailable</h1><p>This business card is not published or is no longer active.</p><span>${esc(BUSINESS_CARD_HOTEL_NAME)}</span></section>`}
function render(){if(!root||!card){unavailable();return}root.innerHTML=renderBusinessCardMarkup(card,{origin:location.origin,closeMarkup:standardCloseButton('data-public-card-close')})}
async function shareCard(){if(!card)return;const payload=businessCardSharePayload(card,{origin:location.origin});if(typeof navigator.share==='function'){try{await navigator.share(payload);return}catch(error){if(error?.name==='AbortError')return}}showStatus(await copyText(payload.url)?'Link copied':'Copy link failed')}
function closePublicCard(){if(history.length>1){history.back();return}try{window.close()}catch(_){}}
async function load(){if(!isBusinessCardSlug(slug)){unavailable();return}card=bootstrapCard()||await fetchPublicCard();if(!card){unavailable();return}render()}
root?.addEventListener('click',event=>{if(event.target.closest('[data-share-card]')){void shareCard();return}if(event.target.closest('[data-public-card-close]'))closePublicCard()});
load();
