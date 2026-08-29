import {chromium} from 'playwright';

const baseUrl=(process.env.BASE_URL||'').replace(/\/$/,'');
const gitSha=process.env.GITHUB_SHA||'';
if(!baseUrl)throw new Error('BASE_URL is required');

const SUPABASE_URL='https://sjpvhgxacsiorrtijqua.supabase.co';
const SUPABASE_KEY='sb_publishable_NcIExScIXkqsK1ZNNu5a-Q_zZ4afIHz';
const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/sindhorn_fnb_public_read_model`,{
  method:'POST',
  cache:'no-store',
  headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},
  body:'{}'
});
if(!response.ok)throw new Error(`public F&B RPC returned ${response.status}`);
const live=await response.json();
if(!Array.isArray(live)||!live.length)throw new Error('public F&B RPC returned no promotions');
const expectedIds=live.map(item=>String(item.id)).sort();

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
  await page.goto(`${baseUrl}/__fnb-footer-smoke.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-fnb-nav="fnb"]',{timeout:15000});
  await page.click('[data-fnb-nav="fnb"]');
  await page.waitForSelector('#route-view .fnb-route',{timeout:20000});
  await page.waitForFunction(expected=>document.querySelectorAll('.fnb-card').length===expected,expectedIds.length,{timeout:20000});
  const runtime=await page.evaluate(()=>({
    ids:[...document.querySelectorAll('[data-open]')].map(node=>node.dataset.open).sort(),
    timestamp:document.querySelector('[data-fnb-data-updated]')?.textContent?.trim()||'',
    sourceNote:document.querySelector('.fnb-data-note')?.textContent?.trim()||''
  }));
  if(JSON.stringify(runtime.ids)!==JSON.stringify(expectedIds))throw new Error(`deployed runtime ids differ from live Supabase: ${JSON.stringify({expectedIds,runtimeIds:runtime.ids})}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify({
    ok:true,
    phase:'pre-deploy-live-parity',
    gitSha,
    deployedAlias:baseUrl,
    promotions:expectedIds.length,
    ids:expectedIds,
    timestamp:runtime.timestamp,
    note:'This check ran before this workflow attempt deployed any files; the existing branch deployment matched the current Supabase read model.'
  }));
}finally{
  await browser.close();
}
