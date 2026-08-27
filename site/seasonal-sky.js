const BANGKOK_TIMEZONE='Asia/Bangkok';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,Number(v)||0));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const hex=value=>{const clean=String(value).replace('#','');return[0,2,4].map(i=>parseInt(clean.slice(i,i+2),16)/255)};
const mixVec=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));

// Monthly Bangkok anchors. Interpolation is continuous across every month boundary.
// Values are priors only: weather mechanics always determine cloud occupancy/precipitation.
const MONTHLY=[
  {name:'jan-cool-dry',dayTop:'#6E9AD0',dayHorizon:'#D8D7D7',dawnTop:'#9B89B3',dawnHorizon:'#F0B1A4',sunsetTop:'#766D9E',sunsetHorizon:'#F2A066',twilightTop:'#51406D',twilightHorizon:'#CE7898',cloudAmbient:'#BFC2CA',cloudWarm:'#EAB2AF',cloudBase:'#7F8490',haze:.18,pink:.78,violet:.82,cirrus:.62,convective:.12,baseDarkness:.24,persistence:.78},
  {name:'feb-cool-dry',dayTop:'#6F9CCF',dayHorizon:'#DAD9D3',dawnTop:'#A58AA9',dawnHorizon:'#F0B69E',sunsetTop:'#817098',sunsetHorizon:'#EEA15F',twilightTop:'#58416D',twilightHorizon:'#C97A93',cloudAmbient:'#C2C4CA',cloudWarm:'#E9B0AA',cloudBase:'#80848C',haze:.22,pink:.70,violet:.72,cirrus:.55,convective:.14,baseDarkness:.24,persistence:.68},
  {name:'mar-hot-dry',dayTop:'#7899C2',dayHorizon:'#D8D0BF',dawnTop:'#B08E9B',dawnHorizon:'#EDB183',sunsetTop:'#896E87',sunsetHorizon:'#E9964E',twilightTop:'#554160',twilightHorizon:'#B87780',cloudAmbient:'#C1BDBA',cloudWarm:'#E4A58B',cloudBase:'#85817F',haze:.43,pink:.42,violet:.38,cirrus:.42,convective:.19,baseDarkness:.26,persistence:.48},
  {name:'apr-hot-hazy',dayTop:'#8198B7',dayHorizon:'#D7CAB4',dawnTop:'#B8958F',dawnHorizon:'#ECB37E',sunsetTop:'#8E716D',sunsetHorizon:'#E88C43',twilightTop:'#55434F',twilightHorizon:'#A96E6E',cloudAmbient:'#C0B9B2',cloudWarm:'#E3A07C',cloudBase:'#87817D',haze:.64,pink:.30,violet:.24,cirrus:.35,convective:.25,baseDarkness:.28,persistence:.38},
  {name:'may-monsoon-onset',dayTop:'#7391AD',dayHorizon:'#C8C9C4',dawnTop:'#9B929F',dawnHorizon:'#D9AE91',sunsetTop:'#777080',sunsetHorizon:'#D99C64',twilightTop:'#484552',twilightHorizon:'#9C7378',cloudAmbient:'#ADB5BD',cloudWarm:'#D9AB94',cloudBase:'#6E7883',haze:.48,pink:.28,violet:.34,cirrus:.32,convective:.58,baseDarkness:.47,persistence:.34},
  {name:'jun-monsoon-onset',dayTop:'#708DA8',dayHorizon:'#C2C6C4',dawnTop:'#9693A0',dawnHorizon:'#D5AA92',sunsetTop:'#737180',sunsetHorizon:'#D7A06B',twilightTop:'#474653',twilightHorizon:'#95777D',cloudAmbient:'#A9B3BC',cloudWarm:'#D6AE99',cloudBase:'#687582',haze:.46,pink:.27,violet:.38,cirrus:.30,convective:.68,baseDarkness:.53,persistence:.35},
  {name:'jul-monsoon',dayTop:'#6B879E',dayHorizon:'#B9C0C0',dawnTop:'#8E919D',dawnHorizon:'#CDA78F',sunsetTop:'#6D7080',sunsetHorizon:'#C9996A',twilightTop:'#424653',twilightHorizon:'#89767E',cloudAmbient:'#A3AEB8',cloudWarm:'#D0A995',cloudBase:'#5F6D7C',haze:.45,pink:.24,violet:.46,cirrus:.25,convective:.82,baseDarkness:.61,persistence:.37},
  {name:'aug-heavy-monsoon',dayTop:'#668298',dayHorizon:'#B4BCBD',dawnTop:'#8A8E9C',dawnHorizon:'#C8A48F',sunsetTop:'#696D80',sunsetHorizon:'#C8966B',twilightTop:'#3F4452',twilightHorizon:'#83747D',cloudAmbient:'#9EAAB5',cloudWarm:'#CCA68F',cloudBase:'#596878',haze:.47,pink:.23,violet:.52,cirrus:.23,convective:.92,baseDarkness:.68,persistence:.40},
  {name:'sep-heavy-monsoon',dayTop:'#68869E',dayHorizon:'#B9C1C1',dawnTop:'#8E929F',dawnHorizon:'#CDA991',sunsetTop:'#6D6F80',sunsetHorizon:'#D09B6B',twilightTop:'#424652',twilightHorizon:'#897580',cloudAmbient:'#A2AEB8',cloudWarm:'#D2A993',cloudBase:'#5D6C79',haze:.45,pink:.26,violet:.50,cirrus:.25,convective:.88,baseDarkness:.64,persistence:.43},
  {name:'oct-transition',dayTop:'#7190AE',dayHorizon:'#C8CBC7',dawnTop:'#A095AA',dawnHorizon:'#DFB0A0',sunsetTop:'#757087',sunsetHorizon:'#DEA06F',twilightTop:'#484657',twilightHorizon:'#A07788',cloudAmbient:'#ADB6BE',cloudWarm:'#DCACA0',cloudBase:'#6B7782',haze:.34,pink:.48,violet:.58,cirrus:.39,convective:.52,baseDarkness:.45,persistence:.58},
  {name:'nov-cool-transition',dayTop:'#7199C6',dayHorizon:'#D4D4D1',dawnTop:'#A28FAE',dawnHorizon:'#EBB2A6',sunsetTop:'#7B7095',sunsetHorizon:'#EBA06A',twilightTop:'#50436A',twilightHorizon:'#BD7B96',cloudAmbient:'#BCC0C7',cloudWarm:'#E6B0AB',cloudBase:'#78818B',haze:.24,pink:.68,violet:.74,cirrus:.55,convective:.24,baseDarkness:.31,persistence:.70},
  {name:'dec-cool-dry',dayTop:'#6D99CE',dayHorizon:'#D8D7D5',dawnTop:'#9988B3',dawnHorizon:'#F0AEA7',sunsetTop:'#746A9B',sunsetHorizon:'#F1A164',twilightTop:'#4D3F6D',twilightHorizon:'#CB779C',cloudAmbient:'#BFC2CA',cloudWarm:'#EAB0B1',cloudBase:'#7D8490',haze:.18,pink:.82,violet:.88,cirrus:.64,convective:.12,baseDarkness:.25,persistence:.84}
].map(row=>({
  ...row,
  dayTop:hex(row.dayTop),dayHorizon:hex(row.dayHorizon),dawnTop:hex(row.dawnTop),dawnHorizon:hex(row.dawnHorizon),sunsetTop:hex(row.sunsetTop),sunsetHorizon:hex(row.sunsetHorizon),twilightTop:hex(row.twilightTop),twilightHorizon:hex(row.twilightHorizon),cloudAmbient:hex(row.cloudAmbient),cloudWarm:hex(row.cloudWarm),cloudBase:hex(row.cloudBase)
}));
const COLOR_KEYS=['dayTop','dayHorizon','dawnTop','dawnHorizon','sunsetTop','sunsetHorizon','twilightTop','twilightHorizon','cloudAmbient','cloudWarm','cloudBase'];
const NUMBER_KEYS=['haze','pink','violet','cirrus','convective','baseDarkness','persistence'];

function zonedParts(date,timeZone=BANGKOK_TIMEZONE){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date),out={};
  for(const part of parts)if(part.type!=='literal')out[part.type]=Number(part.value);
  return out;
}
function daysInMonth(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function interpolateProfile(a,b,t){
  const out={};for(const key of COLOR_KEYS)out[key]=mixVec(a[key],b[key],t);for(const key of NUMBER_KEYS)out[key]=mix(a[key],b[key],t);return out;
}
export function bangkokSeasonalProfile(date=new Date()){
  const p=zonedParts(date),index=Math.max(0,Math.min(11,p.month-1)),next=(index+1)%12,days=daysInMonth(p.year,p.month),fraction=clamp(((p.day-1)+(p.hour+p.minute/60+p.second/3600)/24)/days),t=smooth(fraction),values=interpolateProfile(MONTHLY[index],MONTHLY[next],t);
  return{schema:1,profile:'bangkok-seasonal-v2',month:p.month,monthFraction:fraction,anchorA:MONTHLY[index].name,anchorB:MONTHLY[next].name,...values};
}

const DRIZZLE=new Set([51,53,55,56,57]);
const RAIN=new Set([61,63,65,66,67]);
const SHOWERS=new Set([80,81,82]);
const STORM=new Set([95,96,99]);
const FOG=new Set([45,48]);
const SNOW=new Set([71,73,75,77,85,86]);
export function weatherFamily(code){
  code=Number(code);if(STORM.has(code))return'thunderstorm';if(SHOWERS.has(code))return'showers';if(RAIN.has(code))return'rain';if(DRIZZLE.has(code))return'drizzle';if(FOG.has(code))return'fog';if(SNOW.has(code))return'snow';if(code===3)return'overcast';if(code===2)return'partly-cloudy';if(code===1)return'mainly-clear';return'clear';
}
export function cloudMorphologyForWeather(weather={},profile=bangkokSeasonalProfile()){
  const family=weatherFamily(weather.weatherCode),cloud=clamp(weather.cloudCover),humidity=clamp(weather.humidity??.68),rain=clamp(Math.max(Number(weather.rain)||0,Number(weather.showers)||0,Number(weather.precipitation)||0)/8),storm=clamp(weather.storm),seasonConv=clamp(profile.convective),wet=clamp((humidity-.58)/.36);
  let high=0,mid=0,low=0,connected=0,darkness=profile.baseDarkness*.35,edge=.46;
  if(family==='clear'){
    high=cloud*.18;mid=cloud*.06;low=0;edge=.58;
  }else if(family==='mainly-clear'){
    high=cloud*(.38+.20*profile.cirrus);mid=cloud*.28;low=cloud*seasonConv*wet*.05;edge=.60;
  }else if(family==='partly-cloudy'){
    high=clamp(cloud*(.22+.24*profile.cirrus));mid=clamp(.34+cloud*.52);low=clamp(cloud*seasonConv*wet*.22);edge=.66;
  }else if(family==='overcast'){
    high=.30;mid=.98;low=clamp(.10+seasonConv*wet*.24);connected=.94;darkness=clamp(.34+profile.baseDarkness*.35);edge=.28;
  }else if(family==='fog'){
    high=.12;mid=clamp(.58+cloud*.28);low=.28;connected=.66;darkness=.30;edge=.22;
  }else if(family==='drizzle'){
    high=.16;mid=.92;low=clamp(.42+seasonConv*.20+rain*.16);connected=.84;darkness=clamp(.42+profile.baseDarkness*.25);edge=.24;
  }else if(family==='rain'){
    high=.12;mid=.94;low=clamp(.56+seasonConv*.22+rain*.18);connected=.88;darkness=clamp(.50+profile.baseDarkness*.30);edge=.22;
  }else if(family==='showers'){
    high=.15;mid=.78;low=clamp(.66+seasonConv*.24+rain*.18);connected=.58;darkness=clamp(.48+profile.baseDarkness*.34);edge=.40;
  }else if(family==='thunderstorm'){
    high=.10;mid=.88;low=1;connected=.84;darkness=clamp(.72+profile.baseDarkness*.25+storm*.12);edge=.32;
  }else if(family==='snow'){
    high=.16;mid=.96;low=.68;connected=.90;darkness=.48;edge=.25;
  }
  // The seasonal prior can shape existing cloud, never invent it into a clear forecast.
  if(cloud<=.02&&family==='clear'){high=mid=low=0}
  return{family,high:clamp(high),mid:clamp(mid),low:clamp(low),connected:clamp(connected),darkness:clamp(darkness),edge:clamp(edge),convective:seasonConv,wet};
}

const NIGHT_TOP=hex('#071027'),NIGHT_HORIZON=hex('#111B38');
function weatherColorGate(family){if(family==='thunderstorm')return .08;if(family==='rain'||family==='drizzle')return .18;if(family==='overcast')return .22;if(family==='fog')return .15;if(family==='showers')return .42;return 1}
export function seasonalSkyForState({date=new Date(),solarAltitude=30,solarAzimuth=180,weather={}}={}){
  const profile=bangkokSeasonalProfile(date),morphology=cloudMorphologyForWeather(weather,profile),e=Number(solarAltitude),west=((Number(solarAzimuth)%360)+360)%360>=180,gate=weatherColorGate(morphology.family),lowSun=clamp((12-e)/14),twilight=clamp((2-e)/10);
  let top=profile.dayTop,horizon=profile.dayHorizon;
  if(e<12&&e>=0){const lowTop=west?profile.sunsetTop:profile.dawnTop,lowHorizon=west?profile.sunsetHorizon:profile.dawnHorizon,t=smooth((12-e)/12);top=mixVec(profile.dayTop,lowTop,t);horizon=mixVec(profile.dayHorizon,lowHorizon,t)}
  else if(e<0&&e>=-7){const lowTop=west?profile.sunsetTop:profile.dawnTop,lowHorizon=west?profile.sunsetHorizon:profile.dawnHorizon,t=smooth((-e)/7);top=mixVec(lowTop,profile.twilightTop,t);horizon=mixVec(lowHorizon,profile.twilightHorizon,t)}
  else if(e< -7){const persistence=clamp(profile.persistence),span=5+6*persistence,t=smooth(clamp((-7-e)/span));top=mixVec(profile.twilightTop,NIGHT_TOP,t);horizon=mixVec(profile.twilightHorizon,NIGHT_HORIZON,t)}
  const warmPotential=west?clamp((.58+profile.pink*.18)*gate):clamp((.44+profile.pink*.12)*gate),violetPotential=clamp(profile.violet*gate),hazePrior=clamp(profile.haze*(morphology.family==='clear'||morphology.family==='mainly-clear'?1:.48));
  return{profile,morphology,top,horizon,west,lowSun,twilight,warmPotential,violetPotential,hazePrior,cloudAmbient:profile.cloudAmbient,cloudWarm:profile.cloudWarm,cloudBase:profile.cloudBase};
}

export const BangkokSeasonalSky={timezone:BANGKOK_TIMEZONE,monthly:MONTHLY.map(item=>item.name),profile:bangkokSeasonalProfile,morphology:cloudMorphologyForWeather,state:seasonalSkyForState,weatherFamily};
if(typeof window!=='undefined')window.SindhornSeasonalSky=BangkokSeasonalSky;
