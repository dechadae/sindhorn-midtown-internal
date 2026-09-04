/* Sign in, rebuilt on the UI Library. Same three steps as the legacy
   /login page, same auth-client.js underneath: Employee ID plus permanent
   code; Employee ID plus an administrator's one-time code; then, once a
   one-time code is verified, choosing the permanent code. The router
   mounts this page whenever nobody with a permanent code is signed in and
   re-routes on its own when the session lands, so this page never
   navigates - it only finishes.

   An invitation link is /next#signin?i=<employee>&c=<code>: the fields
   pre-fill, the one-time step opens, and the hash is scrubbed so the code
   is not left in the address bar or history. */
import { getState, signInWithPin, activate, setPermanentPin } from './auth-client.js';
import { bindCode, codeValue, clearCode } from './app-code.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const COPY = {
  eyebrow: 'Internal employee access',
  permanent: { title: 'Employee sign in.', copy: 'Enter your Employee ID and permanent 6-digit code.', code: 'Permanent code', button: 'Sign in', working: 'Signing you in…',
    error: 'Check your Employee ID and permanent code, then try again. If needed, use an administrator one-time code.' },
  onetime: { title: 'Employee sign in.', copy: 'Enter your Employee ID and the one-time code provided by an administrator.', code: 'Administrator one-time code', button: 'Continue', working: 'Checking one-time code…',
    note: 'The administrator code works once and expires after 15 minutes. After verification, you will create a new permanent code.',
    error: 'Check your Employee ID and administrator one-time code, then try again. Ask an administrator for a new code if it has expired.' },
  setpin: { eyebrow: 'Secure your account', title: 'Create your permanent code.', copy: 'Choose a 6-digit code you will use with your Employee ID for future sign-ins.', button: 'Save code & open app', working: 'Saving your permanent code…',
    note: 'Your permanent code is stored only as a secure hash. Five failed attempts temporarily lock PIN sign-in for 15 minutes.',
    mismatch: 'The two permanent codes do not match.' },
  length: 'Enter all 6 digits of your permanent code.',
  generic: 'Sign-in could not be completed. Please try again.',
  switchToOnetime: 'First time or forgot your code? Use an administrator one-time code.',
  switchToPermanent: 'Back to permanent code sign in'
};

function codeMarkup(name, label, { autofill = false } = {}) {
  const wells = Array.from({ length: 6 }, (_, i) => `<input type="text" inputmode="numeric" autocomplete="${autofill && i === 0 ? 'one-time-code' : 'off'}" maxlength="${i === 0 ? 6 : 1}" aria-label="${esc(label)}, digit ${i + 1} of 6"${i === 0 ? ` id="signin-${name}"` : ''}>`).join('');
  return `<div class="app-field"><label for="signin-${name}">${esc(label)}</label><div class="app-code" data-code="${name}">${wells}</div></div>`;
}

function markup(mode, { employee = '' } = {}) {
  const c = COPY[mode];
  const hero = `<header class="app-hero"><p class="app-hero-eyebrow">${esc(c.eyebrow || COPY.eyebrow)}</p><h1 class="app-hero-title">${esc(c.title)}</h1><p class="app-hero-copy">${esc(c.copy)}</p></header>`;
  const fields = mode === 'setpin'
    ? `${codeMarkup('pin', 'New permanent code')}${codeMarkup('confirm', 'Confirm permanent code')}`
    : `<div class="app-field"><label for="signin-employee">Employee ID</label><input id="signin-employee" name="employee" type="text" inputmode="numeric" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(employee)}" required></div>${codeMarkup('code', c.code, { autofill: mode === 'onetime' })}`;
  const note = c.note ? `<p class="app-note">${esc(c.note)}</p>` : '';
  const utility = mode === 'permanent' ? `<div class="app-utility-row"><button class="app-utility-action" type="button" data-signin-mode="onetime">${esc(COPY.switchToOnetime)}</button></div>`
    : mode === 'onetime' ? `<div class="app-utility-row"><button class="app-utility-action" type="button" data-signin-mode="permanent">${esc(COPY.switchToPermanent)}</button></div>` : '';
  const help = mode === 'setpin' ? '' : `<div class="app-disclosure" data-disclosure data-open="false">
    <button class="app-disclosure-button" type="button" aria-expanded="false"><div class="app-disclosure-head"><p class="app-disclosure-kicker">First time here?</p><p class="app-disclosure-title">How access works</p></div><svg class="app-disclosure-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6"/></svg></button>
    <div class="app-disclosure-panel"><div class="app-disclosure-panel-inner"><div class="app-disclosure-detail"><ul>
      <li>Ask an administrator for a one-time code. It works once and expires after 15 minutes.</li>
      <li>Enter your Employee ID and that code here.</li>
      <li>Choose a permanent 6-digit code. It is stored only as a secure hash.</li>
      <li>From then on, sign in with your Employee ID and permanent code.</li>
    </ul></div></div></div></div>`;
  return `${hero}<section class="app-section"><div class="app-stack">
    <form class="app-card app-surface" data-signin-form novalidate><div class="app-stack">
      ${fields}
      <div class="app-field" data-tone="error" data-signin-error hidden><p class="app-field-note"></p></div>
      <button class="app-primary app-control" type="submit" data-width="full" data-signin-submit>${esc(c.button)}</button>
      ${note}
    </div></form>
    ${utility}${help}
  </div></section>`;
}

function invitation() {
  const query = (location.hash.match(/^#signin\?(.*)$/) || [])[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const employee = (params.get('i') || '').trim(), code = (params.get('c') || '').replace(/\D/g, '').slice(0, 6);
  history.replaceState(null, '', `${location.pathname}${location.search}#signin`);
  return employee || code ? { employee, code } : null;
}

export async function mountSignin(host) {
  let alive = true, mode = 'permanent', employee = '', busy = false;
  const state = getState();
  if (state.authenticated && !state.profile?.pin_configured_at) mode = 'setpin';
  const invite = invitation();
  if (invite && mode !== 'setpin') { mode = 'onetime'; employee = invite.employee; }

  const unbindCode = bindCode(host);
  const controller = new AbortController();
  const { signal } = controller;

  const form = () => host.querySelector('[data-signin-form]');
  const showError = message => {
    const box = host.querySelector('[data-signin-error]');
    if (!box) return;
    box.hidden = !message;
    box.querySelector('p').textContent = message || '';
  };
  const setBusy = (on, label) => {
    busy = on;
    const button = host.querySelector('[data-signin-submit]');
    if (!button) return;
    button.disabled = on;
    button.textContent = on ? label : COPY[mode].button;
    for (const input of form().querySelectorAll('input')) input.disabled = on;
  };

  const render = () => {
    host.innerHTML = markup(mode, { employee });
    if (invite?.code && mode === 'onetime') {
      const group = host.querySelector('[data-code="code"]');
      Array.from(group.querySelectorAll('input')).forEach((well, i) => { well.value = invite.code[i] || ''; });
    }
    const first = mode === 'setpin' ? host.querySelector('#signin-pin') : employee ? host.querySelector('#signin-code') : host.querySelector('#signin-employee');
    if (mode === 'onetime' && invite?.code) host.querySelector('[data-signin-submit]')?.focus(); else first?.focus({ preventScroll: true });
  };

  async function submit() {
    if (busy) return;
    showError('');
    try {
      if (mode === 'setpin') {
        const pin = codeValue(host.querySelector('[data-code="pin"]')), confirm = codeValue(host.querySelector('[data-code="confirm"]'));
        if (!pin || !confirm) { showError(COPY.length); return; }
        if (pin !== confirm) { showError(COPY.setpin.mismatch); clearCode(host.querySelector('[data-code="confirm"]'), { focus: true }); return; }
        setBusy(true, COPY.setpin.working);
        await setPermanentPin(pin);
        return; // the profile refresh re-routes the shell
      }
      employee = host.querySelector('#signin-employee')?.value.trim() || '';
      const code = codeValue(host.querySelector('[data-code="code"]'));
      if (!employee) { host.querySelector('#signin-employee')?.focus(); return; }
      if (!code) { showError(COPY.length); return; }
      setBusy(true, COPY[mode].working);
      if (mode === 'permanent') { await signInWithPin(employee, code); return; }
      await activate(employee, code);
      if (!alive) return;
      const now = getState();
      if (now.profile?.pin_configured_at) return; // already has a code; the shell re-routes
      mode = 'setpin'; busy = false; render();
    } catch (error) {
      if (!alive) return;
      setBusy(false);
      const code = error?.code || error?.payload?.error || '';
      showError(code === 'pin_invalid' ? COPY.permanent.error : code === 'activation_invalid' || code === 'too_many_attempts' ? COPY.onetime.error : COPY.generic);
      const group = host.querySelector(mode === 'setpin' ? '[data-code="confirm"]' : '[data-code="code"]');
      if (group) clearCode(group, { focus: true });
    }
  }

  host.addEventListener('submit', event => { if (event.target.closest('[data-signin-form]')) { event.preventDefault(); submit(); } }, { signal });
  host.addEventListener('app-code-complete', event => {
    const group = event.target.closest('[data-code]');
    if (!group || busy) return;
    if (mode !== 'setpin' && host.querySelector('#signin-employee')?.value.trim()) submit();
    else if (mode === 'setpin' && group.dataset.code === 'pin') host.querySelector('#signin-confirm')?.focus();
    else if (mode === 'setpin' && group.dataset.code === 'confirm') submit();
  }, { signal });
  host.addEventListener('click', event => {
    const switcher = event.target.closest('[data-signin-mode]');
    if (switcher) { mode = switcher.dataset.signinMode; employee = host.querySelector('#signin-employee')?.value.trim() || employee; render(); return; }
    const disclosure = event.target.closest('[data-disclosure]');
    if (disclosure && event.target.closest('.app-disclosure-button')) {
      const open = disclosure.dataset.open === 'true';
      disclosure.dataset.open = String(!open);
      disclosure.querySelector('.app-disclosure-button').setAttribute('aria-expanded', String(!open));
    }
  }, { signal });

  render();
  return () => { alive = false; controller.abort(); unbindCode(); };
}
