from pathlib import Path

p=Path('site/index.html')
s=p.read_text()

replacements={
    '<a class="skip" href="#report">Skip to air quality report / ไปยังรายงานคุณภาพอากาศ</a>':
    '<a class="skip" href="#report"><span lang="th">ไปยังรายงานคุณภาพอากาศ</span> / Skip to air quality report</a>',
    '<p class="guidance-lead"><span id="guidanceEn">Retrieving the latest official reading.</span><span lang="th" id="guidanceTh">กำลังเรียกข้อมูลล่าสุดจากแหล่งข้อมูลทางการ</span></p>':
    '<p class="guidance-lead instruction-copy"><span class="instruction-th" lang="th" id="guidanceTh">กำลังเรียกข้อมูลล่าสุดจากแหล่งข้อมูลทางการ</span><span class="instruction-en" id="guidanceEn">Retrieving the latest official reading.</span></p>',
    '<p><span id="everyoneEn">Please wait for the latest reading.</span><span lang="th" id="everyoneTh">โปรดรอข้อมูลล่าสุด</span></p>':
    '<p class="instruction-copy"><span class="instruction-th" lang="th" id="everyoneTh">โปรดรอข้อมูลล่าสุด</span><span class="instruction-en" id="everyoneEn">Please wait for the latest reading.</span></p>',
    '<p><span id="sensitiveEn">Please wait for the latest reading.</span><span lang="th" id="sensitiveTh">โปรดรอข้อมูลล่าสุด</span></p>':
    '<p class="instruction-copy"><span class="instruction-th" lang="th" id="sensitiveTh">โปรดรอข้อมูลล่าสุด</span><span class="instruction-en" id="sensitiveEn">Please wait for the latest reading.</span></p>',
    '<p class="disclaimer">This report provides general air-quality information and is not medical advice. Data may be delayed during monitoring-system maintenance. <span lang="th">รายงานนี้เป็นข้อมูลคุณภาพอากาศทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ และข้อมูลอาจล่าช้าในช่วงบำรุงรักษาระบบตรวจวัด</span></p>':
    '<p class="disclaimer instruction-copy"><span class="instruction-th" lang="th">รายงานนี้เป็นข้อมูลคุณภาพอากาศทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ และข้อมูลอาจล่าช้าในช่วงบำรุงรักษาระบบตรวจวัด</span><span class="instruction-en">This report provides general air-quality information and is not medical advice. Data may be delayed during monitoring-system maintenance.</span></p>'
}
for old,new in replacements.items():
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'Expected exactly one source block, found {count}: {old[:80]}')
    s=s.replace(old,new,1)
p.write_text(s)

p=Path('site/ci-ui.css')
css=p.read_text()
marker='/* v11 bilingual hierarchy — English typography remains eminent. */'
if marker in css:
    raise SystemExit('v11 hierarchy already present')
css += '''

/* v11 bilingual hierarchy — English typography remains eminent.
   English owns brand/editorial structure. Thai leads only where comprehension,
   health, warning or recovery instructions are the primary job. */
body.environment-ready .instruction-copy .instruction-th{
  display:block!important;
  margin:0!important;
  color:var(--sm-text)!important;
  font-family:"IBM Plex Sans Thai","Noto Sans Thai",sans-serif!important;
  font-size:1em!important;
  font-weight:400!important;
  letter-spacing:0!important;
  line-height:1.58!important;
  text-transform:none!important;
}
body.environment-ready .instruction-copy .instruction-en{
  display:block!important;
  margin-top:6px!important;
  color:var(--sm-muted)!important;
  font-family:"Vignette Sans","Trebuchet MS",sans-serif!important;
  font-size:.88em!important;
  font-weight:300!important;
  letter-spacing:.005em!important;
  line-height:1.5!important;
  text-transform:none!important;
}
body.environment-ready .guidance-lead.instruction-copy{font-size:1.02rem!important}
body.environment-ready .advice p.instruction-copy{font-size:.96rem!important}
body.environment-ready .disclaimer.instruction-copy{font-size:.82rem!important}
body.environment-ready .disclaimer.instruction-copy .instruction-th{color:rgba(250,247,245,.82)!important}
body.environment-ready .disclaimer.instruction-copy .instruction-en{color:rgba(250,247,245,.58)!important}

/* English remains visually eminent in every structural/UI pairing. */
body.environment-ready h1,
body.environment-ready .route-hero h1,
body.environment-ready .category-en{
  font-family:"Vignette Sans","Trebuchet MS",sans-serif!important;
  font-weight:200!important;
}
body.environment-ready .eyebrow,
body.environment-ready .section-title,
body.environment-ready .station strong,
body.environment-ready .aqi-label,
body.environment-ready .weather-condition strong,
body.environment-ready .action,
body.environment-ready .app-footer-kicker{
  font-family:"Vignette Sans","Trebuchet MS",sans-serif!important;
}
@media(max-width:520px){
  body.environment-ready .guidance-lead.instruction-copy{font-size:.92rem!important}
  body.environment-ready .advice p.instruction-copy{font-size:.90rem!important}
  body.environment-ready .instruction-copy .instruction-en{margin-top:4px!important;font-size:.86em!important}
}
'''
p.write_text(css)

p=Path('site/sw.js')
sw=p.read_text()
if 'sindhorn-midtown-internal-pwa-v10.1' not in sw:
    raise SystemExit('Unexpected service-worker version')
p.write_text(sw.replace('sindhorn-midtown-internal-pwa-v10.1','sindhorn-midtown-internal-pwa-v11',1))

p=Path('site/version.txt')
v=p.read_text()
if 'language-hierarchy:' in v:
    raise SystemExit('Language hierarchy already versioned')
v += 'language-hierarchy: english-eminent-thai-first-critical-instructions-v11\n'
p.write_text(v)
