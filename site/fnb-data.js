// F&B runtime data adapter. Canonical business content lives in Supabase.
// The compact array below is emergency offline structure only; it is not the operational content authority.
const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const CACHE_KEY='sindhorn-midtown:fnb-dataset:v2';
const LOCAL_STATE_KEY='sindhorn-midtown:fnb-local:v1';
const LINK_MIGRATION_KEY='sindhorn-midtown:fnb-links-supabase:v1';
const INTERNAL_RPC='sindhorn_fnb_read_model';
const PUBLIC_RPC='sindhorn_fnb_public_read_model';
const EXTRA_OUTLETS=['In-room Dining'];

const EMERGENCY_FALLBACK=[
{id:'fried-chicken-waffles',title:'Fried Chicken & Waffles',start:'2026-09-01',end:'2026-12-31',dateLabel:'1 September – 31 December 2026',summary:'Crispy fried chicken and buttery waffles in four globally inspired styles.',displayOutlets:['Sip & Co.','The Lobby Lounge'],activations:[{id:'fried-chicken-waffles-sip',outlet:'Sip & Co.',time:'TBC',discount:'20%',artworks:[]}]},
{id:'sunset-cocktails',title:'Sunset Cocktails',start:'2026-09-01',end:'2026-10-31',dateLabel:'1 September – 31 October 2026',summary:'Cocktails inspired by iconic sunset destinations around the world.',displayOutlets:['Horizon Pool Bar'],activations:[{id:'sunset-cocktails-horizon',outlet:'Horizon Pool Bar',time:'TBC',discount:'N/A',artworks:[]}]},
{id:'guest-bartender-phraya',title:'Guest Bartender · ANJU × PHRAYA RUM',start:'2026-09-12',end:'2026-09-12',dateLabel:'12 September 2026',summary:'One-night ANJU × PHRAYA RUM guest shift with three special cocktails.',displayOutlets:['ANJU'],activations:[{id:'guest-bartender-phraya-anju',outlet:'ANJU',time:'7 pm – 11 pm',discount:'N/A',artworks:[]}]},
{id:'negroni-week',title:'Negroni Week',start:'2026-09-21',end:'2026-09-27',dateLabel:'21 – 27 September 2026',summary:'Three Negroni creations inspired by familiar rituals and global flavors.',displayOutlets:['ANJU','The Lobby Lounge'],activations:[{id:'negroni-week-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]},{id:'negroni-week-lobby',outlet:'The Lobby Lounge',time:'6:30 am – 12 am',discount:'N/A',artworks:[]}]},
{id:'halloween-sins-of-seoul',title:'Halloween · Sins of Seoul',start:'2026-10-01',end:'2026-10-31',dateLabel:'1 – 31 October 2026',summary:'Three dark cocktail temptations: Lust, Greed and Envy.',displayOutlets:['ANJU'],activations:[{id:'halloween-sins-of-seoul-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]}]},
{id:'korean-mid-autumn',title:'Korean Mid-Autumn Special',start:'2026-10-01',end:'2026-10-31',dateLabel:'1 – 31 October 2026',summary:'Korean harvest-inspired side dishes designed for charcoal-grilled BBQ.',displayOutlets:['ANJU'],activations:[{id:'korean-mid-autumn-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]}]},
{id:'vegetarian-week',title:'Vegetarian Week',start:'2026-10-10',end:'2026-10-18',dateLabel:'10 – 18 October 2026',summary:"Limited-time vegetarian menus across Bangkok'78 and ANJU.",displayOutlets:["Bangkok'78",'ANJU'],activations:[{id:'vegetarian-week-bangkok78',outlet:"Bangkok'78",time:'11 am – 10 pm',discount:'20%',artworks:[]},{id:'vegetarian-week-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]}]},
{id:'anju-hoegaarden',title:'ANJU × Hoegaarden',start:'2026-10-31',end:'2026-10-31',dateLabel:'31 October 2026',summary:'Halloween-night Hoegaarden collaboration with mini-games and prizes.',displayOutlets:['ANJU'],activations:[{id:'anju-hoegaarden-anju',outlet:'ANJU',time:'7 pm – 12 am',discount:'N/A',artworks:[]}]},
{id:'festive-hamper',title:'Festive Hamper',start:'2026-11-01',end:'2026-12-31',dateLabel:'1 November – 31 December 2026',summary:'Four festive hamper options combining Sip & Co. treats with ANJU specialties.',displayOutlets:['Sip & Co.'],activations:[{id:'festive-hamper-sip',outlet:'Sip & Co.',time:'6 am – 9 pm',discount:'N/A',artworks:[]}]},
{id:'fathers-day-bangkok78',title:"Father's Day",start:'2026-12-05',end:'2026-12-05',dateLabel:'5 December 2026',summary:'Come 3, pay for 2 on a 90-minute unlimited à la carte Thai feast.',displayOutlets:["Bangkok'78"],activations:[{id:'fathers-day-bangkok78',outlet:"Bangkok'78",time:'11:30 am – 10 pm',discount:'N/A',artworks:[]}]},
{id:'korean-oyster-indulgence',title:'Korean Oyster Indulgence',start:'2026-11-01',end:'2026-12-30',dateLabel:'1 November – 30 December 2026',summary:'Premium Korean oysters served across three comforting winter dishes.',displayOutlets:['ANJU'],activations:[{id:'korean-oyster-indulgence-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]}]},
{id:'seoul-festive-collection',title:'The Seoul Festive Collection',start:'2026-11-01',end:'2026-12-30',dateLabel:'1 November – 30 December 2026',summary:'Three festive Seoul-inspired cocktails, each priced at THB 420++.',displayOutlets:['ANJU'],activations:[{id:'seoul-festive-collection-anju',outlet:'ANJU',time:'5 pm – 2 am',discount:'N/A',artworks:[]}]},
{id:'bangkok78-doi-kham-royal-sip',title:"Bangkok'78 × Doi Kham: The Royal Sip",start:'2026-11-01',end:'2026-12-30',dateLabel:'1 November – 30 December 2026',summary:'Four Doi Kham signature mocktails celebrating Thai ingredients and culture.',displayOutlets:["Bangkok'78"],activations:[{id:'bangkok78-doi-kham-royal-sip',outlet:"Bangkok'78",time:'11:30 am – 10 pm',discount:'N/A',artworks:[]}]},
{id:'chef-new-signature-creations',title:'Chef’s New Signature Creations',start:'2026-11-01',end:'2026-12-30',dateLabel:'1 November – 30 December 2026',summary:'Five original Thai dishes introducing Chef Palm’s new culinary direction.',displayOutlets:["Bangkok'78"],activations:[{id:'chef-new-signature-creations-bangkok78',outlet:"Bangkok'78",time:'11:30 am – 10 pm',discount:'20%',artworks:[]}]},
{id:'festive-afternoon-tea',title:'Festive Afternoon Tea',start:'2026-11-01',end:'2026-12-31',dateLabel:'1 November – 31 December 2026',summary:'Festive sweet and savory bites with a choice of Araksa tea for two.',displayOutlets:['Sip & Co.','The Lobby Lounge'],activations:[{id:'festive-afternoon-tea-sip',outlet:'Sip & Co.',time:'1 pm – 5 pm',discount:'20%',artworks:[]}]},
{id:'matcha-moments',title:'Matcha Moments',start:'2026-11-01',end:'2026-12-31',dateLabel:'1 November – 31 December 2026',summary:'Four seasonal matcha drinks designed for calm, comforting year-end moments.',displayOutlets:['Sip & Co.','The Lobby Lounge'],activations:[{id:'matcha-moments-sip',outlet:'Sip & Co.',time:'TBC',discount:'20%',artworks:[]}]},
{id:'festive-horizon-cocktail',title:'Festive Horizon Cocktail',start:'2026-11-01',end:'2026-12-31',dateLabel:'1 November – 31 December 2026',summary:'Three skyline-inspired festive cocktails for golden hour through evening.',displayOutlets:['Horizon Pool Bar'],activations:[{id:'festive-horizon-cocktail-horizon',outlet:'Horizon Pool Bar',time:'6:30 am – 10:30 pm',discount:'N/A',artworks:[]}]},
{id:'festive-celebration-set',title:'Festive Celebration Set',start:'2026-11-01',end:'2026-12-31',dateLabel:'1 November – 31 December 2026',summary:'A festive burger, drink and dessert set available through In-room Dining.',displayOutlets:['In-room Dining'],activations:[{id:'festive-celebration-set-ird',outlet:'In-room Dining',time:'11:30 am – 12 am',discount:'N/A',artworks:[]}]}
];

function safeParse(value){try{return JSON.parse(value)}catch(_){return null}}
function authToken(){try{return window.SindhornEmployeeAuth?.getAccessToken?.()||null}catch(_){return null}}
function validIso(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))}
function parseUpdated(value){const text=String(value||'').trim();if(!text)return null;const zoned=/(?:z|[+-]\d\d:?\d\d)$/i.test(text)?text:`${text}+07:00`;const date=new Date(zoned);return Number.isNaN(date.valueOf())?null:date}
function latestUpdated(data){let latest=null;for(const item of data||[]){const date=parseUpdated(item?.updatedAt);if(date&&(!latest||date>latest))latest=date}return latest?latest.toISOString():null}
function validate(data){
  if(!Array.isArray(data)||!data.length)return false;
  const pids=new Set(),aids=new Set(),xids=new Set();
  for(const p of data){
    if(!p||typeof p.id!=='string'||pids.has(p.id)||!p.title||!validIso(p.start)||!validIso(p.end)||p.start>p.end||!Array.isArray(p.activations))return false;pids.add(p.id);
    for(const a of p.activations){if(!a||typeof a.id!=='string'||aids.has(a.id)||!a.outlet||!Array.isArray(a.artworks))return false;aids.add(a.id);for(const x of a.artworks){if(!x||typeof x.id!=='string'||xids.has(x.id)||!x.name)return false;xids.add(x.id)}}
  }
  return true
}
async function rpc(name,token=null){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',cache:'no-store',headers:{apikey:SUPABASE_KEY,'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:'{}'});
  if(!response.ok)throw new Error(`F&B data HTTP ${response.status}`);
  const body=await response.json();
  if(!validate(body))throw new Error('Invalid F&B dataset');
  return body
}
function readCache(){try{const parsed=safeParse(localStorage.getItem(CACHE_KEY)||'');return validate(parsed?.data)?parsed:null}catch(_){return null}}
function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(_){}}
function clearLegacyLocalLinks(){try{if(localStorage.getItem(LINK_MIGRATION_KEY)==='1')return;const local=safeParse(localStorage.getItem(LOCAL_STATE_KEY)||'')||{};localStorage.setItem(LOCAL_STATE_KEY,JSON.stringify({checks:local.checks||{},links:{}}));localStorage.setItem(LINK_MIGRATION_KEY,'1')}catch(_){}}
function displaySlug(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'outlet'}
function decorate(data){return data.map(p=>{const activations=(p.activations||[]).map(a=>({...a,artworks:Array.isArray(a.artworks)?a.artworks:[]}));const display=Array.isArray(p.displayOutlets)&&p.displayOutlets.length?p.displayOutlets:[...new Set(activations.map(a=>a.outlet))];const present=new Set(activations.map(a=>a.outlet)),reference=activations[0]||{};for(const outlet of display){if(!present.has(outlet))activations.push({id:`__display__${p.id}__${displaySlug(outlet)}`,outlet,time:reference.time||'TBC',discount:reference.discount||'N/A',brief:'',copyEn:'',copyTh:'',artworkUrl:null,artworks:[],displayOnly:true})}return {...p,displayOutlets:display,activations}})}
let source='fallback',rawData=null,cached=readCache();
try{const token=authToken();if(token){rawData=await rpc(INTERNAL_RPC,token);source='supabase'}else{rawData=await rpc(PUBLIC_RPC);source='supabase-public'}writeCache(rawData)}catch(_){if(cached){rawData=cached.data;source='cache'}else rawData=EMERGENCY_FALLBACK}
clearLegacyLocalLinks();
export const FNB_PROMOTIONS=Object.freeze(decorate(rawData));
export const FNB_DATA_SOURCE=source;
export const FNB_DATA_UPDATED_AT=latestUpdated(rawData);

function ensureAdapterStyle(){if(document.getElementById('fnb-data-adapter-style'))return;const style=document.createElement('style');style.id='fnb-data-adapter-style';style.textContent='.fnb-art-card[data-activation^="__display__"]{display:none!important}.fnb-route [data-folder-edit]{display:none!important}.fnb-data-note,.fnb-data-updated{font-size:12px;line-height:1.35;opacity:.72}.fnb-data-note{margin:10px 0 0}.fnb-data-updated{margin:5px 0 0;letter-spacing:0}';document.head.appendChild(style)}
function optionMarkup(value){const safe=value.replace(/&/g,'&amp;').replace(/"/g,'&quot;');return `<button class="fnb-select-option" type="button" role="option" aria-selected="false" data-filter-option="outlet" data-value="${safe}"><span>${value}</span><i aria-hidden="true"></i></button>`}
function patchOutletFilter(){const field=document.querySelector('.fnb-route [data-filter-field="outlet"]'),select=field?.querySelector('[data-outlet-select]'),menu=field?.querySelector('.fnb-select-menu');if(!field||!select||!menu)return;for(const outlet of EXTRA_OUTLETS){if(![...select.options].some(o=>o.value===outlet)){const opt=document.createElement('option');opt.value=outlet;opt.textContent=outlet;select.appendChild(opt)}if(![...menu.querySelectorAll('[data-filter-option="outlet"]')].some(o=>o.dataset.value===outlet))menu.insertAdjacentHTML('beforeend',optionMarkup(outlet))}}
function patchStatus(){const route=document.querySelector('.fnb-route');if(!route||source==='supabase'||source==='supabase-public'||route.querySelector('.fnb-data-note'))return;const hero=route.querySelector('.fnb-hero');if(!hero)return;const note=document.createElement('div');note.className='fnb-data-note';note.textContent=source==='cache'?'Offline · showing last saved F&B data':'Offline · limited F&B fallback';hero.appendChild(note)}
function formatUpdated(value){const date=parseUpdated(value);if(!date)return'';const day=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(date);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'numeric',minute:'2-digit',hour12:true}).format(date).toLowerCase();return`Updated ${day} · ${time}`}
function patchDatasetUpdated(){const period=document.querySelector('.fnb-route .fnb-period');if(!period||!FNB_DATA_UPDATED_AT)return;let stamp=period.parentElement?.querySelector('[data-fnb-data-updated]');if(!stamp){stamp=document.createElement('div');stamp.className='fnb-data-updated';stamp.dataset.fnbDataUpdated='true';period.insertAdjacentElement('afterend',stamp)}stamp.textContent=formatUpdated(FNB_DATA_UPDATED_AT)}
function patchUpdated(){const route=document.querySelector('.fnb-route'),title=route?.querySelector('.fnb-detail-title')?.textContent?.trim();if(!route||!title)return;const item=FNB_PROMOTIONS.find(p=>p.title===title),updated=item?.updatedAt;if(!updated)return;for(const fact of route.querySelectorAll('.fnb-fact')){if(fact.querySelector('span')?.textContent?.trim()==='Updated'){const b=fact.querySelector('b');if(!b||b.dataset.fnbUpdated===updated)continue;const d=parseUpdated(updated);b.textContent=!d?String(updated).slice(0,10):new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(d);b.dataset.fnbUpdated=updated}}}
function enhance(){ensureAdapterStyle();patchOutletFilter();patchDatasetUpdated();patchStatus();patchUpdated()}
function scheduleEnhance(attempt=0){requestAnimationFrame(()=>{enhance();if(!document.querySelector('.fnb-route')&&attempt<12)scheduleEnhance(attempt+1)})}
document.addEventListener('sindhorn:route-mounted',event=>{if(event.detail?.route==='fnb')queueMicrotask(enhance)});
document.addEventListener('click',()=>{if(document.body?.dataset.route==='fnb')setTimeout(enhance,0)},{capture:false});
scheduleEnhance();
