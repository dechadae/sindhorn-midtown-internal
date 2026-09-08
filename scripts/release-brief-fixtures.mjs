/* Synthetic read models for the release brief's signed-in captures (r67).

   Every value here is invented. No employee, guest, message, business figure
   or file from the live project appears, and none may be added: the brief
   runs on a public repository, and the fixtures exist so the pixel diff can
   see a populated list, a two-language dialog, a table with columns and a
   metric grid with deltas - the compositions the signed-out routes never
   render. Which numbers they show is beside the point; that they are the
   same on both sides of the diff is the whole point, so nothing here reads
   the clock or the network.

   The shapes are the RPCs' shapes, taken from the pages that read them
   (business-dashboard-data.js, fnb-read-model.js, jobs-page.js,
   broadcast-inbox.js, settings-*.js). A field a page does not read is left
   out; a field it validates is present and valid. */

const ID = '00000000-0000-0000-0000-00000000000';
const DEPARTMENTS = [
  { id: `${ID}a`, code: 'marcom', name: 'Marketing Communications' },
  { id: `${ID}b`, code: 'rooms', name: 'Rooms Division' },
  { id: `${ID}c`, code: 'fnb', name: 'Food & Beverage' }
];
const BUSINESS_DATE = '2026-09-07', PUBLISHED_AT = '2026-09-07T03:00:00+00:00';

/* The signed-in account: a developer, so every route mounts and Settings
   offers every card. The employee number is outside the hotel's range. */
export const PROFILE = {
  id: `${ID}1`, employee_number: '100001', display_name: 'Brief Developer', role: 'super_admin', account_type: 'developer',
  work_email: 'brief.developer@example.com', department_id: DEPARTMENTS[0].id, position_title: 'Release Brief',
  pin_configured_at: '2026-08-01T00:00:00+00:00', activated_at: '2026-08-01T00:00:00+00:00', active: true, preferred_language: 'en'
};

const manifest = () => ({
  ok: true, version: 2,
  profile: { id: PROFILE.id, role: PROFILE.role, active: true, workEmail: PROFILE.work_email, accountType: PROFILE.account_type, displayName: PROFILE.display_name, departmentId: PROFILE.department_id, pinConfigured: true, positionTitle: PROFILE.position_title, departmentName: DEPARTMENTS[0].name, employeeNumber: PROFILE.employee_number, preferredLanguage: 'en' },
  sections: [
    { key: 'account', label: 'Account', navLabel: 'Account', renderer: 'account', sortOrder: 10, config: { icon: 'account' }, description: 'Profile, preferences, security status and sign out' },
    { key: 'people', label: 'People', navLabel: 'People', renderer: 'people', sortOrder: 20, config: { entities: ['employees', 'departments', 'groups'] }, description: 'Employees, departments and groups' },
    { key: 'comms', label: 'Comms', navLabel: 'Comms', renderer: 'comms', sortOrder: 30, config: { status: 'available' }, description: 'Internal broadcasts and communication controls' },
    { key: 'system', label: 'System', navLabel: 'System', renderer: 'system', sortOrder: 40, config: { includes: ['audit', 'configuration'] }, description: 'Audit and system configuration' }
  ],
  capabilities: ['account.read', 'audit.read', 'broadcasts.manage', 'business_card.manage_self', 'business_card.read', 'business_dashboard.read', 'business_data.manage', 'departments.manage', 'developer.ui_library', 'fnb.edit', 'fnb.read', 'groups.manage', 'jobs.manage', 'jobs.read', 'people.manage', 'people.read', 'private_contacts.manage', 'security.manage', 'settings.read', 'system.manage']
});

/* Today. Three months of rooms, seven headline segments, four outlets with
   three dayparts each, three exceptions, three notes. Numbers are round on
   purpose: they are placeholders for the compositions, not figures. */
const rooms = (occupancy, adr, rns) => ({ occupancy, adr, rns, revpar: Math.round(adr * occupancy), revenue: adr * rns });
const month = (stayMonth, occ, adr, rns) => ({
  stayMonth, sourcePage: 1, validation: {},
  otb: rooms(occ, adr, rns), forecast: rooms(occ + 0.04, adr + 120, rns + 90), budget: rooms(occ + 0.02, adr + 60, rns + 40),
  stly: rooms(occ - 0.05, adr - 200, rns - 110), lastYear: rooms(occ - 0.03, adr - 150, rns - 60),
  pickup: { adr: adr - 40, rns: 24, revenue: (adr - 40) * 24 }, otbVsStly: { adr: 200, rns: 110, revenue: 200 * 110 },
  forecastRemaining: { adr: adr + 80, rns: 90, revenue: (adr + 80) * 90, revenuePerDay: (adr + 80) * 3 },
  historicalRemainingToActualLy: { adr: adr - 100, rns: 70, revenue: (adr - 100) * 70, revenuePerDay: (adr - 100) * 2 }
});
const segment = ([key, code, label, rns, adr]) => ({
  key, code, label, level: 0, parentKey: null, stayMonth: `${BUSINESS_DATE.slice(0, 7)}-01`, isSubtotal: true, isGrandTotal: false, includedInGrandTotal: true, validation: {},
  otb: { rns, adr, revenue: rns * adr }, forecast: { rns: rns + 30, adr: adr + 100, revenue: (rns + 30) * (adr + 100) }, budget: { rns: rns + 20, adr: adr + 50, revenue: (rns + 20) * (adr + 50) },
  stly: { rns: rns - 40, adr: adr - 150, revenue: (rns - 40) * (adr - 150) }, lastYear: { rns: rns - 20, adr: adr - 100, revenue: (rns - 20) * (adr - 100) },
  pickup: { rns: 6, adr, revenue: 6 * adr }, forecastRemaining: { rns: 30, adr: adr + 100, revenue: 30 * (adr + 100) }
});
const daypart = ([key, label], covers, revenue) => ({ key, label, covers, revenue, foodNet: Math.round(revenue * 0.7), beverageNet: Math.round(revenue * 0.3), foodGross: Math.round(revenue * 0.75), beverageGross: Math.round(revenue * 0.32), other: null, otherDiscount: 0, amenities: null, foodDiscount: null, beverageDiscount: null, nonAlcoholGross: null, nonAlcoholDiscount: null, contactlessOrders: null });
const outlet = ([key, label], covers, revenue) => {
  const parts = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']].map((part, i) => daypart(part, Math.round(covers * [0.5, 0.2, 0.3][i]), Math.round(revenue * [0.3, 0.25, 0.45][i])));
  return { key, label, covers, revenue, forecast: revenue + 20000, variance: -20000, foodNet: Math.round(revenue * 0.7), beverageNet: Math.round(revenue * 0.3), foodGross: Math.round(revenue * 0.75), beverageGross: Math.round(revenue * 0.32), other: null, otherDiscount: 0, foodDiscount: null, beverageDiscount: null, nonAlcoholGross: null, nonAlcoholDiscount: null, dayparts: parts, validation: {} };
};
const summary = (covers, revenue) => ({ covers, revenue, food: Math.round(revenue * 0.7), beverage: Math.round(revenue * 0.3), other: 0, forecast: revenue + 40000, variance: -40000, coverForecast: covers + 40, foodForecast: Math.round(revenue * 0.72), beverageForecast: Math.round(revenue * 0.31), otherForecast: 0, otherDiscount: 0 });
const OUTLETS = [[['bangkok78', 'Bangkok\'78'], 180, 240000], [['sip', 'Sip & Co.'], 120, 96000], [['anju', 'Anju'], 90, 150000], [['lobby', 'The Lobby Lounge'], 60, 48000]];
const dashboard = () => ({
  businessDate: BUSINESS_DATE, publishedAt: PUBLISHED_AT, importedAt: PUBLISHED_AT, revision: 3, runId: `${ID}9`, validationStatus: 'passed_with_warnings',
  rooms: {
    months: [month('2026-09-01', 0.72, 4200, 620), month('2026-10-01', 0.61, 4500, 540), month('2026-11-01', 0.48, 4800, 410)],
    segments: [['transient', 'T', 'Transient', 260, 4600], ['corporate', 'C', 'Corporate', 140, 3900], ['wholesale', 'W', 'Wholesale', 90, 3200], ['package', 'P', 'Package', 60, 4100], ['pnp_disc', 'D', 'Promotional', 30, 3600], ['group', 'G', 'Group', 30, 3400], ['airline_crew', 'A', 'Airline crew', 10, 2800]].map(segment)
  },
  fnb: {
    summary: { daily: summary(450, 534000), mtd: summary(3100, 3720000), validation: { statedDailyCovers: 450, statedMtdCovers: 3100, coversNormalizedFromDayparts: true } },
    outlets: OUTLETS.map(([id, covers, revenue]) => outlet(id, covers, revenue)),
    notes: [
      { outletKey: 'bangkok78', outlet: 'Bangkok\'78', daypartKey: 'dinner', daypart: 'Dinner', sourceCell: 'T10', rawText: 'Set dinner for a tour group of 40.', displayText: 'Set dinner for a tour group of 40.' },
      { outletKey: 'anju', outlet: 'Anju', daypartKey: 'dinner', daypart: 'Dinner', sourceCell: 'T32', rawText: 'Private room booked, 12 covers.', displayText: 'Private room booked, 12 covers.' },
      { outletKey: 'lobby', outlet: 'The Lobby Lounge', daypartKey: 'lunch', daypart: 'Lunch', sourceCell: 'T24', rawText: 'Afternoon tea trial menu.', displayText: 'Afternoon tea trial menu.' }
    ]
  },
  flags: [
    { domain: 'fnb', severity: 'warning', ruleKey: 'fnb_total_below_forecast', scopeKey: 'total', metricKey: 'daily_revenue', title: 'F&B is below daily forecast', detail: 'Daily revenue is behind forecast.', payload: { actual: 534000, forecast: 574000, variance: -40000, variancePct: -7 } },
    { domain: 'fnb', severity: 'watch', ruleKey: 'fnb_outlet_below_forecast', scopeKey: 'anju', metricKey: 'daily_revenue', title: 'Anju is below forecast', detail: 'Outlet revenue is behind forecast.', payload: { actual: 150000, forecast: 170000, variance: -20000, variancePct: -11.8 } },
    { domain: 'rooms', severity: 'warning', ruleKey: 'rooms_occupancy_below_forecast', scopeKey: '2026-09', metricKey: 'occupancy', title: 'Rooms occupancy is below forecast', detail: 'On the books is behind forecast.', payload: { actual: 0.72, forecast: 0.76, variance: -0.04, variancePct: -5.3 } }
  ],
  rules: { fnb_total_below_forecast: { negative_pct: 5 }, fnb_outlet_below_forecast: { max_flags: 3, min_forecast: 10000, negative_pct: 10 }, rooms_revenue_below_forecast: { negative_pct: 5 }, rooms_occupancy_below_forecast: { negative_pp: 3 } },
  sources: [
    { type: 'fnb_xlsx', filename: 'fnb-daily-report-synthetic.xlsx', sha256: '0'.repeat(64), byteSize: 100000, sheetCount: 31, pageCount: null, detectedReportDate: '2026-09-06', metadata: { month: 'September', year: 2026 } },
    { type: 'rooms_pdf', filename: 'rooms-pickup-synthetic.pdf', sha256: '1'.repeat(64), byteSize: 200000, sheetCount: null, pageCount: 6, detectedReportDate: BUSINESS_DATE, metadata: {} }
  ],
  validation: { fnb: {}, rooms: { status: 'pass', reportDate: BUSINESS_DATE }, update: { scope: 'both' }, publication: { headlineFields: 'approved' } }
});

/* F&B. Three promotions across the four outlets, one of them with artworks
   so the artwork checklist renders; one Thai copy so the sheet sets Thai. */
const promotion = (id, title, outlets, extra = {}) => ({
  id, title, start: '2026-09-01', end: '2026-10-31', dateLabel: '1 September – 31 October 2026', updatedAt: '2026-08-29T14:00:00',
  summary: `${title} across ${outlets.length} outlet${outlets.length > 1 ? 's' : ''}.`, brief: `Menu\n\n1. ${title} set\n2. Seasonal pairing`, copyEn: `${title} at Sindhorn Midtown - a synthetic promotion for the release brief.`, copyTh: '',
  displayOutlets: outlets, activations: outlets.map(name => ({ id: `${id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, outlet: name, time: '11:30 – 22:00', discount: '20%', brief: '', copyEn: '', copyTh: '', artworks: [], artworkUrl: null })), ...extra
});
const fnb = () => {
  const first = promotion('brief-set-lunch', 'Set Lunch', ['Bangkok\'78', 'Sip & Co.'], { copyTh: 'เซตอาหารกลางวันสำหรับการทดสอบการปล่อยเวอร์ชัน' });
  first.activations[0].artworks = [{ id: 'brief-set-lunch::bangkok78::a4-menu', name: 'A4 Menu', dimensions: 'A4', notes: null }, { id: 'brief-set-lunch::bangkok78::tent-card', name: 'Tent Card', dimensions: 'A6', notes: 'two-sided' }];
  return [first, promotion('brief-tea-time', 'Afternoon Tea', ['The Lobby Lounge']), promotion('brief-omakase', 'Omakase Night', ['Anju'])];
};

/* Jobs: four cards, one per status the tracker knows (jobs-page.js STATUSES). */
const jobs = () => ({
  ok: true, canManage: true, updatedAt: PUBLISHED_AT,
  jobs: [['not-started', 'October social calendar', 'Twelve posts for the outlets, first draft by Friday.'], ['working', 'Lobby wayfinding signs', 'Three totems, two languages, print-ready.'], ['stuck', 'Spa menu reprint', ''], ['done', 'Rooms fact sheet update', 'Figures from the September revision.']]
    .map(([status, title, description], i) => ({ id: `${ID}${i + 2}`, key: `brief-job-${i}`, title, description, status, source: 'inbox-run', sortOrder: i + 1, createdAt: PUBLISHED_AT, updatedAt: PUBLISHED_AT, receivedOn: `2026-09-0${i + 1}`, deadlineOn: `2026-09-${20 + i}`, deadlineNote: i === 1 ? 'Print slot booked' : '', senderName: 'Brief Sender', senderRole: 'Release brief' }))
});

/* Messages: four broadcasts, one in both languages, one pinned, one sensitive
   and one already read, so every row and the two-language dialog render. */
const inbox = () => ({
  ok: true, unread: 3,
  broadcasts: [
    { id: `${ID}5`, titleEn: 'Fire drill on Thursday at 10am', titleTh: 'ซ้อมหนีไฟวันพฤหัสบดี 10:00 น.', bodyEn: 'All departments assemble at the Langsuan gate. Floor wardens carry the red clipboards. The drill lasts about twenty minutes and the all-clear is sounded from the lobby.', bodyTh: 'ทุกแผนกรวมตัวที่ประตูหลังสวน หัวหน้าชั้นถือคลิปบอร์ดสีแดง การซ้อมใช้เวลาประมาณยี่สิบนาที', category: 'safety', priority: 'high', pinned: true, sensitive: false, route: null, publishAt: '2026-09-06T02:00:00+00:00', expiresAt: null, readAt: null },
    { id: `${ID}6`, titleEn: 'October promotion artwork is ready', titleTh: null, bodyEn: 'Preview the new set on the F&B page before it goes to print on Monday.', bodyTh: null, category: 'operations', priority: 'normal', pinned: false, sensitive: false, route: '/fnb', publishAt: '2026-09-05T08:00:00+00:00', expiresAt: null, readAt: null },
    { id: `${ID}7`, titleEn: 'Payroll query window closes Friday', titleTh: null, bodyEn: 'Queries after Friday go into the next cycle.', bodyTh: null, category: 'hr', priority: 'normal', pinned: false, sensitive: true, route: null, publishAt: '2026-09-01T08:00:00+00:00', expiresAt: null, readAt: null },
    { id: `${ID}8`, titleEn: 'Welcome to the Brand page, which now carries the hotel fact sheet with every figure a reservations agent might be asked for', titleTh: null, bodyEn: 'A long title, so the row and the dialog show how one wraps.', bodyTh: null, category: 'hotel_news', priority: 'normal', pinned: false, sensitive: false, route: '/brand', publishAt: '2026-08-28T08:00:00+00:00', expiresAt: null, readAt: '2026-08-29T08:00:00+00:00' }
  ]
});

/* Settings › Admin: three employees across three departments, one inactive. */
const adminUsers = () => ({
  ok: true, actor: { id: PROFILE.id, role: PROFILE.role, account_type: PROFILE.account_type },
  departments: DEPARTMENTS.map(d => ({ id: d.id, code: d.code, name_en: d.name, name_th: null, active: true })),
  users: [
    { ...PROFILE, auth_user_id: `${ID}1`, created_at: '2026-08-01T00:00:00+00:00', updated_at: PUBLISHED_AT, deactivated_at: null, session_count: 2, private_contact: { mobile_e164: '+660000000001', personal_email: 'brief.one@example.com' } },
    { id: `${ID}3`, employee_number: '100002', display_name: 'Brief Reservations', role: 'staff', account_type: 'employee', work_email: 'brief.two@example.com', department_id: DEPARTMENTS[1].id, position_title: 'Reservations Agent', pin_configured_at: null, activated_at: null, active: true, preferred_language: 'th', auth_user_id: null, created_at: '2026-08-15T00:00:00+00:00', updated_at: PUBLISHED_AT, deactivated_at: null, session_count: 0, private_contact: null },
    { id: `${ID}4`, employee_number: '100003', display_name: 'Brief Outlet Manager', role: 'manager', account_type: 'employee', work_email: null, department_id: DEPARTMENTS[2].id, position_title: 'Outlet Manager', pin_configured_at: '2026-08-20T00:00:00+00:00', activated_at: '2026-08-20T00:00:00+00:00', active: false, preferred_language: 'en', auth_user_id: `${ID}4`, created_at: '2026-08-15T00:00:00+00:00', updated_at: PUBLISHED_AT, deactivated_at: '2026-09-01T00:00:00+00:00', session_count: 5, private_contact: null }
  ]
});

/* Settings › Broadcast: the inbox's four, as their author sees them, plus a
   draft and a revoked one. */
const adminBroadcasts = () => ({
  ok: true, actor: { id: PROFILE.id }, groups: [],
  departments: DEPARTMENTS.map(d => ({ id: d.id, name: d.name, nameTh: null, active: true })),
  broadcasts: [
    ...inbox().broadcasts.map(b => ({ ...b, status: 'published', updatedAt: b.publishAt, revokedAt: null, readCount: 12, targets: [{ type: 'everyone' }] })),
    { id: `${ID}c`, titleEn: 'Draft: staff canteen hours', titleTh: null, bodyEn: 'Not yet published.', bodyTh: null, category: 'operations', priority: 'normal', pinned: false, sensitive: false, route: null, status: 'draft', publishAt: null, updatedAt: PUBLISHED_AT, revokedAt: null, readCount: 0, targets: [{ type: 'department', departmentId: DEPARTMENTS[2].id }] },
    { id: `${ID}d`, titleEn: 'Revoked: car park closure', titleTh: null, bodyEn: 'Withdrawn after the date moved.', bodyTh: null, category: 'operations', priority: 'normal', pinned: false, sensitive: false, route: null, status: 'revoked', publishAt: '2026-08-20T08:00:00+00:00', updatedAt: PUBLISHED_AT, revokedAt: '2026-08-21T08:00:00+00:00', readCount: 40, targets: [{ type: 'everyone' }] }
  ]
});

/* Settings › Me: the account's business card, published. */
const cardSelf = () => ({
  ok: true,
  card: { published: true, publicSlug: 'brief0', displayName: PROFILE.display_name, positionTitle: PROFILE.position_title, workEmail: PROFILE.work_email, directPhone: null, businessMobile: null, fieldVisibility: { workEmail: true, hotelPhone: true, directPhone: true, hotelAddress: true, hotelWebsite: true, positionTitle: true, businessMobile: true } },
  hotel: { hotelName: 'Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG', hotelAddress: '68 Soi Langsuan, Lumpini, Pathumwan, Bangkok 10330, Thailand', hotelWebsite: 'https://www.ihg.com/vignettecollection/', hotelLogoPath: '/assets/brand/sindhorn-midtown-vignette-white.png', hotelMainPhone: '+66-2-7968888' }
});

/* RPC name → body. Anything not named here answers [] as before, which is
   every write and the atmosphere periods (the brief pins its own period). */
export const RPC = {
  sindhorn_current_employee_profile: () => PROFILE,
  sindhorn_settings_manifest: manifest,
  sindhorn_business_dashboard_read_model: dashboard,
  sindhorn_fnb_read_model: fnb,
  sindhorn_fnb_artwork_status_read: () => [{ artwork_id: 'brief-set-lunch::bangkok78::a4-menu', done: true }],
  sindhorn_jobs_list_v1: jobs,
  sindhorn_broadcast_inbox_v1: inbox,
  sindhorn_admin_list_users_v3: adminUsers,
  sindhorn_broadcast_list_admin_v1: adminBroadcasts,
  sindhorn_business_card_self: cardSelf
};
