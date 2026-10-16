/* 读取 .xlsx（Excel 2007+）：用浏览器内置 DecompressionStream 解压 + XML 解析，不依赖第三方库。
   用法：const rows = await XLSX.toRows(arrayBuffer);  const csv = XLSX.toCSVText(rows); */
(function (global) {
  var td = function () { return new TextDecoder("utf-8"); };

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("当前浏览器不支持解压（请用较新的 Chrome / Edge）");
    var ds = new DecompressionStream("deflate-raw");
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    var u8 = new Uint8Array(buffer), dv = new DataView(buffer);
    var eocd = -1;
    for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("不是有效的 xlsx 文件");
    var count = dv.getUint16(eocd + 10, true);
    var off = dv.getUint32(eocd + 16, true);
    var files = {};
    for (var n = 0; n < count; n++) {
      if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true);
      var compSize = dv.getUint32(off + 20, true);
      var nameLen = dv.getUint16(off + 28, true);
      var extraLen = dv.getUint16(off + 30, true);
      var cmtLen = dv.getUint16(off + 32, true);
      var localOff = dv.getUint32(off + 42, true);
      var name = td().decode(u8.subarray(off + 46, off + 46 + nameLen));
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;
      files[name] = { method: method, comp: u8.subarray(dataStart, dataStart + compSize) };
      off += 46 + nameLen + extraLen + cmtLen;
    }
    return files;
  }

  async function entryText(files, name) {
    var f = files[name];
    if (!f) return null;
    var bytes = f.method === 0 ? f.comp : await inflateRaw(f.comp);
    return td().decode(bytes);
  }

  function colIndex(ref) {
    var m = String(ref || "").match(/^([A-Z]+)/);
    if (!m) return 0;
    var s = m[1], n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  function parseShared(xml) {
    if (!xml) return [];
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    return Array.prototype.map.call(doc.getElementsByTagName("si"), function (si) {
      return Array.prototype.map.call(si.getElementsByTagName("t"), function (t) { return t.textContent; }).join("");
    });
  }

  function parseSheet(xml, shared) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    var out = [];
    Array.prototype.forEach.call(doc.getElementsByTagName("row"), function (rowEl) {
      var rIdx = (+rowEl.getAttribute("r") || out.length + 1) - 1;
      var arr = [];
      Array.prototype.forEach.call(rowEl.getElementsByTagName("c"), function (c) {
        var ci = colIndex(c.getAttribute("r"));
        var t = c.getAttribute("t");
        var val = "";
        if (t === "s") {
          var v = c.getElementsByTagName("v")[0];
          val = v ? (shared[+v.textContent] || "") : "";
        } else if (t === "inlineStr") {
          val = Array.prototype.map.call(c.getElementsByTagName("t"), function (x) { return x.textContent; }).join("");
        } else if (t === "b") {
          var vb = c.getElementsByTagName("v")[0];
          val = vb && vb.textContent === "1" ? "是" : "否";
        } else {
          var vn = c.getElementsByTagName("v")[0];
          val = vn ? vn.textContent : "";
        }
        arr[ci] = String(val).trim();
      });
      var filled = [];
      for (var i = 0; i < arr.length; i++) filled[i] = arr[i] == null ? "" : arr[i];
      out[rIdx] = filled;
    });
    for (var i = 0; i < out.length; i++) if (!out[i]) out[i] = [];
    // 去掉头尾空行
    while (out.length && out[0].every(function (x) { return x === ""; })) out.shift();
    while (out.length && out[out.length - 1].every(function (x) { return x === ""; })) out.pop();
    return out;
  }

  async function toRows(buffer) {
    var files = await unzip(buffer);
    var shared = parseShared(await entryText(files, "xl/sharedStrings.xml"));
    var sheetName = Object.keys(files).filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort()[0];
    if (!sheetName) throw new Error("这个 xlsx 里没有找到工作表");
    var sheet = await entryText(files, sheetName);
    return parseSheet(sheet, shared);
  }

  function toCSVText(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? "" : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n");
  }

  function isXlsx(buffer) {
    var u8 = new Uint8Array(buffer.slice(0, 4));
    return u8[0] === 0x50 && u8[1] === 0x4b;   // "PK"
  }
  function isOldXls(buffer) {
    var u8 = new Uint8Array(buffer.slice(0, 8));
    return u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;
  }

  global.XLSX = { toRows: toRows, toCSVText: toCSVText, isXlsx: isXlsx, isOldXls: isOldXls };
})(window);
