import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.VOLUMETRIC_LAB_BASE_URL;if(!base)throw new Error('VOLUMETRIC_LAB_BASE_URL required');
fs.mkdirSync('volumetric-weather-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
async function shot(viewport,preset,name,{bolt=false}={}){
  const page=await browser.newPage({viewport,screen:viewport});page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${name} console: ${m.text()}`)});
  await page.goto(`${base}/volumetric-weather-tester.html`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__volumetricLabReady===true&&window.VolumetricWeatherLab,null,{timeout:30000});
  await page.evaluate(({preset,bolt})=>{window.VolumetricWeatherLab.applyPreset(preset);window.VolumetricWeatherLab.hideControls();if(bolt)window.VolumetricWeatherLab.triggerLightning(true)},{preset,bolt});
  await page.waitForTimeout(bolt?90:900);
  const metrics=await page.evaluate(()=>window.VolumetricWeatherLab.metrics());
  if(metrics.webgl2!==true)throw new Error(`${name}: WebGL2 missing`);if(metrics.dpr!==2)throw new Error(`${name}: final DPR is ${metrics.dpr}`);if(metrics.cloud.raySteps>12)throw new Error(`${name}: ray-step budget exceeded`);if(metrics.cloud.linearScale>=.5)throw new Error(`${name}: cloud pass is not reduced resolution`);
  await page.screenshot({path:`volumetric-weather-artifacts/${name}.png`,fullPage:true});await page.close();return metrics;
}
let results={};let fatal=null;try{
  results.augPartly=await shot({width:390,height:844},'augPartly','mobile-aug-partly');
  results.augStorm=await shot({width:390,height:844},'augStorm','mobile-aug-storm-lightning',{bolt:true});
  results.aprHaze=await shot({width:390,height:844},'aprHaze','mobile-apr-heat-haze');
  results.snow=await shot({width:390,height:844},'snowDemo','mobile-snow-fx');
  results.desktop=await shot({width:1440,height:1000},'janBroken','desktop-jan-broken');
}catch(e){fatal=e;errors.push(`fatal: ${e.message}`)}finally{await browser.close();fs.writeFileSync('volumetric-weather-artifacts/metrics.json',JSON.stringify({benchmark:'CPU-only SwiftShader diagnostic; physical Android visual acceptance remains required',results,errors},null,2))}
if(fatal)throw fatal;if(errors.length)throw new Error(errors.join('\n'));
