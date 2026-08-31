export const BANGKOK_TIME_ZONE='Asia/Bangkok';
export const DAY_CYCLE_CHECK_MS=30000;
export const DAY_CYCLE_ROLLOVER_MS=60000;
export const DAY_CYCLE_CORRECTION_MS=900;

export const BETTA_DAY_PERIODS=Object.freeze([
  Object.freeze({key:'midnight',startHour:0,endHour:3,name:'Midnight',baseline:'reference1',referenceId:1,tone:'dark'}),
  Object.freeze({key:'before-dawn',startHour:3,endHour:6,name:'Before Dawn',baseline:'reference7',referenceId:7,tone:'dark'}),
  Object.freeze({key:'first-light',startHour:6,endHour:9,name:'First Light',baseline:'reference4',referenceId:4,tone:'bright'}),
  Object.freeze({key:'bright-morning',startHour:9,endHour:12,name:'Bright Morning',baseline:'reference6',referenceId:6,tone:'bright'}),
  Object.freeze({key:'midday',startHour:12,endHour:15,name:'Midday',baseline:'reference2',referenceId:2,tone:'bright'}),
  Object.freeze({key:'afternoon',startHour:15,endHour:18,name:'Afternoon',baseline:'reference3',referenceId:3,tone:'bright'}),
  Object.freeze({key:'golden-hour',startHour:18,endHour:21,name:'Golden Hour',baseline:'reference5',referenceId:5,tone:'dark'}),
  Object.freeze({key:'blue-hour',startHour:21,endHour:24,name:'Blue Hour',baseline:'reference8',referenceId:8,tone:'dark'})
]);

const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:BANGKOK_TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export const easeDayCycle=t=>1-Math.pow(1-clamp(t),3);
export function periodForMinuteOfDay(value){const minute=((Number(value)||0)%1440+1440)%1440,hour=minute/60;return BETTA_DAY_PERIODS.find(p=>hour>=p.startHour&&hour<p.endHour)||BETTA_DAY_PERIODS[0]}
export function bangkokClock(date=new Date()){const parts=Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const hour=Number(parts.hour)||0,minute=Number(parts.minute)||0,second=Number(parts.second)||0;return{hour,minute,second,minuteOfDay:hour*60+minute+second/60,label:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`}}
export function periodForBangkokTime(date=new Date()){return periodForMinuteOfDay(bangkokClock(date).minuteOfDay)}
export function periodByKey(key){return BETTA_DAY_PERIODS.find(period=>period.key===key)||null}
export function nextPeriod(period){const index=BETTA_DAY_PERIODS.findIndex(item=>item.key===period?.key);return BETTA_DAY_PERIODS[(index+1+BETTA_DAY_PERIODS.length)%BETTA_DAY_PERIODS.length]}
