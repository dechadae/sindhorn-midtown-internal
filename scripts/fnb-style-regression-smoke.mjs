import {chromium,webkit} from 'playwright';

const baseUrl=(process.env.BASE_URL||'').replace(/\/$/,'');
if(!baseUrl)throw new Error('BASE_URL is required');

for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});

  await page.goto(`${baseUrl}/__fnb-footer-smoke.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-fnb-nav="fnb"]',{timeout:15000});
  await page.click('[data-fnb-nav="fnb"]');
  await page.waitForSelector('#route-view .fnb-route',{timeout:20000});
  await page.waitForSelector('link[data-fnb-style]',{state:'attached'});
  await page.waitForSelector('link[data-fnb-approved-polish]',{state:'attached'});
  await page.waitForSelector('link[data-fnb-refinements]',{state:'attached'});
  await page.waitForSelector('link[data-fnb-layout-stability]',{state:'attached'});
  await page.waitForFunction(()=>document.querySelector('[data-fnb-data-updated]'));
  await page.waitForTimeout(350);

  const closed=await page.evaluate(()=>{
    const trigger=document.querySelector('[data-filter-trigger="outlet"]');
    const svg=trigger?.querySelector('svg');
    const menu=document.querySelector('#fnb-outlet-menu');
    const option=menu?.querySelector('.fnb-select-option');
    const select=document.querySelector('[data-outlet-select]');
    const firstCard=document.querySelector('.fnb-card-button');
    const style=node=>node?getComputedStyle(node):null;
    const t=style(trigger),s=style(svg),m=style(menu),o=style(option),n=style(select),c=style(firstCard);
    return{
      route:document.body.dataset.route,
      links:['fnbStyle','fnbApprovedPolish','fnbRefinements','fnbLayoutStability'].map(key=>Boolean(document.querySelector(`link[data-${key.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())}]`))),
      trigger:{display:t?.display,height:t?.height},
      svg:{width:s?.width,height:s?.height,fill:s?.fill},
      menu:{position:m?.position,visibility:m?.visibility,pointerEvents:m?.pointerEvents},
      option:{display:o?.display,minHeight:o?.minHeight},
      nativeSelect:{display:n?.display},
      cardPaddingBottom:c?.paddingBottom,
      updated:Boolean(document.querySelector('[data-fnb-data-updated]'))
    };
  });
  if(closed.route!=='fnb')throw new Error(`${name}: route mismatch ${JSON.stringify(closed)}`);
  if(closed.links.some(value=>!value))throw new Error(`${name}: missing F&B style layer ${JSON.stringify(closed)}`);
  if(closed.trigger.display!=='flex'||parseFloat(closed.trigger.height)<39)throw new Error(`${name}: trigger styling missing ${JSON.stringify(closed)}`);
  if(Math.abs(parseFloat(closed.svg.width)-15)>1||Math.abs(parseFloat(closed.svg.height)-15)>1)throw new Error(`${name}: chevron geometry broken ${JSON.stringify(closed)}`);
  if(closed.menu.position!=='absolute'||closed.menu.visibility!=='hidden'||closed.menu.pointerEvents!=='none')throw new Error(`${name}: closed menu styling broken ${JSON.stringify(closed)}`);
  if(closed.option.display!=='flex'||parseFloat(closed.option.minHeight)<41)throw new Error(`${name}: option row styling broken ${JSON.stringify(closed)}`);
  if(closed.nativeSelect.display!=='none')throw new Error(`${name}: native select exposed ${JSON.stringify(closed)}`);
  if(parseFloat(closed.cardPaddingBottom)<60)throw new Error(`${name}: layout-stability layer missing ${JSON.stringify(closed)}`);
  if(!closed.updated)throw new Error(`${name}: route helper layer missing ${JSON.stringify(closed)}`);

  await page.click('[data-filter-trigger="outlet"]');
  await page.waitForTimeout(320);
  const open=await page.evaluate(()=>{
    const menu=document.querySelector('#fnb-outlet-menu'),trigger=document.querySelector('[data-filter-trigger="outlet"]');
    const m=getComputedStyle(menu);
    return{visibility:m.visibility,pointerEvents:m.pointerEvents,expanded:trigger?.getAttribute('aria-expanded')};
  });
  if(open.visibility!=='visible'||open.pointerEvents==='none'||open.expanded!=='true')throw new Error(`${name}: open menu styling broken ${JSON.stringify(open)}`);
  if(errors.length)throw new Error(`${name}: ${errors.join('\n')}`);
  await browser.close();
  console.log(JSON.stringify({ok:true,browser:name,closed,open}));
}
