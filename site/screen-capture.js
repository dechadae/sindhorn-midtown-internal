function keepWindowed(){
  const fullscreenButton=document.getElementById('fullscreenToggle');
  if(fullscreenButton)fullscreenButton.remove();
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
}

document.addEventListener('click',event=>{
  const fullscreen=event.target.closest?.('#fullscreenToggle');
  if(!fullscreen)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  keepWindowed();
},true);
document.addEventListener('fullscreenchange',keepWindowed);
document.addEventListener('sindhorn:route-mounted',keepWindowed);
keepWindowed();
