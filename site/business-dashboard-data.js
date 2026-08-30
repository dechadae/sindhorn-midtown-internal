import {supabaseRpc} from './auth-client.js';

const RPC='sindhorn_business_dashboard_read_model';
let latest=null;
let inflight=null;

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
    if(businessDate===null)latest=value;
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
