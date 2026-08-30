export const SETTINGS_DIALOG_MOTION=Object.freeze({in:300,out:180,ease:'cubic-bezier(.22,1,.36,1)'});

function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
async function animate(element,keyframes,duration){
  if(!element||reducedMotion()||typeof element.animate!=='function')return;
  try{await element.animate(keyframes,{duration,easing:SETTINGS_DIALOG_MOTION.ease,fill:'both'}).finished}catch(_){}
}
function directSurface(dialog){
  return [...dialog.children].find(node=>node.classList?.contains('settings-dialog-body')||node.classList?.contains('public-card-panel'))||null;
}
function upgradeFormSurface(surface){
  if(surface.querySelector(':scope > .settings-modal-scroll'))return;
  const header=surface.querySelector(':scope > .settings-dialog-head');
  const scroll=document.createElement('div');
  scroll.className='settings-modal-scroll';
  const nodes=[...surface.childNodes].filter(node=>node!==header);
  nodes.forEach(node=>scroll.append(node));
  if(header)header.after(scroll);else surface.append(scroll);
}
function upgradeCardSurface(surface){
  const scroll=surface.querySelector(':scope > .public-card-scroll');
  if(scroll)scroll.classList.add('settings-modal-scroll');
}
export function standardizeSettingsDialog(dialog){
  if(!dialog)return null;
  const surface=directSurface(dialog);
  if(!surface)return null;
  dialog.classList.add('settings-modal-root');
  surface.classList.add('settings-modal-surface');
  if(surface.classList.contains('public-card-panel'))upgradeCardSurface(surface);else upgradeFormSurface(surface);
  surface.dataset.settingsModalSurface='true';
  dialog.dataset.settingsModalStandard='true';
  return surface;
}
function resetInnerScroll(dialog){
  const scroll=dialog?.querySelector(':scope > .settings-modal-surface > .settings-modal-scroll');
  if(scroll)scroll.scrollTop=0;
}
export async function openSettingsDialog(dialog){
  if(!dialog||dialog.open)return;
  const surface=standardizeSettingsDialog(dialog);
  resetInnerScroll(dialog);
  dialog.showModal();
  await animate(surface||dialog,[{opacity:.02,transform:'translateY(18px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],SETTINGS_DIALOG_MOTION.in);
}
export async function closeSettingsDialog(dialog,{beforeClose=null}={}){
  if(!dialog?.open)return;
  try{beforeClose?.()}catch(_){}
  const surface=standardizeSettingsDialog(dialog);
  await animate(surface||dialog,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:.02,transform:'translateY(10px) scale(.992)'}],SETTINGS_DIALOG_MOTION.out);
  if(dialog.open)dialog.close();
}
export function standardCloseButton(attribute='data-dialog-close',label='Close'){
  return `<button class="settings-close" type="button" ${attribute} aria-label="${String(label).replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]))}">×</button>`;
}
