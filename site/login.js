import {activate,getState,initAuth,signInWithMicrosoft,signOut} from './auth-client.js';

const copy={
  en:{eyebrow:'Internal employee access',title:'Welcome back.',support:'Use your hotel Microsoft 365 account, or sign in with your employee ID and one-time code.',microsoft:'Continue with Microsoft 365',or:'or',employeeId:'Employee ID',activationCode:'One-time activation code',employeeButton:'Sign in with Employee ID',hint:'Your manager or an app administrator can issue a new 6-digit code. Codes expire after 15 minutes.',openApp:'Open app',admin:'Admin',signOut:'Sign out',working:'Signing you in…',microsoftWorking:'Opening Microsoft 365…',success:'Signed in successfully.',badCode:'Check your Employee ID and one-time code, then try again.',notProvisioned:'This Microsoft 365 account has not been provisioned for Sindhorn Midtown Internal. Ask an administrator to add your hotel email first.',oauthError:'Microsoft sign-in could not be completed. Please try again.',genericError:'Sign-in could not be completed. Please try again.'},
  th:{eyebrow:'สำหรับพนักงาน',title:'ยินดีต้อนรับกลับ',support:'เข้าสู่ระบบด้วยบัญชี Microsoft 365 ของโรงแรม หรือใช้รหัสพนักงานและรหัสใช้งานครั้งเดียว',microsoft:'เข้าสู่ระบบด้วย Microsoft 365',or:'หรือ',employeeId:'รหัสพนักงาน',activationCode:'รหัสใช้งานครั้งเดียว',employeeButton:'เข้าสู่ระบบด้วยรหัสพนักงาน',hint:'หัวหน้างานหรือผู้ดูแลระบบสามารถออกรหัส 6 หลักใหม่ได้ รหัสมีอายุ 15 นาที',openApp:'เปิดแอป',admin:'ผู้ดูแลระบบ',signOut:'ออกจากระบบ',working:'กำลังเข้าสู่ระบบ…',microsoftWorking:'กำลังเปิด Microsoft 365…',success:'เข้าสู่ระบบสำเร็จ',badCode:'กรุณาตรวจสอบรหัสพนักงานและรหัสใช้งาน แล้วลองอีกครั้ง',notProvisioned:'บัญชี Microsoft 365 นี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาให้ผู้ดูแลเพิ่มอีเมลโรงแรมของคุณก่อน',oauthError:'ไม่สามารถเข้าสู่ระบบด้วย Microsoft ได้ กรุณาลองอีกครั้ง',genericError:'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง'}
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
function setBusy(value,message=''){$('#employeeButton').disabled=value;$('#microsoftButton').disabled=value;if(message)showStatus(message,'neutral')}
function showStatus(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function errorMessage(error){
  const code=error?.payload?.error||'';
  if(code==='activation_invalid'||code==='too_many_attempts')return copy[language].badCode;
  if(code==='employee_not_provisioned')return copy[language].notProvisioned;
  if(code.includes('microsoft')||code.includes('oauth'))return copy[language].oauthError;
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
$('#microsoftButton').addEventListener('click',()=>{
  showStatus(copy[language].microsoftWorking,'neutral');setBusy(true);signInWithMicrosoft();
});
$('#signOutButton').addEventListener('click',async()=>{await signOut();showStatus('');renderState()});
document.addEventListener('sindhorn:auth-oauth-error',event=>showStatus(errorMessage({payload:{error:'oauth_error'},message:event.detail?.message}),'error'));
document.addEventListener('sindhorn:auth-changed',renderState);

setLanguage(language);
try{await initAuth()}catch(error){showStatus(errorMessage(error),'error')}
renderState();
