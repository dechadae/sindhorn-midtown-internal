import {BETTA_PRESETS} from './betta-fin-presets.js';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';

const params=new URLSearchParams(location.search);
const requestedPeriod=params.get('period');
const periodsHost=document.querySelector('[data-periods]');
const clockNode=document.querySelector('[data-clock]');
const stateNode=document.querySelector('[data-state]');
const titleNode=document.querySelector('[data-title]');
const descriptionNode=document.querySelector('[data-description]');
const liveButton=document.querySelector('[data-live]');
const previewButton=document.querySelector('[data-preview]');
const tiltButton=document.querySelector('[data-tilt]');
const cameraButton=document.querySelector('[data-camera]');
const cameraPanel=document.querySelector('[data-camera-panel]');
const cameraGrid=document.querySelector('[data-camera-grid]');
const cameraTitle=document.querySelector('[data-camera-title]');
const cameraStatus=document.querySelector('[data-camera-status]');
const applyButton=document.querySelector('[data-apply]');
const saveButton=document.querySelector('[data-save]');
const resetButton=document.querySelector('[data-reset]');
const copyButton=document.querySelector('[data-copy]');

const SAVED_KEY='sindhorn-betta:camera-editor:saved:v1';
const DRAFT_KEY='sindhorn-betta:camera-editor:draft:v1';
const FIELDS=[
  {key:'offsetX',label:'Position X',min:-2.6,max:2.6,step:.02,digits:2},
  {key:'offsetY',label:'Position Y',min:-2.2,max:2.2,step:.02,digits:2},
  {key:'cameraDepth',label:'Position Z',min:-.5,max:.8,step:.01,digits:2},
  {key:'scale',label:'Scale',min:.55,max:1.4,step:.01,digits:2},
  {key:'rotationX',label:'Rotate X',min:-1.25,max:1.25,step:.01,digits:2},
  {key:'rotationY',label:'Rotate Y',min:-1.25,max:1.25,step:.01,digits:2},
  {key:'rotation',label:'Rotate Z',min:-3.14,max:3.14,step:.01,digits:2}
];

function readStore(storage,key){try{return JSON.parse(storage.getItem(key)||'{}')||{}}catch(_){return {}}}
function writeStore(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
const saved=readStore(localStorage,SAVED_KEY);
const drafts=readStore(sessionStorage,DRAFT_KEY);
const defaults={};
function periodByKey(key){return BETTA_DAY_PERIODS.find(period=>period.key===key)||null}
function pickComposition(params){const out={};for(const field of FIELDS)out[field.key]=Number(params[field.key]);return out}
for(const period of BETTA_DAY_PERIODS)defaults[period.key]=pickComposition(BETTA_PRESETS[period.baseline].params);
for(const period of BETTA_DAY_PERIODS){const override={...(saved[period.key]||{}),...(drafts[period.key]||{})};for(const field of FIELDS){const value=Number(override[field.key]);if(Number.isFinite(value))BETTA_PRESETS[period.baseline].params[field.key]=value}}

let cameraPeriodKey=null;
let cameraOpen=params.get('camera')==='1';

titleNode.textContent='Betta Camera Editor';
descriptionNode.textContent='Tune independent XYZ position, scale and XYZ rotation in real time. Save Location persists each Betta composition on this device.';

function hourLabel(value){return `${String(value).padStart(2,'0')}:00`}
function renderButtons(){periodsHost.innerHTML=BETTA_DAY_PERIODS.map(period=>{const preset=BETTA_PRESETS[period.baseline];return `<button type="button" data-period="${period.key}" data-reference="${period.referenceId}" data-tone="${period.tone}"><span>${period.name}</span><small>${hourLabel(period.startHour)}–${hourLabel(period.endHour)} · Fish #${period.referenceId}</small><em>${preset?.name?.replace(/^Fish #\d+ · /,'')||''}</em></button>`}).join('')}
function updateUrl(next={}){const url=new URL(location.href);url.searchParams.delete('grade');for(const [key,value] of Object.entries(next)){if(value==null||value==='')url.searchParams.delete(key);else url.searchParams.set(key,value)}history.replaceState(null,'',url)}
function activePeriodKey(){const env=window.SindhornEnvironment?.getState?.();return env?.betta?.dayCycle?.targetPeriodKey||requestedPeriod||BETTA_DAY_PERIODS[0].key}
function compositionFor(periodKey){const period=periodByKey(periodKey);if(!period)return null;return pickComposition(BETTA_PRESETS[period.baseline].params)}
function statusFor(periodKey){if(saved[periodKey])return'Saved on this device';if(drafts[periodKey])return'Live draft · unsaved';return'Branch default · live sliders'}
function fieldMarkup(field,value){return `<label class="field"><div class="field-head"><span>${field.label}</span><output data-value="${field.key}">${Number(value).toFixed(field.digits)}</output></div><input type="range" data-camera-field="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"></label>`}
function populateCamera(periodKey=activePeriodKey(),force=false){if(!cameraPanel)return;if(!force&&cameraPeriodKey===periodKey)return;const period=periodByKey(periodKey);if(!period)return;cameraPeriodKey=periodKey;const composition=compositionFor(periodKey);cameraTitle.textContent=`Camera · ${period.name} · Fish #${period.referenceId}`;cameraStatus.textContent=statusFor(periodKey);cameraGrid.innerHTML=FIELDS.map(field=>fieldMarkup(field,composition[field.key])).join('')}
function candidateFromControls(){const out={};for(const field of FIELDS){const input=cameraGrid.querySelector(`[data-camera-field="${field.key}"]`);const value=Number(input?.value);out[field.key]=Number.isFinite(value)?value:defaults[cameraPeriodKey][field.key]}return out}
function applyLiveComposition(value=candidateFromControls()){if(!cameraPeriodKey)return false;const period=periodByKey(cameraPeriodKey);if(!period)return false;for(const field of FIELDS){const n=Number(value[field.key]);if(Number.isFinite(n))BETTA_PRESETS[period.baseline].params[field.key]=n}return Boolean(window.SindhornEnvironment?.previewBettaComposition?.(cameraPeriodKey,value))}
function setCameraOpen(open){cameraOpen=Boolean(open);cameraPanel.classList.toggle('is-open',cameraOpen);document.body.classList.toggle('camera-open',cameraOpen);cameraButton.classList.toggle('is-active',cameraOpen);cameraButton.textContent=cameraOpen?'Camera On':'Camera';updateUrl({camera:cameraOpen?'1':null});if(cameraOpen)populateCamera(activePeriodKey(),true)}

function paint(){
  const env=window.SindhornEnvironment?.getState?.();const day=env?.betta?.dayCycle;const tilt=env?.betta?.tilt;
  if(!day){stateNode.textContent='Loading renderer…';return}
  const current=BETTA_DAY_PERIODS.find(period=>period.key===day.targetPeriodKey);
  clockNode.textContent=`Bangkok ${day.bangkokTime||'—'}`;
  stateNode.textContent=`${day.periodName||day.targetPeriodKey||'—'} · Fish #${current?.referenceId||'—'} · live camera + tilt · ${Math.round((Number(day.transitionMix)||0)*100)}%`;
  if(tiltButton&&tilt?.enabled)tiltButton.textContent='Tilt On';
  document.body.dataset.referenceId=String(current?.referenceId||'');
  document.querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('is-active',button.dataset.period===day.targetPeriodKey));
  if(cameraOpen&&current?.key&&cameraPeriodKey!==current.key)populateCamera(current.key,true);
}

renderButtons();
setCameraOpen(cameraOpen);
periodsHost.addEventListener('click',event=>{const button=event.target.closest('[data-period]');if(!button)return;window.SindhornEnvironment?.setBettaPeriod?.(button.dataset.period);updateUrl({period:button.dataset.period});if(cameraOpen)populateCamera(button.dataset.period,true);paint()});
liveButton.addEventListener('click',()=>{window.SindhornEnvironment?.useLiveBettaDayCycle?.();updateUrl({period:null});paint()});
previewButton.addEventListener('click',()=>{window.SindhornEnvironment?.previewBettaDayCycle?.(180);updateUrl({period:null});paint()});
tiltButton?.addEventListener('click',async()=>{const ok=await window.SindhornEnvironment?.enableBettaTilt?.();tiltButton.textContent=ok?'Tilt On':'Tilt unavailable';paint()});
cameraButton?.addEventListener('click',()=>setCameraOpen(!cameraOpen));
cameraGrid?.addEventListener('input',event=>{const input=event.target.closest('[data-camera-field]');if(!input||!cameraPeriodKey)return;const field=FIELDS.find(item=>item.key===input.dataset.cameraField);const output=cameraGrid.querySelector(`[data-value="${input.dataset.cameraField}"]`);if(output&&field)output.textContent=Number(input.value).toFixed(field.digits);const value=candidateFromControls();drafts[cameraPeriodKey]=value;const ok=applyLiveComposition(value);cameraStatus.textContent=ok?'Live preview · unsaved':'Waiting for active period…'});
cameraGrid?.addEventListener('change',()=>{if(!cameraPeriodKey)return;drafts[cameraPeriodKey]=candidateFromControls();writeStore(sessionStorage,DRAFT_KEY,drafts)});
applyButton?.addEventListener('click',()=>{window.SindhornEnvironment?.recenterBettaTilt?.();cameraStatus.textContent='Tilt recentered · sliders remain live'});
saveButton?.addEventListener('click',()=>{if(!cameraPeriodKey)return;const value=candidateFromControls();drafts[cameraPeriodKey]=value;saved[cameraPeriodKey]=value;writeStore(sessionStorage,DRAFT_KEY,drafts);writeStore(localStorage,SAVED_KEY,saved);applyLiveComposition(value);cameraStatus.textContent='Saved on this device'});
resetButton?.addEventListener('click',()=>{if(!cameraPeriodKey)return;delete drafts[cameraPeriodKey];delete saved[cameraPeriodKey];writeStore(sessionStorage,DRAFT_KEY,drafts);writeStore(localStorage,SAVED_KEY,saved);const period=periodByKey(cameraPeriodKey),value={...defaults[cameraPeriodKey]};for(const field of FIELDS)BETTA_PRESETS[period.baseline].params[field.key]=value[field.key];applyLiveComposition(value);populateCamera(cameraPeriodKey,true);cameraStatus.textContent='Reset to branch default'});
copyButton?.addEventListener('click',async()=>{const all={};for(const period of BETTA_DAY_PERIODS){all[period.key]={referenceId:period.referenceId,...compositionFor(period.key)}}if(cameraPeriodKey)all[cameraPeriodKey]={referenceId:periodByKey(cameraPeriodKey).referenceId,...candidateFromControls()};const text=JSON.stringify(all,null,2);try{await navigator.clipboard.writeText(text);cameraStatus.textContent='Copied all 8 camera locations'}catch(_){cameraStatus.textContent='Clipboard blocked · long-press browser copy';prompt('Copy all 8 camera locations',text)}});

const {initEnvironment}=await import('./betta-environment.js?v=camera-editor-2');
await initEnvironment();
if(requestedPeriod&&BETTA_DAY_PERIODS.some(period=>period.key===requestedPeriod))window.SindhornEnvironment?.setBettaPeriod?.(requestedPeriod);
paint();if(cameraOpen)populateCamera(activePeriodKey(),true);setInterval(paint,250);
