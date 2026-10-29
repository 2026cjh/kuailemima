/* 快乐密码 · 彩种规则与选号算法
 * 纯函数，不依赖页面。App、后台对奖脚本和单元测试共用这一份。
 * 奖级按 2026 年 2 月起执行的新规则（双色球福运奖、大乐透 8 亿加奖、一等奖封顶 1 亿）。
 */
(function (root) {
'use strict';

/* ---------------- 彩种定义 ---------------- */
// days: JS getDay()，0 = 周日
const GAMES = {
  ssq:  { key:'ssq',  name:'双色球', org:'福彩', kind:'lotto', main:{n:6,min:1,max:33,label:'红球'}, sub:{n:1,min:1,max:16,label:'蓝球'},
          price:2, days:[0,2,4], time:'21:15', src:{type:'cwl',name:'ssq'}, floating:true },
  dlt:  { key:'dlt',  name:'大乐透', org:'体彩', kind:'lotto', main:{n:5,min:1,max:35,label:'前区'}, sub:{n:2,min:1,max:12,label:'后区'},
          price:2, addPrice:1, days:[1,3,6], time:'21:25', src:{type:'tc',no:'85'}, floating:true },
  fc3d: { key:'fc3d', name:'福彩3D', org:'福彩', kind:'digit', len:3, posLabels:['百位','十位','个位'], plays:['zx','z3','z6'],
          price:2, days:[0,1,2,3,4,5,6], time:'21:15', src:{type:'cwl',name:'3d'} },
  kl8:  { key:'kl8',  name:'快乐8', org:'福彩', kind:'keno', main:{n:20,min:1,max:80,label:'号码'}, picks:[1,2,3,4,5,6,7,8,9,10],
          price:2, days:[0,1,2,3,4,5,6], time:'21:30', src:{type:'cwl',name:'kl8'} },
  qlc:  { key:'qlc',  name:'七乐彩', org:'福彩', kind:'lotto', main:{n:7,min:1,max:30,label:'号码'}, sub:null, special:{label:'特别号'},
          price:2, days:[1,3,5], time:'21:15', src:{type:'cwl',name:'qlc'}, floating:true },
  pl3:  { key:'pl3',  name:'排列3', org:'体彩', kind:'digit', len:3, posLabels:['百位','十位','个位'], plays:['zx','z3','z6'],
          price:2, days:[0,1,2,3,4,5,6], time:'21:25', src:{type:'tc',no:'35'} },
  pl5:  { key:'pl5',  name:'排列5', org:'体彩', kind:'digit', len:5, posLabels:['万位','千位','百位','十位','个位'], plays:['zx'],
          price:2, days:[0,1,2,3,4,5,6], time:'21:25', src:{type:'tc',no:'350133'} },
  qxc:  { key:'qxc',  name:'七星彩', org:'体彩', kind:'qxc', len:6, posLabels:['第1位','第2位','第3位','第4位','第5位','第6位'],
          back:{min:0,max:14,label:'第7位'}, price:2, days:[0,2,5], time:'21:25', src:{type:'tc',no:'04'}, floating:true }
};
const ORDER = ['ssq','dlt','fc3d','kl8','qlc','pl3','pl5','qxc'];
const PLAY_NAME = { zx:'直选', z3:'组选3', z6:'组选6' };
const KENO_NAME = ['', '选一','选二','选三','选四','选五','选六','选七','选八','选九','选十'];

/* ---------------- 小工具 ---------------- */
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const asc = (a) => [...a].sort((x, y) => x - y);
const uniq = (a) => [...new Set(a)];
function nCk(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
function cryptoRand() {
  try { const a = new Uint32Array(1); root.crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
}
function seededRand(seedStr) { // xmur3 + mulberry32
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); let a = (h ^= h >>> 16) >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function pickFrom(pool, k, rand, exclude) {
  const p = pool.filter(x => !(exclude && exclude.includes(x))); const out = [];
  while (out.length < k && p.length) out.push(p.splice(Math.floor(rand() * p.length), 1)[0]);
  return out;
}
function weightedPick(weights, k, rand, exclude) { // weights: Map-like {num: w}
  const items = Object.entries(weights).map(([n, w]) => [+n, Math.max(+w, 0.0001)]).filter(([n]) => !(exclude && exclude.includes(n)));
  const out = [];
  while (out.length < k && items.length) {
    const tot = items.reduce((s, x) => s + x[1], 0); let r = rand() * tot, i = 0;
    for (; i < items.length - 1; i++) { r -= items[i][1]; if (r <= 0) break; }
    out.push(items.splice(i, 1)[0][0]);
  }
  return out;
}
const pad2 = (n) => String(n).padStart(2, '0');
function fmtMoney(v) { if (v == null) return ''; if (Number.isInteger(v)) return v >= 10000 ? v.toLocaleString('en-US') : String(v); return v.toFixed(1); }

/* ---------------- 五行 / 八字 / 星座 ---------------- */
const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const STEM_WX = '木木火火土土金金水水', BRANCH_WX = '水土木木土火火土金金土水';
const WX = ['木','火','土','金','水'];
const SHENG_BY = { 火:'木', 土:'火', 金:'土', 水:'金', 木:'水' };   // 谁生我
const HETU = { 水:[1,6], 火:[2,7], 木:[3,8], 金:[4,9], 土:[5,0] };   // 河图数：尾数归五行
const JIE = [6,4,6,5,6,6,7,8,8,8,7,7];                              // 每月"节"的常年日期
function wxOfNumber(n) { const t = n % 10; return WX.find(w => HETU[w].includes(t)); }
function jdn(y, m, d) { const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045; }
const ganzhi = (i) => STEMS[i % 10] + BRANCHES[i % 12];
function bazi(y, m, d, hour) {
  const yy = (m < 2 || (m === 2 && d < JIE[1])) ? y - 1 : y;
  const yIdx = ((yy - 4) % 60 + 60) % 60;
  const branchAfter = [1,2,3,4,5,6,7,8,9,10,11,0];
  const mb = d >= JIE[m - 1] ? branchAfter[m - 1] : branchAfter[(m + 10) % 12];
  const off = (mb - 2 + 12) % 12, mStem = ((yIdx % 10) % 5 * 2 + 2 + off) % 10;
  const dIdx = ((jdn(y, m, d) + 49) % 60 + 60) % 60;
  const pillars = [ganzhi(yIdx), STEMS[mStem] + BRANCHES[mb], ganzhi(dIdx)];
  if (hour != null && hour !== '') { const hb = Math.floor((+hour + 1) / 2) % 12; const hs = ((dIdx % 10) % 5 * 2 + hb) % 10; pillars.push(STEMS[hs] + BRANCHES[hb]); }
  const count = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  pillars.forEach(p => { count[STEM_WX[STEMS.indexOf(p[0])]]++; count[BRANCH_WX[BRANCHES.indexOf(p[1])]]++; });
  const min = Math.min(...Object.values(count));
  return { pillars, count, weak: WX.filter(w => count[w] === min), dayMaster: STEM_WX[dIdx % 10] };
}
const ZODIAC = [ // 名称, 起始(月,日), 守护星数
  ['摩羯座',[12,22],8],['水瓶座',[1,20],4],['双鱼座',[2,19],7],['白羊座',[3,21],9],['金牛座',[4,20],6],['双子座',[5,21],5],
  ['巨蟹座',[6,22],2],['狮子座',[7,23],1],['处女座',[8,23],5],['天秤座',[9,23],6],['天蝎座',[10,24],9],['射手座',[11,22],3]];
const ZODIAC_ORDER = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
function zodiacOf(m, d) {
  if ((m === 12 && d >= 22) || (m === 1 && d < 20)) return '摩羯座';
  let z = ZODIAC[0]; for (const zz of ZODIAC) { const [zm, zd] = zz[1]; if (m > zm || (m === zm && d >= zd)) z = zz; }
  return z[0];
}
function zodiacNumbers(name, max) {
  const z = ZODIAC.find(x => x[0] === name); const ord = ZODIAC_ORDER.indexOf(name) + 1, p = z ? z[2] : 1;
  return uniq([ord, ord + 12, ord + 24, ord + 36, ord + 48, ord + 60, p, p + 9, p + 18, p + 27, p + 36, p + 45, p + 54, p + 63].filter(n => n >= 1 && n <= max));
}
function birthdayNumbers(list, max) {
  const out = [];
  list.forEach(({ y, m, d }) => { [d, m, m + d, y % 100, d + m * 2, (d % 10) + (m % 10) + (y % 10), d * 2, m * 10 + (d % 10)].forEach(n => { if (n >= 1 && n <= max) out.push(n); }); });
  return uniq(out);
}
function birthdayDigits(list) {
  const out = [];
  list.forEach(({ y, m, d }) => (String(y) + pad2(m) + pad2(d)).split('').forEach(c => out.push(+c)));
  return out; // 保留重复：出现越多越容易被选
}

/* ---------------- 期号推算 ---------------- */
function bjNow(now) { return new Date((now ? now.getTime() : Date.now()) + 8 * 3600e3); } // 用 UTC 字段读北京时间
function ymd(d) { return d.toISOString().slice(0, 10); }
function drawMinutes(g) { const [h, m] = GAMES[g].time.split(':').map(Number); return h * 60 + m; }
// 当前还能买的那一期（开奖前 20:00 停售）
function nextIssue(g, draws, now) {
  const G = GAMES[g]; const last = draws[draws.length - 1]; if (!last) return null;
  const bj = bjNow(now); const today = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  const open = bj.getUTCHours() < 20;
  let d = Date.UTC(+last.date.slice(0, 4), +last.date.slice(5, 7) - 1, +last.date.slice(8, 10));
  let year = +last.code.slice(0, 4), num = +last.code.slice(4);
  for (let i = 0; i < 800; i++) {
    d += 86400e3; const dd = new Date(d);
    if (!G.days.includes(dd.getUTCDay())) continue;
    if (dd.getUTCFullYear() !== year) { year = dd.getUTCFullYear(); num = 0; }
    num++;
    if (d > today || (d === today && open)) return { code: year + String(num).padStart(3, '0'), date: ymd(dd) };
  }
  return null;
}
// 最近一次已经开过奖（开奖后 20 分钟）的日期，用来判断要不要去取新数据
// 某一期的开奖日期：已开奖的直接查，没开奖的按开奖日往后推（春节休市等会有偏差，票面印的日期优先）
function issueDate(g, code, draws) {
  const hit = (draws || []).find(x => x.code === code); if (hit) return hit.date;
  const G = GAMES[g]; const last = draws && draws[draws.length - 1];
  if (!last || !/^\d{7}$/.test(code) || code <= last.code) return null;
  let d = Date.UTC(+last.date.slice(0, 4), +last.date.slice(5, 7) - 1, +last.date.slice(8, 10));
  let year = +last.code.slice(0, 4), num = +last.code.slice(4);
  for (let i = 0; i < 800; i++) {
    d += 86400e3; const dd = new Date(d);
    if (!G.days.includes(dd.getUTCDay())) continue;
    if (dd.getUTCFullYear() !== year) { year = dd.getUTCFullYear(); num = 0; }
    num++; const c = year + String(num).padStart(3, '0');
    if (c === code) return ymd(dd); if (c > code) return null;
  }
  return null;
}
function lastDueDate(g, now) {
  const G = GAMES[g]; const bj = bjNow(now); const mins = bj.getUTCHours() * 60 + bj.getUTCMinutes();
  let d = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  if (mins < drawMinutes(g) + 20) d -= 86400e3;
  for (let i = 0; i < 8; i++) { if (G.days.includes(new Date(d).getUTCDay())) return ymd(new Date(d)); d -= 86400e3; }
  return null;
}
function drawsToday(now) { const bj = bjNow(now); const w = bj.getUTCDay(); return ORDER.filter(g => GAMES[g].days.includes(w)); }
function issueShort(g, code) { return GAMES[g].src.type === 'tc' ? code.slice(2) : code; }

/* ---------------- 投注行：校验、注数、展开 ---------------- */
// lotto: {fd,f,bd,b}  keno: {k,fd,f}  digit: {play:'zx',pos:[[..]..]} | {play:'z3'|'z6', f:[..]} | {play:'z3', d:[a,a,b]}  qxc: {pos:[[..]x6], b:[..]}
function lineBets(g, L) {
  const G = GAMES[g];
  if (G.kind === 'lotto') {
    const fd = L.fd || [], bd = L.bd || [];
    const m = nCk((L.f || []).length, G.main.n - fd.length);
    const s = G.sub ? nCk((L.b || []).length, G.sub.n - bd.length) : 1;
    return m * s;
  }
  if (G.kind === 'keno') return nCk((L.f || []).length, (L.k || 0) - (L.fd || []).length);
  if (G.kind === 'digit') {
    if (L.play === 'zx') return (L.pos || []).length === G.len ? L.pos.reduce((p, a) => p * a.length, 1) : 0;
    if (L.play === 'z3') { if (L.d) return 1; const n = (L.f || []).length; return n >= 2 ? n * (n - 1) : 0; }
    if (L.play === 'z6') return nCk((L.f || []).length, 3);
    return 0;
  }
  if (G.kind === 'qxc') return (L.pos || []).length === 6 ? L.pos.reduce((p, a) => p * a.length, 1) * (L.b || []).length : 0;
  return 0;
}
function lineIssues(g, L) { // 返回问题描述，空字符串表示可以用
  const G = GAMES[g]; const n = lineBets(g, L);
  if (G.kind === 'lotto') {
    if ((L.fd || []).length >= G.main.n) return `${G.main.label}胆码最多 ${G.main.n - 1} 个`;
    if (G.sub && (L.bd || []).length >= G.sub.n && G.sub.n > 1) return `${G.sub.label}胆码最多 ${G.sub.n - 1} 个`;
    if (!n) return `${G.main.label}至少 ${G.main.n} 个` + (G.sub ? `，${G.sub.label}至少 ${G.sub.n} 个` : '');
  }
  if (G.kind === 'keno') { if (!L.k) return '先选玩法（选一到选十）'; if (!n) return `至少选 ${L.k} 个号码`; }
  if (G.kind === 'digit' && !n) return L.play === 'zx' ? '每一位至少选 1 个数字' : L.play === 'z3' ? '组选3 至少选 2 个数字' : '组选6 至少选 3 个数字';
  if (G.kind === 'qxc' && !n) return '前 6 位每位至少 1 个数字，第 7 位至少 1 个';
  return '';
}
function ticketBets(t) { return t.lines.reduce((s, L) => s + lineBets(t.game, L), 0); }
function ticketCost(t) { const G = GAMES[t.game]; return ticketBets(t) * (t.mult || 1) * (G.price + (t.add && G.addPrice ? G.addPrice : 0)); }

/* ---------------- 奖级 ---------------- */
const KENO_TABLE = { // 快乐8：选 k 中 h → 单注奖金（'F' 为浮动奖）
  1:{1:4.5}, 2:{2:19}, 3:{3:52,2:3}, 4:{4:93,3:5,2:3}, 5:{5:1000,4:20,3:3}, 6:{6:2880,5:30,4:10,3:3},
  7:{7:8500,6:300,5:30,4:4,0:2}, 8:{8:50000,7:800,6:80,5:10,4:3,0:2},
  9:{9:'F',8:2000,7:225,6:22,5:5,4:3,0:2}, 10:{10:'F',9:8000,8:720,7:80,6:5,5:3,0:2}
};
const DIGIT_PRIZE = { fc3d:{zx:1040,z3:346,z6:173}, pl3:{zx:1040,z3:346,z6:173}, pl5:{zx:100000} };
const LEVEL_ORDER = ['一等奖','二等奖','三等奖','四等奖','五等奖','六等奖','七等奖','福运奖','直选','组选3','组选6'];

// 中奖条件说明（详情页奖级表用）
const CONDITIONS = {
  ssq: { '一等奖':'6+1', '二等奖':'6+0', '三等奖':'5+1', '四等奖':'5+0 / 4+1', '五等奖':'4+0 / 3+1', '六等奖':'2+1 / 1+1 / 0+1', '福运奖':'3+0' },
  dlt: { '一等奖':'5+2', '二等奖':'5+1', '三等奖':'5+0 / 4+2', '四等奖':'4+1', '五等奖':'4+0 / 3+2', '六等奖':'3+1 / 2+2', '七等奖':'3+0 / 2+1 / 1+2 / 0+2' },
  qlc: { '一等奖':'中7', '二等奖':'中6+特别号', '三等奖':'中6', '四等奖':'中5+特别号', '五等奖':'中5', '六等奖':'中4+特别号', '七等奖':'中4' },
  qxc: { '一等奖':'7位全中', '二等奖':'前6位全中', '三等奖':'前区任5+第7位', '四等奖':'任5位', '五等奖':'任4位', '六等奖':'任3位 / 第7位+前区0~1位' },
  fc3d:{ '直选':'按位全中', '组选3':'组三号码全中', '组选6':'组六号码全中' },
  pl3: { '直选':'按位全中', '组选3':'组三号码全中', '组选6':'组六号码全中' },
  pl5: { '直选':'按位全中' }
};
const FIXED = {
  ssq: { '三等奖':3000, '四等奖':200, '五等奖':10, '六等奖':5, '福运奖':5 },
  dlt: { '三等奖':5000, '四等奖':300, '五等奖':150, '六等奖':15, '七等奖':5 },
  dltBoost: { '三等奖':6666, '四等奖':380, '五等奖':200, '六等奖':18, '七等奖':7 },
  qlc: { '四等奖':200, '五等奖':50, '六等奖':10, '七等奖':5 },
  qxc: { '三等奖':3000, '四等奖':500, '五等奖':30, '六等奖':5 }
};
function lottoLevel(g, fh, bh, sp, ctx) {
  if (g === 'ssq') {
    if (fh === 6 && bh === 1) return '一等奖'; if (fh === 6) return '二等奖'; if (fh === 5 && bh === 1) return '三等奖';
    if (fh === 5 || (fh === 4 && bh === 1)) return '四等奖'; if (fh === 4 || (fh === 3 && bh === 1)) return '五等奖';
    if (bh === 1) return '六等奖'; if (fh === 3 && ctx && ctx.special) return '福运奖'; return '';
  }
  if (g === 'dlt') {
    if (fh === 5 && bh === 2) return '一等奖'; if (fh === 5 && bh === 1) return '二等奖';
    if ((fh === 5 && bh === 0) || (fh === 4 && bh === 2)) return '三等奖'; if (fh === 4 && bh === 1) return '四等奖';
    if ((fh === 4 && bh === 0) || (fh === 3 && bh === 2)) return '五等奖'; if ((fh === 3 && bh === 1) || (fh === 2 && bh === 2)) return '六等奖';
    if ((fh === 3 && bh === 0) || (fh === 2 && bh === 1) || (fh === 1 && bh === 2) || (fh === 0 && bh === 2)) return '七等奖'; return '';
  }
  if (g === 'qlc') {
    if (fh === 7) return '一等奖'; if (fh === 6 && sp) return '二等奖'; if (fh === 6) return '三等奖';
    if (fh === 5 && sp) return '四等奖'; if (fh === 5) return '五等奖'; if (fh === 4 && sp) return '六等奖'; if (fh === 4) return '七等奖'; return '';
  }
  return '';
}
function levelAmount(g, name, ctx) { // 固定奖金额；浮动奖返回 null
  if (g === 'dlt') { const t = ctx && ctx.boost ? FIXED.dltBoost : FIXED.dlt; return t[name] ?? null; }
  if (FIXED[g]) return FIXED[g][name] ?? null;
  return null;
}
function qxcLevel(mf, mb) {
  const tot = mf + (mb ? 1 : 0);
  if (mf === 6 && mb) return '一等奖'; if (mf === 6) return '二等奖'; if (mf === 5 && mb) return '三等奖';
  if (tot === 5) return '四等奖'; if (tot === 4) return '五等奖'; if (tot === 3 || (mb && mf <= 1)) return '六等奖'; return '';
}

// 组合计数：从 A 类(命中)里选 x 个、B 类(未中)里选 t-x 个
function hitDist(hit, miss, t) { const out = {}; for (let x = 0; x <= Math.min(hit, t); x++) { const c = nCk(hit, x) * nCk(miss, t - x); if (c) out[x] = c; } return out; }

// 一行投注对一期开奖：返回 {等级名: 注数}
function evalLine(g, L, draw, ctx) {
  const G = GAMES[g], res = {};
  const add = (name, c) => { if (name && c) res[name] = (res[name] || 0) + c; };
  if (G.kind === 'lotto') {
    const D = draw.n, S = draw.s || [];
    const fd = L.fd || [], f = L.f || [], bd = L.bd || [], b = L.b || [];
    const t = G.main.n - fd.length; if (t < 0) return res;
    if (g === 'qlc') {
      const sp = S[0]; const fdHit = fd.filter(x => D.includes(x)).length, fdSp = fd.includes(sp) ? 1 : 0;
      const fHit = f.filter(x => D.includes(x)).length, fSp = f.includes(sp) ? 1 : 0, fOther = f.length - fHit - fSp;
      for (let x = 0; x <= Math.min(fHit, t); x++) for (let s = 0; s <= fSp; s++) {
        const c = nCk(fHit, x) * nCk(fSp, s) * nCk(fOther, t - x - s); if (!c) continue;
        add(lottoLevel(g, fdHit + x, 0, (fdSp || s) ? 1 : 0, ctx), c);
      }
      return res;
    }
    const fdHit = fd.filter(x => D.includes(x)).length, fHit = f.filter(x => D.includes(x)).length;
    const bdHit = bd.filter(x => S.includes(x)).length, bHit = b.filter(x => S.includes(x)).length;
    const mDist = hitDist(fHit, f.length - fHit, t), sDist = hitDist(bHit, b.length - bHit, G.sub.n - bd.length);
    for (const x in mDist) for (const y in sDist) add(lottoLevel(g, fdHit + +x, bdHit + +y, 0, ctx), mDist[x] * sDist[y]);
    return res;
  }
  if (G.kind === 'keno') {
    const D = draw.n, fd = L.fd || [], f = L.f || [], k = L.k, row = KENO_TABLE[k] || {};
    const fdHit = fd.filter(x => D.includes(x)).length, fHit = f.filter(x => D.includes(x)).length;
    const dist = hitDist(fHit, f.length - fHit, k - fd.length);
    for (const x in dist) { const h = fdHit + +x; if (row[h] != null) add(`${KENO_NAME[k]}中${h}`, dist[x]); }
    return res;
  }
  if (G.kind === 'digit') {
    const D = draw.n;
    if (L.play === 'zx') { if ((L.pos || []).every((a, i) => a.includes(D[i]))) add('直选', 1); return res; }
    const ms = asc(D), distinct = uniq(ms).length;
    if (L.play === 'z3') {
      if (distinct !== 2) return res;
      if (L.d) { if (asc(L.d).join() === ms.join()) add('组选3', 1); return res; }
      if (uniq(ms).every(x => (L.f || []).includes(x))) add('组选3', 1); return res;
    }
    if (L.play === 'z6') { if (distinct === 3 && ms.every(x => (L.f || []).includes(x))) add('组选6', 1); return res; }
    return res;
  }
  if (G.kind === 'qxc') {
    const D = draw.n, back = (draw.s || [])[0];
    // 生成函数：每一位 (未中个数 + 命中个数·z)
    let poly = [1];
    (L.pos || []).forEach((a, i) => { const hit = a.includes(D[i]) ? 1 : 0, miss = a.length - hit; const np = new Array(poly.length + 1).fill(0);
      poly.forEach((c, j) => { np[j] += c * miss; np[j + 1] += c * hit; }); poly = np; });
    const bHit = (L.b || []).includes(back) ? 1 : 0, bMiss = (L.b || []).length - bHit;
    poly.forEach((c, mf) => { if (!c) return; add(qxcLevel(mf, true), c * bHit); add(qxcLevel(mf, false), c * bMiss); });
    return res;
  }
  return res;
}
function amountOf(g, name, ctx) { // 单注金额；null = 浮动奖
  const G = GAMES[g];
  if (G.kind === 'keno') { const m = /^(选.)中(\d+)$/.exec(name); if (!m) return null; const k = KENO_NAME.indexOf(m[1]); const v = (KENO_TABLE[k] || {})[+m[2]]; return v === 'F' ? null : v; }
  if (G.kind === 'digit') return (DIGIT_PRIZE[g] || {})[name === '直选' ? 'zx' : name === '组选3' ? 'z3' : 'z6'] ?? null;
  return levelAmount(g, name, ctx);
}
// 整张票对奖
function checkTicket(t, draw, ctx) {
  const g = t.game; const tally = {}; let fixed = 0, fixedAlt = 0; const floating = [];
  t.lines.forEach(L => { const r = evalLine(g, L, draw, ctx);
    for (const name in r) { tally[name] = (tally[name] || 0) + r[name];
      const a = amountOf(g, name, ctx);
      if (a == null) floating.push(name);
      else { fixed += a * r[name];
        const alt = g === 'dlt' && ctx && ctx.boost == null ? (FIXED.dltBoost[name] ?? a) : a; fixedAlt += alt * r[name]; } } });
  const m = t.mult || 1;
  return { tally, fixed: Math.round(fixed * m * 10) / 10, fixedAlt: Math.round(fixedAlt * m * 10) / 10, floating: uniq(floating), bets: ticketBets(t), mult: m };
}
// 整张票的奖金明细：固定奖按规则算；浮动奖（一、二等奖等）用开奖公告里的金额；大乐透追加另加
function ticketResult(t, draw, ctx) {
  const g = t.game, base = checkTicket(t, draw, ctx), m = base.mult, grades = draw.grades || [];
  const clean = (s) => String(s).replace(/[（(]?追加[)）]?/g, '').trim();
  const gradeAmt = (n, add) => { const x = grades.find(q => (add ? /追加/.test(q.name) : !/追加/.test(q.name)) && clean(q.name) === n); return x && x.amount ? x.amount : null; };
  const levels = sortLevels(Object.keys(base.tally)).map(name => {
    const count = base.tally[name]; let per = amountOf(g, name, ctx); const floating = per == null;
    if (floating) per = gradeAmt(name, false);
    let addPer = null;   // 大乐透追加：一、二等奖另得基本奖金的 80%
    if (t.add && g === 'dlt' && floating) { addPer = gradeAmt(name, true); if (addPer == null && per != null) addPer = Math.floor(per * 0.8); }
    const sub = per == null ? null : Math.round((per + (addPer || 0)) * count * m * 100) / 100;
    return { name, count, per, addPer, floating, sub };
  });
  const total = Math.round(levels.reduce((s, l) => s + (l.sub || 0), 0) * 100) / 100;
  return Object.assign(base, { levels, total, unknown: levels.filter(l => l.sub == null).map(l => l.name), won: levels.length > 0 });
}
function sortLevels(names) {
  const rank = (n) => { const i = LEVEL_ORDER.indexOf(n); if (i >= 0) return i;
    const m = /^选(.)中(\d+)$/.exec(n); return m ? 100 - +m[2] : 999; };
  return [...names].sort((a, b) => rank(a) - rank(b));
}

// 奖级上下文：双色球特别规定（福运奖）、大乐透 8 亿加奖
function ssqSpecialActive(code, draws) {
  if (code < '2026014') return false; let on = false;
  for (const d of draws) { if (d.code >= code) break; if (d.code < '2026013' || d.pool == null) continue; if (d.pool >= 15) on = true; else if (d.pool < 3) on = false; }
  return on;
}
function dltBoost(code, draws) {
  let prev = null; for (const d of draws) { if (d.code >= code) break; prev = d; }
  if (!prev || prev.pool == null) return null; return prev.pool >= 8;
}
function contextFor(g, code, draws) {
  if (g === 'ssq') return { special: ssqSpecialActive(code, draws) };
  if (g === 'dlt') return { boost: dltBoost(code, draws) };
  return {};
}

/* ---------------- 历史统计 ---------------- */
function stats(g, draws, window) {
  const G = GAMES[g]; const recent = draws.slice(-window); const N = draws.length;
  const mk = (min, max, v) => { const o = {}; for (let i = min; i <= max; i++) o[i] = v; return o; };
  if (G.kind === 'lotto' || G.kind === 'keno') {
    const ff = mk(G.main.min, G.main.max, 0), fm = mk(G.main.min, G.main.max, N);
    const bf = G.sub ? mk(G.sub.min, G.sub.max, 0) : {}, bm = G.sub ? mk(G.sub.min, G.sub.max, N) : {};
    recent.forEach(d => { d.n.forEach(x => ff[x]++); if (G.sub) d.s.forEach(x => bf[x]++); });
    for (let i = N - 1; i >= 0; i--) { const age = N - 1 - i;
      draws[i].n.forEach(x => { if (fm[x] === N) fm[x] = age; }); if (G.sub) draws[i].s.forEach(x => { if (bm[x] === N) bm[x] = age; }); }
    const sums = recent.map(d => d.n.reduce((a, b) => a + b, 0)).sort((a, b) => a - b);
    const q = (p) => sums.length ? sums[Math.min(sums.length - 1, Math.floor(p * sums.length))] : 0;
    return { ff, fm, bf, bm, sumLo: q(0.2), sumHi: q(0.8), n: recent.length };
  }
  // 数字型：每一位的出现次数和遗漏
  const L = G.len + (G.kind === 'qxc' ? 1 : 0);
  const pf = [], pm = [];
  for (let p = 0; p < L; p++) { const max = (G.kind === 'qxc' && p === 6) ? 14 : 9; pf.push(mk(0, max, 0)); pm.push(mk(0, max, N)); }
  const digitsOf = (d) => G.kind === 'qxc' ? d.n.concat(d.s) : d.n;
  recent.forEach(d => digitsOf(d).forEach((x, p) => { if (pf[p] && pf[p][x] != null) pf[p][x]++; }));
  for (let i = N - 1; i >= 0; i--) { const age = N - 1 - i; digitsOf(draws[i]).forEach((x, p) => { if (pm[p] && pm[p][x] === N) pm[p][x] = age; }); }
  const sums = recent.map(d => d.n.reduce((a, b) => a + b, 0)).sort((a, b) => a - b);
  const q = (p) => sums.length ? sums[Math.min(sums.length - 1, Math.floor(p * sums.length))] : 0;
  return { pf, pm, sumLo: q(0.2), sumHi: q(0.8), n: recent.length };
}

/* ---------------- 防撞号（只对浮动奖彩种有意义） ---------------- */
function popularReason(g, line, draws) {
  const G = GAMES[g];
  if (G.kind === 'lotto') {
    const s = asc(line.f); let run = 1, maxRun = 1;
    for (let i = 1; i < s.length; i++) { run = s[i] === s[i - 1] + 1 ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
    if (maxRun >= 4) return '4个以上连号';
    const d = s[1] - s[0]; if (s.every((x, i) => i === 0 || x - s[i - 1] === d)) return '等差数列';
    if (s.every(x => x <= 12)) return '全是月份数字';
    if (s.every(x => x <= 31) && G.main.max > 31 && s.filter(x => x > 12).length <= 1) return '几乎都是日期数字';
    const tails = {}; s.forEach(x => tails[x % 10] = (tails[x % 10] || 0) + 1); if (Math.max(...Object.values(tails)) >= 4) return '同尾号太多';
    if (draws && draws.length) { const last = draws[draws.length - 1].n; if (s.filter(x => last.includes(x)).length >= Math.ceil(G.main.n * 0.6)) return '和上期重号太多';
      const key = s.join(','); if (draws.some(dd => dd.n.join(',') === key)) return '和历史开奖号码一样'; }
  }
  if (G.kind === 'qxc') { const ds = line.pos.map(a => a[0]); if (uniq(ds).length <= 2) return '数字太单一';
    let inc = 0; for (let i = 1; i < 6; i++) if (Math.abs(ds[i] - ds[i - 1]) === 1) inc++; if (inc >= 4) return '顺子'; }
  return '';
}
function avoidApplies(g, k) { const G = GAMES[g]; return G.kind === 'lotto' || G.kind === 'qxc' || (G.kind === 'keno' && k >= 9); }

/* ---------------- 选号 ---------------- */
const METHODS = [
  { id:'random', name:'机选', group:'随机' },
  { id:'hot', name:'热号', group:'历史' }, { id:'cold', name:'冷号', group:'历史' }, { id:'shape', name:'形态', group:'历史' },
  { id:'birthday', name:'生日', group:'个人' }, { id:'zodiac', name:'星座', group:'个人' }, { id:'wuxing', name:'八字五行', group:'个人' },
  { id:'today', name:'开奖日五行', group:'其他' }, { id:'words', name:'心意号', group:'其他' }
];
function numbersOfWx(w, min, max) { return range(min, max).filter(n => wxOfNumber(n) === w); }
function wxPool(bz, min, max) { const w1 = bz.weak[0], w2 = SHENG_BY[w1]; return { a: numbersOfWx(w1, min, max), b: numbersOfWx(w2, min, max), w1, w2 }; }

// 从一个区（min..max）里选 k 个，lock 为固定号码
function pickZone(method, o, zone, k, lock, min, max) {
  const R = o.rand; const rest = k - lock.length; if (rest <= 0) return asc(lock.slice(0, k));
  const all = range(min, max);
  let chosen = [];
  const prefer = (pref, take) => { const p = uniq(pref.filter(n => n >= min && n <= max && !lock.includes(n)));
    const a = pickFrom(p, Math.min(take, rest, p.length), R); return a.concat(pickFrom(all, rest - a.length, R, lock.concat(a))); };
  switch (method) {
    case 'hot': { const f = zone === 'main' ? o.st.ff : o.st.bf; const w = {}; all.forEach(n => w[n] = 1 + Math.pow(f[n] || 0, 2)); chosen = weightedPick(w, rest, R, lock); break; }
    case 'cold': { const m = zone === 'main' ? o.st.fm : o.st.bm; const w = {}; all.forEach(n => w[n] = 1 + (m[n] || 0)); chosen = weightedPick(w, rest, R, lock); break; }
    case 'birthday': chosen = prefer(birthdayNumbers(o.birthdays || [], max), Math.max(1, rest - 1)); break;
    case 'zodiac': chosen = prefer(zodiacNumbers(o.zodiac, max), Math.ceil(rest / 2)); break;
    case 'wuxing': case 'today': { const p = wxPool(o.bz, min, max); const k1 = Math.ceil(rest / 2) + (rest >= 6 ? 1 : 0);
      let a = pickFrom(p.a, Math.min(k1, rest), R, lock); a = a.concat(pickFrom(p.b, rest - a.length, R, lock.concat(a)));
      chosen = a.concat(pickFrom(all, rest - a.length, R, lock.concat(a))); break; }
    default: chosen = pickFrom(all, rest, R, lock);
  }
  return asc(lock.concat(chosen));
}
function pickDigit(method, o, p, pool, lock) { // 一位数字
  const R = o.rand; if (lock != null) return lock;
  const all = pool;
  switch (method) {
    case 'hot': { const f = o.st.pf[p]; const w = {}; all.forEach(n => w[n] = 1 + Math.pow(f[n] || 0, 1.5)); return weightedPick(w, 1, R)[0]; }
    case 'cold': { const m = o.st.pm[p]; const w = {}; all.forEach(n => w[n] = 1 + (m[n] || 0)); return weightedPick(w, 1, R)[0]; }
    case 'birthday': { const ds = birthdayDigits(o.birthdays || []).filter(x => all.includes(x)); return ds.length && R() < 0.8 ? ds[Math.floor(R() * ds.length)] : all[Math.floor(R() * all.length)]; }
    case 'zodiac': { const ds = uniq(zodiacNumbers(o.zodiac, 99).map(n => n % 10)).filter(x => all.includes(x)); return ds.length && R() < 0.75 ? ds[Math.floor(R() * ds.length)] : all[Math.floor(R() * all.length)]; }
    case 'wuxing': case 'today': { const w1 = o.bz.weak[0], w2 = SHENG_BY[w1]; const ds = HETU[w1].concat(R() < 0.35 ? HETU[w2] : []).filter(x => all.includes(x));
      return ds.length ? ds[Math.floor(R() * ds.length)] : all[Math.floor(R() * all.length)]; }
    default: return all[Math.floor(R() * all.length)];
  }
}
// 生成一注（单式）。o: {method, rand, st, draws, birthdays, zodiac, bz, words, variant, lock:{f,b,pos}, k, play}
function genOne(g, o) {
  const G = GAMES[g]; const R = o.method === 'words' ? seededRand(g + '|' + (o.words || '') + '|' + (o.k || '') + (o.play || '') + '|' + (o.variant || 0)) : (o.rand || cryptoRand);
  const oo = Object.assign({}, o, { rand: R }); const lock = o.lock || {};
  if (G.kind === 'lotto') {
    let f;
    if (o.method === 'shape') {
      for (let t = 0; t < 400; t++) { f = pickZone('random', oo, 'main', G.main.n, (lock.f || []).slice(0, G.main.n - 1), G.main.min, G.main.max);
        const s = f.reduce((a, b) => a + b, 0), odd = f.filter(x => x % 2).length, z = [0, 0, 0]; f.forEach(x => z[Math.min(2, Math.floor((x - 1) / (G.main.max / 3)))]++);
        if (s >= o.st.sumLo && s <= o.st.sumHi && odd >= 2 && odd <= G.main.n - 2 && z.every(c => c >= 1)) break; }
    } else f = pickZone(o.method, oo, 'main', G.main.n, (lock.f || []).slice(0, G.main.n - 1), G.main.min, G.main.max);
    const b = G.sub ? pickZone(o.method === 'shape' ? 'random' : o.method, oo, 'sub', G.sub.n, (lock.b || []).slice(0, G.sub.n), G.sub.min, G.sub.max) : [];
    return G.sub ? { f, b } : { f };
  }
  if (G.kind === 'keno') {
    const k = o.k || 5; let f;
    if (o.method === 'shape') {
      for (let t = 0; t < 300; t++) { f = pickZone('random', oo, 'main', k, (lock.f || []).slice(0, k - 1), 1, 80);
        const z = [0, 0, 0, 0]; f.forEach(x => z[Math.floor((x - 1) / 20)]++); const odd = f.filter(x => x % 2).length;
        if (k < 4 || (z.filter(c => c > 0).length >= Math.min(4, Math.ceil(k / 2)) && odd >= Math.floor(k / 3) && odd <= k - Math.floor(k / 3))) break; }
    } else f = pickZone(o.method, oo, 'main', k, (lock.f || []).slice(0, k - 1), 1, 80);
    return { k, f };
  }
  if (G.kind === 'digit') {
    const play = o.play || 'zx'; const lp = lock.pos || [];
    if (play === 'zx') {
      let ds;
      for (let t = 0; t < 300; t++) {
        ds = range(0, G.len - 1).map(p => pickDigit(o.method === 'shape' ? 'random' : o.method, oo, p, range(0, 9), lp[p] != null ? lp[p] : null));
        if (o.method !== 'shape') break;
        const s = ds.reduce((a, b) => a + b, 0); if (s >= o.st.sumLo && s <= o.st.sumHi && uniq(ds).length > 1) break;
      }
      return { play, pos: ds.map(d => [d]) };
    }
    // 组选：在 0-9 里选不重复的数字
    const need = play === 'z3' ? 2 : 3; const set = [];
    for (let t = 0; t < 200 && set.length < need; t++) { const d = pickDigit(o.method === 'shape' ? 'random' : o.method, oo, set.length % G.len, range(0, 9), null); if (!set.includes(d)) set.push(d); }
    if (play === 'z3') { const [a, b] = set; return { play, d: asc(R() < 0.5 ? [a, a, b] : [a, b, b]) }; }
    return { play, f: asc(set) };
  }
  if (G.kind === 'qxc') {
    const lp = lock.pos || []; let ds;
    for (let t = 0; t < 300; t++) {
      ds = range(0, 5).map(p => pickDigit(o.method === 'shape' ? 'random' : o.method, oo, p, range(0, 9), lp[p] != null ? lp[p] : null));
      if (o.method !== 'shape') break; const s = ds.reduce((a, b) => a + b, 0); if (s >= o.st.sumLo && s <= o.st.sumHi && uniq(ds).length >= 3) break;
    }
    const back = lock.b && lock.b.length ? lock.b[0] : pickDigit(o.method === 'shape' ? 'random' : o.method, oo, 6, range(0, 14), null);
    return { pos: ds.map(d => [d]), b: [back] };
  }
  return null;
}
function lineKey(L) { return JSON.stringify([L.play || '', L.k || 0, L.fd || [], L.f || [], L.bd || [], L.b || [], L.pos || [], L.d || []]); }
function generate(g, o, count) {
  const out = []; let guard = 0; const useAvoid = o.avoid && avoidApplies(g, o.k) && o.method !== 'words';
  while (out.length < count && guard < count * 200) {
    guard++;
    const L = genOne(g, Object.assign({}, o, { variant: (o.variant || 0) + guard }));
    if (!L) break;
    if (useAvoid && guard < count * 150 && popularReason(g, L, o.draws)) continue;
    if (out.some(x => lineKey(x) === lineKey(L)) && o.method !== 'words') continue;
    out.push(L);
  }
  return out;
}

const API = { GAMES, ORDER, PLAY_NAME, KENO_NAME, KENO_TABLE, CONDITIONS, METHODS, LEVEL_ORDER,
  range, asc, uniq, nCk, pad2, fmtMoney, seededRand, cryptoRand,
  bazi, zodiacOf, zodiacNumbers, ZODIAC_ORDER, birthdayNumbers, birthdayDigits, wxOfNumber, numbersOfWx, HETU, SHENG_BY, WX,
  nextIssue, issueDate, lastDueDate, drawsToday, issueShort, bjNow, ymd,
  lineBets, lineIssues, ticketBets, ticketCost, evalLine, checkTicket, ticketResult, amountOf, sortLevels, contextFor, ssqSpecialActive, dltBoost,
  stats, popularReason, avoidApplies, genOne, generate, lineKey };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.LT = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
