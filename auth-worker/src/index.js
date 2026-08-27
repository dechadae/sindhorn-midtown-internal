import {createClient} from '@supabase/supabase-js';
import {
  allowedOrigin,bootstrapTokenHash,bearerToken,cors,decodeJwtPayload,hmacHex,json,
  normalizeActivationCode,normalizeEmployeeNumber,randomSixDigits,randomToken,syntheticEmail,
  validActivationCode,validEmployeeNumber
} from './security.js';
import {clearActivationRate,consumeActivationAttempt,ensureRateSchema} from './rate-limit.js';

const SERVICE='sindhorn-midtown-auth';
const ACTIVATION_TTL_MINUTES=15;
const CLAIM_TTL_SECONDS=300;
const MAX_BODY_BYTES=4096;

function configured(env){return Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&env.ACTIVATION_PEPPER&&env.ALLOWED_ORIGIN)}
function supabaseAdmin(env){return createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
async function requestJson(request){
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_BODY_BYTES)throw new Error('request_too_large');
  const text=await request.text();if(text.length>MAX_BODY_BYTES)throw new Error('request_too_large');
  try{return JSON.parse(text||'{}')}catch(_){throw new Error('invalid_json')}
}
function genericActivationError(origin,env,status=401){return json({ok:false,error:'activation_invalid',message:'Employee ID or activation code is invalid, expired, or temporarily locked.',messageTh:'รหัสพนักงานหรือรหัสเปิดใช้งานไม่ถูกต้อง หมดอายุ หรือถูกล็อกชั่วคราว'},status,origin,env)}

async function adminIdentity(client,request){
  const token=bearerToken(request);if(!token)return null;
  const {data,error}=await client.auth.getUser(token);if(error||!data?.user)return null;
  const payload=decodeJwtPayload(token);if(payload?.aal!=='aal2')return null;
  const {data:employee,error:employeeError}=await client.from('sindhorn_employees').select('id,role,active').eq('auth_user_id',data.user.id).eq('active',true).maybeSingle();
  if(employeeError||!employee||employee.role!=='super_admin')return null;
  return{user:data.user,employee};
}

async function handleActivate(request,env,origin){
  if(!configured(env))return json({ok:false,error:'service_not_configured'},503,origin,env);
  const rate=await consumeActivationAttempt(env,request);
  if(!rate.allowed)return json({ok:false,error:'too_many_attempts',retryAfter:rate.retryAfter,message:'Too many activation attempts. Try again later.',messageTh:'ลองเปิดใช้งานหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง'},429,origin,env);

  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber),code=normalizeActivationCode(body.code);
  if(!validEmployeeNumber(employeeNumber)||!validActivationCode(code))return genericActivationError(origin,env);

  const client=supabaseAdmin(env);
  const claimToken=randomToken(32);
  const [codeHash,claimHash]=await Promise.all([
    hmacHex(env.ACTIVATION_PEPPER,`activation:${employeeNumber}:${code}`),
    hmacHex(env.ACTIVATION_PEPPER,`claim:${claimToken}`)
  ]);
  const {data:prepared,error:prepareError}=await client.rpc('sindhorn_activation_prepare',{
    p_employee_number:employeeNumber,p_code_hash:codeHash,p_claim_hash:claimHash,p_claim_ttl_seconds:CLAIM_TTL_SECONDS
  });
  if(prepareError||!Array.isArray(prepared)||prepared.length!==1)return genericActivationError(origin,env);

  const claim=prepared[0];
  let userId=claim.auth_user_id||null,email=null,createdNew=false;
  try{
    if(!userId){
      email=syntheticEmail(claim.employee_id);
      const {data:createData,error:createError}=await client.auth.admin.createUser({
        email,email_confirm:true,app_metadata:{sindhorn_employee_id:claim.employee_id,sindhorn_internal:true}
      });
      if(createError||!createData?.user?.id)throw new Error('auth_create_failed');
      userId=createData.user.id;email=createData.user.email||email;createdNew=true;
    }else{
      const {data:userData,error:userError}=await client.auth.admin.getUserById(userId);
      if(userError||!userData?.user?.email)throw new Error('auth_user_unavailable');
      email=userData.user.email;
    }

    const {data:finalized,error:finalizeError}=await client.rpc('sindhorn_activation_finalize',{
      p_employee_id:claim.employee_id,p_claim_hash:claimHash,p_auth_user_id:userId
    });
    if(finalizeError||finalized!==true)throw new Error('activation_finalize_failed');

    const {data:linkData,error:linkError}=await client.auth.admin.generateLink({type:'magiclink',email});
    const tokenHash=bootstrapTokenHash(linkData);
    if(linkError||!tokenHash)throw new Error('bootstrap_token_failed');
    await clearActivationRate(env,request).catch(()=>{});
    return json({
      ok:true,
      bootstrap:{tokenHash,type:'email'},
      preferredLanguage:claim.preferred_language==='en'?'en':'th',
      purpose:claim.purpose
    },200,origin,env);
  }catch(error){
    await client.rpc('sindhorn_activation_release_claim',{p_employee_id:claim.employee_id,p_claim_hash:claimHash}).catch(()=>{});
    if(createdNew&&userId)await client.auth.admin.deleteUser(userId).catch(()=>{});
    console.error('activation broker failure',String(error?.message||error));
    return json({ok:false,error:'activation_unavailable',message:'Activation could not be completed. Please try again or ask an administrator for a new code.',messageTh:'ไม่สามารถเปิดใช้งานได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลเพื่อขอรหัสใหม่'},503,origin,env);
  }
}

async function handleIssueCode(request,env,origin){
  if(!configured(env))return json({ok:false,error:'service_not_configured'},503,origin,env);
  const client=supabaseAdmin(env),admin=await adminIdentity(client,request);
  if(!admin)return json({ok:false,error:'reauthentication_required'},403,origin,env);
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber);if(!validEmployeeNumber(employeeNumber))return json({ok:false,error:'invalid_employee_number'},400,origin,env);
  const {data:employee,error}=await client.from('sindhorn_employees').select('id,auth_user_id,active,preferred_language').eq('employee_number',employeeNumber).eq('active',true).maybeSingle();
  if(error||!employee)return json({ok:false,error:'employee_not_found'},404,origin,env);
  const purpose=employee.auth_user_id?'recovery':'activate',code=randomSixDigits();
  const codeHash=await hmacHex(env.ACTIVATION_PEPPER,`activation:${employeeNumber}:${code}`);
  const expiresAt=new Date(Date.now()+ACTIVATION_TTL_MINUTES*60*1000).toISOString();
  const {data:activationId,error:issueError}=await client.rpc('sindhorn_issue_activation_code',{
    p_employee_id:employee.id,p_code_hash:codeHash,p_expires_at:expiresAt,p_purpose:purpose,p_actor_user_id:admin.user.id
  });
  if(issueError||!activationId)return json({ok:false,error:'activation_code_issue_failed'},500,origin,env);
  return json({ok:true,employeeNumber,code,purpose,expiresAt,preferredLanguage:employee.preferred_language==='en'?'en':'th'},200,origin,env);
}

async function handle(request,env){
  const url=new URL(request.url),origin=request.headers.get('origin')||'';
  if(request.method==='OPTIONS'){
    if(!allowedOrigin(origin,env))return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{...cors(origin,env),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization','access-control-max-age':'600'}});
  }
  if(url.pathname==='/health'&&request.method==='GET'){
    await ensureRateSchema(env).catch(()=>{});
    return json({ok:true,service:SERVICE,configured:configured(env),supabaseConfigured:Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY),pepperConfigured:Boolean(env.ACTIVATION_PEPPER),databaseConfigured:Boolean(env.DB)},200,origin,env);
  }
  if(!allowedOrigin(origin,env))return json({ok:false,error:'origin_not_allowed'},403,'',env);
  if(url.pathname==='/activate'&&request.method==='POST')return handleActivate(request,env,origin);
  if(url.pathname==='/admin/activation-code'&&request.method==='POST')return handleIssueCode(request,env,origin);
  return json({ok:false,error:'not_found'},404,origin,env);
}

export default{fetch:handle};
