export async function mountPlaceholderRoute(host,{route='route'}={}){
  const labels={fnb:['F&B','Promotions'],messages:['Messages','Messages'],brand:['Brand','Brand'],hotelFactsheet:['Brand','Hotel Factsheet'],ihgHistory:['Brand','Our History'],settings:['Settings','Settings']};
  const [eyebrow,title]=labels[route]||['Sindhorn Midtown','Page'];
  const section=document.createElement('section');
  section.innerHTML=`<header class="app-route-hero"><p class="app-route-eyebrow">${eyebrow}</p><h1 class="app-route-title">${title}</h1><p class="app-route-copy">This route is intentionally not using the old renderer in the clean rebuild preview. Its new page module has not been connected yet.</p></header>`;
  host.replaceChildren(section);
  return()=>section.remove();
}
