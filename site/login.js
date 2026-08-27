import {activate,getState,initAuth,signOut} from './auth-client.js';

const copy={
  en:{eyebrow:'Internal employee access',title:'Employee sign in.',support:'Enter your Employee ID and personal email to receive a fresh 6-digit sign-in code.',employeeId:'Employee ID',activationCode:'One-time code',employeeButton:'Sign in',hint:'Use an administrator-issued invitation code. It works once. If it has expired, an app administrator can issue a new one.',openApp:'Open app',admin:'Admin',signOut:'Sign out',working:'Signing you in…',success:'Signed in successfully.',badCode:'Check your Employee ID and one-time code, then try again.',genericError:'Sign-in could not be completed. Please try again.'},
  th:{eyebrow:'สำหรับพนักงาน',title:'เข้าสู่ระบบพนักงาน',support:'กรอกรหัสพนักงานและอีเมลส่วนตัวเพื่อรับรหัสเข้าสู่ระบบ 6 หลักใหม่',employeeId:'รหัสพนักงาน',activationCode:'รหัสใช้ครั้งเดียว',employeeButton:'เข้าสู่ระบบ',hint:'ใช้รหัสคำเชิญที่ผู้ดูแลระบบออกให้ รหัสใช้ได้ครั้งเดียว หากหมดอายุ ผู้ดูแลแอปสามารถออกรหัสใหม่ให้ได้',openApp:'เปิดแอป',admin:'ผู้ดูแลระบบ',signOut:'ออกจากระบบ',working:'กำลังเข้าสู่ระบบ…',success:'เข้าสู่ระบบสำเร็จ',badCode:'กรุณาตรวจสอบรหัสพนักงานและรหัสใช้ครั้งเดียว แล้วลองอีกครั้ง',genericError:'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง'}
};

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const controls=$('#loginControls'),status=$('#status'),signedCard=$('#signedCard'),signedName=$('#signedName'),signedMeta=$('#signedMeta'),adminLink=$('#adminLink');
let language=(localStorage.getItem('sindhorn-login-language')||((navigator.language||'').toLowerCase().startsWith('th')?'th':'en'))==='th'?'th':'en';

function setLanguage(next){
  language=next==='th'?'th':'en';localStorage.setItem('sindhorn-login-language',language);document.documentElement.lang=language;
  $$('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===language)));
  $$('[data-i18n]').forEach(node=>{const key=node.dataset.i18n;if(copy[language][key])node.textContent=copy[language][key]});
}
function setBusy(value,message=''){$('#employeeButton').disabled=value;if(message)showStatus(message,'neutral')}
function showStatus(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function errorMessage(error){
  const code=error?.payload?.error||'';
  if(code==='activation_invalid'||code==='too_many_attempts')return copy[language].badCode;
  return copy[language].genericError;
}
function renderState(){
  const state=getState(),profile=state.profile;
  if(!state.authenticated||!profile){controls.hidden=false;signedCard.dataset.show='false';return}
  controls.hidden=true;signedCard.dataset.show='true';showStatus(copy[language].success,'success');
  signedName.textContent=profile.display_name||profile.employee_number;
  signedMeta.textContent=`${profile.employee_number} · ${String(profile.role||'employee').replaceAll('_',' ')}${profile.work_email?` · ${profile.work_email}`:''}`;
  adminLink.classList.toggle('hidden',!['admin','super_admin'].includes(profile.role));
}

$$('[data-lang]').forEach(button=>button.addEventListener('click',()=>{setLanguage(button.dataset.lang);renderState()}));
$('#activationCode').addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,6)});
$('#employeeForm').addEventListener('submit',async event=>{
  event.preventDefault();showStatus('');setBusy(true,copy[language].working);
  try{
    const employeeNumber=$('#employeeNumber').value.trim(),code=$('#activationCode').value.trim();
    const result=await activate(employeeNumber,code);if(result?.preferredLanguage)setLanguage(result.preferredLanguage);renderState();
  }catch(error){showStatus(errorMessage(error),'error')}
  finally{setBusy(false)}
});
$('#signOutButton').addEventListener('click',async()=>{await signOut();showStatus('');renderState()});
document.addEventListener('sindhorn:auth-changed',renderState);

setLanguage(language);
try{await initAuth()}catch(error){showStatus(errorMessage(error),'error')}
renderState();
