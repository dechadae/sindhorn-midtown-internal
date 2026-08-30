import fs from 'node:fs/promises';

function assert(condition,message){if(!condition)throw new Error(message)}

const dataUrl=new URL('../site/hotel-factsheet-data.js',import.meta.url);
const routeText=await fs.readFile(new URL('../site/route-registry.js',import.meta.url),'utf8');
const footerText=await fs.readFile(new URL('../site/footer-route-guard.js',import.meta.url),'utf8');
const footerCss=await fs.readFile(new URL('../site/footer-route-guard.css',import.meta.url),'utf8');
const heroCss=await fs.readFile(new URL('../site/route-hero-standard.css',import.meta.url),'utf8');
const controlsText=await fs.readFile(new URL('../site/brand-route-controls.js',import.meta.url),'utf8');
const redirects=await fs.readFile(new URL('../site/_redirects',import.meta.url),'utf8');
const brandText=await fs.readFile(new URL('../site/brand.js',import.meta.url),'utf8');
const brandCss=await fs.readFile(new URL('../site/brand.css',import.meta.url),'utf8');
const factsheetText=await fs.readFile(new URL('../site/hotel-factsheet.js',import.meta.url),'utf8');
const factsheetCss=await fs.readFile(new URL('../site/hotel-factsheet.css',import.meta.url),'utf8');
const indexText=await fs.readFile(new URL('../site/index.html',import.meta.url),'utf8');
const {HOTEL_FACTSHEET:DATA,HOTEL_FACTSHEET_SOURCES:SOURCES,HOTEL_FACTSHEET_SOURCE_NOTES:NOTES}=await import(dataUrl);

assert(DATA.verifiedOn==='2026-08-30','Verification date mismatch');
assert(DATA.hotel.name==='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG','Full hotel identity mismatch');
assert(DATA.hotel.roomsAndSuites===393,'Room inventory mismatch');
assert(DATA.hotel.roomTypes===12&&DATA.rooms.length===12,'Room type count mismatch');
assert(DATA.hotel.diningVenues===5&&DATA.dining.length===5,'Dining venue count mismatch');
assert(DATA.hotel.meetingMaxGuests===120,'Meeting capacity mismatch');
assert(DATA.hotel.checkIn==='15:00'&&DATA.hotel.checkOut==='12:00','Check-in/out mismatch');
assert(DATA.rooms.find(room=>room.name==='Studio')?.sizeSqm===33,'Studio canonical size mismatch');
assert(DATA.rooms.find(room=>room.name==='Studio')?.highlights.some(x=>/No in-room air purifier/.test(x)),'Studio purifier exception missing');
assert(DATA.rooms.find(room=>room.name==='One Bedroom Urban Studio')?.highlights.some(x=>/No in-room air purifier/.test(x)),'Urban Studio purifier exception missing');
assert(DATA.meetings.spaces.find(room=>room.name==='Veha (Veha 1+2)')?.cocktail===120,'Veha maximum mismatch');
assert(DATA.meetings.spaces.find(room=>room.name==='Midtown (2+3)')?.theater===54,'Midtown table theater capacity mismatch');
assert(NOTES.length>=4,'Canonical source-conflict notes must remain in data');
assert(Object.values(SOURCES).every(url=>url.startsWith('https://www.sindhornmidtown.com/')),'Non-official factsheet source detected');

assert(routeText.includes("brand:Object.freeze({path:'/brand'"),'Brand route missing');
assert(routeText.includes("hotelFactsheet:Object.freeze({path:'/hotel-factsheet'"),'Hotel factsheet route missing');
assert(routeText.includes("module:'./hotel-factsheet-route.js?v=2'"),'Factsheet mount serialization wrapper missing');
assert(routeText.includes("ihgHistory:Object.freeze({path:'/ihg-history'"),'History route was not preserved');
assert(routeText.includes("settings-route-v3.js?v=9&r=5"),'Current Settings route version was not preserved');
assert(routeText.includes("module:'./brand.js?v=3'"),'Brand cache revision missing');
assert(footerText.includes("{route:'brand',label:'Brand',href:'/brand'}"),'Footer Brand target mismatch');
assert(footerText.includes("path==='/brand'||path==='/ihg-history'||path==='/hotel-factsheet'"),'Brand child active-state mapping missing');
assert(footerText.includes("factsheet:{")&&footerText.includes('show:()=>false'),'Factsheet secondary footer is not explicitly disabled');
assert(!footerCss.includes('#app-footer .factsheet-section-rail{\n  display:flex!important'),'Legacy Factsheet second footer styling remains active');
assert(footerCss.includes('body[data-route="hotelFactsheet"] #route-view{padding-bottom:28px!important}'),'Factsheet single-footer bottom spacing missing');
assert(footerCss.includes('grid-template-columns:88px minmax(0,1fr)!important'),'Access contact alignment grid missing');
assert(footerCss.includes('align-items:baseline!important'),'Access contact baseline alignment missing');
assert(footerCss.includes('[data-factsheet-section-target="access"]>.factsheet-inline-source{padding-left:100px!important}'),'Location source alignment missing');
assert(heroCss.includes('.brand-route,.factsheet-route'),'Central one-atmosphere rule does not include Brand/Factsheet');
assert(heroCss.includes('.brand-hero')&&heroCss.includes('.factsheet-hero'),'Central F&B hero standard does not include Brand/Factsheet');
assert(heroCss.includes('.ihg-history-hero h1{text-transform:capitalize!important}'),'History title-case rule missing');
assert(heroCss.includes('.factsheet-section-head h2')&&heroCss.includes('font-weight:400!important'),'Regular-weight Brand/Factsheet title standard missing');
assert(heroCss.includes('.route-back-control')&&heroCss.includes('width:36px;height:36px')&&heroCss.includes('border-radius:12px'),'Shared F&B back-control recipe missing');
assert(heroCss.includes('.route-quiet-action')&&heroCss.includes('height:36px;min-height:36px')&&heroCss.includes('font-size:12px'),'Shared Share-style Back-to-top recipe missing');
assert(controlsText.includes("link.href='/brand'")&&controlsText.includes("link.dataset.appRoute='brand'"),'Brand child back control is not SPA-routed');
assert(controlsText.includes("button.dataset.routeBackToTop='true'")&&controlsText.includes("window.scrollTo({top:0"),'Back-to-top behavior missing');
assert(controlsText.includes(".ihg-history-route")&&controlsText.includes(".factsheet-route"),'History/Factsheet controls are not centralized together');
assert(brandText.includes('<h1>Know Our Hotel</h1>'),'Brand title case mismatch');
assert(brandText.includes('<h2>Our History</h2>')&&brandText.includes('<h2>Hotel Factsheet</h2>'),'Brand card title case mismatch');
assert(brandCss.includes('background:var(--brand-glass);backdrop-filter:blur(18px) saturate(1.18);-webkit-backdrop-filter:blur(18px) saturate(1.18)'),'Brand card final F&B glass recipe missing');
assert(brandCss.includes('padding:16px 17px')&&brandCss.includes('border-radius:14px'),'Brand card F&B geometry missing');
assert(brandCss.includes('font-size:clamp(16px,3.6vw,19px);font-weight:400;line-height:1.25'),'Brand card F&B title recipe missing');
assert(factsheetText.includes('<h1>Hotel Factsheet</h1>'),'Factsheet title case mismatch');
assert(factsheetText.includes('factsheet-room-card-button'),'History-style room accordion missing');
assert(!factsheetText.includes('<details class="factsheet-disclosure factsheet-room"'),'Legacy room details remain');
assert(factsheetText.includes('factsheet-included-card'),'Meeting Included card was not standardized');
assert(!factsheetText.includes('factsheet-provenance')&&!factsheetText.includes('Verification notes'),'Visible Sources section still rendered');
assert(factsheetCss.includes('width:108px;min-width:108px;max-width:108px'),'Meeting room column was not narrowed');
assert(redirects.includes('/brand / 200')&&redirects.includes('/hotel-factsheet / 200'),'Cloudflare SPA rewrites missing');
assert(indexText.includes('/footer-route-guard.css?v=14')&&indexText.includes('/footer-route-guard.js?v=14'),'Footer guard cache-bust missing');
assert(!indexText.includes('/factsheet-footer-align.js'),'Factsheet-only second-footer enhancer is still loaded');
assert(indexText.includes('/route-hero-standard.css?v=4'),'Central hero/control cache-bust missing');
assert(indexText.includes('/brand-route-controls.js?v=1'),'Shared Brand child controls module is not loaded');

console.log(JSON.stringify({
  ok:true,verifiedOn:DATA.verifiedOn,rooms:DATA.hotel.roomsAndSuites,roomTypes:DATA.rooms.length,
  dining:DATA.dining.length,meetingMax:DATA.hotel.meetingMaxGuests,canonicalSourceNotes:NOTES.length
}));
