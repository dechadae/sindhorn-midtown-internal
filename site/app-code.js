/* Six-digit code entry, shared by the UI Library specimen and the sign-in
   page. One .app-code group holds six single-digit inputs; typing advances,
   backspace on an empty well retreats, and a pasted or autofilled code fills
   the whole group from wherever it lands. The markup and the wells' look
   live in app-components.css (.app-code inside .app-field); this file is
   only behavior. */

export const CODE_LENGTH = 6;

const wells = group => Array.from(group.querySelectorAll('input'));
const digits = value => String(value ?? '').replace(/\D/g, '');

/* The group's value: six digits, or '' while any well is still empty. */
export function codeValue(group) {
  const value = wells(group).map(input => digits(input.value).slice(-1)).join('');
  return value.length === CODE_LENGTH ? value : '';
}

export function clearCode(group, { focus = false } = {}) {
  const inputs = wells(group);
  for (const input of inputs) input.value = '';
  if (focus) inputs[0]?.focus();
}

/* Write a string into the group starting at a well; overflow is dropped. */
function fill(inputs, start, value) {
  const chars = digits(value).split('');
  if (!chars.length) return;
  let index = start;
  for (const ch of chars) {
    if (index >= inputs.length) break;
    inputs[index].value = ch;
    index += 1;
  }
  inputs[Math.min(index, inputs.length - 1)].focus();
  if (index >= inputs.length) inputs[inputs.length - 1].dispatchEvent(new Event('app-code-complete', { bubbles: true }));
}

/* Wire every [data-code] group under root. Returns a dispose; the group
   markup itself stays untouched. */
export function bindCode(root, { signal } = {}) {
  const controller = new AbortController();
  const options = { signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal };

  root.addEventListener('input', event => {
    const input = event.target;
    const group = input.closest?.('[data-code]');
    if (!group || input.tagName !== 'INPUT') return;
    const inputs = wells(group), at = inputs.indexOf(input);
    const value = digits(input.value);
    if (value.length > 1) { input.value = ''; fill(inputs, at, value); return; }
    input.value = value;
    if (value && at < inputs.length - 1) inputs[at + 1].focus();
    if (value && at === inputs.length - 1 && codeValue(group)) input.dispatchEvent(new Event('app-code-complete', { bubbles: true }));
  }, options);

  root.addEventListener('keydown', event => {
    const input = event.target;
    const group = input.closest?.('[data-code]');
    if (!group || input.tagName !== 'INPUT') return;
    const inputs = wells(group), at = inputs.indexOf(input);
    if (event.key === 'Backspace' && !input.value && at > 0) { event.preventDefault(); inputs[at - 1].value = ''; inputs[at - 1].focus(); }
    else if (event.key === 'ArrowLeft' && at > 0) { event.preventDefault(); inputs[at - 1].focus(); }
    else if (event.key === 'ArrowRight' && at < inputs.length - 1) { event.preventDefault(); inputs[at + 1].focus(); }
  }, options);

  root.addEventListener('paste', event => {
    const input = event.target;
    const group = input.closest?.('[data-code]');
    if (!group || input.tagName !== 'INPUT') return;
    const text = event.clipboardData?.getData('text') || '';
    if (!digits(text)) return;
    event.preventDefault();
    fill(wells(group), wells(group).indexOf(input), text);
  }, options);

  /* A tap lands on the first empty well, not the middle of a half-typed code. */
  root.addEventListener('focusin', event => {
    const input = event.target;
    const group = input.closest?.('[data-code]');
    if (!group || input.tagName !== 'INPUT') return;
    const inputs = wells(group), first = inputs.findIndex(well => !well.value);
    if (first !== -1 && inputs.indexOf(input) > first) inputs[first].focus();
    else input.select?.();
  }, options);

  return () => controller.abort();
}
