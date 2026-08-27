from pathlib import Path

path = Path("site/fnb-promotions-review.html")
s = path.read_text(encoding="utf-8")

if "F&B Review v4" in s:
    raise SystemExit(0)

def rep(old: str, new: str):
    global s
    if old not in s:
        raise SystemExit(f"Expected source fragment not found: {old[:120]!r}")
    s = s.replace(old, new)

# English-only interface chrome.
rep('<p class="eyebrow">Food &amp; Beverage <span aria-hidden="true">·</span> <span lang="th">อาหารและเครื่องดื่ม</span></p>', '<p class="eyebrow">Food &amp; Beverage</p>')
rep('<h1>Promotions <span lang="th">โปรโมชั่น</span></h1>', '<h1>Promotions</h1>')
rep('<div class="period">SEP — DEC 2026</div>', '<div class="period">September – December 2026</div>')
rep('<p class="eyebrow">Production queue <span aria-hidden="true">·</span> <span lang="th">คิวงานผลิต</span></p>', '<p class="eyebrow">Production queue</p>')
rep('<h1>Artwork <span lang="th">อาร์ตเวิร์ก</span></h1>', '<h1>Artwork</h1>')

# Month filter becomes the sticky index footer. Detail footer follows section order.
rep('''<nav class="detail-rail" id="detailRail" aria-label="Promotion sections">
  <button class="rail-chip on" data-target="overview">Overview</button>
  <button class="rail-chip" data-target="artwork">Artwork</button>
  <button class="rail-chip" data-target="brief">Brief</button>
  <button class="rail-chip" data-target="copy">Copy</button>
</nav>''', '''<nav class="month-rail" id="monthRail" aria-label="Filter promotions by month">
  <button class="month-chip on" data-month="ALL">All</button>
  <button class="month-chip" data-month="SEP">Sep</button>
  <button class="month-chip" data-month="OCT">Oct</button>
  <button class="month-chip" data-month="NOV">Nov</button>
  <button class="month-chip" data-month="DEC">Dec</button>
</nav>

<nav class="detail-rail" id="detailRail" aria-label="Promotion sections">
  <button class="rail-chip on" data-target="overview">Overview</button>
  <button class="rail-chip" data-target="brief">Brief</button>
  <button class="rail-chip" data-target="copy">Copy</button>
  <button class="rail-chip" data-target="artwork">Artwork</button>
</nav>''')

# Date/time display follows the natural wording used in the workbook copy.
for old, new in {
    '01 SEP — 31 DEC 2026': '1 September – 31 December 2026',
    '01 SEP — 31 OCT 2026': '1 September – 31 October 2026',
    '12 SEP 2026': '12 September 2026',
    '21 — 27 SEP 2026': '21 – 27 September 2026',
    '01 — 31 OCT 2026': '1 – 31 October 2026',
    'THROUGHOUT OCT 2026': 'Throughout October 2026',
    '10 — 18 OCT 2026': '10 – 18 October 2026',
    '31 OCT 2026': '31 October 2026',
    '7 PM — 11 PM': '7 pm – 11 pm',
    '5 PM — 2 AM': '5 pm – 2 am',
    '6:30 AM — 12 AM': '6:30 am – 12 am',
    '11 AM — 10 PM': '11 am – 10 pm',
    '7 PM — 12 AM': '7 pm – 12 am',
}.items():
    s = s.replace(old, new)

rep('const missing=lang==="th"?"ไม่มีข้อความภาษาไทยในไฟล์ต้นทาง":"Not supplied in the source workbook.";', 'const missing=lang==="th"?"Thai copy was not supplied in the source workbook.":"Not supplied in the source workbook.";')
rep('`<button class="expand-btn" type="button">Show full <span lang="th">· แสดงทั้งหมด</span></button>`', '`<button class="expand-btn" type="button">Show full</button>`')
s = s.replace('textCard("ไทย",c.copyTh,"th")', 'textCard("Thai",c.copyTh,"th")')
rep("btn.innerHTML='Show less <span lang=\"th\">· ย่อ</span>';", "btn.textContent='Show less';")
rep("btn.innerHTML='Show full <span lang=\"th\">· แสดงทั้งหมด</span>';", "btn.textContent='Show full';")

# Detail hierarchy: overview -> brief -> copy -> artwork.
rep('''    <section class="detail-section" id="artwork">
      <div class="section-top"><h2 class="section-heading">Artwork <span lang="th">อาร์ตเวิร์ก</span></h2><span class="section-count">${n.done} / ${n.total} COMPLETE</span></div>
      ${c.activations.map(activationBlock).join("")}
    </section>
    <section class="detail-section" id="brief">
      <div class="section-top"><h2 class="section-heading">Promotion brief <span lang="th">รายละเอียดโปรโมชั่น</span></h2></div>
      ${briefHTML(c)}
    </section>
    <section class="detail-section" id="copy">
      <div class="section-top"><h2 class="section-heading">Copy <span lang="th">ข้อความ</span></h2></div>
      ${copyHTML(c)}
    </section>''', '''    <section class="detail-section" id="brief">
      <div class="section-top"><h2 class="section-heading">Promotion brief</h2></div>
      ${briefHTML(c)}
    </section>
    <section class="detail-section" id="copy">
      <div class="section-top"><h2 class="section-heading">Copy</h2></div>
      ${copyHTML(c)}
    </section>
    <section class="detail-section" id="artwork">
      <div class="section-top"><h2 class="section-heading">Artwork</h2><span class="section-count">${n.done} / ${n.total} COMPLETE</span></div>
      ${c.activations.map(activationBlock).join("")}
    </section>''')

rep('let filter="ALL", view="promotions", current=null;', 'let filter="ALL", month="ALL", view="promotions", current=null;')
rep('''function filteredCampaigns(){
  return filter==="ALL"?DATA:DATA.filter(c=>c.activations.some(a=>a.outlet===filter));
}''', '''function campaignInMonth(c,key){
  if(key==="ALL")return true;
  const monthNo={SEP:8,OCT:9,NOV:10,DEC:11}[key];
  const start=new Date(c.start+"T00:00:00"),end=new Date(c.end+"T23:59:59");
  const from=new Date(2026,monthNo,1),to=new Date(2026,monthNo+1,0,23,59,59);
  return start<=to&&end>=from;
}
function filteredCampaigns(){
  return DATA.filter(c=>(filter==="ALL"||c.activations.some(a=>a.outlet===filter))&&campaignInMonth(c,month));
}''')

rep('''function renderFilters(){
  const visible=["ALL","ANJU","Bangkok'78","Sip & Co."];
  const host=document.getElementById("indexFilters");
  const hiddenActive=!visible.includes(filter)&&filter!=="ALL";
  host.innerHTML=visible.map(o=>`<button class="filter-chip ${filter===o?"on":""}" data-filter="${esc(o)}">${esc(o)}</button>`).join("")+
    `<button class="filter-chip ${hiddenActive?"on":""}" id="moreFilter">${hiddenActive?esc(filter):"+2"}</button>`;
  host.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderAll()});
  document.getElementById("moreFilter").onclick=openFilterSheet;
}''', '''function renderFilters(){
  const outlets=["ALL","ANJU","Bangkok'78","Sip & Co.","Horizon Pool Bar","The Lobby Lounge"];
  const host=document.getElementById("indexFilters");
  host.innerHTML=outlets.map(o=>`<button class="filter-chip ${filter===o?"on":""}" data-filter="${esc(o)}">${esc(o)}</button>`).join("");
  host.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderAll();animateActiveView()});
}
function renderMonthRail(){
  document.querySelectorAll(".month-chip").forEach(b=>b.classList.toggle("on",b.dataset.month===month));
}
function animateActiveView(){
  const target=document.getElementById(view==="promotions"?"promotionsView":"artworkView");
  target.classList.remove("view-enter");void target.offsetWidth;target.classList.add("view-enter");
}''')

rep('''function renderSummary(){
  const g=globalCounts();
  document.getElementById("indexSummary").innerHTML=`<b>${DATA.length} promotions</b> · ${g.total} artworks · ${g.done} complete`;
}''', '''function renderSummary(){
  const list=filteredCampaigns();
  let total=0,done=0;list.forEach(c=>{const n=taskCounts(c);total+=n.total;done+=n.done});
  document.getElementById("indexSummary").innerHTML=`<b>${list.length} promotion${list.length===1?"":"s"}</b> · ${total} artworks · ${done} complete`;
}''')

s = s.replace('`<div class="text-card"><div class="text-copy">No promotions for this outlet.</div></div>`', '`<div class="text-card"><div class="text-copy">No promotions match these filters.</div></div>`')

rep('''function renderQueue(){
  const list=filteredCampaigns(), g=globalCounts();
  const remaining=g.total-g.done;
  document.getElementById("queueSummary").textContent=`${remaining} remaining · ${g.done} complete · ${g.total} total`;''', '''function renderQueue(){
  const list=filteredCampaigns();
  let total=0,done=0;list.forEach(c=>{const n=taskCounts(c);total+=n.total;done+=n.done});
  const remaining=total-done;
  document.getElementById("queueSummary").textContent=`${remaining} remaining · ${done} complete · ${total} total`;''')

rep('''function renderAll(){
  renderSummary();renderFilters();renderCards();renderQueue();renderView();
}''', '''function renderAll(){
  renderSummary();renderFilters();renderCards();renderQueue();renderView();renderMonthRail();
}''')

s = s.replace('["overview","artwork","brief","copy"].forEach(id=>{const el=document.getElementById(id);if(el)detailObserver.observe(el)});', '["overview","brief","copy","artwork"].forEach(id=>{const el=document.getElementById(id);if(el)detailObserver.observe(el)});')

rep('document.querySelectorAll(".switch-btn").forEach(b=>b.onclick=()=>{', '''document.querySelectorAll(".month-chip").forEach(b=>b.onclick=()=>{
  if(month===b.dataset.month)return;
  month=b.dataset.month;renderAll();animateActiveView();
});

document.querySelectorAll(".switch-btn").forEach(b=>b.onclick=()=>{''')
rep('''  view=b.dataset.view;renderView();
  const target=document.getElementById(view==="promotions"?"promotionsView":"artworkView");
  target.classList.remove("view-enter");void target.offsetWidth;target.classList.add("view-enter");''', '  view=b.dataset.view;renderView();animateActiveView();')

css = r'''
/* F&B Review v4 — month rail, equal location chips, English-only interface */
body:not(.detail-open){padding-bottom:calc(var(--rail) + env(safe-area-inset-bottom,0px))}
.filter-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.filter-chip{width:100%;min-width:0!important;padding-inline:10px!important;text-align:center;white-space:normal;line-height:1.18!important}
.month-rail{position:fixed;z-index:80;left:0;right:0;bottom:0;min-height:var(--rail);display:flex;align-items:center;justify-content:center;gap:6px;padding:9px max(12px,env(safe-area-inset-left)) calc(9px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-right));border-top:1px solid rgba(250,247,245,.14);background:rgba(46,39,59,.92);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3)}
body.detail-open .month-rail{display:none}
.month-chip{position:relative;overflow:hidden;flex:1 1 0;max-width:128px;height:var(--chip-h);min-height:var(--chip-h);padding:0 6px;border:1px solid var(--line-strong);border-radius:999px;background:rgba(250,247,245,.025);color:var(--muted);font-size:.64rem;line-height:1;text-transform:uppercase;cursor:pointer}
.month-chip.on{border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.10);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb),.03)}
.detail-date,.card-date,.queue-sub,.activation-head span,.fact dd{font-variant-numeric:tabular-nums}
.section-heading{display:block}
@media(min-width:560px){.filter-row{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:360px){.month-chip{font-size:.58rem;padding-inline:4px}}
'''
idx = s.rfind("</style>")
if idx < 0:
    raise SystemExit("Missing closing style tag")
s = s[:idx] + css + s[idx:]

for forbidden in (
    'อาหารและเครื่องดื่ม</span>', 'โปรโมชั่น</span>', 'คิวงานผลิต</span>',
    'อาร์ตเวิร์ก</span>', 'รายละเอียดโปรโมชั่น</span>', 'ข้อความ</span>',
    '· แสดงทั้งหมด', '· ย่อ'
):
    if forbidden in s:
        raise SystemExit(f"Thai interface fragment remained: {forbidden}")

path.write_text(s, encoding="utf-8")
