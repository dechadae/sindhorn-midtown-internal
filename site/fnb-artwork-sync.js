const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const LOCAL_STATE_KEY='sindhorn-midtown:fnb-local:v1';
const MIGRATION_KEY='sindhorn-midtown:fnb-artwork-shared:v1';
const READ_RPC='sindhorn_fnb_artwork_status_read';
const WRITE_RPC='sindhorn_fnb_artwork_status_write';

let initialized=false;
let sharedDone=new Set();
let applyTimer=0;
let refreshTimer=0;
let publicDataPromise=null;
let detailObserver=null;

function safeParse(value){try{return JSON.parse(value)}catch(_){return null}}
function authToken(){try{return window.SindhornEmployeeAuth?.getAccessToken?.()||null}catch(_){return null}}
function editorProfile(){try{return window.SindhornEmployeeAuth?.getProfile?.()||null}catch(_){return null}}
async function rpc(name,params={},token=null){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',cache:'no-store',headers:{apikey:SUPABASE_KEY,'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(params)});
  if(!response.ok)throw new Error(`F&B artwork sync HTTP ${response.status}`);
  const text=await response.text();return text?safeParse(text):null
}
async function readShared(){
  const rows=await rpc(READ_RPC);
  sharedDone=new Set((Array.isArray(rows)?rows:[]).filter(row=>row?.done===true).map(row=>String(row.artwork_id)));
  scheduleApply();return sharedDone
}
async function writeShared(checks){
  const token=authToken();if(!token)throw new Error('F&B artwork sync requires authentication');
  return rpc(WRITE_RPC,{p_checks:checks},token)
}
async function migrateLocalOnce(){
  const profile=editorProfile();if(String(profile?.employee_number||'')!=='10639')return;
  let migrated=false;try{migrated=localStorage.getItem(MIGRATION_KEY)==='1'}catch(_){}
  if(migrated)return;
  let checks={};try{checks=safeParse(localStorage.getItem(LOCAL_STATE_KEY)||'')?.checks||{}}catch(_){}
  const clean={};Object.entries(checks).forEach(([id,value])=>{if(id&&id.length<=160)clean[id]=Boolean(value)});
  if(Object.keys(clean).length)await writeShared(clean);
  try{localStorage.setItem(MIGRATION_KEY,'1')}catch(_){}
}
async function publicData(){
  if(!publicDataPromise)publicDataPromise=import('/share/fnb-public-data.js').then(module=>module.FNB_PROMOTIONS||[]).catch(()=>[]);
  return publicDataPromise
}
function selectedOutlet(){const value=document.querySelector('.fnb-route [data-filter-field="outlet"] [data-filter-value]')?.textContent?.trim()||'All outlets';return value==='All outlets'?'ALL':value}
function campaignCounts(campaign,outlet='ALL'){
  let total=0,done=0;(campaign?.activations||[]).forEach(activation=>{if(outlet!=='ALL'&&activation.outlet!==outlet)return;(activation.artworks||[]).forEach(item=>{total++;if(sharedDone.has(String(item.id)))done++})});return{total,done}
}
async function applyIndex(){
  const route=document.querySelector('.fnb-route');if(!route||route.querySelector('[data-index]')?.hidden)return;
  const data=await publicData(),byId=new Map(data.map(item=>[String(item.id),item])),outlet=selectedOutlet();let summaryDone=0,summaryTotal=0;
  route.querySelectorAll('.fnb-card').forEach(card=>{const id=card.querySelector('[data-open]')?.dataset.open,campaign=byId.get(String(id||''));if(!campaign)return;const count=campaignCounts(campaign,outlet);summaryDone+=count.done;summaryTotal+=count.total;const meta=card.querySelector('.fnb-progress-meta b');if(meta)meta.textContent=`${count.done} / ${count.total}`;const track=card.querySelector('.fnb-progress-track i');if(track)track.style.width=`${count.total?count.done/count.total*100:0}%`});
  const stats=route.querySelectorAll('.fnb-summary .fnb-stat');const artwork=stats[2]?.querySelector('b');if(artwork)artwork.textContent=`${summaryDone}/${summaryTotal}`
}
function applyDetail(){
  const detail=document.querySelector('.fnb-route [data-detail]:not([hidden])');if(!detail)return;
  detail.querySelectorAll('.fnb-task').forEach(row=>{const button=row.querySelector('[data-task]'),id=button?.dataset.task,isDone=id?sharedDone.has(String(id)):false;row.classList.toggle('is-done',isDone);if(button)button.setAttribute('aria-label',isDone?'Mark pending':'Mark complete')});
  let overallDone=0,overallTotal=0;
  detail.querySelectorAll('.fnb-art-card').forEach(card=>{
    const rows=[...card.querySelectorAll('.fnb-task')],total=rows.length;
    if(total===0){card.hidden=true;card.setAttribute('aria-hidden','true');return}
    card.hidden=false;card.removeAttribute('aria-hidden');
    const done=rows.filter(row=>row.classList.contains('is-done')).length,complete=done===total;overallDone+=done;overallTotal+=total;card.classList.toggle('is-complete',complete);const tally=card.querySelector('.fnb-art-tally');if(tally)tally.innerHTML=`${done}/${total}<i>${complete?'✓':''}</i>`
  });
  const count=detail.querySelector('.fnb-section-count');if(count)count.textContent=`${overallDone} / ${overallTotal} complete`
}
async function applyShared(){if(document.body.dataset.route!=='fnb')return;await applyIndex();applyDetail()}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>void applyShared(),0)}
function watchDetail(){
  detailObserver?.disconnect();detailObserver=null;
  const route=document.querySelector('.fnb-route');if(!route)return;
  detailObserver=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'&&(m.addedNodes.length||m.removedNodes.length)))scheduleApply()});
  detailObserver.observe(route,{childList:true,subtree:true});
  scheduleApply()
}
async function refresh(){try{await readShared()}catch(_){} }
async function migrateAndRefresh(){try{await migrateLocalOnce()}catch(_){}await refresh()}
function onClick(event){
  const task=event.target.closest?.('[data-task]');
  if(task){const id=task.dataset.task;queueMicrotask(async()=>{let value=false;try{value=Boolean(safeParse(localStorage.getItem(LOCAL_STATE_KEY)||'')?.checks?.[id])}catch(_){}try{await writeShared({[id]:value});if(value)sharedDone.add(String(id));else sharedDone.delete(String(id));scheduleApply()}catch(_){await refresh()}});return}
  if(event.target.closest?.('[data-open],[data-back],[data-filter-option],[data-filter-trigger]'))setTimeout(scheduleApply,30)
}
export function initFnbArtworkSync(){
  if(initialized)return;initialized=true;
  document.addEventListener('sindhorn:route-mounted',event=>{if(event.detail?.route==='fnb'){watchDetail();void migrateAndRefresh()}else{detailObserver?.disconnect();detailObserver=null}});
  document.addEventListener('click',onClick);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.body.dataset.route==='fnb')void refresh()});
  refreshTimer=setInterval(()=>{if(document.visibilityState==='visible'&&document.body.dataset.route==='fnb')void refresh()},30000);
  if(document.body.dataset.route==='fnb')watchDetail();
  void migrateAndRefresh();
}

void refreshTimer;
