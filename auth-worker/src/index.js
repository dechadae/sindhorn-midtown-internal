import {createClient} from '@supabase/supabase-js';
import {
  allowedOrigin,bootstrapTokenHash,bearerToken,cors,decodeJwtPayload,hmacHex,json,
  normalizeActivationCode,normalizeEmail,normalizeEmployeeNumber,randomSixDigits,randomToken,syntheticEmail,
  validActivationCode,validEmail,validEmployeeNumber
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

async function resolveEmployeeByAuthUser(client,userId){
  const {data:identity,error:identityError}=await client.from('sindhorn_employee_identities').select('employee_id,login_method,provider').eq('auth_user_id',userId).maybeSingle();
  if(identityError)throw identityError;
  if(identity?.employee_id){
    const {data:employee,error}=await client.from('sindhorn_employees').select('id,employee_number,display_name,work_email,account_type,department_id,role,active,preferred_language,activated_at').eq('id',identity.employee_id).maybeSingle();
    if(error)throw error;
    return employee?{employee,identity}:null;
  }
  const {data:employee,error}=await client.from('sindhorn_employees').select('id,employee_number,display_name,work_email,account_type,department_id,role,active,preferred_language,activated_at').eq('auth_user_id',userId).maybeSingle();
  if(error)throw error;
  return employee?{employee,identity:null}:null;
}

async function adminIdentity(client,request,{requireAal2=true,superOnly=true}={}){
  const token=bearerToken(request);if(!token)return null;
  const {data,error}=await client.auth.getUser(token);if(error||!data?.user)return null;
  const payload=decodeJwtPayload(token);if(requireAal2&&payload?.aal!=='aal2')return null;
  let resolved;try{resolved=await resolveEmployeeByAuthUser(client,data.user.id)}catch(_){return null}
  const employee=resolved?.employee;
  if(!employee?.active)return null;
  if(superOnly&&employee.role!=='super_admin')return null;
  if(!superOnly&&!['admin','super_admin'].includes(employee.role))return null;
  return{user:data.user,employee,identity:resolved.identity,payload};
}

async function upsertEmployeeIdIdentity(client,{employeeId,userId,email}){
  const now=new Date().toISOString();
  const {data:existing,error:existingError}=await client.from('sindhorn_employee_identities').select('id,employee_id,auth_user_id').eq('employee_id',employeeId).eq('login_method','employee_id').maybeSingle();
  if(existingError)throw existingError;
  if(existing&&existing.auth_user_id!==userId)throw new Error('employee_id_identity_conflict');
  if(existing){
    const {error}=await client.from('sindhorn_employee_identities').update({last_used_at:now,email:normalizeEmail(email)||null}).eq('id',existing.id);
    if(error)throw error;
    return;
  }
  const {error}=await client.from('sindhorn_employee_identities').insert({
    employee_id:employeeId,auth_user_id:userId,login_method:'employee_id',provider:'internal',provider_subject:userId,email:normalizeEmail(email)||null,last_used_at:now
  });
  if(error)throw error;
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
    await upsertEmployeeIdIdentity(client,{employeeId:claim.employee_id,userId,email});

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

function azureIdentity(user){
  const identities=Array.isArray(user?.identities)?user.identities:[];
  const identity=identities.find(item=>item?.provider==='azure')||null;
  const providers=Array.isArray(user?.app_metadata?.providers)?user.app_metadata.providers:[];
  const provider=user?.app_metadata?.provider;
  if(!identity&&provider!=='azure'&&!providers.includes('azure'))return null;
  const subject=String(identity?.id||identity?.identity_data?.sub||user?.id||'').trim();
  const email=normalizeEmail(user?.email||identity?.identity_data?.email||identity?.identity_data?.preferred_username||'');
  return{identity,subject,email};
}

async function handleMicrosoftLink(request,env,origin){
  if(!configured(env))return json({ok:false,error:'service_not_configured'},503,origin,env);
  const token=bearerToken(request);if(!token)return json({ok:false,error:'authentication_required'},401,origin,env);
  const client=supabaseAdmin(env);
  const {data,error}=await client.auth.getUser(token);
  const user=data?.user;
  if(error||!user)return json({ok:false,error:'authentication_required'},401,origin,env);
  const azure=azureIdentity(user);
  if(!azure||!validEmail(azure.email)||!user.email_confirmed_at)return json({ok:false,error:'microsoft_identity_unverified'},403,origin,env);

  const {data:employee,error:employeeError}=await client.from('sindhorn_employees')
    .select('id,employee_number,display_name,work_email,account_type,department_id,role,active,preferred_language,activated_at')
    .eq('work_email',azure.email).eq('active',true).maybeSingle();
  if(employeeError)return json({ok:false,error:'identity_lookup_failed'},503,origin,env);
  if(!employee)return json({ok:false,error:'employee_not_provisioned',message:'This Microsoft 365 account has not been provisioned for Sindhorn Midtown Internal.',messageTh:'บัญชี Microsoft 365 นี้ยังไม่ได้รับสิทธิ์ใช้งาน Sindhorn Midtown Internal'},403,origin,env);

  const {data:byUser,error:byUserError}=await client.from('sindhorn_employee_identities').select('id,employee_id,login_method,auth_user_id').eq('auth_user_id',user.id).maybeSingle();
  if(byUserError)return json({ok:false,error:'identity_lookup_failed'},503,origin,env);
  if(byUser&&byUser.employee_id!==employee.id)return json({ok:false,error:'identity_already_linked'},409,origin,env);
  if(byUser&&byUser.login_method!=='microsoft365')return json({ok:false,error:'identity_method_conflict'},409,origin,env);

  const {data:byEmployee,error:byEmployeeError}=await client.from('sindhorn_employee_identities').select('id,auth_user_id').eq('employee_id',employee.id).eq('login_method','microsoft365').maybeSingle();
  if(byEmployeeError)return json({ok:false,error:'identity_lookup_failed'},503,origin,env);
  if(byEmployee&&byEmployee.auth_user_id!==user.id)return json({ok:false,error:'microsoft_identity_already_linked'},409,origin,env);

  const values={provider_subject:azure.subject||user.id,email:azure.email,last_used_at:new Date().toISOString()};
  if(byEmployee){
    const {error:updateError}=await client.from('sindhorn_employee_identities').update(values).eq('id',byEmployee.id);
    if(updateError)return json({ok:false,error:'identity_link_failed'},503,origin,env);
  }else{
    const {error:insertError}=await client.from('sindhorn_employee_identities').insert({employee_id:employee.id,auth_user_id:user.id,login_method:'microsoft365',provider:'azure',...values});
    if(insertError)return json({ok:false,error:'identity_link_failed'},503,origin,env);
  }

  return json({ok:true,profile:employee,loginMethod:'microsoft365'},200,origin,env);
}

async function handleIssueCode(request,env,origin){
  if(!configured(env))return json({ok:false,error:'service_not_configured'},503,origin,env);
  const client=supabaseAdmin(env),admin=await adminIdentity(client,request);
  if(!admin)return json({ok:false,error:'reauthentication_required'},403,origin,env);
  let body;try{body=await requestJson(request)}catch(error){return json({ok:false,error:String(error.message||error)},400,origin,env)}
  const employeeNumber=normalizeEmployeeNumber(body.employeeNumber);if(!validEmployeeNumber(employeeNumber))return json({ok:false,error:'invalid_employee_number'},400,origin,env);
  const {data:employee,error}=await client.from('sindhorn_employees').select('id,auth_user_id,active,preferred_language').eq('employee_number',employeeNumber).eq('active',true).maybeSingle();
  if(error||!employee)return json({ok:false,error:'employee_not_found'},404,origin,env);
  const {data:internalIdentity}=await client.from('sindhorn_employee_identities').select('id').eq('employee_id',employee.id).eq('login_method','employee_id').maybeSingle();
  const purpose=(employee.auth_user_id||internalIdentity)?'recovery':'activate',code=randomSixDigits();
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
  if(url.pathname==='/microsoft/link'&&request.method==='POST')return handleMicrosoftLink(request,env,origin);
  if(url.pathname==='/admin/activation-code'&&request.method==='POST')return handleIssueCode(request,env,origin);
  return json({ok:false,error:'not_found'},404,origin,env);
}

export default{fetch:handle};
