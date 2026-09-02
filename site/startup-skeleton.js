const routeHost=document.getElementById('route-view');

function skeletonMarkup(){
  return `<div class="startup-skeleton" data-startup-skeleton aria-hidden="true">
    <div class="startup-skeleton-grid">
      ${Array.from({length:4},()=>`<div class="startup-skeleton-card"><span class="startup-skeleton-line" data-size="xs"></span><span class="startup-skeleton-line" data-size="lg"></span><span class="startup-skeleton-line" data-size="md"></span></div>`).join('')}
    </div>
    <div class="startup-skeleton-wide"><span class="startup-skeleton-line" data-size="sm"></span><span class="startup-skeleton-line" data-size="lg"></span><span class="startup-skeleton-line" data-size="md"></span></div>
    <div class="startup-skeleton-list">
      <div class="startup-skeleton-row"></div><div class="startup-skeleton-row"></div><div class="startup-skeleton-row"></div>
    </div>
    <p class="startup-skeleton-status">Loading today’s approved business data…</p>
  </div>`;
}

function syncRoute(route){
  if(!(route instanceof HTMLElement)||!route.classList.contains('business-dashboard-route'))return;
  const busy=route.getAttribute('aria-busy')==='true';
  const existing=route.querySelector(':scope > [data-startup-skeleton]');
  if(busy&&!existing)route.insertAdjacentHTML('beforeend',skeletonMarkup());
  if(!busy&&existing)existing.remove();
}

function scan(){routeHost?.querySelectorAll('.business-dashboard-route').forEach(syncRoute)}

if(routeHost){
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes')syncRoute(record.target);
      if(record.type==='childList'){
        record.addedNodes.forEach(node=>{
          if(!(node instanceof HTMLElement))return;
          syncRoute(node);
          node.querySelectorAll?.('.business-dashboard-route').forEach(syncRoute);
        });
      }
    }
  });
  observer.observe(routeHost,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy']});
  scan();
}
