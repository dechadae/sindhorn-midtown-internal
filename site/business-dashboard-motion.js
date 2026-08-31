const SNAPSHOT_KEY='sindhorn-business-dashboard-motion-v1';
const MOTION_QUERY='(prefers-reduced-motion: reduce)';

function safeNumber(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function compactMoney(value,{signed=false}={}){
  const n=safeNumber(value);
  if(n===null)return'—';
  const abs=Math.abs(n),sign=n<0?'−':signed&&n>0?'+':'';
  let body;
  if(abs>=1_000_000)body=`${(abs/1_000_000).toFixed(abs>=10_000_000?1:2).replace(/\.0+$/,'')}M`;
  else if(abs>=100_000)body=`${Math.round(abs/1000)}K`;
  else body=Math.round(abs).toLocaleString('en-US');
  return`${sign}฿${body}`;
}

function money(value){
  const n=safeNumber(value);
  if(n===null)return'—';
  return`${n<0?'−':''}฿${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

function integer(value,{signed=false,suffix=''}={}){
  const n=safeNumber(value);
  if(n===null)return'—';
  const sign=n<0?'−':signed&&n>0?'+':'';
  return`${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}${suffix}`;
}

function percent(value){
  const n=safeNumber(value);
  if(n===null)return'—';
  return`${(n*100).toFixed(1)}%`;
}

function formatter(name){
  switch(name){
    case'money':return money;
    case'money-compact':return value=>compactMoney(value);
    case'money-compact-signed':return value=>compactMoney(value,{signed:true});
    case'percent':return percent;
    case'integer-rn-signed':return value=>integer(value,{signed:true,suffix:' RN'});
    default:return value=>String(value??'');
  }
}

function readSnapshot(){
  try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null')}catch(_){return null}
}

function writeSnapshot(snapshot){
  try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(snapshot))}catch(_){}
}

function collectMetrics(root){
  const metrics={};
  root.querySelectorAll('[data-bd-motion-key][data-bd-motion-value]').forEach(node=>{
    const value=safeNumber(node.dataset.bdMotionValue);
    if(value!==null)metrics[node.dataset.bdMotionKey]={value,format:node.dataset.bdMotionFormat||''};
  });
  return metrics;
}

function animateValue(node,from,to,formatName,{pickup=false}={}){
  if(from===to)return;
  const format=formatter(formatName),duration=pickup?660:540,start=performance.now();
  const ease=t=>1-Math.pow(1-t,3);
  const frame=now=>{
    const t=Math.min(1,(now-start)/duration),value=from+(to-from)*ease(t);
    node.textContent=format(value);
    if(t<1)requestAnimationFrame(frame);else node.textContent=format(to);
  };
  requestAnimationFrame(frame);
  node.animate(pickup?[
    {transform:'translateY(6px)',opacity:.64},
    {transform:'translateY(-2px)',opacity:1,offset:.72},
    {transform:'translateY(0)',opacity:1}
  ]:[
    {transform:'translateY(4px)',opacity:.72},
    {transform:'translateY(0)',opacity:1}
  ],{duration,easing:'cubic-bezier(.22,1,.36,1)'});
}

export function applyBusinessDashboardMotion(root,data,{reason='load'}={}){
  if(!root)return;
  const reduced=window.matchMedia?.(MOTION_QUERY)?.matches===true;
  const previous=readSnapshot();
  const publishedAt=String(data?.publishedAt||data?.importedAt||'');
  const current={publishedAt,businessDate:String(data?.businessDate||''),revision:Number(data?.revision)||0,metrics:collectMetrics(root)};
  const publicationChanged=Boolean(previous?.publishedAt&&publishedAt&&previous.publishedAt!==publishedAt);

  root.dataset.bdMotionReady='true';
  if(publicationChanged)root.querySelector('.bd-update-stamp')?.classList.add('is-fresh');

  if(!reduced&&previous?.metrics){
    root.querySelectorAll('[data-bd-motion-key][data-bd-motion-value]').forEach(node=>{
      const key=node.dataset.bdMotionKey,currentValue=safeNumber(node.dataset.bdMotionValue),prior=safeNumber(previous.metrics?.[key]?.value);
      if(currentValue===null||prior===null||currentValue===prior)return;
      animateValue(node,prior,currentValue,node.dataset.bdMotionFormat||previous.metrics?.[key]?.format||'',{pickup:node.dataset.bdPickup==='true'});
    });
  }

  if(!reduced&&publicationChanged){
    root.querySelectorAll('.bd-flag').forEach((flag,index)=>flag.animate([
      {opacity:.35,transform:'translateY(5px)'},
      {opacity:1,transform:'translateY(0)'}
    ],{duration:360,delay:Math.min(index,4)*45,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}));
  }

  writeSnapshot(current);
  root.dispatchEvent(new CustomEvent('sindhorn:business-dashboard-motion-complete',{detail:{reason,publicationChanged,reduced}}));
}
