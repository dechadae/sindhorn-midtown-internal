import assert from 'node:assert/strict';
import {
  buildBusinessAlertCandidates,
  businessAlertDedupeKey,
  businessAlertPayload,
  businessAlertPayloadIsLockScreenSafe
} from '../worker/src/business-dashboard-alerts.js';
import {
  PUSH_TOPICS,
  topicsForStoredSubscription,
  requestedTopicsForSubscription,
  selectBusinessDashboardAudience,
  businessDashboardTopicCanBeAdded
} from '../worker/src/push-audience.js';

const month=(stayMonth,{occupancy=.70,pickup=30}={})=>({stayMonth,otb:{occupancy},pickup:{rns:pickup}});
const snapshot=({businessDate='2026-09-01',revision=1,revenue=500000,occupancy=.70,pickup=30,flags=[]}={})=>({
  businessDate,
  revision,
  fnb:{summary:{daily:{revenue}}},
  rooms:{months:[month(`${businessDate.slice(0,7)}-01`,{occupancy,pickup})]},
  flags
});
const flag=(domain='fnb',scopeKey='outlet-a',metricKey='outlet_revenue')=>({domain,scopeKey,metricKey,severity:'watch'});

// Establishing a baseline never surprises an existing environmental-alert subscriber.
assert.deepEqual(buildBusinessAlertCandidates(null,snapshot()),[]);

// An identical approved publication is silent even if a caller presents mutated values.
assert.deepEqual(buildBusinessAlertCandidates(snapshot(),snapshot({revenue:900000})),[]);

// Small same-day reconciliation revisions remain silent.
assert.deepEqual(
  buildBusinessAlertCandidates(snapshot(),snapshot({revision:2,revenue:510000,occupancy:.715,pickup:38})),
  []
);

// A material same-day change produces one generic candidate, not several lock-screen pushes.
const material=buildBusinessAlertCandidates(
  snapshot(),
  snapshot({revision:2,revenue:540000,occupancy:.735,pickup:55})
);
assert.equal(material.length,1);
assert.equal(material[0].priority,'material');
assert.equal(material[0].audienceTopic,PUSH_TOPICS.businessDashboard);
assert.deepEqual(material[0].changedMetricKeys,['fnb.daily.revenue','rooms.current.occupancy','rooms.current.pickup.rns']);
assert.equal(material[0].dedupeKey,'business-dashboard:2026-09-01:r2:material');
assert.equal(businessAlertDedupeKey(material[0]),material[0].dedupeKey);

// A new business date is notification-worthy even without a large metric movement.
const daily=buildBusinessAlertCandidates(
  snapshot({businessDate:'2026-09-01',revision:4}),
  snapshot({businessDate:'2026-09-02',revision:1,revenue:505000,occupancy:.705,pickup:34})
);
assert.equal(daily.length,1);
assert.equal(daily[0].priority,'daily');
assert.ok(daily[0].reasonKeys.includes('new-business-date'));

// Newly appearing attention items take priority and are deduplicated by publication revision.
const attention=buildBusinessAlertCandidates(
  snapshot({revision:2,flags:[flag('fnb','outlet-a','outlet_revenue')]}),
  snapshot({revision:3,flags:[flag('fnb','outlet-a','outlet_revenue'),flag('rooms','pickup','pickup_rns')]})
);
assert.equal(attention.length,1);
assert.equal(attention[0].priority,'attention');
assert.deepEqual(attention[0].newFlagKeys,['rooms:pickup:pickup_rns']);
assert.equal(attention[0].dedupeKey,'business-dashboard:2026-09-01:r3:attention');

// Persisting flags are not treated as new attention items.
assert.deepEqual(
  buildBusinessAlertCandidates(
    snapshot({revision:3,flags:[flag('rooms','pickup','pickup_rns')]}),
    snapshot({revision:4,revenue:505000,flags:[flag('rooms','pickup','pickup_rns')]})
  ),
  []
);

// Thresholds are policy inputs, not hard-coded product behavior.
const configured=buildBusinessAlertCandidates(
  snapshot(),
  snapshot({revision:2,revenue:512000}),
  {fnbRevenueRelative:.02,fnbRevenueAbsolute:10000}
);
assert.equal(configured.length,1);
assert.equal(configured[0].priority,'material');

// Lock-screen payloads intentionally contain no hotel figures, segment/outlet names or KPIs.
for(const candidate of [...material,...daily,...attention,...configured]){
  const payload=businessAlertPayload(candidate);
  assert.equal(payload.kind,'business-dashboard-update');
  assert.equal(payload.tag,'business-dashboard-update');
  assert.equal(payload.route,'/');
  assert.equal(payload.id,candidate.dedupeKey);
  assert.equal(businessAlertPayloadIsLockScreenSafe(payload),true,payload);
  const visible=`${payload.titleEn} ${payload.bodyEn}`;
  for(const confidentialToken of ['500000','540000','70%','73.5%','55 RN','outlet-a','pickup_rns']){
    assert.equal(visible.includes(confidentialToken),false,`Lock-screen payload leaked ${confidentialToken}`);
  }
}

// Existing subscriptions are environmental-only. Business delivery requires explicit, authorized opt-in.
const legacy={endpoint:'https://push.example/legacy'};
const environmentOnly={endpoint:'https://push.example/environment',topics:['environment']};
const business={endpoint:'https://push.example/business',topics:['business-dashboard']};
const both={endpoint:'https://push.example/both',topics:'["environment","business-dashboard"]'};
assert.deepEqual(topicsForStoredSubscription(legacy),['environment']);
assert.deepEqual(selectBusinessDashboardAudience([legacy,environmentOnly,business,both]).map(row=>row.endpoint),[business.endpoint,both.endpoint]);
assert.deepEqual(requestedTopicsForSubscription(['environment','business-dashboard'],{allowBusinessDashboard:false}),['environment']);
assert.deepEqual(requestedTopicsForSubscription(['environment','business-dashboard'],{allowBusinessDashboard:true}),['business-dashboard','environment']);
assert.equal(businessDashboardTopicCanBeAdded({authenticated:true,hasReadCapability:true,explicitOptIn:true}),true);
assert.equal(businessDashboardTopicCanBeAdded({authenticated:true,hasReadCapability:true,explicitOptIn:false}),false);
assert.equal(businessDashboardTopicCanBeAdded({authenticated:true,hasReadCapability:false,explicitOptIn:true}),false);
assert.equal(businessDashboardTopicCanBeAdded({authenticated:false,hasReadCapability:true,explicitOptIn:true}),false);

console.log(JSON.stringify({ok:true,cases:12,policy:'privacy-safe-explicit-opt-in-preview-only'}));
