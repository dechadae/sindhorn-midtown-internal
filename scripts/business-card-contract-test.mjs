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
if(!legacySvg.includes('viewBox="0 0 49 49"')||!legacySvg.includes('shape-rendering="crispEdges"'))throw new Error('Legacy QR renderer changed');
const styledSvg=qrStyledSvg(`${ORIGIN}/dechak`);
if(!styledSvg.includes('viewBox="0 0 47 47"')||!styledSvg.includes('shape-rendering="geometricPrecision"'))throw new Error('Styled QR geometry changed');
if(!styledSvg.includes('<rect width="47" height="47" rx="2.82" fill="#F4F1EB"')||!styledSvg.includes('r="0.46"'))throw new Error('Styled QR visual contract changed');
if((styledSvg.match(/width="7" height="7" rx="2.1"/g)||[]).length!==3)throw new Error('Styled QR finder frames changed');
if(styledSvg.includes('<image')||styledSvg.includes('sindhorn-midtown-vignette'))throw new Error('Styled QR must not embed a logo');

const [settingsSource,settingsCss,settingsWrapper,settingsBase,dialogController,dialogCss,renderer,componentCss,publicSource,publicCss,publicHtml,functionSource,migrationSource,routeRegistry]=await Promise.all([
  readFile(new URL('../site/business-card-settings.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-settings.css',import.meta.url),'utf8'),
  readFile(new URL('../site/settings-route-v3.js',import.meta.url),'utf8'),
  readFile(new URL('../site/settings.js',import.meta.url),'utf8'),
  readFile(new URL('../site/settings-dialog-standard.js',import.meta.url),'utf8'),
  readFile(new URL('../site/settings-dialog-standard.css',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-renderer.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-component.css',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.css',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card.html',import.meta.url),'utf8'),
  readFile(new URL('../functions/[slug].js',import.meta.url),'utf8'),
  readFile(new URL('../supabase/migrations/20260829195459_sindhorn_business_card_shortlink_v2.sql',import.meta.url),'utf8'),
  readFile(new URL('../site/route-registry.js',import.meta.url),'utf8')
]);
const joined=[settingsSource,settingsWrapper,renderer,publicSource,publicHtml,functionSource,migrationSource].join('\n');
for(const needle of [HOTEL,LOGO,'business_card:','destination_type','.vcf'])if(!joined.includes(needle))throw new Error(`Source contract missing ${needle}`);
for(const forbidden of ['/c/dechak','/c/'])if(joined.includes(forbidden))throw new Error(`Forbidden URL namespace ${forbidden}`);

for(const required of ["in:300","out:180","ease:'cubic-bezier(.22,1,.36,1)'","dialog.showModal()","translateY(18px) scale(.985)","translateY(10px) scale(.992)","standardizeSettingsDialog","upgradeFormSurface","upgradeCardSurface","settings-modal-root","settings-modal-surface","settings-modal-scroll"])if(!dialogController.includes(required))throw new Error(`Central dialog shell/motion contract missing ${required}`);
for(const required of ["from './settings-dialog-standard.js?v=1'","await openSettingsDialog(dialog)","await closeSettingsDialog(dialog,{beforeClose:closeSettingsSelects})"])if(!settingsBase.includes(required))throw new Error(`Edit Employee does not delegate to dialog standard: ${required}`);
for(const required of ["from './settings-dialog-standard.js?v=1'","openSettingsDialog(presentDialog)","closeSettingsDialog(presentDialog)","openSettingsDialog(editDialog)","closeSettingsDialog(editDialog)"])if(!settingsSource.includes(required))throw new Error(`Business card dialog does not use standard controller: ${required}`);
if(settingsSource.includes('.showModal()')||settingsSource.includes('SETTINGS_MOTION='))throw new Error('Business card must not own a duplicate dialog motion implementation');

for(const required of ["presentDialog.className='settings-dialog business-card-present-dialog'","renderBusinessCardMarkup(card","standardCloseButton('data-bc-present-close')","presentDialog.innerHTML=renderBusinessCardMarkup"])if(!settingsSource.includes(required))throw new Error(`Direct Present QR dialog contract missing ${required}`);
for(const forbidden of ['business-card-present-frame','<iframe','contentDocument','presentFrame.src'])if(settingsSource.includes(forbidden))throw new Error(`Present QR must not load another page: ${forbidden}`);

if(!publicSource.includes('renderBusinessCardMarkup(card')||!settingsSource.includes('renderBusinessCardMarkup(card'))throw new Error('Public and Present QR must share the renderer');
for(const required of ['public-card-panel','public-card-scroll','data-card-scroll','public-card-head','public-card-qr','public-card-logo-wrap','public-card-details','public-card-actions','Business card · '])if(!renderer.includes(required))throw new Error(`Shared card renderer missing ${required}`);
if(!publicHtml.includes('/business-card-component.css?v=1&r=3')||!settingsWrapper.includes('/business-card-component.css?v=1&r=3'))throw new Error('Public and Settings must load the same revised card component stylesheet');
for(const required of ['background:rgba(38,32,49,.92)','border-radius:24px','box-shadow:0 28px 90px','text-align:center','width:min(80%,312px)','width:min(129.6px,34.8vw)','overflow:hidden','.public-card-scroll','overflow-y:auto','scrollbar-gutter:stable'])if(!componentCss.includes(required))throw new Error(`Shared card component visual/scroll contract missing ${required}`);
if(!renderer.includes('balancedNameHtml')||!renderer.includes("name.length<=18")||!renderer.includes('<br>'))throw new Error('Balanced two-line employee name renderer missing');
if(!renderer.includes('hotelNameHtml')||!renderer.includes('websiteLabel')||!renderer.includes('hotelAddressHtml'))throw new Error('Shared hotel formatting helpers missing');

for(const forbidden of ['canvas','three.js','THREE','atmosphere','environment.js','WebGL'])if(publicHtml.includes(forbidden)||publicSource.includes(forbidden))throw new Error(`Public card acquired a WebGL dependency: ${forbidden}`);
if(!publicCss.includes('linear-gradient(180deg')||publicCss.includes('canvas'))throw new Error('Public card shell must stay static and WebGL-free');
if(!publicCss.includes('height:100dvh')||!publicCss.includes('.public-business-card>.public-card-panel{height:100%;max-height:760px}'))throw new Error('Public fixed card shell contract missing');

for(const required of ['.settings-dialog.settings-modal-root','.settings-modal-surface','.settings-modal-scroll','background:transparent!important','overflow:visible!important','width:min(calc(100vw - 32px),634px)!important','overflow-y:auto!important','padding:0!important'])if(!dialogCss.includes(required))throw new Error(`Central Settings modal shell contract missing ${required}`);
for(const forbidden of ['.settings-dialog>.settings-dialog-body','.settings-dialog>.public-card-panel','.settings-dialog.business-card-present-dialog{'])if(dialogCss.includes(forbidden))throw new Error(`Popup-specific geometry leaked back into central modal CSS: ${forbidden}`);
if(!dialogCss.includes('-webkit-tap-highlight-color:transparent')||!componentCss.includes('-webkit-tap-highlight-color:transparent'))throw new Error('Close/action tap highlight suppression missing');
if(componentCss.includes('.public-card-present-close'))throw new Error('Business card must not own a custom close-button component');
if(!renderer.includes('closeMarkup'))throw new Error('Contextual close control slot missing from shared card renderer');

for(const required of ['preloadSettingsBusinessCard','readSelfCard','preload?await Promise.resolve(preload)','queueMicrotask(()=>{if(!disposed)ensureInjected()})'])if(!settingsSource.includes(required))throw new Error(`Atomic Account composition contract missing ${required}`);
if(settingsSource.includes('new MutationObserver(()=>inject())'))throw new Error('Business card must not observe and mutate Settings panel recursively');
for(const required of ['installHeroSignOut','hero.appendChild(fresh)','visualViewport','--settings-scroll-clearance'])if(!settingsWrapper.includes(required))throw new Error(`Settings wrapper regression: ${required}`);
if(!settingsWrapper.includes("settings.js?v=3")||!settingsWrapper.includes("business-card-settings.js?v=10"))throw new Error('Settings module cache versions missing');
if(!settingsWrapper.includes('/settings-dialog-standard.css?v=1&r=5')||!settingsWrapper.includes('/business-card-component.css?v=1&r=3'))throw new Error('Central Settings dialog/card revised styles not loaded');
if(!routeRegistry.includes('settings-route-v3.js?v=10&r=6&d=3'))throw new Error('Settings route cache version missing');

console.log(JSON.stringify({slug:'dechak',url:`${ORIGIN}/dechak`,vcardUrl:`${ORIGIN}/dechak.vcf`,hotel:HOTEL,dialogStandard:{controller:'settings-dialog-standard.js',structure:'settings-modal-root > settings-modal-surface > settings-modal-scroll',open:300,close:180,scrollbar:'inner-surface'},cardStandard:{renderer:'business-card-renderer.js',component:'business-card-component.css',publicWebGL:false,presentIframe:false,fixedShell:true},ui:{editEmployee:'central-modal-shell',editCard:'central-modal-shell',presentQr:'central-modal-shell',publicCard:'same-card-static-shell'}},null,2));