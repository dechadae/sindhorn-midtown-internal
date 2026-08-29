import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT=process.env.SCREENSHOT_DIR||'/tmp/login-profile-preview';
await fs.mkdir(OUT,{recursive:true});

function assert(ok,message){if(!ok)throw new Error(message)}

const loginAuthShim=`
let state={authenticated:false,profile:null,session:null};
export function getState(){return state}
export async function initAuth(){return state}
export async function activate(){throw Object.assign(new Error('disabled_in_preview'),{code:'disabled_in_preview'})}
export async function setPermanentPin(){throw Object.assign(new Error('disabled_in_preview'),{code:'disabled_in_preview'})}
export async function signInWithPin(){throw Object.assign(new Error('disabled_in_preview'),{code:'disabled_in_preview'})}
export async function signOut(){state={authenticated:false,profile:null,session:null};document.dispatchEvent(new CustomEvent('sindhorn:auth-changed'));return true}
`;

const shellAuthShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'PREVIEW',display_name:'Profile Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
await import('/bootstrap.js');
`;

const capabilityShim=`
const authority={
  profile:{id:'profile-preview',displayName:'Profile Preview',employeeNumber:'PREVIEW',positionTitle:'Senior Graphic Designer',departmentName:'Marketing Communications',role:'super_admin',preferredLanguage:'en',active:true,accountType:'developer',pinConfigured:true},
  capabilities:[],
  sections:[{key:'account',label:'Account',navLabel:'Account'}]
};
export async function loadSettingsAuthority(){return authority}
`;

async function checkOverflow(page,label){
  const value=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,body:document.body.scrollWidth}));
  assert(value.scroll<=value.client+1&&value.body<=value.client+1,`${label} horizontal overflow ${JSON.stringify(value)}`);
}

async function captureLogin(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  const requests=[];
  page.on('request',request=>requests.push(request.url()));
  await page.route('**/auth-client.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:loginAuthShim}));
  try{
    await page.goto(`${BASE}/login.html`,{waitUntil:'networkidle'});
    await page.waitForSelector('#loginTitle');
    await checkOverflow(page,`login ${width}x${height}`);
    const state=await page.evaluate(()=>{
      const body=getComputedStyle(document.body);
      const card=document.querySelector('.auth-card');
      const title=document.querySelector('#loginTitle');
      const kicker=document.querySelector('.eyebrow');
      const support=document.querySelector('#loginSupport');
      const primary=document.querySelector('#pinLoginButton');
      const logo=document.querySelector('.brand-logo');
      return{
        canvasCount:document.querySelectorAll('canvas').length,
        backgroundImage:body.backgroundImage,
        backgroundColor:body.backgroundColor,
        cardBackground:getComputedStyle(card).backgroundColor,
        cardBorder:getComputedStyle(card).borderColor,
        title:{text:title.textContent.trim(),size:parseFloat(getComputedStyle(title).fontSize),weight:getComputedStyle(title).fontWeight,family:getComputedStyle(title).fontFamily,letter:getComputedStyle(title).letterSpacing,color:getComputedStyle(title).color},
        kicker:{size:parseFloat(getComputedStyle(kicker).fontSize),weight:getComputedStyle(kicker).fontWeight,letter:getComputedStyle(kicker).letterSpacing,color:getComputedStyle(kicker).color},
        support:{size:parseFloat(getComputedStyle(support).fontSize),letter:getComputedStyle(support).letterSpacing,color:getComputedStyle(support).color},
        primary:{background:getComputedStyle(primary).backgroundColor,color:getComputedStyle(primary).color,height:primary.getBoundingClientRect().height},
        logo:{src:logo.getAttribute('src'),naturalWidth:logo.naturalWidth},
        pinDigits:document.querySelectorAll('[data-pin-login-digit]').length,
        employeeVisible:document.querySelector('#employeeNumber').getBoundingClientRect().height>0
      };
    });
    assert(state.canvasCount===0,'Login must not render WebGL/canvas');
    assert(state.backgroundImage!=='none','Login CSS atmosphere missing');
    assert(state.logo.src.includes('vignette-white.png')&&state.logo.naturalWidth>0,'White brand mark missing');
    assert(state.title.text==='Employee sign in','Login title drift');
    assert(state.title.size>=30&&state.title.size<=44.5,`Login title scale ${state.title.size}`);
    assert(state.title.weight==='400','Login title must use live-route weight 400');
    assert(state.title.family.includes('LINE Seed Sans TH'),`Login title font ${state.title.family}`);
    assert(state.title.letter==='0px'&&state.kicker.letter==='0px'&&state.support.letter==='0px','Login tracking must be zero');
    assert(Math.abs(state.kicker.size-9)<=.2,`Login kicker size ${state.kicker.size}`);
    assert(Math.abs(state.support.size-13)<=.2,`Login support size ${state.support.size}`);
    assert(state.pinDigits===6&&state.employeeVisible,'Primary login controls missing');
    assert(state.primary.height>=52,'Primary action touch target too small');
    const forbidden=requests.filter(url=>/(environment(?:\.bundle)?\.js|atmosphere-shader|weather-authority|rain-layer|three(?:\.min)?\.js)/i.test(url));
    assert(forbidden.length===0,`Login loaded protected/WebGL runtime: ${forbidden.join(', ')}`);

    await page.click('#useOneTimeButton');
    assert(await page.locator('#oneTimeStep').isVisible(),'One-time-code mode did not open');
    assert(!(await page.locator('#pinLoginStep').isVisible()),'Permanent-code mode stayed visible');
    await page.click('#usePermanentButton');
    assert(await page.locator('#pinLoginStep').isVisible(),'Permanent-code mode did not restore');

    await page.screenshot({path:path.join(OUT,`login-${width}x${height}.png`),fullPage:false});
    return state;
  }finally{await context.close()}
}

async function captureSettings(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:shellAuthShim}));
  await page.route('**/capabilities.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:capabilityShim}));
  try{
    await page.goto(`${BASE}/settings`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:30000});
    await page.waitForSelector('.settings-account-section');
    await page.waitForFunction(()=>document.querySelector('[data-profile-fact="position"] b')?.textContent==='Senior Graphic Designer');
    await checkOverflow(page,'Settings profile');
    const facts=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.settings-fact')].map(item=>[item.querySelector('span')?.textContent?.trim(),item.querySelector('b')?.textContent?.trim()])));
    assert(facts.Position==='Senior Graphic Designer',`Position fact ${facts.Position}`);
    assert(facts.Department==='Marketing Communications',`Department fact ${facts.Department}`);
    await page.screenshot({path:path.join(OUT,'settings-profile-390x844.png'),fullPage:false});
    return facts;
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const login=[];
  for(const [width,height] of [[360,800],[390,844],[768,1024]])login.push(await captureLogin(browser,width,height));
  const settings=await captureSettings(browser);
  const report={ok:true,base:BASE,viewports:['360x800','390x844','768x1024'],login,settings};
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
