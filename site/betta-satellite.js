const API='/api/betta-satellite';
const TILE_SIZE=550;
const SATELLITE_LONGITUDE=140.7;
const SATELLITE_DISTANCE=(35793+6371)/6371;
const BANGKOK={lat:13.7563,lon:100.5018};
const ZOOM_CANDIDATES=[4,2,1];
const SOURCE='Himawari-9 · NICT / JMA';

const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const mix=(a,b,t)=>a+(b-a)*t;

function utcDate(value){
  if(value instanceof Date)return value;
  const text=String(value||'').trim().replace(' ','T');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text)?text:`${text}Z`);
}
function pad(value){return String(value).padStart(2,'0')}
function timePath(value){
  const date=utcDate(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Invalid Himawari timestamp');
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth()+1)}/${pad(date.getUTCDate())}/${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}
function previousObservation(value){
  const date=utcDate(value);
  return new Date(date.getTime()-10*60*1000);
}

function projectBangkok(zoom){
  const phi=BANGKOK.lat*Math.PI/180;
  const lambda=(BANGKOK.lon-SATELLITE_LONGITUDE)*Math.PI/180;
  const cosc=Math.cos(phi)*Math.cos(lambda);
  const k=(SATELLITE_DISTANCE-1)/(SATELLITE_DISTANCE-cosc);
  const x=k*Math.cos(phi)*Math.sin(lambda);
  const y=k*Math.sin(phi);
  const limb=Math.sqrt((SATELLITE_DISTANCE-1)/(SATELLITE_DISTANCE+1));
  const diskSize=zoom*TILE_SIZE;
  const scale=diskSize/(2*limb);
  const globalX=diskSize/2+x*scale;
  const globalY=diskSize/2-y*scale;
  const tileX=Math.floor(globalX/TILE_SIZE);
  const tileY=Math.floor(globalY/TILE_SIZE);
  return{
    zoom,
    tileX:clamp(tileX,0,zoom-1),
    tileY:clamp(tileY,0,zoom-1),
    localX:globalX-tileX*TILE_SIZE,
    localY:globalY-tileY*TILE_SIZE,
    globalX,globalY
  };
}

function tileUrl(dataset,time,projection){
  const params=new URLSearchParams({
    kind:'tile',dataset,time:timePath(time),zoom:String(projection.zoom),
    x:String(projection.tileX),y:String(projection.tileY)
  });
  return `${API}?${params}`;
}

async function imageData(dataset,time,projection){
  const response=await fetch(tileUrl(dataset,time,projection),{cache:'force-cache'});
  if(!response.ok)throw new Error(`${dataset} tile ${response.status}`);
  const blob=await response.blob();
  const bitmap=await createImageBitmap(blob);
  const canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Satellite analysis canvas unavailable');
  context.drawImage(bitmap,0,0);
  bitmap.close?.();
  return context.getImageData(0,0,canvas.width,canvas.height);
}

function patchFrom(image,projection,radius){
  const cx=Math.round(projection.localX),cy=Math.round(projection.localY);
  const left=Math.max(1,cx-radius),right=Math.min(image.width-2,cx+radius);
  const top=Math.max(1,cy-radius),bottom=Math.min(image.height-2,cy+radius);
  const width=right-left+1,height=bottom-top+1;
  const gray=new Float32Array(width*height);
  const rgb=new Float32Array(width*height*3);
  let p=0,q=0;
  for(let y=top;y<=bottom;y++){
    for(let x=left;x<=right;x++){
      const i=(y*image.width+x)*4;
      const r=image.data[i]/255,g=image.data[i+1]/255,b=image.data[i+2]/255;
      gray[p++]=r*.2126+g*.7152+b*.0722;
      rgb[q++]=r;rgb[q++]=g;rgb[q++]=b;
    }
  }
  return{gray,rgb,width,height,left,top};
}
function mean(values){
  let sum=0;for(let i=0;i<values.length;i++)sum+=values[i];
  return values.length?sum/values.length:0;
}
function percentile(values,p){
  if(!values.length)return 0;
  const list=Array.from(values).sort((a,b)=>a-b);
  return list[Math.min(list.length-1,Math.max(0,Math.floor((list.length-1)*p)))];
}
function gradientEnergy(patch){
  const {gray,width,height}=patch;
  if(width<3||height<3)return 0;
  let sum=0,count=0;
  for(let y=1;y<height-1;y+=2){
    for(let x=1;x<width-1;x+=2){
      const i=y*width+x;
      const gx=gray[i+1]-gray[i-1];
      const gy=gray[i+width]-gray[i-width];
      sum+=Math.sqrt(gx*gx+gy*gy);count++;
    }
  }
  return count?sum/count:0;
}
function cloudMetrics(current,previous){
  const p40=percentile(current.gray,.4),p82=percentile(current.gray,.82),p92=percentile(current.gray,.92);
  const prev82=percentile(previous.gray,.82),prev92=percentile(previous.gray,.92);
  const threshold=Math.max(.38,p40+(p92-p40)*.46);
  let cloudPixels=0;
  for(let i=0;i<current.gray.length;i++)if(current.gray[i]>threshold)cloudPixels++;
  const cloudAmount=clamp(cloudPixels/Math.max(1,current.gray.length));
  const coldCloud=clamp((p92-.42)/.5);
  const cooling=clamp((p92-prev92)*3.2+(p82-prev82)*2.1,-1,1);
  const texture=clamp(gradientEnergy(current)/.16);
  return{cloudAmount,coldCloud,cooling,texture,p40,p82,p92};
}
function motionMetrics(current,previous){
  const width=Math.min(current.width,previous.width),height=Math.min(current.height,previous.height);
  const search=Math.max(2,Math.min(8,Math.floor(width/9)));
  const margin=search+3;
  let best={score:-2,dx:0,dy:0};
  for(let dy=-search;dy<=search;dy++){
    for(let dx=-search;dx<=search;dx++){
      let sumA=0,sumB=0,count=0;
      for(let y=margin;y<height-margin;y+=2){
        for(let x=margin;x<width-margin;x+=2){
          sumA+=current.gray[y*current.width+x];
          sumB+=previous.gray[(y-dy)*previous.width+(x-dx)];
          count++;
        }
      }
      if(!count)continue;
      const meanA=sumA/count,meanB=sumB/count;
      let cov=0,varA=0,varB=0;
      for(let y=margin;y<height-margin;y+=2){
        for(let x=margin;x<width-margin;x+=2){
          const a=current.gray[y*current.width+x]-meanA;
          const b=previous.gray[(y-dy)*previous.width+(x-dx)]-meanB;
          cov+=a*b;varA+=a*a;varB+=b*b;
        }
      }
      const score=cov/Math.sqrt(Math.max(1e-8,varA*varB));
      if(score>best.score)best={score,dx,dy};
    }
  }
  const magnitude=Math.sqrt(best.dx*best.dx+best.dy*best.dy);
  const confidence=clamp((best.score-.15)/.7);
  return{
    dx:best.dx,dy:best.dy,correlation:best.score,confidence,
    magnitude,energy:clamp(magnitude/5.5)*confidence
  };
}
function waterVaporMetrics(patch){
  const p72=percentile(patch.gray,.72);
  const texture=clamp(gradientEnergy(patch)/.17);
  const moisture=clamp((p72-.25)/.58)*.68+texture*.32;
  return{moisture:clamp(moisture),texture,p72};
}
function visibleMetrics(patch){
  let r=0,g=0,b=0,l=0,count=0,active=0;
  for(let i=0;i<patch.gray.length;i++){
    const y=patch.gray[i];
    if(y>.025){
      const j=i*3;r+=patch.rgb[j];g+=patch.rgb[j+1];b+=patch.rgb[j+2];l+=y;active++;
    }
    count++;
  }
  if(!active)return{confidence:0,color:[.16,.22,.52],meanLuma:0};
  r/=active;g/=active;b/=active;l/=active;
  const confidence=clamp((l-.035)/.17)*clamp(active/Math.max(1,count)*1.8);
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  const chroma=mx-mn;
  const boost=chroma>.01?Math.min(2.2,.28/chroma):1;
  const mid=(r+g+b)/3;
  const color=[clamp(mid+(r-mid)*boost),clamp(mid+(g-mid)*boost),clamp(mid+(b-mid)*boost)];
  return{confidence,color,meanLuma:l};
}
function fingerprint(...patches){
  let hash=2166136261>>>0;
  for(const patch of patches){
    const values=patch.gray;
    const step=Math.max(1,Math.floor(values.length/421));
    for(let i=0;i<values.length;i+=step){
      hash^=Math.round(values[i]*255)&255;
      hash=Math.imul(hash,16777619)>>>0;
    }
  }
  const a=(hash&0xffff)/65535;
  const b=((hash>>>8)&0xffff)/65535;
  const c=((hash>>>16)&0xffff)/65535;
  return{hash:hash.toString(16).padStart(8,'0'),a,b,c};
}

function deriveState({latest,projection,currentIR,previousIR,waterVapor,visible}){
  const cloud=cloudMetrics(currentIR,previousIR);
  const motion=motionMetrics(currentIR,previousIR);
  const vapor=waterVaporMetrics(waterVapor);
  const color=visibleMetrics(visible);
  const fp=fingerprint(currentIR,waterVapor);
  const positiveCooling=Math.max(0,cloud.cooling);
  const energy=clamp(.56+motion.energy*.19+cloud.texture*.12+cloud.coldCloud*.07+positiveCooling*.16,.56,1);
  const measuredAngle=Math.atan2(-motion.dy,motion.dx);
  const fingerprintAngle=(fp.a*2-1)*Math.PI;
  const directionAngle=mix(fingerprintAngle,measuredAngle,motion.confidence);
  const directionMagnitude=.42+energy*.5;
  const morphologyVector=[Math.cos(directionAngle)*directionMagnitude,Math.sin(directionAngle)*directionMagnitude];
  const infraredColor=[
    clamp(.18+.48*cloud.coldCloud+.14*fp.c),
    clamp(.16+.5*vapor.moisture+.12*fp.b),
    clamp(.42+.38*(1-cloud.coldCloud)+.18*fp.a)
  ];
  const satelliteColor=[
    mix(infraredColor[0],color.color[0],color.confidence),
    mix(infraredColor[1],color.color[1],color.confidence),
    mix(infraredColor[2],color.color[2],color.confidence)
  ];
  return{
    status:'live',
    inputMode:'satellite-only',
    satellite:'Himawari-9',provider:'NICT / JMA',source:SOURCE,
    observedAt:latest.date,
    cadenceMinutes:latest.cadenceMinutes||10,
    zoom:projection.zoom,
    bangkok:{...BANGKOK,tileX:projection.tileX,tileY:projection.tileY,localX:+projection.localX.toFixed(1),localY:+projection.localY.toFixed(1)},
    metrics:{
      cloudAmount:+cloud.cloudAmount.toFixed(3),coldCloud:+cloud.coldCloud.toFixed(3),cooling:+cloud.cooling.toFixed(3),
      cloudTexture:+cloud.texture.toFixed(3),waterVapor:+vapor.moisture.toFixed(3),
      motionX:motion.dx,motionY:motion.dy,motionMagnitude:+motion.magnitude.toFixed(3),motionConfidence:+motion.confidence.toFixed(3),
      visibleConfidence:+color.confidence.toFixed(3),energy:+energy.toFixed(3),fingerprint:fp.hash
    },
    drivers:{
      energy,
      cloud:cloud.cloudAmount,
      cold:cloud.coldCloud,
      cooling:cloud.cooling,
      texture:cloud.texture,
      vapor:vapor.moisture,
      motion:morphologyVector,
      color:satelliteColor,
      visible:color.confidence,
      fingerprint:[fp.a,fp.b,fp.c]
    }
  };
}

async function latestMetadata(){
  const response=await fetch(`${API}?kind=latest`,{cache:'no-store'});
  if(!response.ok)throw new Error(`Himawari metadata ${response.status}`);
  const payload=await response.json();
  if(!payload?.ok||!payload.date)throw new Error(payload?.error||'Himawari metadata unavailable');
  return payload;
}
async function frameSet(latest,projection){
  const current=utcDate(latest.date),previous=previousObservation(current);
  const radius=projection.zoom>=4?42:projection.zoom===2?30:18;
  const [currentIRRaw,previousIRRaw,waterRaw,visibleRaw]=await Promise.all([
    imageData('b13',current,projection),
    imageData('b13',previous,projection),
    imageData('b08',current,projection),
    imageData('true',current,projection)
  ]);
  return{
    currentIR:patchFrom(currentIRRaw,projection,radius),
    previousIR:patchFrom(previousIRRaw,projection,radius),
    waterVapor:patchFrom(waterRaw,projection,radius),
    visible:patchFrom(visibleRaw,projection,radius)
  };
}

export async function readSatelliteState(){
  const latest=await latestMetadata();
  let lastError=null;
  for(const zoom of ZOOM_CANDIDATES){
    const projection=projectBangkok(zoom);
    try{
      const frames=await frameSet(latest,projection);
      return deriveState({latest,projection,...frames});
    }catch(error){lastError=error}
  }
  throw lastError||new Error('No Himawari imagery available');
}

export function startSatelliteStream({onState,onError,intervalMs=90000}={}){
  let stopped=false,lastObserved='';
  async function refresh(){
    try{
      const state=await readSatelliteState();
      if(stopped)return;
      if(state.observedAt!==lastObserved){lastObserved=state.observedAt;onState?.(state)}
    }catch(error){if(!stopped)onError?.(error)}
  }
  refresh();
  const timer=setInterval(refresh,Math.max(30000,intervalMs));
  return()=>{stopped=true;clearInterval(timer)};
}

export const SATELLITE_SOURCE=SOURCE;
