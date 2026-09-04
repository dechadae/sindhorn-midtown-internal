/* Typography gate for the r17 shell at /.

   Signs in as the CI service employee and audits every visible text node on
   the sign-in page, Today, F&B, Messages and Settings › Me: LINE Seed Sans
   TH only, computed weights only 100/400/700, zero tracking everywhere, no
   horizontal overflow, the three faces registered and loaded, no external
   font host. The shell is one document - a navigation that replaced it would
   be a regression - so a token set after sign-in must survive every route.

   The legacy rule that Thin 100 never renders below 44px is gone: the UI
   Library sets its section and title type Thin at --type-section and
   --type-title by design. */
import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.TYPOGRAPHY_BASE_URL;
const employee=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!base)throw new Error('TYPOGRAPHY_BASE_URL required');
if(!employee||!/^\d{6}$/.test(pin||''))throw new Error('CI smoke employee/PIN required');
fs.mkdirSync('typography-artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
const report={base,checks:[],network:[],errors};
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const familyOk=value=>String(value).toLowerCase().includes('line seed sans th');
const allowedWeights=new Set(['100','400','700']);

async function settleFonts(page){
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('100 24px "LINE Seed Sans TH"'),
      document.fonts.load('400 16px "LINE Seed Sans TH"'),
      document.fonts.load('700 16px "LINE Seed Sans TH"')
    ]);
  });
}
async function auditVisibleTypography(page,label){
  const state=await page.evaluate(()=>{
    const directText=el=>[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0};
    const candidates=[...document.body.querySelectorAll('*')].filter(el=>visible(el)&&(directText(el)||['INPUT','BUTTON','SELECT','TEXTAREA','OPTION'].includes(el.tagName)));
    const typography=candidates.map(el=>{const s=getComputedStyle(el);return{tag:el.tagName,cls:String(el.className||'').slice(0,80),id:el.id||'',text:(el.textContent||el.getAttribute('placeholder')||'').trim().replace(/\s+/g,' ').slice(0,90),family:s.fontFamily,weight:s.fontWeight,letterSpacing:s.letterSpacing,size:parseFloat(s.fontSize)||0,lineHeight:s.lineHeight}});
    const faces=[...document.fonts].map(face=>({family:face.family,weight:face.weight,status:face.status}));
    const resources=performance.getEntriesByType('resource').map(r=>r.name).filter(name=>/font|woff|googleapis|gstatic/i.test(name));
    const overflowing=[...document.body.querySelectorAll('*')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,id:el.id||'',cls:String(el.className||'').slice(0,100),text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,whiteSpace:getComputedStyle(el).whiteSpace}}).filter(x=>x.right>innerWidth+2||x.left<-2||x.scrollWidth>x.clientWidth+2).slice(0,12);
    return{
      typography,faces,resources,overflowing,
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
      path:location.pathname+location.hash,
      shellToken:document.__typographyShellToken||null
    };
  });
  assert(state.typography.length>0,`${label} rendered no visible text`);
  const badFamily=state.typography.filter(x=>!familyOk(x.family));
  const badWeight=state.typography.filter(x=>!allowedWeights.has(x.weight));
  const badTracking=state.typography.filter(x=>!['normal','0px'].includes(x.letterSpacing));
  assert(!badFamily.length,`${label} non-LINE Seed text: ${JSON.stringify(badFamily.slice(0,5))}`);
  assert(!badWeight.length,`${label} unsupported computed weights: ${JSON.stringify(badWeight.slice(0,5))}`);
  assert(!badTracking.length,`${label} nonzero tracking: ${JSON.stringify(badTracking.slice(0,5))}`);
  assert(state.scrollWidth<=state.width+2,`${label} horizontal overflow ${state.scrollWidth}>${state.width}: ${JSON.stringify(state.overflowing)}`);
  const lineFaces=state.faces.filter(face=>familyOk(face.family));
  for(const weight of ['100','400','700'])assert(lineFaces.some(face=>String(face.weight)===weight),`${label} LINE Seed ${weight} face missing`);
  assert(!state.faces.some(face=>/poppins|noto|vignette sans|ibm plex/i.test(face.family)),`${label} retired face registered`);
  assert(!state.resources.some(url=>/fonts\.googleapis|fonts\.gstatic|raw\.githubusercontent|cdn\.jsdelivr/i.test(url)),`${label} external font resource requested`);
  report.checks.push({label,path:state.path,textNodes:state.typography.length,width:state.width,height:state.height,scrollWidth:state.scrollWidth,shellToken:state.shellToken});
  return state;
}
async function signIn(page,label){
  await page.goto(`${base}/`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-signin-form]',{timeout:30000});
  await settleFonts(page);
  await auditVisibleTypography(page,`${label}-signin`);
  await page.screenshot({path:`typography-artifacts/${label}-signin.png`,fullPage:true});

  await page.evaluate(()=>{document.__typographyShellToken=`shell-${Date.now()}-${Math.random()}`});
  await page.fill('#signin-employee',employee);
  await page.click('#signin-code');
  await page.keyboard.type(pin);
  await page.waitForSelector('.app-navbar:not([data-locked])',{timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#routeView .app-metric-value')&&!document.querySelector('#routeView .app-skeleton'),null,{timeout:30000});
}
/* A navbar tap is a hash change the shell's router answers inside the same
   document; the page is mounted when its skeleton has gone. */
async function routeClick(page,route,hash,ready){
  const token=await page.evaluate(()=>document.__typographyShellToken);
  await page.click(`.app-navbar [data-route="${route}"]`);
  await page.waitForFunction(hash=>location.hash===hash,hash,{timeout:12000});
  await page.waitForFunction(ready,null,{timeout:30000});
  await page.waitForTimeout(350);await settleFonts(page);
  assert(await page.evaluate(()=>document.__typographyShellToken)===token,`${route} navigation replaced the authenticated document`);
}
async function inspectAuthenticated(viewport,label){
  // Service-worker asset/update behaviour is validated by the architecture
  // and HTTP smoke steps; blocking it here keeps the one-time release refresh
  // from racing the same-document assertion.
  const context=await browser.newContext({viewport,screen:viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(`${label} pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error'){const source=m.location()?.url||'';errors.push(`${label} console${source?` @ ${source}`:''}: ${m.text()}`)}});
  page.on('response',response=>{
    const request=response.request(),type=request.resourceType(),contentType=String(response.headers()['content-type']||'');
    if(response.status()>=400||type==='script'&&!/(javascript|ecmascript|wasm)/i.test(contentType))report.network.push({label,type,status:response.status(),contentType,url:response.url()});
  });
  await signIn(page,label);
  await settleFonts(page);await page.waitForTimeout(250);
  await auditVisibleTypography(page,`${label}-today`);
  await page.screenshot({path:`typography-artifacts/${label}-today.png`,fullPage:true});

  await routeClick(page,'fnb','#fnb',()=>document.querySelector('#routeView .app-action-card, #routeView .app-state')&&!document.querySelector('#routeView .app-skeleton'));
  await auditVisibleTypography(page,`${label}-fnb`);
  await page.screenshot({path:`typography-artifacts/${label}-fnb.png`,fullPage:true});

  await routeClick(page,'messages','#messages',()=>document.querySelector('.app-hero-title')?.textContent.trim()==='Inbox'&&!document.querySelector('#routeView .app-skeleton'));
  await auditVisibleTypography(page,`${label}-messages`);
  await page.screenshot({path:`typography-artifacts/${label}-messages.png`,fullPage:true});

  const account=page.locator('.app-masthead-account');
  assert(await account.count(),'missing account chip');
  const token=await page.evaluate(()=>document.__typographyShellToken);
  await account.click();
  await page.waitForFunction(()=>location.hash==='#settings/me',null,{timeout:12000});
  await page.waitForFunction(()=>document.querySelector('.app-hero-title')?.textContent.trim()==='Me'&&document.querySelector('[data-settings-signout]')&&document.querySelector('#routeView .app-metric-value'),null,{timeout:30000});
  await page.waitForTimeout(300);await settleFonts(page);
  assert(await page.evaluate(()=>document.__typographyShellToken)===token,'settings navigation replaced the authenticated document');
  await auditVisibleTypography(page,`${label}-settings-me`);
  await page.screenshot({path:`typography-artifacts/${label}-settings-me.png`,fullPage:true});

  // Leave the session as it was found: sign out through the confirm.
  await page.click('[data-settings-signout]');
  await page.waitForSelector('dialog[data-confirm][open]',{timeout:10000});
  await page.click('dialog[data-confirm] [data-dialog-confirm]');
  await page.waitForSelector('[data-signin-form]',{timeout:30000});
  await context.close();
}

try{
  await inspectAuthenticated({width:360,height:800},'android-360');
  await inspectAuthenticated({width:390,height:844},'android-390');
  await inspectAuthenticated({width:768,height:1024},'tablet-768');
}catch(e){errors.push(`fatal: ${e.message}`)}
await browser.close();
fs.writeFileSync('typography-artifacts/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)throw new Error(errors.join('\n'));
