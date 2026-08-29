import {supabaseRpc} from './auth-client.js';

let cache=null;
let inflight=null;

function clone(value){return value?structuredClone(value):value}
function normalizeManifest(value){
  const manifest=value&&typeof value==='object'?value:{};
  return{
    ok:manifest.ok===true,
    version:Number(manifest.version||1),
    profile:manifest.profile&&typeof manifest.profile==='object'?manifest.profile:{},
    capabilities:Array.isArray(manifest.capabilities)?manifest.capabilities.map(String):[],
    sections:Array.isArray(manifest.sections)?manifest.sections.filter(Boolean):[]
  };
}

export async function loadSettingsAuthority({force=false}={}){
  if(!force&&cache)return clone(cache);
  if(!force&&inflight)return inflight.then(clone);
  inflight=supabaseRpc('sindhorn_settings_manifest').then(result=>{
    const manifest=normalizeManifest(result);
    if(!manifest.ok)throw new Error('Settings authority unavailable');
    cache=manifest;
    document.dispatchEvent(new CustomEvent('sindhorn:capabilities-updated',{detail:clone(cache)}));
    return cache;
  }).finally(()=>{inflight=null});
  return inflight.then(clone);
}

export function getSettingsAuthority(){return clone(cache)}
export function hasCapability(key,manifest=cache){return Boolean(manifest?.capabilities?.includes?.(String(key)))}
export function sectionByKey(key,manifest=cache){return manifest?.sections?.find?.(section=>section?.key===key)||null}
export function clearSettingsAuthority(){cache=null;inflight=null}

document.addEventListener('sindhorn:auth-changed',()=>clearSettingsAuthority());

if(typeof window!=='undefined')window.SindhornCapabilities={load:loadSettingsAuthority,get:getSettingsAuthority,has:hasCapability,section:sectionByKey,clear:clearSettingsAuthority};
