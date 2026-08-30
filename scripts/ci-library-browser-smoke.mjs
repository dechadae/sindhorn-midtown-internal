import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ci-library-preview';
await fs.mkdir(OUT_DIR,{recursive:true});
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const authShim=name=>`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:${JSON.stringify(name)},pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;
const developerManifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000001',employeeNumber:'10639',displayName:'CI Developer',departmentName:'Marketing Communications',positionTitle:'Senior Graphic Designer',role:'employee',accountType:'developer',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read','people.read','people.manage','broadcasts.manage','system.manage','audit.read','developer.ui_library'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}},{key:'people',label:'People',navLabel:'People',description:'Employees, departments and groups',renderer:'people',sortOrder:20,config:{}},{key:'comms',label:'Comms',navLabel:'Comms',description:'Internal broadcasts and communication controls',renderer:'comms',sortOrder:30,config:{status:'planned'}},{key:'system',label:'System',navLabel:'System',description:'Audit and system configuration',renderer:'system',sortOrder:40,config:{includes:['audit','configuration']}}]};
const employeeManifest={ok:true,version:2,profile:{id:'00000000-0000-0000-0000-000000000002',employeeNumber:'20001',displayName:'CI Employee',departmentName:'Front Office',positionTitle:'Guest Service Agent',role:'employee',accountType:'employee',preferredLanguage:'en',active:true,pinConfigured:true},capabilities:['account.read','settings.read','fnb.read'],sections:[{key:'account',label:'Account',navLabel:'Account',description:'Profile, preferences, security status and sign out',renderer:'account',sortOrder:10,config:{}}]};

async function createHarness(browser,width,height,manifest){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=430,hasTouch:width<=430,reducedMotion:'no-preference',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(30000);
  const errors=[];
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim(manifest.profile.displayName)}));
  await page.route('**/rest/v1/rpc/sindhorn_settings_manifest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
  page.on('pageerror',error=>errors.push({type:'pageerror',text:error.message}));
  page.on('console',message=>{if(message.type()==='error')errors.push({type:'console',text:message.text(),url:message.location()?.url||''})});
  return{context,page,errors};
}
async function waitForShell(page){await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});await page.waitForSelector('#app-header .masthead');await page.waitForSelector('#app-footer .app-tabbar')}
async function noOverflow(page,label){const size=await page.evaluate(()=>({root:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth}));assert(size.root<=size.client+1&&size.body<=size.client+1,`${label} horizontal overflow ${JSON.stringify(size)}`)}
async function footerState(page){return page.evaluate(()=>({main:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(node=>node.textContent.trim()),settings:[...document.querySelectorAll('#app-footer [data-shell-context="settings"] .nav-chip span')].map(node=>node.textContent.trim()),settingsCurrent:document.querySelector('#app-footer [data-settings-section-nav][aria-current]')?.dataset.settingsSectionNav||null,mainCurrent:document.querySelector('#app-footer .app-tabbar .nav-chip[aria-current]')?.textContent.trim()||null}))}
async function waitForSettingsRail(page){
  await page.waitForFunction(()=>{
    const labels=[...document.querySelectorAll('#app-footer [data-shell-context="settings"] .nav-chip span')].map(node=>node.textContent.trim());
    const current=document.querySelector('#app-footer [data-settings-section-nav][aria-current]')?.dataset.settingsSectionNav||null;
    return labels.join('|')==='Account|People|Comms|System'&&current==='system';
  },{timeout:25000});
}

async function developerViewport(browser,width,height){
  const {context,page,errors}=await createHarness(browser,width,height,developerManifest);
  try{
    await page.goto(`${BASE_URL}/settings?section=system`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.settings-route');await page.waitForSelector('[data-system-ui-library]');await waitForSettingsRail(page);
    const settingsFooter=await footerState(page);assert(settingsFooter.main.join('|')==='Today|F&B|Messages|Brand',`${width}: main footer mismatch ${JSON.stringify(settingsFooter)}`);assert(settingsFooter.settings.join('|')==='Account|People|Comms|System',`${width}: fixed Settings rail mismatch ${JSON.stringify(settingsFooter)}`);assert(settingsFooter.settingsCurrent==='system',`${width}: System not current`);
    await noOverflow(page,`Developer Settings ${width}`);
    await page.evaluate(()=>{window.__ciShellRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage')};});
    await page.locator('[data-system-ui-library]').click();await page.waitForURL(url=>url.pathname==='/ci');await page.waitForSelector('.ci-route');await page.waitForFunction(()=>window.SindhornUiLibrary?.version);await page.waitForTimeout(280);
    await noOverflow(page,`CI ${width}`);
    const ci=await page.evaluate(()=>({route:document.body.dataset.route,title:document.querySelector('.ci-route .app-route-title')?.textContent.trim(),sections:document.querySelectorAll('.ci-section').length,status:document.querySelector('[data-ci-status-title]')?.textContent.trim(),failed:document.querySelectorAll('.ci-check[data-ok="false"]').length,tokenCards:document.querySelectorAll('[data-ci-token]').length,components:window.SindhornUiLibrary?.registry?.components?.length||0,footer:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip span')].map(node=>node.textContent.trim()),settingsFooter:document.querySelectorAll('#app-footer [data-shell-context="settings"]').length,mainCurrent:document.querySelector('#app-footer .app-tabbar .nav-chip[aria-current]')?.textContent.trim()||null,font:getComputedStyle(document.querySelector('.ci-route')).fontFamily,titleWeight:getComputedStyle(document.querySelector('.app-route-title')).fontWeight,shellStable:window.__ciShellRefs.header===document.getElementById('app-header')&&window.__ciShellRefs.footer===document.getElementById('app-footer')&&window.__ciShellRefs.atmosphere===document.getElementById('environmentStage')}));
    assert(ci.route==='ci'&&ci.title==='Sindhorn Midtown UI Library',`${width}: CI route/title mismatch ${JSON.stringify(ci)}`);assert(ci.sections===18,`${width}: section count ${ci.sections}`);assert(ci.status==='Design system status · PASS'&&ci.failed===0,`${width}: design drift check failed ${JSON.stringify(ci)}`);assert(ci.tokenCards>=12&&ci.components>=10,`${width}: living registry incomplete`);assert(ci.footer.join('|')==='Today|F&B|Messages|Brand'&&ci.settingsFooter===0&&ci.mainCurrent===null,`${width}: CI footer state mismatch ${JSON.stringify(ci)}`);assert(ci.font.includes('LINE Seed Sans TH')&&ci.titleWeight==='400'&&ci.shellStable,`${width}: CI shell/type mismatch ${JSON.stringify(ci)}`);

    const backStyle=await page.locator('[data-ci-back]').evaluate(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return{width:r.width,height:r.height,radius:s.borderRadius}});assert(Math.round(backStyle.width)===36&&Math.round(backStyle.height)===36&&backStyle.radius==='12px',`${width}: back contract mismatch ${JSON.stringify(backStyle)}`);
    await page.locator('[data-ci-select-trigger]').click();await page.locator('[data-ci-option="ANJU"]').click();assert((await page.locator('[data-ci-select-value]').textContent())?.trim()==='ANJU',`${width}: selector interaction failed`);
    await page.locator('[data-ci-disclosure-button]').click();assert(await page.locator('[data-ci-disclosure-button]').getAttribute('aria-expanded')==='true',`${width}: disclosure did not open`);
    await page.locator('[data-ci-open-dialog]').click();await page.waitForFunction(()=>document.querySelector('[data-ci-dialog]')?.open===true);await page.locator('[data-ci-dialog-done]').click();await page.waitForFunction(()=>document.querySelector('[data-ci-dialog]')?.open===false);
    await page.locator('[data-ci-width="768"]').click();const stage=await page.locator('[data-ci-resize-stage]').evaluate(node=>({width:node.getBoundingClientRect().width,viewport:innerWidth}));assert(stage.width<=stage.viewport+1,`${width}: responsive specimen overflow ${JSON.stringify(stage)}`);

    if(width===390){
      await page.screenshot({path:path.join(OUT_DIR,'ci-top-390x844.png'),fullPage:false});
      await page.locator('#ci-foundations').scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.screenshot({path:path.join(OUT_DIR,'ci-foundations-390x844.png'),fullPage:false});
      await page.locator('#ci-actions').scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.screenshot({path:path.join(OUT_DIR,'ci-actions-390x844.png'),fullPage:false});
      await page.locator('#ci-blueprint').scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.screenshot({path:path.join(OUT_DIR,'ci-blueprint-390x844.png'),fullPage:false});
    }

    await page.locator('[data-ci-back]').click();await page.waitForURL(url=>url.pathname==='/settings'&&url.searchParams.get('section')==='system');await page.waitForSelector('.settings-route');await page.waitForSelector('[data-system-ui-library]');await waitForSettingsRail(page);
    const returned=await page.evaluate(()=>({stable:window.__ciShellRefs.header===document.getElementById('app-header')&&window.__ciShellRefs.footer===document.getElementById('app-footer')&&window.__ciShellRefs.atmosphere===document.getElementById('environmentStage'),rail:[...document.querySelectorAll('#app-footer [data-shell-context="settings"] .nav-chip span')].map(node=>node.textContent.trim()),current:document.querySelector('#app-footer [data-settings-section-nav][aria-current]')?.dataset.settingsSectionNav||null}));assert(returned.stable&&returned.rail.join('|')==='Account|People|Comms|System'&&returned.current==='system',`${width}: CI back did not preserve shell/System ${JSON.stringify(returned)}`);

    const relevant=errors.filter(error=>/ci|settings|route|footer|dialog/i.test(error.url||'')||/ci|settings|route|footer|dialog/i.test(error.text||''));assert(relevant.length===0,`${width}: browser error ${JSON.stringify(relevant[0])}`);
    return{width,height,ci,backStyle,returned,relevant};
  }finally{await context.close()}
}

async function employeeGate(browser){
  const {context,page,errors}=await createHarness(browser,390,844,employeeManifest);
  try{
    await page.goto(`${BASE_URL}/settings?section=system`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForSelector('.settings-route');await waitForSettingsRail(page);
    const settings=await page.evaluate(()=>({rail:[...document.querySelectorAll('#app-footer [data-shell-context="settings"] .nav-chip span')].map(node=>node.textContent.trim()),current:document.querySelector('#app-footer [data-settings-section-nav][aria-current]')?.dataset.settingsSectionNav||null,panelChildren:document.querySelector('[data-settings-panel]')?.children.length||0,library:document.querySelectorAll('[data-system-ui-library]').length}));assert(settings.rail.join('|')==='Account|People|Comms|System'&&settings.current==='system',`Employee fixed rail mismatch ${JSON.stringify(settings)}`);assert(settings.panelChildren===0&&settings.library===0,`Unauthorized System must be blank ${JSON.stringify(settings)}`);
    await page.locator('#app-footer [data-settings-section-nav="account"]').click();await page.waitForSelector('.settings-account-section');
    const accountRestored=await page.locator('.settings-account-section').count();assert(accountRestored===1,'Account did not restore after blank System');

    await page.goto(`${BASE_URL}/ci`,{waitUntil:'domcontentloaded'});await waitForShell(page);await page.waitForURL(url=>url.pathname==='/settings'&&url.searchParams.get('section')==='system',{timeout:25000});await page.waitForSelector('.settings-route');await waitForSettingsRail(page);
    const direct=await page.evaluate(()=>({ci:document.querySelectorAll('.ci-route').length,library:document.querySelectorAll('[data-system-ui-library]').length,panelChildren:document.querySelector('[data-settings-panel]')?.children.length||0,rail:[...document.querySelectorAll('#app-footer [data-shell-context="settings"] .nav-chip span')].map(node=>node.textContent.trim()),current:document.querySelector('#app-footer [data-settings-section-nav][aria-current]')?.dataset.settingsSectionNav||null}));assert(direct.ci===0&&direct.library===0&&direct.panelChildren===0,`Direct unauthorized /ci rendered privileged UI ${JSON.stringify(direct)}`);assert(direct.rail.join('|')==='Account|People|Comms|System'&&direct.current==='system',`Unauthorized /ci fallback rail mismatch ${JSON.stringify(direct)}`);
    const relevant=errors.filter(error=>/ci|settings|route|footer/i.test(error.url||'')||/ci|settings|route|footer/i.test(error.text||''));assert(relevant.length===0,`Employee browser error ${JSON.stringify(relevant[0])}`);
    if(await page.locator('.settings-route').count())await page.screenshot({path:path.join(OUT_DIR,'employee-system-blank-390x844.png'),fullPage:false});
    return{settings,direct,relevant};
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const developer=[];for(const [width,height] of [[360,800],[390,844],[768,1024]])developer.push(await developerViewport(browser,width,height));
  const employee=await employeeGate(browser);
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,developer,employee,screenshots:await fs.readdir(OUT_DIR)}));
}finally{await browser.close()}
