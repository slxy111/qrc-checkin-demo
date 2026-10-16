/* 签到台端页面逻辑 */
(function () {
  var A = window.__app, S = A.S, $ = A.$, $$ = A.$$, esc = A.esc;

  function fmtResult(kind, person, extra) {
    var map = {
      ok: { cls: "big-ok", t: "签到成功", s: person ? person.name + " · " + person.company + " · 桌号 " + (person.table || "待补充") : "" },
      already: { cls: "big-man", t: "已经签到", s: person ? person.name + " · 首次签到 " + (extra || "") : "" },
      bad: { cls: "big-bad", t: "查不到人员", s: extra || "可改用姓名或手机号后四位检索，或办理现场注册" },
    }[kind];
    var left = '<div><div class="t">' + map.t + '</div><div class="s">' + esc(map.s) + "</div></div>";
    if (!person) return left;
    return left +
      '<div class="row" style="gap:12px">' +
      '<button class="btn lg" id="printNow" style="background:#fff;color:#0b6b45;border:0;font-size:18px;padding:14px 28px">打印标签</button>' +
      '<button class="btn lg" id="printSkip" style="background:transparent;border:2px solid rgba(255,255,255,.75);color:#fff;font-size:16px">不打印</button>' +
      "</div>";
  }

  /* ============ 签到台 · 主界面 ============ */
  A.PAGES["kiosk-checkin"] = function () {
    var lastId = null, timer = null;
    var box = $("#result"), list = $("#list"), stats = $("#stats"), banner = $("#evStatus");
    A.mountEventPicker("#kioskEventPick");
    if ($("#evName")) $("#evName").textContent = S.event().name;

    function renderStatus() {
      var st = S.status();
      banner.className = "k-banner " + st.state;
      banner.innerHTML = "<b>" + st.text + "</b><span>" + esc(S.event().name + " · " + S.event().place) + "</span>";
      banner.style.display = "flex";
    }
    function renderStats() {
      var s = S.stats();
      var defs = [
        ["应到", s.应到, "b"], ["实到（名单内）", s.实到, "g"], ["未到", s.未到, "k"],
        ["现场注册", s.现场注册, "m"], ["手动签到", s.手动签到, "o"], ["合计到场", s.合计到场, "b"],
      ];
      stats.innerHTML = defs.map(function (d) {
        return '<div class="k-stat ' + d[2] + '"><b>' + A.num(d[1]) + "</b><span>" + d[0] + "</span></div>";
      }).join("");
    }
    function renderList() {
      var ps = S.people().slice().sort(function (a, b) {
        var ca = S.findCheckin(a.id), cb = S.findCheckin(b.id);
        if (ca && cb) return ca.at < cb.at ? 1 : -1;   // 都签过：最近签到的在前
        if (ca) return 1;                              // 已签到的排在未签到之后，方便现场找没签到的人
        if (cb) return -1;
        return a.name.localeCompare(b.name);
      }).slice(0, 9);
      list.innerHTML = ps.map(function (p) {
        var c = S.findCheckin(p.id);
        return '<div class="lr ' + (c ? (c.method === "manual" ? "manual" : "ok") : "") + '" data-id="' + p.id + '">' +
          '<span class="who">' + esc(p.name) + "</span>" +
          "<span>" + esc(p.company) + "</span>" +
          '<span class="mono">' + esc(p.table || "待补充") + "</span>" +
          "<span>" + esc(p.category) + "</span>" +
          "<span>" + A.statusPill(p) + "</span>" +
          '<span class="mono">' + (c ? c.at.slice(11) : "—") + "</span>" +
          '<span class="row" style="gap:6px">' +
          (c ? '<button class="btn sm" data-print="' + p.id + '">打印</button>'
             : '<button class="btn sm primary" data-checkin="' + p.id + '">签到</button>' +
               '<button class="btn sm" data-print="' + p.id + '">打印</button>') +
          "</span></div>";
      }).join("") || '<div class="k-empty">还没有人员数据，请先在后台导入名单。</div>';
    }
    function show(kind, person, extra) {
      box.className = "k-result " + (kind === "ok" ? "big-ok" : kind === "already" ? "big-man" : "big-bad");
      box.innerHTML = fmtResult(kind, person, extra);
      box.style.display = "flex";
      clearTimeout(timer);
      var now = $("#printNow");
      if (now)
        now.onclick = function () {
          window.Print.printLabel(person, { note: "签到后打印" });
          A.toast("已发送打印：1 张标签");
          box.style.display = "none";
        };
      var skip = $("#printSkip");
      if (skip) skip.onclick = function () { box.style.display = "none"; };
      timer = setTimeout(function () { box.style.display = "none"; }, person ? 9000 : 2200);
    }
    function guard() {
      if (S.status().state === "closed") {
        show("bad", null, "本场签到已结束，如需补签请在后台操作");
        return false;
      }
      return true;
    }
    function checkin(person, method) {
      if (!guard()) return;
      var r = S.checkin(person.id, method);
      lastId = person.id;
      show(r.status === "ok" ? "ok" : "already", person, r.at);
      render();
    }
    function scanCode(code) {
      var p = S.findByCode(code);
      if (!p) { show("bad", null, "二维码不属于本场活动或人员已被撤销"); return true; }
      checkin(p, "scan");
      return true;
    }
    function byKeyword() {
      var v = $("#q").value.trim(), t = $("#q4").value.trim();
      if (!v && !t) return;
      if (v && S.findByCode(v) && !S.search(v).length) { scanCode(v); return; }
      var hits = v ? S.search(v) : S.search(t);
      if (!hits.length) { show("bad", null, v ? "没有找到「" + v + "」，可办理现场注册" : "没有匹配的号码"); return; }
      renderCandidates(hits);
      A.toast(hits.length === 1 ? "已找到该人员，请核对后点「签到」" : "命中 " + hits.length + " 人，请核对后点「签到」");
    }
    function renderCandidates(hits) {
      list.innerHTML = '<div class="lh" style="background:#eef3ff"><span>姓名</span><span>公司 / 部门</span><span>桌号</span><span>类别</span><span>状态</span><span>手机号</span><span>操作</span></div>' +
        hits.slice(0, 8).map(function (p) {
        var c = S.findCheckin(p.id);
        return '<div class="lr"><span class="who">' + esc(p.name) + "</span><span>" + esc(p.company) +
          '</span><span class="mono">' + esc(p.table || "待补充") + "</span><span>" + esc(p.category) +
          '</span><span class="mono">' + A.maskPhone(p.phone) + "</span>" +
          '<span>' + (c ? '<span class="pill ok">已签到 ' + c.at.slice(11) + "</span>"
            : '<span class="pill">未签到</span>') + "</span>" +
          '<span class="row" style="gap:6px">' +
          (c ? '<button class="btn sm" data-print="' + p.id + '">打印</button>'
             : '<button class="btn sm primary" data-checkin="' + p.id + '">签到</button>' +
               '<button class="btn sm" data-print="' + p.id + '">打印</button>') +
          "</span></div>";
      }).join("");
    }
    function render() { renderStatus(); renderStats(); renderList(); }

    $("#q").addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var v = e.target.value.trim();
      if (v && S.findByCode(v)) { scanCode(v); e.target.value = ""; return; }
      byKeyword();
    });
    $("#q4").addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (e.target.value.length === 4) {
        var hits = S.search(e.target.value);
        if (hits.length) renderCandidates(hits);
        else A.toast("后四位没有匹配到人员", "bad");
      }
    });
    $("#searchBtn").onclick = byKeyword;
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-checkin]");
      if (b) {
        var p = S.findById(b.dataset.checkin);
        if (p) checkin(p, "manual");
        return;
      }
      var pb = e.target.closest("[data-print]");
      if (pb) {
        var pp = S.findById(pb.dataset.print);
        if (pp) { window.Print.printLabel(pp, { note: "列表打印" }); A.toast(pp.name + "：已发送打印 1 张"); }
      }
    });
    $("#fullBtn").onclick = function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    };
    document.addEventListener("keydown", function (e) {
      if (e.key === "F2") { e.preventDefault(); $("#q4").focus(); }
    });
    $("#q").focus();
    render();
    A.PAGES["kiosk-checkin"].live = render;
  };

  /* ============ 签到台 · 检索与代签 ============ */
  A.PAGES["kiosk-search"] = function () {
    var box = $("#cands");
    A.mountEventPicker("#kioskEventPick");
    function render(hits) {
      if (!hits) {
        box.innerHTML = '<div class="k-empty">输入姓名、手机号全号或后四位开始检索；命中多人时在这里选择。</div>';
        return;
      }
      if (!hits.length) { box.innerHTML = '<div class="k-empty">没有匹配的人员。名单外的临时人员请到「现场注册」建档。</div>'; return; }
      box.innerHTML = hits.map(function (p) {
        var c = S.findCheckin(p.id);
        return '<div class="k-cand"><span class="who">' + esc(p.name) + "</span><span>" + esc(p.company) +
          '</span><span class="mono">' + esc(p.table || "待补充") + "</span><span>" + esc(p.category) +
          '</span><span class="mono">' + A.maskPhone(p.phone) + "</span>" +
          '<span class="row" style="gap:8px;justify-content:flex-end">' +
          (c ? '<span class="pill ok">已签到 ' + c.at.slice(11) + "</span>"
             : '<button class="btn primary pick" data-checkin="' + p.id + '">签 到</button>') +
          '<button class="btn pick2" data-print="' + p.id + '">打 印</button></span></div>';
      }).join("");
    }
    function run() {
      var q = $("#q").value.trim(), t = $("#q4").value.trim();
      var hits = S.search(q || t);
      render(hits);
      if (hits.length) A.toast("命中 " + hits.length + " 人");
    }
    $("#searchBtn").onclick = run;
    $("#q").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); run(); } });
    $("#q4").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); run(); } });
    $("#q4").addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (e.target.value.length === 4) run();
    });
    $$("#qClear").forEach(function (b) { b.onclick = function () { $("#q").value = ""; $("#q4").value = ""; render(null); }; });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-checkin]");
      var p2 = e.target.closest("[data-print]");
      if (b) {
        var p = S.findById(b.dataset.checkin);
        if (!p) return;
        if (S.status().state === "closed") return A.toast("本场签到已结束", "bad");
        var r = S.checkin(p.id, "manual");
        A.toast(r.status === "ok" ? p.name + " 签到成功" : p.name + " 之前已签到（" + r.at + "）", r.status === "ok" ? "ok" : "warn");
        render(S.search($("#q").value.trim() || $("#q4").value.trim()));
        return;
      }
      if (p2) {
        var pp = S.findById(p2.dataset.print);
        if (pp) { window.Print.printLabel(pp, { note: "检索打印" }); A.toast(pp.name + "：已发送打印 1 张"); }
      }
    });
    $("#q").focus();
    render(null);
  };

  /* ============ 签到台 · 现场注册（工作人员代录） ============ */
  A.PAGES["kiosk-register"] = function () {
    var form = $("#regForm");
    var out = $("#regOut");
    A.mountEventPicker("#kioskEventPick");
    if (form.elements.category)
      form.elements.category.innerHTML = '<option value="">请选择</option>' +
        S.categories().map(function (c) { return "<option>" + c + "</option>"; }).join("");
    function qrInto(holder, text, size) { if (holder) window.QR.mount(holder, text, { scale: 4, size: size || 156 }); }
    function refreshSideQr() {
      var url = S.registerLink();
      qrInto($("#sideQr"), url, 120);
      $("#sideUrl").textContent = url;
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var data = {};
      ["name", "company", "phone", "table", "category", "title", "sales", "note"].forEach(function (k) {
        var f = form.elements[k];
        data[k] = f ? f.value.trim() : "";
      });
      if (!data.name || !data.company || !data.phone || !data.title) {
        A.toast("姓名、公司／部门、手机号、职务都是必填项", "bad");
        return;
      }
      if (!A.isPhone(data.phone)) { A.toast("手机号需为 11 位有效号码", "bad"); return; }
      var r = S.addPerson(data, { source: "onsite" });
      var p = r.person;
      A.toast(r.status === "added" ? "已建档并生成二维码" : "该人员已存在，已合并资料", r.status === "added" ? "ok" : "warn");
      out.style.display = "";
      out.innerHTML =
        '<div class="hd"><h3 style="font-size:17px">注册成功 · 请确认桌号</h3><span class="pill ' + (r.status === "added" ? "ok" : "man") + '">' +
        (r.status === "added" ? "新建档" : "已合并") + "</span></div>" +
        '<div class="bd" style="display:flex;gap:20px;align-items:center">' +
        '<div id="outQr" class="qr-holder"></div>' +
        '<div class="stack" style="gap:8px">' +
        '<div style="font-size:20px;font-weight:700">' + esc(p.name) + "</div>" +
        '<div class="muted">' + esc(p.company) + " · 桌号 " + esc(p.table || "待补充") + " · " + esc(p.category) + "</div>" +
        '<div class="small">唯一编码 <span class="code-chip">' + p.code + "</span></div>" +
        '<div class="small">个人短链 <span class="code-chip">' + S.personLink(p) + "</span></div>" +
        '<div class="field" style="max-width:320px"><label>桌号<span class="req">*</span></label>' +
        '<input class="input" id="outTable" value="' + esc(p.table || "") + '" placeholder="请输入桌号" style="height:50px;font-size:17px"></div>' +
        '<div class="row"><button class="btn lg primary" id="confirmPrint" style="padding:13px 26px;font-size:17px">确认并打印标签</button>' +
        '<button class="btn lg mint" id="scanNow">只签到</button>' +
        '<button class="btn lg" id="printLater">稍后打印</button></div>' +
        '<div class="small muted">工作人员填完桌号确认后，直接打印一张标签贴在胸卡上；注册不等于签到，可点「只签到」再扫一次二维码。</div>' +
        "</div></div>";
      qrInto($("#outQr"), S.personLink(p), 168);
      $("#confirmPrint").onclick = function () {
        var t = $("#outTable").value.trim();
        if (!t) return A.toast("请先填写桌号", "bad");
        S.updatePerson(p.id, { table: t });
        if (S.status().state !== "closed" && !S.isChecked(p.id)) S.checkin(p.id, "scan");
        window.Print.printLabel(S.findById(p.id), { note: "注册确认后打印" });
        A.toast(p.name + "：桌号已保存，已发送打印 1 张");
      };
      $("#printLater").onclick = function () {
        var t = $("#outTable").value.trim();
        if (t) S.updatePerson(p.id, { table: t });
        A.toast("已保存，可在签到台列表点「打印」补打");
      };
      $("#scanNow").onclick = function () {
        if (S.status().state === "closed") return A.toast("本场签到已结束", "bad");
        var rr = S.checkin(p.id, "scan");
        A.toast(rr.status === "ok" ? p.name + " 签到成功" : "该人员之前已签到", rr.status === "ok" ? "ok" : "warn");
      };
      form.reset();
      $("#regList").innerHTML = onsiteRows();
    };
    function onsiteRows() {
      var ps = S.people().filter(function (p) { return p.source === "onsite"; }).slice(-6).reverse();
      if (!ps.length) return '<div class="k-empty">本次现场还没有新注册人员。</div>';
      return ps.map(function (p) {
        return '<div class="lr"><span class="who">' + esc(p.name) + '</span><span>' + esc(p.company) +
          '</span><span class="mono">' + esc(p.table || "待补充") + "</span><span>" + esc(p.category) +
          "</span><span>" + A.statusPill(p) + '</span><span class="mono">' + p.createdAt.slice(11, 16) + "</span></div>";
      }).join("");
    }
    $("#regList").innerHTML = onsiteRows();
    $("#sideLink").href = "register-qr.html";
    refreshSideQr();
    A.PAGES["kiosk-register"].live = function () { $("#regList").innerHTML = onsiteRows(); };
  };

  /* ============ 现场注册二维码页（可放大 / 可打印） ============ */
  A.PAGES["register-qr"] = function () {
    var url = S.registerLink();
    var holder = $("#bigQr");
    window.QR.mount(holder, url, { scale: 8, size: 300, quiet: 4 });
    $("#qrUrl").textContent = url;
    $("#evLine").textContent = S.event().name + " · " + S.event().place;
    $("#printBtn").onclick = function () { window.print(); };
    $("#openForm").href = "mobile-register.html";
  };

  /* ============ 签到台 · 打印标签（确认后打印一张） ============ */
  A.PAGES["kiosk-print"] = function () {
    A.mountEventPicker("#kioskEventPick");
    var params = new URLSearchParams(location.search);
    var code = params.get("p") || params.get("c");
    var person = code ? S.findByCode(code) : null;
    if (!person) {
      var recent = S.checkins().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0];
      person = recent ? S.findById(recent.personId) : S.people()[0];
    }
    function render() {
      var tpl = S.template();
      $("#tplInfo").textContent = window.Print.sizeName(tpl.size) + " · " + tpl.rows.length + " 行 · 一次 1 张";
      $("#who").textContent = person ? person.name + " · " + (person.company || "") + " · 桌号 " + (person.table || "待补充") : "没有可打印的人员";
      window.Print.preview($("#preview"), person, tpl, 1.5);
      var list = S.checkins().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 6);
      $("#recent").innerHTML = list.map(function (c) {
        var p = S.findById(c.personId);
        if (!p) return "";
        return '<div class="lr"><span class="who">' + esc(p.name) + "</span><span>" + esc(p.company) +
          '</span><span class="mono">' + esc(p.table || "待补充") + "</span><span>" + esc(p.category) +
          "</span><span>" + A.statusPill(p) + '</span><span class="mono">' + c.at.slice(11, 16) +
          '</span><span><button class="btn sm" data-print="' + p.id + '">打印</button></span></div>';
      }).join("") || '<div class="k-empty">还没有签到记录。</div>';
    }
    $("#doPrint").onclick = function () {
      if (!person) return;
      window.Print.printLabel(person, { note: "确认后打印" });
      A.toast(person.name + "：已发送打印 1 张");
    };
    $("#skip").onclick = function () { location.href = "kiosk-checkin.html"; };
    $("#recent").addEventListener("click", function (e) {
      var b = e.target.closest("[data-print]");
      if (!b) return;
      var p = S.findById(b.dataset.print);
      if (p) { window.Print.printLabel(p, { note: "补打" }); A.toast(p.name + "：已发送打印 1 张"); }
    });
    render();
    A.PAGES["kiosk-print"].live = render;
  };

  /* ============ 打印输出页（真实尺寸，供测试打印机） ============ */
  A.PAGES["print-label"] = function () {
    var params = new URLSearchParams(location.search);
    var code = params.get("c");
    var person = code ? S.findByCode(code) : null;
    if (!person) person = S.people()[0];
    var tpl = S.template();
    var mm = S.SIZES[tpl.size] || S.SIZES["70x30"];
    var box = $("#labelBox");
    box.style.width = mm.w + "mm";
    box.style.height = mm.h + "mm";
    box.innerHTML = window.Print.labelInner(person, tpl);
    $("#meta").textContent = window.Print.sizeName(tpl.size) + " · " + (person ? person.name : "") + " · 一次 1 张";
    $("#doPrint").onclick = function () {
      window.Print.printLabel(person, { note: "输出页打印" });
      A.toast("已发送打印 1 张");
    };
    var st = document.createElement("style");
    st.textContent = "@media print{@page{size:" + mm.w + "mm " + mm.h + "mm;margin:0}.no-print{display:none !important}body{background:#fff}}";
    document.head.appendChild(st);
  };
})();
