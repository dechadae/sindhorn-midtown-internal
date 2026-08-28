import assert from 'node:assert/strict';
import {bangkokSeasonalProfile,cloudMorphologyForWeather,seasonalSkyForState,weatherFamily} from './seasonal-sky.js';
import {PHASE82_FIXTURES,PHASE82_FIXTURE_KEYS} from './phase8-2-fixtures.js';
import {ATMOSPHERE_FRAGMENT_SHADER} from './atmosphere-shader.js';
import fs from 'node:fs';

const distance=(a,b)=>Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0));
assert.equal(PHASE82_FIXTURE_KEYS.length,11);
for(const key of PHASE82_FIXTURE_KEYS){const f=PHASE82_FIXTURES[key];assert.ok(Number.isFinite(Date.parse(f.iso)),key);assert.ok(Number.isInteger(f.weatherCode),key)}

// Continuous month boundary: no abrupt palette jump.
for(const [a,b] of [['2026-01-31T23:59:00+07:00','2026-02-01T00:01:00+07:00'],['2026-08-31T23:59:00+07:00','2026-09-01T00:01:00+07:00'],['2026-12-31T23:59:00+07:00','2027-01-01T00:01:00+07:00']]){
  const p1=bangkokSeasonalProfile(new Date(a)),p2=bangkokSeasonalProfile(new Date(b));assert.ok(distance(p1.sunsetHorizon,p2.sunsetHorizon)<.012,`${a} -> ${b}`);assert.ok(Math.abs(p1.violet-p2.violet)<.02,`${a} violet`);
}

const jan=bangkokSeasonalProfile(new Date('2026-01-15T18:01:00+07:00')),apr=bangkokSeasonalProfile(new Date('2026-04-15T18:23:00+07:00')),aug=bangkokSeasonalProfile(new Date('2026-08-27T18:25:00+07:00')),oct=bangkokSeasonalProfile(new Date('2026-10-15T17:51:00+07:00'));
assert.ok(jan.violet>apr.violet,'cool season should have more violet potential than April');
assert.ok(apr.haze>jan.haze,'April should carry stronger heat/haze prior than January');
assert.ok(aug.convective>jan.convective,'August should carry stronger convective prior than January');
assert.ok(oct.pink>aug.pink,'October transition should recover more pink potential after monsoon peak');

// Weather wins: clear does not invent cloud; partly cloudy keeps gaps; storms remain low-cloud dominant.
const clear=cloudMorphologyForWeather({weatherCode:0,cloudCover:0,humidity:.7},jan);assert.deepEqual([clear.high,clear.mid,clear.low],[0,0,0]);
const partly=cloudMorphologyForWeather({weatherCode:2,cloudCover:.52,humidity:.72},jan);assert.ok(partly.mid>.45&&partly.mid<.9);assert.ok(partly.connected<.2);
const overcast=cloudMorphologyForWeather({weatherCode:3,cloudCover:.98,humidity:.75},jan);assert.ok(overcast.mid>.9&&overcast.connected>.85);
const storm=cloudMorphologyForWeather({weatherCode:95,cloudCover:1,humidity:.96,storm:.9,precipitation:5},aug);assert.equal(storm.low,1);assert.ok(storm.darkness>.7);
assert.equal(weatherFamily(95),'thunderstorm');assert.equal(weatherFamily(2),'partly-cloudy');

// Winter overcast may have seasonal colour behind the cloud deck, but the colour gate is strongly suppressed.
const janOvercast=seasonalSkyForState({date:new Date('2026-01-15T18:01:00+07:00'),solarAltitude:1,solarAzimuth:248,weather:{weatherCode:3,cloudCover:.98,humidity:.75}});assert.ok(janOvercast.warmPotential<.25);assert.ok(janOvercast.morphology.connected>.85);
const janPartly=seasonalSkyForState({date:new Date('2026-01-15T18:01:00+07:00'),solarAltitude:1,solarAzimuth:248,weather:{weatherCode:2,cloudCover:.48,humidity:.62}});assert.ok(janPartly.warmPotential>janOvercast.warmPotential*2.5);

// Shader contract: the three cloud depth families and actual sun projection are explicit.
for(const token of ['uHighCoverage','uMidCoverage','uLowCoverage','uConnected','uSun','uSolarAltitude','sunDisc','Visible sun disc','High veil / cirrus','Mid broken cloud','Low convective / monsoon','AirBKK PM2.5 optics','texture2D(uNoise'])assert.ok(ATMOSPHERE_FRAGMENT_SHADER.includes(token),token);
assert.ok(!ATMOSPHERE_FRAGMENT_SHADER.includes('for(int i=0;i<5'),'fragment shader should not rebuild five-octave hash FBM per pixel');
assert.ok(!ATMOSPHERE_FRAGMENT_SHADER.includes('exp('),'fragment shader lighting should avoid exponential hotspots');
assert.ok(!ATMOSPHERE_FRAGMENT_SHADER.includes('layeredNoise'),'old multi-sample layered noise helper must stay retired');
const textureSamples=(ATMOSPHERE_FRAGMENT_SHADER.match(/noise4\(/g)||[]).length;
assert.ok(textureSamples<=8,`shared shader texture-sample call sites should remain bounded (found ${textureSamples})`);
for(const branch of ['if(uHighCoverage>.003','if(uMidCoverage>.003','if(uLowCoverage>.003'])assert.ok(ATMOSPHERE_FRAGMENT_SHADER.includes(branch),branch);

// Performance contract: keep DPR 2 and visual quality while removing redundant live work.
const env=fs.readFileSync(new URL('./environment.js',import.meta.url),'utf8');
assert.ok(env.includes('const DPR=2'),'fixed DPR 2 must remain');
assert.ok(env.includes('antialias:false'),'fullscreen shader should avoid unnecessary live MSAA');
const liveRenderer=env.match(/renderer=new THREE\.WebGLRenderer\((\{[^;]+?\})\)/)?.[1]||'';assert.ok(!liveRenderer.includes('preserveDrawingBuffer:true'),'live renderer must not preserve drawing buffer');
assert.ok(env.includes('ensureSnowCanvas()')&&env.includes('ensureHailCanvas()'),'rare precipitation overlays should allocate lazily');
const rain=fs.readFileSync(new URL('./rain-layer.js',import.meta.url),'utf8');
assert.ok(rain.includes("document.addEventListener('sindhorn:weather-updated',start)"),'rain renderer must wake on live weather updates');
assert.ok(rain.includes("targetIntensity===0&&currentIntensity<.001"),'dry production rain renderer must be able to sleep');
console.log(`Phase 8.2 seasonal/cloud fixtures PASS (${PHASE82_FIXTURE_KEYS.length} deterministic cases; ${textureSamples} bounded noise call sites)`);
