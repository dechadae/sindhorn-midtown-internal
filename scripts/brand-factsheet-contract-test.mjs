import fs from 'node:fs/promises';

function assert(condition,message){if(!condition)throw new Error(message)}

const dataUrl=new URL('../site/hotel-factsheet-data.js',import.meta.url);
const routeText=await fs.readFile(new URL('../site/route-registry.js',import.meta.url),'utf8');
const footerText=await fs.readFile(new URL('../site/footer-route-guard.js',import.meta.url),'utf8');
const footerCss=await fs.readFile(new URL('../site/footer-route-guard.css',import.meta.url),'utf8');
const footerAlignText=await fs.readFile(new URL('../site/factsheet-footer-align.js',import.meta.url),'utf8');
const heroCss=await fs.readFile(new URL('../site/route-hero-standard.css',import.meta.url),'utf8');
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
assert(footerText.includes('factsheet:{'),'Factsheet shell context missing');
assert(footerText.includes('factsheetSectionNav'),'Factsheet context forwarding missing');
assert(footerAlignText.includes("const SELECTOR='#app-footer [data-shell-context=\"factsheet\"]'"),'Factsheet-only footer enhancer missing');
assert(footerAlignText.includes("rail.scrollTo({left:target,behavior:smooth&&!reduceMotion()?'smooth':'auto'})"),'Factsheet active-chip start alignment missing');
assert(footerCss.includes('#app-footer .factsheet-section-rail'),'Factsheet second footer styling missing');
assert(footerCss.includes('overflow-x:auto!important'),'Factsheet second footer is not side-scrollable');
assert(footerCss.includes('padding-left:max(10px,env(safe-area-inset-left))!important'),'Factsheet footer live edge inset missing');
assert(footerCss.includes('scroll-padding-inline-start:max(10px,env(safe-area-inset-left))'),'Factsheet footer scroll inset missing');
assert(footerCss.includes('.factsheet-section-rail::after'),'Factsheet footer trailing alignment runway missing');
assert(footerCss.includes('#route-view .factsheet-route > .factsheet-section-rail'),'Route-owned factsheet rail is not hidden');
assert(heroCss.includes('.brand-route,.factsheet-route'),'Central one-atmosphere rule does not include Brand/Factsheet');
assert(heroCss.includes('.brand-hero')&&heroCss.includes('.factsheet-hero'),'Central F&B hero standard does not include Brand/Factsheet');
assert(heroCss.includes('.ihg-history-hero h1{text-transform:capitalize!important}'),'History title-case rule missing');
assert(heroCss.includes('.factsheet-section-head h2')&&heroCss.includes('font-weight:400!important'),'Regular-weight Brand/Factsheet title standard missing');
assert(brandText.includes('<h1>Know Our Hotel</h1>'),'Brand title case mismatch');
assert(brandText.includes('<h2>Our History</h2>')&&brandText.includes('<h2>Hotel Factsheet</h2>'),'Brand card title case mismatch');
assert(brandCss.includes('background:var(--brand-glass);backdrop-filter:none;-webkit-backdrop-filter:none'),'Brand card final F&B surface recipe missing');
assert(brandCss.includes('padding:16px 17px')&&brandCss.includes('border-radius:14px'),'Brand card F&B geometry missing');
assert(brandCss.includes('font-size:clamp(16px,3.6vw,19px);font-weight:400;line-height:1.25'),'Brand card F&B title recipe missing');
assert(factsheetText.includes('<h1>Hotel Factsheet</h1>'),'Factsheet title case mismatch');
assert(factsheetText.includes('factsheet-room-card-button'),'History-style room accordion missing');
assert(!factsheetText.includes('<details class="factsheet-disclosure factsheet-room"'),'Legacy room details remain');
assert(factsheetText.includes('factsheet-included-card'),'Meeting Included card was not standardized');
assert(!factsheetText.includes('factsheet-provenance')&&!factsheetText.includes('Verification notes'),'Visible Sources section still rendered');
assert(factsheetCss.includes('width:108px;min-width:108px;max-width:108px'),'Meeting room column was not narrowed');
assert(redirects.includes('/brand / 200')&&redirects.includes('/hotel-factsheet / 200'),'Cloudflare SPA rewrites missing');
assert(indexText.includes('/footer-route-guard.css?v=13')&&indexText.includes('/footer-route-guard.js?v=13'),'Footer guard cache-bust missing');
assert(indexText.includes('/factsheet-footer-align.js?v=1'),'Factsheet footer enhancer not loaded after shell guard');
assert(indexText.indexOf('/factsheet-footer-align.js?v=1')>indexText.indexOf('/footer-route-guard.js?v=13'),'Factsheet footer enhancer must load after shell footer guard');
assert(indexText.includes('/route-hero-standard.css?v=3'),'Central hero cache-bust missing');

console.log(JSON.stringify({
  ok:true,verifiedOn:DATA.verifiedOn,rooms:DATA.hotel.roomsAndSuites,roomTypes:DATA.rooms.length,
  dining:DATA.dining.length,meetingMax:DATA.hotel.meetingMaxGuests,canonicalSourceNotes:NOTES.length
}));
