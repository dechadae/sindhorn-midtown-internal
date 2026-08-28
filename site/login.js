import {activate,getState,initAuth,setPermanentPin,signInWithPin,signOut} from './auth-client.js';

const COPY={eyebrow:'Internal employee access',title:'Employee sign in.',supportPin:'Enter your Employee ID and permanent 6-digit code.',supportOtp:'Enter your Employee ID and the one-time code provided by an administrator.',employeeId:'Employee ID',permanentCode:'Permanent code',oneTimeCode:'Administrator one-time code',signIn:'Sign in',continue:'Continue',useOneTime:'First time or forgot your code? Use an administrator one-time code.',oneTimeHint:'The administrator code works once and expires after 15 minutes. After verification, you will create a new permanent code.',usePermanent:'Back to permanent code sign in',setupKicker:'Secure your account',setupTitle:'Create your permanent code.',setupSupport:'Choose a 6-digit code you will use with your Employee ID for future sign-ins.',newCode:'New permanent code',confirmCode:'Confirm permanent code',saveCode:'Save code & open app',pinSafety:'Your permanent code is stored only as a secure hash. Five failed attempts temporarily lock PIN sign-in for 15 minutes.',openApp:'Open app',admin:'Admin',signOut:'Sign out',working:'Signing you in…',checkingOtp:'Checking one-time code…',savingPin:'Saving your permanent code…',success:'Signed in successfully.',pinReady:'Permanent code saved.',badPin:'Check your Employee ID and permanent code, then try again. If needed, use an administrator one-time code.',badCode:'Check your Employee ID and administrator one-time code, then try again. Ask an administrator for a new code if it has expired.',pinMismatch:'The two permanent codes do not match.',pinLength:'Enter all 6 digits of your permanent code.',genericError:'Sign-in could not be completed. Please try again.'};

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const controls=$('#loginControls'),status=$('#status'),signedCard=$('#signedCard'),signedName=$('#signedName'),signedMeta=$('#signedMeta'),adminLink=$('#adminLink'),openAppLink=$('#signedCard .signed-actions a[href="/"]'),pinSetupStep=$('#pinSetupStep');
let mode='pin';

function requestedNext(){
  const value=new URLSearchParams(location.search).get('next')||'/';
  if(!value.startsWith('/')||value.startsWith('//')||value.startsWith('/login'))return'/';
  return value;
}
function showStatus(message,tone='neutral'){status.textContent=message||'';status.dataset.show=String(Boolean(message));status.dataset.tone=tone}
function errorMessage(error){
  const code=error?.code||error?.payload?.error||'';
  if(code==='pin_invalid')return COPY.badPin;
  if(code==='activation_invalid'||code==='too_many_attempts')return COPY.badCode;
  return COPY.genericError;
}
function updateModeCopy(){$('#loginSupport').textContent=mode==='otp'?COPY.supportOtp:COPY.supportPin}
function group(selector,hiddenSelector){
  const digits=$$(selector),hidden=$(hiddenSelector);
  const sync=()=>{hidden.value=digits.map(input=>input.value).join('');return hidden.value};
  const clear=()=>{digits.forEach(input=>{input.value=''});sync()};
  const fill=(raw,startIndex=0)=>{
    const values=String(raw||'').replace(/\D/g,'').slice(0,digits.length-startIndex).split('');
    if(!values.length)return;
    values.forEach((value,offset)=>{const input=digits[startIndex+offset];if(input)input.value=value});sync();
    const next=Math.min(startIndex+values.length,digits.length-1);digits[next]?.focus();if(startIndex+values.length>=digits.length)digits[digits.length-1]?.select();
  };
  digits.forEach((input,index)=>{
    input.addEventListener('input',event=>{const numeric=event.target.value.replace(/\D/g,'');if(numeric.length>1){event.target.value='';fill(numeric,index);return}event.target.value=numeric.slice(-1);sync();if(event.target.value&&index<digits.length-1)digits[index+1].focus()});
    input.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!input.value&&index>0){event.preventDefault();digits[index-1].value='';sync();digits[index-1].focus();return}if(event.key==='ArrowLeft'&&index>0){event.preventDefault();digits[index-1].focus();return}if(event.key==='ArrowRight'&&index<digits.length-1){event.preventDefault();digits[index+1].focus()}});
    input.addEventListener('focus',()=>input.select());
  });
  digits[0]?.closest('.otp-code')?.addEventListener('paste',event=>{const numeric=event.clipboardData?.getData('text')?.replace(/\D/g,'').slice(0,6)||'';if(!numeric)return;event.preventDefault();clear();fill(numeric,0)});
  return{digits,hidden,sync,clear,fill,setDisabled(value){digits.forEach(input=>{input.disabled=value})}};
}
const pinLogin=group('[data-pin-login-digit]','#permanentPin');
const oneTime=group('[data-otp-digit]','#activationCode');
const newPin=group('[data-new-pin-digit]','#newPermanentPin');
const confirmPin=group('[data-confirm-pin-digit]','#confirmPermanentPin');

function setMode(next,{focus=true}={}){
  mode=next==='otp'?'otp':'pin';
  const pinActive=mode==='pin';
  $('#pinLoginStep').classList.toggle('hidden',!pinActive);$('#oneTimeStep').classList.toggle('hidden',pinActive);
  pinLogin.setDisabled(!pinActive);oneTime.setDisabled(pinActive);showStatus('');updateModeCopy();
  if(focus)(pinActive?pinLogin.digits[0]:oneTime.digits[0])?.focus();
}
function consumeInvitationHash(){
  if(!location.hash||location.hash.length<2)return;
  const params=new URLSearchParams(location.hash.slice(1)),employee=params.get('i')||'',code=params.get('c')||'';
  const validEmployee=employee.trim().length>0&&employee.length<=64,validCode=/^[0-9]{6}$/.test(code);
  if(validEmployee)$('#employeeNumber').value=employee.trim();
  if(validCode){setMode('otp',{focus:false});oneTime.clear();oneTime.fill(code,0)}
  if(params.has('i')||params.has('c'))history.replaceState(null,'',`${location.pathname}${location.search}`);
}
function setLoginBusy(value,message=''){$('#pinLoginButton').disabled=value;$('#oneTimeButton').disabled=value;$('#useOneTimeButton').disabled=value;$('#usePermanentButton').disabled=value;if(message)showStatus(message,'neutral')}
function showPinSetup(){
  controls.hidden=true;signedCard.dataset.show='false';pinSetupStep.classList.remove('hidden');showStatus('');newPin.setDisabled(false);confirmPin.setDisabled(false);setTimeout(()=>newPin.digits[0]?.focus(),40);
}
function hidePinSetup(){pinSetupStep.classList.add('hidden');newPin.setDisabled(true);confirmPin.setDisabled(true)}
function renderState(){
  const state=getState(),profile=state.profile;if(openAppLink)openAppLink.href=requestedNext();
  if(state.authenticated&&profile&&!profile.pin_configured_at){showPinSetup();return}
  hidePinSetup();
  if(!state.authenticated||!profile){controls.hidden=false;signedCard.dataset.show='false';return}
  controls.hidden=true;signedCard.dataset.show='true';showStatus(COPY.success,'success');
  signedName.textContent=profile.display_name||profile.employee_number;
  signedMeta.textContent=`${profile.employee_number} · ${String(profile.role||'employee').replaceAll('_',' ')}${profile.work_email?` · ${profile.work_email}`:''}`;
  adminLink.classList.toggle('hidden',!['admin','super_admin'].includes(profile.role));
}

$('#useOneTimeButton').addEventListener('click',()=>setMode('otp'));
$('#usePermanentButton').addEventListener('click',()=>setMode('pin'));
consumeInvitationHash();
$('#employeeForm').addEventListener('submit',async event=>{
  event.preventDefault();showStatus('');
  const employeeNumber=$('#employeeNumber').value.trim();
  if(!employeeNumber){$('#employeeNumber').focus();return}
  setLoginBusy(true,mode==='otp'?COPY.checkingOtp:COPY.working);
  try{
    if(mode==='otp'){
      const code=oneTime.sync();if(code.length!==6){showStatus(COPY.badCode,'error');oneTime.digits.find(input=>!input.value)?.focus();return}
      const result=await activate(employeeNumber,code);renderState();
    }else{
      const pin=pinLogin.sync();if(pin.length!==6){showStatus(COPY.badPin,'error');pinLogin.digits.find(input=>!input.value)?.focus();return}
      const result=await signInWithPin(employeeNumber,pin);renderState();setTimeout(()=>location.assign(requestedNext()),420);
    }
  }catch(error){showStatus(errorMessage(error),'error')}
  finally{setLoginBusy(false)}
});
$('#pinSetupForm').addEventListener('submit',async event=>{
  event.preventDefault();showStatus('');const pin=newPin.sync(),confirm=confirmPin.sync();
  if(pin.length!==6||confirm.length!==6){showStatus(COPY.pinLength,'error');(newPin.digits.find(input=>!input.value)||confirmPin.digits.find(input=>!input.value))?.focus();return}
  if(pin!==confirm){showStatus(COPY.pinMismatch,'error');confirmPin.clear();confirmPin.digits[0]?.focus();return}
  const button=$('#savePinButton');button.disabled=true;showStatus(COPY.savingPin,'neutral');
  try{await setPermanentPin(pin);showStatus(COPY.pinReady,'success');renderState();setTimeout(()=>location.assign(requestedNext()),520)}catch(error){showStatus(errorMessage(error),'error')}
  finally{button.disabled=false}
});
$('#signOutButton').addEventListener('click',async()=>{await signOut();showStatus('');controls.hidden=false;setMode('pin',{focus:false});renderState()});
document.addEventListener('sindhorn:auth-changed',renderState);

setMode(mode,{focus:false});newPin.setDisabled(true);confirmPin.setDisabled(true);
try{await initAuth()}catch(error){showStatus(errorMessage(error),'error')}
renderState();
