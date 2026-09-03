/* Canonical selector.

   One implementation of the compact dropdown the app uses for finite choices.
   Before this there were two: filterField() private to fnb.js, and a second
   copy in business-card-settings.js. The CI day-cycle would have been a third,
   which is exactly the duplication this work exists to stop.

   Visual definition still lives in fnb-approved-polish.css under the .fnb-select
   class names, so consuming this component is visually identical to the proven
   F&B selector. Those rules move to the canonical component stylesheet when F&B
   is rebuilt; renaming them now would mean editing F&B markup out of turn.

   Markup contract mirrors fnb.js exactly: a hidden native <select> carries the
   value for forms and assistive technology, a button is the visible trigger,
   and a listbox holds the options. */

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function selectField({kind,label,values,selected,labelFor=v=>v}){
  const menuId=`app-${kind}-menu`;
  const options=values.map(value=>`<button class="fnb-select-option" type="button" role="option" data-filter-option data-value="${esc(value)}" aria-selected="${String(value===selected)}">${esc(labelFor(value))}</button>`).join('');
  return`<div class="fnb-select" data-filter-field="${esc(kind)}">`
    +`<span class="fnb-select-label">${esc(label)}</span>`
    +`<button class="fnb-select-trigger" type="button" data-filter-trigger="${esc(kind)}" aria-label="${esc(label)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${menuId}">`
    +`<span data-filter-value>${esc(labelFor(selected))}</span>`
    +`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button>`
    +`<select data-${esc(kind)}-select hidden tabindex="-1" aria-hidden="true">`
    +values.map(value=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(labelFor(value))}</option>`).join('')
    +`</select>`
    +`<div class="fnb-select-menu" id="${menuId}" role="listbox" aria-hidden="true">${options}</div></div>`;
}

export function bindSelectField(root,kind,onChange,labelFor=v=>v){
  const field=root.querySelector(`[data-filter-field="${kind}"]`);
  if(!field)return()=>{};
  const trigger=field.querySelector('[data-filter-trigger]');
  const menu=field.querySelector('.fnb-select-menu');
  const setOpen=open=>{
    field.classList.toggle('is-open',open);
    trigger?.setAttribute('aria-expanded',String(open));
    menu?.setAttribute('aria-hidden',String(!open));
  };
  const onTrigger=event=>{event.stopPropagation();setOpen(!field.classList.contains('is-open'))};
  const onPick=event=>{
    const option=event.target.closest('[data-filter-option]');
    if(!option)return;
    event.stopPropagation();
    setValue(option.dataset.value);
    setOpen(false);
    onChange?.(option.dataset.value);
  };
  const onOutside=()=>setOpen(false);
  const onKey=event=>{if(event.key==='Escape')setOpen(false)};

  function setValue(value){
    const select=field.querySelector(`select[data-${kind}-select]`);
    if(select&&select.value!==value)select.value=value;
    const valueNode=field.querySelector('[data-filter-value]');
    if(valueNode)valueNode.textContent=labelFor(value);
    field.querySelectorAll('[data-filter-option]').forEach(option=>{
      const isSelected=option.dataset.value===value;
      option.setAttribute('aria-selected',String(isSelected));
      option.classList.toggle('is-selected',isSelected);
    });
  }

  trigger?.addEventListener('click',onTrigger);
  menu?.addEventListener('click',onPick);
  document.addEventListener('click',onOutside);
  document.addEventListener('keydown',onKey);
  return{
    setValue,
    destroy(){
      trigger?.removeEventListener('click',onTrigger);
      menu?.removeEventListener('click',onPick);
      document.removeEventListener('click',onOutside);
      document.removeEventListener('keydown',onKey);
    }
  };
}
