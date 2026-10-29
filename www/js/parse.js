/* 快乐密码 · 官网开奖数据解析（App 和后台对奖脚本共用） */
(function (root) {
'use strict';
const LT = root.LT;
const UA = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const H_CWL = { 'Accept': 'application/json, text/javascript, */*; q=0.01', 'Referer': 'https://www.cwl.gov.cn/ygkj/wqkjgg/', 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' };
const H_TC = { 'Accept': 'application/json, text/plain, */*', 'Referer': 'https://static.sporttery.cn/', 'Origin': 'https://static.sporttery.cn', 'User-Agent': UA };
const H_CDN = { 'Accept': 'application/json' };
const cwlUrl = (name, o) => 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=' + name +
  '&issueCount=&issueStart=&issueEnd=&dayStart=' + (o.dayStart || '') + '&dayEnd=' + (o.dayEnd || '') + '&pageNo=1&pageSize=' + (o.pageSize || 30) + '&week=&systemType=PC';
const tcUrl = (no, page, size) => 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=' + no + '&provinceId=0&pageSize=' + size + '&isVerify=1&pageNo=' + page;
const CDN = { ssq: 'https://cdn.jsdelivr.net/gh/jiayuqi7813/lottery_history@main/data/ssq.json', dlt: 'https://cdn.jsdelivr.net/gh/jiayuqi7813/lottery_history@main/data/dlt.json' };

/* ---------- 解析官网数据 ---------- */
const numOf = (v) => { if (v == null || v === '' || v === '-') return null; const n = Number(String(v).replace(/[,\s元]/g, '')); return isFinite(n) ? n : null; };
const CN_LEVEL = ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖'];
function cwlGradeName(g, type) {
  const t = String(type == null ? '' : type).trim();
  const m = /^x(\d+)z(\d+)$/i.exec(t); if (m) return (LT.KENO_NAME[+m[1]] || ('选' + m[1])) + '中' + m[2];
  const n = +t;
  if (g === 'fc3d') return ({ 1: '直选', 2: '组选3', 3: '组选6' })[n] || null;
  if (g === 'ssq') return n === 7 ? '福运奖' : (CN_LEVEL[n] && n <= 6 ? CN_LEVEL[n] : null);
  if (g === 'qlc') return CN_LEVEL[n] || null;
  return null;
}
const okNums = (a, n, min, max) => a.length === n && a.every(x => Number.isInteger(x) && x >= min && x <= max);
function parseCwl(g, it) {
  const G = LT.GAMES[g]; const code = String(it.code || '').trim(); if (!/^\d{7}$/.test(code)) return null;
  const date = String(it.date || '').slice(0, 10);
  const red = String(it.red || '').split(/[,\s]+/).filter(Boolean).map(Number);
  const blue = String(it.blue || '').split(/[,\s]+/).filter(Boolean).map(Number);
  let n, s = [];
  if (G.kind === 'digit') { n = red; if (!okNums(n, G.len, 0, 9)) return null; }
  else if (G.kind === 'keno') { n = LT.asc(red); if (!okNums(n, 20, 1, 80)) return null; }
  else { n = LT.asc(red); if (!okNums(n, G.main.n, G.main.min, G.main.max)) return null;
    s = LT.asc(blue); if (G.sub ? !okNums(s, G.sub.n, G.sub.min, G.sub.max) : (G.special && !okNums(s, 1, G.main.min, G.main.max))) return null; }
  const grades = Array.isArray(it.prizegrades) ? it.prizegrades.map(x => ({ name: cwlGradeName(g, x.type), count: numOf(x.typenum), amount: numOf(x.typemoney) }))
    .filter(x => x.name && (x.count != null || x.amount != null)) : [];
  const pool = numOf(it.poolmoney);
  return { code, date, n, s, pool: pool != null ? pool / 1e8 : null, sales: numOf(it.sales), grades: grades.length ? grades : null, region: it.content ? String(it.content).trim() : '' };
}
function parseTc(g, it) {
  const G = LT.GAMES[g]; const raw = String(it.lotteryDrawNum || '').trim(); const code = raw.length === 5 ? '20' + raw : raw;
  if (!/^\d{7}$/.test(code)) return null;
  const nums = String(it.lotteryDrawResult || '').trim().split(/\s+/).map(Number);
  let n, s = [];
  if (g === 'dlt') { n = LT.asc(nums.slice(0, 5)); s = LT.asc(nums.slice(5, 7)); if (!okNums(n, 5, 1, 35) || !okNums(s, 2, 1, 12)) return null; }
  else if (g === 'qxc') { n = nums.slice(0, 6); s = nums.slice(6, 7); if (!okNums(n, 6, 0, 9) || !okNums(s, 1, 0, 14)) return null; }
  else { n = nums.slice(0, G.len); if (!okNums(n, G.len, 0, 9)) return null; }
  const grades = Array.isArray(it.prizeLevelList) ? it.prizeLevelList.map(x => ({ name: String(x.prizeLevel || '').trim(), count: numOf(x.stakeCount),
    amount: numOf(x.stakeAmountFormat != null ? x.stakeAmountFormat : x.stakeAmount) })).filter(x => x.name) : [];
  const pool = numOf(it.poolBalanceAfterdraw != null ? it.poolBalanceAfterdraw : it.poolBalance);
  return { code, date: String(it.lotteryDrawTime || '').slice(0, 10), n, s, pool: pool != null ? pool / 1e8 : null, sales: numOf(it.totalSaleAmount), grades: grades.length ? grades : null, region: '' };
}
function cwlList(g, j) {
  if (!j || (!Array.isArray(j.result) && j.state !== 0)) throw new Error((j && j.message) || '福彩官网返回异常');
  return (j.result || []).map(it => parseCwl(g, it)).filter(Boolean);
}
function tcList(g, j) {
  const v = (j && j.value) || {}; if (!Array.isArray(v.list)) throw new Error((j && (j.errorMessage || j.message)) || '体彩官网返回异常');
  return v.list.map(it => parseTc(g, it)).filter(Boolean);
}
function cdnList(g, arr) {
  if (!Array.isArray(arr)) throw new Error('备用数据格式不对');
  return arr.map(r => { const c = String(r.issueNumber || ''); const code = c.length === 5 ? '20' + c : c;
    const n = LT.asc(g === 'ssq' ? r.redBalls : r.frontBalls), s = LT.asc(g === 'ssq' ? [r.blueBall] : r.backBalls);
    return /^\d{7}$/.test(code) ? { code, date: String(r.drawDate || '').slice(0, 10), n, s, pool: null, sales: null, grades: null, region: '' } : null; }).filter(Boolean);
}


root.PARSE = { UA, H_CWL, H_TC, H_CDN, cwlUrl, tcUrl, CDN, numOf, parseCwl, parseTc, cwlList, tcList, cdnList };
})(typeof globalThis !== 'undefined' ? globalThis : this);
