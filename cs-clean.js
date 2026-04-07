(function(){

var allowed = [
  "sudhirnama.in",
  "www.sudhirnama.in",
  "sudhirnama.blogspot.com"
];

if (allowed.includes(location.hostname)) return;

// watermark only
var wm = document.createElement("div");
wm.innerText = "Unauthorized Use | Chemistry Spark";
wm.style.cssText = "position:fixed;bottom:10px;left:10px;background:#000;color:#fff;padding:6px 10px;z-index:9999;font-size:12px;";
document.body.appendChild(wm);

})();
