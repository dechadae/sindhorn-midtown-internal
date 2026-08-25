const ROUTES=Object.freeze({today:'/',guidance:'/guidance',details:'/details'});
const ROUTE_META=Object.freeze({
  today:{title:'Live Air Quality | Sindhorn Midtown Hotel Bangkok'},
  guidance:{title:'Air Quality Guidance | Sindhorn Midtown Hotel Bangkok',kicker:'Air quality care',heading:'Guidance',thai:'คำแนะนำ',copy:'Practical guidance and the Thailand air-quality scale for the current conditions.',copyTh:'คำแนะนำสำหรับสภาพอากาศปัจจุบันและเกณฑ์คุณภาพอากาศของประเทศไทย'},
  details:{title:'Reading Details | Sindhorn Midtown Hotel Bangkok',kicker:'Current observation',heading:'Reading details',thai:'รายละเอียดข้อมูล',copy:'Monitoring point, source, refresh and sharing controls for the current observation.',copyTh:'รายละเอียดจุดตรวจวัด แหล่งข้อมูล และเครื่องมือสำหรับข้อมูลล่าสุด'}
});
const main=document.querySelector('main');
const fullscreenButton=document.getElementById('fullscreenToggle');
const intro=main?.querySelector('.intro');
const report=main?.querySelector('#report');
const saveBar=main?.querySelector('.report-actionbar');
const weather=main?.querySelector('.weather-now');
const sections=main?[...main.querySelectorAll(':scope > .section')]:[];
const progressFill=document.querySelector('.fg-progress-rule i');

const routeForSection=section=>{
  const heading=(section.querySelector('.section-title')?.textContent||'').toLowerCase();
  if(heading.includes('guidance')||heading.includes('คำแนะนำ')||heading.includes('scale')||heading.includes('ระดับ'))return'guidance';
  return'details';
};
const routeHero=document.createElement('section');
routeHero.className='route-hero';
routeHero.hidden=true;
routeHero.innerHTML='<p class="route-kicker"></p><h1></h1><p class="route-copy"></p>';
if(main)main.insertBefore(routeHero,sections[0]||null);

const groups={
  today:[intro,report,weather,saveBar].filter(Boolean),
  guidance:[routeHero,...sections.filter(section=>routeForSection(section)==='guidance')],
  details:[routeHero,...sections.filter(section=>routeForSection(section)==='details')]
};
const nav=document.createElement('nav');
nav.className='app-tabbar bottom-nav';
nav.setAttribute('aria-label','App navigation / เมนูแอป');
nav.innerHTML=`
<a class="nav-chip" href="/" data-app-route="today"><span>Today <small lang="th">วันนี้</small></span></a>
<a class="nav-chip" href="/guidance" data-app-route="guidance"><span>Guidance <small lang="th">คำแนะนำ</small></span></a>
<a class="nav-chip" href="/details" data-app-route="details"><span>Details <small lang="th">ข้อมูล</small></span></a>`;
document.body.appendChild(nav);

const pathToRoute=path=>path.startsWith('/guidance')?'guidance':path.startsWith('/details')?'details':'today';
const allRouteNodes=[...new Set(Object.values(groups).flat())];
const routeOrder={today:0,guidance:1,details:2};
let currentRoute=pathToRoute(location.pathname);
let transitionToken=0;

function renderRouteHero(route){
  const meta=ROUTE_META[route];
  if(!meta||route==='today'){
    routeHero.hidden=true;
    return;
  }
  routeHero.hidden=false;
  routeHero.querySelector('.route-kicker').textContent=meta.kicker;
  routeHero.querySelector('h1').innerHTML=`${meta.heading}<span lang="th">${meta.thai}</span>`;
  routeHero.querySelector('.route-copy').innerHTML=`${meta.copy}<span lang="th" style="display:block;margin-top:5px">${meta.copyTh}</span>`;
}
function updateProgress(){
  if(!progressFill)return;
  const root=document.documentElement;
  const max=Math.max(1,root.scrollHeight-innerHeight);
  const value=Math.max(0,Math.min(1,scrollY/max));
  progressFill.style.width=`${(value*100).toFixed(2)}%`;
}
function commitRoute(route,{replace=false,scroll=true}={}){
  document.body.dataset.route=route;
  allRouteNodes.forEach(node=>node.toggleAttribute('data-app-route-hidden',!groups[route].includes(node)));
  renderRouteHero(route);
  nav.querySelectorAll('[data-app-route]').forEach(link=>{
    const active=link.dataset.appRoute===route;
    link.toggleAttribute('aria-current',active);
    link.classList.toggle('is-active',active);
    link.classList.toggle('on',active);
  });
  document.title=ROUTE_META[route].title;
  const target=ROUTES[route];
  if(location.pathname!==target)history[replace?'replaceState':'pushState']({route},'',target);
  if(scroll)window.scrollTo({top:0,behavior:'auto'});
  currentRoute=route;
  requestAnimationFrame(updateProgress);
}
async function applyRoute(route,{replace=false,scroll=true}={}){
  if(!ROUTES[route])route='today';
  if(route===currentRoute&&!replace){
    if(scroll)window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  const token=++transitionToken;
  const direction=Math.sign(routeOrder[route]-routeOrder[currentRoute])||1;
  if(!replace&&main?.animate){
    const out=main.animate([
      {opacity:1,filter:'blur(0px)',transform:'translate3d(0,0,0)'},
      {opacity:.18,filter:'blur(2px)',transform:`translate3d(${-10*direction}px,0,0)`}
    ],{duration:150,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    try{await out.finished}catch(_){}
    if(token!==transitionToken)return;
  }
  commitRoute(route,{replace,scroll});
  if(!replace&&main?.animate){
    main.animate([
      {opacity:.16,filter:'blur(2px)',transform:`translate3d(${14*direction}px,0,0)`},
      {opacity:1,filter:'blur(0px)',transform:'translate3d(0,0,0)'}
    ],{duration:460,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
  }
}

nav.addEventListener('click',event=>{
  const link=event.target.closest('[data-app-route]');
  if(!link)return;
  event.preventDefault();
  applyRoute(link.dataset.appRoute);
});
addEventListener('popstate',()=>applyRoute(pathToRoute(location.pathname),{replace:true,scroll:false}));
addEventListener('scroll',updateProgress,{passive:true});
addEventListener('resize',updateProgress,{passive:true});
commitRoute(currentRoute,{replace:true,scroll:false});
document.body.classList.add('app-spa-ready');
updateProgress();

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
