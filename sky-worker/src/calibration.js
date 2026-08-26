const HOTEL_LAT=13.74135;
const HOTEL_LON=100.54274;
const DEG=Math.PI/180;
export const CALIBRATION_TTL_MS=12*60*1000;
export const OBSERVATION_TTL_MS=18*60*1000;

export const SKY_ANALYSIS_SCHEMA={
  type:'object',
  additionalProperties:false,
  properties:{
    skyVisible:{type:'boolean'},
    quality:{type:'number',minimum:0,maximum:1},
    confidence:{type:'number',minimum:0,maximum:1},
    zenithRgb:{type:'array',items:{type:'number',minimum:0,maximum:255},minItems:3,maxItems:3},
    horizonRgb:{type:'array',items:{type:'number',minimum:0,maximum:255},minItems:3,maxItems:3},
    luminance:{type:'number',minimum:0,maximum:1},
    saturation:{type:'number',minimum:0,maximum:1},
    warmth:{type:'number',minimum:0,maximum:1},
    cloudOpacity:{type:'number',minimum:0,maximum:1},
    cloudDarkness:{type:'number',minimum:0,maximum:1},
    haze:{type:'number',minimum:0,maximum:1},
    horizonContrast:{type:'number',minimum:0,maximum:1},
    sunGlow:{type:'number',minimum:0,maximum:1},
    stormConfidence:{type:'number',minimum:0,maximum:1}
  },
  required:['skyVisible','quality','confidence','zenithRgb','horizonRgb','luminance','saturation','warmth','cloudOpacity','cloudDarkness','haze','horizonContrast','sunGlow','stormConfidence']
};

export const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const mean=(a,b,t)=>a+(b-a)*t;
const median=values=>{const clean=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!clean.length)return 0;const mid=Math.floor(clean.length/2);return clean.length%2?clean[mid]:(clean[mid-1]+clean[mid])/2};
const normalizeRgb=value=>Array.isArray(value)&&value.length===3?value.map(channel=>Math.round(clamp(channel,0,255))):null;

export function solarPosition(date=new Date(),lat=HOTEL_LAT,lon=HOTEL_LON){
  const jd=date.getTime()/86400000+2440587.5,n=jd-2451545,L=(280.46+.9856474*n)%360,g=((357.528+.9856003*n)%360)*DEG,lambda=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*DEG,epsilon=(23.439-.0000004*n)*DEG,alpha=Math.atan2(Math.cos(epsilon)*Math.sin(lambda),Math.cos(lambda)),delta=Math.asin(Math.sin(epsilon)*Math.sin(lambda)),ut=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600,gst=((6.697375+.0657098242*n+ut)%24+24)%24,lst=((gst+lon/15)%24+24)%24;
  let hourAngle=lst*15*DEG-alpha;while(hourAngle< -Math.PI)hourAngle+=Math.PI*2;while(hourAngle>Math.PI)hourAngle-=Math.PI*2;
  const phi=lat*DEG,altitude=Math.asin(Math.sin(phi)*Math.sin(delta)+Math.cos(phi)*Math.cos(delta)*Math.cos(hourAngle)),azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(delta)*Math.cos(phi)-Math.sin(phi)*Math.cos(hourAngle));
  return{altitude:altitude/DEG,azimuth:(azimuth/DEG+360)%360};
}

export function calibrationMode(solar){
  const altitude=Number(solar?.altitude),azimuth=((Number(solar?.azimuth)||0)%360+360)%360;
  if(altitude<-12)return'night';
  if(altitude<=12&&azimuth>=45&&azimuth<=135)return'sunrise-east';
  if(altitude<=12&&azimuth>=225&&azimuth<=315)return'sunset-west';
  if(altitude<0)return'twilight';
  return'day-consensus';
}

export function directionalBase(facing,mode){
  const side=String(facing||'central');
  if(mode==='sunrise-east')return side==='east'?1:side==='west'?.18:.42;
  if(mode==='sunset-west')return side==='west'?1:side==='east'?.18:.42;
  if(mode==='twilight')return side==='central'?.72:.62;
  if(mode==='night')return side==='central'?.68:.56;
  return side==='central'?.82:.68;
}

export function chooseCameras(cameras,solar,max=3){
  const mode=calibrationMode(solar),ranked=cameras.map(camera=>({camera,score:directionalBase(camera.facing,mode)*clamp(camera.reliability??.75,.2,1)})).sort((a,b)=>b.score-a.score);
  const chosen=ranked.slice(0,Math.max(1,max)).map(item=>item.camera);
  if(mode==='day-consensus'){
    const hasEast=chosen.some(camera=>camera.facing==='east'),hasWest=chosen.some(camera=>camera.facing==='west');
    if(!hasEast){const candidate=ranked.find(item=>item.camera.facing==='east'&&!chosen.includes(item.camera));if(candidate)chosen[chosen.length-1]=candidate.camera}
    if(!hasWest){const candidate=ranked.find(item=>item.camera.facing==='west'&&!chosen.includes(item.camera));if(candidate)chosen[chosen.length-1]=candidate.camera}
  }
  return{mode,cameras:[...new Map(chosen.map(camera=>[camera.id,camera])).values()].slice(0,max)};
}

export function validateObservation(raw,camera,now=Date.now()){
  if(!raw||raw.skyVisible!==true)return null;
  const zenithRgb=normalizeRgb(raw.zenithRgb),horizonRgb=normalizeRgb(raw.horizonRgb);if(!zenithRgb||!horizonRgb)return null;
  const fetchedAt=Date.parse(raw.frameFetchedAt||raw.observedAt||'');if(!Number.isFinite(fetchedAt)||now-fetchedAt>OBSERVATION_TTL_MS||fetchedAt-now>2*60*1000)return null;
  const numeric={quality:clamp(raw.quality),confidence:clamp(raw.confidence),luminance:clamp(raw.luminance),saturation:clamp(raw.saturation),warmth:clamp(raw.warmth),cloudOpacity:clamp(raw.cloudOpacity),cloudDarkness:clamp(raw.cloudDarkness),haze:clamp(raw.haze),horizonContrast:clamp(raw.horizonContrast),sunGlow:clamp(raw.sunGlow),stormConfidence:clamp(raw.stormConfidence)};
  if(numeric.quality<.2||numeric.confidence<.2)return null;
  return{id:camera.id,name:camera.name,facing:camera.facing,reliability:clamp(camera.reliability??.75,.2,1),frameFetchedAt:new Date(fetchedAt).toISOString(),frameHash:String(raw.frameHash||''),zenithRgb,horizonRgb,...numeric};
}

function observationWeight(observation,mode,now,medians){
  const age=Math.max(0,now-Date.parse(observation.frameFetchedAt)),freshness=clamp(1-age/OBSERVATION_TTL_MS),base=directionalBase(observation.facing,mode)*observation.reliability*observation.quality*observation.confidence*mean(.35,1,freshness);
  const delta=Math.abs(observation.luminance-medians.luminance)+Math.abs(observation.warmth-medians.warmth)+Math.abs(observation.cloudOpacity-medians.cloudOpacity)+Math.abs(observation.haze-medians.haze);
  const outlierPenalty=delta>1.6?.2:delta>1.15?.45:delta>.85?.72:1;
  return Math.max(.001,base*outlierPenalty);
}

const weightedScalar=(pairs,key,total)=>pairs.reduce((sum,item)=>sum+item.observation[key]*item.weight,0)/total;
const weightedRgb=(pairs,key,total)=>[0,1,2].map(index=>Math.round(pairs.reduce((sum,item)=>sum+item.observation[key][index]*item.weight,0)/total));

export function fuseObservations(input,{now=Date.now(),solar=solarPosition(new Date(now)),weather=null}={}){
  const mode=calibrationMode(solar),observations=input.filter(Boolean);if(!observations.length)return{schema:1,observedAt:new Date(now).toISOString(),expiresAt:new Date(now+5*60*1000).toISOString(),confidence:0,mode,sources:[],visual:null,weather:weather||null};
  const medians={luminance:median(observations.map(item=>item.luminance)),warmth:median(observations.map(item=>item.warmth)),cloudOpacity:median(observations.map(item=>item.cloudOpacity)),haze:median(observations.map(item=>item.haze))};
  const pairs=observations.map(observation=>({observation,weight:observationWeight(observation,mode,now,medians)})),total=pairs.reduce((sum,item)=>sum+item.weight,0);
  if(total<=0)return{schema:1,observedAt:new Date(now).toISOString(),expiresAt:new Date(now+5*60*1000).toISOString(),confidence:0,mode,sources:[],visual:null,weather:weather||null};
  const confidence=clamp(total/(Math.max(1,observations.length)*.65));
  const visual={
    zenithRgb:weightedRgb(pairs,'zenithRgb',total),
    horizonRgb:weightedRgb(pairs,'horizonRgb',total),
    luminance:weightedScalar(pairs,'luminance',total),
    saturation:weightedScalar(pairs,'saturation',total),
    warmth:weightedScalar(pairs,'warmth',total),
    cloudOpacity:weightedScalar(pairs,'cloudOpacity',total),
    cloudDarkness:weightedScalar(pairs,'cloudDarkness',total),
    haze:weightedScalar(pairs,'haze',total),
    horizonContrast:weightedScalar(pairs,'horizonContrast',total),
    sunGlow:weightedScalar(pairs,'sunGlow',total),
    stormConfidence:weightedScalar(pairs,'stormConfidence',total)
  };
  const sources=pairs.sort((a,b)=>b.weight-a.weight).map(item=>({id:item.observation.id,facing:item.observation.facing,fresh:true,weight:Number((item.weight/total).toFixed(4)),quality:Number(item.observation.quality.toFixed(3)),confidence:Number(item.observation.confidence.toFixed(3)),observedAt:item.observation.frameFetchedAt}));
  return{schema:1,observedAt:new Date(now).toISOString(),expiresAt:new Date(now+CALIBRATION_TTL_MS).toISOString(),confidence:Number(confidence.toFixed(4)),mode,solar:{altitude:Number(solar.altitude.toFixed(3)),azimuth:Number(solar.azimuth.toFixed(3))},sources,visual:Object.fromEntries(Object.entries(visual).map(([key,value])=>[key,Array.isArray(value)?value:Number(value.toFixed(4))])),weather:weather||null};
}
