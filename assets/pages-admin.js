/* 管理后台 + 投屏端 + 导航首页 逻辑 */
(function () {
  var A = window.__app, S = A.S, $ = A.$, $$ = A.$$, esc = A.esc;

  var stat = function (label, value, sub, cls) {
    return '<div class="stat ' + (cls || "") + '"><div class="lb">' + label + '</div><div class="vl mono">' +
      value + '</div><div class="dt">' + (sub || "") + "</div></div>";
  };
  var rowsHTML = function (rows) { return rows.join(""); };
  var emptyRow = function (cols, text) {
    return '<tr><td colspan="' + cols + '" style="text-align:center;color:var(--muted);padding:26px">' + text + "</td></tr>";
  };
  var timeOnly = function (s) { return s ? String(s).slice(11, 16) : "—"; };

  /* ============ 数据总览 ============ */
  A.PAGES["dashboard"] = function () {
    function render() {
      var s = S.stats(), ev = S.event();
      $("#stats").innerHTML =
        stat("应到人数", s.应到, "导入名单 + 现场注册", "b") +
        stat("实到（名单内）", s.实到, "名单内已签到", "g") +
        stat("未到人数", s.未到, "应到 − 实到", "k") +
        stat("现场注册", s.现场注册, "已签到 " + s.现场注册已签到, "m") +
        stat("手动签到", s.手动签到, "工作人员代签", "o") +
        stat("合计到场", s.合计到场, "实到 + 现场注册已签到", "b");
      var cats = S.statsByCategory();
      var keys = Object.keys(cats);
      var max = Math.max.apply(null, keys.map(function (k) { return cats[k].应到 || 1; }));
      $("#catChart").innerHTML = keys.map(function (k) {
        var c = cats[k];
        return '<div class="col"><b>' + c.实到 + "/" + c.应到 + '</b><i style="height:' +
          Math.max(6, Math.round((c.应到 / max) * 100)) + '%"></i><em>' + k + "</em></div>";
      }).join("");
      var recent = S.checkins().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 8);
      $("#recent").innerHTML = recent.length ? rowsHTML(recent.map(function (c) {
        var p = S.findById(c.personId) || { name: "—", company: "", table: "", source: "" };
        return "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.company) + '</td><td class="mono">' +
          esc(p.table || "—") + "</td><td>" + A.sourcePill(p) + '</td><td>' +
          (c.method === "manual" ? '<span class="pill man">工作人员代签</span>' : '<span class="pill ok">扫码签到</span>') +
          '</td><td class="mono">' + timeOnly(c.at) + "</td></tr>";
      })) : emptyRow(6, "还没有签到记录");
      $("#quick").innerHTML =
        stat("待补充桌号", s.待补充桌号, "现场注册需工作人员确认", "o") +
        stat("无手机号 / 号码待确认", s.无手机号, "不参与短信发送", "k") +
        stat("扫码 / 手动", s.扫码签到 + " / " + s.手动签到, "签到方式构成", "m") +
        stat("签到开放时间", S.status().openAt ? S.status().openAt.toTimeString().slice(0, 5) : (S.status().state === "closed" ? "已结束" : "—"), "开始前 2 小时自动开放", "b");
      $("#evLine").textContent = ev.name + " · " + ev.startAt + " · " + ev.place;
    }
    render();
    A.PAGES.dashboard.live = render;
  };

  /* ============ 活动管理 ============ */
  A.PAGES["events"] = function () {
    function render() {
      var cur = S.event();
      $("#eventInfo").innerHTML =
        '<dl class="kv"><dt>活动名称</dt><dd>' + esc(cur.name) + "</dd>" +
        "<dt>主办单位</dt><dd>" + esc(cur.host) + "</dd>" +
        "<dt>开始时间</dt><dd>" + esc(cur.startAt) + "</dd>" +
        "<dt>地点</dt><dd>" + esc(cur.place) + "</dd>" +
        "<dt>签到时段</dt><dd>" + esc(cur.signRange) + "</dd>" +
        "<dt>签到状态</dt><dd>" + S.status().text + "</dd>" +
        "<dt>结束时间</dt><dd>" + (cur.closedAt || "—") + "</dd></dl>";
      $("#eventList").innerHTML = rowsHTML(S.events().map(function (e) {
        var ps = S.people(e.id), signed = S.checkins(e.id).length;
        var st = S.status(e.id);
        return '<tr' + (e.id === cur.id ? ' class="pick-row"' : "") + "><td>" + esc(e.name) + "</td><td>" + esc(e.host) +
          '</td><td class="mono">' + esc(e.startAt) + '</td><td class="mono">' + ps.length + '</td><td class="mono">' + signed +
          '</td><td><span class="pill ' + (st.state === "open" ? "ok" : st.state === "closed" ? "bad" : "man") + '">' + st.text + "</span></td>" +
          '<td class="ops">' + (e.id === cur.id ? '<span class="pill info">当前</span>' :
            '<button class="btn sm" data-switch="' + e.id + '">切换</button>') +
          '<button class="btn sm" data-close="' + e.id + '">结束签到</button></td></tr>';
      }));
    }
    $("#eventList").addEventListener("click", function (e) {
      var sw = e.target.closest("[data-switch]"), cl = e.target.closest("[data-close]");
      if (sw) { S.setEvent(sw.dataset.switch); A.toast("已切换活动"); render(); }
      if (cl) {
        if (confirm("结束这场活动的签到？")) { S.closeEvent(cl.dataset.close); A.toast("已结束签到"); render(); }
      }
    });
    $("#newEventForm").onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      S.createEvent({
        name: f.elements.name.value.trim() || "未命名活动",
        host: f.elements.host.value.trim(),
        startAt: f.elements.startAt.value.trim(),
        place: f.elements.place.value.trim(),
        signRange: f.elements.signRange.value.trim(),
      });
      A.toast("已新建活动并切换为当前活动");
      f.reset();
      render();
    };
    render();
  };

  /* ============ 现场注册记录（实时刷新 + 补录桌号与备注） ============ */
  A.PAGES["onsite"] = function () {
    var tab = "all", auto = true, selected = null;
    var onsite = function () { return S.people().filter(function (p) { return p.source === "onsite"; }); };
    function isNew(p) { return Date.now() - new Date(p.createdAt.replace(/-/g, "/")).getTime() < 5 * 60000; }
    function listFor() {
      var ps = onsite().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      if (tab === "pending") ps = ps.filter(function (p) { return !p.table; });
      if (tab === "done") ps = ps.filter(function (p) { return p.table; });
      if (tab === "signed") ps = ps.filter(function (p) { return S.isChecked(p.id); });
      return ps;
    }
    function renderStats() {
      var ps = onsite();
      $("#stats").innerHTML =
        stat("现场注册人数", ps.length, "手机提交 + 签到台代录", "m") +
        stat("待补充桌号", ps.filter(function (p) { return !p.table; }).length, "需要工作人员处理", "o") +
        stat("已补充桌号", ps.filter(function (p) { return p.table; }).length, "已同步到人员库", "g") +
        stat("其中已签到", ps.filter(function (p) { return S.isChecked(p.id); }).length, "扫码后计入", "b");
    }
    function renderList() {
      var ps = listFor();
      $("#list").innerHTML = ps.length ? rowsHTML(ps.slice(0, 40).map(function (p) {
        var c = S.findCheckin(p.id);
        return '<tr class="' + (isNew(p) ? "row-new" : "") + (selected === p.id ? " pick-row" : "") + '">' +
          '<td class="mono">' + timeOnly(p.createdAt) + (isNew(p) ? '<span class="newchip">新</span>' : "") + "</td>" +
          '<td><a class="name-link" data-pick="' + p.id + '">' + esc(p.name) + "</a></td>" +
          "<td>" + esc(p.company) + '</td><td class="mono">' + A.maskPhone(p.phone) + "</td>" +
          '<td><span class="pill">' + esc(p.category) + "</span></td>" +
          '<td class="' + (p.table ? "" : "pending") + '">' + esc(p.table || "待补充") + "</td>" +
          '<td class="' + (p.note ? "" : "ph") + '">' + esc(p.note || "—") + "</td>" +
          '<td>' + (p.table ? '<span class="pill ok">已补充</span>' : '<span class="pill man">待补充桌号</span>') + "</td>" +
          '<td class="ops"><button class="btn sm' + (p.table ? "" : " primary") + '" data-pick="' + p.id + '">' +
          (p.table ? "修改" : "录入") + "</button></td></tr>";
      })) : emptyRow(9, "选中的范围内没有记录。新人在手机上提交注册后，这里会实时出现。");
      $("#count").textContent = "共 " + ps.length + " 条";
      $("#updatedAt").textContent = new Date().toTimeString().slice(0, 8);
    }
    function renderPanel() {
      var box = $("#panel");
      if (!selected) {
        box.innerHTML = '<div class="bd" style="padding:26px;text-align:center;color:var(--muted)">' +
          "点击左侧列表里的姓名，这里会显示同步过来的信息，并可以填写桌号与备注。</div>";
        return;
      }
      var p = S.findById(selected);
      if (!p) return;
      /* 重建面板前，先记下正在输入的内容和光标位置，重建后原样放回去 */
      var active = document.activeElement;
      var draft = null;
      if (active && (active.id === "pTable" || active.id === "pNote")) {
        draft = { id: active.id, value: active.value, pos: active.selectionStart };
      } else if ($("#pTable")) {
        var cur = $("#pTable").value;
        if (cur.trim() !== String(p.table || "").trim())
          draft = { id: "pTable", value: cur, pos: cur.length };
      }
      box.innerHTML =
        '<div class="dh"><div><h3 style="font-size:14px">补录桌号与备注</h3><div class="small muted">手机提交的信息已同步</div></div>' +
        '<span class="pill ' + (p.table ? "ok" : "man") + '">' + (p.table ? "已补充" : "待补充桌号") + "</span></div>" +
        '<div class="bd stack" style="gap:14px;padding:16px">' +
        '<div class="readonly"><dl class="kv"><dt>姓名</dt><dd>' + esc(p.name) + "</dd>" +
        "<dt>公司 / 部门</dt><dd>" + esc(p.company) + "</dd>" +
        "<dt>手机号</dt><dd>" + A.maskPhone(p.phone) + "</dd>" +
        "<dt>职务</dt><dd>" + esc(p.title || "—") + "</dd>" +
        "<dt>类别</dt><dd>" + esc(p.category) + "</dd>" +
        "<dt>新人备注</dt><dd>" + esc(p.note || "—") + "</dd>" +
        "<dt>提交时间</dt><dd>" + esc(p.createdAt) + "</dd>" +
        "<dt>桌号</dt><dd>" + esc(p.table || "待补充") + "</dd></dl></div>" +
        '<div class="field"><label>桌号<span class="req">*</span></label>' +
        '<input class="input" id="pTable" value="' + esc(p.table) + '" placeholder="请输入桌号"></div>' +
        '<div class="field"><label>备注</label>' +
        '<textarea class="textarea" id="pNote" placeholder="例如：与××同席、需要加位">' + esc(p.note || "") + "</textarea></div>" +
        '<div class="field"><label>处理人</label><div class="input"><span class="muted">' +
        esc((S.session() && S.session().name) || "签到台") + "（自动记录）</span></div></div>" +
        '<div class="note info"><i></i><div>保存后同步到人员库、签到列表与本人二维码页面；注册不等于签到，仍需扫一次二维码。</div></div>' +
        '<div class="note warn" id="editHint" style="display:none"><i></i><div>正在输入，已自动暂停刷新；保存后恢复。</div></div>' +
        '<div class="row" style="justify-content:flex-end"><button class="btn" id="pLater">稍后处理</button>' +
        '<button class="btn ghost" id="pSavePrint">保存并打印标签</button>' +
        '<button class="btn primary" id="pSave">保存并同步</button></div></div>';
      if (draft) {
        var el = $("#" + draft.id);
        if (el) {
          el.value = draft.value;
          try { el.focus(); el.setSelectionRange(draft.pos, draft.pos); } catch (e) { el.focus(); }
        }
      }
      $("#pSavePrint").onclick = function () {
        var t = $("#pTable").value.trim();
        if (!t) { A.toast("请填写桌号", "bad"); return; }
        S.updatePerson(p.id, { table: t, note: $("#pNote").value.trim() });
        window.Print.printLabel(S.findById(p.id), { note: "后台补录后打印" });
        A.toast(p.name + " 的桌号已保存，并已发送打印 1 张");
        render();
      };
      $("#pSave").onclick = function () {
        var t = $("#pTable").value.trim();
        if (!t) { A.toast("请填写桌号", "bad"); return; }
        S.updatePerson(p.id, { table: t, note: $("#pNote").value.trim() });
        A.toast(p.name + " 的桌号与备注已保存并同步");
        render();
      };
      $("#pLater").onclick = function () { selected = null; renderPanel(); renderList(); };
    }
    function render() { renderStats(); renderList(); renderPanel(); }
    /* 是否有还没保存的输入（有的话不要在自动刷新时重建面板） */
    function hasDraft() {
      if (!selected) return false;
      var p = S.findById(selected);
      var t = $("#pTable");
      if (!p || !t) return false;
      var note = $("#pNote") ? $("#pNote").value : "";
      return t.value.trim() !== String(p.table || "").trim() || note.trim() !== String(p.note || "").trim();
    }
    function tick() {
      renderStats();
      renderList();
      if (hasDraft()) {
        var h = $("#editHint");
        if (h) h.style.display = "flex";
      } else {
        renderPanel();
      }
    }
    $("#list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick]");
      if (!b) return;
      selected = b.dataset.pick;
      render();
    });
    $$(".tab").forEach(function (t) {
      t.onclick = function () {
        $$(".tab").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        tab = t.dataset.tab;
        renderList();
      };
    });
    $("#autoToggle").onclick = function () {
      auto = !auto;
      this.classList.toggle("off", !auto);
      this.querySelector("span").textContent = auto ? "自动刷新开" : "自动刷新关";
      A.toast(auto ? "已开启自动刷新（每 3 秒）" : "已关闭自动刷新");
    };
    $("#refreshBtn").onclick = function () { render(); A.toast("已刷新"); };
    $("#exportBtn").onclick = function () {
      var ps = onsite();
      A.download("现场注册名单.csv", S.toCSV([S.PERSON_HEADER].concat(ps.map(S.personRow))));
      S.log("导出", "现场注册名单", ps.length + " 条");
    };
    $("#liveDot").innerHTML = '<i></i>实时刷新中';
    render();
    setInterval(function () { if (auto) tick(); }, 3000);
    A.PAGES.onsite.live = tick;
  };

  /* ============ 签到查询（导出两张表 + 补签撤销） ============ */
  A.PAGES["checkin"] = function () {
    var tab = "all";
    function filtered() {
      var q = $("#fq").value.trim(), tail = $("#ftail").value.trim(), t = $("#ftable").value.trim();
      var cat = $("#fcat").value;
      return S.people().filter(function (p) {
        if (q && p.name.indexOf(q) < 0) return false;
        if (tail && (p.phone || "").slice(-4) !== tail) return false;
        if (t && p.table !== t) return false;
        if (cat && p.category !== cat) return false;
        var c = S.findCheckin(p.id);
        if (tab === "signed" && !c) return false;
        if (tab === "unsigned" && c) return false;
        if (tab === "onsite" && p.source !== "onsite") return false;
        if (tab === "manual" && !(c && c.method === "manual")) return false;
        if (tab === "nophone" && !(p.phone || "")) return false;
        return true;
      });
    }
    function render() {
      var list = filtered(), s = S.stats();
      $("#statRow").innerHTML =
        stat("当前结果", list.length, "", "b") +
        stat("已签到", list.filter(function (p) { return S.isChecked(p.id); }).length, "含代签", "g") +
        stat("未签到", list.filter(function (p) { return !S.isChecked(p.id); }).length, "", "k") +
        stat("现场注册", list.filter(function (p) { return p.source === "onsite"; }).length, "", "m") +
        stat("工作人员代签", list.filter(function (p) { var c = S.findCheckin(p.id); return c && c.method === "manual"; }).length, "", "o") +
        stat("无手机号", s.无手机号, "不参与短信", "k");
      $("#list").innerHTML = list.length ? rowsHTML(list.slice(0, 60).map(function (p) {
        var c = S.findCheckin(p.id);
        return "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.company) + "</td><td>" + esc(p.title || "—") +
          '</td><td class="mono">' + A.maskPhone(p.phone) + '</td><td class="mono">' + esc(p.table || "待补充") +
          "</td><td>" + esc(p.category) + "</td><td>" + A.sourcePill(p) + "</td><td>" + A.statusPill(p) +
          '</td><td class="mono">' + (c ? timeOnly(c.at) : "—") + "</td><td>" +
          (c ? (c.method === "manual" ? "工作人员代签" : "扫码签到") : "—") + '</td><td class="ops">' +
          (c ? '<button class="btn sm danger" data-undo="' + p.id + '">撤销</button>'
             : '<button class="btn sm ghost" data-sign="' + p.id + '">补签</button>') + "</td></tr>";
      })) : emptyRow(11, "没有匹配的记录");
    }
    ["#fq", "#ftail", "#ftable"].forEach(function (id) { $(id).oninput = render; });
    $("#fcat").onchange = render;
    A.fillSelect($("#fcat"), S.categories());
    $$(".tab").forEach(function (t) {
      t.onclick = function () {
        $$(".tab").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on"); tab = t.dataset.tab; render();
      };
    });
    $("#list").addEventListener("click", function (e) {
      var u = e.target.closest("[data-undo]"), g = e.target.closest("[data-sign]");
      if (u) {
        var r = prompt("撤销原因？");
        if (r == null) return;
        S.undoCheckin(u.dataset.undo, r); A.toast("已撤销签到"); render();
      }
      if (g) { S.checkin(g.dataset.sign, "manual"); A.toast("已补签（工作人员代签）"); render(); }
    });
    $("#exportTwo").onclick = function () {
      var out = S.exportTwoSheets();
      A.download("已签到名单.csv", out.已签到);
      setTimeout(function () { A.download("未签到名单.csv", out.未签到); }, 400);
      S.log("导出", "已签到 + 未签到两张表", "已签到 " + out.counts.signed + " 条 / 未签到 " + out.counts.unsigned + " 条");
      A.toast("已导出两个文件（Excel 可直接打开）");
    };
    $("#exportFiltered").onclick = function () {
      var list = filtered();
      A.download("签到查询结果.csv", S.toCSV([S.PERSON_HEADER].concat(list.map(S.personRow))));
      A.toast("已导出当前筛选 " + list.length + " 条");
    };
    $("#exportOnsite").onclick = function () {
      var ps = S.people().filter(function (p) { return p.source === "onsite"; });
      A.download("现场注册名单.csv", S.toCSV([S.PERSON_HEADER].concat(ps.map(S.personRow))));
    };
    render();
  };

  /* ============ 统计汇总 ============ */
  A.PAGES["stats"] = function () {
    var by = "category";
    function data() { return by === "category" ? S.statsByCategory() : S.statsByCompany(); }
    function render() {
      var s = S.stats(), d = data(), keys = Object.keys(d);
      $("#stats").innerHTML =
        stat("应到", s.应到, "名单总数", "b") + stat("实到（名单内）", s.实到, "", "g") +
        stat("未到", s.未到, "", "k") + stat("合计到场", s.合计到场, "含现场注册已签到", "b");
      var max = Math.max.apply(null, keys.map(function (k) { return d[k].应到 || 1; }));
      $("#chart").innerHTML = keys.map(function (k, i) {
        return '<div class="col' + (i % 2 ? " mint" : "") + '"><b>' + d[k].实到 + "/" + d[k].应到 +
          '</b><i style="height:' + Math.max(6, Math.round((d[k].应到 / max) * 100)) + '%"></i><em>' + esc(k) + "</em></div>";
      }).join("");
      var total = { 应到: 0, 实到: 0, 未到: 0, 现场注册: 0 };
      $("#table").innerHTML = rowsHTML(keys.map(function (k) {
        var r = d[k];
        total.应到 += r.应到; total.实到 += r.实到; total.未到 += r.未到; total.现场注册 += r.现场注册;
        var rate = r.应到 ? Math.round((r.实到 / r.应到) * 100) : 0;
        return "<tr><td>" + esc(k) + '</td><td class="mono">' + r.应到 + '</td><td class="mono">' + r.实到 +
          '</td><td class="mono">' + r.未到 + '</td><td class="mono">' + rate + '%</td><td class="mono">' +
          r.现场注册 + "</td></tr>";
      })) + '<tr style="background:var(--soft)"><td><b>合计</b></td><td class="mono"><b>' + total.应到 +
        '</b></td><td class="mono"><b>' + total.实到 + '</b></td><td class="mono"><b>' + total.未到 +
        '</b></td><td class="mono"><b>' + (total.应到 ? Math.round((total.实到 / total.应到) * 100) : 0) +
        '%</b></td><td class="mono"><b>' + total.现场注册 + "</b></td></tr>";
    }
    $$(".tab").forEach(function (t) {
      t.onclick = function () {
        $$(".tab").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on"); by = t.dataset.by; render();
      };
    });
    $("#exportBtn").onclick = function () {
      var d = data(), rows = [["分组", "应到", "实到", "未到", "到场率", "现场注册"]];
      Object.keys(d).forEach(function (k) {
        var r = d[k];
        rows.push([k, r.应到, r.实到, r.未到, (r.应到 ? Math.round((r.实到 / r.应到) * 100) : 0) + "%", r.现场注册]);
      });
      A.download("统计汇总.csv", S.toCSV(rows));
    };
    $("#drill").onclick = function () { location.href = "admin-checkin-query.html"; };
    render();
    A.PAGES.stats.live = render;
  };

  /* ============ 短信通知 ============ */
  A.PAGES["sms"] = function () {
    var rows = [];
    function range() { return $("#range").value; }
    function build() {
      var all = S.smsList();
      if (range() === "unsigned") all = all.filter(function (r) { return !S.isChecked(r.person.id); });
      if (range() === "onsite") all = all.filter(function (r) { return r.person.source === "onsite"; });
      if (range() === "nophone") all = all.filter(function (r) { return !r.person.phone; });
      var comp = $("#rangeCompany") ? $("#rangeCompany").value : "";
      if (comp) all = all.filter(function (r) { return r.person.company === comp; });
      rows = all;
      $("#rangeInfo").innerHTML = '<span class="pill info">范围：' + $("#range").selectedOptions[0].text + "</span>" +
        '<span class="pill ok">将生成 ' + rows.filter(function (r) { return !r.skipped; }).length + " 条</span>" +
        '<span class="pill man">跳过无手机号 ' + rows.filter(function (r) { return r.skipped; }).length + " 条</span>";
      $("#preview").innerHTML = rows.slice(0, 3).map(function (r, i) {
        var warn = r.missing.length || !r.person.phone;
        return '<div style="border:1px solid ' + (warn ? "#f9d4d6" : "var(--line)") + ';border-radius:12px;padding:12px 14px' +
          (warn ? ";background:var(--bad-soft)" : "") + '">' +
          '<div class="spread"><span class="pill ' + (warn ? "bad" : "info") + '">第 ' + (i + 1) + " 条 · " + esc(r.person.name) + "</span>" +
          '<span class="small muted">' + (r.person.phone ? A.maskPhone(r.person.phone) : "无手机号，跳过") + "</span></div>" +
          '<p class="small mt-s"' + (warn ? ' style="color:#a12c2c"' : "") + ">" + esc(r.text) + "</p>" +
          (r.missing.length ? '<div class="small" style="color:#a12c2c">变量为空：' + r.missing.join("、") + "</div>" : "") +
          "</div>";
      }).join("") || '<div class="k-empty">该范围内没有人员</div>';
      var skipped = rows.filter(function (r) { return r.skipped; });
      $("#skipList").innerHTML = skipped.length ? rowsHTML(skipped.map(function (r) {
        return "<tr><td>" + esc(r.person.name) + "</td><td>" + esc(r.person.company) +
          '</td><td class="ph">无手机号或格式异常</td></tr>';
      })) : emptyRow(3, "没有需要跳过的人员");
    }
    $("#tpl").value = S.cfg().smsTemplate;
    A.fillSelect($("#rangeCompany"), S.companies(), "全部公司 / 部门");
    $("#saveTpl").onclick = function () {
      S.setCfg({ smsTemplate: $("#tpl").value });
      A.toast("短信模板已保存");
      build();
    };
    $("#range").onchange = build;
    if ($("#rangeCompany")) $("#rangeCompany").onchange = build;
    $("#exportTxt").onclick = function () {
      var list = rows.filter(function (r) { return !r.skipped; });
      A.download("短信发送文件.csv", S.toCSV([["手机号", "短信内容", "姓名"]].concat(
        list.map(function (r) { return [S.normalizePhone(r.person.phone), r.text, r.person.name]; }))));
      S.log("导出", "短信发送文件", list.length + " 条");
      A.toast("已导出 " + list.length + " 条（可直接交给运营商）");
    };
    $("#exportSkip").onclick = function () {
      var list = rows.filter(function (r) { return r.skipped; });
      A.download("无手机号清单.csv", S.toCSV([["姓名", "公司/部门"]].concat(
        list.map(function (r) { return [r.person.name, r.person.company]; }))));
    };
    build();
  };

  /* ============ 个人页面设置 ============ */
  A.PAGES["passpage"] = function () {
    var tips = S.cfg().passTips || { bright: "请把屏幕亮度调至最高", err: "信息错误", guide: "请到签到台联系工作人员" };
    function preview() {
      var p = S.people()[0];
      $("#preview").innerHTML = '<div class="pass-card">' +
        '<div class="pc-ev">' + esc(S.event().name) + " · " + esc(S.event().startAt) + " · " + esc(S.event().place) + "</div>" +
        '<div class="pc-name">' + esc(p.name) + "</div>" +
        '<div class="pc-table">桌号 ' + esc(p.table || "待补充") + "</div>" +
        '<div class="qr-holder" id="pvQr"></div><div class="pc-tip">' + esc($("#tipBright").value) + "</div>" +
        '<div class="pc-meta"><span class="pill">' + esc(S.personLink(p)) + "</span></div></div>";
      window.QR.mount($("#pvQr"), S.personLink(p), { scale: 5, size: 190 });
    }
    $("#tipBright").value = tips.bright;
    $("#tipErr").value = tips.err;
    $("#tipGuide").value = tips.guide;
    $("#domain").value = S.cfg().domain;
    $("#host").value = S.cfg().host;
    ["#tipBright", "#tipErr", "#tipGuide", "#domain", "#host"].forEach(function (id) { $(id).oninput = preview; });
    $("#save").onclick = function () {
      S.setCfg({
        domain: $("#domain").value.trim().replace(/\/$/, ""),
        host: $("#host").value.trim(),
        passTips: { bright: $("#tipBright").value.trim(), err: $("#tipErr").value.trim(), guide: $("#tipGuide").value.trim() },
      });
      A.toast("已保存：域名与页面文案会同步到短信链接和个人页面");
      preview();
    };
    preview();
  };

  /* ============ 二维码管理 ============ */
  A.PAGES["qrcode"] = function () {
    var current = null;
    function renderList(q) {
      var ps = S.people().filter(function (p) {
        return !q || p.name.indexOf(q) >= 0 || p.company.indexOf(q) >= 0 || p.code.toLowerCase() === q.toLowerCase();
      }).slice(0, 24);
      $("#list").innerHTML = ps.length ? rowsHTML(ps.map(function (p) {
        return '<tr><td class="mono-sm">' + p.code + '</td><td><a class="name-link" data-view="' + p.id + '">' +
          esc(p.name) + "</a></td><td>" + esc(p.company) + '</td><td class="mono">' + esc(p.table || "待补充") +
          "</td><td>" + A.statusPill(p) + '</td><td class="mono-sm">' + esc(S.personLink(p)) + "</td></tr>";
      })) : emptyRow(6, "没有匹配的人员");
    }
    function showOne(p) {
      current = p;
      $("#one").style.display = "";
      $("#oneBox").innerHTML = '<div class="qr-holder" id="oneQr"></div>' +
        '<div class="stack" style="gap:6px"><h3 style="font-size:18px">' + esc(p.name) + "</h3>" +
        '<div class="muted small">' + esc(p.company) + " · 桌号 " + esc(p.table || "待补充") + " · " + esc(p.category) + "</div>" +
        '<div class="small">唯一编码 <span class="code-chip">' + p.code + "</span></div>" +
        '<div class="small">个人短链 <span class="code-chip">' + esc(S.personLink(p)) + "</span></div>" +
        '<div class="row"><button class="btn sm" id="dlOne">下载二维码</button>' +
        '<a class="btn sm ghost" href="mobile-pass.html?c=' + p.code + '" target="_blank">打开个人页面</a></div></div>';
      window.QR.mount($("#oneQr"), S.personLink(p), { scale: 6, size: 200 });
      $("#dlOne").onclick = function () {
        var a = document.createElement("a");
        a.href = $("#oneQr canvas").toDataURL("image/png");
        a.download = p.name + "_二维码.png";
        a.click();
      };
    }
    $("#searchBtn").onclick = function () {
      var q = $("#q").value.trim();
      renderList(q);
      var hit = S.people().filter(function (p) {
        return p.code.toLowerCase() === q.toLowerCase() || p.name === q;
      })[0];
      if (hit) showOne(hit);
    };
    $("#q").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#searchBtn").click(); });
    $("#list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-view]");
      if (!b) return;
      showOne(S.findById(b.dataset.view));
    });
    $("#batchBtn").onclick = function () {
      var ps = S.people().slice(0, 12);
      var html = ps.map(function (p) {
        var r = window.QR.encode(S.personLink(p));
        var cells = "";
        for (var i = 0; i < r.size; i++) for (var j = 0; j < r.size; j++)
          cells += r.matrix[i][j] ? '<rect x="' + j + '" y="' + i + '" width="1" height="1"/>' : "";
        return '<div class="qr-card" style="display:inline-block;width:33%;vertical-align:top">' +
          '<svg viewBox="-2 -2 ' + (r.size + 4) + " " + (r.size + 4) + '" style="width:150px;height:150px">' +
          '<rect x="-2" y="-2" width="' + (r.size + 4) + '" height="' + (r.size + 4) + '" fill="#fff"/>' +
          '<g fill="#000">' + cells + "</g></svg>" +
          "<div style='font-size:12px;margin-top:6px'>" + esc(p.name) + " · " + esc(p.table || "待补充") + "</div>" +
          "<div style='font-size:11px;color:#666'>" + p.code + "</div></div>";
      }).join("");
      $("#printArea").innerHTML = html;
      A.toast("已生成前 " + ps.length + " 张二维码，可打印或另存为 PDF");
      window.print();
    };
    renderList("");
  };

  /* ============ 系统设置 ============ */
  A.PAGES["settings"] = function () {
    function render() {
      var c = S.cfg();
      $("#domain").value = c.domain;
      $("#openLead").value = c.openLeadMinutes;
      $("#accTable").innerHTML = rowsHTML(S.accounts().map(function (a) {
        return '<tr><td><b>' + esc(a.no || "") + "</b></td><td class='mono'>" + esc(a.user) + "</td>" +
          "<td class='mono'>" + esc(a.pass) + '</td><td><span class="pill ' + (a.role === "kiosk" ? "mint" : "info") + '">' +
          (a.role === "kiosk" ? "签到台" : "管理后台") + '</span></td><td class="ops">' +
          '<button class="btn sm" data-pw="' + esc(a.user) + '">改密码</button></td></tr>';
      }));
      $$("#accTable [data-pw]").forEach(function (b) {
        b.onclick = function () {
          var v = prompt("给账号 " + b.dataset.pw + " 设置新密码（直接确定=恢复 123456）：", "123456");
          if (v == null) return;
          S.setAccountPassword(b.dataset.pw, v.trim() || "123456");
          A.toast("已修改 " + b.dataset.pw + " 的密码");
          render();
        };
      });
      $$("#qrModeSeg span").forEach(function (s) {
        s.classList.toggle("on", (c.qrMode === "formal" ? "formal" : "demo") === s.dataset.mode);
      });
      var info = S.linkModeInfo();
      var sample = S.people()[0];
      $("#linkInfo").innerHTML = "<i></i><div>" + esc(info.text) +
        "<br>现在的二维码内容示例：<span class='code-chip'>" + esc(sample ? S.personLink(sample) : info.base) + "</span></div>";
      $("#logs").innerHTML = rowsHTML(S.logs().slice(0, 20).map(function (l) {
        return "<tr><td class='mono'>" + esc(l.at) + "</td><td>" + esc(l.actor) + '</td><td><span class="pill info">' +
          esc(l.type) + "</span></td><td>" + esc(l.target) + "</td><td>" + esc(l.detail) + "</td></tr>";
      }));
      $("#cats").innerHTML = S.categories().map(function (x) {
        return '<span class="tag">' + x + "</span>";
      }).join("") || '<span class="small muted">暂无（导入名单后自动出现）</span>';
      $("#comps").innerHTML = S.companies().map(function (x) {
        return '<span class="tag">' + x + "</span>";
      }).join("") || '<span class="small muted">暂无（导入名单后自动出现）</span>';
      var s = S.stats();
      $("#dataInfo").textContent = "当前活动：" + S.event().name + " · 人员 " + s.应到 + " 条 · 签到 " +
        S.checkins().length + " 条 · 现场注册 " + s.现场注册 + " 条";
      var loc = document.getElementById("dataLoc");
      if (loc) {
        var origin = (location.protocol === "http:" || location.protocol === "https:")
          ? location.origin
          : "本地文件（file://）";
        loc.innerHTML = "数据保存在当前网址下：<b>" + esc(origin) + "</b>，共 " + S.people().length +
          " 人（全部活动）。<br><span class='small muted'>注意：用别的网址打开（例如换了 IP、或从 file:// 改成 http://）会看不到这里的数据，请固定用同一个地址。</span>";
      }
    }
    $("#save").onclick = function () {
      S.setCfg({
        domain: $("#domain").value.trim().replace(/\/$/, ""),
        openLeadMinutes: Number($("#openLead").value) || 120,
      });
      A.toast("已保存（域名与签到开放时间）");
      render();
    };
    $("#resetAcc").onclick = function () {
      S.setCfg({ accounts: S.defaultAccounts() });
      A.toast("已恢复默认账号：admin01~05 / kiosk01~03，密码 123456");
      render();
    };
    $("#qrModeSeg").addEventListener("click", function (e) {
      var t = e.target.closest("[data-mode]");
      if (!t) return;
      S.setCfg({ qrMode: t.dataset.mode });
      A.toast(t.dataset.mode === "demo" ? "已切换：二维码指向本站页面（手机同 WiFi 可扫）" : "已切换：二维码指向配置域名");
      render();
    });
    $("#reset").onclick = function () {
      if (!confirm("恢复演示数据？当前人员、签到与日志都会被覆盖。")) return;
      S.reset();
      A.toast("已重置为演示数据");
      render();
      if (window.__app.renderShell) window.__app.renderShell();
    };
    $("#clearBtn").onclick = function () {
      if (!confirm("清除当前活动所有人员的手机号？此操作不可恢复。")) return;
      S.people().forEach(function (p) { p.phone = ""; });
      S.log("清理个人信息", S.event().name, "清除全部电话");
      S.persist();
      A.toast("已清除手机号并记录日志");
      render();
    };
    $("#exportLog").onclick = function () {
      A.download("操作日志.csv", S.toCSV([["时间", "操作人", "类型", "目标", "详情"]].concat(
        S.logs().map(function (l) { return [l.at, l.actor, l.type, l.target, l.detail]; }))));
    };
    $("#addCat").onclick = function () {
      if (!S.addCategory($("#newCat").value)) { A.toast("请输入类别名称", "bad"); return; }
      $("#newCat").value = "";
      A.toast("已添加类别，人员和签到查询的类别下拉里会出现");
      render();
    };
    $("#addComp").onclick = function () {
      if (!S.addCompany($("#newComp").value)) { A.toast("请输入公司 / 部门名称", "bad"); return; }
      $("#newComp").value = "";
      A.toast("已添加公司 / 部门");
      render();
    };
    render();
  };

  /* ============ 投屏看板 ============ */
  A.PAGES["live"] = function () {
    function render() {
      var s = S.stats(), cats = S.statsByCategory(), comps = S.statsByCompany();
      $("#total").textContent = A.num(s.合计到场);
      $("#subs").innerHTML = [["应到", s.应到], ["未到", s.未到], ["现场注册", s.现场注册], ["手动签到", s.手动签到]]
        .map(function (d) { return "<div><b>" + A.num(d[1]) + "</b><i>" + d[0] + "</i></div>"; }).join("");
      var catKeys = Object.keys(cats).sort(function (a, b) { return cats[b].实到 - cats[a].实到; });
      var max = Math.max.apply(null, catKeys.map(function (k) { return cats[k].应到 || 1; }));
      $("#rank").innerHTML = catKeys.map(function (k, i) {
        return '<div class="r' + (i % 2 ? "" : " g") + '"><span>' + esc(k) + '</span><span class="track"><i style="width:' +
          Math.round((cats[k].实到 / max) * 100) + '%"></i></span><span class="mono">' + A.num(cats[k].实到) + "</span></div>";
      }).join("");
      var compKeys = Object.keys(comps).sort(function (a, b) { return comps[b].实到 - comps[a].实到; }).slice(0, 4);
      var cmax = Math.max.apply(null, compKeys.map(function (k) { return comps[k].应到 || 1; }));
      $("#rank2").innerHTML = compKeys.map(function (k) {
        return '<div class="r"><span>' + esc(k) + '</span><span class="track"><i style="width:' +
          Math.round((comps[k].实到 / cmax) * 100) + '%"></i></span><span class="mono">' + A.num(comps[k].实到) + "</span></div>";
      }).join("");
      var recent = S.checkins().slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 9);
      $("#feed").innerHTML = recent.map(function (c) {
        var p = S.findById(c.personId) || { name: "—", company: "", table: "" };
        return "<div class='it'><span>" + esc(p.name) + " · " + esc(p.company) + "</span><span class='mono'>" +
          timeOnly(c.at) + "</span></div>";
      }).join("") || "<div class='it'><span>等待签到…</span><span></span></div>";
      $("#updated").textContent = "最后更新 " + new Date().toTimeString().slice(0, 8);
      $("#evName").textContent = S.event().name + " · 实时看板";
    }
    render();
    setInterval(render, 5000);
    A.PAGES.live.live = render;
  };

  /* ============ 导航首页 ============ */
  A.PAGES["index"] = function () {
    var s = S.stats(), ev = S.event();
    $("#sum").innerHTML = stat("当前活动", A.num(s.应到), esc(ev.name), "b") +
      stat("已签到", A.num(s.合计到场), "含现场注册", "g") +
      stat("现场注册", A.num(s.现场注册), "待补充桌号 " + s.待补充桌号, "m") +
      stat("签到状态", "", S.status().text, "o");
    var url = S.registerLink();
    window.QR.mount($("#homeQr"), url, { scale: 5, size: 150 });
    $("#homeUrl").textContent = url;
    $("#resetTip").onclick = function () {
      if (confirm("重置演示数据？")) { S.reset(); location.reload(); }
    };
  };

  /* ============ 后台 · 打印模板设计 ============ */
  A.PAGES["print-template"] = function () {
    var FIELDS = [
      ["name", "姓名"], ["title", "职务"], ["company", "公司 / 部门"], ["table", "桌号"],
      ["category", "类别"], ["code", "个人编号"], ["sales", "负责销售"], ["event", "活动名称"], ["date", "日期"],
    ];
    var tpl = S.template();

    function fieldsSelect(row, i) {
      return '<select data-act="field" data-i="' + i + '">' + FIELDS.map(function (f) {
        return '<option value="' + f[0] + '"' + (row.field === f[0] ? " selected" : "") + ">" + f[1] + "</option>";
      }).join("") + "</select>";
    }
    function renderRows() {
      $("#rows").innerHTML = tpl.rows.map(function (row, i) {
        return '<div class="r-row">' +
          '<span class="grip" data-act="up" data-i="' + i + '" title="上移">⋮⋮</span>' +
          '<span class="fld">' + fieldsSelect(row, i) + "</span>" +
          '<span class="mini ' + (row.size === "lg" ? "on" : "") + '" data-act="size" data-i="' + i + '">' +
            (row.size === "lg" ? "大号" : row.size === "md" ? "中号" : "小号") + "</span>" +
          '<span class="mini ' + (row.bold ? "on" : "") + '" data-act="bold" data-i="' + i + '">加粗</span>' +
          '<span class="mini on" data-act="align" data-i="' + i + '">居中</span>' +
          '<span class="del" data-act="del" data-i="' + i + '" title="删除">✕</span></div>';
      }).join("");
      wire();
    }
    function wire() {
      $$("#rows [data-act]").forEach(function (el) {
        el.onclick = function () {
          var i = +el.dataset.i, act = el.dataset.act;
          if (act === "size") tpl.rows[i].size = tpl.rows[i].size === "lg" ? "md" : tpl.rows[i].size === "md" ? "sm" : "lg";
          if (act === "bold") tpl.rows[i].bold = !tpl.rows[i].bold;
          if (act === "del") tpl.rows.splice(i, 1);
          if (act === "up" && i > 0) { var r = tpl.rows.splice(i, 1)[0]; tpl.rows.splice(i - 1, 0, r); }
          renderAll();
        };
      });
      $$("#rows select[data-act=field]").forEach(function (sel) {
        sel.onchange = function () { tpl.rows[+sel.dataset.i].field = sel.value; renderAll(); };
      });
    }
    function renderPreview() {
      window.Print.preview($("#preview"), null, tpl, 1.5);
      $("#sum").textContent = window.Print.sizeName(tpl.size) + " · " + tpl.rows.length + " 行 · 一次 1 张" + (tpl.qr ? " · 带二维码" : "");
    }
    function renderAll() { renderRows(); renderPreview(); }

    $("#sizeSeg").addEventListener("click", function (e) {
      var t = e.target.closest("[data-size]");
      if (!t) return;
      tpl.size = t.dataset.size;
      $$("#sizeSeg span").forEach(function (s) { s.classList.toggle("on", s === t); });
      renderAll();
    });
    $("#qrSeg").addEventListener("click", function (e) {
      var t = e.target.closest("[data-qr]");
      if (!t) return;
      tpl.qr = t.dataset.qr === "1";
      $$("#qrSeg span").forEach(function (s) { s.classList.toggle("on", s === t); });
      renderAll();
    });
    $("#gapSeg").addEventListener("click", function (e) {
      var t = e.target.closest("[data-gap]");
      if (!t) return;
      tpl.gap = t.dataset.gap;
      $$("#gapSeg span").forEach(function (s) { s.classList.toggle("on", s === t); });
      renderAll();
    });
    $("#addRow").onclick = function () {
      tpl.rows.push({ field: "table", title: "桌号", size: "sm", bold: false, align: "center" });
      renderAll();
    };
    $$("#presets [data-preset]").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.preset;
        if (k === "name") tpl.rows = [{ field: "name", title: "姓名", size: "lg", bold: true, align: "center" }];
        if (k === "nameTable") tpl.rows = [
          { field: "name", title: "姓名", size: "lg", bold: true, align: "center" },
          { field: "table", title: "桌号", size: "md", bold: false, align: "center" },
        ];
        if (k === "full") tpl.rows = [
          { field: "name", title: "姓名", size: "lg", bold: true, align: "center" },
          { field: "title", title: "职务", size: "md", bold: false, align: "center" },
          { field: "company", title: "公司/部门", size: "md", bold: false, align: "center" },
          { field: "table", title: "桌号", size: "sm", bold: false, align: "center" },
        ];
        renderAll();
        A.toast("已套用预设，记得点保存");
      };
    });
    $("#save").onclick = function () {
      S.setTemplate(tpl);
      A.toast("打印格式已保存，本场活动立即生效");
    };
    $("#testPrint").onclick = function () {
      window.Print.printLabel(S.people()[0] || null, { note: "测试打印" });
      A.toast("已发送测试标签 1 张");
    };
    $("#reset").onclick = function () {
      tpl = S.DEFAULT_TEMPLATE;
      renderAll();
    };
    renderAll();
  };
  /* ============ 名单管理（导入 + 校验 + 合并更新） ============ */
  A.PAGES["import"] = function () {
    var SAMPLE = [
      "CBB 2026 晚宴 参会名单（模板）",
      "本次活动预计席位数 30 位，数据来源：销售汇总表，请勿改动表头。",
      "",
      "酒店桌号,类别,姓名,公司/部门,职务,电话,负责销售",
      "18,VIP,张三,示例公司A,总监,13800000001,销售A",
      "18,VIP,李四,示例公司A,经理,13800000002,销售A",
      "19,Non-VIP,王五,示例公司B,主管,138 0000 0003,销售B",
      ",未分类,赵六,示例公司B,,13800000004,销售B",
      "20,VIP,张三,示例公司A,总监,13800000001,销售A",
      "20,内部陪同,钱七,示例部门,专员,138-0000-0005,销售C",
      ",VIP,孙八,示例公司A,经理,1380000,销售A",
      "21,VIP,周九,示例公司C,副总,13800000007,销售D",
    ].join("\n");
    function showPreview(res) {
      $("#preview").style.display = "";
      if (!res.ok) {
        $("#counts").innerHTML = '<div class="note bad" style="grid-column:1/-1"><i></i><div>' + esc(res.reason) + "</div></div>";
        $("#issues").innerHTML = emptyRow(4, "无法解析文件");
        $("#confirmBtn").style.display = "none";
        return;
      }
      var c = res.counts;
      $("#counts").innerHTML =
        stat("将新增", c.add, "条", "b") + stat("将更新", c.upd, "条（合并到原记录）", "m") +
        stat("自动去重", c.dedup, "条（同名同公司）", "k") + stat("校验提醒", res.issues.length, "条（见下表）", "o");
      var diffNote = c.est && c.est !== c.rows
        ? '<div class="note warn" style="grid-column:1/-1"><i></i><div>文件说明里写的席位数是 ' + c.est + " 位，实际数据 " +
          c.rows + " 条，两者不一致，请确认后再导入。</div></div>"
        : "";
      $("#previewNote").innerHTML = diffNote +
        '<div class="note ok" style="grid-column:1/-1"><i></i><div>表头在第 ' + (res.headerIdx + 1) +
        " 行自动识别，上方说明文字已跳过；唯一标识为「姓名 + 公司／部门」。</div></div>";
      $("#issues").innerHTML = res.issues.length ? rowsHTML(res.issues.slice(0, 40).map(function (it) {
        return '<tr><td class="mono">' + it.lineNo + "</td><td>" + esc(it.name) + "</td><td>" +
          it.probs.map(function (p) { return '<span class="pill ' + (p.level === "错误" ? "bad" : p.level === "提醒" ? "man" : "ok") + '">' +
            esc(p.kind) + "</span>"; }).join(" ") + "</td><td>" +
          it.probs.map(function (p) { return esc(p.text); }).join("；") + "</td></tr>";
      })) : emptyRow(4, "没有发现问题");
      $("#confirmBtn").style.display = "";
      A.PAGES.import.pending = res;
    }
    function analyze() {
      var text = $("#csvText").value.trim();
      if (!text) { A.toast("请先选择文件或粘贴名单内容", "bad"); return; }
      showPreview(S.analyzeImport(text));
    }
    $("#analyzeBtn").onclick = analyze;
    $("#sampleBtn").onclick = function () { $("#csvText").value = SAMPLE; analyze(); };
    function decodeText(buf) {
      var txt = new TextDecoder("utf-8").decode(buf);
      if (txt.indexOf("\ufffd") >= 0) {           // Excel 另存的 CSV 常是 GBK
        try { txt = new TextDecoder("gbk").decode(buf); } catch (e) {}
      }
      return txt;
    }
    async function handleFile(f) {
      if (!f) return;
      try {
        var buf = await f.arrayBuffer();
        var text;
        if (window.XLSX.isOldXls(buf)) {
          A.toast("这是老版 .xls 格式，请在 Excel 里另存为 .xlsx 或 .csv 后再上传", "bad");
          return;
        }
        if (window.XLSX.isXlsx(buf)) {
          var rows = await window.XLSX.toRows(buf);
          text = window.XLSX.toCSVText(rows);
          A.toast("已读取 Excel：「" + f.name + "」共 " + rows.length + " 行");
        } else {
          text = decodeText(buf);
        }
        $("#csvText").value = text;
        analyze();
      } catch (err) {
        A.toast("解析失败：" + err.message, "bad");
      }
    }
    $("#fileInput").onchange = function (e) {
      handleFile(e.target.files[0]);
      e.target.value = "";
    };
    var dz = $("#dropZone");
    if (dz) {
      dz.addEventListener("dragover", function (e) { e.preventDefault(); dz.style.borderColor = "var(--brand)"; });
      dz.addEventListener("dragleave", function () { dz.style.borderColor = ""; });
      dz.addEventListener("drop", function (e) {
        e.preventDefault();
        dz.style.borderColor = "";
        handleFile(e.dataTransfer.files[0]);
      });
    }
    $("#confirmBtn").onclick = function () {
      var res = A.PAGES.import.pending;
      if (!res || !res.ok) return;
      var out = S.applyImport(res.items);
      A.toast("导入完成：新增 " + out.added + " 条，更新 " + out.updated + " 条");
      $("#csvText").value = "";
      $("#preview").style.display = "none";
      $("#recentImport").innerHTML = '<span class="pill ok">最近一次导入：新增 ' + out.added + " 条 / 更新 " + out.updated + " 条</span>";
    };
    $("#tplBtn").onclick = function () {
      var rows = [
        ["CBB 2026 晚宴 参会名单（模板）"],
        ["预计席位数 30 位，数据来源：销售汇总表"],
        [""],
        ["酒店桌号", "类别", "姓名", "公司/部门", "职务", "电话", "负责销售"],
        ["18", "VIP", "张三", "示例公司A", "总监", "13800000001", "销售A"],
        ["", "Non-VIP", "李四", "示例公司B", "经理", "", "销售B"],
      ];
      A.download("名单模板.csv", S.toCSV(rows));
      A.toast("已下载名单模板（含说明行与表头）");
    };
    var last = S.logs().filter(function (l) { return l.type === "名单导入"; })[0];
    $("#recentImport").innerHTML = last
      ? '<span class="pill info">' + esc(last.at) + " · " + esc(last.detail) + "</span>"
      : '<span class="pill">还没有导入记录</span>';
  };

  /* ============ 人员库 ============ */
  A.PAGES["people"] = function () {
    function filtered() {
      var q = $("#fq").value.trim(), src = $("#fsrc").value, st = $("#fst").value;
      var cat = $("#fcat").value, comp = $("#fcomp").value;
      var base = q ? S.search(q) : S.people();     // 关键词：姓名 / 手机号（后四位）/ 桌号 / 编码 / 公司
      return base.filter(function (p) {
        if (src && p.source !== src) return false;
        if (st === "signed" && !S.isChecked(p.id)) return false;
        if (st === "unsigned" && S.isChecked(p.id)) return false;
        if (cat && p.category !== cat) return false;
        if (comp && p.company !== comp) return false;
        return true;
      });
    }
    function render() {
      var list = filtered();
      $("#list").innerHTML = list.length ? rowsHTML(list.slice(0, 60).map(function (p) {
        var c = S.findCheckin(p.id);
        return "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.company) + "</td><td>" + esc(p.title || "—") +
          '</td><td class="mono">' + A.maskPhone(p.phone) + '</td><td class="mono">' + esc(p.table || "待补充") +
          '</td><td><span class="pill">' + esc(p.category) + "</span></td><td>" + A.sourcePill(p) + "</td><td>" +
          A.statusPill(p) + '</td><td class="mono">' + (c ? timeOnly(c.at) : "—") + "</td><td>" +
          (c ? (c.method === "manual" ? "工作人员代签" : "扫码签到") : "—") + '</td><td class="ops">' +
          '<button class="btn sm" data-view="' + p.id + '">详情</button></td></tr>';
      })) : emptyRow(11, "没有匹配的人员");
      $("#count").textContent = "共 " + list.length + " 条（显示前 60 条）";
    }
    $("#fq").oninput = render;
    ["#fsrc", "#fst", "#fcat", "#fcomp"].forEach(function (id) { $(id).onchange = render; });
    function fillFilters() {
      A.fillSelect($("#fcat"), S.categories());
      A.fillSelect($("#fcomp"), S.companies());
    }
    $("#resetBtn").onclick = function () {
      ["#fq"].forEach(function (id) { $(id).value = ""; });
      ["#fsrc", "#fst", "#fcat", "#fcomp"].forEach(function (id) { $(id).value = ""; });
      render();
    };
    $("#exportBtn").onclick = function () {
      var list = filtered();
      A.download("人员库_" + S.event().name + ".csv", S.toCSV([S.PERSON_HEADER].concat(list.map(S.personRow))));
      S.log("导出", "人员库", "筛选导出 " + list.length + " 条");
    };
    $("#list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-view]");
      if (!b) return;
      var p = S.findById(b.dataset.view), c = S.findCheckin(p.id);
      $("#detail").innerHTML =
        '<div class="hd"><h3>' + esc(p.name) + '</h3><span class="pill' + (p.source === "onsite" ? " mint" : " info") + '">' +
        (p.source === "onsite" ? "现场注册" : "名单导入") + "</span></div>" +
        '<div class="bd stack" style="gap:10px">' +
        '<dl class="kv"><dt>公司/部门</dt><dd>' + esc(p.company) + "</dd><dt>职务</dt><dd>" + esc(p.title || "—") +
        "</dd><dt>电话</dt><dd>" + A.maskPhone(p.phone) + "</dd><dt>桌号</dt><dd>" + esc(p.table || "待补充") +
        "</dd><dt>类别</dt><dd>" + esc(p.category) + "</dd><dt>负责销售</dt><dd>" + esc(p.sales || "—") +
        "</dd><dt>唯一编码</dt><dd class='mono-sm'>" + p.code + "</dd><dt>签到</dt><dd>" +
        (c ? c.at + "（" + (c.method === "manual" ? "工作人员代签" : "扫码签到") + "）" : "未签到") + "</dd></dl>" +
        '<div class="qr-holder" id="detailQr"></div>' +
        '<div class="row">' + (c
          ? '<button class="btn danger" id="undoBtn">撤销签到</button>'
          : '<button class="btn primary" id="signBtn">补签（工作人员代签）</button>') +
        '<button class="btn ghost" id="tableBtn">修改桌号</button></div></div>';
      window.QR.mount($("#detailQr"), S.personLink(p), { scale: 4, size: 130 });
      if ($("#undoBtn")) $("#undoBtn").onclick = function () {
        var r = prompt("撤销原因？");
        if (r == null) return;
        S.undoCheckin(p.id, r); A.toast("已撤销签到并留痕"); render();
      };
      if ($("#signBtn")) $("#signBtn").onclick = function () {
        S.checkin(p.id, "manual"); A.toast("已补签"); render();
      };
      $("#tableBtn").onclick = function () {
        var v = prompt("新的桌号？", p.table || "");
        if (v == null) return;
        S.updatePerson(p.id, { table: v.trim() }); A.toast("桌号已更新"); render();
      };
    });
    render();
    fillFilters();
    A.PAGES.people.live = fillFilters;
  };
})();
