(function () {

  // === CONFIG ===
  var ALLOWED = [
    "sudhirnama.in",
    "www.sudhirnama.in",
    "sudhirnama.blogspot.com"
  ];

  var BRAND = "Unauthorized Theme | Chemistry Spark";

  var host = location.hostname;
  var href = location.href;
  var ref  = document.referrer || "";

  // ===============================
  // ✅ BLOGGER ENV DETECTION (FINAL FIX)
  // ===============================
  var isBloggerEnv =
    host === "draft.blogger.com" ||

    // ⭐ CRITICAL: preview iframe domain
    host.includes("bloggerusercontent.com") ||

    // fallback checks
    ref.includes("draft.blogger.com") ||
    ref.includes("blogger.com") ||
    href.includes("/preview") ||
    href.includes("/edit") ||

    // DOM-level detection (extra safety)
    document.querySelector('[data-blogger-version]');

  if (isBloggerEnv) return;

  // ===============================
  // ✅ DOMAIN WHITELIST
  // ===============================
  var valid = ALLOWED.some(function (d) {
    return host === d;
  });

  if (valid) return;

  // ===============================
  // 🚨 UNAUTHORIZED MODE (MEDIUM)
  // ===============================

  function showWatermark() {
    var wm = document.createElement("div");
    wm.innerText = BRAND;

    wm.style.cssText = [
      "position:fixed",
      "bottom:10px",
      "left:10px",
      "z-index:2147483647",
      "background:rgba(0,0,0,0.85)",
      "color:#fff",
      "padding:8px 14px",
      "font-size:13px",
      "border-radius:6px",
      "font-family:sans-serif",
      "pointer-events:none"
    ].join(";");

    document.body.appendChild(wm);
  }

  function breakStyles() {
    var s = document.createElement("style");

    s.innerHTML = [
      "body{filter:blur(1.5px) grayscale(0.4)!important;}",
      "img, svg{opacity:0.6!important;}",
      "h1,h2,h3{letter-spacing:2px!important;color:#999!important;}",
      ".post, .post-body, section{margin:-5px!important;}",
      ".post-body{pointer-events:none!important;user-select:none!important;}"
    ].join("");

    document.head.appendChild(s);
  }

  function freezeClicks() {
    document.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  function killFunctions() {
    [
      "generatePostPDF",
      "autoInternalLink",
      "initPremiumWidget"
    ].forEach(function (fn) {
      if (typeof window[fn] === "function") {
        window[fn] = function () { return false; };
      }
    });
  }

  function run(){
    showWatermark();
    breakStyles();
    freezeClicks();
    killFunctions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

})();
