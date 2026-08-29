from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"expected source not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Login: keep the accent rule at the top, move the hotel logo to the bottom center,
# and use the same numeric keyboard hint as the six PIN inputs.
replace_once("site/login.html", "/auth-brand.css?v=3", "/auth-brand.css?v=4")
replace_once(
    "site/login.html",
    ''' <div class="brand-row">\n <img class="brand-logo" src="/assets/brand/sindhorn-midtown-vignette-white.png" alt="Sindhorn Midtown Hotel Bangkok, Vignette Collection">\n</div>\n\n <p class="eyebrow"''',
    ''' <div class="brand-rule" aria-hidden="true"></div>\n\n <p class="eyebrow"''',
)
replace_once(
    "site/login.html",
    '<input id="employeeNumber" name="employeeNumber" inputmode="text" autocomplete="username" maxlength="64" required>',
    '<input id="employeeNumber" name="employeeNumber" inputmode="numeric" pattern="[0-9]*" autocomplete="username" maxlength="64" required>',
)
replace_once(
    "site/login.html",
    ''' <button id="signOutButton" type="button" data-i18n="signOut">Sign out</button>\n</div>\n</section>\n</section>\n</main>''',
    ''' <button id="signOutButton" type="button" data-i18n="signOut">Sign out</button>\n</div>\n</section>\n\n <div class="brand-row brand-row-bottom">\n <img class="brand-logo" src="/assets/brand/sindhorn-midtown-vignette-white.png" alt="Sindhorn Midtown Hotel Bangkok, Vignette Collection">\n </div>\n</section>\n</main>''',
)

css = Path("site/auth-brand.css")
text = css.read_text()
marker = "/* 2026-08-30 login bottom-brand refinement */"
if marker not in text:
    text += r'''

/* 2026-08-30 login bottom-brand refinement */
.login-page .brand-rule{height:3px;margin:0;background:var(--vg-accent);border-radius:999px}
.login-page .brand-row-bottom{
  display:flex;align-items:center;justify-content:center;min-height:0;margin:clamp(44px,8vh,76px) 0 0;padding:0 0 4px;border:0
}
.login-page .brand-row-bottom .brand-logo{width:132px;max-width:42vw;height:auto;opacity:.96}
@media(max-width:520px){
  .login-page .brand-row-bottom{margin-top:52px;padding-bottom:2px}
  .login-page .brand-row-bottom .brand-logo{width:124px}
}
'''
    css.write_text(text)

# Settings People editor: expose the existing canonical position_title and save it
# through the additive v3 admin RPCs.
replace_once(
    "site/settings.js",
    '<div class="settings-field"><label>Employee ID</label><input data-employee-number maxlength="64" required autocomplete="off"></div>',
    '<div class="settings-field"><label>Employee ID</label><input data-employee-number inputmode="numeric" pattern="[0-9]*" maxlength="64" required autocomplete="off"></div>',
)
replace_once(
    "site/settings.js",
    '<div class="settings-field"><label>Display name</label><input data-display-name maxlength="160"></div>\n            <div class="settings-field settings-full"><label>Hotel work email',
    '<div class="settings-field"><label>Display name</label><input data-display-name maxlength="160"></div>\n            <div class="settings-field settings-full"><label>Position</label><input data-position-title maxlength="160" autocomplete="organization-title"></div>\n            <div class="settings-field settings-full"><label>Hotel work email',
)
replace_once(
    "site/settings.js",
    "$('[data-display-name]').value=user?.display_name||'';$('[data-work-email]').value=user?.work_email||'';",
    "$('[data-display-name]').value=user?.display_name||'';$('[data-position-title]').value=user?.position_title||'';$('[data-work-email]').value=user?.work_email||'';",
)
replace_once(
    "site/settings.js",
    "displayName:$('[data-display-name]').value.trim(),workEmail:$('[data-work-email]').value.trim()",
    "displayName:$('[data-display-name]').value.trim(),positionTitle:$('[data-position-title]').value.trim(),workEmail:$('[data-work-email]').value.trim()",
)
replace_once(
    "site/settings.js",
    "p_display_name:payload.displayName||null,p_work_email:payload.workEmail||null",
    "p_display_name:payload.displayName||null,p_work_email:payload.workEmail||null,p_position_title:payload.positionTitle||null",
)
replace_once(
    "site/settings.js",
    "editing?'sindhorn_admin_update_employee_v2':'sindhorn_admin_create_employee_v2'",
    "editing?'sindhorn_admin_update_employee_v3':'sindhorn_admin_create_employee_v3'",
)

# Browser gate: verify the logo is after the login controls and Employee ID asks for
# the numeric keyboard while retaining the existing visual and History checks.
replace_once(
    "scripts/login-profile-history-browser-smoke.mjs",
    "logo:document.querySelector('.brand-logo')?.getAttribute('src')||'',\n        bodyBackground:body.backgroundImage,",
    "logo:document.querySelector('.brand-logo')?.getAttribute('src')||'',\n        employeeInputMode:document.querySelector('#employeeNumber')?.inputMode||'',\n        employeePattern:document.querySelector('#employeeNumber')?.getAttribute('pattern')||'',\n        logoTop:document.querySelector('.brand-row-bottom')?.getBoundingClientRect().top??-1,\n        controlsBottom:document.querySelector('#loginControls')?.getBoundingClientRect().bottom??-1,\n        bodyBackground:body.backgroundImage,",
)
replace_once(
    "scripts/login-profile-history-browser-smoke.mjs",
    "assert(state.logo.includes('vignette-white.png'),`Login is not using white live-shell logo ${state.logo}`);\n    assert(state.bodyBackground.includes('gradient')",
    "assert(state.logo.includes('vignette-white.png'),`Login is not using white live-shell logo ${state.logo}`);\n    assert(state.employeeInputMode==='numeric'&&state.employeePattern==='[0-9]*',`Employee ID should request numeric keyboard ${JSON.stringify(state)}`);\n    assert(state.logoTop>state.controlsBottom,`Hotel logo must sit below the sign-in panel ${JSON.stringify(state)}`);\n    assert(state.bodyBackground.includes('gradient')",
)
replace_once(
    "scripts/login-profile-history-browser-smoke.mjs",
    "console.log(JSON.stringify({ok:true,login:'static dark live-shell styling',profile:",
    "console.log(JSON.stringify({ok:true,login:'static dark live-shell styling + bottom logo + numeric Employee ID',profile:",
)

# Strengthen the branch preview gate for the new UI/RPC contract.
wf = Path(".github/workflows/login-profile-history-preview.yml")
text = wf.read_text()
text = text.replace("grep -q '/auth-brand.css?v=3' site/login.html", "grep -q '/auth-brand.css?v=4' site/login.html")
text = text.replace("grep -q '2026-08-30 live-shell login alignment' site/auth-brand.css", "grep -q '2026-08-30 live-shell login alignment' site/auth-brand.css\n          grep -q '2026-08-30 login bottom-brand refinement' site/auth-brand.css\n          grep -q 'brand-row-bottom' site/login.html\n          grep -q 'inputmode=\"numeric\" pattern=\"[0-9]*\" autocomplete=\"username\"' site/login.html")
text = text.replace("grep -q 'user.position_title' site/settings.js", "grep -q 'user.position_title' site/settings.js\n          grep -q 'data-position-title' site/settings.js\n          grep -q 'sindhorn_admin_update_employee_v3' site/settings.js\n          grep -q 'p_position_title:payload.positionTitle' site/settings.js\n          test -f supabase/migrations/20260829190718_sindhorn_employee_position_admin_rpc_v3.sql")
text = text.replace("grep -q 'vignette-white.png' /tmp/login.html", "grep -q 'vignette-white.png' /tmp/login.html\n          grep -q 'brand-row-bottom' /tmp/login.html\n          grep -q 'inputmode=\"numeric\" pattern=\"[0-9]*\" autocomplete=\"username\"' /tmp/login.html")
text = text.replace("grep -q 'live-shell login alignment' /tmp/auth-brand.css", "grep -q 'live-shell login alignment' /tmp/auth-brand.css\n          grep -q 'login bottom-brand refinement' /tmp/auth-brand.css")
text = text.replace("grep -q \"fact('Department',profile.departmentName\" /tmp/settings.js", "grep -q \"fact('Department',profile.departmentName\" /tmp/settings.js\n          grep -q 'data-position-title' /tmp/settings.js\n          grep -q 'sindhorn_admin_update_employee_v3' /tmp/settings.js")
wf.write_text(text)
