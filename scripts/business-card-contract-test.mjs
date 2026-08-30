import {readFile} from 'node:fs/promises';
import {buildVCard,businessCardUrl,businessCardVcfUrl,isBusinessCardSlug,splitContactName} from '../site/business-card-core.js';
import {qrSvg} from '../site/qr-v6.js';

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

const svg=qrSvg(`${ORIGIN}/dechak`,{foreground:'#17131F',background:'#FFFFFF',quiet:4});
if(!svg.includes('viewBox="0 0 49 49"'))throw new Error('QR quiet-zone geometry changed');
if(!svg.includes('<rect width="49" height="49" fill="#FFFFFF"'))throw new Error('QR high-contrast background missing');

const [settingsSource,settingsCss,settingsWrapper,publicSource,publicCss,fnbRefinements,fnbLayout,functionSource,migrationSource]=await Promise.all([
  readFile(new URL('../site/business-card-settings.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-settings.css',import.meta.url),'utf8'),
  readFile(new URL('../site/settings-route-v3.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.js',import.meta.url),'utf8'),
  readFile(new URL('../site/business-card-public.css',import.meta.url),'utf8'),
  readFile(new URL('../site/fnb-refinements.css',import.meta.url),'utf8'),
  readFile(new URL('../site/fnb-layout-stability.css',import.meta.url),'utf8'),
  readFile(new URL('../functions/[slug].js',import.meta.url),'utf8'),
  readFile(new URL('../supabase/migrations/20260829195459_sindhorn_business_card_shortlink_v2.sql',import.meta.url),'utf8')
]);
const joined=[settingsSource,settingsWrapper,publicSource,functionSource,migrationSource].join('\n');
for(const needle of [HOTEL,LOGO,'business_card:','destination_type','.vcf'])if(!joined.includes(needle))throw new Error(`Source contract missing ${needle}`);
for(const forbidden of ['/c/dechak','/c/'])if(joined.includes(forbidden))throw new Error(`Forbidden URL namespace ${forbidden}`);

for(const required of ['settings-dialog','settings-dialog-body','settings-dialog-head','settings-form-grid','settings-field','settings-form-section','fnb-select settings-select'])if(!settingsSource.includes(required))throw new Error(`Edit-card Settings primitive missing ${required}`);
for(const removed of ['business-card-edit-grid','business-card-edit-field','business-card-publish-row','business-card-switch','business-card-visibility','business-card-shared-hotel'])if(settingsSource.includes(removed))throw new Error(`Legacy custom edit-card control remains ${removed}`);
if(!settingsSource.includes('class="settings-quiet-action" type="button" data-bc-present'))throw new Error('Present QR must use Settings quiet action');
if(settingsSource.includes('class="settings-primary" type="button" data-bc-present'))throw new Error('Present QR must not use a unique primary button');
if(!settingsWrapper.includes('promoteSignOutToHero')||!settingsWrapper.includes("button.className='fnb-action-control fnb-share-button settings-hero-signout'")||!settingsWrapper.includes('hero.appendChild(button)')||!settingsWrapper.includes('<span>Sign out</span>'))throw new Error('Sign out must reuse the F&B hero-share markup pattern');

const parityNeedles=['top:20px','right:0','height:36px!important','min-height:36px!important','padding:0 8px!important','gap:8px!important','font-size:12px!important','font-weight:400!important','line-height:1!important','width:15px','height:15px','stroke-width:1.7'];
for(const needle of parityNeedles){if(!settingsCss.includes(needle))throw new Error(`Settings sign-out parity missing ${needle}`);if(!`${fnbRefinements}\n${fnbLayout}`.includes(needle))throw new Error(`F&B reference missing ${needle}`)}
if(!settingsCss.includes('.settings-hero>.settings-eyebrow{padding-right:82px}')||!fnbLayout.includes('.fnb-hero>.fnb-eyebrow{padding-right:82px}'))throw new Error('Hero eyebrow reserve parity missing');
if(!settingsCss.includes('background:transparent!important')||!settingsCss.includes('border:1px solid transparent!important'))throw new Error('Sign out must be transparent like F&B Share');

if(publicSource.includes('QR_HOTEL_LOGO')||publicSource.includes('public-card-qr-logo')||publicCss.includes('.public-card-qr-logo'))throw new Error('Hotel logo must not sit inside QR');
if(publicSource.includes('public-card-action is-primary')||publicCss.includes('.public-card-action.is-primary'))throw new Error('Public card actions must share one button style');
for(const required of ['.public-card-panel{','.public-card-head{text-align:center}','.public-card-detail{','.public-card-detail span{','width:min(80%,312px)','.public-card-logo-wrap','width:min(129.6px,34.8vw)','width:min(120px,33.6vw)'])if(!publicCss.includes(required))throw new Error(`Refined card CSS contract missing ${required}`);
for(const required of ['safeLogoPath','public-card-logo-wrap','hotelNameHtml','websiteLabel','Business card · '])if(!publicSource.includes(required))throw new Error(`Refined public card contract missing ${required}`);
if(!publicCss.includes('text-align:center'))throw new Error('Centered card contract missing');

console.log(JSON.stringify({slug:'dechak',url:`${ORIGIN}/dechak`,vcardUrl:`${ORIGIN}/dechak.vcf`,hotel:HOTEL,logo:LOGO,qr:{version:6,errorCorrection:'M',quietZoneModules:4,viewBox:49,displayScale:.8,centerLogo:false},logoPresentation:{scale:1.2,placement:'below-qr'},ui:{singleCardDocument:true,settingsActions:'settings-quiet-action',signOut:'fnb-hero-share-parity',editDialog:'settings-primitives',publicActions:'uniform',alignment:'center',shortLinks:true,hotelLineBreak:'after-comma'}},null,2));
