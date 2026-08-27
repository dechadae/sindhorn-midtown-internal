from pathlib import Path
import re

path = Path("site/fnb-promotions-review.html")
s = path.read_text(encoding="utf-8")

if "F&B Review v5" in s:
    raise SystemExit(0)

# Remove the Promotions / Artwork view switch from the index.
new_s, count = re.subn(r'\n\s*<div class="view-switch">.*?</div>\s*\n', '\n', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Could not remove view switch")
s = new_s

# Move artwork-folder controls out of Overview and place them after the artwork checklist.
overview_fragment = '''      ${folderControls(c)}\n    </div>\n    <section class="detail-section" id="brief">'''
if overview_fragment not in s:
    raise SystemExit("Overview folder fragment not found")
s = s.replace(overview_fragment, '''    </div>\n    <section class="detail-section" id="brief">''', 1)

artwork_fragment = '''      ${c.activations.map(activationBlock).join("")}\n    </section>\n    <div class="footer-note">'''
if artwork_fragment not in s:
    raise SystemExit("Artwork section fragment not found")
s = s.replace(artwork_fragment, '''      ${c.activations.map(activationBlock).join("")}\n      <div class="artwork-folder-bottom">${folderControls(c)}</div>\n    </section>\n    <div class="footer-note">''', 1)

css = r'''
/* F&B Review v5 — simplified index controls + bottom artwork folder */
.control-block{padding-top:18px}
.view-switch{display:none!important}
.filter-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;margin-top:0!important;grid-auto-rows:52px}
.filter-chip{height:52px!important;min-height:52px!important;padding:6px 7px!important;font-size:10.5px!important;line-height:1.18!important;display:flex;align-items:center;justify-content:center}
.artwork-folder-bottom{margin-top:18px;padding-top:2px}
.artwork-folder-bottom .folder-empty,.artwork-folder-bottom .primary-cta,.artwork-folder-bottom .secondary-cta{margin-top:12px}
@media(max-width:360px){.filter-chip{font-size:9.5px!important;padding-inline:5px!important}}
'''
idx = s.rfind("</style>")
if idx < 0:
    raise SystemExit("Missing closing style tag")
s = s[:idx] + css + s[idx:]

# Marker for deployment validation.
s = s.replace("</head>", "<!-- F&B Review v5 -->\n</head>", 1)

path.write_text(s, encoding="utf-8")
