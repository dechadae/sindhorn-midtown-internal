const ROUTES=Object.freeze({today:'/',guidance:'/guidance',details:'/details'});
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const main=document.querySelector('main');
const fullscreenButton=document.getElementById('fullscreenToggle');
const intro=main?.querySelector('.intro');
const report=main?.querySelector('#report');
const saveBar=main?.querySelector('.report-actionbar');
const weather=main?.querySelector('.weather-now');
const sections=main?[...main.querySelectorAll(':scope > .section')]:[];

const routeForSection=section=>{
  const heading=(section.querySelector('.section-title')?.textContent||'').toLowerCase();
  if(heading.includes('guidance')||heading.includes('คำแนะนำ')||heading.includes('scale')||heading.includes('ระดับ'))return'guidance';
  return'details';
};

const groups={
  today:[intro,report,saveBar,weather].filter(Boolean),
  guidance:sections.filter(section=>routeForSection(section)==='guidance'),
  details:sections.filter(section=>routeForSection(section)==='details')
};

const nav=document.createElement('nav');
nav.className='app-tabbar';
nav.setAttribute('aria-label','App navigation / เมนูแอป');
nav.innerHTML=`
<a href="/" data-app-route="today"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5v8H5v-8Z"/><path d="M9.5 19.5v-5h5v5"/></svg><span>Today<small lang="th">วันนี้</small></span></a>
<a href="/guidance" data-app-route="guidance"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.7 2.2"/></svg><span>Guidance<small lang="th">คำแนะนำ</small></span></a>
<a href="/details" data-app-route="details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h12M6 12h12M6 19h12"/><circle cx="3.5" cy="5" r=".8" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="3.5" cy="19" r=".8" fill="currentColor" stroke="none"/></svg><span>Details<small lang="th">ข้อมูล</small></span></a>`;
document.body.appendChild(nav);

const pathToRoute=path=>path.startsWith('/guidance')?'guidance':path.startsWith('/details')?'details':'today';
const allRouteNodes=[...new Set(Object.values(groups).flat())];

function applyRoute(route,{replace=false,scroll=true}={}){
  if(!ROUTES[route])route='today';
  document.body.dataset.route=route;
  allRouteNodes.forEach(node=>node.toggleAttribute('data-app-route-hidden',!groups[route].includes(node)));
  nav.querySelectorAll('[data-app-route]').forEach(link=>{
    const active=link.dataset.appRoute===route;
    link.toggleAttribute('aria-current',active);
    link.classList.toggle('is-active',active);
  });
  if(!reducedMotion.matches&&main?.animate){
    main.animate([{opacity:.78,transform:'translate3d(0,6px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:240,easing:'cubic-bezier(.2,.75,.2,1)'});
  }
  const target=ROUTES[route];
  if(location.pathname!==target)history[replace?'replaceState':'pushState']({route},'',target);
  if(scroll)window.scrollTo({top:0,behavior:reducedMotion.matches?'auto':'smooth'});
}

nav.addEventListener('click',event=>{
  const link=event.target.closest('[data-app-route]');
  if(!link)return;
  event.preventDefault();
  applyRoute(link.dataset.appRoute);
});
addEventListener('popstate',()=>applyRoute(pathToRoute(location.pathname),{replace:true,scroll:false}));
applyRoute(pathToRoute(location.pathname),{replace:true,scroll:false});
document.body.classList.add('app-spa-ready');

function updateFullscreenState(){
  const active=!!document.fullscreenElement;
  document.body.classList.toggle('is-fullscreen',active);
  fullscreenButton?.classList.toggle('is-active',active);
  fullscreenButton?.setAttribute('aria-pressed',active?'true':'false');
  fullscreenButton?.setAttribute('aria-label',active?'Exit full screen / ออกจากเต็มหน้าจอ':'Enter full screen / เต็มหน้าจอ');
}

if(fullscreenButton){
  if(!document.documentElement.requestFullscreen&&!document.exitFullscreen)fullscreenButton.hidden=true;
  fullscreenButton.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({navigationUI:'hide'});
    }catch(_){}
  });
  document.addEventListener('fullscreenchange',updateFullscreenState);
  updateFullscreenState();
}

if('serviceWorker'in navigator){
  addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true});
}
