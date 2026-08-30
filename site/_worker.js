const NICT_ORIGIN='https://himawari8-dl.nict.go.jp/himawari8/img';
const SOURCE='NICT Himawari real-time imagery from JMA Himawari-9';
const DATASETS={
  true:['D531106'],
  b13:['FULL_24H/B13','FULL_24h/B13'],
  b08:['FULL_24H/B08','FULL_24h/B08']
};
const ALLOWED_ZOOMS=new Set([1,2,4,8,16,20]);

function json(body,status=200,cache='no-store'){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':cache,
      'x-content-type-options':'nosniff'
    }
  });
}

async function fetchFirst(urls,init){
  let last=null;
  for(const url of urls){
    try{
      const response=await fetch(url,init);
      if(response.ok)return response;
      last=response;
    }catch(error){
      last=error;
    }
  }
  return last;
}

function parseTileParams(url){
  const dataset=url.searchParams.get('dataset')||'';
  const time=url.searchParams.get('time')||'';
  const zoom=Number(url.searchParams.get('zoom')||4);
  const x=Number(url.searchParams.get('x'));
  const y=Number(url.searchParams.get('y'));
  if(!DATASETS[dataset])return{error:'unsupported dataset'};
  if(!/^\d{4}\/\d{2}\/\d{2}\/\d{6}$/.test(time))return{error:'invalid time'};
  if(!ALLOWED_ZOOMS.has(zoom))return{error:'invalid zoom'};
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=zoom||y>=zoom)return{error:'invalid tile coordinate'};
  return{dataset,time,zoom,x,y};
}

async function latest(){
  const urls=[
    `${NICT_ORIGIN}/FULL_24h/latest.json`,
    `${NICT_ORIGIN}/D531106/latest.json`
  ];
  const response=await fetchFirst(urls,{headers:{accept:'application/json'}});
  if(!(response instanceof Response)||!response.ok){
    return json({ok:false,error:'Himawari latest metadata unavailable',source:SOURCE},502);
  }
  let payload;
  try{payload=await response.json();}catch{return json({ok:false,error:'Invalid Himawari metadata',source:SOURCE},502)}
  const date=typeof payload?.date==='string'?payload.date:null;
  if(!date)return json({ok:false,error:'Himawari metadata missing date',source:SOURCE},502);
  return json({
    ok:true,
    satellite:'Himawari-9',
    provider:'NICT / JMA',
    source:SOURCE,
    date,
    file:typeof payload.file==='string'?payload.file:null,
    cadenceMinutes:10
  },200,'public, max-age=45, s-maxage=45, stale-while-revalidate=90');
}

async function tile(url){
  const parsed=parseTileParams(url);
  if(parsed.error)return json({ok:false,error:parsed.error},400);
  const {dataset,time,zoom,x,y}=parsed;
  const urls=DATASETS[dataset].map(path=>`${NICT_ORIGIN}/${path}/${zoom}d/550/${time}_${x}_${y}.png`);
  const response=await fetchFirst(urls,{headers:{accept:'image/png'}});
  if(!(response instanceof Response)||!response.ok){
    return json({ok:false,error:'Himawari tile unavailable',dataset,time,zoom,x,y,source:SOURCE},502);
  }
  const headers=new Headers();
  headers.set('content-type',response.headers.get('content-type')||'image/png');
  headers.set('cache-control','public, max-age=600, s-maxage=86400, immutable');
  headers.set('x-content-type-options','nosniff');
  headers.set('x-betta-satellite-source','NICT-Himawari');
  headers.set('x-betta-satellite-dataset',dataset);
  return new Response(response.body,{status:200,headers});
}

export default{
  async fetch(request){
    const url=new URL(request.url);
    if(request.method!=='GET')return json({ok:false,error:'method not allowed'},405);
    if(url.pathname!=='/api/betta-satellite')return json({ok:false,error:'not found'},404);
    const kind=url.searchParams.get('kind')||'latest';
    if(kind==='latest')return latest();
    if(kind==='tile')return tile(url);
    return json({ok:false,error:'unsupported kind'},400);
  }
};
