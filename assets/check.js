/* 手机访问自检页 */
(function () {
  window.Store.init();
  var $ = function (id) { return document.getElementById(id); };
  var isHttp = location.protocol === "http:" || location.protocol === "https:";
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var lan = window.__LAN_IP || null;
  var port = location.port || "80";
  var dir = location.pathname.replace(/[^\/]*$/, "");
  var lanUrl = lan ? "http://" + lan + ":" + port + dir : null;
  var target = lanUrl || (isHttp ? location.origin + dir : null);

  $("curUrl").textContent = location.href;
  $("lanIp").textContent = lan || "未检测到";
  $("srvState").textContent = isHttp ? "在运行（当前通过本机服务器打开）" : "不是通过服务器打开的（file:// 直接打开）";
  $("lanUrl").textContent = target || "（当前是本地文件打开，无法给手机提供地址）";
  $("openBtn").href = target || "#";
  $("copyBtn").onclick = function () {
    var btn = this;
    if (!target) return;
    if (navigator.clipboard) navigator.clipboard.writeText(target);
    btn.textContent = "已复制";
    setTimeout(function () { btn.textContent = "复制地址"; }, 1500);
  };

  var box = $("verdict");
  if (!isHttp) {
    box.className = "note bad mt";
    box.innerHTML = "<i></i><div><b>现在手机扫不开。</b>你是用 file:// 直接打开网页的，二维码里会是占位域名。请双击「启动服务器.cmd」，再用窗口里那行「手机打开」的地址打开本站。</div>";
  } else if (isLocal && !lan) {
    box.className = "note warn mt";
    box.innerHTML = "<i></i><div><b>注意：</b>当前是 localhost 打开，且没检测到局域网 IP，二维码可能指向 localhost（手机打不开）。请改用启动窗口里显示的局域网地址。</div>";
  } else {
    box.className = "note ok mt";
    box.innerHTML = "<i></i><div><b>可以扫码。</b>手机连同一个 WiFi 后，访问 <span class='code-chip'>" +
      (target || "") + "</span> 即可打开；扫右边的二维码效果一样。</div>";
  }

  if (target && window.QR) window.QR.mount($("siteQr"), target + "index.html", { scale: 5, size: 200 });
})();
