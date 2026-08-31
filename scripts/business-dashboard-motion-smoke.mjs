import {chromium} from 'playwright';

const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const authShim=`
window.__SINDHORN_AUTH_PROFILE__={employee_number:'10639',display_name:'Motion Preview',pin_configured_at:new Date().toISOString()};
await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/location.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
await import('/bootstrap.js');
`;

const month=(stayMonth,otbOcc,forecastOcc,otbRevenue,forecastRevenue,pickupRns,pickupRevenue)=>({stayMonth,pickup:{rns:pickupRns,adr:4200,revenue:pickupRevenue},otb:{rns:6000,adr:4100,revenue:otbRevenue,occupancy:otbOcc,revpar:Math.round(4100*otbOcc)},forecast:{rns:7600,adr:4200,revenue:forecastRevenue,occupancy:forecastOcc,revpar:Math.round(4200*forecastOcc)},budget:{rns:7300,adr:4300,revenue:31390000,occupancy:.62,revpar:2666},stly:{rns:5700,adr:3900,revenue:22230000,occupancy:.49,revpar:1911},lastYear:{rns:6500,adr:3950,revenue:25675000,occupancy:.55,revpar:2173}});
const outlet=(key,label,revenue,forecast)=>({key,label,revenue,forecast,variance:revenue-forecast,covers:120,foodNet:revenue*.7,beverageNet:revenue*.25,other:revenue*.05,dayparts:[{key:'breakfast',label:'Breakfast',covers:50,foodNet:revenue*.25,beverageNet:revenue*.05,revenue:revenue*.3},{key:'lunch',label:'Lunch',covers:35,foodNet:revenue*.2,beverageNet:revenue*.08,revenue:revenue*.3},{key:'dinner',label:'Dinner',covers:35,foodNet:revenue*.25,beverageNet:revenue*.12,revenue:revenue*.4}]});

function dashboard({publishedAt,revision,fnbRevenue,occupancy,pickupRns,pickupRevenue,newFlag=false}){
  return{businessDate:'2026-08-31',publishedAt,revision,validationStatus:'passed',sources:[{type:'fnb_xlsx',filename:'F&B Daily Report.xlsx',detectedReportDate:'2026-08-30',metadata:{}},{type:'rooms_pdf',filename:'Rooms Pickup Report.pdf',detectedReportDate:'2026-08-31',metadata:{pickupTo:'2026-08-31'}}],fnb:{summary:{daily:{revenue:fnbRevenue,forecast:460000,covers:640,coverForecast:680,food:300000,foodForecast:320000,beverage:100000,beverageForecast:110000,other:30000,otherForecast:30000,otherDiscount:10000},mtd:{revenue:10800000+(fnbRevenue-420000),forecast:11000000,covers:19000,coverForecast:20000}},outlets:[outlet('bangkok78',"Bangkok'78",170000,180000),outlet('ird','IRD',55000,60000),outlet('lobby','The Lobby Lounge',35000,0),outlet('horizon','Horizon Pool',45000,50000),outlet('sip','Sip & Co',48000,52000),outlet('ce','C&E',25000,55000),outlet('anju','ANJU',42000,63000)],notes:[{outletKey:'bangkok78',outlet:"Bangkok'78",daypartKey:'breakfast',daypart:'Breakfast',displayText:'Breakfast service remained smooth.'}]},rooms:{months:[month('2026-08-01',occupancy,.87,43800000,43000000,pickupRns,pickupRevenue),month('2026-09-01',.51,.68,19400000,27200000,103,432600),month('2026-10-01',.29,.67,11700000,30200000,42,176400),month('2026-11-01',.35,.85,14600000,39800000,65,273000),month('2026-12-01',.26,.90,15000000,54700000,76,319200),month('2027-01-01',.13,0,7500000,0,-1,-4200)],segments:[{stayMonth:'2026-08-01',key:'transient',label:'Transient',otb:{rns:2500,revenue:13200000},forecast:{rns:2800,revenue:14600000},pickup:{rns:11,revenue:85000}},{stayMonth:'2026-08-01',key:'corporate',label:'Corporate',otb:{rns:1300,revenue:4300000},forecast:{rns:1200,revenue:4300000},pickup:{rns:2,revenue:9000}},{stayMonth:'2026-08-01',key:'wholesale',label:'Wholesale',otb:{rns:4000,revenue:14200000},forecast:{rns:3500,revenue:12100000},pickup:{rns:0,revenue:0}},{stayMonth:'2026-08-01',key:'package',label:'Package',otb:{rns:1200,revenue:7100000},forecast:{rns:1400,revenue:7900000},pickup:{rns:25,revenue:120000}},{stayMonth:'2026-08-01',key:'pnp_disc',label:'P&P Disc',otb:{rns:700,revenue:1900000},forecast:{rns:600,revenue:1400000},pickup:{rns:2,revenue:6000}},{stayMonth:'2026-08-01',key:'group',label:'Group',otb:{rns:260,revenue:810000},forecast:{rns:255,revenue:780000},pickup:{rns:0,revenue:0}},{stayMonth:'2026-08-01',key:'airline_crew',label:'Airline Crew',otb:{rns:800,revenue:2300000},forecast:{rns:740,revenue:2000000},pickup:{rns:0,revenue:0}}]},flags:[{domain:'fnb',scopeKey:'ce',metricKey:'outlet_revenue',severity:'watch',title:'C&E is below forecast',detail:'Outlet revenue is materially behind its daily forecast.',payload:{variancePct:-.545}},...(newFlag?[{domain:'rooms',scopeKey:'pickup',metricKey:'pickup_rns',severity:'watch',title:'Pickup softened',detail:'24-hour pickup changed versus the prior publication.',payload:{}}]:[])]};
}

async function waitForStableRoute(page){
  await page.waitForSelector('.business-dashboard-route[data-bd-motion-ready="true"]');
  // Bootstrap may refresh the remote presentation pack once after first paint and remount
  // the local Today route. Match the established dashboard browser smoke and wait for the
  // final in-shell mount before measuring motion state.
  await page.waitForTimeout(1000);
  await page.waitForSelector('.business-dashboard-route[data-bd-motion-ready="true"]');
  await page.waitForFunction(()=>{
    const group=document.querySelector('.bd-glance-group[data-domain="fnb"]');
    return group&&Number.parseFloat(getComputedStyle(group).opacity)>.995;
  });
}

async function waitForRefreshedMotionState(page){
  // A publication refresh may overlap with a shell/presentation remount. Assert the complete
  // post-refresh state on one currently connected Today root rather than sampling an older root.
  await page.waitForFunction(()=>{
    const root=document.querySelector('.business-dashboard-route');
    const occupancy=root?.querySelector('[data-bd-motion-key="rooms.current.occupancy"]');
    return root?.dataset.bdMotionReady==='true'&&occupancy?.dataset.bdMotionValue==='0.902';
  });
  await page.waitForFunction(()=>document.querySelector('.business-dashboard-route .bd-update-stamp')?.classList.contains('is-fresh'));
  await page.waitForTimeout(760);
  await page.waitForFunction(()=>{
    const root=document.querySelector('.business-dashboard-route');
    return root?.dataset.bdMotionReady==='true'&&root.querySelector('[data-bd-motion-key="rooms.current.occupancy"]')?.dataset.bdMotionValue==='0.902';
  });
}

async function run(reducedMotion){
  let current=dashboard({publishedAt:'2026-08-31T01:00:00Z',revision:1,fnbRevenue:420000,occupancy:.89,pickupRns:40,pickupRevenue:168000});
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/auth-shell.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:authShim}));
  await page.route('**/rest/v1/rpc/sindhorn_business_dashboard_read_model',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(current)}));
  try{
    await page.goto(`${BASE_URL}/`,{waitUntil:'domcontentloaded'});
    await waitForStableRoute(page);
    const initial=await page.evaluate(()=>({groupOpacity:getComputedStyle(document.querySelector('.bd-glance-group[data-domain="fnb"]')).opacity,metricCount:document.querySelectorAll('[data-bd-motion-key]').length,varianceCount:document.querySelectorAll('.bd-variance-track').length,outlookCount:document.querySelectorAll('.bd-outlook-track').length,snapshot:localStorage.getItem('sindhorn-business-dashboard-motion-v2')}));
    assert(Number.parseFloat(initial.groupOpacity)>.995,`${reducedMotion}: glance group did not settle ${JSON.stringify(initial)}`);
    assert(initial.metricCount>=10,`${reducedMotion}: motion metrics missing`);
    assert(initial.varianceCount>=5,`${reducedMotion}: variance indicators missing`);
    assert(initial.outlookCount>=4,`${reducedMotion}: outlook indicators missing`);
    assert(Boolean(initial.snapshot),`${reducedMotion}: motion snapshot missing`);

    current=dashboard({publishedAt:'2026-08-31T02:00:00Z',revision:2,fnbRevenue:445000,occupancy:.902,pickupRns:15,pickupRevenue:97034,newFlag:true});
    await page.evaluate(()=>window.SindhornBusinessDashboard.refresh());
    await waitForRefreshedMotionState(page);
    const refreshed=await page.evaluate(()=>{const root=document.querySelector('.business-dashboard-route');return{occupancy:root?.querySelector('[data-bd-motion-key="rooms.current.occupancy"]')?.textContent.trim(),pickup:root?.querySelector('[data-bd-motion-key="rooms.current.pickup.rns"]')?.textContent.trim(),fnb:root?.querySelector('[data-bd-motion-key="fnb.daily.revenue"]')?.textContent.trim(),newFlag:root?.querySelectorAll('.bd-flag.is-new').length||0,ready:root?.dataset.bdMotionReady,activeAnimations:document.getAnimations().filter(animation=>animation.playState==='running').length}});
    assert(refreshed.occupancy==='90.2%',`${reducedMotion}: occupancy did not finish at new value ${JSON.stringify(refreshed)}`);
    assert(refreshed.pickup==='+15 RN',`${reducedMotion}: pickup did not finish at new value ${JSON.stringify(refreshed)}`);
    assert(refreshed.fnb==='฿445K',`${reducedMotion}: F&B value did not finish at new value ${JSON.stringify(refreshed)}`);
    assert(refreshed.ready==='true',`${reducedMotion}: motion-ready flag missing`);
    if(reducedMotion==='reduce')assert(refreshed.activeAnimations===0,`reduced motion still has active animations ${JSON.stringify(refreshed)}`);
    else assert(refreshed.newFlag===1,`new exception did not receive one-time transition class ${JSON.stringify(refreshed)}`);
    return{reducedMotion,initial,refreshed};
  }finally{await context.close();await browser.close()}
}

const results=[await run('no-preference'),await run('reduce')];
console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,results}));