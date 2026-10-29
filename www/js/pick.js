/* 红蓝 · 选号 */
(function () {
'use strict';
const LT = window.LT, U = window.U, App = window.App, S = window.S, HB = window.HB;
const { esc, I, mdw } = U;
const Data = HB.Data;

const DESC = {
  random: '用加密随机数出号，和彩票站机选一样。',
  hot: '近期开出次数越多的号码，被选中的机会越大。',
  cold: '越久没开出的号码，被选中的机会越大。',
  shape: '随机出号，但和值、奇偶、大小区间落在近期常见的范围里。',
  birthday: '用生日里的日、月、年份数字和它们的组合取号，不够的随机补齐。可以选多个人。',
  zodiac: '用星座在十二宫的序号和守护星数字取号，其余随机补齐。',
  wuxing: '排出生辰八字，找出五行里最弱的一项，按河图数取对应尾数的号码来补，再加上生它的那一行。',
  today: '按这一期开奖日的干支五行取号，算法和八字五行一样。',
  words: '输入任意一句话，比如名字、心愿、车牌。同一句话永远出同一组号。'
};
App.gameChips = (cur, act) => `<div class="games">${LT.ORDER.map(g => `<button type="button" class="chip" data-act="${act}" data-g="${g}" aria-pressed="${cur === g}">${LT.GAMES[g].name}</button>`).join('')}</div>`;

function stats(g, w) { const k = g + w + ':' + Data.draws[g].length; App._st = App._st || {}; return App._st[k] || (App._st[k] = LT.stats(g, Data.draws[g], w)); }
App.stats = stats;

function wxExplain(bz, isDigit) { const w1 = bz.weak[0], w2 = LT.SHENG_BY[w1];
  return `五行最弱的是<b>${bz.weak.join('、')}</b>。取${isDigit ? '数字' : '尾数是'} ${LT.HETU[w1].join('、')} 的号码补${w1}；${w2}生${w1}，再取 ${LT.HETU[w2].join('、')}。`; }
function baziBlock(bz, labels) { const L = labels || ['年柱', '月柱', '日柱', '时柱'];
  return `<div class="pillars">${bz.pillars.map((p, i) => `<div class="pillar"><small>${L[i]}</small><span>${p}</span></div>`).join('')}${bz.pillars.length < 4 ? `<div class="pillar"><small>${L[3] || '时'}</small><span class="faint">—</span></div>` : ''}</div>
  <div class="wx">${LT.WX.map(w => `<div class="${bz.weak.includes(w) ? 'weak' : ''}">${w}<b>${bz.count[w]}</b></div>`).join('')}</div>`; }

function methodPanel() {
  const P = S.pick, g = P.game, G = LT.GAMES[g], m = P.method; const digit = G.kind === 'digit' || G.kind === 'qxc';
  let h = `<p class="desc">${DESC[m]}</p>`;
  if (['hot', 'cold', 'shape'].includes(m)) {
    if (Data.draws[g].length < 10) return h + '<p class="note warn">这个彩种的历史开奖还没取到，先到"开奖"页刷新一下。</p>';
    h += `<div class="row"><span class="small faint">参考</span>${[30, 50, 100].map(w => `<button type="button" class="chip" data-act="pwin" data-w="${w}" aria-pressed="${P.win === w}">近${w}期</button>`).join('')}</div>`;
    const st = stats(g, P.win);
    if (!digit && m === 'hot') { const top = Object.entries(st.ff).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => +x[0]);
      h += `<div class="row small"><span class="faint">最热</span>${top.map(n => U.ball(n, 'xs')).join('')}${G.sub ? `<span class="plus">+</span>${Object.entries(st.bf).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => U.ball(+x[0], 'b xs')).join('')}` : ''}</div>`; }
    if (!digit && m === 'cold') { const top = Object.entries(st.fm).sort((a, b) => b[1] - a[1]).slice(0, 5);
      h += `<p class="small muted">遗漏最久：${top.map(([n, k]) => `${U.pad(n)}（${k}期）`).join('、')}</p>`; }
    if (digit && m !== 'shape') { const key = m === 'hot' ? 'pf' : 'pm'; const pick = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
      h += `<p class="small muted">${G.posLabels.map((lb, i) => { const [d, v] = pick(st[key][i]); return `${lb} ${d}（${v}${m === 'hot' ? '次' : '期'}）`; }).join('，')}</p>`; }
    if (m === 'shape') h += `<p class="small muted">近 ${P.win} 期${digit ? '数字' : LT.GAMES[g].main.label}和值多在 <b class="num">${st.sumLo}–${st.sumHi}</b> 之间。</p>`;
  }
  if (m === 'birthday') h += App.peopleHTML('multi');
  if (m === 'zodiac') {
    h += `<div class="zgrid">${LT.ZODIAC_ORDER.map(z => `<button type="button" class="chip" data-act="zod" data-z="${z}" aria-pressed="${P.zodiac === z}">${z.replace('座', '')}</button>`).join('')}</div>`;
    const bs = S.profile.birthdays || []; if (bs.length) h += `<p class="small muted">家人星座：${bs.map(p => esc(p.name) + ' ' + LT.zodiacOf(p.m, p.d)).join('，')}</p>`;
  }
  if (m === 'wuxing') {
    h += App.peopleHTML('single');
    const p = (S.profile.birthdays || []).find(x => x.id === P.wxP);
    if (p) { const bz = LT.bazi(p.y, p.m, p.d, p.h === '' ? null : p.h);
      h += `<div class="sec-title" style="padding:0">${esc(p.name)}的八字</div>${baziBlock(bz)}<p class="small">${wxExplain(bz, digit)}</p>`;
      if (p.h === '' || p.h == null) h += '<p class="tiny faint">没填时辰，只排了年、月、日三柱。</p>';
      h += '<p class="tiny faint">节气按常年日期推算，生日正好在节气前后一两天的，月柱可能差一个月。</p>'; }
  }
  if (m === 'today') { const n = Data.next(g); if (n) { const [y, mm, dd] = n.date.split('-').map(Number); const bz = LT.bazi(y, mm, dd, null);
    h += `<div class="sec-title" style="padding:0">${LT.issueShort(g, n.code)}期 · ${mdw(n.date)}</div>${baziBlock(bz, ['年', '月', '日', '时'])}<p class="small">${wxExplain(bz, digit)}</p>`; } }
  if (m === 'words') h += `<div class="field"><label for="words">一句话</label><input type="text" id="words" maxlength="40" placeholder="比如：全家平安 或 浙A88888" value="${esc(P.words)}"></div>`;
  return h;
}

function optionsCard() {
  const P = S.pick, g = P.game, G = LT.GAMES[g]; let h = '';
  if (G.kind === 'keno') h += `<div class="opt"><span class="lbl">玩法<small>选几个号码</small></span></div><div class="stepper" style="justify-content:flex-start">${G.picks.map(k => `<button type="button" data-act="pk" data-k="${k}" aria-pressed="${P.k === k}">${LT.KENO_NAME[k]}</button>`).join('')}</div>`;
  if (G.plays && G.plays.length > 1) h += `<div class="opt"><span class="lbl">玩法</span><div class="stepper">${G.plays.map(p => `<button type="button" data-act="pplay" data-p="${p}" aria-pressed="${P.play === p}">${LT.PLAY_NAME[p]}</button>`).join('')}</div></div>`;
  h += `<div class="opt"><span class="lbl">出几注</span><div class="stepper">${[1, 2, 5, 10].map(c => `<button type="button" data-act="pcount" data-c="${c}" aria-pressed="${P.count === c}">${c}</button>`).join('')}</div></div>`;
  if (LT.avoidApplies(g, P.k)) h += `<div class="opt"><span class="lbl">防撞号<small>避开连号、等差、和历史开奖相同这类大家常买的组合，中大奖时少跟人分</small></span><button type="button" class="switch" role="switch" aria-checked="${P.avoid}" data-act="pavoid" aria-label="防撞号"></button></div>`;
  else h += '<p class="tiny faint">这个玩法奖金固定，不存在和别人分奖，所以不需要防撞号。</p>';
  if (G.addPrice) h += `<div class="opt"><span class="lbl">追加投注<small>每注多 1 元，一、二等奖多拿 80%</small></span><button type="button" class="switch" role="switch" aria-checked="${P.add}" data-act="padd" aria-label="追加投注"></button></div>`;
  return h;
}

function lockCard() {
  const P = S.pick, g = P.game, G = LT.GAMES[g]; const L = P.lock[g] || (P.lock[g] = { f: [], b: [], pos: [] });
  if (G.kind === 'digit' && P.play !== 'zx') return '';
  const chosen = G.kind === 'lotto' || G.kind === 'keno' ? L.f.map(n => U.ball(n, 'xs')).join('') + (L.b || []).map(n => U.ball(n, 'b xs')).join('')
    : L.pos.map((d, i) => d != null ? `<span class="tiny faint">${G.posLabels[i]}</span>${U.ball(d, 'xs', true)}` : '').join('') + (G.kind === 'qxc' && L.b.length ? `<span class="tiny faint">第7位</span>${U.ball(L.b[0], 'b xs', true)}` : '');
  let h = `<button type="button" class="opt" data-act="lockopen" aria-expanded="${P.lockOpen}" style="width:100%;text-align:left"><span class="lbl"><b>固定号码</b><small>每注都带上，可不选</small></span><span class="balls">${chosen}<span class="small faint">${P.lockOpen ? '收起' : '展开'}</span></span></button>`;
  if (!P.lockOpen) return h;
  if (G.kind === 'lotto' || G.kind === 'keno') {
    const maxF = G.kind === 'keno' ? Math.max(0, P.k - 1) : G.main.n - 1;
    h += `<div class="sec-title" style="padding:0">${G.main.label}（最多 ${maxF} 个）</div><div class="grid">${LT.range(G.main.min, G.main.max).map(n => `<button type="button" class="nb" data-act="lock" data-z="f" data-n="${n}" aria-pressed="${L.f.includes(n)}">${U.pad(n)}</button>`).join('')}</div>`;
    if (G.sub) h += `<div class="sec-title" style="padding:0">${G.sub.label}（最多 ${G.sub.n} 个）</div><div class="grid">${LT.range(G.sub.min, G.sub.max).map(n => `<button type="button" class="nb b" data-act="lock" data-z="b" data-n="${n}" aria-pressed="${L.b.includes(n)}">${U.pad(n)}</button>`).join('')}</div>`;
  } else {
    G.posLabels.forEach((lb, i) => { h += `<div class="posrow"><span class="poslab">${lb}</span><div class="grid d10">${LT.range(0, 9).map(d => `<button type="button" class="nb" data-act="lockpos" data-p="${i}" data-n="${d}" aria-pressed="${L.pos[i] === d}">${d}</button>`).join('')}</div></div>`; });
    if (G.kind === 'qxc') h += `<div class="posrow"><span class="poslab">第7位</span><div class="grid d15">${LT.range(0, 14).map(d => `<button type="button" class="nb b" data-act="lock" data-z="b" data-n="${d}" aria-pressed="${L.b.includes(d)}">${d}</button>`).join('')}</div></div>`;
  }
  if (L.f.length || L.b.length || L.pos.some(x => x != null)) h += '<button type="button" class="btn sm ghost" data-act="lockclear">清空固定号码</button>';
  return h;
}

App.pages.pick = () => {
  const P = S.pick, g = P.game, G = LT.GAMES[g]; const n = Data.next(g); const r = P.results && P.results.g === g ? P.results : null;
  const per = G.price + (P.add && G.addPrice ? G.addPrice : 0);
  let h = `<header class="lt"><div><h1>选号</h1><p>${n ? `${G.name} 第${LT.issueShort(g, n.code)}期 · ${mdw(n.date)} ${G.time} 开奖` : G.name}</p></div></header>${App.gameChips(g, 'pgame')}`;
  h += `<div class="methods">${LT.METHODS.map(m => `<button type="button" class="m-tile" data-act="pmethod" data-m="${m.id}" aria-pressed="${P.method === m.id}">${I[m.id]}${m.name}</button>`).join('')}</div>`;
  h += `<div class="glass card">${methodPanel()}</div>`;
  const lk = lockCard(); if (lk) h += `<div class="glass card">${lk}</div>`;
  h += `<div class="glass card">${optionsCard()}</div><button type="button" class="btn primary big-go" data-act="gen">出号</button>`;
  if (r) {
    const bets = r.lines.reduce((s, L) => s + LT.lineBets(g, L), 0);
    h += `<div class="glass card" id="results"><div class="res-head"><b>${LT.issueShort(g, r.issue)}期</b><span class="small muted">${esc(r.methodName)} · ${bets}注 · ${bets * per}元${r.add ? '（含追加）' : ''}</span></div>
      <ol class="lines">${r.lines.map((L, i) => `<li><span class="idx">${i + 1}</span>${U.lineBalls(g, L, null, G.kind === 'keno' && L.k > 7 ? 'xs' : 'sm')}</li>`).join('')}</ol>
      <div class="row"><button type="button" class="btn primary" data-act="savereal">我买了</button><button type="button" class="btn" data-act="savesim">存为模拟</button>
        <button type="button" class="btn ghost" data-act="copyres">${I.copy.replace('<svg', '<svg class="ico"')}复制</button><button type="button" class="btn ghost" data-act="gen">再出一次</button></div>
      <p class="tiny faint">"我买了"记入实票，计算投入和中奖；"存为模拟"只记录号码，看这组号表现如何。</p></div>`;
  }
  h += '<p class="disclaimer">每期开奖独立随机，以上任何方式的中奖概率都和机选一样。理性购彩，量力而行。</p>';
  return h;
};

App.acts.pgame = (a) => { S.pick.game = a.dataset.g; S.pick.results = null; const G = LT.GAMES[S.pick.game]; if (G.plays && !G.plays.includes(S.pick.play)) S.pick.play = 'zx'; App.savePick(); };
App.acts.pmethod = (a) => { const P = S.pick; P.method = a.dataset.m; const bs = S.profile.birthdays || [];
  if (P.method === 'zodiac' && !P.zodiac && bs[0]) P.zodiac = LT.zodiacOf(bs[0].m, bs[0].d);
  if (P.method === 'wuxing' && !P.wxP && bs[0]) P.wxP = bs[0].id; App.savePick(); };
App.acts.pwin = (a) => { S.pick.win = +a.dataset.w; App.savePick(); };
App.acts.pcount = (a) => { S.pick.count = +a.dataset.c; App.savePick(); };
App.acts.pk = (a) => { S.pick.k = +a.dataset.k; const L = S.pick.lock.kl8; if (L) L.f = L.f.slice(0, S.pick.k - 1); App.savePick(); };
App.acts.pplay = (a) => { S.pick.play = a.dataset.p; App.savePick(); };
App.acts.pavoid = () => { S.pick.avoid = !S.pick.avoid; App.savePick(); };
App.acts.padd = () => { S.pick.add = !S.pick.add; };
App.acts.zod = (a) => { S.pick.zodiac = a.dataset.z; App.savePick(); };
App.acts.lockopen = () => { S.pick.lockOpen = !S.pick.lockOpen; };
App.acts.lockclear = () => { S.pick.lock[S.pick.game] = { f: [], b: [], pos: [] }; };
App.acts.lock = (a) => { const P = S.pick, G = LT.GAMES[P.game], L = P.lock[P.game]; const z = a.dataset.z, n = +a.dataset.n;
  const max = z === 'f' ? (G.kind === 'keno' ? P.k - 1 : G.main.n - 1) : (G.kind === 'qxc' ? 1 : G.sub.n);
  const arr = L[z]; const i = arr.indexOf(n);
  if (i >= 0) arr.splice(i, 1); else if (G.kind === 'qxc' && z === 'b') { L.b = [n]; } else if (arr.length >= max) U.toast(`最多固定 ${max} 个`); else { arr.push(n); arr.sort((x, y) => x - y); }
  U.haptic(); };
App.acts.lockpos = (a) => { const L = S.pick.lock[S.pick.game]; const p = +a.dataset.p, n = +a.dataset.n; L.pos[p] = L.pos[p] === n ? null : n; U.haptic(); };
App.inputs.words = (t) => { S.pick.words = t.value; App.savePick(); return false; };

App.acts.gen = () => {
  const P = S.pick, g = P.game, G = LT.GAMES[g]; const draws = Data.draws[g];
  const n = Data.next(g); if (!n) { U.toast('还没有开奖数据，先到"开奖"页刷新'); return; }
  const bs = S.profile.birthdays || [];
  const o = { method: P.method, draws, avoid: P.avoid, k: P.k, play: G.plays ? P.play : undefined, lock: P.lock[g] || {} };
  if (['hot', 'cold', 'shape'].includes(P.method)) { if (draws.length < 10) { U.toast('历史开奖还没取到'); return; } o.st = stats(g, P.win); }
  if (P.method === 'birthday') { const ps = bs.filter(p => P.selP.includes(p.id)); if (!ps.length) { U.toast(bs.length ? '先点选要用谁的生日' : '先添加一个生日'); return; } o.birthdays = ps; }
  if (P.method === 'zodiac') { if (!P.zodiac) { U.toast('先点选一个星座'); return; } o.zodiac = P.zodiac; }
  if (P.method === 'wuxing') { const p = bs.find(x => x.id === P.wxP); if (!p) { U.toast(bs.length ? '先点选一个人' : '先添加一个生日'); return; } o.bz = LT.bazi(p.y, p.m, p.d, p.h === '' ? null : p.h); }
  if (P.method === 'today') { const [y, m, d] = n.date.split('-').map(Number); o.bz = LT.bazi(y, m, d, null); }
  if (P.method === 'words') { if (!P.words.trim()) { U.toast('先输入一句话'); return; } o.words = P.words.trim(); }
  const lines = LT.generate(g, o, P.count);
  P.results = { g, issue: n.code, method: P.method, methodName: LT.METHODS.find(m => m.id === P.method).name + (G.kind === 'keno' ? '·' + LT.KENO_NAME[P.k] : G.plays && G.plays.length > 1 ? '·' + LT.PLAY_NAME[P.play] : ''), add: !!(P.add && G.addPrice), lines };
  U.haptic(); App.render();
  setTimeout(() => { const el = document.getElementById('results'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40);
  return 'noRender';
};
async function saveResults(kind) {
  const r = S.pick.results; if (!r) return;
  await App.addTicket({ id: App.uid(), game: r.g, issue: r.issue, lines: r.lines, mult: 1, add: r.add, kind, method: r.methodName, createdAt: Date.now() });
  U.toast(kind === 'real' ? '已记入实票，开奖后自动对奖' : '已存为模拟');
}
App.acts.savereal = () => saveResults('real');
App.acts.savesim = () => saveResults('sim');
App.acts.copyres = () => { const r = S.pick.results; if (r) U.copy(`${LT.GAMES[r.g].name} 第${LT.issueShort(r.g, r.issue)}期\n` + r.lines.map(L => U.lineText(r.g, L)).join('\n')); return 'noRender'; };
})();
