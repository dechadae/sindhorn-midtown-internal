export const SETTINGS_DIALOG_MOTION=Object.freeze({in:300,out:180,ease:'cubic-bezier(.22,1,.36,1)'});

function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
async function animate(element,keyframes,duration){
  if(!element||reducedMotion()||typeof element.animate!=='function')return;
  try{await element.animate(keyframes,{duration,easing:SETTINGS_DIALOG_MOTION.ease,fill:'both'}).finished}catch(_){}
}
export async function openSettingsDialog(dialog){
  if(!dialog||dialog.open)return;
  dialog.showModal();
  await animate(dialog,[{opacity:.02,transform:'translateY(18px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],SETTINGS_DIALOG_MOTION.in);
}
export async function closeSettingsDialog(dialog,{beforeClose=null}={}){
  if(!dialog?.open)return;
  try{beforeClose?.()}catch(_){}
  await animate(dialog,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:.02,transform:'translateY(10px) scale(.992)'}],SETTINGS_DIALOG_MOTION.out);
  if(dialog.open)dialog.close();
}
export function standardCloseButton(attribute='data-dialog-close',label='Close'){
  return `<button class="settings-close" type="button" ${attribute} aria-label="${String(label).replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]))}">×</button>`;
}
