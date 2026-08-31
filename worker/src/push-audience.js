export const PUSH_TOPICS=Object.freeze({
  environment:'environment',
  businessDashboard:'business-dashboard'
});

function parseTopics(value){
  if(Array.isArray(value))return value;
  if(typeof value==='string'){
    try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch(_){return[]}
  }
  return[];
}

function uniqueKnown(values){
  const known=new Set(Object.values(PUSH_TOPICS));
  return[...new Set(values.map(value=>String(value||'').trim()).filter(value=>known.has(value)))].sort();
}

export function topicsForStoredSubscription(row){
  const stored=parseTopics(row?.topics);
  if(stored.length)return uniqueKnown(stored);
  // Existing subscriptions predate topics and were explicitly created by the Environmental Alerts
  // control. They remain environmental-only and must never be silently promoted to hotel updates.
  return[PUSH_TOPICS.environment];
}

export function requestedTopicsForSubscription(requested,{allowBusinessDashboard=false}={}){
  const topics=uniqueKnown(parseTopics(requested));
  return topics.filter(topic=>topic!==PUSH_TOPICS.businessDashboard||allowBusinessDashboard);
}

export function subscriptionHasTopic(row,topic){
  return topicsForStoredSubscription(row).includes(topic);
}

export function selectBusinessDashboardAudience(rows){
  return(Array.isArray(rows)?rows:[]).filter(row=>subscriptionHasTopic(row,PUSH_TOPICS.businessDashboard));
}

export function businessDashboardTopicCanBeAdded({authenticated=false,hasReadCapability=false,explicitOptIn=false}={}){
  return authenticated===true&&hasReadCapability===true&&explicitOptIn===true;
}
