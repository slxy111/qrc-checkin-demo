/* 页面逻辑：所有交互都在这里，页面只是骨架。
   数据来自 store.js（localStorage），二维码来自 qr.js。 */
(function () {
  var S = window.Store.init();
  var page = document.body.dataset.page || "";
  var state = { q: "", tab: "all", selected: null, rows: [], importResult: null };

  /* ---------- 小工具 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var bar = function (w) { return '<i class="bar w' + (w || 60) + '"></i>'; };
  var num = function (n) { return String(n).padStart(3, "0"); };
  var isPhone = S.phoneValid;
  var maskPhone = function (p) { return p && p.length >= 7 ? p.slice(0, 3) + "****" + p.slice(-4) : (p || "—"); };
  var download = function (name, text, type) {
    var blob = new Blob(["\ufeff" + text], { type: (type || "text/csv") + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  var toast = function (msg, kind) {
    var box = $("#toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast";
      document.body.appendChild(box);
    }
    var item = document.createElement("div");
    item.className = "toast-item " + (kind || "ok");
    item.textContent = msg;
    box.appendChild(item);
    setTimeout(function () { item.classList.add("out"); }, 2200);
    setTimeout(function () { item.remove(); }, 2800);
  };
  var statusPill = function (p) {
    if (S.isChecked(p.id)) {
      var c = S.findCheckin(p.id);
      return '<span class="pill ' + (c.method === "manual" ? "man" : "ok") + '">' +
        (c.method === "manual" ? "工作人员代签" : "已签到") + "</span>";
    }
    return '<span class="pill">未签到</span>';
  };
  var sourcePill = function (p) {
    return p.source === "onsite"
      ? '<span class="pill mint">现场注册</span>'
      : '<span class="pill info">名单导入</span>';
  };

  /* 用当前活动实际用到的值填充下拉（全部 + 数据里出现的每一项） */
  var fillSelect = function (sel, values, allLabel) {
    if (!sel) return;
    var head = '<option value="">' + (allLabel || "全部") + "</option>";
    var cur = sel.value;
    sel.innerHTML = head + values.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
    if (values.indexOf(cur) >= 0) sel.value = cur;
  };

  /* 签到台的活动切换下拉 */
  var mountEventPicker = function (sel) {
    var el = typeof sel === "string" ? $(sel) : sel || $("#kioskEventPick");
    if (!el) return;
    var cur = S.event();
    el.innerHTML = S.events().map(function (e) {
      var st = S.status(e.id);
      return '<option value="' + e.id + '"' + (e.id === cur.id ? " selected" : "") + ">" +
        esc(e.name) + "（" + st.text + "）</option>";
    }).join("");
    el.onchange = function () {
      S.setEvent(el.value);
      toast("已切换到「" + S.event().name + "」");
      setTimeout(function () { location.reload(); }, 500);
    };
  };

  /* ---------- 外壳（侧栏 / 顶栏） ---------- */
  var NAV = [
    { id: "dashboard", href: "admin-dashboard.html", label: "数据总览" },
    { id: "events", href: "admin-events.html", label: "活动管理" },
    { id: "import", href: "admin-import.html", label: "名单管理" },
    { id: "people", href: "admin-people.html", label: "人员库" },
    { id: "onsite", href: "admin-onsite.html", label: "现场注册记录" },
    { id: "checkin", href: "admin-checkin-query.html", label: "签到查询" },
    { id: "stats", href: "admin-stats.html", label: "统计汇总" },
    { grp: "短信与页面" },
    { id: "sms", href: "admin-sms.html", label: "短信通知" },
    { id: "passpage", href: "admin-passpage.html", label: "个人页面设置" },
    { id: "qrcode", href: "admin-qrcode.html", label: "二维码管理" },
    { grp: "系统" },
    { id: "settings", href: "admin-settings.html", label: "系统设置" },
  ];
  function renderShell() {
    var side = $("#side");
    if (side) {
      var st = S.stats();
      var html = '<div class="brand"><i></i><div><b>签到与数据查询平台</b><span>管理后台</span></div></div><nav class="nav">';
      NAV.forEach(function (n) {
        if (n.grp) { html += '<div class="grp">' + n.grp + "</div>"; return; }
        var badge = "";
        if (n.id === "onsite" && st.待补充桌号) badge = '<span class="badge">' + st.待补充桌号 + "</span>";
        html += '<a class="' + (n.id === page ? "on" : "") + '" href="' + n.href + '">' + n.label + badge + "</a>";
      });
      html += '</nav><div style="padding:16px 12px 0"><a class="btn ghost block sm" href="index.html">← 返回导航</a>' +
        '<button class="btn block sm mt-s" id="logoutBtn">退出登录</button></div>';
      side.innerHTML = html;
      var lo = $("#logoutBtn");
      if (lo) lo.onclick = function () { S.logout(); location.href = "login.html"; };
    }
    var top = $("#top");
    if (top) {
      var ev = S.event();
      var stx = S.status();
      var evs = S.events().map(function (e) {
        return '<option value="' + e.id + '"' + (e.id === ev.id ? " selected" : "") + ">" + esc(e.name) + "</option>";
      }).join("");
      top.innerHTML =
        '<div class="crumb">管理后台 / <b id="pageTitle">' + (document.title.split("·")[0] || "") + "</b></div>" +
        '<div class="right">' +
        '<span class="pill ' + (stx.state === "open" ? "ok" : stx.state === "closed" ? "bad" : "man") + '">' + stx.text + "</span>" +
        '<span class="selsm" style="padding:0"><select id="eventPick" class="select" style="border:0;background:transparent;padding:7px 10px">' + evs + "</select></span>" +
        '<button class="btn sm warn" id="closeEventBtn">结束签到</button>' +
        '<span class="whoami">' + esc((S.session() && (S.session().label || S.session().name)) || "") + "</span>" +
        '<i class="avatar no" title="当前登录账号">' + esc((S.session() && S.session().no) || "") + "</i></div>";
      $("#eventPick").onchange = function (e) { S.setEvent(e.target.value); location.reload(); };
      $("#closeEventBtn").onclick = function () {
        if (confirm("确定结束本场签到？结束后扫码会提示签到已结束。")) { S.closeEvent(); toast("已结束签到并记录操作人与时间"); }
      };
    }
  }

  /* ---------- 页面：登录 ---------- */
  function pageLogin() {
    var form = $("#loginForm");
    var err = $("#loginErr");
    var role = "admin";
    var ACCS = function () { return S.accounts(); };
    function renderAccounts() {
      var list = ACCS().filter(function (a) { return a.role === role; });
      $("#accList").innerHTML = list.map(function (a) {
        return '<button class="btn sm" data-user="' + esc(a.user) + '" data-pass="' + esc(a.pass) + '" data-role="' + esc(a.role) + '">' +
          esc(a.user) + " / " + esc(a.pass) + "</button>";
      }).join("");
      $$("#accList [data-user]").forEach(function (b) {
        b.onclick = function () {
          $("#user").value = b.dataset.user;
          $("#pass").value = b.dataset.pass;
          err.style.display = "none";
          $("#roleNote").textContent = "已填入「" + b.dataset.user + "」的账号密码，直接点登录即可。";
        };
      });
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var user = $("#user").value.trim();
      var pass = $("#pass").value;
      var sess = S.login(user, pass);
      if (!sess) {
        var known = ACCS().filter(function (a) { return a.user === user; })[0];
        $("#loginErrText").innerHTML = known
          ? "账号是对的，但密码不对。<b>" + known.user + "</b> 的密码是 <b>" + known.pass + "</b>（点下面的账号按钮可自动填入）。"
          : "没有这个账号。后台账号 admin01~admin05，签到台账号 kiosk01~kiosk03，密码都是 123456。";
        err.style.display = "flex";
        return;
      }
      err.style.display = "none";
      if ((form.dataset.role || "admin") !== sess.role)
        toast("这是「" + (sess.label || sess.name) + "」账号，已按该角色进入", "warn");
      location.href = sess.role === "kiosk" ? "kiosk-checkin.html" : "admin-dashboard.html";
    };
    $("#resetAcc").onclick = function () {
      S.setCfg({ accounts: S.defaultAccounts() });
      renderAccounts();
      toast("已恢复默认账号：admin01~05 / kiosk01~03，密码都是 123456");
      err.style.display = "none";
    };
    $$(".role-tab").forEach(function (t) {
      t.onclick = function () {
        $$(".role-tab").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        role = t.dataset.role;
        form.dataset.role = t.dataset.role;
        $("#roleNote").textContent = t.dataset.role === "kiosk"
          ? "签到台账号只能扫码、检索代签与现场注册，不能导出完整手机号。"
          : "活动管理员可导入名单、导出数据、补签撤销、设计打印格式与结束签到。";
        err.style.display = "none";
        renderAccounts();
      };
    });
    renderAccounts();
  }

  /* ---------- 启动 ---------- */
  var PAGES = {};
  function boot() {
    var needAdmin = document.body.dataset.auth === "admin";
    if (needAdmin && !(S.session() && S.session().role !== "kiosk")) {
      location.replace("login.html");
      return;
    }
    renderShell();
    /* 用本地文件方式打开时，给一条醒目提示（功能都能用，只是手机扫码需要服务器方式） */
    if (location.protocol === "file:") {
      var bar = document.createElement("div");
      bar.className = "filemode-bar";
      bar.innerHTML = "你现在是「本地文件」方式打开的：功能都能点、能存，只是<b>手机扫码</b>需要服务器方式。" +
        "<a href=\"check.html\">手机访问自检</a>　要手机扫码请双击文件夹里的 <b>启动服务器.cmd</b>";
      document.body.insertBefore(bar, document.body.firstChild);
    }
    var fn = PAGES[page];
    if (fn) fn();
    S.subscribe(function () { if (PAGES[page]) { try { PAGES[page].live && PAGES[page].live(); } catch (e) {} } });
  }
  window.__app = { PAGES: PAGES, S: S, $: $, $$: $$, esc: esc, bar: bar, num: num, toast: toast, statusPill: statusPill, sourcePill: sourcePill, maskPhone: maskPhone, download: download, isPhone: isPhone, state: state, renderShell: renderShell, fillSelect: fillSelect, mountEventPicker: mountEventPicker };
  PAGES.login = pageLogin;
  document.addEventListener("DOMContentLoaded", boot);
})();
