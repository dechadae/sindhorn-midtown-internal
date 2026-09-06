import {supabaseRpc} from './auth-client.js';

const RPC='sindhorn_business_dashboard_read_model';
/* The last report this device saw, kept so Today can paint numbers on the
   frame it opens instead of a skeleton (r38). It is a copy, never an
   authority: the page must say what it is showing and when it was read, and
   the live report replaces it as soon as one arrives. Business figures are
   not styles, so the copy is dropped the moment the employee is no longer
   signed in - auth-client's clearLocal announces that. */
const CACHE_KEY='sindhorn.today.dashboard.v1';
let latest=null;
let inflight=null;

export function readCachedDashboard(){
  try{
    const raw=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(!raw||typeof raw!=='object')return null;
    const data=normalize(raw.data);const savedAt=Number(raw.savedAt);
    if(!data||!Number.isFinite(savedAt))return null;
    return{data,savedAt};
  }catch(_){return null}
}
export function forgetCachedDashboard(){try{localStorage.removeItem(CACHE_KEY)}catch(_){}}
function cacheDashboard(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(_){}}
// auth-client announces on the document, so that is where this listens.
document.addEventListener('sindhorn:auth-changed',event=>{if(!event.detail?.authenticated){latest=null;forgetCachedDashboard()}});

function normalize(value){
  if(!value||typeof value!=='object')return null;
  if(!value.businessDate||!value.fnb||!value.rooms)return null;
  return value;
}

export async function loadBusinessDashboard({businessDate=null,force=false}={}){
  if(!force&&businessDate===null&&latest)return structuredClone(latest);
  if(!force&&businessDate===null&&inflight)return inflight.then(value=>structuredClone(value));
  const task=supabaseRpc(RPC,{p_business_date:businessDate}).then(normalize).then(value=>{
    if(!value)throw new Error('No approved daily business report is available.');
    if(businessDate===null){latest=value;cacheDashboard(value)}
    return value;
  });
  if(businessDate===null){
    inflight=task.finally(()=>{inflight=null});
    return inflight.then(value=>structuredClone(value));
  }
  return task;
}

export function clearBusinessDashboardCache(){latest=null;inflight=null}

document.addEventListener('sindhorn:auth-changed',clearBusinessDashboardCache);
