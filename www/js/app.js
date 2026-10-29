/* 红蓝 · 主程序：状态、导航、开奖、详情、我的、设置、提醒 */
(function () {
'use strict';
const LT = window.LT, U = window.U, HB = window.HB;
const { Store, Data, plugin, isNative } = HB;
const { $, esc, I, mdw, md, money } = U;
const RUNNER = 'com.cjh.hongbo.check';

const S = window.S = {
  tab: 'home', sub: null, ready: false, refreshing: false,
  settings: { theme: 'auto', subs: { ssq: true, dlt: true }, winAlert: true, notifAsked: false },
  tickets: [], profile: { birthdays: [] }, ack: {},
  pform: { name: '', date: '', hour: '' },
  pick: { game: 'ssq', method: 'random', count: 5, avoid: true, k: 5, play: 'zx', add: false, win: 50, lock: {}, lockOpen: false, results: null, zodiac: null, selP: [], wxP: null, words: '' },
  trend: { game: 'ssq', mode: 'grid', win: 50, pos: 0 },
  check: { game: 'ssq', scan: { st: 'idle' }, man: null },
  mine: { seg: 'real', confirmDel: null },
  detail: { kl8k: 10 },
  runner: null
};
const App = window.App = { pages: {}, acts: {}, inputs: {}, changes: {} };

/* ---------- 持久化 ---------- */
async function loadAll() {
  const [settings, tickets, profile, pick, trend, ack] = await Promise.all([
    Store.get('settings', null), Store.get('tickets', []), Store.get('profile', { birthdays: [] }), Store.get('pick', null), Store.get('trend', null), Store.get('ack', {})]);
  if (settings) Object.assign(S.settings, settings);
  S.tickets = Array.isArray(tickets) ? tickets : []; S.profile = profile && Array.isArray(profile.birthdays) ? profile : { birthdays: [] }; S.ack = ack || {};
  if (pick) Object.assign(S.pick, pick, { results: null, lockOpen: false });
  if (trend) Object.assign(S.trend, trend);
  if (!LT.GAMES[S.pick.game]) S.pick.game = 'ssq'; if (!LT.GAMES[S.trend.game]) S.trend.game = 'ssq';
  S.check.game = S.pick.game;
}
App.savePick = () => { const p = S.pick; Store.set('pick', { game: p.game, method: p.method, count: p.count, avoid: p.avoid, k: p.k, play: p.play, win: p.win, zodiac: p.zodiac, selP: p.selP, wxP: p.wxP, words: p.words }); };
App.saveTrend = () => Store.set('trend', S.trend);
App.saveSettings = () => { Store.set('settings', S.settings); syncRunner(); };
App.saveProfile = (p) => { S.profile = p; Store.set('profile', p); };
App.addTicket = async (t) => { S.tickets = S.tickets.filter(x => x.id !== t.id).concat(t); await Store.set('tickets', S.tickets); syncRunner(); maybeAskNotif(); return true; };
App.updateTicket = async (id, patch) => { S.tickets = S.tickets.map(x => x.id === id ? Object.assign({}, x, patch) : x); await Store.set('tickets', S.tickets); syncRunner(); };
App.delTicket = async (id) => { S.tickets = S.tickets.filter(x => x.id !== id); await Store.set('tickets', S.tickets); syncRunner(); };
App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- 对奖 ---------- */
App.evalTicket = (t) => {
  const d = Data.find(t.game, t.issue); if (!d) return { pending: true };
  const ctx = LT.contextFor(t.game, t.issue, Data.draws[t.game]);
  return Object.assign(LT.checkTicket(t, d, ctx), { draw: d, ctx });
};
App.statusBadge = (t) => {
  const r = App.evalTicket(t);
  if (r.pending) return '<span class="badge wait">待开奖</span>';
  if (r.floating.length) return `<span class="badge big">中${esc(r.floating.join('、'))}</span>`;
  if (r.fixed > 0) return `<span class="badge win">中奖 ${LT.fmtMoney(r.fixed)} 元</span>`;
  return '<span class="badge none">未中奖</span>';
};
App.prizeHTML = (t) => {
  const g = t.game, G = LT.GAMES[g]; if (!t.issue) return '<p class="note warn">没有期号，补上期号才能对奖。</p>';
  const r = App.evalTicket(t);
  if (r.pending) { const n = Data.next(g); return `<p class="note">第 ${esc(t.issue)} 期还没开奖${n && n.code === t.issue ? `，${mdw(n.date)} ${G.time} 开奖` : ''}。保存后开奖了会自动对奖。</p>`; }
  const d = r.draw; const names = LT.sortLevels(Object.keys(r.tally));
  let h = `<div class="prize"><div class="row between"><span class="small muted">第 ${esc(LT.issueShort(g, d.code))} 期开奖 · ${mdw(d.date)}</span></div>${U.drawBalls(g, d, 'sm')}`;
  if (!names.length) h += `<p>这张票没有中奖，共 ${r.bets} 注。</p>`;
  else {
    names.forEach(n => { const a = LT.amountOf(g, n, r.ctx);
      h += `<div class="prize-row"><span>${esc(n)} × ${r.tally[n]}${r.mult > 1 ? ` × ${r.mult}倍` : ''}</span><span class="num">${a == null ? '浮动奖' : LT.fmtMoney(a) + ' 元/注'}</span></div>`; });
    h += `<div class="prize-total"><span>固定奖金合计</span><b>${LT.fmtMoney(r.fixed)} 元</b></div>`;
    if (r.floating.length) h += `<p class="note">中了${esc(r.floating.join('、'))}！浮动奖金额以官方公告为准${t.add ? '，追加投注另得基本奖金的 80%' : ''}。单注 1 万元以上要到当地彩票中心兑奖。</p>`;
    if (g === 'dlt' && r.ctx.boost == null && r.fixedAlt !== r.fixed) h += `<p class="note">没查到上期奖池。如果上期奖池达到 8 亿，三至七等奖上调，合计是 ${LT.fmtMoney(r.fixedAlt)} 元。</p>`;
    if (g === 'dlt' && r.ctx.boost) h += '<p class="small muted">上期奖池达 8 亿，三至七等奖已按上调后的金额计算。</p>';
    if (r.tally['福运奖']) h += '<p class="small muted">本期双色球在执行奖池特别规定，中 3 个红球有 5 元福运奖。</p>';
  }
  return h + '</div>';
};
App.ticketLines = (t, draw) => `<div class="mlines">${t.lines.map(L => { const n = LT.lineBets(t.game, L);
  return `<div class="mline">${U.lineBalls(t.game, L, draw)}${n > 1 ? `<span class="tiny faint num">${n}注</span>` : ''}</div>`; }).join('')}</div>`;

/* ---------- 导航 ---------- */
const TABS = [['home', '开奖', I.draw], ['pick', '选号', I.pick], ['trend', '走势', I.trend], ['mine', '我的', I.mine]];
function renderNav() {
  $('#tabbar').innerHTML = TABS.map(([k, n, ic]) => `<button type="button" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic}<span>${n}</span></button>`).join('');
  const f = $('#scanfab'); f.innerHTML = I.scan; if (S.tab === 'check') f.setAttribute('aria-current', 'page'); else f.removeAttribute('aria-current');
}
App.go = (tab) => { S.tab = tab; S.sub = null; render(); window.scrollTo(0, 0); };
App.openSub = (sub) => { S.sub = sub; render(); const el = $('#sub'); el.scrollTop = 0; };
App.closeSub = () => { S.sub = null; render(); };

/* ---------- 开奖（首页） ---------- */
function gameBadge(g) {
  const ts = S.tickets.filter(t => t.game === g); if (!ts.length) return '';
  let wait = 0, win = 0; ts.forEach(t => { const r = App.evalTicket(t); if (r.pending) wait++; else if (r.fixed > 0 || r.floating.length) { if (!S.ack[t.id]) win++; } });
  if (win) return `<span class="badge win">${win} 张中奖</span>`;
  return wait ? `<span class="badge wait">${wait} 张待开奖</span>` : '';
}
App.pages.home = () => {
  const now = LT.bjNow(); const iso = LT.ymd(now);
  const tonight = LT.drawsToday(); const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wins = unackedWins();
  let h = `<header class="lt"><div><h1>开奖</h1><p>${mdw(iso)}${tonight.length ? ' · 今晚开奖' : ''}</p></div>
    <button type="button" class="icon-btn glass" data-act="refresh" aria-label="刷新开奖">${S.refreshing ? '<span class="spin"></span>' : I.refresh}</button></header>`;
  if (tonight.length) h += `<div class="tonight">${tonight.map(g => { const [hh, mm] = LT.GAMES[g].time.split(':').map(Number); const done = mins >= hh * 60 + mm;
    return `<span>${LT.GAMES[g].name} ${done ? '已开奖' : LT.GAMES[g].time}</span>`; }).join('')}</div>`;
  if (wins.length) h += `<button type="button" class="glass card" data-act="showwins" style="text-align:left"><div class="row between"><b>你有 ${wins.length} 张票中奖了</b><span class="badge win">查看</span></div></button>`;
  LT.ORDER.forEach(g => {
    const G = LT.GAMES[g], d = Data.latest(g), n = Data.next(g), m = Data.meta[g];
    h += `<article class="glass draw-card">
      <div class="draw-top"><h2>${G.name}</h2><span class="org ${G.org === '福彩' ? 'fc' : 'tc'}">${G.org}</span>
        <span class="grow small muted num">${d ? `${esc(LT.issueShort(g, d.code))}期 · ${mdw(d.date)}` : ''}</span>${gameBadge(g)}</div>`;
    if (d) {
      h += `<button type="button" data-act="detail" data-g="${g}" data-code="${d.code}" style="text-align:left" aria-label="${G.name}开奖详情">${U.drawBalls(g, d, g === 'kl8' ? 'xs' : g === 'qlc' ? 'sm' : '')}</button>`;
      const meta = [];
      if (d.pool != null && d.pool > 0) meta.push(`奖池 <b>${d.pool >= 1 ? d.pool.toFixed(2) + '亿' : money(d.pool * 1e8)}</b>`);
      if (d.sales != null) meta.push(`销售 <b>${money(d.sales)}</b>`);
      if (n) meta.push(`下期 <b>${md(n.date)}</b> 周${U.wk(n.date)} ${G.time}`);
      h += `<div class="draw-meta">${meta.map(x => `<span>${x}</span>`).join('')}</div>`;
    } else {
      h += `<p class="small muted">${m && !m.ok ? '没取到开奖数据：' + esc(m.msg) + '。点右上角刷新重试。' : '正在获取开奖数据…'}</p>`;
    }
    h += `<div class="quick"><button type="button" data-act="detail" data-g="${g}" data-code="${d ? d.code : ''}" ${d ? '' : 'disabled'}>详情</button><button type="button" data-act="gotrend" data-g="${g}">走势</button>
      <button type="button" data-act="gopick" data-g="${g}">选号</button><button type="button" data-act="gocheck" data-g="${g}">对奖</button></div></article>`;
  });
  h += '<p class="disclaimer">开奖结果来自中国福彩网、中国体彩网，兑奖以官方公告为准。</p>';
  return h;
};

/* ---------- 开奖详情 ---------- */
App.pages.detail = () => {
  const { g, code } = S.sub; const G = LT.GAMES[g]; const list = Data.draws[g]; const i = list.findIndex(d => d.code === code); const d = list[i];
  let h = `<div class="sub-bar"><button type="button" class="icon-btn" data-act="back" aria-label="返回">${I.back}</button><h2>${G.name} 开奖详情</h2></div><div class="page">`;
  if (!d) return h + '<div class="empty">没有这一期的数据。</div></div>';
  h += `<div class="glass card"><div class="navrow">
      <button type="button" class="btn sm ghost" data-act="detail" data-g="${g}" data-code="${i > 0 ? list[i - 1].code : ''}" ${i > 0 ? '' : 'disabled'}>${I.back.replace('<svg', '<svg class="ico"')}上一期</button>
      <div style="text-align:center"><b class="num" style="font-size:18px">第 ${esc(LT.issueShort(g, d.code))} 期</b><div class="tiny muted">${mdw(d.date)} ${G.time}</div></div>
      <button type="button" class="btn sm ghost" data-act="detail" data-g="${g}" data-code="${i < list.length - 1 ? list[i + 1].code : ''}" ${i < list.length - 1 ? '' : 'disabled'}>下一期${I.next.replace('<svg', '<svg class="ico"')}</button></div>
    <div style="display:grid;place-items:center;padding:6px 0">${U.drawBalls(g, d)}</div>`;
  if (G.kind === 'digit') { const sum = d.n.reduce((a, b) => a + b, 0), span = Math.max(...d.n) - Math.min(...d.n), dist = LT.uniq(d.n).length;
    h += `<p class="small muted" style="text-align:center">和值 ${sum} · 跨度 ${span}${G.len === 3 ? ' · ' + (dist === 3 ? '组六' : dist === 2 ? '组三' : '豹子') : ''}</p>`; }
  if (g === 'qlc') h += '<p class="tiny faint" style="text-align:center">蓝色为特别号码</p>';
  const stats = [];
  if (d.sales != null) stats.push(['本期销售', money(d.sales) + (d.sales >= 1e4 ? '元' : '')]);
  if (d.pool != null) stats.push([g === 'kl8' ? '奖池' : '奖池滚存', d.pool >= 1 ? d.pool.toFixed(2) + '亿元' : money(d.pool * 1e8) + '元']);
  if (stats.length) h += `<div class="stat3">${stats.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
  h += '</div>';
  // 奖级表
  const cond = LT.CONDITIONS[g] || {};
  let grades = d.grades;
  if (g === 'kl8') {
    const k = S.detail.kl8k;
    h += `<div class="glass card"><div class="card-head"><h2>中奖情况</h2></div><div class="games" style="margin:0;padding:0 0 4px">${LT.range(1, 10).reverse().map(x => `<button type="button" class="chip" data-act="kl8k" data-k="${x}" aria-pressed="${x === k}">${LT.KENO_NAME[x]}</button>`).join('')}</div>`;
    const row = LT.KENO_TABLE[k]; const hs = Object.keys(row).map(Number).sort((a, b) => b - a);
    h += `<table class="ptable"><thead><tr><th>中奖条件</th><th class="r">中奖注数</th><th class="r">每注奖金</th></tr></thead><tbody>${hs.map(x => {
      const nm = `${LT.KENO_NAME[k]}中${x}`; const gr = (grades || []).find(q => q.name === nm);
      const amt = gr && gr.amount ? gr.amount : (row[x] === 'F' ? null : row[x]);
      return `<tr><td>${x === 0 ? '全不中' : '中' + x + '个'}</td><td class="r num">${gr && gr.count != null ? gr.count.toLocaleString() : '—'}</td><td class="r amt">${amt == null ? '浮动' : LT.fmtMoney(amt)}</td></tr>`; }).join('')}</tbody></table>`;
    if (!grades) h += '<p class="tiny faint">这一期的中奖注数没有保存，表里是规则奖金。</p>';
    h += '</div>';
  } else {
    const names = grades ? LT.sortLevels([...new Set(grades.map(x => x.name.replace(/\(追加\)|（追加）/, '')))]) : Object.keys(cond);
    const pick = (n) => (grades || []).find(x => x.name === n), pickAdd = (n) => (grades || []).find(x => /追加/.test(x.name) && x.name.replace(/\(追加\)|（追加）/, '') === n);
    const ctx = LT.contextFor(g, d.code, Data.draws[g]);
    h += `<div class="glass card"><div class="card-head"><h2>中奖情况</h2>${g === 'dlt' && ctx.boost ? '<span class="badge win">奖池超 8 亿加奖</span>' : ''}</div><table class="ptable"><thead><tr><th>奖级</th><th>条件</th><th class="r">注数</th><th class="r">每注奖金</th></tr></thead><tbody>`;
    names.forEach((n, ix) => { const gr = pick(n), ga = pickAdd(n); let amt = gr && gr.amount ? gr.amount : LT.amountOf(g, n, ctx);
      h += `<tr class="${ix === 0 ? 'top' : ''}"><td>${esc(n)}</td><td class="small muted">${esc(cond[n] || '')}</td><td class="r num">${gr && gr.count != null ? gr.count.toLocaleString() : '—'}</td><td class="r amt">${amt == null ? '浮动' : LT.fmtMoney(amt)}</td></tr>`;
      if (ga) h += `<tr><td class="small">${esc(n)}追加</td><td></td><td class="r num">${ga.count != null ? ga.count.toLocaleString() : '—'}</td><td class="r amt">${ga.amount != null ? LT.fmtMoney(ga.amount) : '—'}</td></tr>`; });
    h += '</tbody></table>';
    if (!grades) h += '<p class="tiny faint">这一期的中奖注数没有保存，表里是规则奖金。</p>';
    else if (d.partial) h += '<p class="tiny faint">早期数据只保存了一、二等奖。</p>';
    h += '</div>';
  }
  if (d.region) h += `<div class="glass card"><h2 style="font-size:16px">一等奖分布</h2><p class="region">${esc(d.region)}</p></div>`;
  const mine = S.tickets.filter(t => t.game === g && t.issue === d.code);
  if (mine.length) h += `<div class="sec-title">我这一期的票</div>` + mine.map(t => `<div class="glass card"><div class="tk-head"><span class="badge ${t.kind === 'sim' ? 'sim' : 'real'}">${t.kind === 'sim' ? '模拟' : '实票'}</span><span class="grow small muted">${esc(t.method || '')}</span>${App.statusBadge(t)}</div>${App.ticketLines(t, d)}</div>`).join('');
  return h + '</div>';
};

/* ---------- 中奖提示 ---------- */
function unackedWins() {
  return S.tickets.filter(t => { if (S.ack[t.id]) return false; const r = App.evalTicket(t); return !r.pending && (r.fixed > 0 || r.floating.length); });
}
App.showWins = () => {
  const ws = unackedWins(); if (!ws.length) return;
  const el = $('#sheet');
  el.innerHTML = `<div class="sheet-back" data-act="closesheet"><div class="sheet glass thick" data-stop="1"><h2>中奖了</h2>${ws.map(t => { const G = LT.GAMES[t.game]; const r = App.evalTicket(t);
    return `<div class="card glass"><div class="tk-head"><span class="gname">${G.name}</span><span class="small muted num">${esc(LT.issueShort(t.game, t.issue))}期</span><span class="badge ${t.kind === 'sim' ? 'sim' : 'real'}">${t.kind === 'sim' ? '模拟' : '实票'}</span><span class="grow"></span>${App.statusBadge(t)}</div>
      <p class="small">${LT.sortLevels(Object.keys(r.tally)).map(k => esc(k) + ' × ' + r.tally[k]).join('，')}</p></div>`; }).join('')}
    ${ws.some(t => t.kind === 'sim') ? '<p class="tiny faint" style="text-align:center">模拟票没有真的买，只是记录这组号码会中多少。</p>' : ''}
    <button type="button" class="btn primary" data-act="ackwins">知道了</button></div></div>`;
};
App.acts.ackwins = () => { unackedWins().forEach(t => { S.ack[t.id] = 1; }); Store.set('ack', S.ack); $('#sheet').innerHTML = ''; render(); };
App.acts.showwins = () => App.showWins();
App.acts.closesheet = (a, e) => { if (e.target === a) $('#sheet').innerHTML = ''; return 'noRender'; };

/* ---------- 我的 ---------- */
App.pages.mine = () => {
  const seg = S.mine.seg; const all = [...S.tickets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); const ts = all.filter(t => (t.kind || 'real') === seg);
  let cost = 0, won = 0, wait = 0, big = 0, hit = 0;
  ts.forEach(t => { cost += LT.ticketCost(t); const r = App.evalTicket(t); if (r.pending) wait++; else { won += r.fixed; if (r.floating.length) big++; if (r.fixed > 0 || r.floating.length) hit++; } });
  let h = `<header class="lt"><div><h1>我的</h1><p>${all.length ? `实票 ${all.filter(t => (t.kind || 'real') === 'real').length} 张 · 模拟 ${all.filter(t => t.kind === 'sim').length} 张` : '投注记录和家人生日'}</p></div>
    <button type="button" class="icon-btn glass" data-act="settings" aria-label="设置">${I.gear}</button></header>
    <div class="seg"><button type="button" data-act="mseg" data-v="real" aria-pressed="${seg === 'real'}">实票</button><button type="button" data-act="mseg" data-v="sim" aria-pressed="${seg === 'sim'}">模拟</button></div>`;
  const net = Math.round((won - cost) * 10) / 10;
  h += `<div class="glass card"><div class="sum">
    <div><b>${cost}</b><small>${seg === 'real' ? '共投入（元）' : '假如都买（元）'}</small></div>
    <div><b style="color:var(--gold)">${LT.fmtMoney(Math.round(won * 10) / 10)}</b><small>固定奖（元）</small></div>
    <div><b style="color:${net >= 0 ? 'var(--good)' : 'var(--bad)'}">${net > 0 ? '+' : ''}${LT.fmtMoney(net)}</b><small>盈亏（元）</small></div></div>
    <div class="row between small muted"><span>${wait} 张待开奖 · ${hit} 张中过奖</span>${big ? `<span class="badge big">${big} 张中浮动奖</span>` : ''}</div>
    ${seg === 'sim' ? '<p class="tiny faint">模拟票是选号后没去买的号，用来看看选号方式的表现。</p>' : ''}</div>`;
  if (!ts.length) h += `<div class="glass card empty">${seg === 'real' ? '还没有实票。在"选号"出号后点"我买了"，或用右下角扫票、手动录入，开奖后这里自动显示中没中。' : '还没有模拟票。在"选号"出号后点"存为模拟"。'}</div>`;
  ts.slice(0, 200).forEach(t => { const G = LT.GAMES[t.game]; const r = App.evalTicket(t);
    h += `<div class="glass card"><div class="tk-head"><span class="gname">${G.name}</span><b class="num">${esc(LT.issueShort(t.game, t.issue) || '无期号')}期</b>
      <span class="grow tiny muted">${esc(t.method || '')} · ${LT.ticketCost(t)}元${t.mult > 1 ? ' · ' + t.mult + '倍' : ''}${t.add ? ' · 追加' : ''}</span>${App.statusBadge(t)}</div>
      ${App.ticketLines(t, r.pending ? null : r.draw)}
      ${!r.pending && Object.keys(r.tally).length ? `<p class="small">${LT.sortLevels(Object.keys(r.tally)).map(k => esc(k) + '×' + r.tally[k]).join('，')}${r.mult > 1 ? `（${r.mult}倍）` : ''}</p>` : ''}
      <div class="row">${S.mine.confirmDel === t.id ? `<span class="small">删除这张？</span><button type="button" class="btn sm danger" data-act="del" data-id="${esc(t.id)}">删除</button><button type="button" class="btn sm ghost" data-act="delno">取消</button>`
        : `${t.kind === 'sim' ? `<button type="button" class="btn sm" data-act="toreal" data-id="${esc(t.id)}">我买了</button>` : ''}<button type="button" class="btn sm ghost" data-act="copyt" data-id="${esc(t.id)}">${I.copy.replace('<svg', '<svg class="ico"')}复制</button><button type="button" class="btn sm ghost" data-act="delask" data-id="${esc(t.id)}">删除</button>`}</div></div>`; });
  h += `<div class="sec-title">家人生日</div><div class="glass card"><p class="small muted">生日、星座、八字五行三种选号方式用这里的生日。</p>${App.peopleHTML('none')}</div>`;
  return h;
};

/* 生日管理（选号和我的页共用） */
const HOURS = [['', '时辰不详'], [0, '子时 23–1点'], [2, '丑时 1–3点'], [4, '寅时 3–5点'], [6, '卯时 5–7点'], [8, '辰时 7–9点'], [10, '巳时 9–11点'], [12, '午时 11–13点'], [14, '未时 13–15点'], [16, '申时 15–17点'], [18, '酉时 17–19点'], [20, '戌时 19–21点'], [22, '亥时 21–23点']];
App.hourName = (h) => { const x = HOURS.find(v => v[0] !== '' && +v[0] === +h); return x ? x[1].slice(0, 2) : ''; };
App.peopleHTML = (mode) => {
  const bs = S.profile.birthdays || [];
  const items = bs.map(p => { const on = mode === 'multi' ? S.pick.selP.includes(p.id) : mode === 'single' ? S.pick.wxP === p.id : false;
    const act = mode === 'multi' ? 'selp' : mode === 'single' ? 'wxp' : 'none';
    return `<div class="person" aria-pressed="${on}"><button type="button" class="who" data-act="${act}" data-id="${esc(p.id)}" aria-pressed="${on}"><b>${esc(p.name || '未命名')}</b>
      <small>${p.y}年${p.m}月${p.d}日${p.h !== '' && p.h != null ? ' · ' + App.hourName(p.h) : ''} · ${LT.zodiacOf(p.m, p.d)}</small></button>
      <button type="button" class="btn sm ghost" data-act="delp" data-id="${esc(p.id)}">删除</button></div>`; }).join('');
  return `<div class="people">${items || '<p class="small faint">还没有生日。添加自己或家人的生日，选号时点选要用的人。</p>'}</div>
  <div class="form2"><div class="field"><label for="p-name">称呼</label><input type="text" id="p-name" maxlength="12" placeholder="如 自己、老婆" value="${esc(S.pform.name)}"></div>
    <div class="field"><label for="p-date">公历生日</label><input type="date" id="p-date" min="1900-01-01" max="2030-12-31" value="${esc(S.pform.date)}"></div>
    <div class="field full"><label for="p-hour">出生时辰（八字用，可不填）</label><select id="p-hour">${HOURS.map(([v, t]) => `<option value="${v}" ${String(S.pform.hour) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <button type="button" class="btn full" data-act="addp">添加这个生日</button></div>`;
};
App.acts.addp = () => { const f = S.pform; if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return U.toast('先选生日日期');
  const [y, m, d] = f.date.split('-').map(Number); if (y < 1900 || y > 2030) return U.toast('年份不对');
  const p = { id: App.uid(), name: f.name.trim() || '未命名', y, m, d, h: f.hour === '' ? '' : +f.hour };
  App.saveProfile({ birthdays: (S.profile.birthdays || []).concat(p) });
  S.pick.selP = S.pick.selP.concat(p.id); if (!S.pick.wxP) S.pick.wxP = p.id; if (!S.pick.zodiac) S.pick.zodiac = LT.zodiacOf(m, d); App.savePick();
  S.pform = { name: '', date: '', hour: '' }; U.toast('已添加 ' + p.name); };
App.acts.delp = (a) => { const id = a.dataset.id; App.saveProfile({ birthdays: (S.profile.birthdays || []).filter(p => p.id !== id) });
  S.pick.selP = S.pick.selP.filter(x => x !== id); if (S.pick.wxP === id) S.pick.wxP = null; App.savePick(); };
App.acts.selp = (a) => { const id = a.dataset.id; S.pick.selP = S.pick.selP.includes(id) ? S.pick.selP.filter(x => x !== id) : S.pick.selP.concat(id); App.savePick(); };
App.acts.wxp = (a) => { S.pick.wxP = a.dataset.id; App.savePick(); };
App.inputs['p-name'] = (t) => { S.pform.name = t.value; return false; };
App.inputs['p-date'] = (t) => { S.pform.date = t.value; return false; };
App.changes['p-date'] = (t) => { S.pform.date = t.value; return false; };
App.changes['p-hour'] = (t) => { S.pform.hour = t.value; return false; };

/* ---------- 设置 ---------- */
App.pages.settings = () => {
  const st = S.settings; const rn = S.runner;
  let h = `<div class="sub-bar"><button type="button" class="icon-btn" data-act="back" aria-label="返回">${I.back}</button><h2>设置</h2></div><div class="page">`;
  h += `<div class="sec-title">开奖推送</div><div class="glass card"><p class="small muted">开奖后在通知栏推送号码；你存的票中奖了单独提醒。</p>
    ${LT.ORDER.map(g => `<div class="opt"><span>${LT.GAMES[g].name}<small class="tiny faint" style="display:block">${dayText(g)} ${LT.GAMES[g].time}</small></span><button type="button" class="switch" role="switch" aria-checked="${!!st.subs[g]}" data-act="sub" data-g="${g}" aria-label="${LT.GAMES[g].name}开奖推送"></button></div>`).join('')}
    <div class="opt"><span>中奖提醒<small class="tiny faint" style="display:block">实票和模拟票中奖都提醒</small></span><button type="button" class="switch" role="switch" aria-checked="${!!st.winAlert}" data-act="winalert" aria-label="中奖提醒"></button></div>
    <div class="row"><button type="button" class="btn sm" data-act="testnotif">${I.bell.replace('<svg', '<svg class="ico"')}发一条测试通知</button><button type="button" class="btn sm ghost" data-act="runnow">现在检查一次</button></div>
    <p class="tiny faint">后台每半小时检查一次${rn && rn.lastRun ? `，上次检查 ${U.ago(+rn.lastRun)}` : ''}。小米、华为、OPPO、vivo 等手机要在系统设置里允许本应用"自启动"和"后台运行"，否则可能收不到推送。</p></div>`;
  h += `<div class="sec-title">外观</div><div class="glass card"><div class="seg">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([v, t]) => `<button type="button" data-act="theme" data-v="${v}" aria-pressed="${st.theme === v}">${t}</button>`).join('')}</div></div>`;
  h += `<div class="sec-title">开奖数据</div><div class="glass card">${LT.ORDER.map(g => { const d = Data.latest(g), m = Data.meta[g] || {};
    return `<div class="list-item"><div class="grow"><b>${LT.GAMES[g].name}</b><small>${d ? `已收录到 ${LT.issueShort(g, d.code)} 期，共 ${Data.draws[g].length} 期` : '还没有数据'}${m.at ? ` · ${m.ok ? '更新' : '获取失败'} ${U.ago(m.at)}` : ''}${m.src === '备用源' ? ' · 备用源' : ''}</small>
      ${m.ok === false ? `<small style="color:var(--bad)">${esc(m.msg)}</small>` : ''}</div></div>`; }).join('')}
    <div class="row"><button type="button" class="btn sm" data-act="refetch">全部重新获取</button><button type="button" class="btn sm ghost" data-act="diag">${S.diag ? '收起' : '数据诊断'}</button></div>
    ${S.diag ? `<div class="rawtext">${esc(Object.entries(HB.Data.lastRaw).map(([k, v]) => `[${k}] ${v.status} ${new Date(v.at).toLocaleTimeString()}\n${v.url}\n${v.text}`).join('\n\n') || '还没有请求记录。点"全部重新获取"后再看。')}</div>` : ''}</div>`;
  h += `<div class="sec-title">关于</div><div class="glass card"><p class="small">每一期开奖都是独立随机的，这里的任何选号方式中奖概率都和机选一样，图个乐趣。理性购彩，量力而行。</p>
    <p class="small muted">开奖数据来自中国福彩网（双色球、福彩3D、快乐8、七乐彩）和中国体彩网（大乐透、排列3、排列5、七星彩）。兑奖以官方公告为准。</p>
    <p class="tiny faint">红蓝 ${esc(window.APP_VERSION || '')}</p></div>`;
  return h + '</div>';
};
function dayText(g) { const d = LT.GAMES[g].days; if (d.length === 7) return '每天'; return '每周' + d.slice().sort((a, b) => (a || 7) - (b || 7)).map(x => '日一二三四五六'[x]).join('、'); }

/* ---------- 提醒：本地通知 + 后台对奖 ---------- */
async function notifAllowed(ask) {
  if (!isNative) return false; const LN = plugin('LocalNotifications'); if (!LN) return false;
  try { let p = await LN.checkPermissions(); if (p.display !== 'granted' && ask) p = await LN.requestPermissions(); return p.display === 'granted'; } catch (e) { return false; }
}
async function maybeAskNotif() { if (S.settings.notifAsked || !isNative) return; S.settings.notifAsked = true; Store.set('settings', S.settings); await notifAllowed(true); }
function syncRunner() {
  if (!isNative) return; const BR = plugin('BackgroundRunner'); if (!BR) return;
  const pending = S.tickets.filter(t => !Data.find(t.game, t.issue)).slice(-120)
    .map(t => ({ id: t.id, game: t.game, issue: t.issue, lines: t.lines, mult: t.mult || 1, add: !!t.add, kind: t.kind || 'real' }));
  const ctx = {}; LT.ORDER.forEach(g => { const n = Data.next(g); if (n) ctx[g] = LT.contextFor(g, n.code, Data.draws[g]); });
  const last = {}; LT.ORDER.forEach(g => { const d = Data.latest(g); if (d) last[g] = d.code + '|' + d.date; });
  const cfg = { subs: LT.ORDER.filter(g => S.settings.subs[g]), win: !!S.settings.winAlert, tickets: pending, ctx, last };
  BR.dispatchEvent({ label: RUNNER, event: 'sync', details: { cfg: JSON.stringify(cfg) } }).catch(() => {});
}
App.syncRunner = syncRunner;
async function runnerStatus() {
  if (!isNative) return; const BR = plugin('BackgroundRunner'); if (!BR) return;
  try { const r = await BR.dispatchEvent({ label: RUNNER, event: 'status', details: {} }); S.runner = r || null; } catch (e) {}
}
App.acts.sub = async (a) => { const g = a.dataset.g; S.settings.subs[g] = !S.settings.subs[g]; App.saveSettings(); if (S.settings.subs[g] && !(await notifAllowed(true))) U.toast('没有通知权限，到系统设置里允许本应用发通知'); render(); };
App.acts.winalert = async () => { S.settings.winAlert = !S.settings.winAlert; App.saveSettings(); if (S.settings.winAlert) await notifAllowed(true); render(); };
App.acts.testnotif = async () => {
  if (!isNative) return U.toast('装到手机上才能发通知');
  if (!(await notifAllowed(true))) return U.toast('没有通知权限，到系统设置里允许本应用发通知');
  try { await plugin('LocalNotifications').schedule({ notifications: [{ id: 9001, title: '红蓝', body: '通知正常。开奖后会在这里推送号码。', schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true } }] }); U.toast('1 秒后会收到一条通知'); }
  catch (e) { U.toast('发送失败：' + (e.message || e)); }
};
App.acts.runnow = async () => {
  if (!isNative) return U.toast('装到手机上才能用');
  const BR = plugin('BackgroundRunner'); if (!BR) return U.toast('后台检查组件不可用');
  U.toast('正在检查…'); syncRunner();
  try { const r = await BR.dispatchEvent({ label: RUNNER, event: 'check', details: { force: true } }); U.toast(r && r.msg ? r.msg : '检查完成'); await runnerStatus(); render(); }
  catch (e) { U.toast('检查失败：' + (e.message || e)); }
};
App.acts.theme = (a) => { S.settings.theme = a.dataset.v; App.saveSettings(); applyTheme(); };
App.acts.refetch = async () => { U.toast('正在获取…'); await Promise.all(LT.ORDER.map(g => Data.refresh(g, { full: true }))); afterData(); U.toast('获取完成'); };
App.acts.diag = () => { S.diag = !S.diag; };
function applyTheme() {
  const t = S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  if (!isNative) return; const SB = plugin('StatusBar'); if (!SB) return;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  SB.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
  SB.setBackgroundColor({ color: dark ? '#060B0C' : '#ECF1EF' }).catch(() => {});
}

/* ---------- 刷新 ---------- */
async function refresh(force) {
  if (S.refreshing) return; S.refreshing = true; render();
  try { await Data.refreshDue(force); } finally { S.refreshing = false; afterData(); }
}
function afterData() { render(); syncRunner(); if (S.settings.winAlert !== false && unackedWins().length && !S.sub) App.showWins(); }
App.acts.refresh = () => refresh(true);

/* ---------- 通用动作 ---------- */
App.acts.tab = (a) => App.go(a.dataset.tab);
App.acts.back = () => App.closeSub();
App.acts.detail = (a) => { if (!a.dataset.code) return; App.openSub({ type: 'detail', g: a.dataset.g, code: a.dataset.code }); return 'noRender'; };
App.acts.kl8k = (a) => { S.detail.kl8k = +a.dataset.k; };
App.acts.settings = () => { App.openSub({ type: 'settings' }); runnerStatus().then(render); return 'noRender'; };
App.acts.gotrend = (a) => { S.trend.game = a.dataset.g; App.saveTrend(); App.go('trend'); return 'noRender'; };
App.acts.gopick = (a) => { S.pick.game = a.dataset.g; S.pick.results = null; App.savePick(); App.go('pick'); return 'noRender'; };
App.acts.gocheck = (a) => { S.check.game = a.dataset.g; S.check.man = null; App.go('check'); return 'noRender'; };
App.acts.mseg = (a) => { S.mine.seg = a.dataset.v; S.mine.confirmDel = null; };
App.acts.delask = (a) => { S.mine.confirmDel = a.dataset.id; };
App.acts.delno = () => { S.mine.confirmDel = null; };
App.acts.del = async (a) => { S.mine.confirmDel = null; await App.delTicket(a.dataset.id); };
App.acts.toreal = async (a) => { await App.updateTicket(a.dataset.id, { kind: 'real' }); U.toast('已改为实票'); };
App.acts.copyt = (a) => { const t = S.tickets.find(x => x.id === a.dataset.id); if (t) U.copy(App.ticketText(t)); return 'noRender'; };
App.ticketText = (t) => `${LT.GAMES[t.game].name} 第${LT.issueShort(t.game, t.issue)}期\n` + t.lines.map(L => U.lineText(t.game, L)).join('\n');

/* ---------- 渲染 ---------- */
function render() {
  const ae = document.activeElement; const fid = ae && ae.id && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.type !== 'file' ? ae.id : null;
  let sel = null; try { if (fid && ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) {}
  renderNav();
  const page = $('#page');
  if (!S.ready) page.innerHTML = '<div class="loading"><span class="spin"></span>正在载入…</div>';
  else page.innerHTML = (App.pages[S.tab] || App.pages.home)();
  const sub = $('#sub');
  if (S.sub && S.ready) { sub.innerHTML = '<div class="ambient"></div>' + (App.pages[S.sub.type] || (() => ''))(); requestAnimationFrame(() => sub.classList.add('open')); }
  else { sub.classList.remove('open'); setTimeout(() => { if (!S.sub) sub.innerHTML = ''; }, 300); }
  if (fid) { const el = document.getElementById(fid); if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
}
App.render = render;

document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  const fn = App.acts[a.dataset.act]; if (!fn) return;
  const r = await fn(a, e); if (r !== 'noRender') render();
});
document.addEventListener('input', (e) => { const fn = App.inputs[e.target.id]; if (fn && fn(e.target) !== false) render(); });
document.addEventListener('change', (e) => { const fn = App.changes[e.target.id]; if (fn && fn(e.target) !== false) render(); });
$('#scanfab').addEventListener('click', () => App.go('check'));

/* ---------- 启动 ---------- */
async function start() {
  await loadAll(); applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  await Data.init(); S.ready = true; render();
  if (isNative) {
    const AppP = plugin('App');
    if (AppP) {
      AppP.addListener('backButton', () => { if ($('#sheet').innerHTML) { $('#sheet').innerHTML = ''; return; } if (S.sub) return App.closeSub(); if (S.tab !== 'home') return App.go('home'); AppP.exitApp(); });
      AppP.addListener('resume', () => { if (LT.ORDER.some(g => Data.needsUpdate(g))) refresh(false); else render(); });
    }
    const LN = plugin('LocalNotifications'); if (LN) LN.addListener('localNotificationActionPerformed', () => App.go('home')).catch(() => {});
  }
  refresh(false);
}
App.start = start;
})();
