import {initEnvironment} from './betta-environment.js';
import {BETTA_DAY_PERIODS} from './betta-day-periods.js';

const periodsHost=document.querySelector('[data-periods]');
const clockNode=document.querySelector('[data-clock]');
const stateNode=document.querySelector('[data-state]');
const liveButton=document.querySelector('[data-live]');
const previewButton=document.querySelector('[data-preview]');

function labelBaseline(key){return String(key||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase())}
function renderButtons(){periodsHost.innerHTML=BETTA_DAY_PERIODS.map(period=>`<button type="button" data-period="${period.key}">${period.name}</button>`).join('')}
function paint(){
  const env=window.SindhornEnvironment?.getState?.();
  const day=env?.betta?.dayCycle;
  if(!day){stateNode.textContent='Loading renderer…';return}
  clockNode.textContent=`Bangkok ${day.bangkokTime||'—'}`;
  stateNode.textContent=`${day.periodName||day.targetPeriodKey||'—'} · ${labelBaseline(day.targetBaseline)} · ${Math.round((Number(day.transitionMix)||0)*100)}%`;
  document.querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('is-active',button.dataset.period===day.targetPeriodKey));
}

renderButtons();
periodsHost.addEventListener('click',event=>{
  const button=event.target.closest('[data-period]');
  if(!button)return;
  window.SindhornEnvironment?.setBettaPeriod?.(button.dataset.period);
  paint();
});
liveButton.addEventListener('click',()=>{window.SindhornEnvironment?.useLiveBettaDayCycle?.();paint()});
previewButton.addEventListener('click',()=>{window.SindhornEnvironment?.previewBettaDayCycle?.(180);paint()});

await initEnvironment();
paint();
setInterval(paint,250);
