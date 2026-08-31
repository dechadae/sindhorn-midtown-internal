const DEFAULTS=Object.freeze({
  fnbRevenueRelative:0.05,
  fnbRevenueAbsolute:25000,
  occupancyAbsolute:0.03,
  pickupRoomsAbsolute:20
});

const finite=value=>{const number=Number(value);return Number.isFinite(number)?number:null};
const text=value=>String(value??'').trim();

function publicationIdentity(value){
  if(!value||typeof value!=='object')return null;
  const businessDate=text(value.businessDate),revision=finite(value.revision);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||revision===null)return null;
  return{businessDate,revision:Math.trunc(revision)};
}

function flagKey(flag){
  if(!flag||typeof flag!=='object')return'';
  return[text(flag.domain),text(flag.scopeKey),text(flag.metricKey)].join(':');
}

function flagKeys(value){
  return new Set((Array.isArray(value?.flags)?value.flags:[]).map(flagKey).filter(Boolean));
}

function currentRoomMonth(value){
  const months=Array.isArray(value?.rooms?.months)?value.rooms.months:[];
  const businessMonth=text(value?.businessDate).slice(0,7);
  return months.find(month=>text(month?.stayMonth).startsWith(businessMonth))||months[0]||null;
}

function relativeDelta(previous,current){
  const before=finite(previous),after=finite(current);
  if(before===null||after===null)return null;
  const absolute=Math.abs(after-before);
  return{before,after,absolute,relative:Math.abs(before)>0?absolute/Math.abs(before):(absolute>0?Infinity:0)};
}

function materialMetricChanges(previous,current,options){
  const changes=[];
  const fnb=relativeDelta(previous?.fnb?.summary?.daily?.revenue,current?.fnb?.summary?.daily?.revenue);
  if(fnb&&fnb.absolute>=options.fnbRevenueAbsolute&&fnb.relative>=options.fnbRevenueRelative)changes.push('fnb.daily.revenue');

  const previousRoom=currentRoomMonth(previous),currentRoom=currentRoomMonth(current);
  const previousOccupancy=finite(previousRoom?.otb?.occupancy),currentOccupancy=finite(currentRoom?.otb?.occupancy);
  if(previousOccupancy!==null&&currentOccupancy!==null&&Math.abs(currentOccupancy-previousOccupancy)>=options.occupancyAbsolute)changes.push('rooms.current.occupancy');

  const previousPickup=finite(previousRoom?.pickup?.rns),currentPickup=finite(currentRoom?.pickup?.rns);
  if(previousPickup!==null&&currentPickup!==null&&Math.abs(currentPickup-previousPickup)>=options.pickupRoomsAbsolute)changes.push('rooms.current.pickup.rns');
  return changes;
}

function candidatePriority({newBusinessDate,newFlagKeys,changedMetricKeys}){
  if(newFlagKeys.length)return'attention';
  if(newBusinessDate)return'daily';
  if(changedMetricKeys.length)return'material';
  return null;
}

export function businessAlertDedupeKey(candidate){
  if(!candidate)return'';
  return['business-dashboard',text(candidate.businessDate),`r${Math.trunc(finite(candidate.revision)??0)}`,text(candidate.priority)].join(':');
}

export function buildBusinessAlertCandidates(previous,current,config={}){
  const nextIdentity=publicationIdentity(current);
  if(!nextIdentity)return[];
  const priorIdentity=publicationIdentity(previous);
  // First observation establishes a baseline. It must never generate a surprise lock-screen alert.
  if(!priorIdentity)return[];
  const changedPublication=nextIdentity.businessDate!==priorIdentity.businessDate||nextIdentity.revision!==priorIdentity.revision;
  if(!changedPublication)return[];

  const options={...DEFAULTS,...config};
  const priorFlags=flagKeys(previous),nextFlags=flagKeys(current);
  const newFlagKeys=[...nextFlags].filter(key=>!priorFlags.has(key)).sort();
  const changedMetricKeys=materialMetricChanges(previous,current,options).sort();
  const newBusinessDate=nextIdentity.businessDate!==priorIdentity.businessDate;
  const priority=candidatePriority({newBusinessDate,newFlagKeys,changedMetricKeys});
  // Same-day editorial/reconciliation revisions stay silent unless the approved business state
  // materially changed. A new business date is notification-worthy by itself.
  if(!priority)return[];

  const reasonKeys=[...(newBusinessDate?['new-business-date']:[]),...(newFlagKeys.length?['new-attention-item']:[]),...(changedMetricKeys.length?['material-metric-change']:[])];
  const candidate={
    kind:'business-dashboard-update',
    tag:'business-dashboard-update',
    route:'/',
    audienceTopic:'business-dashboard',
    priority,
    businessDate:nextIdentity.businessDate,
    revision:nextIdentity.revision,
    reasonKeys,
    newFlagKeys,
    changedMetricKeys
  };
  return[{...candidate,dedupeKey:businessAlertDedupeKey(candidate)}];
}

export function businessAlertPayload(candidate){
  if(!candidate?.dedupeKey)return null;
  const attention=candidate.priority==='attention';
  const daily=candidate.priority==='daily';
  return{
    id:candidate.dedupeKey,
    kind:'business-dashboard-update',
    tag:'business-dashboard-update',
    route:'/',
    titleEn:attention?'HOTEL BUSINESS UPDATE':daily?'TODAY IS READY':'TODAY HAS BEEN UPDATED',
    bodyEn:attention
      ?'New items need attention in Today. Open the app to review the approved update.'
      :daily
        ?'The latest approved hotel business update is available in Today.'
        :'Hotel performance data has materially changed. Open Today to review the approved update.'
  };
}

export function businessAlertPayloadIsLockScreenSafe(payload){
  if(!payload||payload.kind!=='business-dashboard-update'||payload.route!=='/')return false;
  const visible=`${text(payload.titleEn)} ${text(payload.bodyEn)}`;
  // Business figures, outlet names and source-report details must stay behind authenticated Today.
  const sensitivePattern=/\b(?:THB|ADR|RevPAR|occupancy|forecast|budget|revenue|covers?|room nights?|Bangkok'78|ANJU|Sip\s*&\s*Co|Horizon Pool|C&E|IRD)\b/i;
  const numericFigure=/\b\d{2,}(?:[,.]\d+)*(?:\s*%|\s*RN)?\b/i;
  return!sensitivePattern.test(visible)&&!numericFigure.test(visible);
}

export const BUSINESS_ALERT_DEFAULTS=DEFAULTS;
