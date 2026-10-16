/* 数据层：localStorage 存储 + 演示数据 + 业务规则。
   真实项目里把这一层换成接口调用即可，页面逻辑不用改。 */
(function (global) {
  const KEY = "qrc.demo.v2";
  const CATS = ["VIP", "Non-VIP", "内部陪同", "未分类"];
  const COMPANIES = ["示例公司A", "示例公司B", "示例部门", "未分类"];

  const DEFAULT_CFG = {
    domain: "https://checkin.example.com",
    host: "克朗斯销售北京有限公司",
    eventName: "CBB 2026 晚宴",
    place: "上海浦东嘉里大酒店3层浦东厅",
    signRange: "13:00-14:00",
    openLeadMinutes: 120,
    smsTemplate:
      "【{主办单位}】尊敬的来宾，{活动名称}将于{活动开始时间}准时开始；地点：{活动地点}。请您于{签到时段}到场签到。签到二维码请点击链接：{个人签到链接} 期待您的莅临！",
    categories: [],   // 本活动的类别字典（导入名单时会自动补充）
    companies: [],    // 本活动的公司／部门清单（按导入名单自动生成）
    /* 账号：后台 5 个（admin01 ~ admin05）、签到台 3 个（kiosk01 ~ kiosk03），密码统一 123456 */
    password: "123456",
    accounts: [
      { user: "admin01", pass: "123456", role: "admin", no: "01", label: "管理后台 01" },
      { user: "admin02", pass: "123456", role: "admin", no: "02", label: "管理后台 02" },
      { user: "admin03", pass: "123456", role: "admin", no: "03", label: "管理后台 03" },
      { user: "admin04", pass: "123456", role: "admin", no: "04", label: "管理后台 04" },
      { user: "admin05", pass: "123456", role: "admin", no: "05", label: "管理后台 05" },
      { user: "kiosk01", pass: "123456", role: "kiosk", no: "01", label: "签到台 01" },
      { user: "kiosk02", pass: "123456", role: "kiosk", no: "02", label: "签到台 02" },
      { user: "kiosk03", pass: "123456", role: "kiosk", no: "03", label: "签到台 03" },
    ],
    qrMode: "demo", // demo=二维码指向本站页面（手机可扫）；formal=指向备案域名 /s/编码
  };

  const rid = function (n) {
    var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", t = "", i;
    for (i = 0; i < n; i++) t += s[Math.floor(Math.random() * s.length)];
    return t;
  };
  const pad = function (n, l) { return String(n).padStart(l || 2, "0"); };
  const fmtDT = function (d) {
    var x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()) + " " +
      pad(x.getHours()) + ":" + pad(x.getMinutes()) + ":" + pad(x.getSeconds());
  };
  const hhmm = function (d) {
    var x = d instanceof Date ? d : new Date(d);
    return pad(x.getHours()) + ":" + pad(x.getMinutes());
  };
  const parseWhen = function (str) {
    var m = String(str || "").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0);
  };
  const norm = function (s) { return String(s == null ? "" : s).replace(/\s/g, "").toLowerCase(); };
  const normalizePhone = function (v) { return String(v || "").replace(/[\s-]/g, ""); };
  const phoneValid = function (v) { return /^1[3-9]\d{9}$/.test(normalizePhone(v)); };

  function seedDemo() {
    var now = Date.now();
    var start = new Date(now + 3 * 3600 * 1000);
    var ev = {
      id: "EV" + rid(4),
      name: DEFAULT_CFG.eventName,
      host: DEFAULT_CFG.host,
      startAt: fmtDT(start).slice(0, 16),
      place: DEFAULT_CFG.place,
      signRange: DEFAULT_CFG.signRange,
      status: "open",
      closedAt: "",
      createdAt: fmtDT(new Date()),
    };
    var fixed = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十", "郑十一", "王十二"];
    var fam = ["陈", "刘", "杨", "黄", "许", "何", "郭", "林", "高", "罗"];
    var people = [];
    var cats = CATS;
    var total = 28;
    for (var i = 0; i < total; i++) {
      var name = i < fixed.length ? fixed[i] : fam[i % fam.length] + "示例" + (i + 1);
      var company = i % 3 === 0 ? "示例公司A" : i % 3 === 1 ? "示例公司B" : "示例部门";
      var hasPhone = i % 7 !== 0;
      people.push({
        id: "P" + rid(6),
        eventId: ev.id,
        code: rid(8),
        name: name,
        company: company,
        title: i % 4 === 0 ? "经理" : i % 4 === 1 ? "总监" : i % 4 === 2 ? "主管" : "专员",
        phone: hasPhone ? "138" + String(10000000 + i * 137).slice(0, 8) : "",
        table: i % 5 === 0 ? "" : String(1 + (i % 18)),
        category: cats[i % cats.length],
        sales: "销售" + String.fromCharCode(65 + (i % 5)),
        source: "import",
        note: "",
        createdAt: fmtDT(new Date(now - (total - i) * 60000)),
        updatedAt: "",
      });
    }
    var checkins = [];
    people.forEach(function (p, i) {
      if (i % 5 === 1 || i % 5 === 3) {
        checkins.push({
          id: "C" + rid(6),
          eventId: ev.id,
          personId: p.id,
          at: fmtDT(new Date(now - (total - i) * 45000)),
          method: i % 10 === 3 ? "manual" : "scan",
          operator: i % 10 === 3 ? "签到台账号" : "扫码枪",
          active: true,
        });
      }
    });
    return {
      cfg: Object.assign({}, DEFAULT_CFG),
      events: [ev],
      currentEventId: ev.id,
      people: people,
      checkins: checkins,
      logs: [{ at: fmtDT(new Date()), actor: "系统", type: "初始化", target: ev.name, detail: "载入演示数据" }],
      printTemplates: {},
      printLogs: [],
      session: null,
    };
  }

  var db = null;
  var subs = [];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        db = JSON.parse(raw);
        if (!db.cfg) db.cfg = Object.assign({}, DEFAULT_CFG);
        return;
      }
    } catch (e) {}
    db = seedDemo();
    persist(false);
  }
  function persist(emit) {
    localStorage.setItem(KEY, JSON.stringify(db));
    if (emit !== false) notify();
    pushServer();
  }
  function notify() {
    subs.forEach(function (f) { try { f(); } catch (e) {} });
  }
  function subscribe(fn) {
    subs.push(fn);
    return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
  }
  global.addEventListener("storage", function (e) {
    if (e.key === KEY) { load(); notify(); }
  });

  /* ---------- 与本地服务器共享同一份数据（手机 ↔ 电脑） ----------
     只有在通过「启动服务器.cmd」(http://) 打开时才生效；
     用 file:// 直接打开时保持纯本地存储（各浏览器各自一份，互不可见）。 */
  var SRV = null;          // { base, version }
  var pushTimer = null;
  function srvBase() {
    try {
      if (location.protocol !== "http:" && location.protocol !== "https:") return null;
      return location.pathname.replace(/[^\/]*$/, "");
    } catch (e) { return null; }
  }
  function pushServer() {
    if (!SRV) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var payload = JSON.stringify(db);
      fetch(SRV.base + "api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) { if (res && res.version) SRV.version = res.version; })
        .catch(function () {});
    }, 150);
  }
  function applyRemote(remote) {
    if (!remote || !validDb(remote.db)) return;
    var session = db.session;            // 登录状态各设备各自保留
    db = remote.db;
    db.session = session;
    if (!db.cfg) db.cfg = Object.assign({}, DEFAULT_CFG);
    localStorage.setItem(KEY, JSON.stringify(db));
    notify();
  }
  function validDb(d) {
    return !!d && typeof d === "object" && Array.isArray(d.events) && Array.isArray(d.people) && Array.isArray(d.checkins);
  }
  function initServerSync() {
    if (!global.__HAS_API) return;      // 静态托管（GitHub Pages 等）没有共享接口，直接走本地存储
    var base = srvBase();
    if (!base) return;
    fetch(base + "api/load", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || typeof res.version === "undefined") return;   // 服务器没有共享接口 → 保持本地存储
        SRV = { base: base, version: res.version || 0 };
        if (validDb(res.db)) applyRemote(res);
        else pushServer();                                        // 服务器还是空的：把本机数据推上去当基线
        setInterval(function () {
          if (!SRV) return;
          fetch(SRV.base + "api/version", { cache: "no-store" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (v) {
              if (!v || v.version === SRV.version) return;
              SRV.version = v.version;
              return fetch(SRV.base + "api/load", { cache: "no-store" })
                .then(function (r) { return r.json(); })
                .then(applyRemote);
            })
            .catch(function () {});
        }, 2500);
      })
      .catch(function () {});
  }

  function ev() { return db.events.filter(function (x) { return x.id === db.currentEventId; })[0] || db.events[0]; }
  function people(eventId) {
    var id = eventId || db.currentEventId;
    return db.people.filter(function (p) { return p.eventId === id; });
  }
  function checkins(eventId) {
    var id = eventId || db.currentEventId;
    return db.checkins.filter(function (c) { return c.eventId === id && c.active; });
  }
  function findById(id) { return db.people.filter(function (p) { return p.id === id; })[0]; }
  function findCheckin(personId) {
    return db.checkins.filter(function (c) { return c.personId === personId && c.active; })[0] || null;
  }
  function isChecked(personId) { return !!findCheckin(personId); }
  function findByCode(code) {
    if (!code) return null;
    var c = String(code).trim();
    var m = c.match(/[A-Za-z0-9]{6,12}$/);
    var key = (m ? m[0] : c).toUpperCase();
    var hit = people().filter(function (p) { return p.code === key; })[0];
    if (hit) return hit;
    // 本场找不到时，跨活动再找一次（手机端链接、扫码都用得上）
    return db.people.filter(function (p) { return p.code === key; })[0] || null;
  }
  /* 在所有活动里搜（参会人手机端用：他们不知道自己在哪一场） */
  function searchAll(q) {
    var out = [];
    db.events.forEach(function (e) {
      search(q, e.id).forEach(function (p) { out.push({ person: p, eventId: e.id }); });
    });
    return out;
  }
  /* 单个关键词匹配：姓名 / 手机号（后四位）/ 桌号 / 编码 / 公司部门（另外兼容类别、销售） */
  function matchOne(p, t) {
    if (!t) return true;
    var phone = String(p.phone || "").replace(/\s/g, "");
    if (/^\d{4}$/.test(t)) {
      if (phone.slice(-4) === t) return true;            // 手机号后四位：精确匹配末尾四位
    } else if (/^\d{5,}$/.test(t)) {
      if (phone.indexOf(t) >= 0) return true;            // 完整或部分手机号
    }
    if (norm(p.name).indexOf(t) >= 0) return true;       // 姓名：包含
    if (norm(p.company).indexOf(t) >= 0) return true;    // 公司 / 部门：包含
    if (norm(p.table) && norm(p.table) === t) return true; // 桌号：精确
    if ((p.code || "").toLowerCase().indexOf(t) === 0) return true; // 编码：从头匹配
    if (norm(p.category).indexOf(t) >= 0) return true;
    if (norm(p.sales).indexOf(t) >= 0) return true;
    return false;
  }
  function search(q, eventId) {
    var tokens = String(q == null ? "" : q).trim().split(/\s+/).map(norm).filter(Boolean);
    if (!tokens.length) return [];
    return people(eventId).filter(function (p) {
      return tokens.every(function (t) { return matchOne(p, t); });   // 多个关键词用空格分隔，需同时满足
    });
  }
  /* 本活动实际用到的类别 / 公司部门：以导入名单为准，导入后自动出现在下拉里 */
  function accounts() {
    if (!db.cfg.accounts || !db.cfg.accounts.length)
      db.cfg.accounts = JSON.parse(JSON.stringify(DEFAULT_CFG.accounts));
    return db.cfg.accounts;
  }
  function findAccount(user, pass) {
    user = String(user || "").trim();
    var list = accounts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].user === user && list[i].pass === pass) return list[i];
    }
    // 兼容早期版本的两个账号 admin / kiosk
    var legacyPass = db.cfg.password || "123456";
    if (user === "admin" && pass === legacyPass) return { user: "admin", role: "admin", no: "01", label: "管理后台 01" };
    if (user === "kiosk" && pass === legacyPass) return { user: "kiosk", role: "kiosk", no: "01", label: "签到台 01" };
    return null;
  }
  function setAccountPassword(user, pass) {
    var list = accounts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].user === user) {
        list[i].pass = pass;
        log("修改账号密码", user, "");
        persist();
        return true;
      }
    }
    return false;
  }

  function categories(eventId) {
    var set = {};
    (db.cfg.categories || []).forEach(function (x) { if (x) set[x] = 1; });
    people(eventId).forEach(function (p) { if (p.category) set[p.category] = 1; });
    return Object.keys(set).sort(function (a, b) {
      if (a === "未分类") return 1;
      if (b === "未分类") return -1;
      return a.localeCompare(b, "zh");
    });
  }
  function companies(eventId) {
    var set = {};
    (db.cfg.companies || []).forEach(function (x) { if (x) set[x] = 1; });
    people(eventId).forEach(function (p) { if (p.company) set[p.company] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, "zh"); });
  }
  function addCategory(name) {
    name = String(name || "").trim();
    if (!name) return false;
    db.cfg.categories = db.cfg.categories || [];
    if (db.cfg.categories.indexOf(name) < 0) db.cfg.categories.push(name);
    persist();
    return true;
  }
  function addCompany(name) {
    name = String(name || "").trim();
    if (!name) return false;
    db.cfg.companies = db.cfg.companies || [];
    if (db.cfg.companies.indexOf(name) < 0) db.cfg.companies.push(name);
    persist();
    return true;
  }

  function status(eventId) {
    var e = eventId ? db.events.filter(function (x) { return x.id === eventId; })[0] || ev() : ev();
    if (e.status === "closed") return { state: "closed", text: "签到已结束" };
    var start = parseWhen(e.startAt);
    if (!start) return { state: "open", text: "签到进行中" };
    var openAt = new Date(start.getTime() - (db.cfg.openLeadMinutes || 120) * 60000);
    if (Date.now() < openAt.getTime())
      return { state: "wait", text: "签到未开放（" + fmtDT(openAt).slice(5, 16) + " 开放）", openAt: openAt };
    return { state: "open", text: "签到进行中", openAt: openAt };
  }

  function log(type, target, detail, actor) {
    db.logs.unshift({
      at: fmtDT(new Date()),
      actor: actor || (db.session && db.session.name) || "签到台",
      type: type,
      target: target || "",
      detail: detail || "",
    });
    if (db.logs.length > 300) db.logs.length = 300;
  }

  function addPerson(data, opts) {
    opts = opts || {};
    var eventId = opts.eventId || db.currentEventId;
    var name = String(data.name || "").trim();
    var company = String(data.company || "").trim();
    var dup = db.people.filter(function (p) {
      return p.eventId === eventId && p.name === name && p.company === company;
    })[0];
    if (dup) {
      var patch = {};
      ["phone", "title", "table", "category", "sales", "note"].forEach(function (k) {
        if (data[k] && data[k] !== dup[k]) patch[k] = data[k];
      });
      if (Object.keys(patch).length) {
        patch.updatedAt = fmtDT(new Date());
        Object.assign(dup, patch);
        log("更新资料", name, "重复提交，已合并：" + Object.keys(patch).join("、"));
        persist();
        return { status: "merged", person: dup };
      }
      return { status: "dup", person: dup };
    }
    var p = {
      id: "P" + rid(6),
      eventId: eventId,
      code: rid(8),
      name: name,
      company: company,
      title: String(data.title || "").trim(),
      phone: normalizePhone(data.phone),
      table: String(data.table || "").trim(),
      category: String(data.category || "").trim() || "未分类",
      sales: String(data.sales || "").trim(),
      note: String(data.note || "").trim(),
      source: opts.source || "onsite",
      createdAt: fmtDT(new Date()),
      updatedAt: "",
    };
    db.people.push(p);
    log(opts.source === "import" ? "名单导入" : "现场注册", p.name,
      (opts.source === "import" ? "导入建档" : "现场注册建档") + "，编码 " + p.code);
    persist();
    return { status: "added", person: p };
  }

  function updatePerson(id, patch) {
    var p = findById(id);
    if (!p) return null;
    Object.assign(p, patch, { updatedAt: fmtDT(new Date()) });
    log("修改人员", p.name, Object.keys(patch).join("、"));
    persist();
    return p;
  }

  function checkin(personId, method, operator) {
    var p = findById(personId);
    if (!p) return { status: "notfound" };
    var exist = findCheckin(personId);
    if (exist) return { status: "already", person: p, at: exist.at };
    var rec = {
      id: "C" + rid(6),
      eventId: p.eventId,
      personId: personId,
      at: fmtDT(new Date()),
      method: method || "scan",
      operator: operator || (method === "manual" ? "签到台账号" : "扫码枪"),
      active: true,
    };
    db.checkins.push(rec);
    log("签到", p.name, method === "manual" ? "工作人员代签" : "扫码签到");
    persist();
    return { status: "ok", person: p, at: rec.at };
  }

  function undoCheckin(personId, reason) {
    var c = findCheckin(personId);
    if (!c) return false;
    c.active = false;
    c.reason = reason || "";
    var p = findById(personId);
    log("撤销签到", p ? p.name : personId, reason || "未填写原因");
    persist();
    return true;
  }

  function stats(eventId) {
    var ps = people(eventId);
    var cs = checkins(eventId);
    var inList = ps.filter(function (p) { return p.source === "import"; });
    var onsite = ps.filter(function (p) { return p.source === "onsite"; });
    var arrived = function (arr) { return arr.filter(function (p) { return isChecked(p.id); }).length; };
    var manual = cs.filter(function (c) { return c.method === "manual"; }).length;
    var scan = cs.filter(function (c) { return c.method !== "manual"; }).length;
    var o = {
      应到: ps.length,
      实到: arrived(inList),
      现场注册: onsite.length,
      现场注册已签到: arrived(onsite),
      手动签到: manual,
      扫码签到: scan,
      待补充桌号: onsite.filter(function (p) { return !p.table; }).length,
      无手机号: ps.filter(function (p) { return !phoneValid(p.phone); }).length,
    };
    o.未到 = o.应到 - o.实到;
    o.合计到场 = o.实到 + o.现场注册已签到;
    return o;
  }

  function statsByCategory(eventId) {
    var out = {};
    categories(eventId).forEach(function (c) { out[c] = { 应到: 0, 实到: 0, 未到: 0, 现场注册: 0 }; });
    people(eventId).forEach(function (p) {
      var key = p.category || "未分类";
      if (!out[key]) out[key] = { 应到: 0, 实到: 0, 未到: 0, 现场注册: 0 };
      var b = out[key];
      b.应到++;
      if (p.source === "onsite") b.现场注册++;
      else if (isChecked(p.id)) b.实到++;
      else b.未到++;
    });
    return out;
  }

  function statsByCompany(eventId) {
    var out = {};
    people(eventId).forEach(function (p) {
      var k = p.company || "未填写";
      out[k] = out[k] || { 应到: 0, 实到: 0, 未到: 0, 现场注册: 0 };
      out[k].应到++;
      if (p.source === "onsite") out[k].现场注册++;
      else if (isChecked(p.id)) out[k].实到++;
      else out[k].未到++;
    });
    return out;
  }

  var HEADER_MAP = {
    "酒店桌号": "table", "图示酒店桌号": "table", "桌号": "table",
    "类别": "category", "姓名": "name",
    "公司/部门": "company", "公司": "company", "部门": "company",
    "职务": "title", "职位": "title",
    "电话": "phone", "手机号": "phone",
    "负责销售": "sales", "备注": "note",
  };

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    var t = String(text).replace(/\r\n?/g, "\n");
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) {
        if (ch === '"') {
          if (t[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows
      .map(function (r) { return r.map(function (c) { return String(c).trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c !== ""; }); });
  }

  function analyzeImport(text, eventId) {
    var rows = parseCSV(text);
    var headerIdx = -1, cols = {};
    for (var i = 0; i < Math.min(rows.length, 12); i++) {
      var hit = {}, n = 0;
      rows[i].forEach(function (cell, ci) {
        var key = HEADER_MAP[String(cell).replace(/\s/g, "")];
        if (key) { hit[key] = ci; n++; }
      });
      if (hit.name != null && hit.company != null && n >= 3) { headerIdx = i; cols = hit; break; }
    }
    if (headerIdx < 0) return { ok: false, reason: "找不到表头行（需要同时包含“姓名”和“公司/部门”列）" };
    var dataRows = rows.slice(headerIdx + 1);
    var seen = {}, item, items = [], issues = [], add = 0, upd = 0, dedup = 0;
    var existing = people(eventId);
    var est = null;
    for (var k = 0; k < headerIdx; k++) {
      var m = rows[k].join(",").match(/(\d{2,4})\s*(席|人|位)/);
      if (m) { est = +m[1]; break; }
    }
    var get = function (r, key) { return cols[key] != null ? String(r[cols[key]] || "").trim() : ""; };
    dataRows.forEach(function (r, idx) {
      item = {
        table: get(r, "table"), category: get(r, "category"), name: get(r, "name"),
        company: get(r, "company"), title: get(r, "title"), phone: get(r, "phone"),
        sales: get(r, "sales"), note: get(r, "note"),
      };
      var lineNo = headerIdx + 2 + idx;
      var probs = [];
      if (!item.name) probs.push({ kind: "姓名", level: "错误", text: "姓名为空，已跳过" });
      if (!item.company) probs.push({ kind: "公司/部门", level: "错误", text: "公司／部门为空，已跳过" });
      var key = norm(item.name + "|" + item.company);
      if (item.name && item.company && seen[key]) {
        dedup++;
        probs.push({ kind: "重复记录", level: "提醒", text: "同名同公司重复出现，已去掉重复行" });
      }
      if (item.name && item.company) seen[key] = 1;
      if (item.phone && !phoneValid(item.phone))
        probs.push({ kind: "电话", level: "提醒", text: "号码格式待确认，不参与短信发送" });
      if (item.category && CATS.indexOf(item.category) < 0)
        probs.push({ kind: "类别", level: "通过", text: "本活动的新类别，导入后自动加入类别下拉" });
      if (!item.table) probs.push({ kind: "桌号", level: "通过", text: "桌号为空，允许，后续导入可补全" });
      var hitp = existing.filter(function (p) { return p.name === item.name && p.company === item.company; })[0];
      var hasErr = probs.some(function (x) { return x.level === "错误"; });
      if (hitp) {
        upd++;
        probs.push({ kind: "合并更新", level: "通过", text: "唯一标识已存在，将更新原记录" });
      } else if (!hasErr) add++;
      if (probs.length) issues.push({ lineNo: lineNo, name: item.name || "（空）", probs: probs });
      if (!hasErr) items.push(item);
    });
    return {
      ok: true, headerIdx: headerIdx, total: dataRows.length,
      counts: { add: add, upd: upd, dedup: dedup, est: est, rows: dataRows.length },
      issues: issues, items: items,
    };
  }

  function applyImport(items, eventId) {
    var eid = eventId || db.currentEventId, added = 0, updated = 0;
    items.forEach(function (it) {
      var dup = db.people.filter(function (p) {
        return p.eventId === eid && p.name === it.name && p.company === it.company;
      })[0];
      var fields = {};
      ["table", "title", "category", "sales", "note"].forEach(function (k) {
        if (it[k] !== "") fields[k] = it[k];
      });
      if (it.phone) fields.phone = normalizePhone(it.phone);
      if (fields.category === "") delete fields.category;
      if (dup) {
        Object.assign(dup, fields, { updatedAt: fmtDT(new Date()) });
        updated++;
      } else {
        db.people.push({
          id: "P" + rid(6), eventId: eid, code: rid(8),
          name: it.name, company: it.company, title: it.title || "",
          phone: normalizePhone(it.phone), table: it.table || "",
          category: it.category || "未分类",
          sales: it.sales || "", note: it.note || "",
          source: "import", createdAt: fmtDT(new Date()), updatedAt: "",
        });
        added++;
      }
    });
    log("名单导入", ev().name, "新增 " + added + " 条，更新 " + updated + " 条");
    persist();
    return { added: added, updated: updated };
  }

  function smsFor(p, cfg) {
    var c = cfg || db.cfg;
    var link = personLink(p);
    var map = {
      "{主办单位}": ev().host,
      "{活动名称}": ev().name,
      "{活动开始时间}": ev().startAt,
      "{活动地点}": ev().place,
      "{签到时段}": ev().signRange,
      "{个人签到链接}": link,
      "{姓名}": p.name,
      "{桌号}": p.table || "",
    };
    var text = c.smsTemplate, missing = [];
    Object.keys(map).forEach(function (k) {
      if (map[k] === "") missing.push(k);
      text = text.split(k).join(map[k]);
    });
    return { text: text, link: link, missing: missing };
  }

  function smsList(eventId) {
    return people(eventId).map(function (p) {
      var r = smsFor(p);
      return {
        person: p, text: r.text, link: r.link, missing: r.missing,
        skipped: !phoneValid(p.phone),
      };
    });
  }

  function toCSV(rows) {
    return rows
      .map(function (r) {
        return r.map(function (c) {
          var s = String(c == null ? "" : c);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(",");
      }).join("\r\n");
  }

  var PERSON_HEADER = ["姓名","公司/部门","职务","电话","桌号","类别","负责销售","来源","签到状态","签到时间","签到方式"];

  function personRow(p) {
    var c = findCheckin(p.id);
    return [
      p.name, p.company, p.title, p.phone, p.table, p.category, p.sales,
      p.source === "onsite" ? "现场注册" : "名单导入",
      c ? "已签到" : "未签到",
      c ? c.at : "",
      c ? (c.method === "manual" ? "工作人员代签" : "扫码签到") : "",
    ];
  }

  function exportTwoSheets(eventId) {
    var ps = people(eventId);
    var signed = ps.filter(function (p) { return isChecked(p.id); });
    var unsigned = ps.filter(function (p) { return !isChecked(p.id); });
    return {
      已签到: toCSV([PERSON_HEADER].concat(signed.map(personRow))),
      未签到: toCSV([PERSON_HEADER].concat(unsigned.map(personRow))),
      counts: { signed: signed.length, unsigned: unsigned.length },
    };
  }

  function setEvent(id) {
    if (db.events.some(function (e) { return e.id === id; })) {
      db.currentEventId = id;
      persist();
    }
  }
  function createEvent(data) {
    var e = {
      id: "EV" + rid(4),
      name: data.name || "未命名活动",
      host: data.host || db.cfg.host,
      startAt: data.startAt || "",
      place: data.place || "",
      signRange: data.signRange || "",
      status: "open",
      closedAt: "",
      createdAt: fmtDT(new Date()),
    };
    db.events.push(e);
    db.currentEventId = e.id;
    log("新建活动", e.name, "开始时间 " + e.startAt);
    persist();
    return e;
  }
  function closeEvent(id) {
    var e = db.events.filter(function (x) { return x.id === (id || db.currentEventId); })[0] || ev();
    e.status = "closed";
    e.closedAt = fmtDT(new Date());
    log("结束签到", e.name, "写入签到结束时间 " + e.closedAt);
    persist();
    return e;
  }
  function login(user, pass, role) {
    var acc = findAccount(user, pass);
    if (!acc) return null;
    db.session = {
      name: acc.user,
      role: acc.role,
      no: acc.no || "",
      label: acc.label || acc.user,
      at: fmtDT(new Date()),
    };
    log("登录", acc.user, acc.role === "kiosk" ? "签到台登录" : "后台登录", acc.user);
    persist();
    return db.session;
  }
  /* 二维码/短信链接的域名：演示模式指向本站页面（手机同 WiFi 可扫），正式模式指向备案域名 */
  function linkBase() {
    var c = db.cfg;
    if (c.qrMode !== "formal") {
      try {
        if (location.protocol === "http:" || location.protocol === "https:") {
          var dir = location.pathname.replace(/[^\/]*$/, "");
          var host = location.host;
          // 用 localhost 打开时，手机访问 localhost 指的是手机自己 —— 换成局域网 IP
          if ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && global.__LAN_IP)
            host = global.__LAN_IP + (location.port ? ":" + location.port : "");
          return location.protocol + "//" + host + dir.replace(/\/$/, "");
        }
      } catch (e) {}
    }
    return c.domain;
  }
  function personLink(p) {
    var c = db.cfg;
    return linkBase() + (c.qrMode === "formal" ? "/s/" + p.code : "/mobile-pass.html?c=" + p.code);
  }
  function registerLink() {
    var c = db.cfg;
    return linkBase() + (c.qrMode === "formal" ? "/form?id=2&e=" + ev().id : "/mobile-register.html");
  }
  function linkModeInfo() {
    var c = db.cfg;
    var demo = c.qrMode !== "formal";
    var viaHttp = false;
    try { viaHttp = location.protocol === "http:" || location.protocol === "https:"; } catch (e) {}
    var scannable = demo ? viaHttp : true;
    var base = linkBase();
    var isLocalName = false;
    try { isLocalName = location.hostname === "localhost" || location.hostname === "127.0.0.1"; } catch (e) {}
    var localOnly = isLocalName && !global.__LAN_IP;
    return {
      demo: demo,
      base: base,
      scannable: scannable,
      text: demo
        ? (scannable
            ? (localOnly
                ? "演示模式：现在是用 localhost 打开的，二维码里会是 localhost（手机上指的是手机自己，打不开）。请改用「手机打开」那一行的局域网地址再打开本站。"
                : "演示模式：二维码指向本站页面，手机连同一 WiFi 可以直接扫开（当前地址 " + base + "）")
            : "演示模式：现在是本地文件打开，二维码里的地址手机扫不开；请先双击「启动服务器.cmd」，再用它给出的局域网地址打开网站")
        : "正式模式：二维码指向你配置的域名 /s/编码",
    };
  }

  function setCfg(patch) {
    Object.assign(db.cfg, patch);
    log("修改配置", "系统配置", Object.keys(patch).join("、"));
    persist();
  }

  /* ---------- 打印模板（按活动保存）与打印记录 ---------- */
  var DEFAULT_TEMPLATE = {
    size: "70x30",
    gap: "tight",
    showLabel: false,
    qr: true,
    rows: [
      { field: "name", title: "姓名", size: "lg", bold: true, align: "center" },
      { field: "title", title: "职务", size: "md", bold: false, align: "center" },
      { field: "company", title: "公司/部门", size: "md", bold: false, align: "center" },
      { field: "table", title: "桌号", size: "sm", bold: false, align: "center" },
    ],
  };
  var SIZES = {
    "70x30": { w: 70, h: 30, name: "70 × 30 mm" },
    "60x40": { w: 60, h: 40, name: "60 × 40 mm" },
    "50x30": { w: 50, h: 30, name: "50 × 30 mm" },
    "40x25": { w: 40, h: 25, name: "40 × 25 mm" },
  };
  function template(eventId) {
    var id = eventId || db.currentEventId;
    if (!db.printTemplates[id]) return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
    return JSON.parse(JSON.stringify(db.printTemplates[id]));
  }
  function setTemplate(t, eventId) {
    var id = eventId || db.currentEventId;
    db.printTemplates[id] = JSON.parse(JSON.stringify(t));
    log("打印模板", ev().name, "更新标签格式：" + (SIZES[t.size] ? SIZES[t.size].name : t.size) + " / " + t.rows.length + " 行");
    persist();
    return db.printTemplates[id];
  }
  function printLog(personId, extra) {
    var p = findById(personId);
    var rec = {
      at: fmtDT(new Date()),
      personId: personId,
      name: p ? p.name : "",
      company: p ? p.company : "",
      table: p ? p.table : "",
      copies: 1,
      by: (db.session && db.session.name) || "签到台",
      note: extra || "",
    };
    db.printLogs.unshift(rec);
    if (db.printLogs.length > 500) db.printLogs.length = 500;
    log("打印标签", rec.name, "1 张" + (extra ? "（" + extra + "）" : ""));
    persist();
    return rec;
  }

  global.Store = {
    init: function () { load(); initServerSync(); return this; },
    CATS: CATS,
    COMPANIES: COMPANIES,
    reset: function () { db = seedDemo(); persist(); },
    get: function () { return db; },
    subscribe: subscribe,
    persist: persist,
    ev: ev,
    events: function () { return db.events; },
    event: ev,
    people: people,
    checkins: checkins,
    findById: findById,
    findCheckin: findCheckin,
    isChecked: isChecked,
    findByCode: findByCode,
    searchAll: searchAll,
    search: search,
    phoneValid: phoneValid,
    normalizePhone: normalizePhone,
    status: status,
    stats: stats,
    statsByCategory: statsByCategory,
    statsByCompany: statsByCompany,
    cfg: function () { return db.cfg; },
    logs: function () { return db.logs; },
    addPerson: addPerson,
    updatePerson: updatePerson,
    checkin: checkin,
    undoCheckin: undoCheckin,
    setEvent: setEvent,
    createEvent: createEvent,
    closeEvent: closeEvent,
    login: login,
    logout: function () { db.session = null; persist(); },
    session: function () { return db.session; },
    setCfg: setCfg,
    log: log,
    linkBase: linkBase,
    personLink: personLink,
    registerLink: registerLink,
    linkModeInfo: linkModeInfo,
    SIZES: SIZES,
    DEFAULT_TEMPLATE: DEFAULT_TEMPLATE,
    template: template,
    setTemplate: setTemplate,
    printLog: printLog,
    printLogs: function () { return db.printLogs; },
    parseCSV: parseCSV,
    analyzeImport: analyzeImport,
    applyImport: applyImport,
    smsFor: smsFor,
    smsList: smsList,
    categories: categories,
    companies: companies,
    addCategory: addCategory,
    addCompany: addCompany,
    accounts: accounts,
    defaultAccounts: function () { return JSON.parse(JSON.stringify(DEFAULT_CFG.accounts)); },
    findAccount: findAccount,
    setAccountPassword: setAccountPassword,
    toCSV: toCSV,
    personRow: personRow,
    PERSON_HEADER: PERSON_HEADER,
    exportTwoSheets: exportTwoSheets,
    rid: rid,
    fmtDT: fmtDT,
    hhmm: hhmm,
  };
})(window);
