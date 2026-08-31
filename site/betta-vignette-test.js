import {BETTA_PRESETS} from './betta-fin-presets.js';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';
import {applyVignetteGrade} from './betta-vignette-palettes.js?v=4';

const params=new URLSearchParams(location.search);
const requestedGrade=params.get('grade');
const gradeKey=requestedGrade==='a'||requestedGrade==='b'||requestedGrade==='selected'?requestedGrade:'current';
const grade=gradeKey==='current'?null:applyVignetteGrade(BETTA_PRESETS,gradeKey);
const requestedPeriod=params.get('period');
const periodsHost=document.querySelector('[data-periods]');
const gradesHost=document.querySelector('[data-grades]');
const clockNode=document.querySelector('[data-clock]');
const stateNode=document.querySelector('[data-state]');
const titleNode=document.querySelector('[data-title]');
const descriptionNode=document.querySelector('[data-description]');
const liveButton=document.querySelector('[data-live]');
const previewButton=document.querySelector('[data-preview]');

const currentDescription='Original production radial-membrane engine. Only tail/fin palette, fan shape, fold behavior and composition are retuned from the eight photographic references.';
titleNode.textContent=grade?.name||'Reference Tail Mix';
descriptionNode.textContent=grade?.description||currentDescription;

function labelBaseline(key){const preset=BETTA_PRESETS[key];return preset?`Fish #${preset.referenceId}`:String(key||'')}
function hourLabel(value){return `${String(value).padStart(2,'0')}:00`}
function renderButtons(){periodsHost.innerHTML=BETTA_DAY_PERIODS.map(period=>{const preset=BETTA_PRESETS[period.baseline];return `<button type="button" data-period="${period.key}" data-reference="${period.referenceId}" data-tone="${period.tone}"><span>${period.name}</span><small>${hourLabel(period.startHour)}–${hourLabel(period.endHour)} · Fish #${period.referenceId}</small><em>${preset?.name?.replace(/^Fish #\d+ · /,'')||''}</em></button>`}).join('')}
function updateUrl(next={}){const url=new URL(location.href);for(const [key,value] of Object.entries(next)){if(value==null||value==='')url.searchParams.delete(key);else url.searchParams.set(key,value)}history.replaceState(null,'',url)}
function paint(){
  const env=window.SindhornEnvironment?.getState?.();const day=env?.betta?.dayCycle;
  if(!day){stateNode.textContent='Loading renderer…';return}
  const current=BETTA_DAY_PERIODS.find(period=>period.key===day.targetPeriodKey);
  clockNode.textContent=`Bangkok ${day.bangkokTime||'—'}`;
  stateNode.textContent=`${day.periodName||day.targetPeriodKey||'—'} · Fish #${current?.referenceId||'—'} · old radial engine · ${Math.round((Number(day.transitionMix)||0)*100)}%`;
  document.body.dataset.referenceId=String(current?.referenceId||'');
  document.querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('is-active',button.dataset.period===day.targetPeriodKey));
}

renderButtons();
gradesHost.querySelectorAll('[data-grade]').forEach(button=>button.classList.toggle('is-active',button.dataset.grade===gradeKey));
gradesHost.addEventListener('click',event=>{const button=event.target.closest('[data-grade]');if(!button||button.dataset.grade===gradeKey)return;const url=new URL(location.href);if(button.dataset.grade==='current')url.searchParams.delete('grade');else url.searchParams.set('grade',button.dataset.grade);location.href=url.toString()});
periodsHost.addEventListener('click',event=>{const button=event.target.closest('[data-period]');if(!button)return;window.SindhornEnvironment?.setBettaPeriod?.(button.dataset.period);updateUrl({period:button.dataset.period});paint()});
liveButton.addEventListener('click',()=>{window.SindhornEnvironment?.useLiveBettaDayCycle?.();updateUrl({period:null});paint()});
previewButton.addEventListener('click',()=>{window.SindhornEnvironment?.previewBettaDayCycle?.(180);updateUrl({period:null});paint()});

const {initEnvironment}=await import('./betta-environment.js');
await initEnvironment();
if(requestedPeriod&&BETTA_DAY_PERIODS.some(period=>period.key===requestedPeriod))window.SindhornEnvironment?.setBettaPeriod?.(requestedPeriod);
paint();setInterval(paint,250);
