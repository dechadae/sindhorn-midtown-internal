import {APPROVED_CI_BRANCH,APPROVED_CI_SHA,APPROVED_CI_URL} from '../approved-ci-authority.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function mountCiReferenceRoute(host){
  host.innerHTML=`<section class="ui-reference-route"><header class="app-route-hero"><p class="app-route-eyebrow">UI Authority</p><h1 class="app-route-title">Approved CI Preview</h1><p class="app-route-copy">The clean rebuild does not recreate or restyle the CI library. Its visual and interaction authority is the approved preview branch below.</p></header><article class="ui-card"><p class="ui-eyebrow">Frozen source</p><h2>preview-ci-glass</h2><p class="ui-copy">Branch ${esc(APPROVED_CI_BRANCH)} · ${esc(APPROVED_CI_SHA)}</p><div class="app-utility-actions"><a class="app-utility-action" href="${esc(APPROVED_CI_URL)}" target="_blank" rel="noopener">Open approved CI preview</a></div></article></section>`;
  return()=>host.replaceChildren();
}
