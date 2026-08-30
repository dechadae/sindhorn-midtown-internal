import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:8788';
const out=process.env.SCREENSHOT_DIR||'/tmp/business-card-smoke';
const HOTEL='Sindhorn Midtown Hotel Bangkok, Vignette Collection by IHG';
await fs.mkdir(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();
const report={base,checks:{}};

try{
  const response=await page.goto(`${base}/dechak`,{waitUntil:'networkidle'});
  report.checks.status=response?.status();
  if(response?.status()!==200)throw new Error(`Expected /dechak HTTP 200, got ${response?.status()}`);
  await page.locator('#publicCardName').waitFor({state:'visible'});
  const canvasCount=await page.locator('canvas').count();
  if(canvasCount!==0)throw new Error(`Public card must be WebGL/canvas-free, found ${canvasCount} canvas element(s)`);
  report.checks.publicShell={canvasCount,webgl:false};

  const name=(await page.locator('#publicCardName').textContent())?.trim();
  const hotel=(await page.locator('.public-card-hotel').innerText()).replace(/\s+/g,' ').trim();
  const hotelHtml=await page.locator('.public-card-hotel').innerHTML();
  const title=(await page.locator('.public-card-title').textContent())?.trim();
  if(name!=='DECHA KOKAEW')throw new Error(`Name mismatch: ${name}`);
  if(title!=='Senior Graphic Designer')throw new Error(`Title mismatch: ${title}`);
  if(hotel!==HOTEL)throw new Error(`Hotel mismatch: ${hotel}`);
  if(!hotelHtml.includes('<br>'))throw new Error(`Hotel name line break missing: ${hotelHtml}`);
  report.checks.identity={name,title,hotel,lineBreakAfterComma:true};

  const logo=page.locator('.public-card-logo');
  await logo.waitFor({state:'visible'});
  const logoState=await logo.evaluate(img=>({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,renderedWidth:img.getBoundingClientRect().width,insideQr:Boolean(img.closest('[data-card-qr]'))}));
  if(!logoState.src?.includes('sindhorn-midtown-vignette-white.png')||logoState.width<1||logoState.height<1||logoState.insideQr)throw new Error(`Hotel logo placement failed: ${JSON.stringify(logoState)}`);
  if(logoState.renderedWidth<119||logoState.renderedWidth>121)throw new Error(`Hotel logo is not 1.2x original mobile size: ${JSON.stringify(logoState)}`);
  report.checks.logo=logoState;

  const qr=page.locator('[data-card-qr] svg');
  await qr.waitFor({state:'visible'});
  const qrState=await page.locator('[data-card-qr]').evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height}});
  if(qrState.width>313||Math.abs(qrState.width-qrState.height)>1)throw new Error(`QR geometry mismatch: ${JSON.stringify(qrState)}`);
  const qrVisual=await qr.evaluate(svg=>{
    const rects=[...svg.querySelectorAll('rect')];
    return{viewBox:svg.getAttribute('viewBox'),shapeRendering:svg.getAttribute('shape-rendering'),circleCount:svg.querySelectorAll('circle').length,background:{width:rects[0]?.getAttribute('width'),height:rects[0]?.getAttribute('height'),rx:rects[0]?.getAttribute('rx'),fill:rects[0]?.getAttribute('fill')},finderFrames:rects.filter(node=>node.getAttribute('width')==='7'&&node.getAttribute('height')==='7'&&node.getAttribute('rx')==='2.1').length,finderCenters:rects.filter(node=>node.getAttribute('width')==='3'&&node.getAttribute('height')==='3'&&node.getAttribute('rx')==='1').length,dotRadius:svg.querySelector('circle')?.getAttribute('r'),hasEmbeddedImage:Boolean(svg.querySelector('image')),logoInside:Boolean(svg.closest('[data-card-qr]')?.querySelector('.public-card-logo'))};
  });
  if(qrVisual.viewBox!=='0 0 47 47'||qrVisual.shapeRendering!=='geometricPrecision'||qrVisual.circleCount<100||qrVisual.dotRadius!=='0.46')throw new Error(`Flipgazine QR dot contract failed: ${JSON.stringify(qrVisual)}`);
  if(qrVisual.background.width!=='47'||qrVisual.background.height!=='47'||qrVisual.background.rx!=='2.82'||qrVisual.background.fill?.toUpperCase()!=='#F4F1EB')throw new Error(`Flipgazine QR paper contract failed: ${JSON.stringify(qrVisual)}`);
  if(qrVisual.finderFrames!==3||qrVisual.finderCenters!==3||qrVisual.hasEmbeddedImage||qrVisual.logoInside)throw new Error(`Flipgazine QR finder/logo contract failed: ${JSON.stringify(qrVisual)}`);
  report.checks.qr={...qrState,...qrVisual};

  const centeredSelectors=['.public-card-kicker','#publicCardName','.public-card-title','.public-card-hotel','.public-card-detail span','.public-card-detail b'];
  const centered={};
  for(const selector of centeredSelectors){const locator=page.locator(selector).first();if(await locator.count()){const align=await locator.evaluate(node=>getComputedStyle(node).textAlign);centered[selector]=align;if(align!=='center')throw new Error(`${selector} is not centered: ${align}`)}}
  report.checks.centered=centered;

  const website=page.locator('.public-card-detail').filter({hasText:'Hotel website'}).locator('a');
  if((await website.textContent())?.trim()!=='ihg.com')throw new Error(`Hotel website label is not short: ${(await website.textContent())?.trim()}`);
  const websiteHref=await website.getAttribute('href');
  if(!websiteHref?.startsWith('https://www.ihg.com/'))throw new Error(`Hotel website href changed: ${websiteHref}`);
  const cardLink=page.locator('.public-card-panel footer a');
  if((await cardLink.textContent())?.trim()!=='dechak')throw new Error('Business card footer link is not short');
  if((await cardLink.getAttribute('href'))!==`${base}/dechak`)throw new Error(`Business card footer href mismatch: ${await cardLink.getAttribute('href')}`);
  report.checks.shortLinks={hotel:'ihg.com',businessCard:'dechak'};

  const actions=page.locator('.public-card-actions .public-card-action');
  const actionText=(await actions.allTextContents()).map(value=>value.trim());
  for(const expected of ['Add to contacts','Call','Email','Share'])if(!actionText.some(value=>value.toLowerCase()===expected.toLowerCase()))throw new Error(`Missing ${expected} action`);
  const styles=await actions.evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);return{backgroundColor:style.backgroundColor,borderColor:style.borderColor,borderRadius:style.borderRadius,color:style.color,fontSize:style.fontSize,minHeight:style.minHeight}}));
  const styleSignature=JSON.stringify(styles[0]);
  if(styles.some(style=>JSON.stringify(style)!==styleSignature))throw new Error(`Public action styles diverged: ${JSON.stringify(styles)}`);
  report.checks.actions={labels:actionText,uniformStyle:styles[0]};

  const addHref=await page.locator('[data-add-contact]').getAttribute('href');
  if(addHref!==`${base}/dechak.vcf`&&addHref!=='/dechak.vcf')throw new Error(`VCF action href mismatch: ${addHref}`);

  const vcfResponse=await context.request.get(`${base}/dechak.vcf`);
  if(vcfResponse.status()!==200)throw new Error(`Expected /dechak.vcf 200, got ${vcfResponse.status()}`);
  const contentType=vcfResponse.headers()['content-type']||'';
  if(!contentType.toLowerCase().includes('text/vcard'))throw new Error(`VCF content type mismatch: ${contentType}`);
  const vcf=await vcfResponse.text();
  const required=['BEGIN:VCARD','VERSION:3.0','FN:Decha Kokaew','TITLE:Senior Graphic Designer','ORG:Sindhorn Midtown Hotel Bangkok\\, Vignette Collection by IHG','EMAIL;TYPE=WORK:decha.kokaew@ihg.com','TEL;TYPE=WORK:+66-2-7968888','ADR;TYPE=WORK:;;68 Soi Langsuan\\, Lumpini\\, Pathumwan\\, Bangkok 10330\\, Thailand;;;;','END:VCARD'];
  for(const needle of required)if(!vcf.includes(needle))throw new Error(`VCF missing ${needle}`);
  for(const forbidden of ['10639','super_admin','developer','employee_id','auth_user_id','personal_email'])if(vcf.toLowerCase().includes(forbidden.toLowerCase()))throw new Error(`VCF leaked forbidden token ${forbidden}`);
  await fs.writeFile(path.join(out,'decha-kokaew.vcf'),vcf);
  report.checks.vcard={status:vcfResponse.status(),contentType};

  await page.locator('[data-share-card]').click();
  await page.waitForTimeout(150);
  report.checks.shareFallback=(await page.locator('[data-card-status]').textContent())?.trim()||'native-share-or-no-status';

  const html=await page.content();
  for(const forbidden of ['10639','super_admin','developer','employee_id','auth_user_id','personal_email'])if(html.toLowerCase().includes(forbidden.toLowerCase()))throw new Error(`Public HTML leaked forbidden token ${forbidden}`);
  report.checks.noPrivateLeak=true;

  // Auth-free harness for the one centralized Settings modal shell.
  const dialogHarness=await page.evaluate(async()=>{
    document.body.dataset.route='settings';
    document.documentElement.style.setProperty('--settings-viewport-height','844px');
    const loadCss=href=>new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=resolve;document.head.appendChild(link)});
    await Promise.all([loadCss('/settings.css?v=2'),loadCss('/settings-dialog-standard.css?v=1&r=6')]);
    const controller=await import('/settings-dialog-standard.js?v=1');
    const metrics=(surface,scroll)=>{const s=surface.getBoundingClientRect(),r=scroll.getBoundingClientRect();return{surfaceWidth:s.width,scrollWidth:r.width,rightEdgeGap:Math.abs(s.right-r.right),leftEdgeGap:Math.abs(s.left-r.left)}};
    const buttonMetrics=nodes=>[...nodes].filter(node=>!node.hidden).map(node=>{const r=node.getBoundingClientRect();return{label:node.textContent.trim(),width:r.width,height:r.height}});

    const card=document.querySelector('.public-card-panel').cloneNode(true);
    card.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    const close=document.createElement('button');close.className='settings-close';close.type='button';close.textContent='×';card.prepend(close);
    const cardDialog=document.createElement('dialog');cardDialog.className='settings-dialog business-card-present-dialog';cardDialog.append(card);document.body.append(cardDialog);
    await controller.openSettingsDialog(cardDialog);
    const cardScroll=cardDialog.querySelector('.settings-modal-scroll');
    const cardRootStyle=getComputedStyle(cardDialog),cardSurfaceStyle=getComputedStyle(card),cardScrollStyle=getComputedStyle(cardScroll),closeStyle=getComputedStyle(close);
    const cardState={open:cardDialog.open,rootClass:cardDialog.classList.contains('settings-modal-root'),surfaceClass:card.classList.contains('settings-modal-surface'),scrollClass:Boolean(cardScroll?.classList.contains('settings-modal-scroll')),outer:{backgroundColor:cardRootStyle.backgroundColor,overflowY:cardRootStyle.overflowY,paddingRight:cardRootStyle.paddingRight},surface:{backgroundColor:cardSurfaceStyle.backgroundColor,borderRadius:cardSurfaceStyle.borderRadius,width:card.getBoundingClientRect().width},scroll:{overflowY:cardScrollStyle.overflowY,...metrics(card,cardScroll)},close:{width:closeStyle.width,height:closeStyle.height,tapHighlight:closeStyle.webkitTapHighlightColor||''}};
    await controller.closeSettingsDialog(cardDialog);

    const editor=document.createElement('dialog');editor.className='settings-dialog';editor.innerHTML='<form class="settings-dialog-body"><div class="settings-dialog-head"><div><p class="settings-dialog-kicker">People</p><h2>Edit employee</h2></div><button class="settings-close" type="button">×</button></div><div style="height:1000px">Editor content</div><div class="settings-dialog-actions settings-dialog-actions-split"><div></div><div class="settings-action-group"><button type="button">Issue recovery code</button><button type="button">Cancel</button><button type="button">Save</button></div></div></form>';document.body.append(editor);
    await controller.openSettingsDialog(editor);
    const editorSurface=editor.querySelector('.settings-modal-surface'),editorScroll=editor.querySelector('.settings-modal-scroll'),editorButtons=editor.querySelectorAll('.settings-action-group>button');
    const editorRootStyle=getComputedStyle(editor),editorSurfaceStyle=getComputedStyle(editorSurface),editorScrollStyle=getComputedStyle(editorScroll),editorRect=editorSurface.getBoundingClientRect();
    const editorState={open:editor.open,rootClass:editor.classList.contains('settings-modal-root'),surfaceClass:Boolean(editorSurface?.classList.contains('settings-modal-surface')),scrollClass:Boolean(editorScroll?.classList.contains('settings-modal-scroll')),outer:{backgroundColor:editorRootStyle.backgroundColor,overflowY:editorRootStyle.overflowY,paddingRight:editorRootStyle.paddingRight},surface:{backgroundColor:editorSurfaceStyle.backgroundColor,borderRadius:editorSurfaceStyle.borderRadius,width:editorRect.width},scroll:{overflowY:editorScrollStyle.overflowY,scrollHeight:editorScroll.scrollHeight,clientHeight:editorScroll.clientHeight,...metrics(editorSurface,editorScroll)},buttons:buttonMetrics(editorButtons)};
    await controller.closeSettingsDialog(editor);

    const editCard=document.createElement('dialog');editCard.className='settings-dialog';editCard.innerHTML='<form class="settings-dialog-body"><div class="settings-dialog-head"><div><p class="settings-dialog-kicker">My business card</p><h2>Edit card</h2></div><button class="settings-close" type="button">×</button></div><div style="height:820px">Card fields</div><div class="settings-dialog-actions"><button type="button">Cancel</button><button type="button">Save</button></div></form>';document.body.append(editCard);
    await controller.openSettingsDialog(editCard);
    const editCardSurface=editCard.querySelector('.settings-modal-surface'),editCardScroll=editCard.querySelector('.settings-modal-scroll'),editCardButtons=editCard.querySelectorAll('.settings-dialog-actions>button');
    const editCardState={scroll:{...metrics(editCardSurface,editCardScroll)},buttons:buttonMetrics(editCardButtons)};
    await controller.closeSettingsDialog(editCard);

    editCard.remove();editor.remove();cardDialog.remove();delete document.body.dataset.route;document.documentElement.style.removeProperty('--settings-viewport-height');
    return{card:cardState,editor:editorState,editCard:editCardState};
  });
  for(const state of [dialogHarness.card,dialogHarness.editor]){
    if(!state.open||!state.rootClass||!state.surfaceClass||!state.scrollClass)throw new Error(`Central modal structure missing: ${JSON.stringify(dialogHarness)}`);
    if(state.outer.overflowY!=='visible'||!['rgba(0, 0, 0, 0)','transparent'].includes(state.outer.backgroundColor)||state.outer.paddingRight!=='0px')throw new Error(`Outer modal must be footprint-free: ${JSON.stringify(dialogHarness)}`);
    if(state.scroll.overflowY!=='auto')throw new Error(`Only inner modal content may scroll: ${JSON.stringify(dialogHarness)}`);
  }
  if(dialogHarness.card.surface.backgroundColor!==dialogHarness.editor.surface.backgroundColor||dialogHarness.card.surface.borderRadius!==dialogHarness.editor.surface.borderRadius||Math.abs(dialogHarness.card.surface.width-dialogHarness.editor.surface.width)>1)throw new Error(`Card/Edit Employee modal shells diverged: ${JSON.stringify(dialogHarness)}`);
  if(dialogHarness.editor.scroll.scrollHeight<=dialogHarness.editor.scroll.clientHeight)throw new Error(`Editor inner scroller is not actually scrollable: ${JSON.stringify(dialogHarness)}`);
  for(const [name,state] of Object.entries({businessCard:dialogHarness.card,editEmployee:dialogHarness.editor,editCard:dialogHarness.editCard}))if(state.scroll.rightEdgeGap>1.1)throw new Error(`${name} scrollbar is inset from the card edge: ${JSON.stringify(dialogHarness)}`);
  const equalButtons=(name,buttons)=>{if(buttons.length<2)throw new Error(`${name} footer buttons missing: ${JSON.stringify(dialogHarness)}`);const widths=buttons.map(item=>item.width),heights=buttons.map(item=>item.height);if(Math.max(...widths)-Math.min(...widths)>1||Math.max(...heights)-Math.min(...heights)>1)throw new Error(`${name} footer buttons are not equal size: ${JSON.stringify(dialogHarness)}`)};
  equalButtons('Edit Employee',dialogHarness.editor.buttons);
  equalButtons('Edit Card',dialogHarness.editCard.buttons);
  if(dialogHarness.card.close.width!=='36px'||dialogHarness.card.close.height!=='36px')throw new Error(`Standard close control geometry changed: ${JSON.stringify(dialogHarness)}`);
  report.checks.dialogStandard=dialogHarness;

  await page.screenshot({path:path.join(out,'dechak-mobile.png'),fullPage:true});
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
