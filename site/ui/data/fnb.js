import {supabaseRpc} from '../../auth-client.js';

const RPC='sindhorn_fnb_read_model';
const CACHE_KEY='sindhorn-midtown:fnb-dataset:v2';

function safeParse(value){try{return JSON.parse(value)}catch(_){return null}}
function validIso(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))}
function validate(data){
  if(!Array.isArray(data)||!data.length)return false;
  const pids=new Set(),aids=new Set(),xids=new Set();
  for(const promotion of data){
    if(!promotion||typeof promotion.id!=='string'||pids.has(promotion.id)||!promotion.title||!validIso(promotion.start)||!validIso(promotion.end)||promotion.start>promotion.end||!Array.isArray(promotion.activations))return false;
    pids.add(promotion.id);
    for(const activation of promotion.activations){
      if(!activation||typeof activation.id!=='string'||aids.has(activation.id)||!activation.outlet||!Array.isArray(activation.artworks))return false;
      aids.add(activation.id);
      for(const artwork of activation.artworks){if(!artwork||typeof artwork.id!=='string'||xids.has(artwork.id)||!artwork.name)return false;xids.add(artwork.id)}
    }
  }
  return true;
}
function displaySlug(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'outlet'}
function decorate(data){return data.map(promotion=>{
  const activations=(promotion.activations||[]).map(activation=>({...activation,artworks:Array.isArray(activation.artworks)?activation.artworks:[]}));
  const display=Array.isArray(promotion.displayOutlets)&&promotion.displayOutlets.length?promotion.displayOutlets:[...new Set(activations.map(activation=>activation.outlet))];
  const present=new Set(activations.map(activation=>activation.outlet)),reference=activations[0]||{};
  for(const outlet of display){if(!present.has(outlet))activations.push({id:`__display__${promotion.id}__${displaySlug(outlet)}`,outlet,time:reference.time||'TBC',discount:reference.discount||'N/A',brief:'',copyEn:'',copyTh:'',artworkUrl:null,artworks:[],displayOnly:true})}
  return{...promotion,displayOutlets:display,activations};
})}
function readCache(){
  try{const parsed=safeParse(localStorage.getItem(CACHE_KEY)||'');return validate(parsed?.data)?parsed.data:null}catch(_){return null}
}
function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch(_){}}
function updatedAt(data){
  let latest=null;
  for(const item of data||[]){const raw=String(item?.updatedAt||'').trim();if(!raw)continue;const date=new Date(/(?:z|[+-]\d\d:?\d\d)$/i.test(raw)?raw:`${raw}+07:00`);if(!Number.isNaN(date.valueOf())&&(!latest||date>latest))latest=date}
  return latest?.toISOString()||null;
}

let cache=null;
export async function loadFnbData({force=false}={}){
  if(cache&&!force)return structuredClone(cache);
  try{
    const data=await supabaseRpc(RPC,{});
    if(!validate(data))throw new Error('Invalid F&B dataset');
    writeCache(data);
    cache={promotions:decorate(data),source:'supabase',updatedAt:updatedAt(data)};
  }catch(error){
    const data=readCache();
    if(!data)throw error;
    cache={promotions:decorate(data),source:'cache',updatedAt:updatedAt(data)};
  }
  return structuredClone(cache);
}
export function clearFnbDataCache(){cache=null}
