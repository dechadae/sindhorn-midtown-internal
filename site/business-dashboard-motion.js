const MOTION_QUERY='(prefers-reduced-motion: reduce)';

function stageProgressTracks(root,reduced){
  const tracks=[...root.querySelectorAll('.bd-variance-actual')];
  tracks.forEach((track,index)=>track.style.setProperty('--bd-progress-delay',`${Math.min(index,7)*45}ms`));
  delete root.dataset.bdProgressReady;
  if(reduced){root.dataset.bdProgressReady='true';return}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{root.dataset.bdProgressReady='true'}));
}

export function applyBusinessDashboardMotion(root,data,{reason='load'}={}){
  if(!root)return;
  const reduced=window.matchMedia?.(MOTION_QUERY)?.matches===true;
  root.dataset.bdMotionReady='true';
  stageProgressTracks(root,reduced);
  root.dispatchEvent(new CustomEvent('sindhorn:business-dashboard-motion-complete',{detail:{reason,reduced,mode:'progress-only'}}));
}
