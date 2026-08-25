const { chromium }=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true});
  for(const vp of [{w:390,h:844,label:'390'},{w:320,h:720,label:'320'}]){
    const context=await browser.newContext({viewport:{width:vp.w,height:vp.h},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push('page:'+e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())});
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(1400);
    const today=await page.evaluate(()=>{
      const h1=document.querySelector('.intro h1');
      const h1th=h1.querySelector(':scope > [lang="th"]');
      const g=document.querySelector('.guidance-lead');
      const e=document.getElementById('everyoneEn');
      const t=document.getElementById('everyoneTh');
      const d=document.querySelector('.disclaimer');
      const firstElement=el=>Array.from(el.children)[0];
      return {
        route:document.body.dataset.route,
        width:document.documentElement.scrollWidth,
        h1En:parseFloat(getComputedStyle(h1).fontSize),
        h1Th:parseFloat(getComputedStyle(h1th).fontSize),
        guidanceFirst:firstElement(g)?.id,
        everyoneFirst:firstElement(t.parentElement)?.id,
        disclaimerFirstLang:firstElement(d)?.lang,
        thaiInstructionSize:parseFloat(getComputedStyle(t).fontSize),
        englishInstructionSize:parseFloat(getComputedStyle(e).fontSize),
        header:!!document.querySelector('.masthead'),
        footer:!!document.querySelector('.app-footer'),
        nav:!!document.querySelector('.app-tabbar')
      };
    });
    console.log('TODAY '+vp.label,JSON.stringify(today));
    if(today.route!=='today'||today.width>vp.w+1)throw new Error('today layout failed '+vp.label);
    if(!(today.h1En>today.h1Th))throw new Error('English display typography is not eminent '+vp.label);
    if(today.guidanceFirst!=='guidanceTh'||today.everyoneFirst!=='everyoneTh'||today.disclaimerFirstLang!=='th')throw new Error('Thai-first instruction order failed '+vp.label);
    if(today.thaiInstructionSize<today.englishInstructionSize)throw new Error('Thai instruction readability failed '+vp.label);
    if(!today.header||!today.footer||!today.nav)throw new Error('shared shell missing '+vp.label);

    await page.click('[data-app-route="guidance"]');
    await page.waitForTimeout(250);
    const guidance=await page.evaluate(()=>({route:document.body.dataset.route,width:document.documentElement.scrollWidth,hero:document.querySelector('.route-hero h1')?.textContent.trim()}));
    if(guidance.route!=='guidance'||guidance.width>vp.w+1||!guidance.hero.includes('Guidance'))throw new Error('guidance route failed '+vp.label);

    await page.click('[data-app-route="details"]');
    await page.waitForTimeout(250);
    const details=await page.evaluate(()=>({route:document.body.dataset.route,width:document.documentElement.scrollWidth,hero:document.querySelector('.route-hero h1')?.textContent.trim()}));
    if(details.route!=='details'||details.width>vp.w+1||!details.hero.includes('Reading details'))throw new Error('details route failed '+vp.label);
    if(errors.length)throw new Error(errors.join('\n'));
    await context.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
