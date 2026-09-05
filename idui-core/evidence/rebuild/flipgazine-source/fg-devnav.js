/* fg-devnav.js — Flipgazine session, Google sign-in, and the account menu.
   One copy, fetched by every page. Previously this was pasted inline into
   seven files and had already drifted: two of them carried a different
   tooltip. Loaders cache the source, so a failed fetch falls back to the last
   good copy rather than removing the only route to sign-in.
   Gated at the foot: the nav is built only after the live session has also
   passed Flipgazine's invite check, so an unrelated Supabase account never
   receives private navigation. */
(function(){
  var SB="https://sjpvhgxacsiorrtijqua.supabase.co";
  var KEY="FG_ANON_KEY_REDACTED";
  var FG_SESSION_KEY="sb-sjpvhgxacsiorrtijqua-auth-token";
  var FG_ACCESS_KEY="fg:access";
  /* Page-level paragraph rules used to make the same shared modal 290px tall
     on CI, 293px on Pilot and 313px elsewhere. CI is the visual authority;
     inject its rendered copy metrics after page CSS so every modal is exact. */
  function ensureModalStyle(){
    if(document.getElementById('fgDevChromeCanonical')) return;
    var s=document.createElement('style');
    s.id='fgDevChromeCanonical';
    s.textContent=[
      '.fgwarn{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .28s var(--ease-soft),background .28s var(--ease-soft),visibility 0s linear .28s;}',
      '.fgwarn.open{opacity:1;visibility:visible;pointer-events:auto;background:rgba(0,0,0,.86);transition:opacity .28s var(--ease-soft),background .28s var(--ease-soft);}',
      '.fgwarn .confirm-sheet{max-width:min(420px,90vw);background:var(--glass);border:1px solid var(--glass-brd);border-radius:16px;padding:26px 24px;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);transform:translateY(10px) scale(.97);opacity:0;transition:transform .32s var(--ease-spring,cubic-bezier(.22,1,.36,1)),opacity .22s var(--ease-soft);}',
      '.fgwarn.open .confirm-sheet{transform:none;opacity:1;}',
      '.fgwarn h3{margin:0 0 10px;font-size:15px;font-weight:500;color:var(--text);}',
      '.fgwarn p{margin:0 0 22px;font-size:13.5px;line-height:1.65;color:var(--muted);}',
      '.fgwarn .confirm-actions{display:grid;grid-template-columns:1fr;gap:10px;}',
      '.fgwarn .confirm-actions.two{grid-template-columns:1fr 1fr;}',
      '.fgwarn .cf-go{color:var(--warn,#E8792B);border-color:rgba(232,121,43,.45);}',
      '.fgwarn .cf-go:hover,.fgwarn .cf-go:focus-visible{background:var(--warn,#E8792B);border-color:var(--warn,#E8792B);color:#fff;outline:none;}',
      '.fgwarn .confirm-actions button{font-family:inherit;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:500;min-height:44px;padding:0 14px;border-radius:22px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:var(--glass);border:1px solid var(--glass-brd);color:var(--muted);transition:background .2s var(--ease-soft),border-color .2s var(--ease-soft),color .2s var(--ease-soft);}',
      '.fgwarn .cf-keep:hover,.fgwarn .cf-keep:focus-visible{border-color:rgba(var(--accent-rgb),.55);color:var(--accent);outline:none;}',
      '#fgDevNav{position:fixed;z-index:2900;}',
      '#fgDevTrigger{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;padding:0;color:var(--accent);background:var(--glass);border:1px solid var(--glass-brd);cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:border-color .28s var(--ease-soft);}',
      '#fgDevTrigger:hover,#fgDevNav.open #fgDevTrigger{border-color:var(--accent);}',
      '#fgDevMenu{position:absolute;top:calc(100% + 8px);right:0;display:none;flex-direction:column;gap:4px;min-width:170px;padding:8px;border-radius:14px;background:var(--glass);border:1px solid var(--glass-brd);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 14px 34px rgba(0,0,0,.32);}',
      '#fgDevNav.open #fgDevMenu{display:flex;}',
      '#fgDevMenu a{font-family:"Poppins",system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.4;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);background:none;border-radius:10px;padding:7px 10px;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .2s var(--ease-soft);}',
      '#fgDevMenu a:hover{background:rgba(var(--accent-rgb),.14);}'
    ].join('');
    (document.head||document.documentElement).appendChild(s);
  }
  ensureModalStyle();
  function clearSession(){
    try{
      localStorage.removeItem(FG_SESSION_KEY);
      localStorage.removeItem('fg:devuser');
      localStorage.removeItem(FG_ACCESS_KEY);
    }catch(e){}
  }
  function accessFor(session){
    if(!session||!session.access_token) return Promise.resolve({role:'none',email:''});
    return fetch(SB+'/rest/v1/rpc/fg_claim_access',{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+session.access_token},
      body:'{}'
    }).then(function(r){ return r.ok?r.json():{role:'none'}; })
      .then(function(a){
        a=a||{role:'none'};
        if(a.role==='developer'||a.role==='member'){
          try{ localStorage.setItem(FG_ACCESS_KEY,JSON.stringify(a)); }catch(e){}
          return a;
        }
        clearSession();
        return {role:'none',email:a.email||'',reason:a.reason||'not_invited'};
      })['catch'](function(){ return {role:'pending',email:(session.user&&session.user.email)||''}; });
  }
  /* Google returns with the tokens in the URL fragment. The shell also stashes
     that fragment before its asynchronous page paint: mobile Safari can apply
     the visible hash after a cached page has already started executing. Keep
     the stash until the session is safely in localStorage so a reload can retry
     a dropped network handoff without asking the member to sign in again. */
function handleOAuthReturn(){
  var raw=location.hash||'';
  if(raw.indexOf('access_token=')<0){
    try{ raw=sessionStorage.getItem('fg:oauthHash')||''; }catch(e){ raw=''; }
  }
  if(raw.indexOf('access_token=')<0){
    try{ raw=localStorage.getItem('fg:oauthHash')||''; }catch(e){ raw=''; }
  }
  if(raw.indexOf('access_token=')<0) return;
  var p={};
  raw.replace(/^#/,'').split('&').forEach(function(kv){
    var i=kv.indexOf('=');
    if(i>0) p[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1));
  });
  if(!p.access_token) return;
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  fetch(SB+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+p.access_token}})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(u){
      var secs=Number(p.expires_in||3600);
      var saved=false;
      try{
        localStorage.setItem(FG_SESSION_KEY, JSON.stringify({
          access_token:p.access_token,
          refresh_token:p.refresh_token||'',
          token_type:p.token_type||'bearer',
          expires_in:secs,
          expires_at:Number(p.expires_at||(Math.floor(Date.now()/1000)+secs)),
          user:u
        }));
        if(u&&u.email) localStorage.setItem('fg:devuser',u.email);
        saved=true;
      }catch(e){}
      if(saved){
        try{ sessionStorage.removeItem('fg:oauthHash'); }catch(e){}
        try{
          localStorage.removeItem('fg:oauthHash');
          sessionStorage.removeItem('fg:oauthBootRetries');
        }catch(e){}
        try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
      }
      return accessFor(fgReadSession()).then(function(access){
        if(access.role==='none'){
          /* Not on the invite list. Google authenticated them; Flipgazine
             will not seat them. Said plainly, in the same frame every other
             warning in the product uses. */
          fgWarn('This account is not invited.',
            'Flipgazine is invite-only. Sign in with an account that has been added to the workspace, or ask for this one to be added.');
          return;
        }
        if(typeof badge==='function') badge(access.role);
        try{ window.dispatchEvent(new CustomEvent('fg:signedin',{detail:access})); }catch(e){}

        /* OAuth always returns through the one allow-listed home URL. A relative
           same-origin path recorded before leaving restores the page that asked
           for sign-in without creating an open redirect. */
        var dest='';
        try{
          dest=sessionStorage.getItem('fg:oauthReturn')||localStorage.getItem('fg:oauthReturn')||'';
          sessionStorage.removeItem('fg:oauthReturn');
          localStorage.removeItem('fg:oauthReturn');
        }catch(e){}
        if(dest.charAt(0)==='/'&&dest.charAt(1)!=='/'&&dest!==location.pathname){
          location.replace(dest);
        }
      });
    })['catch'](function(){});
}
handleOAuthReturn();


  /* Keeping the session alive.
     Only admin and moodboard load the Supabase SDK, and only the SDK refreshes
     a token — so on the other five pages the session simply died after the
     hour set on the dashboard. This does what the SDK does: trades the refresh
     token for a new session when the current one is close to lapsing. Refresh
     tokens do not expire by default, so the hour stays as a backstop rather
     than a working limit.
     Skipped where the SDK is present: two refreshers racing for the same
     refresh token is how a good session gets invalidated. */
  function fgReadSession(){
    try{ var r=localStorage.getItem(FG_SESSION_KEY); return r?JSON.parse(r):null; }
    catch(e){ return null; }
  }
  function fgRefresh(){
    if(window.supabase) return Promise.resolve(fgReadSession());
    var s=fgReadSession();
    if(!s||!s.refresh_token) return Promise.resolve(s);
    var exp=Number(s.expires_at||0);
    /* Ten minutes of headroom: long enough that a page opened now will not
       lapse mid-use, wide enough not to refresh on every single page view. */
    if(exp && exp*1000 > Date.now()+600000) return Promise.resolve(s);
    return fetch(SB+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:KEY},
      body:JSON.stringify({refresh_token:s.refresh_token})
    }).then(function(r){ return r.ok?r.json():null; })
      .then(function(d){
        /* A failed refresh is usually a dropped connection, not a revoked
           session. Keep what we have rather than signing the person out. */
        if(!d||!d.access_token) return s;
        try{
          localStorage.setItem(FG_SESSION_KEY, JSON.stringify({
            access_token:d.access_token,
            refresh_token:d.refresh_token||s.refresh_token,
            token_type:d.token_type||'bearer',
            expires_in:d.expires_in,
            expires_at:d.expires_at||(Math.floor(Date.now()/1000)+(d.expires_in||3600)),
            user:d.user||s.user||null
          }));
        }catch(e){}
        try{ window.dispatchEvent(new CustomEvent('fg:refreshed')); }catch(e){}
        return fgReadSession();
      })['catch'](function(){ return s; });
  }
  /* Pages that read the token directly await this before doing so. */
  window.fgSessionReady=fgRefresh().then(function(s){
    return accessFor(s).then(function(a){
      window.fgAccess=a;
      return (a.role==='developer'||a.role==='member'||a.role==='pending')?fgReadSession():null;
    });
  });
  window.fgAccessReady=window.fgSessionReady.then(function(){ return window.fgAccess||{role:'none'}; });

  /* A session, not merely a stored token: check it exists and has not expired,
     so the chips stop claiming you are signed in after it lapses. */
  function fgSession(){
    try{
      var raw=localStorage.getItem(FG_SESSION_KEY);
      if(!raw) return null;
      var s=JSON.parse(raw);
      if(!s||!s.access_token) return null;
      if(s.expires_at && (s.expires_at*1000) < Date.now()) return null;
      return s;
    }catch(e){ return null; }
  }
  function badge(role){ if(document.getElementById('fgDevNav')) return;
    var dia='\u25C6';
    var links=role==='developer' ? [
      {id:'fgBrandChip', href:'/ci.html', label:'identity', title:'Open the corporate identity'},
      {id:'fgVoiceChip', href:'/voice.html', label:'voice', title:'Open the Thai voice and tone guide'},
      {id:'fgHumanEvalChip', href:'/human-eval.html', label:'human eval', title:'Open the human evaluation record'},
      {id:'fgPilotChip', href:'/sindhornmidtown/pilot.html', label:'proposal', title:'Open the pilot proposal'},
      {id:'fgTasksChip', href:'/sindhornmidtown/job-tracking.html', label:'tracker', title:'Open the job tracking board'},
      {id:'fgMoodsChip', href:'/sindhornmidtown/moodboard.html', label:'mood board', title:'Open the shoot mood board'},
      {id:'fgActionPlanChip', href:'/action-plan.html', label:'action plan', title:'Open the action plans'},
      {id:'fgSpecsChip', href:'/sindhornmidtown/spec-library.html', label:'specs', title:'Open the print and screen specification library'},
      {id:'fgAnswersChip', href:'/answers.html', label:'answers', title:'Open the Book of Answers'},
      {id:'fgAnswersEditorChip', href:'/answers-admin.html', label:'answer library', title:'Review and edit the Answers library'},
      {id:'fgDataRoomChip', href:'/dataroom.html', label:'data room', title:'Open the private Answers buyer data room'},
      {id:'fgTcjResearchChip', href:'/tcj-research.html', label:'tcj research', title:'Run private TCJ research and calibration experiments'},
      {id:'fgThaiAuditChip', href:'/answers-thai-review.html', label:'thai audit', title:'Audit and edit Thai Answers copy'},
      {id:'fgClaudeChip', href:'/claude-code.html', label:'claude guide', title:'Open the Claude Code manual'},
      {id:'fgPrivacyChip', href:'/privacy.html', label:'privacy', title:'What Flipgazine stores, and why'},
      {id:'fgTermsChip', href:'/terms.html', label:'terms', title:'Terms of use'},
      /* Public pages, linked here because the two policies Google requires are
         otherwise reachable only by typing the address. */
      /* Public, and linked here because the two policy pages Google requires
         are otherwise reachable only by typing the address. */
      {id:'fgDevBadge', href:'/admin.html', label:'admin', title:'Open the admin page'}
    ] : [
      {id:'fgBrandChip', href:'/ci.html', label:'identity', title:'Open the corporate identity'},
      {id:'fgVoiceChip', href:'/voice.html', label:'voice', title:'Open the Thai voice and tone guide'},
      {id:'fgTasksChip', href:'/sindhornmidtown/job-tracking.html', label:'tracker', title:'Open your job tracking board'},
      {id:'fgMoodsChip', href:'/sindhornmidtown/moodboard.html', label:'mood board', title:'Open your mood boards'},
      {id:'fgActionPlanChip', href:'/action-plan.html', label:'action plan', title:'Open the action plans'},
      {id:'fgSpecsChip', href:'/sindhornmidtown/spec-library.html', label:'specs', title:'Open your print and screen specification library'},
      {id:'fgAnswersChip', href:'/answers.html', label:'answers', title:'Open the Book of Answers'},
      {id:'fgPrivacyChip', href:'/privacy.html', label:'privacy', title:'What Flipgazine stores, and why'},
      {id:'fgTermsChip', href:'/terms.html', label:'terms', title:'Terms of use'}
    ];

    var nav=document.createElement('div'); nav.id='fgDevNav';
    var trigger=document.createElement('button'); trigger.type='button'; trigger.id='fgDevTrigger';
    trigger.setAttribute('aria-haspopup','true'); trigger.setAttribute('aria-expanded','false');
    trigger.title='Dev links'; trigger.textContent=dia;

    var menu=document.createElement('div'); menu.id='fgDevMenu';
    links.forEach(function(l){
      var a=document.createElement('a'); a.id=l.id; a.href=l.href; a.title=l.title;
      a.textContent=dia+' '+l.label;
      menu.appendChild(a);
    });

    /* Desktop view. In an installed PWA there is no browser chrome, so the
       OS "Request desktop site" item does not exist — rewriting the viewport
       meta is the same lever that menu pulls. Appended rather than added to
       the links array: it navigates nowhere and its label tracks state.
       Present on every device so the menu holds the same chips wherever it is
       opened; on a wide desktop 1240px is narrower than the window and the
       toggle simply does nothing visible. */
    var WIDE_KEY="fg:wideViewport", WIDE_W=1240;
    function wideOn(){ try{ return localStorage.getItem(WIDE_KEY)==="1"; }catch(e){ return false; } }
    function applyWide(on){
      var old=document.querySelector('meta[name="viewport"]');
      if(old&&old.parentNode) old.parentNode.removeChild(old);
      /* Replacing the node instead of setting .content: iOS frequently ignores
         an in-place change and keeps the old layout width. */
      var m=document.createElement("meta");
      m.name="viewport";
      /* viewport-fit=cover in both states, or every env(safe-area-inset-*)
         collapses to zero and the fixed bars sit under the home indicator. */
      m.content = on ? ("width="+WIDE_W+", viewport-fit=cover")
                     : "width=device-width, initial-scale=1.0, viewport-fit=cover";
      document.head.appendChild(m);
    }
    var wideChip=document.createElement("a");
    wideChip.id="fgWideChip"; wideChip.href="#";
    function paintWide(){
      wideChip.textContent=dia+" "+(wideOn()?"mobile view":"desktop view");
      wideChip.title=wideOn() ? "Back to device width"
                              : ("Lay the page out at "+WIDE_W+"px and scale it down");
    }
    wideChip.addEventListener("click",function(e){
      e.preventDefault(); e.stopPropagation();
      var next=!wideOn();
      try{ localStorage.setItem(WIDE_KEY,next?"1":"0"); }catch(err){}
      applyWide(next); paintWide(); closeNav();
      /* The diamond is positioned off measured rects, so it has to be placed
         again once the new viewport has actually reflowed. */
      setTimeout(placeNav,150);
    });
    paintWide();
    menu.appendChild(wideChip);

    nav.appendChild(trigger); nav.appendChild(menu);
    document.body.appendChild(nav);

    function closeNav(){ nav.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); }
    trigger.addEventListener('click',function(e){
      e.stopPropagation();
      var open=nav.classList.toggle('open');
      trigger.setAttribute('aria-expanded',String(open));
    });
    document.addEventListener('click',function(e){ if(!nav.contains(e.target)) closeNav(); });

    /* The header persists between compatible pages, so its open state must not. */
    menu.addEventListener('click',function(e){
      var target=e.target;
      var link=target&&target.closest?target.closest('a[href]'):null;
      if(link) closeNav();
    });
    addEventListener('fg:pagechange',closeNav);
    addEventListener('popstate',closeNav);

    /* Clear of the header bar, right-aligned to the atmosphere toggle. The top
       comes from the header itself, not the switch, so the menu never sits over
       the bar's lower edge. */
    function placeNav(){
      var hdr=document.querySelector('header');
      if(!hdr) return;
      var h=hdr.getBoundingClientRect();
      var sw=document.getElementById('edSwitch');
      var r=sw?sw.getBoundingClientRect():h;
      nav.style.top=(h.bottom+10)+'px';
      nav.style.right=(window.innerWidth-r.right)+'px';
    }
    placeNav();
    window.addEventListener('resize',placeNav);
    setTimeout(placeNav,400); }
  /* ---- Google sign-in ------------------------------------------------------
     Identity Services, prompted in place. The sheet slides up from the bottom
     of the page rather than navigating to Google and back, which matters here
     because the shell rebuilds every page with document.write -- a full round
     trip discards whatever you were looking at.
     The centred, branded chooser was tried and abandoned: it needs the OAuth
     authorize URL opened directly, and that surface reads the Supabase host
     rather than the app name until consent-screen verification clears.
     If the script is blocked, or Google declines to prompt, the full-page
     redirect still runs. */
  var GOOGLE_CLIENT_ID="737242809814-nm23jbp7i8seancc4dv27iq226ikgccn.apps.googleusercontent.com";
  var gisReady=null;
  /* Identity Services embeds a nonce in the ID token whenever one is supplied,
     and Supabase rejects the exchange unless it receives the same value --
     "passed nonce and nonce in id_token should either both exist or not".
     One nonce is generated per attempt, handed to Google, and replayed to
     Supabase, which is also what makes the token single-use. */
  var authNonce=null;
  function makeNonce(){
    var a=new Uint8Array(16);
    (window.crypto||window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a,function(b){
      return ("0"+b.toString(16)).slice(-2);
    }).join("");
  }
  /* Google is given the SHA-256 of the nonce and embeds that hash in the
     token; Supabase is given the raw value and hashes it again to compare.
     Sending the same string to both is what produced "nonces mismatch" -- the
     hash in the token never equalled the raw value we passed. */
  function sha256hex(s){
    var enc=new TextEncoder().encode(s);
    return crypto.subtle.digest("SHA-256",enc).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf),function(b){
        return ("0"+b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function loadGis(){
    if(gisReady) return gisReady;
    gisReady=new Promise(function(res,rej){
      if(window.google&&google.accounts&&google.accounts.id) return res();
      var s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';
      s.async=true; s.defer=true;
      s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
    return gisReady;
  }

  function redirectSignIn(){
    try{
      sessionStorage.setItem('fg:oauthReturn',location.pathname+location.search);
      localStorage.setItem('fg:oauthReturn',location.pathname+location.search);
    }catch(e){}
    location.href=SB+'/auth/v1/authorize?provider=google&redirect_to='+
      encodeURIComponent(location.origin+'/home.html');
  }

  /* No message surface on the page, so these land in the console. Anything a
     person needs to read goes through fgWarn instead. */
  function note(t){ try{ console.info('[fg-auth] '+t); }catch(e){} }

  /* The credential is a Google ID token. Supabase verifies it server-side and
     issues its own session, so nothing here trusts the token itself. */
  function onCredential(resp){
    if(!resp||!resp.credential){ redirectSignIn(); return; }
    note('exchanging credential');
    fetch(SB+'/auth/v1/token?grant_type=id_token',{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:KEY},
      body:JSON.stringify({provider:'google',id_token:resp.credential,nonce:authNonce})
    }).then(function(r){ return r.json(); }).then(function(d){
      if(!d||!d.access_token){ note(d&&d.error_description||'sign-in refused'); return; }
      /* Written in the shape supabase-js expects, so every page that reads the
         session finds it without this module having to load the library. */
      try{
        localStorage.setItem(FG_SESSION_KEY,JSON.stringify({
          access_token:d.access_token, refresh_token:d.refresh_token,
          expires_at:Math.floor(Date.now()/1000)+(d.expires_in||3600),
          expires_in:d.expires_in, token_type:'bearer', user:d.user
        }));
      }catch(e){}
      location.reload();
    })["catch"](function(){ redirectSignIn(); });
  }

  /* Lifted from askConfirm in moodboard.html -- same lightbox frame, same
     confirm-sheet, same button metrics, so a refused sign-in looks like every
     other warning in the product. One button: there is nothing to confirm.
     The rules ride along in ensureChromeStyle because no page carries them. */
  function fgDialog(opts,onYes){
    var box=document.getElementById('fgWarnBox');
    if(!box){
      box=document.createElement('div');
      box.id='fgWarnBox'; box.className='lightbox confirm-box fgwarn';
      box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
      box.innerHTML='<div class="confirm-sheet"><h3></h3><p></p>'+
        '<div class="confirm-actions">'+
        '<button type="button" class="cf-keep"></button>'+
        '<button type="button" class="cf-go"></button>'+
        '</div></div>';
      document.body.appendChild(box);
      box.addEventListener('click',function(e){
        if(e.target===box||e.target.closest('.cf-keep')){ closeWarn(); return; }
        if(e.target.closest('.cf-go')){
          var fn=box.__yes;
          closeWarn();
          if(fn) fn();
        }
      });
      document.addEventListener('keydown',function(e){
        if(e.key==='Escape'&&box.classList.contains('open')) closeWarn();
      });
    }
    var go=box.querySelector('.cf-go'), keep=box.querySelector('.cf-keep');
    box.querySelector('h3').textContent=opts.title||'';
    box.querySelector('p').textContent=opts.body||'';
    /* No callback means nothing to agree to, so the sheet carries one button
       and the grid collapses to a single column. */
    go.hidden=!onYes;
    go.textContent=opts.confirmLabel||'Continue';
    keep.textContent=opts.cancelLabel||(onYes?'Cancel':'Close');
    box.querySelector('.confirm-actions').classList.toggle('two',!!onYes);
    box.__yes=onYes||null;
    box.classList.add('open');
    /* Focus lands on Cancel, so Enter never confirms. */
    setTimeout(function(){ keep.focus(); },60);
  }
  function fgWarn(title,body){ fgDialog({title:title,body:body}); }
  /* Admin owns its own sign-out button and needs the two-button form. */
  window.fgConfirm=function(opts,onYes){ fgDialog(opts||{},onYes); };
  function closeWarn(){
    var box=document.getElementById('fgWarnBox');
    if(box) box.classList.remove('open');
  }

  function signIn(){
    loadGis().then(function(){
      authNonce=makeNonce();
      return sha256hex(authNonce).then(function(hashed){
        google.accounts.id.initialize({
          client_id:GOOGLE_CLIENT_ID,
          callback:onCredential,
          nonce:hashed,
          auto_select:false,
          cancel_on_tap_outside:true,
          /* Google retired the floating corner-card One Tap UI in favour of
             FedCM. On Chrome/Android, FedCM's own UI is the native slide-up
             account chooser -- without opting in here explicitly, the legacy
             path increasingly reports the prompt as not-displayed and this
             falls back to the full-page redirect below, which read as a
             regression to "fullscreen" even though nothing here changed. */
          use_fedcm_for_prompt:true
        });
        google.accounts.id.prompt(function(n){
          /* Only isNotDisplayed means the prompt never showed at all -- no
             eligible session, blocked script, no FedCM support -- and that is
             the one case worth a fallback. isSkippedMoment fires as a normal
             part of the FedCM lifecycle even after the chooser has already
             rendered (dismissed, backgrounded, tapped outside), and treating
             that as failure too meant the slide-up would flash and then get
             yanked into the full-page redirect a beat later. Falling back
             only on isNotDisplayed leaves a skipped/dismissed chooser as a
             quiet no-op, same as declining any other native prompt. */
          if(n&&n.isNotDisplayed&&n.isNotDisplayed()) redirectSignIn();
        });
      });
    })["catch"](redirectSignIn);
  }

  /* Sign-in has exactly one entry point: the workspace card on /home.html,
     wired below. No footer gesture, no exported handle, no intermediate
     dialog -- the button goes straight to Google's chooser, which already
     carries the app name and mark. */
  function accountControl(){
    var btn=document.getElementById('fgAccountSignIn');
    var status=document.getElementById('fgAccountStatus');
    var name=document.getElementById('fgAccountName');
    if(!btn||!status||!name) return;

    var s=fgSession();
    var email=s&&s.user&&s.user.email;
    if(!email){
      try{ email=localStorage.getItem('fg:devuser')||''; }catch(e){ email=''; }
    }
    if(s&&email){
      name.textContent=email;
      btn.hidden=true;
      status.hidden=false;
    }else{
      name.textContent='';
      status.hidden=true;
      btn.hidden=false;
    }

    /* A persistent Home payload can be mounted more than once. Bind each new
       button exactly once while keeping the shared window listeners singular. */
    if(!btn.dataset.fgAccountWired){
      btn.dataset.fgAccountWired='1';
      btn.addEventListener('click',function(){ signIn(); });
    }
    if(!accountControl.eventsWired){
      accountControl.eventsWired=true;
      window.addEventListener('fg:signedin',accountControl);
      window.addEventListener('fg:refreshed',accountControl);
      window.addEventListener('storage',function(e){
        if(e.key===FG_SESSION_KEY||e.key==='fg:devuser') accountControl();
      });
    }
    if(!accountControl.readyWired){
      accountControl.readyWired=true;
      Promise.resolve(window.fgSessionReady||null).then(accountControl);
    }
  }
  window.FGAccountControl=accountControl;
  accountControl();

  Promise.resolve(window.fgAccessReady||null).then(function(a){
    if(fgSession()&&a&&(a.role==='developer'||a.role==='member')) badge(a.role);
  });
})();
