import {createClient} from '@supabase/supabase-js';
import {allowedOrigin,hmacHex,json,normalizeEmail,normalizeEmployeeNumber,validEmail,validEmployeeNumber} from './security.js';

const MAX_BODY_BYTES=4096;
const OTP_WINDOW_SECONDS=15*60;
const OTP_MAX_REQUESTS=6;
const OTP_BLOCK_SECONDS=30*60;

function supabaseAdmin(env){return createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
async function requestJson(request){
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_BODY_BYTES)throw new Error('request_too_large');
  const text=await request.text();if(text.length>MAX_BODY_BYTES)throw new Error('request_too_large');
  try{return JSON.parse(text||'{}')}catch(_){throw new Error('invalid_json')}
}
function normalizePhone(value){
  let raw=String(value??'').trim().replace(/[\s().-]/g,'');
  if(raw.startsWith('00'))raw=`+${raw.slice(2)}`;
  if(raw.startsWith('+66'))raw=`+66${raw.slice(3).replace(/\D/g,'')}`;
  else{
    const digits=raw.replace(/\D/g,'');
    if(/^0\d{8,9}$/.test(digits))raw=`+66${digits.slice(1)}`;
    else if(/^66\d{8,9}$/.test(digits))raw=`+${digits}`;
    else raw=raw.startsWith('+')?`+${digits}`:digits;
  }
  return raw;
}
function validPhone(value){return /^\+[1-9][0-9]{7,14}$/.test(String(value||''))}
function normalizedContact(channel,value){return channel==='sms'?normalizePhone(value):normalizeEmail(value)}
function validContact(channel,value){return channel==='sms'?validPhone(value):validEmail(value)}
function genericRequested(origin,env){return json({ok:true,requested:true,message:'If the Employee ID and contact details match, a one-time code will be sent.',messageTh:'หากรหัสพนักงานและข้อมูลติดต่อถูกต้อง ระบบจะส่งรหัสใช้ครั้งเดียวให้'},200,origin,env)}
function genericInvalid(origin,env,status=401){return json({ok:false,error:'otp_invalid',message:'The code or account details are invalid or expired.',messageTh:'รหัสหรือข้อมูลบัญชีไม่ถูกต้องหรือหมดอายุ'},status,origin,env)}

async function ensureOtpRateSchema(env){
  if(!env.DB)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_contact_otp_rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    blocked_until INTEGER
  )`).run();
}
async function consumeOtpRequest(env,request,employeeNumber){
  if(!env.DB)return{allowed:true};
  await ensureOtpRateSchema(env);
  const rawIp=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hmacHex(env.ACTIVATION_PEPPER,`contact-otp:${rawIp}:${employeeNumber}`);
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
  const key=await hmacHex(env.ACTIVATION_PEPPER,`contact-otp:${rawIp}:${employeeNumber}`);
  await env.DB.prepare('DELETE FROM auth_contact_otp_rate_limits WHERE key=?').bind(key).run();
}

async function lookupContact(client,employeeNumber,channel,contact){
  const {data,error}=await client.rpc('sindhorn_contact_login_lookup',{p_employee_number:employeeNumber,p_channel:channel,p_contact:contact});
  if(error)throw error;
  return Array.isArray(data)&&data.length===1?data[0]:null;
}

async function ensureContactIdentity(client,lookup,channel,contact){
  const loginMethod=channel==='sms'?'personal_phone':'personal_email';
  const provider=channel==='sms'?'phone':'email';
  let userId=lookup.auth_user_id||null,created=false;
  if(userId){
    const {data,error}=await client.auth.admin.getUserById(userId);
    if(error||!data?.user)throw new Error('contact_auth_user_unavailable');
    const update={};
    if(channel==='sms'&&data.user.phone!==contact){update.phone=contact;update.phone_confirm=true}
    if(channel==='email'&&normalizeEmail(data.user.email)!==contact){update.email=contact;update.email_confirm=true}
    if(Object.keys(update).length){
      const {error:updateError}=await client.auth.admin.updateUserById(userId,update);if(updateError)throw updateError;
    }
    return userId;
  }

  const createPayload=channel==='sms'
    ?{phone:contact,phone_confirm:true,app_metadata:{sindhorn_employee_id:lookup.employee_id,sindhorn_internal:true,login_method:loginMethod}}
    :{email:contact,email_confirm:true,app_metadata:{sindhorn_employee_id:lookup.employee_id,sindhorn_internal:true,login_method:loginMethod}};
  const {data:createData,error:createError}=await client.auth.admin.createUser(createPayload);
  if(createError||!createData?.user?.id)throw createError||new Error('contact_auth_create_failed');
  userId=createData.user.id;created=true;
  const {error:identityError}=await client.from('sindhorn_employee_identities').insert({
    employee_id:lookup.employee_id,
    auth_user_id:userId,
    login_method:loginMethod,
    provider,
    provider_subject:contact,
    email:channel==='email'?contact:null,
    last_used_at:null
  });
  if(identityError){if(created)await client.auth.admin.deleteUser(userId).catch(()=>{});throw identityError}
  return userId;
}

async function sendOtp(client,channel,contact){
  if(channel==='sms')return client.auth.signInWithOtp({phone:contact,options:{shouldCreateUser:false}});
  return client.auth.signInWithOtp({email:contact,options:{shouldCreateUser:false}});
}

export async function handleOtpRequest(request,env,origin){
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber),channel=body.channel==='email'?'email':'sms',contact=normalizedContact(channel,body.contact);
  if(!validEmployeeNumber(employeeNumber)||!validContact(channel,contact))return genericRequested(origin,env);
  const rate=await consumeOtpRequest(env,request,employeeNumber);
  if(!rate.allowed)return json({ok:false,error:'too_many_requests',retryAfter:rate.retryAfter,message:'Too many code requests. Try again later.',messageTh:'ขอรหัสหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง'},429,origin,env);

  const client=supabaseAdmin(env);
  let lookup=null;
  try{lookup=await lookupContact(client,employeeNumber,channel,contact)}catch(error){console.error('contact lookup failure',String(error?.message||error));return genericRequested(origin,env)}
  if(!lookup)return genericRequested(origin,env);

  try{
    await ensureContactIdentity(client,lookup,channel,contact);
    const {error}=await sendOtp(client,channel,contact);
    if(error)throw error;
    return env.PREVIEW_MODE==='true'
      ?json({ok:true,requested:true,delivery:'sent',channel},200,origin,env)
      :genericRequested(origin,env);
  }catch(error){
    console.error('contact otp delivery failure',String(error?.message||error));
    return env.PREVIEW_MODE==='true'
      ?json({ok:true,requested:true,delivery:'provider_error',channel},200,origin,env)
      :genericRequested(origin,env);
  }
}

export async function handleOtpVerify(request,env,origin){
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber),channel=body.channel==='email'?'email':'sms',contact=normalizedContact(channel,body.contact),token=String(body.code??'').replace(/\D/g,'').slice(0,8);
  if(!validEmployeeNumber(employeeNumber)||!validContact(channel,contact)||!/^\d{6,8}$/.test(token))return genericInvalid(origin,env);
  const client=supabaseAdmin(env);
  let lookup;try{lookup=await lookupContact(client,employeeNumber,channel,contact)}catch(_){return genericInvalid(origin,env)}
  if(!lookup?.auth_user_id)return genericInvalid(origin,env);

  const verify=channel==='sms'
    ?await client.auth.verifyOtp({phone:contact,token,type:'sms'})
    :await client.auth.verifyOtp({email:contact,token,type:'email'});
  const session=verify.data?.session,user=verify.data?.user;
  if(verify.error||!session?.access_token||!session?.refresh_token||!user?.id||user.id!==lookup.auth_user_id)return genericInvalid(origin,env);

  await client.from('sindhorn_employee_identities').update({last_used_at:new Date().toISOString()}).eq('auth_user_id',user.id).catch(()=>{});
  await client.from('sindhorn_employees').update({activated_at:new Date().toISOString()}).eq('id',lookup.employee_id).is('activated_at',null).catch(()=>{});
  await clearOtpRate(env,request,employeeNumber).catch(()=>{});
  return json({
    ok:true,
    preferredLanguage:lookup.preferred_language==='en'?'en':'th',
    session:{
      access_token:session.access_token,
      refresh_token:session.refresh_token,
      expires_at:session.expires_at,
      token_type:session.token_type||'bearer',
      user:{id:user.id}
    }
  },200,origin,env);
}

export async function handleContactOtpRoute(request,env){
  const url=new URL(request.url),origin=request.headers.get('origin')||'';
  if(!allowedOrigin(origin,env))return json({ok:false,error:'origin_not_allowed'},403,'',env);
  if(url.pathname==='/otp/request'&&request.method==='POST')return handleOtpRequest(request,env,origin);
  if(url.pathname==='/otp/verify'&&request.method==='POST')return handleOtpVerify(request,env,origin);
  return null;
}
