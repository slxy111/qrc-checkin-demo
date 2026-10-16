/* 手机端页面逻辑：自助注册表单 + 个人二维码页（含手机号查询） */
(function () {
  var A = window.__app, S = A.S, $ = A.$, esc = A.esc;

  /* 真机（窄屏）打开时去掉预览用的手机外壳，变成独立全屏页面；电脑上预览仍保留外壳 */
  var FULL = false;
  try {
    FULL = window.matchMedia("(max-width: 520px)").matches || /[?&]full=1/.test(location.search);
  } catch (e) {}
  if (FULL) document.body.classList.add("mobile-full");

  function passCard(p, opts) {
    opts = opts || {};
    var ev = S.event();
    var url = S.personLink(p);
    var c = S.findCheckin(p.id);
    var qrBlock = p.code
      ? '<div class="qr-holder" id="passQr"></div>'
      : '<div class="pc-qr-empty">二维码待生成<br><span>可先出示本页信息，工作人员可检索到你的资料</span></div>';
    return (
      '<div class="pass-card">' +
      '<div class="pc-ev">' + esc(ev.name) + " · " + esc(ev.startAt) + " · " + esc(ev.place) + "</div>" +
      '<div class="pc-name">' + esc(p.name) + "</div>" +
      (p.table ? '<div class="pc-table">桌号 ' + esc(p.table) + "</div>" : '<div class="pc-table">桌号待工作人员确认</div>') +
      qrBlock +
      '<div class="pc-tip">请把屏幕亮度调至最高，方便扫码</div>' +
      '<div class="pc-meta">' +
      '<span class="pill ' + (c ? "ok" : "") + '">' + (c ? "已签到 " + c.at.slice(11, 16) : "尚未签到") + "</span>" +
      (opts.note ? "<span class='small'>" + esc(opts.note) + "</span>" : "") +
      (opts.showLink !== false ? '<span class="mono-sm">' + esc(url) + "</span>" : "") +
      "</div></div>"
    );
  }

  /* ============ 手机端 · 自助注册 ============ */
  A.PAGES["mobile-register"] = function () {
    var form = $("#mregForm");
    var modal = $("#mregModal");
    var result = $("#mregResult");
    var ev = S.event();
    $("#mregEv").textContent = ev.name + " · " + ev.place;
    if (form.elements.category)
      form.elements.category.innerHTML = '<option value="">请选择</option>' +
        S.categories().map(function (c) { return "<option>" + c + "</option>"; }).join("");

    function openModal(title, text) {
      $("#modalTitle").textContent = title;
      $("#modalText").textContent = text;
      modal.style.display = "flex";
    }
    $("#modalOk").onclick = function () {
      modal.style.display = "none";
      if (result.dataset.personId) showPass(S.findById(result.dataset.personId));
    };
    function showPass(p) {
      result.style.display = "";
      result.innerHTML = passCard(p);
      if (p.code && $("#passQr")) window.QR.mount($("#passQr"), S.personLink(p), { scale: 6, size: 210 });
      if ($("#regEmpty")) $("#regEmpty").style.display = "none";
      if (FULL) {   // 真机上：直接切到二维码页（全屏），把表单收起来
        if ($("#formPhone")) $("#formPhone").style.display = "none";
        if ($("#resultPhone")) $("#resultPhone").style.display = "block";
        window.scrollTo(0, 0);
      }
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var d = {};
      ["name", "company", "phone", "title", "category", "note"].forEach(function (k) {
        d[k] = form.elements[k].value.trim();
      });
      if (!d.name || !d.company || !d.phone || !d.title) {
        A.toast("姓名、公司／部门、手机号、职务为必填项", "bad");
        return;
      }
      if (!A.isPhone(d.phone)) { A.toast("请填写 11 位有效手机号", "bad"); return; }
      var r = S.addPerson(d, { source: "onsite" });
      result.dataset.personId = r.person.id;
      if (r.status === "added") {
        openModal("注册成功，请与工作人员确认桌号", "你的信息已同步到签到台，工作人员会为你分配桌号；请留在此页面，稍后出示二维码完成签到。");
      } else if (r.status === "merged") {
        openModal("信息已更新，请与工作人员确认桌号", "该姓名与公司已存在，本次填写的内容已合并到原记录，请与工作人员确认桌号。");
      } else {
        openModal("你已经注册过了", "系统里已有你的记录，请与工作人员确认桌号；下方是可用的签到二维码。");
      }
      form.reset();
    };
    if (result.dataset.personId) showPass(S.findById(result.dataset.personId));
  };

  /* ============ 手机端 · 个人二维码页 / 手机号查询 ============ */
  A.PAGES["mobile-pass"] = function () {
    var mode = document.body.dataset.mode || "link";
    var box = $("#passBox");
    var form = $("#queryForm");
    var params = new URLSearchParams(location.search);
    var code = params.get("c") || params.get("code");

    function render(p, note) {
      box.style.display = "";
      box.innerHTML = passCard(p, { showLink: false, note: note });
      if (p.code && $("#passQr")) window.QR.mount($("#passQr"), S.personLink(p), { scale: 6, size: 230 });
      if (form) form.closest(".card").style.display = "none";
      $("#hintBar").innerHTML = '<span class="pill ok">已找到你的信息</span>' +
        (note ? '<span class="pill info">' + esc(note) + "</span>" : "");
    }
    function notFound(msg) {
      box.style.display = "none";
      $("#hintBar").innerHTML = '<div class="note bad" style="width:100%"><i></i><div><b>' + esc(msg || "信息错误") +
        "</b><br>请确认手机号是否为报名时填写的号码；如仍有问题，请到签到台联系工作人员。</div></div>";
    }

    if (code) {
      var p0 = S.findByCode(code);
      if (p0) render(p0);
      else notFound("链接已失效或不属于本场活动");
    } else {
      $("#hintBar").innerHTML = '<div class="note info" style="width:100%"><i></i><div>' +
        (mode === "query" ? "没有短信链接也没关系：输入报名时填写的手机号，即可查看自己的二维码。" : "未带参数打开，输入手机号查询自己的二维码。") +
        "</div></div>";
      form.onsubmit = function (e) {
        e.preventDefault();
        var v = String(form.elements.phone.value).replace(/[\s-]/g, "");   // 去掉空格和横线
        if (!A.isPhone(v)) return notFound("手机号格式不正确");
        var hits = S.search(v);
        var note = "";
        if (!hits.length) {
          // 当前活动里没有 → 在所有活动里再找一次（参会人未必知道自己在哪一场）
          var all = S.searchAll(v);
          if (all.length) {
            var rec = all[0];
            hits = [rec.person];
            var ev = S.events().filter(function (x) { return x.id === rec.eventId; })[0];
            if (ev) {
              note = ev.id === S.event().id ? "" : "该号码在「" + ev.name + "」里";
              if (ev.id !== S.event().id) S.setEvent(ev.id);
            }
          }
        }
        if (!hits.length) return notFound("信息错误");
        if (hits.length > 1) {
          hits = hits.filter(function (x) { return String(x.phone || "").replace(/[\s-]/g, "") === v; });
          if (hits.length !== 1) return notFound("该号码对应多位人员，请到签到台核对");
        }
        render(hits[0], note);
      };
      if (mode !== "query") {
        // 个人二维码页（短信链接）：不带参数时给几个演示入口，避免和「手机号查询页」看起来一样
        var samples = S.people().slice(0, 3);
        var card = document.getElementById("queryCard");
        if (card && samples.length) {
          card.innerHTML =
            '<div class="center"><div style="font-size:13px;color:var(--muted)">个人二维码页（演示）</div>' +
            '<h3 style="font-size:19px;margin-top:6px">没有带专属链接</h3>' +
            '<p class="small muted">正式使用时，参会人点短信里的专属链接打开本页，会直接显示本人二维码。下面可以任选一位测试：</p></div>' +
            '<div class="stack mt" style="gap:10px">' +
            samples.map(function (p) {
              return '<a class="btn block" href="mobile-pass.html?c=' + p.code + '">' +
                esc(p.name) + " · " + esc(p.company) + "（打开他的二维码）</a>";
            }).join("") +
            "</div>" +
            '<div class="divider"></div>' +
            '<a class="btn ghost block" href="mobile-query.html">我只有手机号 → 去手机号查询页</a>';
          $("#hintBar").innerHTML = '<div class="note info" style="width:100%"><i></i><div>本页用于「短信专属链接」；如果你想按手机号查，请用<b>手机号查询页</b>。两者是不同的入口。</div></div>';
        }
      }
    }
  };
})();
