/* 打印引擎：按后台设计的模板，打印一张标签（1 份）
   - 屏幕预览：Print.preview(容器, 人员, 模板, 放大倍数)
   - 直接打印：Print.printLabel(人员)  —— 隐藏 iframe + window.print()，纸张尺寸按标签规格声明 */
(function (global) {
  var S = window.Store;
  var PT = { lg: 21, md: 10, sm: 8 }; // 字号（pt）
  var PX_PER_MM = 96 / 25.4;          // 屏幕预览用

  var SAMPLE = { name: "姓名占位", title: "职务占位", company: "公司 / 部门占位", table: "00", category: "VIP", code: "XXXXXXXX" };

  function fieldValue(p, field, ev) {
    p = p || SAMPLE;
    switch (field) {
      case "name": return p.name || "";
      case "title": return p.title || "";
      case "company": return p.company || "";
      case "table": return p.table ? "桌号 " + p.table : "";
      case "category": return p.category || "";
      case "code": return p.code || "";
      case "sales": return p.sales || "";
      case "note": return p.note || "";
      case "event": return ev && ev.name ? ev.name : "";
      case "date": return ev && ev.startAt ? String(ev.startAt).slice(0, 10) : "";
      default: return p[field] || "";
    }
  }

  function qrSVG(text, mm) {
    var r = window.QR.encode(text);
    var cells = "";
    for (var i = 0; i < r.size; i++)
      for (var j = 0; j < r.size; j++)
        if (r.matrix[i][j]) cells += '<rect x="' + j + '" y="' + i + '" width="1" height="1"/>';
    var side = mm || 14;
    return '<svg width="' + side + 'mm" height="' + side + 'mm" viewBox="-2 -2 ' + (r.size + 4) + " " +
      (r.size + 4) + '" shape-rendering="crispEdges" role="img" aria-label="二维码">' +
      '<rect x="-2" y="-2" width="' + (r.size + 4) + '" height="' + (r.size + 4) + '" fill="#fff"/>' +
      '<g fill="#111">' + cells + "</g></svg>";
  }

  /* 标签内部结构（不含外框样式） */
  function labelInner(p, tpl) {
    tpl = tpl || S.template();
    var ev = S.event();
    var gap = tpl.gap === "loose" ? "2.2mm" : tpl.gap === "normal" ? "1.2mm" : "0.6mm";
    var lines = tpl.rows.map(function (row) {
      var val = fieldValue(p, row.field, ev);
      if (!val) return "";   // 空值不打印，不留空行
      var text = (tpl.showLabel && row.title ? row.title + "：" : "") + val;
      return '<div class="ln" style="font-size:' + (PT[row.size] || 10) + "pt;font-weight:" + (row.bold ? 700 : 400) +
        ";text-align:" + (row.align || "center") + '">' + esc(text) + "</div>";
    }).join("");
    var qrTarget = p && p.code ? S.personLink(p) : S.cfg().domain + "/s/" + SAMPLE.code;
    var qr = tpl.qr ? '<div class="qrbox">' + qrSVG(qrTarget, tpl.size === "70x30" ? 16 : 13) + "</div>" : "";
    return '<div class="main" style="gap:' + gap + '">' + lines + "</div>" + qr;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function css(mm) {
    return "@page{size:" + mm.w + "mm " + mm.h + "mm;margin:0}" +
      "*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "html,body{margin:0;padding:0;background:#fff}" +
      ".label{width:" + mm.w + "mm;height:" + mm.h + "mm;display:flex;align-items:center;justify-content:center;" +
      "gap:1.6mm;padding:1.4mm 2mm;overflow:hidden;font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#111}" +
      ".main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}" +
      ".ln{line-height:1.12;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".qrbox{flex:none;display:flex;align-items:center;justify-content:center}" +
      ".qrbox svg{display:block}";
  }

  function documentHTML(p, tpl) {
    var mm = S.SIZES[tpl.size] || S.SIZES["70x30"];
    return "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><style>" + css(mm) +
      "</style></head><body><div class='label'>" + labelInner(p, tpl) + "</div></body></html>";
  }

  var lastIFrame = null;
  function printLabel(p, opts) {
    opts = opts || {};
    var tpl = S.template();
    var mm = S.SIZES[tpl.size] || S.SIZES["70x30"];
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:" + mm.w + "mm;height:" + mm.h +
      "mm;opacity:0;pointer-events:none;border:0";
    document.body.appendChild(f);
    lastIFrame = f;
    f.srcdoc = documentHTML(p, tpl);
    f.onload = function () {
      setTimeout(function () {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch (e) {}
        if (p && p.id) S.printLog(p.id, opts.note || "");
        setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 2500);
      }, 80);
    };
    return true;
  }

  /* 屏幕预览：把真实尺寸的标签按比例显示出来 */
  function preview(el, p, tpl, scale) {
    tpl = tpl || S.template();
    scale = scale || 1.4;
    var mm = S.SIZES[tpl.size] || S.SIZES["70x30"];
    var w = mm.w * PX_PER_MM, h = mm.h * PX_PER_MM;
    el.innerHTML = '<div style="width:' + w + "px;height:" + h + "px;transform:scale(" + scale +
      ');transform-origin:top left;background:#fff;border:1px dashed #c9d6f2;border-radius:4px;display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 8px;overflow:hidden;box-shadow:0 1px 2px rgba(20,35,60,.08)">' +
      labelInner(p, tpl) + "</div>";
    el.style.width = w * scale + "px";
    el.style.height = h * scale + "px";
    // 预览内的字号按 px 换算，保证和打印一致
    Array.prototype.forEach.call(el.querySelectorAll(".ln"), function (n) {
      var pt = parseFloat(n.style.fontSize);
      n.style.fontSize = (pt * (96 / 72)).toFixed(1) + "px";
      n.style.marginBottom = "1px";
    });
    Array.prototype.forEach.call(el.querySelectorAll(".main"), function (n) {
      n.style.gap = "2px";
    });
    return el;
  }

  function sizeName(key) {
    return (S.SIZES[key] || S.SIZES["70x30"]).name;
  }

  global.Print = {
    PT: PT,
    SAMPLE: SAMPLE,
    fieldValue: fieldValue,
    labelInner: labelInner,
    documentHTML: documentHTML,
    printLabel: printLabel,
    preview: preview,
    sizeName: sizeName,
  };
})(window);
