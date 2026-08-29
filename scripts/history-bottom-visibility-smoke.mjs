import {chromium} from 'playwright';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'PREVIEW',display_name:'Preview Employee',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/location.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
await import('/bootstrap.js');
`;
function assert(ok,message){if(!ok)throw new Error(message)}

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(25000);
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.goto(`${BASE}/ihg-history`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.shellLoading==='false',{timeout:30000});
  await page.waitForSelector('#ihg-history-period-10-button');
  await page.evaluate(()=>document.querySelector('#ihg-history-period-10-button')?.click());
  await page.waitForFunction(()=>document.querySelector('#ihg-history-period-10-button')?.getAttribute('aria-expanded')==='true',{timeout:12000});
  await page.waitForTimeout(850);

  const settled=await page.evaluate(()=>{
    const doc=document.documentElement,list=document.querySelector('.ihg-history-list'),source=document.querySelector('.ihg-history-source'),last=document.querySelector('.ihg-history-card:last-child');
    return{scrollY:scrollY,maxScroll:Math.max(0,doc.scrollHeight-doc.clientHeight),padding:list?.style.paddingBottom||'',gap:source.getBoundingClientRect().top-last.getBoundingClientRect().bottom};
  });
  assert(settled.padding==='',`runway still present ${JSON.stringify(settled)}`);
  assert(settled.gap<42,`source gap too large ${JSON.stringify(settled)}`);
  assert(settled.scrollY<=settled.maxScroll+1,`scroll position exceeds document after runway cleanup ${JSON.stringify(settled)}`);

  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'auto'}));
  await page.waitForTimeout(180);
  const bottom=await page.evaluate(()=>{
    const doc=document.documentElement,source=document.querySelector('.ihg-history-source'),footer=document.getElementById('app-footer'),sr=source.getBoundingClientRect(),fr=footer.getBoundingClientRect();
    return{scrollY:scrollY,maxScroll:Math.max(0,doc.scrollHeight-doc.clientHeight),sourceTop:sr.top,sourceBottom:sr.bottom,footerTop:fr.top,viewport:innerHeight,sourceVisible:sr.bottom>0&&sr.top<innerHeight,footerVisible:fr.bottom>0&&fr.top<innerHeight};
  });
  assert(bottom.scrollY<=bottom.maxScroll+1,`bottom scroll is out of range ${JSON.stringify(bottom)}`);
  assert(bottom.sourceVisible,`Source is not visible at document bottom ${JSON.stringify(bottom)}`);
  assert(bottom.footerVisible,`Footer is not visible at document bottom ${JSON.stringify(bottom)}`);
  console.log(JSON.stringify({ok:true,settled,bottom},null,2));
  await context.close();
}finally{
  await browser.close();
}
