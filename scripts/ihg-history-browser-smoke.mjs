import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const OUT_DIR=process.env.SCREENSHOT_DIR||'/tmp/ihg-history-parity';
await fs.mkdir(OUT_DIR,{recursive:true});

const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'History Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='/location.js';
  script.onload=resolve;
  script.onerror=reject;
  document.head.appendChild(script);
});
await import('/bootstrap.js');
`;

function assert(condition,message){if(!condition)throw new Error(message)}
function near(a,b,t=.75,label='value'){assert(Math.abs(Number(a)-Number(b))<=t,`${label} mismatch: ${a} vs ${b}`)}

async function newPage(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage();
  const consoleErrors=[];
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  page.on('console',msg=>{
    if(msg.type()!=='error')return;
    const location=msg.location();
    const error={text:msg.text(),url:location?.url||'',line:location?.lineNumber??null};
    consoleErrors.push(error);
    console.error(`[browser ${width}x${height}] ${error.url||'(no url)'} ${error.text}`);
  });
  return {context,page,consoleErrors};
}

async function waitForShell(page){
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:25000});
  await page.waitForSelector('#app-header .masthead',{timeout:15000});
  await page.waitForSelector('#app-footer .app-tabbar',{timeout:15000});
}

async function noOverflow(page,label){
  const d=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bw:document.body.scrollWidth}));
  assert(d.sw<=d.cw+1&&d.bw<=d.cw+1,`${label} horizontal overflow: ${JSON.stringify(d)}`);
}

async function readMetrics(page,prefix){
  return page.evaluate(prefix=>{
    const route=document.querySelector(`.${prefix}-route`);
    const hero=document.querySelector(`.${prefix}-hero`);
    const h1=hero.querySelector('h1');
    const card=document.querySelector(`.${prefix}-card`);
    const button=card.querySelector(`.${prefix}-card-button`);
    const footer=document.querySelector('#app-footer .app-tabbar');
    const rr=route.getBoundingClientRect(),fr=footer.getBoundingClientRect();
    const cs=el=>getComputedStyle(el);
    return {
      route:{x:rr.x,width:rr.width},
      hero:{paddingTop:parseFloat(cs(hero).paddingTop),paddingBottom:parseFloat(cs(hero).paddingBottom)},
      h1:{fontSize:parseFloat(cs(h1).fontSize),fontWeight:cs(h1).fontWeight,fontFamily:cs(h1).fontFamily,letterSpacing:cs(h1).letterSpacing},
      card:{radius:parseFloat(cs(card).borderRadius),background:cs(card).backgroundColor},
      button:{paddingTop:parseFloat(cs(button).paddingTop),paddingLeft:parseFloat(cs(button).paddingLeft)},
      footer:{top:fr.top,height:fr.height},
      overlay:cs(route,'::before').backgroundImage
    };
  },prefix);
}

async function captureFnb(browser){
  const {context,page,consoleErrors}=await newPage(browser,390,844);
  try{
    await page.goto(`${BASE_URL}/fnb`,{waitUntil:'domcontentloaded',timeout:30000});
    await waitForShell(page);
    await page.waitForSelector('.fnb-route .fnb-card',{timeout:25000});
    await page.waitForTimeout(400);
    await noOverflow(page,'F&B 390x844');
    const metrics=await readMetrics(page,'fnb');
    await page.screenshot({path:path.join(OUT_DIR,'fnb-390x844.png'),fullPage:true});
    return {metrics,consoleErrors};
  }finally{await context.close()}
}

async function captureHistory390(browser,fnb){
  const {context,page,consoleErrors}=await newPage(browser,390,844);
  try{
    await page.goto(`${BASE_URL}/ihg-history`,{waitUntil:'domcontentloaded',timeout:30000});
    await waitForShell(page);
    await page.waitForSelector('.ihg-history-route .ihg-history-card',{timeout:15000});
    await page.waitForTimeout(350);
    await noOverflow(page,'History 390x844');

    const initial=await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll('.ihg-history-card-button')];
      const panels=[...document.querySelectorAll('.ihg-history-panel')];
      const footer=document.querySelector('#app-footer .app-tabbar');
      const header=document.querySelector('#app-header .masthead');
      const footerTop=footer.getBoundingClientRect().top;
      const headerBottom=header.getBoundingClientRect().bottom;
      const visibleCards=[...document.querySelectorAll('.ihg-history-card')].filter(card=>{
        const r=card.getBoundingClientRect();
        return r.top<footerTop&&r.bottom>headerBottom;
      }).length;
      return {
        route:document.body.dataset.route,
        cards:buttons.length,
        milestones:document.querySelectorAll('.ihg-history-milestone').length,
        expanded:buttons.map(x=>x.getAttribute('aria-expanded')),
        hidden:panels.map(x=>x.getAttribute('aria-hidden')),
        controlsValid:buttons.every(x=>document.getElementById(x.getAttribute('aria-controls'))),
        footerLabels:[...document.querySelectorAll('#app-footer span')].map(x=>x.textContent.trim()),
        visibleCards,
        sourceHref:document.querySelector('.ihg-history-source a')?.href||''
      };
    });
    assert(initial.route==='ihgHistory',`Unexpected route: ${initial.route}`);
    assert(initial.cards===10,`Expected 10 periods, found ${initial.cards}`);
    assert(initial.milestones===76,`Expected 76 milestones, found ${initial.milestones}`);
    assert(initial.expanded.every(v=>v==='false'),'At least one period auto-expanded');
    assert(initial.hidden.every(v=>v==='true'),'At least one period is not initially hidden');
    assert(initial.controlsValid,'An aria-controls target is missing');
    assert(initial.visibleCards>=2,`Only ${initial.visibleCards} collapsed period card(s) visible on first 390x844 viewport`);
    assert(!initial.footerLabels.some(x=>/^history$|^ihg history$/i.test(x)),'History leaked into persistent footer');
    assert(initial.sourceHref==='https://www.ihgplc.com/en/about-us/our-history','Official source link mismatch');

    const metrics=await readMetrics(page,'ihg-history');
    near(metrics.route.x,fnb.metrics.route.x,.75,'route x');
    near(metrics.route.width,fnb.metrics.route.width,.75,'route width');
    near(metrics.hero.paddingTop,fnb.metrics.hero.paddingTop,.1,'hero padding top');
    near(metrics.hero.paddingBottom,fnb.metrics.hero.paddingBottom,.1,'hero padding bottom');
    near(metrics.h1.fontSize,fnb.metrics.h1.fontSize,.2,'hero h1 size');
    assert(metrics.h1.fontWeight===fnb.metrics.h1.fontWeight,`hero weight mismatch: ${metrics.h1.fontWeight} vs ${fnb.metrics.h1.fontWeight}`);
    assert(metrics.h1.fontFamily.includes('LINE Seed Sans TH'),'History does not use LINE Seed Sans TH');
    assert(metrics.h1.letterSpacing===fnb.metrics.h1.letterSpacing,`letter-spacing mismatch: ${metrics.h1.letterSpacing} vs ${fnb.metrics.h1.letterSpacing}`);
    near(metrics.card.radius,fnb.metrics.card.radius,.1,'card radius');
    assert(metrics.card.background===fnb.metrics.card.background,`card surface mismatch: ${metrics.card.background} vs ${fnb.metrics.card.background}`);
    near(metrics.button.paddingTop,fnb.metrics.button.paddingTop,.1,'card button vertical padding');
    near(metrics.button.paddingLeft,fnb.metrics.button.paddingLeft,.1,'card button horizontal padding');
    assert(metrics.overlay===fnb.metrics.overlay,'Atmosphere-readability overlay differs from F&B');
    near(metrics.footer.height,fnb.metrics.footer.height,.75,'footer height');

    const historySpecificErrors=consoleErrors.filter(e=>/ihg-history/i.test(e.url)||/ihg-history/i.test(e.text));
    assert(historySpecificErrors.length===0,`History-specific browser console error: ${JSON.stringify(historySpecificErrors[0])}`);

    await page.evaluate(()=>{
      window.__historyShellRefs={header:document.getElementById('app-header'),footer:document.getElementById('app-footer'),atmosphere:document.getElementById('environmentStage'),view:document.getElementById('route-view')};
      window.__historyRouteMounts=0;
      document.addEventListener('sindhorn:route-mounted',()=>window.__historyRouteMounts++);
    });
    const buttons=page.locator('.ihg-history-card-button');
    await buttons.nth(0).click();
    await page.waitForTimeout(460);
    assert(await buttons.nth(0).getAttribute('aria-expanded')==='true','First period did not expand');
    await buttons.nth(1).click();
    await page.waitForTimeout(460);
    assert(await buttons.nth(0).getAttribute('aria-expanded')==='false','First period stayed open after second opened');
    assert(await buttons.nth(1).getAttribute('aria-expanded')==='true','Second period did not expand');
    const stable=await page.evaluate(()=>({
      same:window.__historyShellRefs.header===document.getElementById('app-header')&&window.__historyShellRefs.footer===document.getElementById('app-footer')&&window.__historyShellRefs.atmosphere===document.getElementById('environmentStage')&&window.__historyShellRefs.view===document.getElementById('route-view'),
      mounts:window.__historyRouteMounts
    }));
    assert(stable.same,'Disclosure interaction replaced a persistent shell node');
    assert(stable.mounts===0,`Disclosure interaction remounted route ${stable.mounts} time(s)`);

    await buttons.nth(1).click();
    await buttons.nth(0).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    assert(await buttons.nth(0).getAttribute('aria-expanded')==='true','Keyboard Enter did not activate disclosure');
    await buttons.nth(0).click();
    await page.waitForTimeout(100);
    assert(await buttons.nth(0).getAttribute('aria-expanded')==='false','Period did not collapse again');

    await page.screenshot({path:path.join(OUT_DIR,'history-390x844.png'),fullPage:true});
    return {initial,metrics,consoleErrors};
  }finally{await context.close()}
}

async function captureHistoryViewport(browser,width,height){
  const {context,page,consoleErrors}=await newPage(browser,width,height);
  try{
    await page.goto(`${BASE_URL}/ihg-history`,{waitUntil:'domcontentloaded',timeout:30000});
    await waitForShell(page);
    await page.waitForSelector('.ihg-history-card',{timeout:15000});
    await page.waitForTimeout(250);
    await noOverflow(page,`History ${width}x${height}`);
    const state=await page.evaluate(()=>({
      cards:document.querySelectorAll('.ihg-history-card').length,
      expanded:[...document.querySelectorAll('.ihg-history-card-button')].some(x=>x.getAttribute('aria-expanded')==='true'),
      footerHistory:[...document.querySelectorAll('#app-footer span')].some(x=>/^history$|^ihg history$/i.test(x.textContent.trim()))
    }));
    assert(state.cards===10,`${width}x${height}: wrong period count`);
    assert(!state.expanded,`${width}x${height}: period auto-opened`);
    assert(!state.footerHistory,`${width}x${height}: History appeared in footer`);
    const historySpecificErrors=consoleErrors.filter(e=>/ihg-history/i.test(e.url)||/ihg-history/i.test(e.text));
    assert(historySpecificErrors.length===0,`${width}x${height}: History-specific console error`);
    await page.screenshot({path:path.join(OUT_DIR,`history-${width}x${height}.png`),fullPage:true});
    return {...state,consoleErrors};
  }finally{await context.close()}
}

const browser=await chromium.launch({headless:true});
try{
  const fnb=await captureFnb(browser);
  const history=await captureHistory390(browser,fnb);
  const small=await captureHistoryViewport(browser,360,800);
  const tablet=await captureHistoryViewport(browser,768,1024);
  console.log(JSON.stringify({
    ok:true,baseUrl:BASE_URL,periods:history.initial.cards,milestones:history.initial.milestones,
    collapsedByDefault:history.initial.expanded.every(v=>v==='false'),firstViewportVisibleCards:history.initial.visibleCards,
    fnb:fnb.metrics,history:history.metrics,baselineConsoleErrors:fnb.consoleErrors,historyConsoleErrors:history.consoleErrors,
    small,tablet,screenshots:await fs.readdir(OUT_DIR)
  }));
}finally{await browser.close()}
