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
async function fontState(page,selectors){
  return page.evaluate(selectors=>{
    const out={};
    for(const selector of selectors){
      const el=document.querySelector(selector);if(!el){out[selector]=null;continue}
      const s=getComputedStyle(el);out[selector]={family:s.fontFamily,weight:s.fontWeight,size:s.fontSize,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,text:(el.textContent||'').trim().slice(0,100)};
    }
    const faces=[...document.fonts].map(face=>({family:face.family,weight:face.weight,status:face.status}));
    const resources=performance.getEntriesByType('resource').map(r=>r.name).filter(name=>/font|woff|googleapis|gstatic/i.test(name));
    return{out,faces,resources};
  },selectors);
}
function verifyState(name,state,{requireThin=[]}={}){
  for(const [selector,value] of Object.entries(state.out)){
    if(!value)continue;
    assert(familyOk(value.family),`${name} ${selector} family ${value.family}`);
    assert(value.letterSpacing==='normal'||value.letterSpacing==='0px',`${name} ${selector} tracking ${value.letterSpacing}`);
  }
  for(const selector of requireThin){const v=state.out[selector];if(v)assert(v.weight==='100',`${name} ${selector} expected Thin 100, got ${v.weight}`)}
  const lineFaces=state.faces.filter(face=>familyOk(face.family));
  assert(lineFaces.some(face=>String(face.weight)==='100'),`${name} Thin face missing`);
  assert(lineFaces.some(face=>String(face.weight)==='400'),`${name} Regular face missing`);
  assert(lineFaces.some(face=>String(face.weight)==='700'),`${name} Bold face missing`);
  assert(!state.faces.some(face=>/poppins|noto|vignette sans|ibm plex/i.test(face.family)),`${name} retired face registered`);
  assert(!state.resources.some(url=>/fonts\.googleapis|fonts\.gstatic|raw\.githubusercontent|cdn\.jsdelivr/i.test(url)),`${name} external font resource requested`);
  report.checks.push({name,state});
}

async function signIn(page){
  await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await settleFonts(page);
  const loginState=await fontState(page,['body','#loginTitle','#loginSupport','.eyebrow','.otp-digit','#pinLoginButton']);
  verifyState('login',loginState);
  await page.screenshot({path:'typography-artifacts/login-mobile.png',fullPage:true});
  await page.fill('#employeeNumber',employee);
  for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
  await page.click('#pinLoginButton');
  await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:20000,waitUntil:'commit'});
}

async function inspectAuthenticated(viewport,label){
  const page=await browser.newPage({viewport,screen:viewport});
  page.on('pageerror',e=>errors.push(`${label} pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`${label} console: ${m.text()}`)});
  await signIn(page);
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false'&&document.querySelector('#route-view'),null,{timeout:30000});
  await settleFonts(page);
  await page.waitForTimeout(250);
  let state=await fontState(page,['body','.masthead-user-name','.eyebrow','.intro h1','.pm-value','.aqi-value','.category-en','.weather-temp','.metric-label','.nav-chip']);
  verifyState(`${label}-today`,state,{requireThin:['.intro h1','.pm-value','.aqi-value','.category-en','.weather-temp']});
  await page.screenshot({path:`typography-artifacts/${label}-today.png`,fullPage:true});

  const fnb=page.locator('[data-app-route="fnb"]');
  if(await fnb.count()){
    await fnb.click();
    await page.waitForURL(url=>new URL(url).pathname==='/fnb',{timeout:12000});
    await page.waitForTimeout(350);await settleFonts(page);
    state=await fontState(page,['body','.masthead-user-name','.fnb-route','.fnb-hero h1','.fnb-stat','.fnb-card-title','.nav-chip']);
    verifyState(`${label}-fnb`,state,{requireThin:['.fnb-hero h1']});
    // Detached Thai specimen verifies that the same face resolves for Thai without adding test UI.
    const thai=await page.evaluate(()=>{const el=document.createElement('span');el.lang='th';el.textContent='อาหารและเครื่องดื่ม โปรโมชั่นประจำเดือน';el.style.cssText='position:fixed;left:-10000px;font-size:18px';document.body.appendChild(el);const s=getComputedStyle(el);const result={family:s.fontFamily,weight:s.fontWeight,letterSpacing:s.letterSpacing};el.remove();return result});
    assert(familyOk(thai.family),`${label} Thai specimen family ${thai.family}`);
    assert(thai.letterSpacing==='normal'||thai.letterSpacing==='0px',`${label} Thai tracking ${thai.letterSpacing}`);
    report.checks.push({name:`${label}-thai`,state:thai});
    await page.screenshot({path:`typography-artifacts/${label}-fnb.png`,fullPage:true});
  }

  const account=page.locator('.masthead-user');
  if(await account.count()){
    await account.click();await page.waitForURL(url=>new URL(url).pathname==='/account',{timeout:12000});await page.waitForTimeout(300);await settleFonts(page);
    state=await fontState(page,['body','.account-title','.account-name','.account-value','.nav-chip']);
    verifyState(`${label}-account`,state);
    await page.screenshot({path:`typography-artifacts/${label}-account.png`,fullPage:true});
  }
  await page.close();
}

try{
  await inspectAuthenticated({width:390,height:844},'android-390');
  await inspectAuthenticated({width:768,height:1024},'tablet-768');
}catch(e){errors.push(`fatal: ${e.message}`)}
await browser.close();
fs.writeFileSync('typography-artifacts/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)throw new Error(errors.join('\n'));
