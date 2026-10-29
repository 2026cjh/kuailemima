/* 红蓝 · 彩票票面文字解析
 * 输入：手机文字识别（ML Kit）读出的票面文字；输出：彩种、期号、倍数、追加和每一注号码。
 * 识别难免有错，结果一律先给用户核对再保存。 */
(function (root) {
'use strict';
const LT = root.LT || (typeof require !== 'undefined' ? require('./games.js') : null);
const CN_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };

function normalize(t) {
  return String(t || '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[＋]/g, '+').replace(/[－—–]/g, '-')
    .replace(/[：]/g, ':').replace(/[｜]/g, '|').replace(/[，、]/g, ' ')
    .replace(/(\d)[Oo]|[Oo](\d)/g, (m, a, b) => a != null ? a + '0' : '0' + b)
    .replace(/　/g, ' ');
}
function detectGame(t) {
  if (/双色球/.test(t)) return 'ssq';
  if (/大乐透/.test(t)) return 'dlt';
  if (/七乐彩/.test(t)) return 'qlc';
  if (/快乐\s*(8|八)/i.test(t)) return 'kl8';
  if (/排列\s*(5|五)/.test(t)) return 'pl5';
  if (/排列\s*(3|三)/.test(t)) return 'pl3';
  if (/(七|7)\s*星彩/.test(t)) return 'qxc';
  if (/3\s*D/i.test(t)) return 'fc3d';
  return null;
}
function detectIssue(t) {
  const m = /第\s*(\d{5,7})\s*期/.exec(t) || /期\s*号?\s*[:]?\s*(\d{5,7})/.exec(t) || /(\d{5,7})\s*期/.exec(t);
  if (!m) return '';
  let c = m[1]; if (c.length === 5) c = '20' + c; else if (c.length === 6) c = '20' + c.slice(1);
  return /^20\d{5}$/.test(c) ? c : '';
}
// 一行里的号码：两位数格式（双色球、大乐透、快乐8等）
function nums2(s) {
  const out = [];
  (s.match(/\d+/g) || []).forEach(run => { if (run.length <= 2) out.push(+run); else if (run.length % 2 === 0) for (let i = 0; i < run.length; i += 2) out.push(+run.slice(i, i + 2)); });
  return out;
}
const digits1 = (s) => (s.match(/\d/g) || []).map(Number);
const isMeta = (s) => /期|倍|元|合计|金额|时间|日期|开奖|站|地址|销售|编号|序列|\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}|\d{1,2}:\d{2}/.test(s);
const stripMark = (s) => s.replace(/^[\s①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]+/, '').replace(/^\s*[A-Ea-e(（]?\s*\d?\s*[)）.:：]\s*/, '').replace(/^\s*\(\s*\d+\s*\)\s*/, '');

function parseLotto(g, lines, notes) {
  const G = LT.GAMES[g]; const out = []; let cur = null;
  const okF = (a) => a.every(x => x >= G.main.min && x <= G.main.max), okB = (a) => !G.sub || a.every(x => x >= G.sub.min && x <= G.sub.max);
  const flush = () => { if (cur && LT.lineBets(g, cur) > 0 && okF(cur.f.concat(cur.fd)) && okB(cur.b.concat(cur.bd))) out.push(cur); cur = null; };
  const want = () => cur || (cur = { fd: [], f: [], bd: [], b: [] });
  lines.forEach(raw => {
    const s = stripMark(raw); if (!s.trim()) return;
    const lab = /(红|前)\s*(区|球)?\s*胆|胆\s*码/.test(s) ? 'fd' : /(红|前)\s*(区|球)?\s*拖|拖\s*码/.test(s) ? 'f' : /(蓝|后)\s*(区|球)?\s*胆/.test(s) ? 'bd' : /(蓝|后)\s*(区|球)?\s*拖/.test(s) ? 'b'
      : /^(红球|前区|红色球)/.test(s.trim()) ? 'f' : /^(蓝球|后区|蓝色球)/.test(s.trim()) ? 'b' : '';
    if (lab) { const n = nums2(s.replace(/^[^\d]*/, '')); if (!n.length) return; want()[lab] = want()[lab].concat(n);
      if ((lab === 'b' || lab === 'bd') && (!G.sub || cur.b.length + cur.bd.length >= G.sub.n) && cur.f.length + cur.fd.length >= G.main.n) flush(); return; }
    if (isMeta(s)) return;
    const n = nums2(s); if (n.length < G.main.n) return;
    const sep = s.search(/[+|\-]|蓝|后/);
    let f, b;
    if (G.sub && sep > 0) { f = nums2(s.slice(0, sep)); b = nums2(s.slice(sep)); }
    else if (G.sub && n.length === G.main.n + G.sub.n) { f = n.slice(0, G.main.n); b = n.slice(G.main.n); }
    else if (!G.sub && n.length >= G.main.n) { f = n; b = []; }
    else { notes.push(raw.trim()); return; }
    flush(); cur = { fd: [], f: LT.uniq(f), bd: [], b: LT.uniq(b) }; flush();
  });
  flush();
  return out.map(L => ({ fd: LT.asc(L.fd), f: LT.asc(L.f.filter(x => !L.fd.includes(x))), bd: LT.asc(L.bd), b: LT.asc(L.b.filter(x => !L.bd.includes(x))) }))
    .map(L => G.sub ? L : { fd: L.fd, f: L.f });
}
function parseKeno(lines, text, notes) {
  const m = /选\s*(十|[一二三四五六七八九]|10|[1-9])/.exec(text); const k = m ? (CN_NUM[m[1]] || +m[1]) : 0;
  const out = [];
  lines.forEach(raw => { const s = stripMark(raw); if (isMeta(s)) return; const n = LT.uniq(nums2(s.replace(/选\s*(十|[一二三四五六七八九]|10|[1-9])/, ''))).filter(x => x >= 1 && x <= 80);
    if (!n.length) return; const kk = k || n.length; if (n.length >= kk && kk <= 10) out.push({ k: kk, fd: [], f: LT.asc(n) }); else notes.push(raw.trim()); });
  return out;
}
function parseDigit(g, lines, text, notes) {
  const G = LT.GAMES[g];
  const play = /组\s*选?\s*(3|三)|组三/.test(text) ? 'z3' : /组\s*选?\s*(6|六)|组六/.test(text) ? 'z6' : 'zx';
  const out = []; const pos = [];
  lines.forEach(raw => { const s = stripMark(raw);
    const pl = G.posLabels.findIndex(l => s.includes(l)); if (pl >= 0) { pos[pl] = LT.uniq(digits1(s.replace(G.posLabels[pl], ''))); return; }
    if (isMeta(s) || /选|组|直/.test(s) && !/\d/.test(s)) return;
    const d = digits1(s.replace(/(直选|单选|组选|组三|组六|3D|排列[35三五])/g, ''));
    if (play === 'zx' && d.length === G.len) out.push({ play, pos: d.map(x => [x]) });
    else if (play === 'z3' && d.length === 3 && LT.uniq(d).length === 2) out.push({ play, d: LT.asc(d) });
    else if (play === 'z3' && d.length >= 2 && LT.uniq(d).length === d.length) out.push({ play, f: LT.asc(d) });
    else if (play === 'z6' && d.length >= 3 && LT.uniq(d).length === d.length) out.push({ play, f: LT.asc(d) });
    else if (d.length) notes.push(raw.trim()); });
  if (pos.filter(Boolean).length === G.len) out.unshift({ play: 'zx', pos: pos.map(a => a && a.length ? a : [0]) });
  return out;
}
function parseQxc(lines, notes) {
  const out = [];
  lines.forEach(raw => { const s = stripMark(raw); if (isMeta(s)) return;
    const sep = s.search(/[+|\-]/); let front, back;
    if (sep > 0) { front = digits1(s.slice(0, sep)); back = (s.slice(sep).match(/\d{1,2}/) || [])[0]; }
    else { const t = s.match(/\d+/g) || []; const all = t.join(' ');
      if (t.length >= 7) { front = t.slice(0, 6).map(Number); back = t[6]; } else { const ds = all.replace(/\s/g, ''); if (ds.length === 7 || ds.length === 8) { front = digits1(ds.slice(0, 6)); back = ds.slice(6); } } }
    if (front && front.length === 6 && back != null && +back <= 14) out.push({ pos: front.map(x => [x]), b: [+back] });
    else if ((s.match(/\d/g) || []).length >= 6) notes.push(raw.trim()); });
  return out;
}

function parseTicket(text, preferGame) {
  const t = normalize(text); const lines = t.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const game = detectGame(t) || preferGame || null; const notes = [];
  if (!game) return { ok: false, msg: '没认出是哪种彩票。可以在下面选好彩种后手动输入。', raw: t };
  const G = LT.GAMES[game];
  const issue = detectIssue(t);
  let mm = null; for (const ln of lines) { mm = /倍\s*数?\s*[:]?[ \t]*(\d{1,2})(?!\d)/.exec(ln) || /(?:^|[^\d])(\d{1,2})[ \t]*倍/.exec(ln); if (mm) break; }
  const mult = Math.min(99, Math.max(1, mm ? +mm[1] : 1));
  const add = game === 'dlt' && /追加/.test(t);
  let out = [];
  if (G.kind === 'lotto') out = parseLotto(game, lines, notes);
  else if (G.kind === 'keno') out = parseKeno(lines, t, notes);
  else if (G.kind === 'digit') out = parseDigit(game, lines, t, notes);
  else if (G.kind === 'qxc') out = parseQxc(lines, notes);
  out = out.filter(L => LT.lineBets(game, L) > 0);
  if (!out.length) return { ok: false, game, issue, mult, add, msg: '认出了彩种，但号码读不全。换一张更清楚、正对着拍的照片，或者手动输入。', raw: t };
  return { ok: true, game, issue, mult, add, lines: out, notes, raw: t };
}

const API = { parseTicket, normalize, detectGame, detectIssue, nums2 };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.OCR = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
