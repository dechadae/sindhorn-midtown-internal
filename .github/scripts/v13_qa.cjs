const {chromium}=require(process.cwd()+'/node_modules/playwright');
const fs=require('fs');
function airPayload(){return {status:'Success',message:[{MeasIndex:'114','PM2.5':8.6,aqi:14,DateTime:'2026-08-25 20:00:00',Area:'ถนนพระราม 4 แขวงวังใหม่ เขตปทุมวัน',District:'ปทุมวัน'}]};}
function weatherPayload(){return {current:{temperature_2m:30,apparent_temperature:35,relative_humidity_2m:72,precipitation:0,rain:0,showers:0,weather_code:3,cloud_cover:100,wind_speed_10m:9,wind_direction_10m:270,wind_gusts_10m:18,visibility:9000,is_day:0,time:'2026-08-25T20:00'}};}
async function setup(page){
  await page.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weatherPayload())}));
  await page.route('**/stations.airbkk.com/api/web/data',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(airPayload())}));
}
async function inspect(page){
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>document.body.classList.contains('environment-ready')&&document.body.dataset.environmentWeather==='live',{timeout:15000});
  await page.waitForTimeout(900);
  return page.evaluate(()=>{
    const c=document.getElementById('environmentCanvas'),r=c.getBoundingClientRect(),logo=document.querySelector('.brand-lockup'),th=document.getElementById('connectionTh'),nav=document.querySelector('.app-tabbar');
    return{
      quality:document.body.dataset.environmentQuality,
      effectiveCloud:Number(document.body.dataset.environmentCloudEffective),
      weatherType:document.body.dataset.environmentWeatherType,
      canvasCss:[r.width,r.height],canvasPixels:[c.width,c.height],
      logoWidth:logo.getBoundingClientRect().width,
      thaiFont:getComputedStyle(th).fontFamily,
      nav:{left:nav.getBoundingClientRect().left,right:nav.getBoundingClientRect().right,width:nav.getBoundingClientRect().width,radius:getComputedStyle(nav).borderRadius}
    };
  });
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
  const mp=await mobile.newPage();await setup(mp);const mi=await inspect(mp);console.log('mobile',mi);
  if(mi.quality!=='2.00')throw new Error('mobile renderer is not full DPR2');
  if(mi.effectiveCloud<.90||mi.weatherType!=='overcast')throw new Error('overcast weather is not authoritative');
  if(mi.canvasPixels[0]<mi.canvasCss[0]*1.9)throw new Error('mobile backing resolution reduced');
  if(!/Noto Sans Thai/i.test(mi.thaiFont))throw new Error('Thai live status is not Noto Sans Thai');
  if(Math.abs(mi.logoWidth-99)>3)throw new Error('mobile logo is not 10% reduced: '+mi.logoWidth);
  if(mi.nav.left>1||Math.abs(mi.nav.width-390)>2||mi.nav.radius!=='0px')throw new Error('footer is not Voice-style edge rail');

  await mp.click('[data-app-route="guidance"]');await mp.waitForTimeout(750);
  const g=await mp.evaluate(()=>({route:document.body.dataset.route,kicker:document.querySelector('.route-kicker').textContent,heading:document.querySelector('.route-hero h1').textContent}));
  if(g.route!=='guidance'||/^\d/.test(g.kicker)||!g.kicker.toLowerCase().includes('air quality'))throw new Error('guidance route/kicker failed');
  await mp.click('[data-app-route="details"]');await mp.waitForTimeout(750);
  const d=await mp.evaluate(()=>({route:document.body.dataset.route,kicker:document.querySelector('.route-kicker').textContent}));
  if(d.route!=='details'||/^\d/.test(d.kicker)||!d.kicker.toLowerCase().includes('observation'))throw new Error('details route/kicker failed');
  await mp.click('[data-app-route="today"]');await mp.waitForTimeout(750);

  const downloadPromise=mp.waitForEvent('download',{timeout:45000});
  await mp.click('#saveImageBtn');
  const download=await downloadPromise,path=await download.path(),b=fs.readFileSync(path),w=b.readUInt32BE(16),h=b.readUInt32BE(20);
  console.log('capture',download.suggestedFilename(),w,h);
  if(!download.suggestedFilename().includes('-full-')||w<760||h<1600||h<=w*1.25)throw new Error('save is not a long full-page capture');

  await mp.evaluate(()=>{
    const e=new Event('deviceorientation');
    Object.defineProperty(e,'gamma',{value:16});Object.defineProperty(e,'beta',{value:55});window.dispatchEvent(e);
  });
  await mp.waitForTimeout(80);
  const tilt=await mp.evaluate(()=>({mode:document.body.dataset.environmentTiltMode||'',value:document.body.dataset.environmentTilt||''}));console.log('tilt',tilt);
  if(tilt.mode==='device'&&!tilt.value)throw new Error('device tilt did not update');
  await mobile.close();

  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const dp=await desktop.newPage();await setup(dp);const di=await inspect(dp);console.log('desktop',di);
  if(di.quality!=='2.00')throw new Error('desktop renderer differs from mobile quality');
  if(di.effectiveCloud<.90)throw new Error('desktop weather cloud mismatch');
  await desktop.close();await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
