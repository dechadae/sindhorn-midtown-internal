const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const skyY=altitude=>clamp(.12+clamp((altitude+2)/82,0,1)*.72,.08,.88);
let node=null,timer=0;

function ensureNode(){
  const stage=document.getElementById('environmentStage');
  if(!stage)return null;
  if(node?.isConnected)return node;
  node=document.createElement('div');
  node.id='sunAttenuator';
  node.setAttribute('aria-hidden','true');
  Object.assign(node.style,{
    position:'absolute',
    width:'clamp(76px,18vw,118px)',
    aspectRatio:'1',
    borderRadius:'50%',
    pointerEvents:'none',
    zIndex:'3',
    transform:'translate(-50%,-50%)',
    background:'rgba(80,132,184,.018)',
    backdropFilter:'brightness(.58) saturate(.96)',
    WebkitBackdropFilter:'brightness(.58) saturate(.96)',
    maskImage:'radial-gradient(circle, #000 0 34%, rgba(0,0,0,.92) 44%, rgba(0,0,0,.55) 58%, rgba(0,0,0,.16) 72%, transparent 84%)',
    WebkitMaskImage:'radial-gradient(circle, #000 0 34%, rgba(0,0,0,.92) 44%, rgba(0,0,0,.55) 58%, rgba(0,0,0,.16) 72%, transparent 84%)',
    display:'none'
  });
  stage.appendChild(node);
  return node;
}

function update(){
  const target=ensureNode(),solar=window.SindhornEnvironment?.getState?.().solar;
  if(!target||!solar||!Number.isFinite(solar.altitude)||!Number.isFinite(solar.azimuth)||solar.altitude<=-2){if(target)target.style.display='none';return}
  const az=solar.azimuth*Math.PI/180,x=clamp(.5-Math.sin(az)*.42,.06,.94),y=skyY(solar.altitude);
  target.style.left=`${(x*100).toFixed(3)}%`;
  target.style.top=`${((1-y)*100).toFixed(3)}%`;
  target.style.display='block';
}

function start(){update();clearInterval(timer);timer=setInterval(update,30000)}
document.addEventListener('sindhorn:air-updated',update);
document.addEventListener('sindhorn:environment-config',update);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
window.addEventListener('resize',update,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
