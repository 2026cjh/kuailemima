/* 红蓝 · 后台对奖
 * 由系统每半小时唤醒一次（Capacitor Background Runner）。只在某个关注的彩种"应该已经开奖但还没拿到号码"时才联网，
 * 拿到新一期就推送开奖号码，并给存着的票对奖。 */
var LT = globalThis.LT, P = globalThis.PARSE;

function kvGet(k, d) {
  try { var r = CapacitorKV.get(k); var v = r && typeof r === 'object' ? r.value : r; return v == null || v === '' ? d : v; } catch (e) { return d; }
}
function kvSet(k, v) { try { CapacitorKV.set(k, String(v)); } catch (e) {} }
function hashId(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000; }
function notify(key, title, body) {
  try { CapacitorNotifications.schedule([{ id: hashId(key), title: title, body: body, scheduleAt: new Date(Date.now() + 1000), smallIcon: 'ic_stat_notify', autoCancel: true }]); } catch (e) {}
}
async function getJson(url, headers) {
  var r = await fetch(url, { method: 'GET', headers: headers });
  var t = await r.text();
  return JSON.parse(t);
}
async function fetchLatest(g) {
  var G = LT.GAMES[g], list;
  if (G.src.type === 'cwl') list = P.cwlList(g, await getJson(P.cwlUrl(G.src.name, { pageSize: 8 }), P.H_CWL));
  else list = P.tcList(g, await getJson(P.tcUrl(G.src.no, 1, 8), P.H_TC));
  return list.sort(function (a, b) { return a.code < b.code ? -1 : 1; });
}
function numbersText(g, d) {
  var G = LT.GAMES[g], pad = LT.pad2;
  if (G.kind === 'lotto') return d.n.map(pad).join(' ') + (d.s.length ? ' + ' + d.s.map(pad).join(' ') : '');
  if (G.kind === 'keno') return d.n.map(pad).join(' ');
  if (G.kind === 'qxc') return d.n.join(' ') + ' + ' + d.s[0];
  return d.n.join(' ');
}

addEventListener('sync', function (resolve, reject, args) {
  try { kvSet('cfg', args && args.cfg ? args.cfg : '{}'); resolve({ ok: true }); } catch (e) { reject(e); }
});
addEventListener('status', function (resolve) {
  resolve({ lastRun: kvGet('lastRun', ''), lastMsg: kvGet('lastMsg', '') });
});
addEventListener('check', async function (resolve, reject, args) {
  try {
    var force = !!(args && args.force); var now = new Date();
    kvSet('lastRun', String(Date.now()));
    var cfg = {}; try { cfg = JSON.parse(kvGet('cfg', '{}')); } catch (e) {}
    var subs = cfg.subs || [], tickets = cfg.tickets || [], last = cfg.last || {}, ctxs = cfg.ctx || {};
    var seen = {}; try { seen = JSON.parse(kvGet('seen', '{}')); } catch (e) {}
    var msgs = [];
    var games = LT.ORDER.filter(function (g) { return subs.indexOf(g) >= 0 || tickets.some(function (t) { return t.game === g; }); });
    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi], G = LT.GAMES[g];
      var appKnown = (last[g] || '').split('|');
      var knownCode = seen[g] && seen[g] > (appKnown[0] || '') ? seen[g] : (appKnown[0] || '');
      var knownDate = seen[g + '_d'] && seen[g + '_d'] > (appKnown[1] || '') ? seen[g + '_d'] : (appKnown[1] || '');
      var due = LT.lastDueDate(g, now);
      if (!force && knownDate && due && knownDate >= due) continue;
      var list;
      try { list = await fetchLatest(g); } catch (e) { msgs.push(G.name + '获取失败'); continue; }
      if (!list.length) continue;
      var newest = list[list.length - 1];
      var fresh = knownCode ? list.filter(function (d) { return d.code > knownCode; }) : [];
      seen[g] = newest.code > knownCode ? newest.code : knownCode; seen[g + '_d'] = newest.date > knownDate ? newest.date : knownDate;
      if (!fresh.length) continue;
      msgs.push(G.name + LT.issueShort(g, newest.code) + '期');
      var wins = [], lose = 0;
      fresh.forEach(function (d) {
        tickets.filter(function (t) { return t.game === g && t.issue === d.code; }).forEach(function (t) {
          var r = LT.checkTicket(t, d, ctxs[g] || {});
          if (r.fixed > 0 || r.floating.length) wins.push({ t: t, r: r, d: d }); else lose++;
        });
      });
      if (subs.indexOf(g) >= 0) {
        var body = numbersText(g, newest);
        if (lose && !wins.length) body += '　你的 ' + lose + ' 张票未中奖';
        notify(g + newest.code, G.name + ' 第' + LT.issueShort(g, newest.code) + '期开奖', body);
      }
      if (cfg.win) wins.forEach(function (w) {
        var lv = LT.sortLevels(Object.keys(w.r.tally)).map(function (k) { return k + '×' + w.r.tally[k]; }).join('，');
        var amt = w.r.floating.length ? '含浮动奖，金额看官方公告' : '奖金 ' + LT.fmtMoney(w.r.fixed) + ' 元';
        notify('win' + w.t.id + w.d.code, (w.t.kind === 'sim' ? '模拟票中奖了' : '中奖了！') + G.name + ' 第' + LT.issueShort(g, w.d.code) + '期', lv + '，' + amt);
      });
    }
    kvSet('seen', JSON.stringify(seen));
    var msg = msgs.length ? '查到新开奖：' + msgs.join('、') : '没有新开奖';
    kvSet('lastMsg', msg);
    resolve({ msg: msg });
  } catch (e) { reject(e); }
});
