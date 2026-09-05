/* Jobs, on the UI Library. The footer's third tab since r20: every employee's
   own list of what was asked of them - the task, who sent it and when, the
   deadline and where it stands - the Sindhorn counterpart of the Flipgazine
   job board, as rows in sindhorn_jobs instead of one HTML blob.

   Reads and writes go through the sindhorn_jobs_*_v1 RPCs (r21), each of
   which checks the caller's capability and scopes to the caller's own rows:
   jobs.read shows the list, jobs.manage allows add, edit, status and
   archive. Nothing is deleted - an archived job simply leaves the list.

   Everything here is library: a rail of filter chips, one .app-card per job
   with the .app-job layout and its hairline groups, the status control on
   the card opening the sheet standard (r23 - a menu cannot open inside a
   card without nesting glass), the dialog standard with a form grid and the
   shared selector for the status, the confirm dialog before archiving, the
   toast. No class of its own, no material of its own. */
import { supabaseRpc } from './auth-client.js';
import { appSelect, appSelectValue, bindAppSelects } from './app-select.js';
import { openDialog, dialogHead, confirmDialog } from './app-dialog.js';
import { showToast } from './app-toast.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const PLUS_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>';
const CHEVRON_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';

const STATUSES = [['not-started', 'Not started', 'quiet'], ['working', 'Working', ''], ['stuck', 'Stuck', 'danger'], ['done', 'Done', 'success']];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(([key, label]) => [key, label]));
const STATUS_TONE = Object.fromEntries(STATUSES.map(([key, , tone]) => [key, tone]));
const FILTERS = [['open', 'Open'], ['stuck', 'Stuck'], ['done', 'Done'], ['all', 'All']];
const DAY = 86400000;

const hero = action => `<header class="app-hero"><div class="app-hero-head"><p class="app-hero-eyebrow">Jobs</p>${action}</div><h1 class="app-hero-title">Job Tracker</h1><p class="app-hero-copy">What was asked, who sent it, the deadline and where it stands.</p></header>`;
const addAction = `<button class="app-utility-action" type="button" data-job-add>${PLUS_ICON}Add job</button>`;
const line = (width = '', size = '') => `<div class="app-skeleton-line"${width ? ` data-width="${width}"` : ''}${size ? ` data-size="${size}"` : ''}></div>`;
const skeleton = `<article class="app-card app-surface"><div class="app-skeleton" data-gap="tight"><div class="app-job-head">${line('tiny')}${line('tiny')}</div>${line('medium', 'lead')}${line('')}${line('half')}<div class="app-metric-grid" data-columns="2"><div class="app-metric">${line('tiny')}${line('short')}</div><div class="app-metric">${line('tiny')}${line('short')}</div></div></div></article>`;
const state = (label, title, copy, tone = 'empty', attrs = '') => `<div class="app-state app-card" data-tone="${tone}"${attrs}><p class="app-state-label">${esc(label)}</p><p class="app-state-title">${esc(title)}</p>${copy ? `<p class="app-state-copy">${esc(copy)}</p>` : ''}</div>`;
const field = (id, name, label, value, { type = 'text', note = '', required = false, maxlength = 160, span = '' } = {}) =>
  `<div class="app-field"${span ? ` data-span="${span}"` : ''}><label for="${id}">${esc(label)}${note ? ` <span>${esc(note)}</span>` : ''}</label><input id="${id}" name="${name}" type="${type}" value="${esc(value ?? '')}" maxlength="${maxlength}" autocomplete="off"${required ? ' required' : ''}></div>`;
const textarea = (id, name, label, value) => `<div class="app-field" data-span="full"><label for="${id}">${esc(label)}</label><textarea id="${id}" name="${name}" rows="4" maxlength="4000">${esc(value ?? '')}</textarea></div>`;

/* Dates travel as ISO days and read as "8 Sep 2026". */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = iso => { if (!iso) return ''; const d = new Date(`${iso}T00:00:00`); return Number.isNaN(d.getTime()) ? String(iso) : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const stampLabel = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const daysUntil = iso => { if (!iso) return null; const d = new Date(`${iso}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); return Math.round((d - today) / DAY); };
/* A tight deadline is within the week, or already past, on a job not done. */
const isTight = job => { const days = daysUntil(job.deadlineOn); return job.status !== 'done' && days !== null && days <= 7; };
const deadlineValue = job => {
  if (!job.deadlineOn) return job.deadlineNote ? job.deadlineNote : 'No date';
  const days = daysUntil(job.deadlineOn);
  if (job.status !== 'done' && days !== null && days < 0) return `${dayLabel(job.deadlineOn)} · overdue`;
  if (job.status !== 'done' && days === 0) return `${dayLabel(job.deadlineOn)} · today`;
  return dayLabel(job.deadlineOn);
};

function explain(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('capability required')) return 'Your account cannot change jobs.';
  if (message.includes('job not found')) return 'That job is no longer on your list. Refresh and try again.';
  if (message.includes('violates check constraint')) return 'Check the title and the lengths of the fields.';
  return 'The change could not be saved. Please try again.';
}

/* The status on the card: a badge for a reader, the status control (a badge
   grown to a tappable height, opening the status sheet) for an employee who
   manages the list. */
function statusMarkup(job, canManage) {
  const label = esc(STATUS_LABEL[job.status] || job.status);
  const tone = STATUS_TONE[job.status] ? ` data-tone="${STATUS_TONE[job.status]}"` : '';
  if (!canManage) return `<span class="app-badge"${tone}>${label}</span>`;
  return `<button class="app-badge app-job-status" type="button"${tone} data-job-status-for="${esc(job.id)}" aria-label="Status: ${label}. Change">${label}${CHEVRON_ICON}</button>`;
}

function cardMarkup(job, canManage) {
  const tight = isTight(job);
  return `<article class="app-card app-surface" data-job="${esc(job.id)}"><div class="app-job" data-status="${esc(job.status)}">
    <div class="app-job-head"><p class="app-job-kicker">${job.receivedOn ? `Received ${esc(dayLabel(job.receivedOn))}` : 'Received'}</p>${statusMarkup(job, canManage)}</div>
    <h3 class="app-job-title">${esc(job.title)}</h3>
    ${job.description ? `<p class="app-job-copy">${esc(job.description)}</p>` : ''}
    <div class="app-metric-grid app-job-section" data-columns="2" data-values="text">
      <div class="app-metric"><span class="app-metric-label">Sent by</span><span class="app-metric-value">${esc(job.senderName || '—')}</span>${job.senderRole ? `<span class="app-metric-note">${esc(job.senderRole)}</span>` : ''}</div>
      <div class="app-metric app-job-deadline"${tight ? ' data-tight="true"' : ''}><span class="app-metric-label">Deadline</span><span class="app-metric-value">${esc(deadlineValue(job))}</span>${job.deadlineOn && job.deadlineNote ? `<span class="app-metric-note">${esc(job.deadlineNote)}</span>` : ''}</div>
    </div>
    ${canManage ? `<div class="app-utility-row app-job-section"><button class="app-utility-action" type="button" data-job-edit="${esc(job.id)}">Update</button></div>` : ''}
  </div></article>`;
}

const matches = (job, filter) => filter === 'all' || (filter === 'open' ? job.status === 'not-started' || job.status === 'working' : job.status === filter);

function listMarkup(jobs, filter, canManage, updatedAt) {
  const shown = jobs.filter(job => matches(job, filter));
  const rail = `<div class="app-rail" role="tablist" aria-label="Filter jobs">${FILTERS.map(([key, label]) => { const n = jobs.filter(job => matches(job, key)).length; return `<button class="app-chip app-control" type="button" role="tab" data-job-filter="${key}" aria-pressed="${key === filter}">${label}${n ? ` ${n}` : ''}</button>`; }).join('')}</div>`;
  if (!jobs.length) return `${hero(canManage ? addAction : '')}<section class="app-section"><div class="app-stack">${state('Empty', 'No jobs yet', canManage ? 'Add a job when someone asks you for something, and it stays here until it is done.' : 'Jobs added to your list will appear here.')}</div></section>`;
  const empty = { open: ['Nothing open', 'Everything on your list is stuck or done.'], stuck: ['Nothing stuck', 'No job is waiting on someone else.'], done: ['Nothing done yet', 'Finished jobs will collect here.'], all: ['No jobs', ''] }[filter];
  const note = updatedAt ? `<div class="app-utility-row"><span class="app-utility-note">Updated ${esc(stampLabel(updatedAt))} · ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} on the list</span></div>` : '';
  return `${hero(canManage ? addAction : '')}${rail}<section class="app-section"><div class="app-stack">${shown.length ? shown.map(job => cardMarkup(job, canManage)).join('') : state(empty[0], empty[0], empty[1])}${note}</div></section>`;
}

function dialogMarkup(job) {
  const editing = Boolean(job.id);
  return `<div class="app-dialog-body"><form data-job-form novalidate>
    ${dialogHead(editing ? 'Update job' : 'New job', editing ? job.title : 'What was asked?')}
    <div class="app-dialog-grid">
      ${field('job-title', 'title', 'Task', job.title, { required: true, maxlength: 200, span: 'full' })}
      ${editing ? `<div data-span="full">${appSelect({ kind: 'status', label: 'Status', options: STATUSES.map(([value, label]) => ({ value, label })), selected: job.status })}</div>` : ''}
      ${textarea('job-description', 'description', 'Details', job.description)}
      ${field('job-sender', 'senderName', 'Sent by', job.senderName)}
      ${field('job-sender-role', 'senderRole', 'Their role', job.senderRole)}
      ${field('job-received', 'receivedOn', 'Received', job.receivedOn || new Date().toISOString().slice(0, 10), { type: 'date' })}
      ${field('job-deadline', 'deadlineOn', 'Deadline', job.deadlineOn || '', { type: 'date' })}
      ${field('job-deadline-note', 'deadlineNote', 'Deadline note', job.deadlineNote, { maxlength: 200, span: 'full' })}
    </div>
    <p class="app-dialog-status" data-job-status hidden></p>
    <div class="app-dialog-actions${editing ? ' app-dialog-actions-split' : ''}">
      ${editing ? '<button class="app-utility-action" type="button" data-job-archive>Archive</button>' : ''}
      <div class="app-row"><button class="app-utility-action" type="button" data-dialog-close>Cancel</button><button class="app-primary app-control" type="submit" data-job-save>${editing ? 'Save' : 'Add job'}</button></div>
    </div>
  </form></div>`;
}

export async function mountJobs(host) {
  let alive = true, dialog = null, jobs = [], canManage = false, updatedAt = null, filter = 'open';
  const controller = new AbortController();
  const { signal } = controller;
  try { filter = sessionStorage.getItem('sindhorn.jobs.filter') || 'open'; } catch (_) {}
  if (!FILTERS.some(([key]) => key === filter)) filter = 'open';

  const paint = () => { if (alive) host.innerHTML = listMarkup(jobs, filter, canManage, updatedAt); };

  async function load() {
    let result;
    try { result = await supabaseRpc('sindhorn_jobs_list_v1', {}); }
    catch (error) {
      if (!alive) return;
      const gated = /capability required|authentication required/i.test(String(error?.message || ''));
      host.innerHTML = `${hero('')}<section class="app-section"><div class="app-stack">${gated
        ? state('Not available', 'The job tracker is not on for your account.', 'Ask People & Culture if you need it.', 'empty', ' data-gate="jobs.read"')
        : state('Error', 'Your jobs could not be loaded', 'Check the connection and try again.', 'error')}</div></section>`;
      return;
    }
    if (!alive) return;
    jobs = Array.isArray(result?.jobs) ? result.jobs : [];
    canManage = Boolean(result?.canManage);
    updatedAt = result?.updatedAt || null;
    paint();
  }

  /* One dialog for add and edit: the form grid, the status selector when
     editing, Archive behind a confirm. Saving repaints the list from the
     row the server returns. */
  function edit(job) {
    if (dialog) dialog.close('');
    dialog = openDialog(dialogMarkup(job), { onClose: () => { dialog = null; } });
    const root = dialog.element || document.querySelector('.app-dialog');
    const form = root.querySelector('[data-job-form]'), status = root.querySelector('[data-job-status]');
    const say = (text, tone = 'error') => { status.hidden = !text; status.textContent = text; status.dataset.tone = tone; };
    bindAppSelects(root, { signal });
    form.querySelector('#job-title')?.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!String(data.title || '').trim()) { say('Give the job a task name.'); form.querySelector('#job-title')?.focus(); return; }
      const save = form.querySelector('[data-job-save]'); save.disabled = true; say('');
      try {
        const saved = await supabaseRpc('sindhorn_jobs_save_v1', { p_id: job.id || null, p_title: data.title, p_description: data.description || '', p_sender_name: data.senderName || '', p_sender_role: data.senderRole || '', p_received_on: data.receivedOn || null, p_deadline_on: data.deadlineOn || null, p_deadline_note: data.deadlineNote || '' });
        let row = saved?.job;
        if (job.id) {
          const wanted = appSelectValue(root, 'status');
          if (wanted && wanted !== job.status) row = (await supabaseRpc('sindhorn_jobs_set_status_v1', { p_id: job.id, p_status: wanted }))?.job || row;
        }
        if (!alive) return;
        if (row) { const at = jobs.findIndex(j => j.id === row.id); if (at >= 0) jobs[at] = row; else jobs.unshift(row); updatedAt = row.updatedAt || updatedAt; }
        dialog?.close('');
        paint();
        showToast(job.id ? 'Job updated' : 'Job added');
      } catch (error) { say(explain(error)); save.disabled = false; }
    }, { signal });
    root.querySelector('[data-job-archive]')?.addEventListener('click', async () => {
      const yes = await confirmDialog({ kicker: 'Archive job', title: `Archive “${job.title}”?`, copy: 'It leaves your list. Nothing is deleted.', confirm: 'Archive', cancel: 'Keep', tone: 'danger' });
      if (!yes || !alive) return;
      try {
        await supabaseRpc('sindhorn_jobs_archive_v1', { p_id: job.id });
        if (!alive) return;
        jobs = jobs.filter(j => j.id !== job.id);
        dialog?.close('');
        paint();
        showToast('Job archived');
      } catch (error) { say(explain(error)); }
    }, { signal });
  }

  /* The status sheet: one row per status, the current one checked; a tap on
     a row saves through set_status and closes. The sheet is a native
     <dialog> on the page root, so it is an overlay over the page, never a
     menu inside the card's glass. */
  function sheet() {
    let el = host.querySelector('[data-job-sheet]');
    if (!el) { el = document.createElement('dialog'); el.className = 'app-sheet app-overlay'; el.dataset.jobSheet = 'true'; host.append(el); el.addEventListener('click', event => { if (event.target === el) el.close(); }, { signal }); }
    return el;
  }
  function pickStatus(job) {
    const el = sheet();
    el.innerHTML = `<div class="app-sheet-grip"></div><div class="app-sheet-body"><h2 class="app-sheet-title">Status</h2><div class="app-list">${STATUSES.map(([key, label]) => {
      const on = key === job.status;
      return `<button class="app-list-row" type="button" data-job-set-status="${key}" aria-pressed="${on}"><span class="app-list-row-main"><span class="app-list-row-title">${esc(label)}</span></span><span class="app-list-row-end">${on ? CHECK_ICON : ''}</span></button>`;
    }).join('')}</div><p class="app-dialog-status" data-job-sheet-status hidden></p><div class="app-dialog-actions"><button class="app-utility-action" type="button" data-job-sheet-close>Cancel</button></div></div>`;
    el.onclick = async event => {
      if (event.target.closest('[data-job-sheet-close]')) { el.close(); return; }
      const row = event.target.closest('[data-job-set-status]'); if (!row) return;
      const wanted = row.dataset.jobSetStatus;
      if (wanted === job.status) { el.close(); return; }
      for (const button of el.querySelectorAll('[data-job-set-status]')) button.disabled = true;
      try {
        const saved = (await supabaseRpc('sindhorn_jobs_set_status_v1', { p_id: job.id, p_status: wanted }))?.job;
        if (!alive) return;
        if (saved) { const at = jobs.findIndex(j => j.id === saved.id); if (at >= 0) jobs[at] = saved; updatedAt = saved.updatedAt || updatedAt; }
        el.close();
        paint();
        showToast(`Marked ${STATUS_LABEL[wanted].toLowerCase()}`);
      } catch (error) {
        const status = el.querySelector('[data-job-sheet-status]'); status.hidden = false; status.textContent = explain(error); status.dataset.tone = 'error';
        for (const button of el.querySelectorAll('[data-job-set-status]')) button.disabled = false;
      }
    };
    el.showModal();
  }

  host.addEventListener('click', event => {
    const chip = event.target.closest('[data-job-filter]');
    if (chip) { filter = chip.dataset.jobFilter; try { sessionStorage.setItem('sindhorn.jobs.filter', filter); } catch (_) {} paint(); return; }
    if (event.target.closest('[data-job-add]')) { edit({ id: null, title: '', description: '', senderName: '', senderRole: '', receivedOn: '', deadlineOn: '', deadlineNote: '', status: 'not-started' }); return; }
    const statusButton = event.target.closest('[data-job-status-for]');
    if (statusButton) { const job = jobs.find(j => j.id === statusButton.dataset.jobStatusFor); if (job) pickStatus(job); return; }
    const editButton = event.target.closest('[data-job-edit]');
    if (editButton) { const job = jobs.find(j => j.id === editButton.dataset.jobEdit); if (job) edit({ ...job }); }
  }, { signal });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); }, { signal });

  host.innerHTML = `${hero('')}<section class="app-section"><div class="app-stack">${skeleton}${skeleton}</div></section>`;
  await load();
  return () => { alive = false; controller.abort(); if (dialog) dialog.close(''); host.querySelector('[data-job-sheet]')?.close(); };
}
