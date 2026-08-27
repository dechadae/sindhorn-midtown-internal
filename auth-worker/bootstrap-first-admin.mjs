import {createClient} from '@supabase/supabase-js';
import {hmacHex,normalizeEmployeeNumber,randomSixDigits,validEmployeeNumber} from './src/security.js';

const required=['SUPABASE_URL','SUPABASE_SECRET_KEY','ACTIVATION_PEPPER','EMPLOYEE_NUMBER'];
for(const name of required){
  if(!process.env[name]){
    console.error(`Missing required environment variable: ${name}`);
    process.exit(2);
  }
}

const employeeNumber=normalizeEmployeeNumber(process.env.EMPLOYEE_NUMBER);
if(!validEmployeeNumber(employeeNumber)){
  console.error('EMPLOYEE_NUMBER is invalid. Use 1-64 letters, numbers, dot, underscore, or hyphen characters.');
  process.exit(2);
}

const displayName=String(process.env.DISPLAY_NAME||'').trim()||null;
const preferredLanguage=String(process.env.PREFERRED_LANGUAGE||'th').toLowerCase()==='en'?'en':'th';
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});

const {data:existingAdmins,error:adminsError}=await supabase
  .from('sindhorn_employees')
  .select('id,employee_number,active')
  .eq('role','super_admin')
  .eq('active',true)
  .limit(2);
if(adminsError)throw adminsError;
if(existingAdmins?.length){
  console.error(`Bootstrap refused: an active super_admin already exists (${existingAdmins[0].employee_number}).`);
  process.exit(3);
}

const {data:existingEmployee,error:employeeLookupError}=await supabase
  .from('sindhorn_employees')
  .select('id,employee_number,role,active,auth_user_id')
  .eq('employee_number',employeeNumber)
  .maybeSingle();
if(employeeLookupError)throw employeeLookupError;

let employee=existingEmployee;
if(employee){
  if(employee.auth_user_id){
    console.error('Bootstrap refused: this employee is already linked to an Auth user.');
    process.exit(3);
  }
  const {data:updated,error:updateError}=await supabase
    .from('sindhorn_employees')
    .update({role:'super_admin',active:true,preferred_language:preferredLanguage,...(displayName?{display_name:displayName}:{})})
    .eq('id',employee.id)
    .select('id,employee_number,role,active,auth_user_id')
    .single();
  if(updateError)throw updateError;
  employee=updated;
}else{
  const {data:inserted,error:insertError}=await supabase
    .from('sindhorn_employees')
    .insert({employee_number:employeeNumber,display_name:displayName,role:'super_admin',active:true,preferred_language:preferredLanguage})
    .select('id,employee_number,role,active,auth_user_id')
    .single();
  if(insertError)throw insertError;
  employee=inserted;
}

const code=randomSixDigits();
const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
const codeHash=await hmacHex(process.env.ACTIVATION_PEPPER,`activation:${employeeNumber}:${code}`);
const {data:activationId,error:issueError}=await supabase.rpc('sindhorn_issue_activation_code',{
  p_employee_id:employee.id,
  p_code_hash:codeHash,
  p_expires_at:expiresAt,
  p_purpose:'activate',
  p_actor_user_id:null
});
if(issueError)throw issueError;
if(!activationId)throw new Error('Activation code RPC returned no activation id');

console.log('First Sindhorn super admin bootstrap created successfully.');
console.log(`Employee ID: ${employeeNumber}`);
console.log(`Activation code: ${code}`);
console.log(`Expires at: ${expiresAt}`);
console.log('Use the activation code once, then discard it. This helper will refuse to run again after an active super_admin exists.');
