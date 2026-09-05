/* The shell in public mode, cut from site/index.html (r30 for /share/fnb,
   r31 for the business card at /<slug>).

   A public page is the app shell with the same few changes and nothing
   else: the masthead tools and the navbar are gone (the logo stays as a
   mark, not a button), the PWA identity is not offered (a shared page is
   not the app), and the head carries the page's own title, description,
   canonical and Open Graph tags so a link unfurls before any script runs.
   <body data-public="<mode>"> is what shell.js reads to run in public mode.

   Pure strings in, string out: scripts/generate-fnb-share.mjs runs this in
   Node at deploy and site/_worker.js runs it at the edge for a card, so the
   two public surfaces are one transformation. Each step is asserted: a
   shell edit that moves what this relies on fails the build (or the card
   request) rather than shipping a public page with the app's tools on it. */
export const PUBLIC_SITE_NAME='Sindhorn Midtown';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const meta=(title,url,description)=>[
  `<title>${esc(title)}</title>`,
  `<meta name="description" content="${esc(description)}">`,
  `<link rel="canonical" href="${esc(url)}">`,
  `<meta property="og:site_name" content="${esc(PUBLIC_SITE_NAME)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${esc(url)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta name="twitter:card" content="summary">`
].join('\n');

function cut(html,pattern,replacement,what){const next=html.replace(pattern,replacement);if(next===html)throw new Error(`index.html: ${what} not found`);return next}

/* JSON that is safe inside a <script> element: the three characters that
   could close it or start markup are written as escapes JSON.parse accepts. */
export const scriptJson=data=>JSON.stringify(data).replace(/[<>&\u2028\u2029]/g,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);

/* mode      - the body's data-public value ('fnb' | 'card')
   id        - data-public-id (a promotion id, a card slug)
   robots    - keep the shell's noindex meta (a person's card is not for
               search engines; a promotion may be found)
   bootstrap - { id, data }: a JSON script the page module reads before it
               would otherwise fetch, placed just before the shell script */
export function publicPage(index,{mode,title,url,description,id='',robots=false,bootstrap=null}){
  let html=index;
  html=cut(html,/<title>[^<]*<\/title>\n<meta name="description"[^>]*>/,meta(title,url,description),'title and description');
  if(!robots)html=cut(html,/<meta name="robots"[^>]*>\n/,'','robots');
  html=cut(html,/<!-- PWA identity[\s\S]*?<link rel="apple-touch-icon"[^>]*>\n/,`<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-192.png?v=2">\n`,'PWA identity block');
  html=cut(html,/<link rel="preconnect" href="https:\/\/sindhorn-midtown-alerts[^>]*>\n/,'','alerts preconnect');
  html=cut(html,/<link rel="modulepreload" href="\/notification-inbox\.js">\n<link rel="modulepreload" href="\/broadcast-inbox\.js">\n/,'','inbox preloads');
  html=cut(html,/<body>/,`<body data-public="${esc(mode)}"${id?` data-public-id="${esc(id)}"`:''}>`,'body');
  html=cut(html,/<button class="app-masthead-home" type="button" aria-label="Home">([\s\S]*?)<\/button>/,'<div class="app-masthead-home">$1</div>','masthead home');
  html=cut(html,/\n  <div class="app-masthead-tools">[\s\S]*?\n  <\/div>\n/,'\n','masthead tools');
  html=cut(html,/<nav class="app-navbar"[\s\S]*?<\/nav>\n\n/,'','navbar');
  if(bootstrap)html=cut(html,/<script type="module" src="\/shell\.js"><\/script>/,tag=>`<script type="application/json" id="${esc(bootstrap.id)}">${scriptJson(bootstrap.data)}</script>\n${tag}`,'shell script');
  for(const forbidden of ['app-navbar','app-masthead-account','data-masthead-route','rel="manifest"','apple-mobile-web-app'])if(html.includes(forbidden))throw new Error(`public page still carries ${forbidden}`);
  return html
}
