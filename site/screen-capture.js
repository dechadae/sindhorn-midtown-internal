function screenshotFilename(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),out={};
  for(const part of parts)out[part.type]=part.value;
  return `sindhorn-midtown-air-quality-screen-${out.year}-${out.month}-${out.day}.png`;
}
function blobFromCanvas(canvas){return new Promise(resolve=>canvas.toBlob(resolve,'image/png',1))}
function restoreButton(button,html){setTimeout(()=>{if(button?.isConnected){button.innerHTML=html;button.disabled=false}},900)}
async function captureVisibleApp(button){
  if(!window.html2canvas||!button)return;
  const original=button.innerHTML,previousY=window.scrollY,previousX=window.scrollX;
  button.disabled=true;button.textContent='Capturing';
  try{
    if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1000))]);
    window.scrollTo({top:0,left:0,behavior:'auto'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const viewport=window.visualViewport,width=Math.max(1,Math.round(viewport?.width||document.documentElement.clientWidth||innerWidth)),height=Math.max(1,Math.round(viewport?.height||innerHeight)),scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    const canvas=await window.html2canvas(document.documentElement,{backgroundColor:'#2E273B',scale,useCORS:true,logging:false,width,height,windowWidth:width,windowHeight:height,x:0,y:0,scrollX:0,scrollY:0});
    const blob=await blobFromCanvas(canvas);if(!blob)throw new Error('PNG failed');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=screenshotFilename();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);button.textContent='Saved';
  }catch(error){console.warn('Screen capture failed',error);button.textContent='Try again'}finally{
    window.scrollTo({top:previousY,left:previousX,behavior:'auto'});restoreButton(button,original);
  }
}
function keepWindowed(){
  const fullscreenButton=document.getElementById('fullscreenToggle');if(fullscreenButton)fullscreenButton.remove();
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
}
document.addEventListener('click',event=>{
  const fullscreen=event.target.closest?.('#fullscreenToggle');if(fullscreen){event.preventDefault();event.stopImmediatePropagation();keepWindowed();return}
  const button=event.target.closest?.('#saveImageBtn');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();captureVisibleApp(button);
},true);
document.addEventListener('fullscreenchange',keepWindowed);
document.addEventListener('sindhorn:route-mounted',keepWindowed);
keepWindowed();
