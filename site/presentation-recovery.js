const stage=document.getElementById('environmentStage');
const canvas=document.getElementById('environmentCanvas');
let recovering=false;

function nextFrame(){return new Promise(resolve=>requestAnimationFrame(resolve))}

export async function recoverPresentationSwap(){
  if(recovering||!stage||!canvas)return;
  recovering=true;
  try{
    const oldStageTransform=stage.style.transform;
    const oldCanvasTransform=canvas.style.transform;
    stage.style.transform='translateZ(0) scale(1.000001)';
    canvas.style.transform='translateZ(0) scale(1.000001)';
    await nextFrame();
    stage.style.transform=oldStageTransform||'';
    canvas.style.transform=oldCanvasTransform||'';
    await nextFrame();
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new CustomEvent('sindhorn:environment-rebind'));
  }finally{
    recovering=false;
  }
}
