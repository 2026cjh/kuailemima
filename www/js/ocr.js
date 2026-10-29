/* 快乐密码 · 彩票票面文字解析
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
    .replace(/　/g, ' ')
    // 号码中间的"+"常被认成"十"
    .replace(/(\d)\s*十\s*(?=\d)/g, '$1 + ');
}
// 票面上的彩种名字（logo 是艺术字时常认不全，所以也认半截）
function detectGame(t) {
  const s = String(t).replace(/\s+/g, '');
  if (/双色球|双色|色球/.test(s)) return 'ssq';
  if (/大乐透|乐透|大乐|超级大/.test(s)) return 'dlt';
  if (/七乐彩|七乐/.test(s)) return 'qlc';
  if (/快乐(8|八|B)/i.test(s)) return 'kl8';
  if (/排列(5|五)/.test(s)) return 'pl5';
  if (/排列(3|三)/.test(s)) return 'pl3';
  if (/(七|7)星彩|七星/.test(s)) return 'qxc';
  if (/3D|福彩(3|三)/i.test(s)) return 'fc3d';
  return null;
}
// 票面金额，用来和识别出的注数、倍数核对
function detectAmount(t) { const m = /(?:金\s*额|合\s*计|总\s*金\s*额)\s*[:]?\s*(\d+(?:\.\d+)?)\s*元/.exec(t); return m ? +m[1] : null; }
// 票面上印的开奖日期，如"2026年10月31日开奖""开奖日期:2026-10-31""26/10/31开奖"
function detectDrawDate(t) {
  const D = '(20\\d{2}|\\d{2})\\s*[-/年.]\\s*(\\d{1,2})\\s*[-/月.]\\s*(\\d{1,2})\\s*日?';
  const m = new RegExp(D + '\\s*开奖').exec(t) || new RegExp('开奖\\s*(?:日期|时间)?\\s*[:]?\\s*' + D).exec(t);
  if (!m) return '';
  const y = m[1].length === 2 ? '20' + m[1] : m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
}
function detectIssue(t) {
  const m = /开\s*奖\s*期\s*号?\s*[:]?\s*(\d{5,7})/.exec(t) || /第\s*(\d{5,7})\s*期/.exec(t) || /期\s*号?\s*[:]?\s*(\d{5,7})/.exec(t) || /(\d{5,7})\s*期/.exec(t);
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
// 序号①常被认成"1""0"之类：开头一个单独数字、后面都是两位数时去掉
const dropLead = (s) => { const t = s.trim().split(/\s+/); return t.length >= 3 && /^\d$/.test(t[0]) && t.slice(1).every(x => /^\d{2}/.test(x) || /^[+|\-]$/.test(x)) ? t.slice(1).join(' ') : s; };
const stripMark0 = (s) => s.replace(/^[\s①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]+/, '').replace(/^\s*[A-Ea-e(（]?\s*\d?\s*[)）.:：]\s*/, '').replace(/^\s*\(\s*\d+\s*\)\s*/, '');
const stripMark = (s) => dropLead(stripMark0(s));

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
      if (t.length >= 7 && t.slice(0, 6).every(r => r.length === 1)) { front = t.slice(0, 6).map(Number); back = t[6]; } else { const ds = all.replace(/\s/g, ''); if (ds.length === 7 || ds.length === 8) { front = digits1(ds.slice(0, 6)); back = ds.slice(6); } } }
    if (front && front.length === 6 && back != null && +back <= 14) out.push({ pos: front.map(x => [x]), b: [+back] });
    else if ((s.match(/\d/g) || []).length >= 6) notes.push(raw.trim()); });
  return out;
}

/* 票面上没有彩种名字时，看号码的样子和"体彩/福彩"字样来判断 */
const ascOK = (a) => a.every((x, i) => i === 0 || x > a[i - 1]);
function lottoScore(g, ls) {
  const G = LT.GAMES[g]; let sc = 0;
  const inF = (x) => x >= G.main.min && x <= G.main.max, inB = (x) => !!G.sub && x >= G.sub.min && x <= G.sub.max;
  ls.forEach(s => {
    const n = nums2(s); if (n.length < G.main.n) return;
    const sep = s.search(/[+|]/);
    if (G.sub) {
      let f, b;
      if (sep > 0) { f = nums2(s.slice(0, sep)); b = nums2(s.slice(sep)); }
      else if (n.length === G.main.n + G.sub.n) { f = n.slice(0, G.main.n); b = n.slice(G.main.n); }
      else return;
      if (f.length < G.main.n || b.length < G.sub.n || !f.every(inF) || !b.every(inB)) return;
      sc += ascOK(f) && ascOK(b) ? 2 : 1;   // 票上同一区的号码是从小到大印的
    } else {
      if (sep > 0 || n.length > 15 || !n.every(inF)) return;
      sc += ascOK(n) ? 2 : 1;
    }
  });
  return sc;
}
const digitLines = (ls, len) => ls.filter(s => { const runs = s.match(/\d+/g) || []; const d = runs.join('').length;
  return d === len && runs.every(r => r.length === 1 || r.length === len); }).length;
function inferGame(t, lines) {
  const s = t.replace(/\s+/g, '');
  const tc = /体育|体彩|前区|后区|追加/.test(s), fc = /福利|福彩|红球|蓝球|红胆|蓝胆/.test(s);
  if (!tc && /选(十|[一二三四五六七八九]|10|[1-9])/.test(s) && parseKeno(lines, t, []).length) return { game: 'kl8', sure: true };
  const ls = lines.map(stripMark).filter(x => x.trim() && !isMeta(x));
  const bonus = (g) => (tc && /^(dlt|qxc|pl5|pl3)$/.test(g)) || (fc && /^(ssq|qlc|fc3d)$/.test(g)) ? 3 : 0;
  const cand = [['ssq', lottoScore('ssq', ls)], ['dlt', lottoScore('dlt', ls)], ['qlc', lottoScore('qlc', ls)],
    ['qxc', parseQxc(lines, []).length * 2], ['pl5', digitLines(ls, 5) * 2]].filter(c => c[1] > 0).map(c => [c[0], c[1] + bonus(c[0])]);
  const d3 = digitLines(ls, 3) * 2;
  if (d3 > 0) { if (tc && !fc) cand.push(['pl3', d3 + 3]); else if (fc && !tc) cand.push(['fc3d', d3 + 3]); else cand.push(['', d3]); }
  if (!cand.length) return null;
  cand.sort((a, b) => b[1] - a[1]);
  if (!cand[0][0] || (cand[1] && cand[1][1] === cand[0][1])) return null;   // 分不出来，让用户选
  return { game: cand[0][0], sure: bonus(cand[0][0]) > 0 };
}

// forceGame：用户在页面上点了彩种，按这个彩种重新读
function parseTicket(text, forceGame) {
  const t = normalize(text); const lines = t.split(/\n+/).map(s => s.trim()).filter(Boolean);
  let game = forceGame || detectGame(t), how = forceGame ? 'user' : game ? 'name' : '';
  if (!game) { const inf = inferGame(t, lines); if (inf) { game = inf.game; how = inf.sure ? 'hint' : 'guess'; } }
  const notes = [];
  if (!game) return { ok: false, needGame: true, msg: '没认出是哪种彩票。请在下面点一下彩种，我按这个彩种重新读号码。', raw: t };
  const G = LT.GAMES[game];
  const issue = detectIssue(t), drawDate = detectDrawDate(t), amount = detectAmount(t);
  let mm = null; for (const ln of lines) { mm = /倍\s*数?\s*[:]?[ \t]*(\d{1,2})(?!\d)/.exec(ln) || /(?:^|[^\d])(\d{1,2})[ \t]*倍/.exec(ln); if (mm) break; }
  const mult = Math.min(99, Math.max(1, mm ? +mm[1] : 1));
  const add = game === 'dlt' && /追加/.test(t);
  let out = [];
  if (G.kind === 'lotto') out = parseLotto(game, lines, notes);
  else if (G.kind === 'keno') out = parseKeno(lines, t, notes);
  else if (G.kind === 'digit') out = parseDigit(game, lines, t, notes);
  else if (G.kind === 'qxc') out = parseQxc(lines, notes);
  out = out.filter(L => LT.lineBets(game, L) > 0);
  if (!out.length) return { ok: false, game, how, issue, drawDate, amount, mult, add, msg: `按${G.name}没读出号码。换一张更清楚、正对着拍的照片；如果彩种不对，点下面的彩种重新读；也可以手动输入。`, raw: t };
  return { ok: true, game, how, issue, drawDate, amount, mult, add, lines: out, notes, raw: t };
}

const API = { parseTicket, normalize, detectGame, inferGame, detectIssue, detectDrawDate, detectAmount, nums2 };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.OCR = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
