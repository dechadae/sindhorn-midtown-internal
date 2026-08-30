const BACK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const TOP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18V6m0 0-4 4m4-4 4 4"/></svg>';

function reducedMotion(){
  return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function backControl(){
  const link=document.createElement('a');
  link.href='/brand';
  link.dataset.appRoute='brand';
  link.dataset.routeBack='brand';
  link.className='app-back-control';
  link.setAttribute('aria-label','Back to Brand');
  link.innerHTML=BACK_ICON;
  return link;
}

function topControl(){
  const wrapper=document.createElement('div');
  wrapper.className='app-end-actions';
  wrapper.dataset.routeEndActions='true';
  const button=document.createElement('button');
  button.type='button';
  button.className='app-quiet-action';
  button.dataset.routeBackToTop='true';
  button.setAttribute('aria-label','Back to top');
  button.innerHTML=`${TOP_ICON}<span>Back to top</span>`;
  wrapper.appendChild(button);
  return wrapper;
}

function enhanceRoute(route,hero){
  if(!route||!hero)return;
  if(!hero.querySelector('[data-route-back="brand"]'))hero.insertBefore(backControl(),hero.firstChild);
  if(!route.querySelector(':scope > [data-route-end-actions]'))route.appendChild(topControl());
}

function enhance(){
  enhanceRoute(document.querySelector('#route-view .ihg-history-route'),document.querySelector('#route-view .ihg-history-hero'));
  enhanceRoute(document.querySelector('#route-view .factsheet-route'),document.querySelector('#route-view .factsheet-hero'));
}

function onClick(event){
  const button=event.target.closest?.('[data-route-back-to-top]');
  if(!button)return;
  event.preventDefault();
  window.scrollTo({top:0,behavior:reducedMotion()?'auto':'smooth'});
}

document.addEventListener('click',onClick);
document.addEventListener('sindhorn:route-mounted',()=>queueMicrotask(enhance));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
