/* 极简二维码编码器（字节模式，纠错等级 M/L，版本 1-4，单块 RS）
   规范：ISO/IEC 18004。输出 canvas / dataURL / 模块矩阵。 */
(function (global) {
  /* ---------- GF(256) ---------- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* 生成多项式 ∏(x - α^i)，系数高位在前 */
  function genPoly(n) {
    var g = [1], i, j;
    for (i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= gmul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }
  /* RS 纠错码字：data 除以生成多项式的余数 */
  function rsRemainder(data, gen) {
    var res = data.concat(new Array(gen.length - 1).fill(0));
    for (var i = 0; i < data.length; i++) {
      var f = res[i];
      if (!f) continue;
      for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], f);
    }
    return res.slice(data.length);
  }
  /* 校验：码字在 α^0..α^(n-1) 处应为 0 */
  function syndromesZero(codeword, n) {
    for (var k = 0; k < n; k++) {
      var sum = 0;
      for (var i = 0; i < codeword.length; i++) sum = gmul(sum, 1) ^ gmul(codeword[i], EXP[(k * (codeword.length - 1 - i)) % 255]);
      if (sum !== 0) return false;
    }
    return true;
  }

  /* ---------- 版本配置（均为单块 RS） ---------- */
  var CONFIG = [
    { v: 1, ecc: "M", eccBits: 0, data: 16, ec: 10, total: 26, rem: 0, align: [] },
    { v: 2, ecc: "M", eccBits: 0, data: 28, ec: 16, total: 44, rem: 7, align: [6, 18] },
    { v: 3, ecc: "M", eccBits: 0, data: 44, ec: 26, total: 70, rem: 7, align: [6, 22] },
    { v: 4, ecc: "L", eccBits: 1, data: 80, ec: 20, total: 100, rem: 7, align: [6, 26] },
  ];
  const capOf = (c) => Math.floor((c.data * 8 - 12) / 8);

  function utf8(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  /* ---------- 位流 ---------- */
  function makeCodewords(bytes, cfg) {
    var bits = [], i, b;
    var push = function (val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >> k) & 1); };
    push(4, 4);              // 字节模式
    push(bytes.length, 8);   // 版本 1-9 用 8 位长度
    bytes.forEach(function (byte) { push(byte, 8); });
    var capBits = cfg.data * 8;
    var term = Math.min(4, capBits - bits.length);
    push(0, term);
    while (bits.length % 8 !== 0) bits.push(0);
    var data = [];
    for (i = 0; i < bits.length; i += 8) {
      b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }
    var padByte = [0xec, 0x11];
    while (data.length < cfg.data) data.push(padByte[(data.length - (bits.length / 8)) % 2]);
    var gen = genPoly(cfg.ec);
    return { data: data, ecc: rsRemainder(data, gen), gen: gen };
  }

  /* ---------- 掩码 ---------- */
  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return ((i * j) % 2) + ((i * j) % 3) === 0; },
    function (i, j) { return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0; },
    function (i, j) { return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0; },
  ];

  function penalty(m) {
    var size = m.length, score = 0, i, j, run, dark = 0;
    var at = function (r, c) { return m[r][c] ? 1 : 0; };
    // 规则1：同色连续 >=5
    for (i = 0; i < size; i++) {
      run = 1;
      for (j = 1; j < size; j++) {
        if (at(i, j) === at(i, j - 1)) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
      for (j = 1; j < size; j++) {
        if (at(j, i) === at(j - 1, i)) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    // 规则2：2x2 同色
    for (i = 0; i < size - 1; i++)
      for (j = 0; j < size - 1; j++) {
        var v = at(i, j);
        if (v === at(i, j + 1) && v === at(i + 1, j) && v === at(i + 1, j + 1)) score += 3;
      }
    // 规则3：类定位图形
    var p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    var match = function (get, idx) {
      var a = true, b = true;
      for (var k = 0; k < 11; k++) {
        var v = get(idx + k);
        if (v !== p1[k]) a = false;
        if (v !== p2[k]) b = false;
      }
      return a || b;
    };
    for (i = 0; i < size; i++)
      for (j = 0; j + 11 <= size; j++) {
        if (match(function (k) { return at(i, k); }, j)) score += 40;
        if (match(function (k) { return at(k, i); }, j)) score += 40;
      }
    // 规则4：暗模块比例
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (at(i, j)) dark++;
    var ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return score;
  }

  function formatBits(data5) {
    var rem = data5 << 10;
    for (var i = 4; i >= 0; i--) if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
    return ((data5 << 10) | (rem & 0x3ff)) ^ 0x5412;
  }

  function blank(size) {
    var m = new Array(size);
    for (var i = 0; i < size; i++) m[i] = new Array(size).fill(null);
    return m;
  }

  function buildMatrix(cfg, codewords, mask) {
    var size = cfg.v * 4 + 17;
    var m = blank(size);
    var probe = function (row, col) {
      for (var r = -1; r <= 7; r++)
        for (var c = -1; c <= 7; c++) {
          var rr = row + r, cc = col + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          m[rr][cc] = !!inRing;
        }
    };
    probe(0, 0);
    probe(size - 7, 0);
    probe(0, size - 7);
    // 定位图形（校正）
    cfg.align.forEach(function (ri) {
      cfg.align.forEach(function (ci) {
        var row = ri, col = ci;
        if (m[row][col] != null) return;
        for (var r = -2; r <= 2; r++)
          for (var c = -2; c <= 2; c++)
            m[row + r][col + c] = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
      });
    });
    // 定时图形
    for (var i = 8; i < size - 8; i++) {
      if (m[i][6] == null) m[i][6] = i % 2 === 0;
      if (m[6][i] == null) m[6][i] = i % 2 === 0;
    }
    // 格式信息占位
    for (var k = 0; k < 9; k++) {
      if (m[8][k] == null) m[8][k] = false;
      if (m[k][8] == null) m[k][8] = false;
    }
    for (var q = 0; q < 8; q++) {
      if (m[8][size - 1 - q] == null) m[8][size - 1 - q] = false;
      if (m[size - 1 - q][8] == null) m[size - 1 - q][8] = false;
    }
    m[size - 8][8] = true; // 固定暗模块

    // 数据填充（右下角开始，两列一组，蛇形）
    var bits = [];
    codewords.data.forEach(function (b) { for (var t = 7; t >= 0; t--) bits.push((b >> t) & 1); });
    codewords.ecc.forEach(function (b) { for (var t = 7; t >= 0; t--) bits.push((b >> t) & 1); });
    var bi = 0, row = size - 1, inc = -1, col;
    for (col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (var c2 = 0; c2 < 2; c2++) {
          var cc2 = col - c2;
          if (m[row][cc2] == null) {
            var dark = bi < bits.length ? bits[bi] === 1 : false;
            if (mask != null && MASKS[mask](row, cc2)) dark = !dark;
            m[row][cc2] = dark;
            bi++;
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }
    // 格式信息
    var fmt = formatBits((cfg.eccBits << 3) | mask);
    for (var f = 0; f < 15; f++) {
      var bit = ((fmt >> f) & 1) === 1;
      if (f < 6) m[f][8] = bit;
      else if (f < 8) m[f + 1][8] = bit;
      else m[size - 15 + f][8] = bit;
      if (f < 8) m[8][size - f - 1] = bit;
      else if (f < 9) m[8][15 - f - 1 + 1] = bit;
      else m[8][15 - f - 1] = bit;
    }
    m[size - 8][8] = true;
    return m;
  }

  function encode(text) {
    var bytes = utf8(String(text == null ? "" : text));
    var cfg = null;
    for (var i = 0; i < CONFIG.length; i++) {
      if (bytes.length <= capOf(CONFIG[i])) { cfg = CONFIG[i]; break; }
    }
    if (!cfg) throw new Error("内容过长，超出本编码器容量（最多 " + capOf(CONFIG[CONFIG.length - 1]) + " 字节）");
    var cw = makeCodewords(bytes, cfg);
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var m = buildMatrix(cfg, cw, mask);
      var s = penalty(m);
      if (s < bestScore) { bestScore = s; best = { m: m, mask: mask }; }
    }
    return {
      matrix: best.m,
      mask: best.mask,
      version: cfg.v,
      ecc: cfg.ecc,
      size: cfg.v * 4 + 17,
      bytes: bytes.length,
      dataCodewords: cw.data,
      eccCodewords: cw.ecc,
      gen: cw.gen,
    };
  }

  function draw(text, opts) {
    opts = opts || {};
    var res = encode(text);
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var scale = opts.scale || 4;
    var px = (res.size + quiet * 2) * scale;
    var canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    canvas.className = opts.className || "qr-canvas";
    if (opts.size) { canvas.style.width = opts.size + "px"; canvas.style.height = opts.size + "px"; }
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = opts.light || "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = opts.dark || "#1c2436";
    for (var r = 0; r < res.size; r++)
      for (var c = 0; c < res.size; c++)
        if (res.matrix[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    canvas.dataset.qrText = String(text);
    return { canvas: canvas, info: res };
  }

  function mount(el, text, opts) {
    var r = draw(text, opts);
    el.innerHTML = "";
    el.appendChild(r.canvas);
    el.dataset.qrText = String(text);
    return r;
  }

  global.QR = {
    encode: encode,
    draw: draw,
    mount: mount,
    genPoly: genPoly,
    syndromesZero: syndromesZero,
    capOf: capOf,
    config: CONFIG,
    formatBits: formatBits,
  };
})(typeof window !== "undefined" ? window : globalThis);
