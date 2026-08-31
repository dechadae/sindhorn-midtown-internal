import fs from 'node:fs';
import {chromium} from 'playwright';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';

const base=process.env.BETTA_VIGNETTE_BASE_URL;
if(!base)throw new Error('BETTA_VIGNETTE_BASE_URL required');
fs.mkdirSync('betta-vignette-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});

async function review({period,viewport,suffix}){
  const context=await browser.newContext({viewport,screen:viewport,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('503'))errors.push(message.text())});
  await page.goto(`${base}/betta-vignette-test.html?period=${period.key}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(expected=>window.SindhornEnvironment?.getState?.()?.betta?.dayCycle?.targetPeriodKey===expected,period.key,{timeout:60000});
  await page.waitForTimeout(1600);
  const result=await page.evaluate(()=>{const state=window.SindhornEnvironment.getState(),canvas=document.querySelector('#environmentCanvas');return{renderer:state.renderer,inputMode:state.inputMode,baselineAuthority:state.betta?.baselineAuthority,period:state.betta?.dayCycle?.targetPeriodKey,baseline:state.betta?.dayCycle?.targetBaseline,referenceId:Number(document.body.dataset.referenceId||0),hasGradeControls:Boolean(document.querySelector('[data-grades],[data-grade]')),canvas:{width:canvas?.width||0,height:canvas?.height||0,cssWidth:canvas?.clientWidth||0,cssHeight:canvas?.clientHeight||0},viewport:{width:innerWidth,height:innerHeight}}});
  if(result.renderer!=='sindhorn-betta-satellite-v1'||result.inputMode!=='satellite-only')throw new Error(`${period.key}: renderer/input mismatch`);
  if(result.baselineAuthority!=='bangkok-day-cycle')throw new Error(`${period.key}: wrong authority`);
  if(result.period!==period.key||result.baseline!==period.baseline||result.referenceId!==period.referenceId)throw new Error(`${period.key}: mapping mismatch ${JSON.stringify(result)}`);
  if(result.hasGradeControls)throw new Error(`${period.key}: obsolete grade controls still exposed`);
  if(result.canvas.width<result.canvas.cssWidth*1.9||result.canvas.height<result.canvas.cssHeight*1.9)throw new Error(`${period.key}: DPR 2 failed`);
  if(errors.length)throw new Error(`${period.key}: ${errors.join(' | ')}`);
  const name=`${suffix}-${period.key}-fish-${period.referenceId}`;
  await page.screenshot({path:`betta-vignette-artifacts/${name}.png`,fullPage:true});
  await context.close();return result;
}

const results=[];
for(const period of BETTA_DAY_PERIODS)results.push(await review({period,viewport:{width:390,height:844},suffix:'mobile-390'}));
for(const key of ['midnight','before-dawn','golden-hour','blue-hour']){const period=BETTA_DAY_PERIODS.find(p=>p.key===key);results.push(await review({period,viewport:{width:1440,height:1000},suffix:'desktop'}));}
fs.writeFileSync('betta-vignette-artifacts/results.json',JSON.stringify(results,null,2));
await browser.close();
console.log('Final-reference-only tail reviewer passed eight mobile periods plus representative desktop views.');
