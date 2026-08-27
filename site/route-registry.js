export const ROUTES=Object.freeze({
  today:Object.freeze({path:'/',title:'Live Air Quality | Sindhorn Midtown Hotel Bangkok',kind:'pack',resource:'today.html'}),
  guidance:Object.freeze({path:'/guidance',title:'Air Quality Guidance | Sindhorn Midtown Hotel Bangkok',kind:'pack',resource:'guidance.html'}),
  details:Object.freeze({path:'/details',title:'Reading Details | Sindhorn Midtown Hotel Bangkok',kind:'pack',resource:'details.html'}),
  messages:Object.freeze({path:'/messages',title:'Environmental Messages | Sindhorn Midtown Hotel Bangkok',kind:'pack',resource:'messages.html'}),
  account:Object.freeze({path:'/account',title:'My account | Sindhorn Midtown Internal',kind:'local',module:'./account.js',mount:'mountAccountRoute'}),
  admin:Object.freeze({path:'/admin',title:'Admin | Sindhorn Midtown Internal',kind:'local',module:'./admin.js',mount:'mountAdminRoute'})
});

const PATH_TO_ROUTE=new Map(Object.entries(ROUTES).map(([key,value])=>[value.path,key]));
const LEGACY_ALIASES=new Map([['/index.html','today'],['/account.html','account'],['/admin.html','admin']]);

function normalizePath(pathname){
  let path=String(pathname||'/').split('?')[0].split('#')[0]||'/';
  if(path.length>1&&path.endsWith('/'))path=path.slice(0,-1);
  return path||'/';
}

export function routeForPath(pathname){
  const path=normalizePath(pathname);
  return PATH_TO_ROUTE.get(path)||LEGACY_ALIASES.get(path)||null;
}

export function routePath(route){return ROUTES[route]?.path||ROUTES.today.path}
export function routeTitle(route){return ROUTES[route]?.title||ROUTES.today.title}
export function isAppRoutePath(pathname){return routeForPath(pathname)!==null}
export function canonicalRoute(route){return ROUTES[route]?route:'today'}
