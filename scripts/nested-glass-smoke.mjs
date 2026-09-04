/* THE RULE: glass only where it touches the atmosphere.

   backdrop-filter cannot sample past an ancestor that already has one, so a
   glass element inside a glass element renders as a flat fill however it is
   styled. This was measured, not assumed: an identical dropdown blurred
   correctly on /fnb and not at all on /ci, purely because the CI specimen
   container was itself glass. The spec page was showing every glass component
   falsely.

   app-glass-runtime.js refuses to stamp glass inside glass, but a route can
   still declare backdrop-filter directly in its own stylesheet, which is how
   .fnb-action-control acquired an inert blur. This catches that.

   Usage: BASE_URL=https://<preview>.pages.dev node scripts/nested-glass-smoke.mjs
*/
import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const ROUTES=[['/#signin','[data-signin-form]'],
              ['/','.app-page'],['/#fnb','.app-action-card'],['/#fnb/negroni-week','.app-rail'],
              ['/#brand','.app-action-card'],['/#brand/history','#periods'],['/#brand/factsheet','.app-rail'],
              ['/#messages','.app-state'],['/#settings/me','.app-metric'],['/#settings/admin','.app-search'],['/#settings/broadcast','.app-utility-action'],['/#settings/system','.app-metric'],
              ['/ci','.app-page']];

/* The shell gates every route behind sign-in. The sign-in route is scanned
   signed out; every route after it is scanned with a stand-in session
   seeded into localStorage (a syntactically valid token that never reaches
   the database - the profile RPC is answered here) so the real pages mount.
   No credential is involved: the F&B read model is answered by forwarding
   to its public twin, and everything else renders its honest error state. */
const fakeJwt=()=>{const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');return `${b64({alg:'none',typ:'JWT'})}.${b64({sub:'00000000-0000-0000-0000-000000000001',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})}.smoke`};
const seedSession=token=>{localStorage.setItem('sindhorn-midtown-auth-session-v1',JSON.stringify({access_token:token,refresh_token:'smoke',expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user:null}))};
const authProfile={id:'00000000-0000-0000-0000-000000000001',employee_number:'10639',display_name:'CI Developer',role:'super_admin',work_email:null,pin_configured_at:new Date().toISOString(),active:true};

const manifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',role:'super_admin',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','system.manage','developer.ui_library','broadcasts.manage'],sections:[{key:'account',label:'Account',navLabel:'Account',renderer:'account',sortOrder:10,config:{}}]};

/* Bundled chromium on CI; the system channel locally, where the bundled
   browsers can be missing. */
async function launch(){
  try{return await chromium.launch()}
  catch(_){return await chromium.launch({channel:'chrome'})}
}

const scan=()=>{
  const blur=v=>typeof v==='string'&&/blur\((?!0(px)?\))/.test(v);
  const name=el=>(el.tagName.toLowerCase()+(el.className?'.'+String(el.className).trim().split(/\s+/).slice(0,2).join('.'):'')).slice(0,48);
  const out=[];
  for(const el of document.querySelectorAll('*')){
    const cs=getComputedStyle(el);
    if(!blur(cs.backdropFilter)&&!blur(cs.webkitBackdropFilter))continue;
    const rect=el.getBoundingClientRect();
    if(rect.width<20||rect.height<12)continue;
    for(let parent=el.parentElement;parent;parent=parent.parentElement){
      const pcs=getComputedStyle(parent);
      if(blur(pcs.backdropFilter)||blur(pcs.webkitBackdropFilter)){out.push({el:name(el),inside:name(parent)});break}
    }
  }
  const seen=new Set();
  return out.filter(r=>{const k=r.el+'|'+r.inside;if(seen.has(k))return false;seen.add(k);return true});
};

const browser=await launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
await page.route('**/rest/v1/rpc/sindhorn_current_employee_profile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(authProfile)}));
await page.route('**/rest/v1/rpc/sindhorn_fnb_read_model',async route=>{
  const headers={...route.request().headers()};delete headers.authorization;
  const response=await route.fetch({url:route.request().url().replace('sindhorn_fnb_read_model','sindhorn_fnb_public_read_model'),headers});
  await route.fulfill({response});
});

const violations=[];
let signedIn=false;
for(const [path,selector] of ROUTES){
  /* Seeding the session needs one full load; every later route is a hash
     change the shell's own router answers, as it does on the phone. */
  if(path!=='/#signin'&&!signedIn){await page.evaluate(seedSession,fakeJwt());await page.goto('about:blank');signedIn=true}
  await page.goto(`${BASE_URL}${path}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector(selector,{timeout:30000}).catch(()=>{});
  await page.waitForTimeout(3000);
  for(const row of await page.evaluate(scan)) violations.push({path,...row});
}
await browser.close();

if(violations.length){
  console.error('Nested glass found. These elements render as a flat fill, not glass:\n');
  for(const v of violations) console.error(`  ${v.path.padEnd(18)} ${v.el.padEnd(46)} inside ${v.inside}`);
  console.error('\nA glass surface must not contain another glass surface. Give the inner');
  console.error('element a plain tint with no backdrop-filter - which is what it already');
  console.error('renders as, so the change is visually identical.');
  process.exit(1);
}
console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,routes:ROUTES.length,nestedGlass:0}));
