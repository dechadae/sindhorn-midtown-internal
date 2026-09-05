/* Signs into the deployed shell with the CI test account and checks the
   shell does what sign-in promises: the navbar unlocks, Today loads its
   real data, Messages reads the employee's broadcast inbox from the live
   RPC, Settings › Me shows the account, sign out relocks. Runs after
   deploy against the live URL; the credentials come only from the
   CI_SMOKE_EMPLOYEE_NUMBER / CI_SMOKE_PIN secrets and are never printed.

   Usage: BASE_URL=https://sindhorn-midtown-internal.pages.dev node scripts/next-signin-smoke.mjs
*/
import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'').replace(/\/$/,'');
const employee=process.env.CI_SMOKE_EMPLOYEE_NUMBER||'',pin=process.env.CI_SMOKE_PIN||'';
if(!BASE_URL)throw new Error('BASE_URL required');
if(!employee||!/^[0-9]{6}$/.test(pin))throw new Error('CI_SMOKE_EMPLOYEE_NUMBER and a six-digit CI_SMOKE_PIN are required');

async function launch(){try{return await chromium.launch()}catch(_){return await chromium.launch({channel:'chrome'})}}
const browser=await launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const failures=[];
page.on('pageerror',error=>failures.push(`page error: ${error.message}`));
const shell=()=>page.evaluate(()=>({
  locked:'locked' in document.querySelector('.app-navbar').dataset,
  mode:document.querySelector('.app-navbar').dataset.mode,
  current:[...document.querySelectorAll('[data-route][aria-current="page"]')].map(b=>b.dataset.route),
  chipHidden:document.querySelector('.app-masthead-account').hidden,
  title:document.querySelector('.app-hero-title')?.textContent.trim()||''
}));

try{
  await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-signin-form]',{timeout:30000});
  const before=await shell();
  if(!before.locked||!before.chipHidden)failures.push(`signed out: navbar locked=${before.locked} chip hidden=${before.chipHidden}`);

  await page.fill('#signin-employee',employee);
  await page.click('#signin-code');
  await page.keyboard.type(pin);
  await page.waitForSelector('.app-navbar:not([data-locked])',{timeout:30000});
  await page.waitForSelector('.app-metric-value',{timeout:30000});
  const today=await shell();
  if(today.current.join()!=='today')failures.push(`after sign-in: current route ${today.current.join()||'(none)'}, expected today`);
  if(today.chipHidden)failures.push('after sign-in: account chip still hidden');
  if(await page.locator('.app-state[data-tone="error"]').count())failures.push('Today rendered its error state for a signed-in employee');

  // Messages calls sindhorn_broadcast_inbox_v1 as this employee. The page
  // keeps its skeleton until the server answers, then shows the list or the
  // honest empty state; an error-tone state means the RPC failed or is
  // missing on the live project. Nothing is written - opening a broadcast
  // is the only receipt, and the test account is sent none.
  await page.click('[data-masthead-route="messages"]');
  await page.waitForFunction(()=>document.querySelector('.app-hero-title')?.textContent.trim()==='Inbox'&&!document.querySelector('#routeView .app-skeleton'),null,{timeout:30000});
  const inbox=await page.evaluate(()=>({
    rows:document.querySelectorAll('#routeView [data-broadcast-open]').length,
    state:document.querySelector('#routeView .app-state')?.dataset.tone||'',
    note:document.querySelector('#routeView .app-utility-note')?.textContent||''
  }));
  if(inbox.state==='error'||/offline|saved on this phone/i.test(inbox.note))failures.push(`Messages could not read the live broadcast inbox (state=${inbox.state||'list'} note=${inbox.note||'-'})`);
  if(!inbox.rows&&inbox.state!=='empty')failures.push(`Messages rendered neither broadcasts nor the empty state (state=${inbox.state||'-'})`);

  await page.click('.app-masthead-account');
  // Today's own metric cards stay in the DOM until Settings mounts, so wait
  // for Me itself: its hero title plus the sign-out row that renders with the facts.
  await page.waitForFunction(()=>document.querySelector('.app-hero-title')?.textContent.trim()==='Me'&&document.querySelector('[data-settings-signout]')&&document.querySelector('#routeView .app-metric-value'),null,{timeout:30000});
  const me=await shell();
  if(me.mode!=='settings'||me.current.join()!=='settings/me'||me.title!=='Me')failures.push(`settings: mode=${me.mode} current=${me.current.join()} title=${me.title}`);
  const shown=await page.evaluate(()=>[...document.querySelectorAll('#routeView .app-metric-value')].map(n=>n.textContent.trim()));
  if(!shown.includes(employee))failures.push('Settings › Me does not show the signed-in Employee ID');

  // Sign out sits in the Me hero head and asks first: the confirm must open,
  // Cancel must keep the session, and Sign out must end it.
  await page.click('[data-settings-signout]');
  await page.waitForSelector('dialog[data-confirm][open]',{timeout:10000});
  await page.click('dialog[data-confirm] [data-dialog-cancel]');
  await page.waitForFunction(()=>!document.querySelector('dialog[data-confirm]'),null,{timeout:10000});
  if((await shell()).title!=='Me')failures.push('cancelling the sign-out confirm should keep Me open');
  await page.click('[data-settings-signout]');
  await page.waitForSelector('dialog[data-confirm][open]',{timeout:10000});
  await page.click('dialog[data-confirm] [data-dialog-confirm]');
  await page.waitForSelector('[data-signin-form]',{timeout:30000});
  const after=await shell();
  if(!after.locked||!after.chipHidden)failures.push(`after sign-out: navbar locked=${after.locked} chip hidden=${after.chipHidden}`);
}catch(error){failures.push(error.message)}
await browser.close();

if(failures.length){
  console.error('Shell sign-in smoke failed:');
  for(const f of failures)console.error(`  - ${f}`);
  process.exit(1);
}
console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,checks:['locked-out','sign-in','today-data','messages-inbox','settings-me','sign-out']}));
