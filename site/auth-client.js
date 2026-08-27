const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const STORAGE_KEY='sindhorn-midtown-auth-session-v1';
const REFRESH_SKEW_MS=90_000;

let session=null,profile=null,refreshPromise=null,initialized=false;
const hasWindow=typeof window!=='undefined';
const dispatch=(name,detail)=>{if(hasWindow&&typeof document!=='undefined')document.dispatchEvent(new CustomEvent(name,{detail}))};

function safeParse(value){try{return JSON.parse(value)}catch(_){return null}}
function decodeJwt(token){
  try{
    const part=String(token||'').split('.')[1];if(!part)return null;
    const base=part.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(part.length/4)*4,'=');
    return JSON.parse(atob(base));
  }catch(_){return null}
}
function normalizedSession(value){
  if(!value||typeof value!=='object'||typeof value.access_token!=='string'||typeof value.refresh_token!=='string')return null;
  const jwt=decodeJwt(value.access_token),expiresAt=Number(value.expires_at||jwt?.exp||0);if(!Number.isFinite(expiresAt)||expiresAt<=0)return null;
  return{access_token:value.access_token,refresh_token:value.refresh_token,expires_at:expiresAt,token_type:value.token_type||'bearer',user:value.user||null};
}
function storage(){try{return hasWindow?window.localStorage:null}catch(_){return null}}
function persist(next){
  session=normalizedSession(next);const store=storage();
  try{if(session)store?.setItem(STORAGE_KEY,JSON.stringify(session));else store?.removeItem(STORAGE_KEY)}catch(_){}
}
function loadStored(){const store=storage();const parsed=safeParse(store?.getItem(STORAGE_KEY)||'');return normalizedSession(parsed)}
function clearLocal(reason='signed_out'){
  persist(null);profile=null;dispatch('sindhorn:auth-changed',{authenticated:false,profile:null,reason});
}
function authHeaders(accessToken=session?.access_token){return{apikey:SUPABASE_KEY,'content-type':'application/json',...(accessToken?{authorization:`Bearer ${accessToken}`}:{})}}
async function responseJson(response){
  const text=await response.text(),data=safeParse(text)||{};
  if(!response.ok){const error=new Error(data?.msg||data?.message||data?.error_description||data?.error||`HTTP ${response.status}`);error.status=response.status;error.payload=data;throw error}
  return data;
}

export async function supabaseRpc(name,params={}, {accessToken=session?.access_token}={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',cache:'no-store',headers:authHeaders(accessToken),body:JSON.stringify(params||{})
  });
  return responseJson(response);
}

export function getState(){return{initialized,authenticated:Boolean(session&&profile),session:session?{expires_at:session.expires_at,user:session.user}:null,profile:profile?structuredClone(profile):null,authBackend:'supabase'}}
export function getAccessToken(){return session?.access_token||null}
export function getProfile(){return profile?structuredClone(profile):null}

export async function refreshSession({force=false}={}){
  if(refreshPromise)return refreshPromise;
  if(!session?.refresh_token)return null;
  if(!force&&session.expires_at*1000>Date.now()+REFRESH_SKEW_MS)return session;
  refreshPromise=(async()=>{
    try{
      const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',cache:'no-store',headers:authHeaders(null),body:JSON.stringify({refresh_token:session.refresh_token})});
      const data=await responseJson(response),next=normalizedSession(data);if(!next)throw new Error('Invalid refreshed session');persist(next);return session;
    }catch(error){clearLocal('session_expired');throw error}
    finally{refreshPromise=null}
  })();
  return refreshPromise;
}

export async function fetchProfile({retry401=true}={}){
  if(!session)return null;
  await refreshSession();
  const select='id,employee_number,display_name,work_email,account_type,department_id,role,active,preferred_language,activated_at';
  const response=await fetch(`${SUPABASE_URL}/rest/v1/sindhorn_employees?select=${encodeURIComponent(select)}&limit=1`,{cache:'no-store',headers:{apikey:SUPABASE_KEY,authorization:`Bearer ${session.access_token}`,Accept:'application/json'}});
  if(response.status===401&&retry401){await refreshSession({force:true});return fetchProfile({retry401:false})}
  const rows=await responseJson(response),next=Array.isArray(rows)?rows[0]:null;
  if(!next||next.active!==true){clearLocal('employee_inactive');return null}
  profile=next;dispatch('sindhorn:auth-changed',{authenticated:true,profile:structuredClone(profile),reason:'profile'});return structuredClone(profile);
}

export async function establishSessionFromTokenHash(tokenHash,{reason='activate',preferredLanguage=null}={}){
  if(!tokenHash)throw new Error('Session token is unavailable');
  const verify=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:'POST',cache:'no-store',headers:authHeaders(null),body:JSON.stringify({token_hash:tokenHash,type:'email'})});
  const verified=await responseJson(verify),next=normalizedSession(verified);if(!next)throw new Error('Authenticated session could not be established');persist(next);
  const employee=await fetchProfile();if(!employee)throw new Error('Authenticated account is not linked to an active employee');
  dispatch('sindhorn:session-established',{profile:structuredClone(employee),reason,preferredLanguage:preferredLanguage||employee.preferred_language||'th'});
  return{profile:employee,preferredLanguage:preferredLanguage||employee.preferred_language||'th'};
}

export async function activate(employeeNumber,code){
  const rows=await supabaseRpc('sindhorn_manual_activate',{p_employee_number:String(employeeNumber||'').trim(),p_plain_code:String(code||'').trim()},{accessToken:null});
  const result=Array.isArray(rows)?rows[0]:null;
  if(!result?.token_hash){const error=new Error('Employee ID or one-time code is invalid, expired, or temporarily locked.');error.code='activation_invalid';throw error}
  const established=await establishSessionFromTokenHash(result.token_hash,{reason:result.purpose||'activate',preferredLanguage:result.preferred_language});
  dispatch('sindhorn:activation-complete',{profile:structuredClone(established.profile),purpose:result.purpose||'activate',preferredLanguage:established.preferredLanguage});
  return{profile:established.profile,purpose:result.purpose||'activate',preferredLanguage:established.preferredLanguage};
}

export function signInWithMicrosoft(){throw Object.assign(new Error('Microsoft 365 sign-in is not enabled.'),{code:'microsoft_login_disabled'})}
export async function linkMicrosoftIdentity(){throw Object.assign(new Error('Microsoft 365 sign-in is not enabled.'),{code:'microsoft_login_disabled'})}
export async function completeMicrosoftOAuth(){return null}

export async function signOut(){
  const token=session?.access_token;
  clearLocal('signed_out');
  if(!token)return;
  try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',cache:'no-store',headers:authHeaders(token)})}catch(_){}
}

export async function initAuth(){
  if(initialized)return getState();initialized=true;
  session=loadStored();
  if(!session){dispatch('sindhorn:auth-ready',{authenticated:false});return getState()}
  try{await refreshSession();await fetchProfile()}catch(_){clearLocal('session_invalid')}
  dispatch('sindhorn:auth-ready',{authenticated:Boolean(session&&profile),profile:profile?structuredClone(profile):null});return getState();
}

if(hasWindow){
  addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;session=normalizedSession(safeParse(event.newValue||''));profile=null;if(session)fetchProfile().catch(()=>clearLocal('session_invalid'));else dispatch('sindhorn:auth-changed',{authenticated:false,profile:null,reason:'cross_tab_signout'})});
  window.SindhornEmployeeAuth={init:initAuth,activate,establishSessionFromTokenHash,signOut,refresh:refreshSession,fetchProfile,getState,getProfile,getAccessToken,supabaseRpc};
}
