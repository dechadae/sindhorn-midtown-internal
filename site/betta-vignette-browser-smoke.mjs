import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.BETTA_VIGNETTE_BASE_URL;
if(!base)throw new Error('BETTA_VIGNETTE_BASE_URL required');
fs.mkdirSync('betta-vignette-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});

async function review(name,viewport,grade,period){
  const page=await browser.newPage({viewportSize:viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(`${base}/betta-vignette-test.html?grade=${grade}&period=${period}`,{waitUntil:'networkidle',timeout:90000});
  await page.waitForFunction(()=>window.SindhornEnvironment?.getState?.()?.betta?.dayCycle?.targetPeriodKey,{timeout:60000});
  await page.waitForTimeout(1600);
  const result=await page.evaluate(()=>{
    const state=window.SindhornEnvironment.getState();
    const canvas=document.querySelector('#environmentCanvas');
    const activeGrade=document.querySelector('[data-grade].is-active')?.dataset.grade;
    return {
      renderer:state.renderer,
      inputMode:state.inputMode,
      baselineAuthority:state.betta?.baselineAuthority,
      period:state.betta?.dayCycle?.targetPeriodKey,
      baseline:state.betta?.dayCycle?.targetBaseline,
      grade:activeGrade,
      canvas:{width:canvas?.width||0,height:canvas?.height||0,cssWidth:canvas?.clientWidth||0,cssHeight:canvas?.clientHeight||0},
      bodyBg:getComputedStyle(document.body).backgroundColor
    };
  });
  if(result.renderer!=='sindhorn-betta-satellite-v1')throw new Error(`${name}: wrong renderer ${result.renderer}`);
  if(result.baselineAuthority!=='bangkok-day-cycle')throw new Error(`${name}: wrong day-cycle authority`);
  if(result.period!==period)throw new Error(`${name}: expected ${period}, got ${result.period}`);
  if(result.grade!==grade)throw new Error(`${name}: expected grade ${grade}, got ${result.grade}`);
  if(result.canvas.width<result.canvas.cssWidth*1.9||result.canvas.height<result.canvas.cssHeight*1.9)throw new Error(`${name}: DPR 2 canvas contract failed`);
  if(errors.length)throw new Error(`${name}: browser errors: ${errors.join(' | ')}`);
  await page.screenshot({path:`betta-vignette-artifacts/${name}.png`,fullPage:true});
  await page.close();
  return result;
}

const results=[];
results.push(await review('mobile-a-midday',{width:390,height:844},'a','midday'));
results.push(await review('mobile-b-golden-hour',{width:390,height:844},'b','golden-hour'));
results.push(await review('desktop-a-bright-morning',{width:1440,height:1000},'a','bright-morning'));
results.push(await review('desktop-b-midnight',{width:1440,height:1000},'b','midnight'));
fs.writeFileSync('betta-vignette-artifacts/results.json',JSON.stringify(results,null,2));
await browser.close();
console.log('Cool Vignette public reviewer smoke passed.');
