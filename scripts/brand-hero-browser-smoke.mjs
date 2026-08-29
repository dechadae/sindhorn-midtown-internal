import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT=process.env.SCREENSHOT_DIR||'/tmp/brand-hero-parity';
await fs.mkdir(OUT,{recursive:true});

const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Preview Admin',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
await import('/bootstrap.js');
`;
const capabilityShim=`
export async function loadSettingsAuthority(){return{
  profile:{displayName:'Preview Admin',employeeNumber:'10639',role:'super_admin',preferredLanguage:'en',active:true,accountType:'developer',pinConfigured:true},
  capabilities:[],
  sections:[
    {key:'account',label:'Account',navLabel:'Account'},
    {key:'people',label:'People',navLabel:'People'},
    {key:'comms',label:'Comms',navLabel:'Comms'},
    {key:'system',label:'System',navLabel:'System'}
  ]
}};
`;

function assert(ok,msg){if(!ok)throw new Error(msg)}
function near(a,b,t,label){assert(Math.abs(Number(a)-Number(b))<=t,`${label}: ${a} vs ${b}`)}

async function internalPage(browser,width=390,height=844){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/capabilities.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:capabilityShim}));
  await page.route('**/share/fnb-public-data.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:'export const FNB_PUBLIC_DATA=[];export default [];'}));
  const errors=[];page.on('console',msg=>{if(msg.type()==='error')errors.push({text:msg.text(),url:msg.location()?.url||''})});
  return{context,page,errors};
}
async function waitShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:30000});
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
  await page.evaluate(()=>{
    const tools=document.querySelector('.masthead-tools');
    if(!tools||tools.querySelector('.masthead-user'))return;
    tools.querySelector('.today')?.remove();
    const link=document.createElement('a');link.className='masthead-user';link.href='/settings';link.dataset.appRoute='settings';link.setAttribute('aria-label','Open settings for Preview Admin');
    const name=document.createElement('span');name.className='masthead-user-name';name.textContent='Preview Admin';
    const avatar=document.createElement('span');avatar.className='masthead-user-avatar';avatar.textContent='PA';avatar.setAttribute('aria-hidden','true');
    link.append(name,avatar);tools.prepend(link);
  });
}
async function overflow(page,label){
  const d=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bw:document.body.scrollWidth}));
  assert(d.sw<=d.cw+1&&d.bw<=d.cw+1,`${label} overflow ${JSON.stringify(d)}`);
}
async function footer(page){return page.evaluate(()=>({labels:[...document.querySelectorAll('#app-footer .app-tabbar .nav-chip>span')].map(x=>x.textContent.trim()),current:document.querySelector('#app-footer .app-tabbar [aria-current] span')?.textContent?.trim()||null}))}
async function hero(page,{hero,kicker,title,support}){
  return page.evaluate(({hero,kicker,title,support})=>{
    const h=document.querySelector(hero),k=document.querySelector(kicker),t=document.querySelector(title),s=document.querySelector(support);
    if(!h||!k||!t||!s)throw new Error(`hero node missing ${hero}`);
    const cs=x=>getComputedStyle(x),r=h.getBoundingClientRect();
    return{
      x:r.x,width:r.width,
      padTop:parseFloat(cs(h).paddingTop),padBottom:parseFloat(cs(h).paddingBottom),
      kicker:{size:parseFloat(cs(k).fontSize),weight:cs(k).fontWeight,line:parseFloat(cs(k).lineHeight),marginBottom:parseFloat(cs(k).marginBottom),letter:cs(k).letterSpacing},
      title:{size:parseFloat(cs(t).fontSize),weight:cs(t).fontWeight,line:parseFloat(cs(t).lineHeight),family:cs(t).fontFamily,letter:cs(t).letterSpacing,transform:cs(t).textTransform},
      support:{size:parseFloat(cs(s).fontSize),weight:cs(s).fontWeight,line:parseFloat(cs(s).lineHeight),marginTop:parseFloat(cs(s).marginTop),letter:cs(s).letterSpacing}
    };
  },{hero,kicker,title,support});
}
function compare(target,actual,label){
  for(const [key,tol] of [['x',.75],['width',.75],['padTop',.1],['padBottom',.1]])near(actual[key],target[key],tol,`${label} ${key}`);
  near(actual.kicker.size,target.kicker.size,.1,`${label} kicker size`);near(actual.kicker.marginBottom,target.kicker.marginBottom,.1,`${label} kicker margin`);
  near(actual.title.size,target.title.size,.2,`${label} title size`);near(actual.title.line,target.title.line,.3,`${label} title line`);
  near(actual.support.size,target.support.size,.1,`${label} support size`);near(actual.support.marginTop,target.support.marginTop,.1,`${label} support margin`);
  assert(actual.title.weight===target.title.weight,`${label} title weight ${actual.title.weight} vs ${target.title.weight}`);
  assert(actual.title.family.includes('LINE Seed Sans TH'),`${label} wrong title font ${actual.title.family}`);
  assert(actual.title.letter===target.title.letter,`${label} title tracking drift`);
  assert(actual.title.transform==='none',`${label} title forced case ${actual.title.transform}`);
}

async function captureInternal(browser,route,name,spec,ready){
  const {context,page,errors}=await internalPage(browser);
  try{
    await page.goto(`${BASE}${route}`,{waitUntil:'domcontentloaded'});await waitShell(page);await page.waitForSelector(ready);await page.waitForTimeout(350);await overflow(page,name);
    const m=await hero(page,spec),f=await footer(page);
    assert(JSON.stringify(f.labels)===JSON.stringify(['Today','F&B','Messages','Brand']),`${name} footer ${JSON.stringify(f.labels)}`);
    await page.screenshot({path:path.join(OUT,`${name}-390x844.png`),fullPage:false});
    return{metrics:m,footer:f,errors,page,context,keep:true};
  }catch(error){await context.close();throw error}
}

const specs={
  fnb:{hero:'.fnb-hero',kicker:'.fnb-hero .fnb-eyebrow',title:'.fnb-hero h1',support:'.fnb-hero .fnb-period'},
  messages:{hero:'.route-hero',kicker:'.route-hero .route-kicker',title:'.route-hero h1',support:'.route-hero>p:last-child'},
  settings:{hero:'.settings-hero',kicker:'.settings-hero .settings-eyebrow',title:'.settings-hero h1',support:'.settings-hero .settings-name'},
  brand:{hero:'.ihg-history-hero',kicker:'.ihg-history-hero .ihg-history-eyebrow',title:'.ihg-history-hero h1',support:'.ihg-history-hero .ihg-history-intro'}
};

const browser=await chromium.launch({headless:true});
try{
  const fnb=await captureInternal(browser,'/fnb','fnb',specs.fnb,'.fnb-card');
  const messages=await captureInternal(browser,'/messages','messages',specs.messages,'.messages-route, .route-hero');
  const settings=await captureInternal(browser,'/settings','settings',specs.settings,'.settings-route');
  const brand=await captureInternal(browser,'/ihg-history','brand',specs.brand,'.ihg-history-card');

  compare(fnb.metrics,messages.metrics,'Messages');compare(fnb.metrics,settings.metrics,'Settings');compare(fnb.metrics,brand.metrics,'Brand');
  assert(messages.footer.current==='Messages','Messages footer not active');assert(fnb.footer.current==='F&B','F&B footer not active');assert(brand.footer.current==='Brand','Brand footer not active');assert(settings.footer.current===null,'Settings should not own a global footer tab');

  const overlays=await Promise.all([
    settings.page.evaluate(()=>getComputedStyle(document.querySelector('.settings-route'),'::before').content),
    brand.page.evaluate(()=>getComputedStyle(document.querySelector('.ihg-history-route'),'::before').content),
    fnb.page.evaluate(()=>getComputedStyle(document.querySelector('.fnb-route'),'::before').content)
  ]);
  overlays.forEach((value,i)=>assert(value==='none'||value==='normal',`route dimmer active ${['Settings','Brand','F&B'][i]}: ${value}`));
  const duplicateAvatar=await settings.page.locator('.settings-hero .settings-avatar').evaluate(el=>getComputedStyle(el).display);
  assert(duplicateAvatar==='none','Settings hero duplicate avatar is still visible');

  const avatar=await brand.page.evaluate(()=>({href:document.querySelector('.masthead-user')?.getAttribute('href'),route:document.querySelector('.masthead-user')?.dataset.appRoute}));
  assert(avatar.href==='/settings'&&avatar.route==='settings',`avatar no longer opens Settings/Admin ${JSON.stringify(avatar)}`);
  await brand.page.evaluate(()=>{window.__shellRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),env:document.getElementById('environmentStage'),doc:document.documentElement}});
  await brand.page.evaluate(()=>document.querySelector('.masthead-user')?.click());
  await brand.page.waitForSelector('.settings-route');
  const avatarSpa=await brand.page.evaluate(()=>window.__shellRefs.header===document.getElementById('app-header')&&window.__shellRefs.footer===document.getElementById('app-footer')&&window.__shellRefs.env===document.getElementById('environmentStage')&&window.__shellRefs.doc===document.documentElement&&location.pathname==='/settings');
  assert(avatarSpa,'avatar caused a document/shell replacement');
  await brand.page.click('#app-footer [data-app-route="ihgHistory"]');await brand.page.waitForSelector('.ihg-history-card');
  assert(await brand.page.evaluate(()=>location.pathname==='/ihg-history'),'Brand tab did not return to History');

  const collapsed=await brand.page.evaluate(()=>[...document.querySelectorAll('.ihg-history-card-button')].every(b=>b.getAttribute('aria-expanded')==='false'));
  assert(collapsed,'Brand periods are not collapsed by default');
  assert(await brand.page.locator('.ihg-history-card').count()===10,'Brand period count changed');
  assert(await brand.page.locator('.ihg-history-period-visual').count()===10,'Every Brand period must have one archive image');

  const imageStates=[];
  for(let index=1;index<=10;index+=1){
    const buttonSelector=`#ihg-history-period-${index}-button`;
    const cardSelector=`[data-history-period="${index-1}"]`;
    await brand.page.evaluate(selector=>document.querySelector(selector)?.click(),buttonSelector);
    await brand.page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-expanded')==='true',buttonSelector);
    await brand.page.waitForTimeout(index===1?650:1100);
    const openCount=await brand.page.locator('.ihg-history-card.is-open').count();
    assert(openCount===1,`one-open-at-a-time failed for History period ${index}`);
    const scrollState=await brand.page.evaluate(selector=>{
      const card=document.querySelector(selector),header=document.getElementById('app-header');
      const cardTop=card?.getBoundingClientRect().top??NaN;
      let expected=10;
      if(header){
        const position=getComputedStyle(header).position;
        if(position==='fixed'||position==='sticky')expected=Math.max(0,header.getBoundingClientRect().bottom)+10;
      }
      return{cardTop,expected,scrollY:window.scrollY};
    },cardSelector);
    near(scrollState.cardTop,scrollState.expected,5,`History period ${index} smooth-scroll landing`);
    const imageSelector=`${cardSelector} .ihg-history-period-visual img`;
    await brand.page.waitForFunction(selector=>{const img=document.querySelector(selector);return Boolean(img&&img.complete&&img.naturalWidth>0)},imageSelector,{timeout:15000});
    const imageState=await brand.page.locator(imageSelector).evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight}));
    assert(/ihgplc\.com/.test(imageState.src)&&imageState.width>0,`official archive image failed for period ${index} ${JSON.stringify(imageState)}`);
    imageStates.push({period:index,...imageState,scroll:scrollState});
  }
  await brand.page.screenshot({path:path.join(OUT,'brand-expanded-390x844.png'),fullPage:false});

  for(const item of [fnb,messages,settings,brand]){if(item.keep)await item.context.close()}

  const publicContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'});const publicPage=await publicContext.newPage();
  await publicPage.goto(`${BASE}/share/fnb`,{waitUntil:'domcontentloaded'});await publicPage.waitForSelector('.fnb-hero');await publicPage.waitForTimeout(350);await overflow(publicPage,'public-fnb');
  const publicMetrics=await hero(publicPage,specs.fnb);compare(fnb.metrics,publicMetrics,'Public F&B');
  assert(!(await publicPage.locator('#app-footer').count()),'Public F&B unexpectedly has authenticated footer');
  await publicPage.screenshot({path:path.join(OUT,'public-fnb-390x844.png'),fullPage:false});await publicContext.close();

  for(const [width,height] of [[360,800],[768,1024]]){
    const {context,page}=await internalPage(browser,width,height);await page.goto(`${BASE}/ihg-history`,{waitUntil:'domcontentloaded'});await waitShell(page);await page.waitForSelector('.ihg-history-card');await overflow(page,`Brand ${width}x${height}`);await page.screenshot({path:path.join(OUT,`brand-${width}x${height}.png`),fullPage:false});await context.close();
  }

  console.log(JSON.stringify({ok:true,base:BASE,footer:['Today','F&B','Messages','Brand'],fnb:fnb.metrics,messages:messages.metrics,settings:settings.metrics,brand:brand.metrics,publicFnb:publicMetrics,overlays,images:imageStates,screenshots:await fs.readdir(OUT)}));
}finally{await browser.close()}
