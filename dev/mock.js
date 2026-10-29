/* 仅本地测试用：模拟福彩、体彩官网接口的返回格式（号码是随机生成的假数据，不会打包进 App） */
(function () {
  const LT = window.LT;
  const R = (seed) => LT.seededRand('mock' + seed);
  function drawDates(g, n) { const out = []; const due = LT.lastDueDate(g, new Date()); let d = new Date(due + 'T12:00:00Z');
    while (out.length < n) { if (LT.GAMES[g].days.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() - 86400e3); } return out; }
  function issueOf(g, date) { const y = date.slice(0, 4); let d = new Date(y + '-01-01T12:00:00Z'), k = 0; while (d.toISOString().slice(0, 10) <= date) { if (LT.GAMES[g].days.includes(d.getUTCDay())) k++; d = new Date(d.getTime() + 86400e3); } return y + String(k).padStart(3, '0'); }
  function make(g, date) { const G = LT.GAMES[g], r = R(g + date); const pick = (a, k) => { a = a.slice(); const o = []; while (o.length < k) o.push(a.splice(Math.floor(r() * a.length), 1)[0]); return o; };
    if (G.kind === 'lotto') { const n = LT.asc(pick(LT.range(G.main.min, G.main.max), G.main.n)); const s = G.sub ? LT.asc(pick(LT.range(G.sub.min, G.sub.max), G.sub.n)) : pick(LT.range(1, G.main.max).filter(x => !n.includes(x)), 1); return { n, s }; }
    if (G.kind === 'keno') return { n: LT.asc(pick(LT.range(1, 80), 20)), s: [] };
    if (G.kind === 'digit') return { n: LT.range(1, G.len).map(() => Math.floor(r() * 10)), s: [] };
    return { n: LT.range(1, 6).map(() => Math.floor(r() * 10)), s: [Math.floor(r() * 15)] }; }
  const W = '日一二三四五六';
  function cwl(g, q) { const size = +q.get('pageSize') || 30; let dates = drawDates(g, 420);
    if (q.get('dayStart')) dates = dates.filter(d => d >= q.get('dayStart') && d <= q.get('dayEnd'));
    dates = dates.slice(0, size);
    return { state: 0, message: '查询成功', total: dates.length, result: dates.map(date => { const d = make(g, date), r = R('p' + g + date); const pad = (x) => g === 'fc3d' ? String(x) : LT.pad2(x);
      let grades = [];
      if (g === 'ssq') grades = [[1, 5, 8447916], [2, 96, 224473], [3, 1199, 3000], [4, 64996, 200], [5, 1189606, 10], [6, 9805566, 5]].map(([t, n, m]) => ({ type: t, typenum: String(n), typemoney: String(m) }));
      if (g === 'qlc') grades = [[1, 0, 0], [2, 3, 52000], [3, 104, 1595], [4, 258, 200], [5, 3765, 50], [6, 4790, 10], [7, 40632, 5]].map(([t, n, m]) => ({ type: t, typenum: String(n), typemoney: String(m) }));
      if (g === 'fc3d') grades = [[1, 11006, 1040], [2, 0, 346], [3, 43636, 173]].map(([t, n, m]) => ({ type: t, typenum: String(n), typemoney: String(m) }));
      if (g === 'kl8') Object.entries(LT.KENO_TABLE).forEach(([k, row]) => Object.entries(row).forEach(([h, a]) => grades.push({ type: 'x' + k + 'z' + h, typenum: String(Math.floor(r() * 5000)), typemoney: a === 'F' ? '0' : String(a) })));
      return { name: g, code: issueOf(g, date), date: date + '(' + W[new Date(date + 'T12:00:00Z').getUTCDay()] + ')', red: d.n.map(pad).join(','), blue: d.s.map(pad).join(','),
        sales: String(Math.floor(3e8 + r() * 1e8)), poolmoney: g === 'fc3d' ? '' : String(Math.floor(r() * 2e9)), content: g === 'ssq' ? '辽宁1注,黑龙江1注,福建1注,湖南1注,陕西1注,共5注。' : '', prizegrades: grades }; }) }; }
  function tc(g, q) { const size = +q.get('pageSize') || 30, page = +q.get('pageNo') || 1; const all = drawDates(g, 420); const dates = all.slice((page - 1) * size, page * size);
    return { success: true, value: { total: all.length, list: dates.map(date => { const d = make(g, date), r = R('p' + g + date); const code = issueOf(g, date).slice(2);
      const res = g === 'dlt' ? d.n.map(LT.pad2).concat(d.s.map(LT.pad2)).join(' ') : d.n.concat(d.s).join(' ');
      const lv = g === 'dlt' ? [['一等奖', 4, '7,368,000'], ['一等奖(追加)', 1, '5,894,400'], ['二等奖', 151, '57,800'], ['三等奖', 1202, '5,000'], ['四等奖', 3120, '300'], ['五等奖', 70000, '150'], ['六等奖', 230000, '15'], ['七等奖', 7791037, '5']]
        : g === 'qxc' ? [['一等奖', 0, '0'], ['二等奖', 3, '89,000'], ['三等奖', 20, '3,000'], ['四等奖', 400, '500'], ['五等奖', 9000, '30'], ['六等奖', 600000, '5']]
        : g === 'pl5' ? [['直选', 120, '100,000']] : [['直选', 11006, '1,040'], ['组选3', 0, '346'], ['组选6', 43636, '173']];
      return { lotteryDrawNum: code, lotteryDrawResult: res, lotteryDrawTime: date, poolBalanceAfterdraw: g === 'dlt' || g === 'qxc' ? (Math.floor(r() * 1e9)).toLocaleString('en') + '.00' : '0',
        totalSaleAmount: Math.floor(1e8 + r() * 2e8).toLocaleString('en'), prizeLevelList: lv.map(([n, c, a]) => ({ prizeLevel: n, stakeCount: String(c), stakeAmountFormat: a })) }; }) } }; }
  window.__MOCK__ = async (url) => { await new Promise(r => setTimeout(r, 150)); const u = new URL(url); const q = u.searchParams;
    if (u.hostname.includes('cwl')) { const name = q.get('name'); const g = name === '3d' ? 'fc3d' : name; return cwl(g, q); }
    if (u.hostname.includes('sporttery')) { const no = q.get('gameNo'); const g = { '85': 'dlt', '35': 'pl3', '350133': 'pl5', '04': 'qxc' }[no]; return tc(g, q); }
    throw new Error('mock: unknown ' + url); };
})();
