const ROUTES=Object.freeze({
  today:{path:'/',title:'Today | Sindhorn Midtown Internal',module:'./routes/today.js',mount:'mountTodayRoute'},
  fnb:{path:'/fnb',title:'F&B | Sindhorn Midtown Internal',module:'./routes/fnb.js',mount:'mountFnbRoute'},
  messages:{path:'/messages',title:'Messages | Sindhorn Midtown Internal',module:'./routes/placeholder.js',mount:'mountPlaceholderRoute'},
  brand:{path:'/brand',title:'Brand | Sindhorn Midtown Internal',module:'./routes/placeholder.js',mount:'mountPlaceholderRoute'},
  hotelFactsheet:{path:'/hotel-factsheet',title:'Hotel Factsheet | Sindhorn Midtown Internal',module:'./routes/placeholder.js',mount:'mountPlaceholderRoute'},
  ihgHistory:{path:'/ihg-history',title:'Our History | Sindhorn Midtown Internal',module:'./routes/placeholder.js',mount:'mountPlaceholderRoute'},
  settings:{path:'/settings',title:'Settings | Sindhorn Midtown Internal',module:'./routes/placeholder.js',mount:'mountPlaceholderRoute'},
  ci:{path:'/ci',title:'UI Library | Sindhorn Midtown Internal',module:'./routes/ci-reference.js',mount:'mountCiReferenceRoute'}
});

const aliases=new Map([
  ['/index.html','today'],['/account','settings'],['/account.html','settings'],['/admin','settings'],['/admin.html','settings']
]);
const byPath=new Map(Object.entries(ROUTES).map(([key,value])=>[value.path,key]));

function normalize(pathname){let path=String(pathname||'/').split('?')[0].split('#')[0]||'/';if(path.length>1&&path.endsWith('/'))path=path.slice(0,-1);return path||'/'}
export function routeKeyForPath(pathname){const path=normalize(pathname);return byPath.get(path)||aliases.get(path)||'today'}
export function routeDefinition(key){return ROUTES[key]||ROUTES.today}
export function routePath(key){return routeDefinition(key).path}
export function allRoutes(){return ROUTES}
