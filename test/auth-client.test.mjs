import assert from 'node:assert/strict';

const requests=[];
const future=Math.floor(Date.now()/1000)+3600;
const jwtPart=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken=`${jwtPart({alg:'none'})}.${jwtPart({exp:future,sub:'user-1'})}.sig`;
const profile={id:'employee-1',employee_number:'SM001',display_name:'Test Employee',department_id:null,role:'employee',active:true,preferred_language:'th',activated_at:'2026-08-27T00:00:00Z'};

globalThis.fetch=async(url,options={})=>{
  requests.push({url:String(url),options});
  if(String(url).endsWith('/activate'))return new Response(JSON.stringify({ok:true,bootstrap:{tokenHash:'bootstrap-hash',type:'email'},preferredLanguage:'th',purpose:'activate'}),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).endsWith('/auth/v1/verify'))return new Response(JSON.stringify({access_token:accessToken,refresh_token:'refresh-1',expires_at:future,token_type:'bearer',user:{id:'user-1'}}),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).includes('/rest/v1/sindhorn_employees'))return new Response(JSON.stringify([profile]),{status:200,headers:{'content-type':'application/json'}});
  if(String(url).endsWith('/auth/v1/logout'))return new Response('',{status:204});
  throw new Error(`Unexpected request: ${url}`);
};

const auth=await import('../site/auth-client.js?test=1');
assert.equal(auth.getState().authenticated,false);
const result=await auth.activate('SM001','123456');
assert.equal(result.profile.employee_number,'SM001');
assert.equal(result.profile.role,'employee');
assert.equal(result.preferredLanguage,'th');
assert.equal(auth.getState().authenticated,true);
assert.equal(auth.getAccessToken(),accessToken);
assert.equal(requests.length,3);
assert.match(requests[0].url,/sindhorn-midtown-auth(?:-preview)?\.decha-dae\.workers\.dev\/activate$/);
assert.deepEqual(JSON.parse(requests[0].options.body),{employeeNumber:'SM001',code:'123456'});
assert.deepEqual(JSON.parse(requests[1].options.body),{token_hash:'bootstrap-hash',type:'email'});
assert.match(String(requests[2].options.headers.authorization),/^Bearer /);
await auth.signOut();
assert.equal(auth.getState().authenticated,false);
assert.equal(requests.length,4);
console.log('auth-client tests passed');
