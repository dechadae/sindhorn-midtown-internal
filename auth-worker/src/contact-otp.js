import {createClient} from '@supabase/supabase-js';
import {allowedOrigin,bootstrapTokenHash,hmacHex,json,normalizeEmail,normalizeEmployeeNumber,randomSixDigits,validEmail,validEmployeeNumber} from './security.js';

const MAX_BODY_BYTES=4096;
const OTP_TTL_SECONDS=5*60;
const OTP_VERIFY_MAX_ATTEMPTS=5;
const OTP_RESEND_COOLDOWN_SECONDS=60;
const OTP_WINDOW_SECONDS=15*60;
const OTP_MAX_REQUESTS=6;
const OTP_BLOCK_SECONDS=30*60;
const TURNSTILE_VERIFY_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';
const BREVO_SEND_URL='https://api.brevo.com/v3/smtp/email';
const TURNSTILE_TEST_SECRET='1x0000000000000000000000000000000AA';

function supabaseAdmin(env){return createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
async function requestJson(request){
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_BODY_BYTES)throw new Error('request_too_large');
  const text=await request.text();if(text.length>MAX_BODY_BYTES)throw new Error('request_too_large');
  try{return JSON.parse(text||'{}')}catch(_){throw new Error('invalid_json')}
}
function genericRequested(origin,env){return json({ok:true,requested:true,message:'If the Employee ID and personal email match our records, a sign-in code will be sent.',messageTh:'หากรหัสพนักงานและอีเมลส่วนตัวตรงกับข้อมูลในระบบ ระบบจะส่งรหัสเข้าสู่ระบบให้'},200,origin,env)}
function genericInvalid(origin,env,status=401){return json({ok:false,error:'otp_invalid',message:'The code or account details are invalid or expired.',messageTh:'รหัสหรือข้อมูลบัญชีไม่ถูกต้องหรือหมดอายุ'},status,origin,env)}
function syntheticPersonalEmail(employeeId){return `smi-${String(employeeId||'').toLowerCase().replace(/[^a-f0-9]/g,'')}-personal-email@auth.invalid`}
function fixedEqual(a,b){
  const left=String(a||''),right=String(b||'');if(left.length!==right.length)return false;
  let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;
}
function preview(env){return env.PREVIEW_MODE==='true'}
function brevoConfigured(env){return Boolean(env.BREVO_API_KEY&&env.BREVO_SENDER_EMAIL)}
function turnstileConfigured(env){return preview(env)||Boolean(env.TURNSTILE_SECRET_KEY)}

async function ensureOtpSchema(env){
  if(!env.DB)return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_email_otp_challenges (
      key TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      contact_hash TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at INTEGER,
      last_sent_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_contact_otp_rate_limits (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      blocked_until INTEGER
    )`)
  ]);
}
async function consumeOtpRequest(env,request,employeeNumber){
  if(!env.DB)return{allowed:true};
  await ensureOtpSchema(env);
  const rawIp=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hmacHex(env.ACTIVATION_PEPPER,`email-otp-rate:${rawIp}:${employeeNumber}`);
  const now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare('SELECT window_start,attempts,blocked_until FROM auth_contact_otp_rate_limits WHERE key=?').bind(key).first();
  if(row?.blocked_until&&Number(row.blocked_until)>now)return{allowed:false,retryAfter:Number(row.blocked_until)-now};
  let windowStart=Number(row?.window_start)||now,attempts=Number(row?.attempts)||0;
  if(now-windowStart>=OTP_WINDOW_SECONDS){windowStart=now;attempts=0}
  attempts++;
  const blockedUntil=attempts>OTP_MAX_REQUESTS?now+OTP_BLOCK_SECONDS:null;
  await env.DB.prepare(`INSERT INTO auth_contact_otp_rate_limits(key,window_start,attempts,blocked_until)
    VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts,blocked_until=excluded.blocked_until`)
    .bind(key,windowStart,attempts,blockedUntil).run();
  return blockedUntil?{allowed:false,retryAfter:OTP_BLOCK_SECONDS}:{allowed:true};
}
async function clearOtpRate(env,request,employeeNumber){
  if(!env.DB)return;
  const rawIp=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hmacHex(env.ACTIVATION_PEPPER,`email-otp-rate:${rawIp}:${employeeNumber}`);
  await env.DB.prepare('DELETE FROM auth_contact_otp_rate_limits WHERE key=?').bind(key).run();
}
async function lookupContact(client,employeeNumber,email){
  const {data,error}=await client.rpc('sindhorn_contact_login_lookup',{p_employee_number:employeeNumber,p_channel:'email',p_contact:email});
  if(error)throw error;
  return Array.isArray(data)&&data.length===1?data[0]:null;
}
async function challengeKey(env,employeeId,email){
  const contactHash=await hmacHex(env.ACTIVATION_PEPPER,`personal-email:${normalizeEmail(email)}`);
  const key=await hmacHex(env.ACTIVATION_PEPPER,`email-otp-challenge:${employeeId}:${contactHash}`);
  return{key,contactHash};
}
async function validateTurnstile(request,env,token){
  if(!turnstileConfigured(env))return{ok:false,error:'turnstile_not_configured'};
  if(!token)return{ok:false,error:'turnstile_required'};
  const secret=preview(env)?TURNSTILE_TEST_SECRET:env.TURNSTILE_SECRET_KEY;
  const body=new FormData();body.set('secret',secret);body.set('response',String(token));
  const ip=request.headers.get('cf-connecting-ip');if(ip)body.set('remoteip',ip);
  try{
    const response=await fetch(TURNSTILE_VERIFY_URL,{method:'POST',body});
    const result=await response.json().catch(()=>null);
    return result?.success===true?{ok:true}:{ok:false,error:'turnstile_failed'};
  }catch(_){return{ok:false,error:'turnstile_unavailable'}}
}
function emailContent(code,language){
  const thai=language==='th';
  const subject=thai?'รหัสเข้าสู่ระบบ Sindhorn Midtown Internal':'Sindhorn Midtown Internal sign-in code';
  const text=thai
    ?`รหัสเข้าสู่ระบบของคุณคือ ${code}\n\nรหัสนี้ใช้ได้ 5 นาทีและใช้ได้ครั้งเดียว\nหากคุณไม่ได้ขอรหัสนี้ ไม่ต้องดำเนินการใด ๆ`
    :`Your sign-in code is ${code}\n\nThis code expires in 5 minutes and can be used once.\nIf you did not request this code, you can ignore this email.`;
  const html=thai
    ?`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717"><p>รหัสเข้าสู่ระบบ Sindhorn Midtown Internal</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>รหัสนี้ใช้ได้ 5 นาทีและใช้ได้ครั้งเดียว</p><p style="color:#666">หากคุณไม่ได้ขอรหัสนี้ ไม่ต้องดำเนินการใด ๆ</p></div>`
    :`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717"><p>Your Sindhorn Midtown Internal sign-in code</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>This code expires in 5 minutes and can be used once.</p><p style="color:#666">If you did not request this code, you can ignore this email.</p></div>`;
  return{subject,text,html};
}
async function sendBrevoOtp(env,{to,displayName,code,language}){
  if(!brevoConfigured(env))throw new Error('brevo_not_configured');
  const content=emailContent(code,language);
  const response=await fetch(BREVO_SEND_URL,{
    method:'POST',
    headers:{accept:'application/json','api-key':env.BREVO_API_KEY,'content-type':'application/json'},
    body:JSON.stringify({
      sender:{email:env.BREVO_SENDER_EMAIL,name:env.BREVO_SENDER_NAME||'Sindhorn Midtown Internal'},
      to:[{email:to,name:displayName||undefined}],
      subject:content.subject,
      htmlContent:content.html,
      textContent:content.text,
      tags:['sindhorn-internal-otp']
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.messageId)throw new Error(`brevo_send_failed_${response.status}`);
  return data.messageId;
}
async function ensurePersonalEmailIdentity(client,lookup,contactHash){
  let userId=lookup.auth_user_id||null,created=false,email=null;
  if(userId){
    const {data,error}=await client.auth.admin.getUserById(userId);if(error||!data?.user?.email)throw error||new Error('email_auth_user_unavailable');
    email=data.user.email;
  }else{
    email=syntheticPersonalEmail(lookup.employee_id);
    const {data,error}=await client.auth.admin.createUser({email,email_confirm:true,app_metadata:{sindhorn_employee_id:lookup.employee_id,sindhorn_internal:true,login_method:'personal_email'}});
    if(error||!data?.user?.id)throw error||new Error('email_auth_create_failed');
    userId=data.user.id;email=data.user.email||email;created=true;
    const {error:identityError}=await client.from('sindhorn_employee_identities').insert({
      employee_id:lookup.employee_id,
      auth_user_id:userId,
      login_method:'personal_email',
      provider:'email',
      provider_subject:contactHash,
      email:null,
      last_used_at:null
    });
    if(identityError){if(created)await client.auth.admin.deleteUser(userId).catch(()=>{});throw identityError}
  }
  return{userId,email,created};
}

export async function handleOtpRequest(request,env,origin){
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber),email=normalizeEmail(body.email||body.contact),turnstileToken=String(body.turnstileToken||'');
  if(!validEmployeeNumber(employeeNumber)||!validEmail(email))return genericRequested(origin,env);

  const turnstile=await validateTurnstile(request,env,turnstileToken);
  if(!turnstile.ok)return json({ok:false,error:turnstile.error,message:'Please complete the security check and try again.',messageTh:'กรุณาผ่านการตรวจสอบความปลอดภัยแล้วลองอีกครั้ง'},403,origin,env);

  const rate=await consumeOtpRequest(env,request,employeeNumber);
  if(!rate.allowed)return json({ok:false,error:'too_many_requests',retryAfter:rate.retryAfter,message:'Too many code requests. Try again later.',messageTh:'ขอรหัสหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง'},429,origin,env);

  const client=supabaseAdmin(env);
  let lookup=null;
  try{lookup=await lookupContact(client,employeeNumber,email)}catch(error){console.error('email otp contact lookup failure',String(error?.message||error));return genericRequested(origin,env)}
  if(!lookup)return genericRequested(origin,env);

  await ensureOtpSchema(env);
  const now=Math.floor(Date.now()/1000),{key,contactHash}=await challengeKey(env,lookup.employee_id,email);
  const prior=await env.DB?.prepare('SELECT last_sent_at FROM auth_email_otp_challenges WHERE key=?').bind(key).first();
  if(prior?.last_sent_at&&now-Number(prior.last_sent_at)<OTP_RESEND_COOLDOWN_SECONDS){
    const retryAfter=OTP_RESEND_COOLDOWN_SECONDS-(now-Number(prior.last_sent_at));
    return json({ok:false,error:'resend_too_soon',retryAfter,message:'Please wait before requesting another code.',messageTh:'กรุณารอสักครู่ก่อนขอรหัสใหม่'},429,origin,env);
  }

  const code=randomSixDigits(),codeHash=await hmacHex(env.ACTIVATION_PEPPER,`email-otp:${lookup.employee_id}:${contactHash}:${code}`),expiresAt=now+OTP_TTL_SECONDS;
  await env.DB?.prepare(`INSERT INTO auth_email_otp_challenges(key,employee_id,contact_hash,code_hash,created_at,expires_at,attempts,consumed_at,last_sent_at)
    VALUES(?,?,?,?,?,?,0,NULL,?) ON CONFLICT(key) DO UPDATE SET code_hash=excluded.code_hash,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0,consumed_at=NULL,last_sent_at=excluded.last_sent_at`)
    .bind(key,String(lookup.employee_id),contactHash,codeHash,now,expiresAt,now).run();

  try{
    const messageId=await sendBrevoOtp(env,{to:email,displayName:'',code,language:lookup.preferred_language==='en'?'en':'th'});
    return preview(env)
      ?json({ok:true,requested:true,delivery:'sent',provider:'brevo',messageIdPresent:Boolean(messageId),expiresIn:OTP_TTL_SECONDS},200,origin,env)
      :genericRequested(origin,env);
  }catch(error){
    await env.DB?.prepare('DELETE FROM auth_email_otp_challenges WHERE key=?').bind(key).run().catch(()=>{});
    console.error('email otp delivery failure',String(error?.message||error));
    return preview(env)
      ?json({ok:true,requested:true,delivery:brevoConfigured(env)?'provider_error':'not_configured',provider:'brevo'},200,origin,env)
      :genericRequested(origin,env);
  }
}

export async function handleOtpVerify(request,env,origin){
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber),email=normalizeEmail(body.email||body.contact),code=String(body.code??'').replace(/\D/g,'').slice(0,6);
  if(!validEmployeeNumber(employeeNumber)||!validEmail(email)||!/^\d{6}$/.test(code))return genericInvalid(origin,env);
  const client=supabaseAdmin(env);
  let lookup;try{lookup=await lookupContact(client,employeeNumber,email)}catch(_){return genericInvalid(origin,env)}
  if(!lookup)return genericInvalid(origin,env);

  await ensureOtpSchema(env);
  const now=Math.floor(Date.now()/1000),{key,contactHash}=await challengeKey(env,lookup.employee_id,email);
  const challenge=await env.DB?.prepare('SELECT code_hash,expires_at,attempts,consumed_at FROM auth_email_otp_challenges WHERE key=?').bind(key).first();
  if(!challenge||challenge.consumed_at||Number(challenge.expires_at)<=now||Number(challenge.attempts)>=OTP_VERIFY_MAX_ATTEMPTS)return genericInvalid(origin,env);
  const expected=await hmacHex(env.ACTIVATION_PEPPER,`email-otp:${lookup.employee_id}:${contactHash}:${code}`);
  if(!fixedEqual(expected,challenge.code_hash)){
    await env.DB?.prepare('UPDATE auth_email_otp_challenges SET attempts=attempts+1 WHERE key=? AND consumed_at IS NULL').bind(key).run();
    return genericInvalid(origin,env);
  }
  const claimed=await env.DB?.prepare('UPDATE auth_email_otp_challenges SET consumed_at=? WHERE key=? AND consumed_at IS NULL AND expires_at>? AND code_hash=?').bind(now,key,now,expected).run();
  if(!claimed?.meta?.changes)return genericInvalid(origin,env);

  let identity=null;
  try{
    identity=await ensurePersonalEmailIdentity(client,lookup,contactHash);
    const {data:linkData,error:linkError}=await client.auth.admin.generateLink({type:'magiclink',email:identity.email});
    const tokenHash=bootstrapTokenHash(linkData);
    if(linkError||!tokenHash)throw linkError||new Error('bootstrap_token_failed');
    const timestamp=new Date().toISOString();
    await client.from('sindhorn_employee_identities').update({last_used_at:timestamp,provider_subject:contactHash,email:null}).eq('auth_user_id',identity.userId);
    await client.from('sindhorn_employees').update({activated_at:timestamp}).eq('id',lookup.employee_id).is('activated_at',null);
    await clearOtpRate(env,request,employeeNumber).catch(()=>{});
    return json({ok:true,bootstrap:{tokenHash,type:'email'},preferredLanguage:lookup.preferred_language==='en'?'en':'th',loginMethod:'personal_email'},200,origin,env);
  }catch(error){
    console.error('email otp verification bootstrap failure',String(error?.message||error));
    return json({ok:false,error:'otp_session_unavailable',message:'The code was accepted but sign-in could not be completed. Request a new code and try again.',messageTh:'รหัสถูกต้อง แต่ไม่สามารถเข้าสู่ระบบได้ กรุณาขอรหัสใหม่แล้วลองอีกครั้ง'},503,origin,env);
  }
}

export function emailOtpHealth(env){return{emailOtpConfigured:brevoConfigured(env),brevoConfigured:brevoConfigured(env),turnstileConfigured:turnstileConfigured(env),previewTurnstile:preview(env)}}

export async function handleContactOtpRoute(request,env){
  const url=new URL(request.url),origin=request.headers.get('origin')||'';
  if(!allowedOrigin(origin,env))return json({ok:false,error:'origin_not_allowed'},403,'',env);
  if(url.pathname==='/otp/request'&&request.method==='POST')return handleOtpRequest(request,env,origin);
  if(url.pathname==='/otp/verify'&&request.method==='POST')return handleOtpVerify(request,env,origin);
  return null;
}
