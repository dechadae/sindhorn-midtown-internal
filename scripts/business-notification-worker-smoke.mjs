import {businessUpdatePayload,normalizeBusinessUpdate,secureTokenEqual} from '../worker/src/index.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const fnb=normalizeBusinessUpdate({id:'business:run-12345678',domain:'fnb',businessDate:'2026-08-31',publishedAt:'2026-08-31T03:15:00Z',revision:3,summaryEn:'F&B report updated with synthetic preview values.'});
assert(fnb,'F&B update should normalize');
const fnbPayload=businessUpdatePayload(fnb);
assert(fnbPayload.kind==='business-fnb-update','F&B kind mismatch');
assert(fnbPayload.titleEn==='F&B REPORT UPDATED','F&B title mismatch');
assert(fnbPayload.route==='/'&&fnbPayload.id===fnb.id,'F&B route/id mismatch');
assert(fnbPayload.tag.includes(fnb.id),'F&B tag must be publication-specific');

const rooms=normalizeBusinessUpdate({id:'business:run-rooms-1234',domain:'rooms',businessDate:'2026-08-31',publishedAt:'2026-08-31T03:16:00Z',summaryEn:''});
assert(rooms,'Rooms update should normalize');
const roomsPayload=businessUpdatePayload(rooms);
assert(roomsPayload.kind==='business-rooms-update','Rooms kind mismatch');
assert(roomsPayload.titleEn==='ROOMS REPORT UPDATED','Rooms title mismatch');
assert(roomsPayload.bodyEn.includes('2026-08-31'),'Rooms fallback body should carry business date');

const both=normalizeBusinessUpdate({id:'business:run-both-12345',domain:'both',businessDate:'2026-08-31',publishedAt:'2026-08-31T03:17:00Z',revision:2,summaryEn:'Both reports are current.'});
assert(both,'Combined update should normalize');
const bothPayload=businessUpdatePayload(both);
assert(bothPayload.kind==='business-dashboard-update','Combined kind mismatch');
assert(bothPayload.titleEn==='TODAY BUSINESS REPORT UPDATED','Combined title mismatch');
assert(bothPayload.bodyEn==='Both reports are current.','Combined summary mismatch');

assert(normalizeBusinessUpdate({id:'short',domain:'fnb',businessDate:'2026-08-31',publishedAt:new Date().toISOString()})===null,'Short id must fail');
assert(normalizeBusinessUpdate({id:'business:run-12345678',domain:'sales',businessDate:'2026-08-31',publishedAt:new Date().toISOString()})===null,'Unknown domain must fail');
assert(normalizeBusinessUpdate({id:'business:run-12345678',domain:'rooms',businessDate:'31-08-2026',publishedAt:new Date().toISOString()})===null,'Invalid date must fail');
assert(normalizeBusinessUpdate({id:'business:run-12345678',domain:'rooms',businessDate:'2026-08-31',publishedAt:'invalid'})===null,'Invalid timestamp must fail');
assert(secureTokenEqual('preview-secret','preview-secret')===true,'Equal secret must pass');
assert(secureTokenEqual('preview-secret','different-secret')===false,'Different secret must fail');
assert(secureTokenEqual('','')===false,'Empty secret must fail');

console.log(JSON.stringify({ok:true,kinds:[fnbPayload.kind,roomsPayload.kind,bothPayload.kind],route:fnbPayload.route,dedupIdentity:fnbPayload.id}));

/* Broadcast push (r16b): the database bridge posts a reduced broadcast; the
   Worker accepts only a well-formed one and never invents content. */
import {normalizeBroadcastPush,broadcastPushPayload} from '../worker/src/index.js';
const id='6f1d2c3b-4a5e-4f60-8b7c-9d0e1f2a3b4c';
const plain=normalizeBroadcastPush({id:id.toUpperCase(),titleEn:'  Lobby lifts serviced   Tuesday ',bodyEn:'Use the service lifts 09:00-11:00.',sensitive:false,priority:'high',publishedAt:'2026-09-05T02:00:00Z'});
assert(plain&&plain.id===id&&plain.titleEn==='Lobby lifts serviced Tuesday','Broadcast should normalize id and whitespace');
const plainPayload=broadcastPushPayload(plain);
assert(plainPayload.kind==='broadcast'&&plainPayload.route==='/messages'&&plainPayload.tag===`broadcast:${id}`&&plainPayload.id===id,'Broadcast payload identity mismatch');
assert(plainPayload.bodyEn==='Use the service lifts 09:00-11:00.'&&plainPayload.requireInteraction===false,'Broadcast body should pass through');
const sensitive=normalizeBroadcastPush({id,titleEn:'Payroll timing',bodyEn:null,sensitive:true,priority:'urgent',publishedAt:'2026-09-05T02:00:00Z'});
assert(sensitive&&sensitive.bodyEn===''&&sensitive.sensitive===true,'Sensitive broadcast arrives without a body');
const sensitivePayload=broadcastPushPayload(sensitive);
assert(sensitivePayload.bodyEn==='Open Messages to read it.'&&sensitivePayload.requireInteraction===true,'Sensitive broadcast pushes the title with a neutral body');
assert(normalizeBroadcastPush({id:'not-a-uuid',titleEn:'x',publishedAt:'2026-09-05T02:00:00Z'})===null,'Broadcast id must be a uuid');
assert(normalizeBroadcastPush({id,titleEn:'',publishedAt:'2026-09-05T02:00:00Z'})===null,'Broadcast title is required');
assert(normalizeBroadcastPush({id,titleEn:'x'.repeat(121),publishedAt:'2026-09-05T02:00:00Z'})===null,'Broadcast title is capped');
assert(normalizeBroadcastPush({id,titleEn:'x',bodyEn:'y'.repeat(241),publishedAt:'2026-09-05T02:00:00Z'})===null,'Broadcast body is capped');
assert(normalizeBroadcastPush({id,titleEn:'x',priority:'loud',publishedAt:'2026-09-05T02:00:00Z'})===null,'Unknown priority must fail');
assert(normalizeBroadcastPush({id,titleEn:'x',publishedAt:'yesterday'})===null,'Invalid broadcast timestamp must fail');
console.log(JSON.stringify({ok:true,broadcast:{kind:plainPayload.kind,route:plainPayload.route,dedupIdentity:plainPayload.id}}));
