import {readFile} from 'node:fs/promises';
import {buildVCard,businessCardUrl,businessCardVcfUrl,isBusinessCardSlug,splitContactName} from '../site/business-card-core.js';
import {qrStyledSvg,qrSvg} from '../site/qr-v6.js';

const HOTEL='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
const LOGO='/assets/brand/sindhorn-midtown-vignette-white.png';
const ORIGIN='https://sindhorn-midtown-internal.pages.dev';
const card={slug:'dechak',displayName:'Decha Kokaew',positionTitle:'Senior Graphic Designer',workEmail:'decha.kokaew@ihg.com',businessMobile:null,directPhone:null,hotelName:HOTEL,hotelMainPhone:'+66-2-7968888',hotelAddress:'68 Soi Langsuan, Lumpini, Pathumwan, Bangkok 10330, Thailand',hotelWebsite:'https://www.ihg.com/vignettecollection/hotels/us/en/bangkok/bkksn/hoteldetail',hotelLogoPath:LOGO};

if(!isBusinessCardSlug('dechak')||isBusinessCardSlug('decha')||isBusinessCardSlug('decha-k'))throw new Error('Six-character slug contract failed');
if(businessCardUrl(`${ORIGIN}/`,'dechak')!==`${ORIGIN}/dechak`)throw new Error('Root public URL contract failed');
if(businessCardVcfUrl(`${ORIGIN}/`,'dechak')!==`${ORIGIN}/dechak.vcf`)throw new Error('Root VCF URL contract failed');
if(businessCardUrl(ORIGIN,'dechak').includes('/c/'))throw new Error('Legacy /c/ namespace leaked');

const parts=splitContactName(card.displayName);
if(parts.given!=='Decha'||parts.family!=='Kokaew')throw new Error('Contact name split failed');
const vcf=buildVCard(card);
for(const needle of ['BEGIN:VCARD','VERSION:3.0','FN:Decha Kokaew','N:Kokaew;Decha;;;','TITLE:Senior Graphic Designer','ORG:Sindhorn Midtown Hotel Bangkok\\, Vignette Collection by IHG','EMAIL;TYPE=WORK:decha.kokaew@ihg.com','TEL;TYPE=WORK:+66-2-7968888','ADR;TYPE=WORK:;;68 Soi Langsuan\\, Lumpini\\, Pathumwan\\, Bangkok 10330\\, Thailand;;;;','END:VCARD'])if(!vcf.includes(needle))throw new Error(`VCF contract missing ${needle}`);

const legacySvg=qrSvg(`${ORIGIN}/dechak`,{foreground:'#17131F',background:'#FFFFFF',quiet:4});
if(!legacySvg.includes('viewBox="0 0 49 49"'))throw new Error('Legacy QR quiet-zone geometry changed');
if(!legacySvg.includes('<rect width="49" height="49" fill="#FFFFFF"'))throw new Error('Legacy QR high-contrast background missing');
if(!legacySvg.includes('shape-rendering="crispEdges"'))throw new Error('Legacy QR renderer changed');

const styledSvg=qrStyledSvg(`${ORIGIN}/dechak`);
if(!styledSvg.includes('viewBox="0 0 47 47"'))throw new Error('Styled QR must use Flipgazine three-module margin');
if(!styledSvg.includes('shape-rendering="geometricPrecision"'))throw new Error('Styled QR must use Flipgazine geometric precision');
if(!styledSvg.includes('<rect width="47" height="47" rx="2.82" fill="#F4F1EB"'))throw new Error('Styled QR warm rounded paper missing');
if(!styledSvg.includes('fill="#0D1110"'))throw new Error('Styled QR Legacy Dark ink missing');
const circleCount=(styledSvg.match(/<circle /g)||[]).length;
if(circleCount<100||!styledSvg.includes('r="0.46"'))throw new Error(`Styled QR dot modules missing: ${circleCount}`);
if((styledSvg.match(/width="7" height="7" rx="2.1"/g)||[]).length!==3)throw new Error('Styled QR rounded finder frames missing');
if((styledSvg.match(/width="3" height="3" rx="1"/g)||[]).length!==3)throw new Error('Styled QR rounded finder centers missing');
if(styledSvg.includes('<image')||styledSvg.includes('sindhorn-midtown-vignette'))throw new Error('Styled QR must not contain a center logo');

const [settingsSource,settingsCss,settingsWrapper,publicSource,publicCss,fnbRefinements,fnbLayout,functionSource,migrationSource,routeRegistry]=await Promise.all([
  readFile(new URL('../site/business-card-settings.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-settings.css',import.meta.url),'utf8'),
  readFile(new URL('../site/settings-route-v3.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.css',import.meta.url),'utf8'),
  readFile(new URL('../site/fnb-refinements.css',import.meta.url),'utf8'),
  readFile(new URL('../site/fnb-layout-stability.css',import.meta.url),'utf8'),
  readFile(new URL('../functions/[slug].js',import.meta.url),'utf8'),
  readFile(new URL('../supabase/migrations/20260829195459_sindhorn_business_card_shortlink_v2.sql',import.meta.url),'utf8'),
  readFile(new URL('../site/route-registry.js',import.meta.url),'utf8')
]);
const joined=[settingsSource,settingsWrapper,publicSource,functionSource,migrationSource].join('\n');
for(const needle of [HOTEL,LOGO,'business_card:','destination_type','.vcf'])if(!joined.includes(needle))throw new Error(`Source contract missing ${needle}`);
for(const forbidden of ['/c/dechak','/c/'])if(joined.includes(forbidden))throw new Error(`Forbidden URL namespace ${forbidden}`);

for(const required of ['settings-dialog','settings-dialog-body','settings-dialog-head','settings-form-grid','settings-field','settings-form-section','fnb-select settings-select'])if(!settingsSource.includes(required))throw new Error(`Edit-card Settings primitive missing ${required}`);
for(const removed of ['business-card-edit-grid','business-card-edit-field','business-card-publish-row','business-card-switch','business-card-visibility','business-card-shared-hotel'])if(settingsSource.includes(removed))throw new Error(`Legacy custom edit-card control remains ${removed}`);
if(!settingsSource.includes('class="settings-quiet-action" type="button" data-bc-present'))throw new Error('Present QR must use Settings quiet action');
if(settingsSource.includes('class="settings-primary" type="button" data-bc-present'))throw new Error('Present QR must not use a unique primary button');

for(const required of ['preloadSettingsBusinessCard','readSelfCard','preload?await Promise.resolve(preload)','const sectionChanged=event=>{if(event?.detail?.section===\'account\')inject()}'])if(!settingsSource.includes(required))throw new Error(`Business card preload/composition contract missing ${required}`);
if(settingsSource.includes('business-card-settings-actions is-loading'))throw new Error('Business card must not paint a delayed loading placeholder');
for(const required of ['installHeroSignOut','sindhorn:settings-section-changed','buttons.forEach(button=>{if(button!==fresh)button.remove()','hero.appendChild(fresh)','<span>Sign out</span>'])if(!settingsWrapper.includes(required))throw new Error(`Single Sign out contract missing ${required}`);
for(const required of ['preloadSettingsBusinessCard','const cardPreload=preloadSettingsBusinessCard()','root.style.visibility=\'hidden\'','mountSettingsBusinessCard(root,{preload:cardPreload})','root.style.visibility=previousVisibility','Promise.all(['])if(!settingsWrapper.includes(required))throw new Error(`Atomic Settings composition missing ${required}`);

for(const needle of ['top:20px','right:0','height:36px!important','min-height:36px!important','padding:0 8px!important']){if(!settingsCss.includes(needle))throw new Error(`Settings sign-out position parity missing ${needle}`);if(!fnbLayout.includes(needle))throw new Error(`F&B hero Share reference missing ${needle}`)}
for(const needle of ['gap:8px','font-size:12px!important','font-weight:400!important','line-height:1!important','width:15px','height:15px','stroke-width:1.7']){if(!settingsCss.includes(needle))throw new Error(`Settings sign-out visual parity missing ${needle}`);if(!fnbRefinements.includes(needle))throw new Error(`F&B Share visual reference missing ${needle}`)}
if(!settingsCss.includes('.settings-hero>.settings-eyebrow{padding-right:82px}')||!fnbLayout.includes('.fnb-hero>.fnb-eyebrow{padding-right:82px}'))throw new Error('Hero eyebrow reserve parity missing');
if(!settingsCss.includes('background:transparent!important')||!settingsCss.includes('border:1px solid transparent!important'))throw new Error('Sign out must be transparent like F&B Share');

for(const required of ['visualViewport','--settings-viewport-height','--settings-route-top','--settings-scroll-clearance','getBoundingClientRect','MutationObserver','ResizeObserver','scrollPaddingBottom','orientationchange'])if(!settingsWrapper.includes(required))throw new Error(`Settings viewport controller missing ${required}`);
for(const required of ['body[data-route="settings"]{padding-bottom:0!important}','padding-bottom:var(--settings-scroll-clearance,96px)!important','min-height:max(0px,calc(var(--settings-viewport-height,100dvh) - var(--settings-route-top,0px)))!important','max-height:min(760px,calc(var(--settings-viewport-height,100dvh) - 28px))!important'])if(!settingsCss.includes(required))throw new Error(`Settings viewport CSS contract missing ${required}`);
if(!routeRegistry.includes('settings-route-v3.js?v=7'))throw new Error('Settings atomic-composition cache version missing');

if(publicSource.includes('QR_HOTEL_LOGO')||publicSource.includes('public-card-qr-logo')||publicCss.includes('.public-card-qr-logo'))throw new Error('Hotel logo must not sit inside QR');
if(!publicSource.includes('qrStyledSvg')||publicSource.includes("qrSvg(url"))throw new Error('Public card must use styled QR renderer');
if(publicSource.includes('public-card-action is-primary')||publicCss.includes('.public-card-action.is-primary'))throw new Error('Public card actions must share one button style');
for(const required of ['.public-card-panel{','.public-card-head{text-align:center}','.public-card-detail{','.public-card-detail span{','width:min(80%,312px)','.public-card-logo-wrap','width:min(129.6px,34.8vw)','width:min(120px,33.6vw)','background:#F4F1EB','padding:0'])if(!publicCss.includes(required))throw new Error(`Refined card CSS contract missing ${required}`);
for(const required of ['safeLogoPath','public-card-logo-wrap','hotelNameHtml','websiteLabel','Business card · '])if(!publicSource.includes(required))throw new Error(`Refined public card contract missing ${required}`);
if(!publicCss.includes('text-align:center'))throw new Error('Centered card contract missing');

console.log(JSON.stringify({slug:'dechak',url:`${ORIGIN}/dechak`,vcardUrl:`${ORIGIN}/dechak.vcf`,hotel:HOTEL,logo:LOGO,qr:{encoder:{version:6,errorCorrection:'M'},renderer:'flipgazine-dots',quietZoneModules:3,viewBox:47,dotRadius:.46,finderRadius:2.1,paper:'#F4F1EB',ink:'#0D1110',centerLogo:false,circleCount},logoPresentation:{scale:1.2,placement:'below-qr'},settingsViewport:{source:'visualViewport',footerClearance:'measured-shell-footer-stack-plus-28px',nestedScroller:false},settingsComposition:{cardPreload:'parallel',paint:'atomic',signOut:'single-hero-on-every-account-render'},ui:{singleCardDocument:true,settingsActions:'settings-quiet-action',editDialog:'settings-primitives',publicActions:'uniform',alignment:'center',shortLinks:true,hotelLineBreak:'after-comma'}},null,2));
