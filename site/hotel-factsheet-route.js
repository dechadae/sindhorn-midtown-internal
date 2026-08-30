let latestRequest=0;
let mountChain=Promise.resolve();
let activeCleanup=null;

async function mountLatest(host,context,request){
  if(request!==latestRequest||host.dataset.shellRoute&&host.dataset.shellRoute!=='hotelFactsheet')return()=>{};
  if(typeof activeCleanup==='function'){
    try{activeCleanup()}catch(_){}
    activeCleanup=null;
  }
  const module=await import('./hotel-factsheet.js?v=3');
  if(request!==latestRequest||host.dataset.shellRoute&&host.dataset.shellRoute!=='hotelFactsheet')return()=>{};
  const cleanup=await module.mountHotelFactsheetRoute(host,context);
  if(request!==latestRequest||host.dataset.shellRoute&&host.dataset.shellRoute!=='hotelFactsheet'){
    try{cleanup?.()}catch(_){}
    return()=>{};
  }
  activeCleanup=typeof cleanup==='function'?cleanup:null;
  const ownedCleanup=activeCleanup;
  return()=>{
    if(activeCleanup!==ownedCleanup)return;
    activeCleanup=null;
    try{ownedCleanup?.()}catch(_){}
  };
}

export function mountHotelFactsheetRoute(host,context){
  const request=++latestRequest;
  const task=mountChain.then(()=>mountLatest(host,context,request));
  mountChain=task.then(()=>undefined,()=>undefined);
  return task;
}
