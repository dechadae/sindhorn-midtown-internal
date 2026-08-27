const encoder=new TextEncoder();

export const PREVIEW_ORIGIN=/^https:\/\/[a-z0-9-]+\.sindhorn-midtown-internal\.pages\.dev$/i;
export const normalizeEmployeeNumber=value=>String(value??'').trim().toUpperCase();
export const normalizeActivationCode=value=>String(value??'').replace(/\D/g,'').slice(0,12);
export const validEmployeeNumber=value=>/^[A-Z0-9._-]{1,64}$/.test(normalizeEmployeeNumber(value));
export const validActivationCode=value=>/^\d{6}$/.test(normalizeActivationCode(value));
export const syntheticEmail=employeeId=>`smi-${String(employeeId||'').toLowerCase().replace(/[^a-f0-9]/g,'')}@auth.invalid`;

export function base64Url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
export function randomToken(bytes=32){const value=new Uint8Array(bytes);crypto.getRandomValues(value);return base64Url(value)}
export function randomSixDigits(){const value=new Uint32Array(1);crypto.getRandomValues(value);return String(value[0]%1_000_000).padStart(6,'0')}

export async function hmacHex(secret,message){
  const key=await crypto.subtle.importKey('raw',encoder.encode(String(secret||'')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(String(message||'')));
  return[...new Uint8Array(signature)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function allowedOrigin(origin,env){
  if(!origin)return false;
  return origin===env.ALLOWED_ORIGIN||(env.PREVIEW_MODE==='true'&&PREVIEW_ORIGIN.test(origin));
}
export function cors(origin,env){return allowedOrigin(origin,env)?{'access-control-allow-origin':origin,'vary':'Origin'}:{}}
export function json(value,status=200,origin='',env={}){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(origin,env)}})}

export function bearerToken(request){const value=request.headers.get('authorization')||'';const match=value.match(/^Bearer\s+(.+)$/i);return match?.[1]?.trim()||null}
export function decodeJwtPayload(token){
  try{
    const part=String(token||'').split('.')[1];if(!part)return null;
    const base=part.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(part.length/4)*4,'=');
    return JSON.parse(atob(base));
  }catch(_){return null}
}

export function bootstrapTokenHash(linkData){
  const properties=linkData?.properties||{};
  const direct=properties.hashed_token||properties.hashedToken||properties.token_hash||properties.tokenHash;
  if(direct)return String(direct);
  const action=properties.action_link||properties.actionLink;
  if(!action)return null;
  try{return new URL(action).searchParams.get('token')||new URL(action).searchParams.get('token_hash')}catch(_){return null}
}
