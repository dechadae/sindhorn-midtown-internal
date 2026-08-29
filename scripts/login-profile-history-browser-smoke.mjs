import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT=process.env.SCREENSHOT_DIR||'/tmp/login-profile-history';
await fs.mkdir(OUT,{recursive:true});

function assert(ok,message){if(!ok)throw new Error(message)}

const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'PREVIEW',display_name:'Preview Employee',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
await import('/bootstrap.js');
`;
const capabilityShim=`
export async function loadSettingsAuthority(){return{
  ok:true,version:2,
  profile:{displayName:'Preview Employee',employeeNumber:'PREVIEW',positionTitle:'Senior Graphic Designer',departmentName:'Marketing Communications',role:'super_admin',preferredLanguage:'en',active:true,accountType:'developer',pinConfigured:true},
  capabilities:[],
  sections:[{key:'account',label:'Account',navLabel:'Account'}]
}};
`;

async function internalPage(browser,width=390,height=844){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.addInitScript(()=>{
    window.__environmentRevealAudit=[];
    addEventListener('DOMContentLoaded',()=>{
      const root=document.documentElement;
      const record=()=>{
        if(root.dataset.shellLoading!=='false')return;
        const canvas=document.querySelector('#environmentCanvas');
        const stage=document.querySelector('#environmentStage');
        window.__environmentRevealAudit.push({
          environmentReady:document.body.classList.contains('environment-ready'),
          canvasOpacity:canvas?getComputedStyle(canvas).opacity:null,
          stageBackground:stage?getComputedStyle(stage).backgroundColor:null,
          canvasWidth:canvas?.width||0,
          canvasHeight:canvas?.height||0
        });
      };
      new MutationObserver(record).observe(root,{attributes:true,attributeFilter:['data-shell-loading']});
      record();
    },{once:true});
  });
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/capabilities.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:capabilityShim}));
  return{context,page};
}
async function waitShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:30000});
  await page.waitForSelector('#app-header .masthead');
  await page.waitForSelector('#app-footer .app-tabbar');
}
async function assertEnvironmentReveal(page,label){
  const state=await page.evaluate(()=>({
    shellLoading:document.documentElement.dataset.shellLoading,
    environmentReady:document.body.classList.contains('environment-ready'),
    hidden:document.querySelector('#environmentStage')?.hidden,
    stageBackground:getComputedStyle(document.querySelector('#environmentStage')).backgroundColor,
    canvasOpacity:getComputedStyle(document.querySelector('#environmentCanvas')).opacity,
    canvasWidth:document.querySelector('#environmentCanvas')?.width||0,
    canvasHeight:document.querySelector('#environmentCanvas')?.height||0,
    audit:window.__environmentRevealAudit||[]
  }));
  assert(state.shellLoading==='false'&&state.environmentReady&&!state.hidden,`${label} environment not ready ${JSON.stringify(state)}`);
  assert(state.canvasOpacity==='1'&&state.canvasWidth>1&&state.canvasHeight>1,`${label} WebGL canvas was released before it was drawable ${JSON.stringify(state)}`);
  assert(state.stageBackground==='rgb(46, 39, 59)',`${label} renderer fallback must match shell plum ${JSON.stringify(state)}`);
  const release=state.audit.at(-1);
  assert(release?.environmentReady&&release?.canvasOpacity==='1'&&release.canvasWidth>1&&release.canvasHeight>1,`${label} shell release did not coincide with a ready GPU surface ${JSON.stringify(state.audit)}`);
  return state;
}
async function assertNoOverflow(page,label){
  const result=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth}));
  assert(result.scrollWidth<=result.clientWidth+1&&result.bodyWidth<=result.clientWidth+1,`${label} horizontal overflow ${JSON.stringify(result)}`);
}
async function historyGap(page){
  return page.evaluate(()=>{
    const list=document.querySelector('.ihg-history-list');
    const last=document.querySelector('.ihg-history-card:last-child');
    const source=document.querySelector('.ihg-history-source');
    if(!list||!last||!source)throw new Error('History geometry missing');
    return{
      inlinePadding:list.style.paddingBottom,
      computedPadding:parseFloat(getComputedStyle(list).paddingBottom)||0,
      gap:source.getBoundingClientRect().top-last.getBoundingClientRect().bottom,
      open:[...document.querySelectorAll('.ihg-history-card.is-open')].length,
      preparing:[...document.querySelectorAll('.ihg-history-card.is-preparing')].length
    };
  });
}
async function waitHistorySettled(page,{open}){
  await page.waitForFunction(expectedOpen=>{
    const list=document.querySelector('.ihg-history-list');
    if(!list)return false;
    const openCount=document.querySelectorAll('.ihg-history-card.is-open').length;
    const preparingCount=document.querySelectorAll('.ihg-history-card.is-preparing').length;
    return list.style.paddingBottom===''&&openCount===expectedOpen&&preparingCount===0;
  },open,{timeout:12000});
}
async function openHistoryPeriod(page,index){
  const button=`#ihg-history-period-${index}-button`;
  await page.evaluate(selector=>document.querySelector(selector)?.click(),button);
  try{
    await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-expanded')==='true',button,{timeout:25000});
  }catch(error){
    const state=await page.evaluate(selector=>{
      const node=document.querySelector(selector),card=node?.closest('.ihg-history-card'),list=document.querySelector('.ihg-history-list');
      return{exists:Boolean(node),expanded:node?.getAttribute('aria-expanded')||null,classes:card?.className||null,open:document.querySelectorAll('.ihg-history-card.is-open').length,preparing:document.querySelectorAll('.ihg-history-card.is-preparing').length,padding:list?.style.paddingBottom||'',scrollY:window.scrollY,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight};
    },button);
    throw new Error(`History period ${index} did not expand: ${JSON.stringify(state)} · ${error.message}`);
  }
  await waitHistorySettled(page,{open:1});
}

const browser=await chromium.launch({headless:true});
try{
  for(const [width,height,name] of [[390,844,'login-390x844'],[768,1024,'login-768x1024']]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto(`${BASE}/login.html`,{waitUntil:'networkidle'});
    await page.waitForSelector('#loginControls');
    const state=await page.evaluate(()=>{
      const body=getComputedStyle(document.body),card=getComputedStyle(document.querySelector('.auth-card')),controls=getComputedStyle(document.querySelector('#loginControls')),title=getComputedStyle(document.querySelector('#loginTitle')),hero=getComputedStyle(document.querySelector('.login-hero')),kicker=getComputedStyle(document.querySelector('.eyebrow')),support=getComputedStyle(document.querySelector('.login-hero .support')),logoStyle=getComputedStyle(document.querySelector('.brand-row-bottom'));
      const logoRow=document.querySelector('.brand-row-bottom')?.getBoundingClientRect();
      return{
        canvas:document.querySelectorAll('canvas').length,
        environment:Boolean(document.querySelector('#environmentStage,.environment-stage')),
        topRule:Boolean(document.querySelector('.brand-rule')),
        hero:Boolean(document.querySelector('.login-hero')),
        logo:document.querySelector('.brand-logo')?.getAttribute('src')||'',
        employeeInputMode:document.querySelector('#employeeNumber')?.inputMode||'',
        employeePattern:document.querySelector('#employeeNumber')?.getAttribute('pattern')||'',
        logoTop:logoRow?.top??-1,
        controlsBottom:document.querySelector('#loginControls')?.getBoundingClientRect().bottom??-1,
        logoPosition:logoStyle.position,
        logoMarginTop:parseFloat(logoStyle.marginTop)||0,
        bodyBackground:body.backgroundImage,
        cardBackground:card.backgroundColor,
        controlsBackground:controls.backgroundColor,
        heroPaddingTop:parseFloat(hero.paddingTop)||0,
        heroPaddingBottom:parseFloat(hero.paddingBottom)||0,
        heroBorderBottom:parseFloat(hero.borderBottomWidth)||0,
        kickerSize:parseFloat(kicker.fontSize)||0,
        kickerMarginBottom:parseFloat(kicker.marginBottom)||0,
        supportSize:parseFloat(support.fontSize)||0,
        supportMarginTop:parseFloat(support.marginTop)||0,
        titleSize:parseFloat(title.fontSize)||0,
        titleColor:title.color,
        titleWeight:title.fontWeight,
        titleFamily:title.fontFamily
      };
    });
    assert(state.canvas===0&&!state.environment,`Login must not mount WebGL/background renderer ${JSON.stringify(state)}`);
    assert(!state.topRule&&state.hero,`Login hero structure is wrong ${JSON.stringify(state)}`);
    assert(state.logo.includes('vignette-white.png'),`Login is not using white hotel logo ${state.logo}`);
    assert(state.employeeInputMode==='numeric'&&state.employeePattern==='[0-9]*',`Employee ID should request numeric keyboard ${JSON.stringify(state)}`);
    assert(state.logoPosition==='static'&&state.logoMarginTop>=40&&state.logoTop>state.controlsBottom+30,`Hotel logo must follow content in normal flow ${JSON.stringify(state)}`);
    assert(state.bodyBackground.includes('gradient'),`Login static shell background missing ${state.bodyBackground}`);
    assert(state.cardBackground==='rgba(0, 0, 0, 0)',`Outer login card should be transparent ${state.cardBackground}`);
    assert(state.controlsBackground!=='rgba(0, 0, 0, 0)',`Login form glass surface missing ${state.controlsBackground}`);
    assert(state.heroPaddingTop===22&&state.heroPaddingBottom===20&&state.heroBorderBottom===1,`Login hero geometry drift ${JSON.stringify(state)}`);
    assert(state.kickerSize===9&&state.kickerMarginBottom===12&&state.supportSize===13&&state.supportMarginTop===8,`Login hero type spacing drift ${JSON.stringify(state)}`);
    assert(state.titleWeight==='400'&&state.titleSize>=30&&state.titleSize<=44&&state.titleFamily.includes('LINE Seed Sans TH'),`Login hero title does not match routed hero system ${JSON.stringify(state)}`);
    await assertNoOverflow(page,name);
    await page.screenshot({path:path.join(OUT,`${name}.png`),fullPage:true});
    await context.close();
  }

  const settings=await internalPage(browser);
  await settings.page.goto(`${BASE}/settings`,{waitUntil:'domcontentloaded'});
  await waitShell(settings.page);
  const environment=await assertEnvironmentReveal(settings.page,'Settings');
  await settings.page.waitForSelector('.settings-facts');
  const settingsState=await settings.page.evaluate(()=>{
    const facts=Object.fromEntries([...document.querySelectorAll('.settings-fact')].map(node=>[node.querySelector('span')?.textContent?.trim(),node.querySelector('b')?.textContent?.trim()]));
    const button=document.querySelector('.settings-quiet-action'),style=getComputedStyle(button);
    return{facts,signOut:{height:parseFloat(style.height)||0,border:parseFloat(style.borderTopWidth)||0,radius:parseFloat(style.borderRadius)||0,fontSize:parseFloat(style.fontSize)||0,weight:style.fontWeight,background:style.backgroundColor,color:style.color}};
  });
  const facts=settingsState.facts;
  assert(facts.Position==='Senior Graphic Designer',`Settings Position missing ${JSON.stringify(facts)}`);
  assert(facts.Department==='Marketing Communications',`Settings Department missing ${JSON.stringify(facts)}`);
  assert(settingsState.signOut.height===40&&settingsState.signOut.border===1&&settingsState.signOut.radius===11&&settingsState.signOut.fontSize===12&&settingsState.signOut.weight==='400',`Settings Sign out control does not match system geometry ${JSON.stringify(settingsState.signOut)}`);
  await assertNoOverflow(settings.page,'Settings');
  await settings.page.screenshot({path:path.join(OUT,'settings-profile-390x844.png'),fullPage:false});
  await settings.context.close();

  const history=await internalPage(browser);
  await history.page.goto(`${BASE}/ihg-history`,{waitUntil:'domcontentloaded'});
  await waitShell(history.page);
  await assertEnvironmentReveal(history.page,'History');
  await history.page.waitForSelector('.ihg-history-card');

  for(const index of [9,10]){
    await openHistoryPeriod(history.page,index);
    const gap=await historyGap(history.page);
    assert(gap.inlinePadding==='',`History temporary runway persisted for period ${index}: ${JSON.stringify(gap)}`);
    assert(gap.computedPadding<2,`History list retains artificial bottom padding for period ${index}: ${JSON.stringify(gap)}`);
    assert(gap.gap<42,`History has oversized blank gap before Source for period ${index}: ${JSON.stringify(gap)}`);
    assert(gap.open===1&&gap.preparing===0,`History one-open-at-a-time cleanup failed ${JSON.stringify(gap)}`);
  }

  await history.page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'auto'}));
  await history.page.waitForTimeout(120);
  await history.page.screenshot({path:path.join(OUT,'history-bottom-open-390x844.png'),fullPage:false});
  await history.page.evaluate(()=>document.querySelector('#ihg-history-period-10-button')?.click());
  await history.page.waitForFunction(()=>document.querySelector('#ihg-history-period-10-button')?.getAttribute('aria-expanded')==='false',{timeout:5000});
  await history.page.waitForTimeout(560);
  const collapsedGap=await historyGap(history.page);
  assert(collapsedGap.open===0,`History should have no open period after collapse ${JSON.stringify(collapsedGap)}`);
  assert(collapsedGap.inlinePadding===''&&collapsedGap.computedPadding<2,`History runway persisted after collapse ${JSON.stringify(collapsedGap)}`);
  assert(collapsedGap.gap<42,`History blank gap persists after collapse ${JSON.stringify(collapsedGap)}`);
  await history.page.screenshot({path:path.join(OUT,'history-bottom-collapsed-390x844.png'),fullPage:false});
  await assertNoOverflow(history.page,'History');
  await history.context.close();

  console.log(JSON.stringify({ok:true,login:'routed-hero geometry + normal-flow hotel logo + numeric Employee ID',profile:{position:facts.Position,department:facts.Department,signOut:settingsState.signOut},environment:{stageBackground:environment.stageBackground,canvasOpacity:environment.canvasOpacity,canvasWidth:environment.canvasWidth,canvasHeight:environment.canvasHeight},history:{gap:collapsedGap.gap}},null,2));
}finally{
  await browser.close();
}