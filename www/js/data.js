/* 快乐密码 · 数据层
 * 用户数据（投注、生日、设置）存在手机里（Capacitor Preferences）；开奖数据缓存在本地，按需从中国福彩网、中国体彩网官网接口获取。
 */
(function () {
'use strict';
const LT = window.LT;
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
function plugin(name) {
  if (!Cap) return null;
  try { if (Cap.Plugins && Cap.Plugins[name]) return Cap.Plugins[name]; if (Cap.registerPlugin) return Cap.registerPlugin(name); } catch (e) {}
  return null;
}

/* ---------- 存储 ---------- */
const Store = {
  async get(key, def) {
    try {
      if (isNative) { const r = await plugin('Preferences').get({ key }); return r && r.value != null ? JSON.parse(r.value) : def; }
      const v = localStorage.getItem('hb:' + key); return v == null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  async set(key, val) {
    try { const s = JSON.stringify(val);
      if (isNative) await plugin('Preferences').set({ key, value: s }); else localStorage.setItem('hb:' + key, s);
    } catch (e) {}
  }
};
// 开奖缓存可以随时重新获取，放在 WebView 本地存储里
const Cache = {
  get(key, def) { try { const v = localStorage.getItem('hbc:' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem('hbc:' + key, JSON.stringify(val)); } catch (e) {} }
};

/* ---------- 网络 ---------- */
const { H_CWL, H_TC, H_CDN, cwlUrl, tcUrl, CDN, numOf, parseCwl, parseTc, cwlList, tcList, cdnList } = window.PARSE;
const lastRaw = {};
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('连接超时')), ms))]); }
async function httpJson(url, headers, tag) {
  if (window.__MOCK__) return window.__MOCK__(url);
  const t0 = Date.now();
  try {
    const res = await withTimeout(fetch(url, { headers }), 20000);
    const text = await res.text();
    if (tag) lastRaw[tag] = { url, status: res.status, text: text.slice(0, 600), at: Date.now(), ms: Date.now() - t0 };
    if (!res.ok) throw new Error('服务器返回 ' + res.status);
    try { return JSON.parse(text); } catch (e) { throw new Error('返回的不是开奖数据'); }
  } catch (e) {
    // 超时、断网也记下来，数据诊断里能看到
    if (tag && !(lastRaw[tag] && lastRaw[tag].at >= t0)) lastRaw[tag] = { url, status: '失败', text: String(e.message || e), at: Date.now(), ms: Date.now() - t0 };
    throw e;
  }
}

/* ---------- 内置历史（双色球 2003 年起，大乐透 2007 年起） ---------- */
function fromRow(g, r) {
  const G = LT.GAMES[g]; const a = 2 + G.main.n, b = a + G.sub.n;
  const [pool, sales, p1c, p1m, p2c, p2m] = r.slice(b);
  const grades = (p1c != null || p2c != null) ? [{ name: '一等奖', count: p1c, amount: p1m }, { name: '二等奖', count: p2c, amount: p2m }] : null;
  return { code: r[0], date: r[1], n: r.slice(2, a), s: r.slice(a, b), pool: pool == null ? null : pool, sales: sales == null ? null : sales, grades, partial: !!grades, region: '' };
}

const Data = {
  draws: {}, meta: {}, busy: {}, filling: null,
  async init() {
    LT.ORDER.forEach(g => { this.draws[g] = []; });
    await Promise.all(['ssq', 'dlt'].map(async g => {
      try { const r = await fetch('data/' + g + '.json'); const j = await r.json(); this.draws[g] = j.rows.map(x => fromRow(g, x)); } catch (e) {}
    }));
    LT.ORDER.forEach(g => this.merge(g, Cache.get('draws:' + g, [])));
    this.meta = Cache.get('meta', {});
  },
  merge(g, list) {
    if (!list || !list.length) return 0;
    const m = new Map(this.draws[g].map(d => [d.code, d])); let added = 0;
    list.forEach(d => { const old = m.get(d.code);
      if (!old) { m.set(d.code, d); added++; return; }
      m.set(d.code, Object.assign({}, old, d, {
        grades: d.grades && (!old.grades || old.partial || d.grades.length >= old.grades.length) ? d.grades : old.grades,
        partial: d.grades ? false : old.partial,
        pool: d.pool != null ? d.pool : old.pool, sales: d.sales != null ? d.sales : old.sales, region: d.region || old.region, date: d.date || old.date })); });
    this.draws[g] = [...m.values()].sort((a, b) => a.code < b.code ? -1 : 1);
    return added;
  },
  saveCache(g) {
    const arr = this.draws[g].slice(-420);
    const keep = arr.map((d, i) => (i < arr.length - 90 && !d.partial) ? Object.assign({}, d, { grades: null }) : d);
    Cache.set('draws:' + g, keep);
  },
  latest(g) { const a = this.draws[g]; return a && a.length ? a[a.length - 1] : null; },
  find(g, code) { return (this.draws[g] || []).find(d => d.code === code) || null; },
  next(g) { return this.draws[g].length ? LT.nextIssue(g, this.draws[g], new Date()) : null; },
  needsUpdate(g) { const last = this.latest(g); if (!last) return true; const due = LT.lastDueDate(g, new Date()); return !!due && last.date < due; },
  async refresh(g, opt) {
    opt = opt || {}; const G = LT.GAMES[g];
    if (this.busy[g]) return this.busy[g];
    const job = (async () => {
      // 平时只取最近 30 期，很快；opt.full 才往前补一两年历史（走势、冷热号要用）
      const full = !!opt.full;
      let list = [], src = '官网', err = null;
      try {
        if (G.src.type === 'cwl') {
          if (full) {
            const y = LT.bjNow().getUTCFullYear();
            for (const yy of [y, y - 1]) {
              const j = await httpJson(cwlUrl(G.src.name, { dayStart: yy + '-01-01', dayEnd: yy + '-12-31', pageSize: 400 }), H_CWL, g);
              list = list.concat(cwlList(g, j)); if (list.length >= 300) break;
            }
          } else list = cwlList(g, await httpJson(cwlUrl(G.src.name, { pageSize: 30 }), H_CWL, g));
        } else {
          const pages = full ? 4 : 1, size = full ? 100 : 30;
          for (let p = 1; p <= pages; p++) { const l = tcList(g, await httpJson(tcUrl(G.src.no, p, size), H_TC, g)); list = list.concat(l); if (l.length < size) break; }
        }
        if (!list.length) throw new Error('官网没有返回开奖号码');
      } catch (e) { err = e; }
      if (err && CDN[g]) { try { list = cdnList(g, await httpJson(CDN[g], H_CDN, g + '-cdn')); src = '备用源'; err = list.length ? null : err; } catch (e2) {} }
      if (err) { this.meta[g] = Object.assign({}, this.meta[g], { ok: false, at: Date.now(), msg: String(err.message || err) }); Cache.set('meta', this.meta); return { ok: false, added: 0, msg: this.meta[g].msg }; }
      const added = this.merge(g, list); this.saveCache(g);
      const old = this.meta[g] || {};
      this.meta[g] = { ok: true, at: Date.now(), src, got: list.length, msg: '', filledAt: full ? Date.now() : old.filledAt }; Cache.set('meta', this.meta);
      return { ok: true, added };
    })();
    this.busy[g] = job; try { return await job; } finally { delete this.busy[g]; }
  },
  // 福彩、体彩分两组并行，每组内依次请求，避免短时间请求过多；每取完一个彩种就回调一次，首页逐个显示
  async runGroups(list, fn) {
    const cw = list.filter(g => LT.GAMES[g].src.type === 'cwl'), tc = list.filter(g => LT.GAMES[g].src.type === 'tc');
    const run = async (l) => { for (const g of l) { try { await fn(g); } catch (e) {} } };
    await Promise.all([run(cw), run(tc)]);
  },
  async refreshDue(force, onEach) {
    const todo = LT.ORDER.filter(g => { const m = this.meta[g]; return force || this.needsUpdate(g) || !m || (!m.ok && Date.now() - m.at > 10 * 60e3); });
    const out = {};
    await this.runGroups(todo, async g => { out[g] = await this.refresh(g); if (onEach) onEach(g); });
    this.fillHistory(onEach);
    return out;
  },
  // 历史不够 60 期的彩种，在后台慢慢补齐，不挡首页
  fillHistory(onEach) {
    if (this.filling) return this.filling;
    const thin = LT.ORDER.filter(g => { const m = this.meta[g] || {}; return m.ok && this.draws[g].length < 60 && !(m.filledAt && Date.now() - m.filledAt < 12 * 3600e3); });
    if (!thin.length) return null;
    this.filling = this.runGroups(thin, async g => { await this.refresh(g, { full: true }); if (onEach) onEach(g); }).finally(() => { this.filling = null; });
    return this.filling;
  },
  async refreshAll(onEach) { await this.runGroups(LT.ORDER, async g => { await this.refresh(g, { full: true }); if (onEach) onEach(g); }); },
  lastRaw
};

window.HB = Object.assign(window.HB || {}, { Store, Cache, Data, plugin, isNative, numOf, parseCwl, parseTc });
})();
