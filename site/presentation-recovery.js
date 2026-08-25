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
    const oldWidth=stage.style.width;
    stage.style.transform='translateZ(0) scale(1.000001)';
    canvas.style.transform='translateZ(0) scale(1.000001)';
    stage.style.width='calc(100vw - .25px)';
    await nextFrame();
    stage.style.width=oldWidth||'';
    stage.style.transform=oldStageTransform||'';
    canvas.style.transform=oldCanvasTransform||'';
    await nextFrame();
    await nextFrame();
    document.dispatchEvent(new CustomEvent('sindhorn:environment-rebind'));
  }finally{
    recovering=false;
  }
}
