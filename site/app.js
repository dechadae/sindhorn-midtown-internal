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

/* Installed PWAs do not expose consistent browser-native pull-to-refresh on iOS/Android.
   Own the gesture so the same interaction always refreshes the current live route. */
const ptrStyle=document.createElement('style');
ptrStyle.textContent=`
html,body{overscroll-behavior-y:contain}
.pull-refresh{position:fixed;z-index:150;left:50%;top:calc(env(safe-area-inset-top) + 58px);display:flex;align-items:center;gap:9px;min-height:38px;padding:8px 13px 8px 10px;border:1px solid rgba(250,247,245,.16);border-radius:999px;background:rgba(38,32,49,.66);color:#FAF7F5;box-shadow:0 10px 34px rgba(11,8,18,.18),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px) saturate(1.35);-webkit-backdrop-filter:blur(18px) saturate(1.35);opacity:0;pointer-events:none;transform:translate3d(-50%,-52px,0) scale(.94);transition:opacity .18s ease,transform .26s cubic-bezier(.22,1,.36,1),border-color .2s ease;background .2s ease;will-change:transform,opacity}
.pull-refresh.is-visible{opacity:1}
.pull-refresh.is-ready{border-color:rgba(229,236,190,.62);background:rgba(46,39,59,.78)}
.pull-refresh.is-refreshing{opacity:1;border-color:rgba(229,236,190,.72)}
.pull-refresh-icon{width:21px;height:21px;display:grid;place-items:center;border:1px solid rgba(229,236,190,.38);border-radius:50%;color:#E5ECBE;flex:0 0 21px;transition:transform .22s cubic-bezier(.22,1,.36,1)}
.pull-refresh-icon svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pull-refresh.is-ready .pull-refresh-icon{transform:rotate(180deg)}
.pull-refresh.is-refreshing .pull-refresh-icon{animation:smPtrSpin .72s linear infinite}
.pull-refresh-copy{display:flex;flex-direction:column;line-height:1.08;white-space:nowrap}
.pull-refresh-copy strong{font-family:"Noto Sans",system-ui,sans-serif;font-size:.60rem;font-weight:600;letter-spacing:.13em;text-transform:uppercase}
.pull-refresh-copy small{margin-top:3px;font-family:"Noto Sans Thai","Noto Sans",sans-serif;font-size:.68rem;font-weight:400;color:rgba(250,247,245,.70)}
@keyframes smPtrSpin{to{transform:rotate(360deg)}}
@media(min-width:700px){.pull-refresh{top:calc(env(safe-area-inset-top) + 64px)}}
`;
document.head.appendChild(ptrStyle);
const ptr=document.createElement('div');
ptr.className='pull-refresh';
ptr.setAttribute('role','status');
ptr.setAttribute('aria-live','polite');
ptr.setAttribute('aria-hidden','true');
ptr.innerHTML='<span class="pull-refresh-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v12m-5-5 5 5 5-5"/></svg></span><span class="pull-refresh-copy"><strong>Pull to refresh</strong><small lang="th">ดึงลงเพื่ออัปเดต</small></span>';
document.body.appendChild(ptr);
const ptrCopyEn=ptr.querySelector('strong');
const ptrCopyTh=ptr.querySelector('small');
const PTR_THRESHOLD=72;
const PTR_MAX=112;
let ptrStartY=null,ptrStartX=null,ptrDistance=0,ptrTracking=false,ptrRefreshing=false;
function ptrLabel(en,th){ptrCopyEn.textContent=en;ptrCopyTh.textContent=th;}
function ptrTransform(distance){
  const y=Math.max(-48,Math.min(34,distance-48));
  const scale=.94+Math.min(1,distance/PTR_THRESHOLD)*.06;
  ptr.style.transform=`translate3d(-50%,${y}px,0) scale(${scale.toFixed(3)})`;
}
function resetPullRefresh(immediate=false){
  if(ptrRefreshing)return;
  ptrTracking=false;ptrStartY=null;ptrStartX=null;ptrDistance=0;
  ptr.classList.remove('is-visible','is-ready');
  ptr.setAttribute('aria-hidden','true');
  if(immediate){ptr.style.transition='none';ptrTransform(0);requestAnimationFrame(()=>{ptr.style.transition='';});}
  else ptrTransform(0);
  ptrLabel('Pull to refresh','ดึงลงเพื่ออัปเดต');
}
function performPullRefresh(){
  if(ptrRefreshing)return;
  ptrRefreshing=true;ptrTracking=false;
  ptr.classList.remove('is-ready');ptr.classList.add('is-visible','is-refreshing');
  ptr.setAttribute('aria-hidden','false');
  ptrLabel('Refreshing','กำลังอัปเดต');
  ptr.style.transform='translate3d(-50%,12px,0) scale(1)';
  if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}
  setTimeout(()=>window.location.reload(),220);
}
function touchStart(event){
  if(ptrRefreshing||event.touches.length!==1||window.scrollY>1)return;
  const touch=event.touches[0];
  ptrStartY=touch.clientY;ptrStartX=touch.clientX;ptrDistance=0;ptrTracking=true;
}
function touchMove(event){
  if(!ptrTracking||ptrRefreshing||ptrStartY===null||event.touches.length!==1)return;
  const touch=event.touches[0],dy=touch.clientY-ptrStartY,dx=touch.clientX-ptrStartX;
  if(dy<=0||Math.abs(dx)>Math.abs(dy)*.82){if(dy< -8||Math.abs(dx)>18)resetPullRefresh();return;}
  if(window.scrollY>1){resetPullRefresh();return;}
  if(event.cancelable)event.preventDefault();
  ptrDistance=Math.min(PTR_MAX,dy*.58);
  ptr.classList.add('is-visible');ptr.setAttribute('aria-hidden','false');
  const ready=ptrDistance>=PTR_THRESHOLD;
  ptr.classList.toggle('is-ready',ready);
  ptrLabel(ready?'Release to refresh':'Pull to refresh',ready?'ปล่อยเพื่ออัปเดต':'ดึงลงเพื่ออัปเดต');
  ptrTransform(ptrDistance);
}
function touchEnd(){
  if(!ptrTracking||ptrRefreshing)return;
  if(ptrDistance>=PTR_THRESHOLD)performPullRefresh();else resetPullRefresh();
}
document.addEventListener('touchstart',touchStart,{passive:true});
document.addEventListener('touchmove',touchMove,{passive:false});
document.addEventListener('touchend',touchEnd,{passive:true});
document.addEventListener('touchcancel',()=>resetPullRefresh(),{passive:true});

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
addEventListener('scroll',()=>{updateProgress();if(window.scrollY>1&&ptrTracking)resetPullRefresh();},{passive:true});
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
