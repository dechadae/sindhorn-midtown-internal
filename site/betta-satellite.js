const API='/api/betta-satellite';
const BANGKOK={lat:13.7563,lon:100.5018};
const HA1_BOUNDS={west:99,east:110,north:16,south:7};
const SOURCE='Himawari-9 · JMA High-Resolution Asia 1';

const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const mix=(a,b,t)=>a+(b-a)*t;

function utcDate(value){
  if(value instanceof Date)return value;
  const text=String(value||'').trim().replace(' ','T');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text)?text:`${text}Z`);
}
function pad(value){return String(value).padStart(2,'0')}
function slotFor(value){
  const date=utcDate(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Invalid Himawari timestamp');
  return `${pad(date.getUTCHours())}${pad(Math.floor(date.getUTCMinutes()/10)*10)}`;
}
function previousObservation(value){
  const date=utcDate(value);
  return new Date(date.getTime()-10*60*1000);
}
function frameUrl(band,time){
  const params=new URLSearchParams({kind:'frame',band,time:slotFor(time)});
  return `${API}?${params}`;
}
async function imageData(band,time){
  const response=await fetch(frameUrl(band,time),{cache:'no-store'});
  if(!response.ok)throw new Error(`${band} Himawari frame ${response.status}`);
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
function projectBangkok(image){
  const xNorm=clamp((BANGKOK.lon-HA1_BOUNDS.west)/(HA1_BOUNDS.east-HA1_BOUNDS.west));
  const yNorm=clamp((HA1_BOUNDS.north-BANGKOK.lat)/(HA1_BOUNDS.north-HA1_BOUNDS.south));
  return{
    x:xNorm*(image.width-1),
    y:yNorm*(image.height-1),
    xNorm,yNorm
  };
}
function patchFrom(image,radiusDegrees=.72){
  const projection=projectBangkok(image);
  const radiusX=Math.max(18,Math.round(image.width*radiusDegrees/(HA1_BOUNDS.east-HA1_BOUNDS.west)));
  const radiusY=Math.max(18,Math.round(image.height*radiusDegrees/(HA1_BOUNDS.north-HA1_BOUNDS.south)));
  const cx=Math.round(projection.x),cy=Math.round(projection.y);
  const left=Math.max(1,cx-radiusX),right=Math.min(image.width-2,cx+radiusX);
  const top=Math.max(1,cy-radiusY),bottom=Math.min(image.height-2,cy+radiusY);
  const width=right-left+1,height=bottom-top+1;
  if(width<12||height<12)throw new Error('Bangkok satellite patch too small');
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
  return{
    gray,rgb,width,height,left,top,
    sourceWidth:image.width,sourceHeight:image.height,
    centerX:projection.x,centerY:projection.y,
    radiusDegrees
  };
}
function mean(values){
  let sum=0;for(let i=0;i<values.length;i++)sum+=values[i];
  return values.length?sum/values.length:0;
}
function standardDeviation(values){
  if(!values.length)return 0;
  const avg=mean(values);
  let sum=0;
  for(let i=0;i<values.length;i++){
    const d=values[i]-avg;sum+=d*d;
  }
  return Math.sqrt(sum/values.length);
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
  const p30=percentile(current.gray,.3),p70=percentile(current.gray,.7),p90=percentile(current.gray,.9),p97=percentile(current.gray,.97);
  const prev70=percentile(previous.gray,.7),prev90=percentile(previous.gray,.9);
  const contrast=Math.max(.025,p97-p30);
  const threshold=p30+contrast*.43;
  let cloudPixels=0;
  for(let i=0;i<current.gray.length;i++)if(current.gray[i]>threshold)cloudPixels++;
  const cloudAmount=clamp(cloudPixels/Math.max(1,current.gray.length));
  const coldCloud=clamp((p90-p30)/Math.max(.08,contrast));
  const cooling=clamp((p90-prev90)*3.2+(p70-prev70)*2.1,-1,1);
  const texture=clamp(gradientEnergy(current)/.14);
  return{cloudAmount,coldCloud,cooling,texture,p30,p70,p90,p97};
}
function motionMetrics(current,previous){
  const width=Math.min(current.width,previous.width),height=Math.min(current.height,previous.height);
  const search=Math.max(2,Math.min(9,Math.floor(Math.min(width,height)/10)));
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
  const confidence=clamp((best.score-.18)/.67);
  return{
    dx:best.dx,dy:best.dy,correlation:best.score,confidence,
    magnitude,energy:clamp(magnitude/6)*confidence
  };
}
function waterVaporMetrics(patch){
  const p72=percentile(patch.gray,.72);
  const p25=percentile(patch.gray,.25);
  const texture=clamp(gradientEnergy(patch)/.15);
  const moisture=clamp((p72-p25)/.42)*.68+texture*.32;
  return{moisture:clamp(moisture),texture,p25,p72};
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
function deriveState({latest,currentIR,previousIR,waterVapor,visible}){
  const irVariation=standardDeviation(currentIR.gray);
  const vaporVariation=standardDeviation(waterVapor.gray);
  if(irVariation<.006||vaporVariation<.004){
    throw new Error(`Degenerate Himawari Bangkok patch (IR ${irVariation.toFixed(4)}, WV ${vaporVariation.toFixed(4)})`);
  }
  const cloud=cloudMetrics(currentIR,previousIR);
  const motion=motionMetrics(currentIR,previousIR);
  const vapor=waterVaporMetrics(waterVapor);
  const color=visibleMetrics(visible);
  const fp=fingerprint(currentIR,waterVapor);
  const positiveCooling=Math.max(0,cloud.cooling);
  const energy=clamp(.62+motion.energy*.2+cloud.texture*.13+cloud.coldCloud*.08+positiveCooling*.18,.62,1);
  const measuredAngle=Math.atan2(-motion.dy,motion.dx);
  const fingerprintAngle=(fp.a*2-1)*Math.PI;
  const directionAngle=mix(fingerprintAngle,measuredAngle,motion.confidence);
  const directionMagnitude=.5+energy*.55;
  const morphologyVector=[Math.cos(directionAngle)*directionMagnitude,Math.sin(directionAngle)*directionMagnitude];
  const infraredColor=[
    clamp(.16+.48*cloud.coldCloud+.16*fp.c),
    clamp(.15+.48*vapor.moisture+.14*fp.b),
    clamp(.4+.4*(1-cloud.coldCloud)+.18*fp.a)
  ];
  const satelliteColor=[
    mix(infraredColor[0],color.color[0],color.confidence*.7),
    mix(infraredColor[1],color.color[1],color.confidence*.7),
    mix(infraredColor[2],color.color[2],color.confidence*.7)
  ];
  return{
    status:'live',
    inputMode:'satellite-only',
    satellite:'Himawari-9',provider:'JMA',source:SOURCE,
    sector:latest.sector||'High-Resolution Asia 1',bounds:latest.bounds||HA1_BOUNDS,
    observedAt:latest.observedAt||latest.date,
    sourceLastModified:latest.sourceLastModified||null,
    cadenceMinutes:latest.cadenceMinutes||10,
    bangkok:{
      ...BANGKOK,
      imageWidth:currentIR.sourceWidth,imageHeight:currentIR.sourceHeight,
      pixelX:+currentIR.centerX.toFixed(1),pixelY:+currentIR.centerY.toFixed(1),
      radiusDegrees:currentIR.radiusDegrees
    },
    metrics:{
      cloudAmount:+cloud.cloudAmount.toFixed(3),coldCloud:+cloud.coldCloud.toFixed(3),cooling:+cloud.cooling.toFixed(3),
      cloudTexture:+cloud.texture.toFixed(3),waterVapor:+vapor.moisture.toFixed(3),
      motionX:motion.dx,motionY:motion.dy,motionMagnitude:+motion.magnitude.toFixed(3),motionConfidence:+motion.confidence.toFixed(3),
      visibleConfidence:+color.confidence.toFixed(3),energy:+energy.toFixed(3),fingerprint:fp.hash,
      irVariation:+irVariation.toFixed(4),vaporVariation:+vaporVariation.toFixed(4)
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
  if(!payload?.ok||!(payload.observedAt||payload.date))throw new Error(payload?.error||'Himawari metadata unavailable');
  return payload;
}
async function frameSet(latest){
  const current=utcDate(latest.observedAt||latest.date),previous=previousObservation(current);
  const [currentIRRaw,previousIRRaw,waterRaw,visibleRaw]=await Promise.all([
    imageData('b13',current),
    imageData('b13',previous),
    imageData('b08',current),
    imageData('b03',current)
  ]);
  return{
    currentIR:patchFrom(currentIRRaw),
    previousIR:patchFrom(previousIRRaw),
    waterVapor:patchFrom(waterRaw),
    visible:patchFrom(visibleRaw)
  };
}
export async function readSatelliteState(){
  const latest=await latestMetadata();
  const frames=await frameSet(latest);
  return deriveState({latest,...frames});
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
