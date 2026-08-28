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
const report={base,checks:[],errors};
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const familyOk=value=>String(value).toLowerCase().includes('line seed sans th');
const allowedWeights=new Set(['100','400','700']);

async function settleFonts(page){
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('100 48px "LINE Seed Sans TH"'),
      document.fonts.load('400 16px "LINE Seed Sans TH"'),
      document.fonts.load('700 16px "LINE Seed Sans TH"')
    ]);
  });
}
async function auditVisibleTypography(page,label,{requireThinSelectors=[]}={}){
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
      path:location.pathname,
      shellToken:document.__typographyShellToken||null
    };
  });
  const badFamily=state.typography.filter(x=>!familyOk(x.family));
  const badWeight=state.typography.filter(x=>!allowedWeights.has(x.weight));
  const badTracking=state.typography.filter(x=>!['normal','0px'].includes(x.letterSpacing));
  const badThin=state.typography.filter(x=>x.weight==='100'&&x.size<44);
  assert(!badFamily.length,`${label} non-LINE Seed text: ${JSON.stringify(badFamily.slice(0,5))}`);
  assert(!badWeight.length,`${label} unsupported computed weights: ${JSON.stringify(badWeight.slice(0,5))}`);
  assert(!badTracking.length,`${label} nonzero tracking: ${JSON.stringify(badTracking.slice(0,5))}`);
  assert(!badThin.length,`${label} Thin 100 used below 44px: ${JSON.stringify(badThin.slice(0,5))}`);
  assert(state.scrollWidth<=state.width+2,`${label} horizontal overflow ${state.scrollWidth}>${state.width}: ${JSON.stringify(state.overflowing)}`);
  const lineFaces=state.faces.filter(face=>familyOk(face.family));
  for(const weight of ['100','400','700'])assert(lineFaces.some(face=>String(face.weight)===weight),`${label} LINE Seed ${weight} face missing`);
  assert(!state.faces.some(face=>/poppins|noto|vignette sans|ibm plex/i.test(face.family)),`${label} retired face registered`);
  assert(!state.resources.some(url=>/fonts\.googleapis|fonts\.gstatic|raw\.githubusercontent|cdn\.jsdelivr/i.test(url)),`${label} external font resource requested`);
  for(const selector of requireThinSelectors){
    const v=await page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return{weight:s.fontWeight,size:parseFloat(s.fontSize)||0,family:s.fontFamily}}).catch(()=>null);
    if(v){assert(v.weight==='100',`${label} ${selector} expected Thin 100, got ${v.weight}`);assert(v.size>=44,`${label} ${selector} Thin 100 used below 44px (${v.size}px)`);assert(familyOk(v.family),`${label} ${selector} wrong family ${v.family}`)}
  }
  report.checks.push({label,path:state.path,textNodes:state.typography.length,width:state.width,height:state.height,scrollWidth:state.scrollWidth,shellToken:state.shellToken});
  return state;
}
async function signIn(page,label){
  await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await settleFonts(page);
  await auditVisibleTypography(page,`${label}-login`);
  await page.screenshot({path:`typography-artifacts/${label}-login.png`,fullPage:true});

  // Exercise the hidden first-time/recovery PIN surface with production markup and CSS.
  await page.evaluate(()=>{
    const login=document.querySelector('#loginControls');if(login)login.classList.add('hidden');
    const setup=document.querySelector('#pinSetupStep');if(setup)setup.classList.remove('hidden');
  });
  await auditVisibleTypography(page,`${label}-pin-setup`);
  await page.screenshot({path:`typography-artifacts/${label}-pin-setup.png`,fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await settleFonts(page);

  await page.fill('#employeeNumber',employee);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.click('#pinLoginButton');
  await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:20000,waitUntil:'commit'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false'&&document.querySelector('#route-view'),null,{timeout:30000});
  await page.evaluate(()=>{document.__typographyShellToken=`shell-${Date.now()}-${Math.random()}`});
}
async function routeClick(page,route){
  const href=route==='today'?'/':`/${route}`;
  const token=await page.evaluate(()=>document.__typographyShellToken);
  const transitioned=await page.evaluate(async route=>{
    const nav=window.SindhornNavigation;
    if(!nav?.transitionToRoute)return false;
    await nav.transitionToRoute(route);
    return true;
  },route);
  assert(transitioned,`navigation API unavailable for ${route}`);
  await page.waitForURL(url=>new URL(url).pathname===href,{timeout:12000});
  await page.waitForTimeout(350);await settleFonts(page);
  const after=await page.evaluate(()=>document.__typographyShellToken);
  assert(after===token,`${route} navigation replaced the authenticated document`);
}
async function syntheticAdminVisual(page,label){
  await page.evaluate(()=>{
    const host=document.querySelector('#route-view');
    host.dataset.shellRoute='admin';
    host.innerHTML=`<section class="admin-route"><div class="admin-shell"><header class="admin-header"><div><div class="admin-title">Employee administration</div><div class="admin-sub">จัดการบัญชีพนักงานและสิทธิ์การใช้งาน</div></div><button class="chip-btn">Close</button></header><nav class="admin-nav"><button aria-selected="true">Employees</button><button>Invitations</button></nav><section class="admin-panel"><div class="panel-head"><div><div class="panel-title">Employees</div><div class="panel-note">Active hotel accounts</div></div><div class="toolbar"><input class="search" placeholder="Search employee"><button class="add-btn">Add employee</button></div></div><div class="user-list"><div class="user-row"><div><div class="user-name">Long English Employee Name Example</div><div class="user-id">SM-000001</div></div><div>Front Office</div><div><span class="pill">Active</span></div><div class="thai" lang="th">พร้อมใช้งาน</div><button class="row-edit">Edit</button></div></div><div class="security-banner">Administrator one-time codes expire automatically. รหัสผู้ดูแลระบบใช้เพียงครั้งเดียว</div><div class="dialog-body"><div class="dialog-title">Create invitation</div><div class="form-grid"><label class="field"><span>Employee name</span><input value="Long English Employee Name Example"></label><label class="field"><span lang="th">ชื่อพนักงาน</span><input value="ตัวอย่างชื่อพนักงานภาษาไทยที่ยาว"></label></div><div class="dialog-actions"><button>Cancel</button><button class="save">Save</button></div></div></section></div></section>`;
  });
  await settleFonts(page);
  await auditVisibleTypography(page,`${label}-admin-style`);
  await page.screenshot({path:`typography-artifacts/${label}-admin-style.png`,fullPage:true});
}
async function inspectAuthenticated(viewport,label){
  const page=await browser.newPage({viewport,screen:viewport});
  page.on('pageerror',e=>errors.push(`${label} pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`${label} console: ${m.text()}`)});
  await signIn(page,label);
  await settleFonts(page);await page.waitForTimeout(250);
  await auditVisibleTypography(page,`${label}-today`,{requireThinSelectors:['.intro h1','.pm-value','.aqi-value','.weather-temp']});
  await page.screenshot({path:`typography-artifacts/${label}-today.png`,fullPage:true});

  await routeClick(page,'fnb');
  await auditVisibleTypography(page,`${label}-fnb`);
  await page.screenshot({path:`typography-artifacts/${label}-fnb.png`,fullPage:true});

  await routeClick(page,'messages');
  await auditVisibleTypography(page,`${label}-messages`);
  await page.screenshot({path:`typography-artifacts/${label}-messages.png`,fullPage:true});

  const account=page.locator('.masthead-user');
  assert(await account.count(),'missing account link');
  const token=await page.evaluate(()=>document.__typographyShellToken);
  await account.click();await page.waitForURL(url=>new URL(url).pathname==='/account',{timeout:12000});await page.waitForTimeout(300);await settleFonts(page);
  assert(await page.evaluate(()=>document.__typographyShellToken)===token,'account navigation replaced the authenticated document');
  await auditVisibleTypography(page,`${label}-account`);
  await page.screenshot({path:`typography-artifacts/${label}-account.png`,fullPage:true});

  await syntheticAdminVisual(page,label);
  await page.close();
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
