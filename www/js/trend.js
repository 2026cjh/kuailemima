/* 快乐密码 · 走势 */
(function () {
'use strict';
const LT = window.LT, U = window.U, App = window.App, S = window.S, HB = window.HB;
const Data = HB.Data;

// 走势图的列：每列 {zone, label, max/min, test(draw) → 是否命中某个值}
function columns(g) {
  const G = LT.GAMES[g]; const cols = [];
  if (G.kind === 'lotto' || G.kind === 'keno') {
    LT.range(G.main.min, G.main.max).forEach((v, i) => cols.push({ z: 0, v, lab: U.pad(v), hit: d => d.n.includes(v), sep: false }));
    if (G.sub) LT.range(G.sub.min, G.sub.max).forEach((v, i) => cols.push({ z: 1, v, lab: U.pad(v), hit: d => d.s.includes(v), b: true, sep: i === 0 }));
    if (G.special) LT.range(G.main.min, G.main.max).forEach((v, i) => cols.push({ z: 1, v, lab: U.pad(v), hit: d => d.s.includes(v), b: true, sep: i === 0 }));
  } else {
    G.posLabels.forEach((lb, p) => LT.range(0, 9).forEach(v => cols.push({ z: p, v, lab: String(v), hit: d => d.n[p] === v, sep: v === 0 && p > 0, b: p % 2 === 1 })));
    if (G.kind === 'qxc') LT.range(0, 14).forEach(v => cols.push({ z: 6, v, lab: String(v), hit: d => d.s[0] === v, sep: v === 0, b: true }));
  }
  return cols;
}
function zoneHeads(g) {
  const G = LT.GAMES[g];
  if (G.kind === 'lotto') return [[G.main.label, G.main.max - G.main.min + 1]].concat(G.sub ? [[G.sub.label, G.sub.max - G.sub.min + 1]] : G.special ? [['特别号', G.main.max]] : []);
  if (G.kind === 'keno') return [['1 – 40', 40], ['41 – 80', 40]];
  return G.posLabels.map(l => [l, 10]).concat(G.kind === 'qxc' ? [['第7位', 15]] : []);
}

function gridHTML(g, win) {
  const all = Data.draws[g]; const rows = all.slice(-win); const cols = columns(g);
  if (!rows.length) return '<div class="empty">还没有开奖数据，先到"开奖"页刷新。</div>';
  // 遗漏：从窗口之前开始数
  const startIdx = all.length - rows.length;
  const miss = cols.map(c => { let k = 0; for (let i = startIdx - 1; i >= 0 && i >= startIdx - 400; i--) { if (c.hit(all[i])) break; k++; } return k; });
  const cnt = cols.map(() => 0), maxMiss = cols.map((_, i) => miss[i]);
  let body = '';
  rows.forEach(d => {
    let tr = `<tr><td class="iss">${LT.issueShort(g, d.code).slice(-3)}</td>`;
    cols.forEach((c, i) => {
      const sep = c.sep ? ' zsep' : '';
      if (c.hit(d)) { cnt[i]++; miss[i] = 0; tr += `<td class="h${c.b ? ' b' : ''}${sep}"><i>${c.lab}</i></td>`; }
      else { miss[i]++; if (miss[i] > maxMiss[i]) maxMiss[i] = miss[i]; tr += `<td class="${sep}">${miss[i]}</td>`; }
    });
    body += tr + '</tr>';
  });
  const zh = zoneHeads(g);
  const head = `<tr class="zone"><th class="iss" rowspan="2">期号</th>${zh.map(([l, n], i) => `<th colspan="${n}" class="${i ? 'zsep' : ''}">${l}</th>`).join('')}</tr>
    <tr>${cols.map(c => `<th class="${c.sep ? 'zsep' : ''}">${c.lab}</th>`).join('')}</tr>`;
  const foot = [['出现次数', cnt], ['当前遗漏', miss], ['最大遗漏', maxMiss]].map(([l, arr]) => `<tr><th class="iss">${l}</th>${arr.map((v, i) => `<td class="${cols[i].sep ? 'zsep' : ''}">${v}</td>`).join('')}</tr>`).join('');
  return `<div class="trend-wrap" id="trendwrap"><table class="trend"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
    <p class="tiny faint">红球格是当期开出的号码，灰色数字是到这一期为止连续多少期没开出（遗漏）。左右滑动看全部号码。</p>`;
}

function heatHTML(g, win) {
  const G = LT.GAMES[g]; const st = App.stats(g, win); const freq = S.trend.heat !== 'miss';
  const tiles = (vals, b, digit) => { const vs = Object.values(vals); const hi = Math.max(...vs), lo = Math.min(...vs);
    return `<div class="heat">${Object.keys(vals).map(Number).map(n => { const k = hi === lo ? 0 : (vals[n] - lo) / (hi - lo);
      return `<div class="hc ${b ? 'b' : ''} ${k > 0.55 ? 'hot' : ''}" style="--k:${k.toFixed(2)}"><span class="n">${digit ? n : U.pad(n)}</span><span class="v">${vals[n]}${freq ? '次' : '期'}</span></div>`; }).join('')}</div>`; };
  let h = `<div class="seg"><button type="button" data-act="theat" data-v="freq" aria-pressed="${freq}">出现次数</button><button type="button" data-act="theat" data-v="miss" aria-pressed="${!freq}">当前遗漏</button></div>`;
  if (G.kind === 'lotto' || G.kind === 'keno') {
    h += `<div class="sec-title" style="padding:0">${G.main.label}</div>${tiles(freq ? st.ff : st.fm)}`;
    if (G.sub) h += `<div class="sec-title" style="padding:0">${G.sub.label}</div>${tiles(freq ? st.bf : st.bm, true)}`;
  } else {
    const P = Math.min(S.trend.pos, G.posLabels.length - (G.kind === 'qxc' ? 0 : 1));
    const labs = G.posLabels.concat(G.kind === 'qxc' ? ['第7位'] : []);
    h += `<div class="games" style="margin:0;padding:0 0 4px">${labs.map((l, i) => `<button type="button" class="chip" data-act="tpos" data-p="${i}" aria-pressed="${P === i}">${l}</button>`).join('')}</div>`;
    h += tiles(freq ? st.pf[P] : st.pm[P], P === 6, true);
  }
  return h + `<div class="legend"><span>${freq ? `近 ${win} 期出现次数` : '距今多少期没开出'}</span><span>颜色越深数值越大</span></div>`;
}

App.pages.trend = () => {
  const T = S.trend, g = T.game, G = LT.GAMES[g];
  let h = `<header class="lt"><div><h1>走势</h1><p>${G.name} · 共收录 ${Data.draws[g].length} 期</p></div></header>${App.gameChips(g, 'tgame')}
    <div class="row between"><div class="seg" style="flex:1;min-width:180px"><button type="button" data-act="tmode" data-v="grid" aria-pressed="${T.mode === 'grid'}">走势图</button><button type="button" data-act="tmode" data-v="heat" aria-pressed="${T.mode === 'heat'}">冷热</button></div>
    <div class="row">${[30, 50, 100].map(w => `<button type="button" class="chip" data-act="twin" data-w="${w}" aria-pressed="${T.win === w}">${w}期</button>`).join('')}</div></div>`;
  h += `<div class="glass card">${T.mode === 'grid' ? gridHTML(g, T.win) : heatHTML(g, T.win)}</div>`;
  h += '<p class="disclaimer">历史走势只是过去的记录，不能预测下一期。</p>';
  return h;
};
App.acts.tgame = (a) => { S.trend.game = a.dataset.g; S.trend.pos = 0; App.saveTrend(); };
App.acts.tmode = (a) => { S.trend.mode = a.dataset.v; App.saveTrend(); };
App.acts.twin = (a) => { S.trend.win = +a.dataset.w; App.saveTrend(); };
App.acts.theat = (a) => { S.trend.heat = a.dataset.v; App.saveTrend(); };
App.acts.tpos = (a) => { S.trend.pos = +a.dataset.p; };
// 走势图默认滚到最新一期
const obs = new MutationObserver(() => { const w = document.getElementById('trendwrap'); if (w && !w.dataset.scrolled) { w.dataset.scrolled = '1'; w.scrollTop = w.scrollHeight; } });
obs.observe(document.documentElement, { childList: true, subtree: true });
})();
