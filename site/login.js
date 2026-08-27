import {activate,getState,initAuth,signOut} from './auth-client.js';

const copy={
  en:{eyebrow:'Internal employee access',title:'Employee sign in.',support:'Enter your Employee ID and the one-time code provided by an administrator.',employeeId:'Employee ID',activationCode:'One-time code',employeeButton:'Sign in',hint:'Your administrator generates this code for your first sign-in or account recovery. Each code works once and expires after 15 minutes.',openApp:'Open app',admin:'Admin',signOut:'Sign out',working:'Signing you in…',success:'Signed in successfully.',badCode:'Check your Employee ID and one-time code, then try again. Ask an administrator for a new code if it has expired.',genericError:'Sign-in could not be completed. Please try again or ask an administrator for a new code.'},
  th:{eyebrow:'สำหรับพนักงาน',title:'เข้าสู่ระบบพนักงาน',support:'กรอกรหัสพนักงานและรหัสใช้ครั้งเดียวที่ได้รับจากผู้ดูแลระบบ',employeeId:'รหัสพนักงาน',activationCode:'รหัสใช้ครั้งเดียว',employeeButton:'เข้าสู่ระบบ',hint:'ผู้ดูแลระบบจะออกรหัสสำหรับการเข้าสู่ระบบครั้งแรกหรือกู้คืนบัญชี รหัสใช้ได้ครั้งเดียวและหมดอายุภายใน 15 นาที',openApp:'เปิดแอป',admin:'ผู้ดูแลระบบ',signOut:'ออกจากระบบ',working:'กำลังเข้าสู่ระบบ…',success:'เข้าสู่ระบบสำเร็จ',badCode:'กรุณาตรวจสอบรหัสพนักงานและรหัสใช้ครั้งเดียว หากรหัสหมดอายุให้ขอรหัสใหม่จากผู้ดูแลระบบ',genericError:'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้งหรือขอรหัสใหม่จากผู้ดูแลระบบ'}
};

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const controls=$('#loginControls'),status=$('#status'),signedCard=$('#signedCard'),signedName=$('#signedName'),signedMeta=$('#signedMeta'),adminLink=$('#adminLink'),openAppLink=$('#signedCard .signed-actions a[href="/"]');
const otpDigits=$$('[data-otp-digit]'),activationCode=$('#activationCode');
let language=(localStorage.getItem('sindhorn-login-language')||((navigator.language||'').toLowerCase().startsWith('th')?'th':'en'))==='th'?'th':'en';

function requestedNext(){
  const value=new URLSearchParams(location.search).get('next')||'/';
  if(!value.startsWith('/')||value.startsWith('//')||value.startsWith('/login'))return'/';
  return value;
}
function setLanguage(next){
  language=next==='th'?'th':'en';localStorage.setItem('sindhorn-login-language',language);document.documentElement.lang=language;
  $$('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===language)));
  $$('[data-i18n]').forEach(node=>{const key=node.dataset.i18n;if(copy[language][key])node.textContent=copy[language][key]});
}
function setBusy(value,message=''){$('#employeeButton').disabled=value;if(message)showStatus(message,'neutral')}
function showStatus(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function errorMessage(error){
  const code=error?.code||error?.payload?.error||'';
  if(code==='activation_invalid'||code==='too_many_attempts')return copy[language].badCode;
  return copy[language].genericError;
}
function syncOtp(){activationCode.value=otpDigits.map(input=>input.value).join('')}
function fillOtp(raw,startIndex=0){
  const values=String(raw||'').replace(/\D/g,'').slice(0,otpDigits.length-startIndex).split('');
  if(!values.length)return;
  values.forEach((value,offset)=>{const input=otpDigits[startIndex+offset];if(input)input.value=value});
  syncOtp();
  const next=Math.min(startIndex+values.length,otpDigits.length-1);
  otpDigits[next]?.focus();
  if(startIndex+values.length>=otpDigits.length)otpDigits[otpDigits.length-1]?.select();
}
function consumeInvitationHash(){
  if(!location.hash||location.hash.length<2)return;
  const params=new URLSearchParams(location.hash.slice(1)),employee=params.get('i')||'',code=params.get('c')||'';
  const validEmployee=employee.trim().length>0&&employee.length<=64,validCode=/^[0-9]{6}$/.test(code);
  if(validEmployee)$('#employeeNumber').value=employee.trim();
  if(validCode){otpDigits.forEach(input=>{input.value=''});fillOtp(code,0)}
  if(params.has('i')||params.has('c'))history.replaceState(null,'',`${location.pathname}${location.search}`);
}
function bindOtp(){
  otpDigits.forEach((input,index)=>{
    input.addEventListener('input',event=>{
      const numeric=event.target.value.replace(/\D/g,'');
      if(numeric.length>1){event.target.value='';fillOtp(numeric,index);return}
      event.target.value=numeric.slice(-1);syncOtp();
      if(event.target.value&&index<otpDigits.length-1)otpDigits[index+1].focus();
    });
    input.addEventListener('keydown',event=>{
      if(event.key==='Backspace'&&!input.value&&index>0){event.preventDefault();otpDigits[index-1].value='';syncOtp();otpDigits[index-1].focus();return}
      if(event.key==='ArrowLeft'&&index>0){event.preventDefault();otpDigits[index-1].focus();return}
      if(event.key==='ArrowRight'&&index<otpDigits.length-1){event.preventDefault();otpDigits[index+1].focus()}
    });
    input.addEventListener('focus',()=>input.select());
  });
  $('#otpCodeGroup').addEventListener('paste',event=>{
    const numeric=event.clipboardData?.getData('text')?.replace(/\D/g,'').slice(0,6)||'';
    if(!numeric)return;
    event.preventDefault();otpDigits.forEach(input=>{input.value=''});fillOtp(numeric,0);
  });
}
function renderState(){
  const state=getState(),profile=state.profile;
  if(openAppLink)openAppLink.href=requestedNext();
  if(!state.authenticated||!profile){controls.hidden=false;signedCard.dataset.show='false';return}
  controls.hidden=true;signedCard.dataset.show='true';showStatus(copy[language].success,'success');
  signedName.textContent=profile.display_name||profile.employee_number;
  signedMeta.textContent=`${profile.employee_number} · ${String(profile.role||'employee').replaceAll('_',' ')}${profile.work_email?` · ${profile.work_email}`:''}`;
  adminLink.classList.toggle('hidden',!['admin','super_admin'].includes(profile.role));
}

$$('[data-lang]').forEach(button=>button.addEventListener('click',()=>{setLanguage(button.dataset.lang);renderState()}));
bindOtp();consumeInvitationHash();
$('#employeeForm').addEventListener('submit',async event=>{
  event.preventDefault();showStatus('');syncOtp();
  const employeeNumber=$('#employeeNumber').value.trim(),code=activationCode.value.trim();
  if(code.length!==6){showStatus(copy[language].badCode,'error');otpDigits.find(input=>!input.value)?.focus();return}
  setBusy(true,copy[language].working);
  try{
    const result=await activate(employeeNumber,code);if(result?.preferredLanguage)setLanguage(result.preferredLanguage);renderState();
    setTimeout(()=>location.assign(requestedNext()),520);
  }catch(error){showStatus(errorMessage(error),'error')}
  finally{setBusy(false)}
});
$('#signOutButton').addEventListener('click',async()=>{await signOut();showStatus('');renderState()});
document.addEventListener('sindhorn:auth-changed',renderState);

setLanguage(language);
try{await initAuth()}catch(error){showStatus(errorMessage(error),'error')}
renderState();
