import fs from 'node:fs';
import {chromium} from 'playwright';

const base='https://sindhorn-midtown-internal.pages.dev';
const employee=process.env.CI_SMOKE_EMPLOYEE_NUMBER;
const pin=process.env.CI_SMOKE_PIN;
if(!employee||!/^\d{6}$/.test(pin||''))throw new Error('CI smoke employee/PIN required');
fs.mkdirSync('pack47-artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},serviceWorkers:'block'});
const page=await context.newPage();

await page.goto(`${base}/login.html`,{waitUntil:'domcontentloaded',timeout:45000});
await page.fill('#employeeNumber',employee);
for(let i=0;i<6;i++)await page.fill(`[data-pin-login-digit="${i}"]`,pin[i]);
await page.click('#pinLoginButton');
await page.waitForURL(url=>new URL(url).pathname==='/',{timeout:20000,waitUntil:'commit'});
await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false'&&window.SindhornAppPack,null,{timeout:30000});
await page.evaluate(()=>window.SindhornAppPack.refresh());
await page.waitForFunction(()=>document.body.dataset.appPack==='47'&&document.body.dataset.appPackSource==='remote',null,{timeout:30000});
await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([document.fonts.load('100 64px "LINE Seed Sans TH"'),document.fonts.load('400 16px "LINE Seed Sans TH"')]);});
await page.waitForTimeout(500);

const state=await page.evaluate(()=>{
  const cs=s=>{const el=document.querySelector(s);if(!el)return null;const x=getComputedStyle(el),r=el.getBoundingClientRect();return{text:(el.textContent||'').trim().replace(/\s+/g,' '),display:x.display,visibility:x.visibility,weight:x.fontWeight,size:parseFloat(x.fontSize),lineHeight:x.lineHeight,textTransform:x.textTransform,family:x.fontFamily,width:r.width,height:r.height}};
  const factsTitle=document.querySelector('#factsTitle');
  const fcs=factsTitle?getComputedStyle(factsTitle):null;
  return{
    pack:document.body.dataset.appPack,source:document.body.dataset.appPackSource,
    marker:document.querySelector('#sindhorn-ui-pack-style')?.textContent.includes('Pack 47 — editorial hierarchy reduction')||false,
    scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
    hero:cs('.intro>h1'),pm:cs('.pm-value'),aqi:cs('.aqi-value'),category:cs('.category-en'),weather:cs('.weather-condition strong'),
    routeHero:cs('.route-hero>h1'),advice:cs('.advice h3'),fact:cs('.fact dt'),alert:cs('.alert-copy>strong'),body:cs('.route-hero>p:last-child'),meta:cs('.observed'),
    observation:{className:factsTitle?.className||'',display:fcs?.display||'',position:fcs?.position||'',width:factsTitle?.getBoundingClientRect().width||0,height:factsTitle?.getBoundingClientRect().height||0}
  };
});
const fail=(ok,msg)=>{if(!ok)throw new Error(msg)};
fail(state.pack==='47'&&state.source==='remote'&&state.marker,`Pack 47 remote presentation not active: ${JSON.stringify(state)}`);
fail(state.scrollWidth<=state.width+2,`horizontal overflow ${state.scrollWidth}>${state.width}`);
fail(state.hero?.weight==='100'&&state.hero.size>=50,'Today display role incorrect');
fail(state.pm?.weight==='100'&&state.pm.size>state.aqi?.size,'PM2.5 must remain primary metric');
fail(state.aqi?.weight==='100','AQI must use thin metric role');
fail(state.category?.weight==='400'&&state.category.textTransform==='none'&&state.category.size<state.hero.size*.75,'Status interpretation must be smaller sentence-case section headline');
fail(state.weather?.weight==='400'&&state.weather.textTransform==='none','Weather condition must be sentence case');
fail(state.routeHero?.weight==='100'&&state.routeHero.size>=50,'Guidance/Details display role incorrect');
fail(state.advice?.weight==='400'&&state.advice.textTransform==='none','Advice headings must be sentence case body-level headings');
fail(state.fact?.weight==='400'&&state.fact.textTransform==='none','Fact labels must be sentence case');
fail(state.alert?.weight==='400'&&state.alert.textTransform==='none','Environmental alerts heading must be sentence case');
fail(state.observation.className.includes('screen-reader')&&state.observation.width<=1.1&&state.observation.height<=1.1,'Observation heading must be visually hidden but accessible');
fail(Math.abs(state.body.size-state.advice.size)<1,'Body and secondary content headings should share the same reading scale');

fs.writeFileSync('pack47-artifacts/state.json',JSON.stringify(state,null,2));
await page.screenshot({path:'pack47-artifacts/pack47-production-390x844.png',fullPage:true});
console.log(JSON.stringify(state,null,2));
await browser.close();
