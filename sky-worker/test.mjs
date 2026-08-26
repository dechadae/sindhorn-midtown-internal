import assert from 'node:assert/strict';
import { automatedCameras } from './src/cameras.js';
import { calibrationMode, chooseCameras, directionalBase, fuseObservations, validateObservation } from './src/calibration.js';

const now=Date.now();
const cameras=automatedCameras();
assert.ok(cameras.some(camera=>camera.facing==='east'),'east camera missing');
assert.ok(cameras.some(camera=>camera.facing==='west'),'west camera missing');

assert.equal(calibrationMode({altitude:3,azimuth:82}),'sunrise-east');
assert.equal(calibrationMode({altitude:2,azimuth:278}),'sunset-west');
assert.equal(calibrationMode({altitude:50,azimuth:180}),'day-consensus');
assert.equal(calibrationMode({altitude:-18,azimuth:90}),'night');
assert.ok(directionalBase('east','sunrise-east')>directionalBase('west','sunrise-east'));
assert.ok(directionalBase('west','sunset-west')>directionalBase('east','sunset-west'));

const sunrise=chooseCameras(cameras,{altitude:4,azimuth:85},3);
assert.equal(sunrise.mode,'sunrise-east');
assert.equal(sunrise.cameras[0].facing,'east');
const sunset=chooseCameras(cameras,{altitude:3,azimuth:275},3);
assert.equal(sunset.mode,'sunset-west');
assert.equal(sunset.cameras[0].facing,'west');

function raw(overrides={}){return{
  skyVisible:true,quality:.9,confidence:.9,zenithRgb:[60,100,160],horizonRgb:[220,170,130],luminance:.60,saturation:.55,warmth:.65,cloudOpacity:.55,cloudDarkness:.35,haze:.25,horizonContrast:.60,sunGlow:.65,stormConfidence:.08,frameFetchedAt:new Date(now-60_000).toISOString(),frameHash:'a'.repeat(64),...overrides
}}
const eastCamera=cameras.find(camera=>camera.facing==='east');
const westCamera=cameras.find(camera=>camera.facing==='west');
const east=validateObservation(raw({horizonRgb:[250,170,110],warmth:.85}),eastCamera,now);
const west=validateObservation(raw({horizonRgb:[150,170,210],warmth:.25,frameHash:'b'.repeat(64)}),westCamera,now);
assert.ok(east&&west);
assert.equal(validateObservation(raw({quality:.05}),eastCamera,now),null);
assert.equal(validateObservation(raw({frameFetchedAt:new Date(now-25*60_000).toISOString()}),eastCamera,now),null);

const sunriseFusion=fuseObservations([east,west],{now,solar:{altitude:4,azimuth:85},weather:{code:0}});
const sunriseEastWeight=sunriseFusion.sources.find(source=>source.id===east.id).weight;
const sunriseWestWeight=sunriseFusion.sources.find(source=>source.id===west.id).weight;
assert.ok(sunriseEastWeight>sunriseWestWeight,'sunrise must favor east evidence');
assert.ok(sunriseFusion.visual.warmth>.5,'sunrise fusion should preserve warm east evidence');

const sunsetFusion=fuseObservations([east,west],{now,solar:{altitude:3,azimuth:275},weather:{code:0}});
const sunsetEastWeight=sunsetFusion.sources.find(source=>source.id===east.id).weight;
const sunsetWestWeight=sunsetFusion.sources.find(source=>source.id===west.id).weight;
assert.ok(sunsetWestWeight>sunsetEastWeight,'sunset must favor west evidence');
assert.ok(sunsetFusion.confidence>0);

const dayFusion=fuseObservations([east,west],{now,solar:{altitude:55,azimuth:180},weather:{code:2}});
assert.equal(dayFusion.mode,'day-consensus');
assert.equal(dayFusion.sources.length,2);
assert.ok(dayFusion.expiresAt>dayFusion.observedAt);

console.log('Phase 8 directional sky calibration tests passed.');
