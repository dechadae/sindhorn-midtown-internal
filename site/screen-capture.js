let captureBusy=false;

function keepWindowed(){
  const fullscreenButton=document.getElementById('fullscreenToggle');
  if(fullscreenButton)fullscreenButton.remove();
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
}

function captureFilename(){
  const timezone=window.SindhornLocation?.getState?.()?.timezone||'Asia/Bangkok';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),obj={};
  parts.forEach(part=>obj[part.type]=part.value);
  return `sindhorn-midtown-air-quality-full-${obj.year}-${obj.month}-${obj.day}.png`;
}
function blobFromCanvas(canvas){return new Promise(resolve=>canvas.toBlob(resolve,'image/png',1))}
function preloadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function captureSize(){
  const width=Math.max(1,Math.ceil(document.documentElement.clientWidth));
  const header=document.getElementById('app-header'),route=document.getElementById('route-view'),action=document.querySelector('.report-actionbar');
  const headerHeight=Math.ceil(header?.getBoundingClientRect().height||0),routeHeight=Math.ceil(route?.scrollHeight||route?.getBoundingClientRect().height||0);
  let actionReserve=0;
  if(action){const style=getComputedStyle(action);actionReserve=Math.ceil((action.getBoundingClientRect().height||0)+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0))}
  return{width,height:Math.max(1,headerHeight+Math.max(1,routeHeight-actionReserve))};
}
function prepareClone(clone,atmosphereData,height){
  const body=clone.body,header=clone.getElementById('app-header'),route=clone.getElementById('route-view');
  body.classList.remove('capture-home');body.style.margin='0';body.style.paddingBottom='0';body.style.position='relative';body.style.minHeight=`${height}px`;body.style.background='#2E273B';
  clone.documentElement.style.scrollBehavior='auto';
  clone.getElementById('app-footer')?.remove();clone.querySelector('.app-footer-reference')?.remove();clone.querySelector('.report-actionbar')?.remove();clone.querySelector('.pull-refresh')?.remove();clone.querySelector('.environment-stage')?.remove();clone.getElementById('rainPaneSvg')?.remove();clone.getElementById('sunAttenuator')?.remove();clone.querySelector('.environment-debug')?.remove();
  if(header){header.style.position='relative';header.style.top='auto';header.style.zIndex='2'}
  if(route){route.style.position='relative';route.style.zIndex='2'}
  if(atmosphereData){const atmosphere=clone.createElement('img');atmosphere.alt='';atmosphere.setAttribute('aria-hidden','true');atmosphere.src=atmosphereData;Object.assign(atmosphere.style,{position:'absolute',inset:'0',width:'100%',height:`${height}px`,objectFit:'fill',zIndex:'0',pointerEvents:'none'});body.prepend(atmosphere)}
  clone.querySelectorAll('*').forEach(node=>{node.style.animation='none';node.style.transition='none'});
}
async function renderNormalFullPage(atmosphereData,width,height,foreignObjectRendering){
  return window.html2canvas(document.body,{backgroundColor:'#2E273B',scale:2,useCORS:true,logging:false,width,height,windowWidth:width,windowHeight:height,scrollX:0,scrollY:0,foreignObjectRendering,onclone:clone=>prepareClone(clone,atmosphereData,height)});
}
async function saveNormalFullPage(button){
  if(captureBusy||!button)return;const state=window.SindhornLiveData?.getState?.(),pm=state?.air?.pm,aqi=state?.air?.aqi;
  if(!Number.isFinite(Number(pm))||!Number.isFinite(Number(aqi))){const original=button.innerHTML;button.textContent='Waiting for data';setTimeout(()=>{if(button.isConnected)button.innerHTML=original},1600);return}
  if(!window.html2canvas)return;
  captureBusy=true;const original=button.innerHTML;button.disabled=true;button.textContent='Preparing full page';
  try{
    if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1400))]);
    const {width,height}=captureSize();let atmosphereData=null;
    if(window.SindhornEnvironment?.renderExport){atmosphereData=await window.SindhornEnvironment.renderExport(width*2,height*2);await preloadImage(atmosphereData)}
    let canvas;
    try{canvas=await renderNormalFullPage(atmosphereData,width,height,true)}catch(error){console.warn('Foreign-object capture fallback',error);canvas=await renderNormalFullPage(atmosphereData,width,height,false)}
    const blob=await blobFromCanvas(canvas);if(!blob)throw new Error('PNG failed');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=captureFilename();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);button.textContent='Saved';
  }catch(error){console.warn('Full-page capture failed',error);button.textContent='Try again'}finally{captureBusy=false;setTimeout(()=>{if(button.isConnected){button.innerHTML=original;button.disabled=false}},1600)}
}

document.addEventListener('click',event=>{
  const save=event.target.closest?.('#saveImageBtn');
  if(save){event.preventDefault();event.stopImmediatePropagation();saveNormalFullPage(save);return}
  const fullscreen=event.target.closest?.('#fullscreenToggle');
  if(!fullscreen)return;
  event.preventDefault();event.stopImmediatePropagation();keepWindowed();
},true);
document.addEventListener('fullscreenchange',keepWindowed);
document.addEventListener('sindhorn:route-mounted',keepWindowed);
keepWindowed();
