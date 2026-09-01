import {BETTA_DAY_PERIODS,nextPeriod} from './betta-day-periods.js';

const params=new URLSearchParams(location.search);
if(params.get('betta-test')==='1'){
  const style=document.createElement('style');
  style.textContent=`
    .betta-transition-test{
      position:fixed;
      z-index:80;
      right:12px;
      top:112px;
      min-width:64px;
      height:34px;
      padding:0 12px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      border:1px solid rgba(250,247,245,.18);
      border-radius:999px;
      background:rgba(20,16,28,.62);
      color:#FAF7F5;
      font:400 13px/1 'LINE Seed Sans TH',system-ui,sans-serif;
      letter-spacing:0;
      box-shadow:0 8px 24px rgba(0,0,0,.16);
      backdrop-filter:blur(16px) saturate(1.12);
      -webkit-backdrop-filter:blur(16px) saturate(1.12);
      -webkit-tap-highlight-color:transparent;
      touch-action:manipulation;
      transition:transform .18s ease,background .18s ease,border-color .18s ease,opacity .18s ease;
    }
    .betta-transition-test:active{transform:scale(.96);background:rgba(38,30,48,.78)}
    .betta-transition-test[disabled]{opacity:.46}
    .betta-transition-test__mark{font-size:16px;line-height:1;transform:translateY(-.5px)}
    .betta-transition-test__route{font-variant-numeric:tabular-nums;white-space:nowrap}
    @media(prefers-reduced-motion:reduce){.betta-transition-test{transition:none}}
  `;
  document.head.append(style);

  const button=document.createElement('button');
  button.type='button';
  button.className='betta-transition-test';
  button.dataset.bettaTransitionTest='true';
  button.innerHTML='<span class="betta-transition-test__mark" aria-hidden="true">β</span><span class="betta-transition-test__route">…</span>';
  button.setAttribute('aria-label','Advance to the next Betta atmosphere');
  document.body.append(button);

  const routeNode=button.querySelector('.betta-transition-test__route');
  const findPeriod=key=>BETTA_DAY_PERIODS.find(period=>period.key===key)||BETTA_DAY_PERIODS[0];
  const environment=()=>window.SindhornEnvironment;
  const currentPeriod=()=>{
    const state=environment()?.getState?.();
    return findPeriod(state?.betta?.dayCycle?.targetPeriodKey||document.body.dataset.bettaPeriod);
  };

  function placeControl(){
    const header=document.getElementById('app-header');
    const bottom=header?.getBoundingClientRect?.().bottom;
    button.style.top=`${Math.max(12,Math.round((Number.isFinite(bottom)?bottom:96)+10))}px`;
  }

  function paint(){
    const env=environment();
    const current=currentPeriod();
    const next=nextPeriod(current);
    button.disabled=!env?.setBettaPeriod;
    routeNode.textContent=`${current.referenceId}→${next.referenceId}`;
    button.title=`Next: ${next.name} · Fish #${next.referenceId}`;
    button.setAttribute('aria-label',`Transition from ${current.name}, Fish #${current.referenceId}, to ${next.name}, Fish #${next.referenceId}`);
  }

  button.addEventListener('click',()=>{
    const env=environment();
    if(!env?.setBettaPeriod)return;
    const next=nextPeriod(currentPeriod());
    env.setBettaPeriod(next.key);
    paint();
    setTimeout(paint,950);
  });

  addEventListener('resize',placeControl,{passive:true});
  document.addEventListener('sindhorn:route-mounted',()=>{placeControl();paint()});
  document.addEventListener('sindhorn:betta-first-frame',()=>{placeControl();paint()},{once:true});
  placeControl();
  paint();
  setInterval(paint,500);
}
