import assert from 'node:assert/strict';

const requests=[];
const future=Math.floor(Date.now()/1000)+3600;
const jwtPart=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken=`${jwtPart({alg:'none'})}.${jwtPart({exp:future,sub:'user-1'})}.sig`;
const profile={id:'employee-1',employee_number:'SM001',display_name:'Test Employee',department_id:null,role:'employee',active:true,preferred_language:'th',activated_at:'2026-08-27T00:00:00Z',pin_configured_at:'2026-08-27T00:00:00Z'};

globalThis.fetch=async(url,options={})=>{
  requests.push({url:String(url),options});
  if(String(url).endsWith('/rest/v1/rpc/sindhorn_manual_activate'))return new Response(JSON.stringify([{token_hash:'token-hash',preferred_language:'th',purpose:'activate'}]),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).endsWith('/auth/v1/verify'))return new Response(JSON.stringify({access_token:accessToken,refresh_token:'refresh-1',expires_at:future,token_type:'bearer',user:{id:'user-1'}}),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).endsWith('/rest/v1/rpc/sindhorn_current_employee_profile'))return new Response(JSON.stringify(profile),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).endsWith('/auth/v1/logout'))return new Response('',{status:204});
  throw new Error(`Unexpected request: ${url}`);
};

const auth=await import('../site/auth-client.js?test=phase9-supabase-only');
assert.equal(auth.getState().authenticated,false);
const result=await auth.activate('SM001','123456');
assert.equal(result.profile.employee_number,'SM001');
assert.equal(result.profile.role,'employee');
assert.equal(result.preferredLanguage,'th');
assert.equal(auth.getState().authenticated,true);
assert.equal(auth.getAccessToken(),accessToken);
assert.equal(auth.getState().authBackend,'supabase');
assert.equal(requests.length,3);
assert.match(requests[0].url,/\/rest\/v1\/rpc\/sindhorn_manual_activate$/);
assert.deepEqual(JSON.parse(requests[0].options.body),{p_employee_number:'SM001',p_plain_code:'123456'});
assert.equal(requests[0].options.headers.authorization,undefined);
assert.deepEqual(JSON.parse(requests[1].options.body),{token_hash:'token-hash',type:'email'});
assert.match(requests[2].url,/\/rest\/v1\/rpc\/sindhorn_current_employee_profile$/);
assert.deepEqual(JSON.parse(requests[2].options.body),{});
assert.match(String(requests[2].options.headers.authorization),/^Bearer /);
assert.ok(requests.every(request=>!request.url.includes('workers.dev')));
assert.ok(requests.every(request=>!request.url.includes('/rest/v1/sindhorn_employees')));
await auth.signOut();
assert.equal(auth.getState().authenticated,false);
assert.equal(requests.length,4);
console.log('Supabase-only auth-client tests passed');
