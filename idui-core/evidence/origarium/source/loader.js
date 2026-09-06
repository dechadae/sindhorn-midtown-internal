// ORIGARIUM stage-2 loader — lives in the database, updatable by SQL.
// The Netlify shell (stage 1) fetches and runs this. All routing and
// page-serving logic belongs here, never in the shell.
(function(){
  var W = window.__WL || {};
  var H = { apikey: W.KEY, Authorization: "Bearer " + W.KEY };

  var path = location.pathname;
  if(path === "/" || path === "") path = "/index.html";
  if(!/\.html$/.test(path)) path += ".html";

  function fail(){
    var e = document.getElementById("bootErr");
    if(e) e.style.display = "block";
  }

  fetch(W.BASE + "/site_config?key=eq.bootstrap&select=value", { headers: H, cache: "no-store" })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(cfg){
      var v = cfg && cfg[0] && cfg[0].value || {};
      if(v.maintenance){
        document.getElementById("boot").innerHTML =
          "<p><b>pioneer@origarium:~$</b> maintenance</p><p>Back shortly. Nothing is lost — nothing ever is.</p>";
        throw "maintenance";
      }
      var entry = v.entry && path === "/index.html" ? v.entry : path;
      return fetch(W.BASE + "/site_files?path=eq." + encodeURIComponent(entry) + "&select=content", { headers: H, cache: "no-store" });
    })
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(rows){
      if(!rows || !rows[0] || !rows[0].content) throw 0;
      document.open();
      document.write(rows[0].content);
      document.close();
    })
    .catch(function(e){ if(e !== "maintenance") fail(); });
})();