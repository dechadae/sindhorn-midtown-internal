import assert from 'node:assert/strict';
import {resolveTmdCurrentRain} from './rain-observation.js';

let r=resolveTmdCurrentRain({fresh:true,weatherCode:63,weatherTypeRainHint:true,precip15MinsMm:0});
assert.equal(r.observedWet,true,'fresh TMD Rain must not be vetoed by a zero trailing 15-minute bucket');
assert.equal(r.observedDry,false);
assert.equal(r.evidence,'current-condition-wet');

r=resolveTmdCurrentRain({fresh:true,weatherCode:3,weatherTypeRainHint:false,precip15MinsMm:.8});
assert.equal(r.observedWet,false);
assert.equal(r.observedDry,true,'fresh TMD non-rain condition must release rain even while earlier accumulation remains');
assert.equal(r.evidence,'current-condition-dry');

r=resolveTmdCurrentRain({fresh:false,weatherCode:63,weatherTypeRainHint:true,precip15MinsMm:1.2});
assert.equal(r.observedWet,false,'stale TMD rain condition must never activate current rain');
assert.equal(r.observedDry,false);
assert.equal(r.evidence,'ambiguous');

r=resolveTmdCurrentRain({fresh:true,weatherCode:-1,weatherTypeRainHint:false,precip15MinsMm:0});
assert.equal(r.observedWet,false);
assert.equal(r.observedDry,false,'unknown TMD condition must remain ambiguous rather than inventing dry');

console.log('weather-core rain observation tests PASS');
