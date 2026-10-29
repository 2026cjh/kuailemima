/* 红蓝 · 对奖：拍票识别 + 手动输入 */
(function () {
'use strict';
const LT = window.LT, U = window.U, App = window.App, S = window.S, HB = window.HB;
const { esc, I } = U; const Data = HB.Data;

function blankCur(g, man) {
  const G = LT.GAMES[g];
  if (G.kind === 'lotto') return { fd: [], f: [], bd: [], b: [] };
  if (G.kind === 'keno') return { k: man ? man.k : 5, fd: [], f: [] };
  if (G.kind === 'digit') { const play = man ? man.play : 'zx'; return play === 'zx' ? { play, pos: G.posLabels.map(() => []) } : { play, f: [] }; }
  return { pos: LT.range(1, 6).map(() => []), b: [] };
}
function newMan(g) { const d = Data.latest(g); const m = { g, issue: d ? d.code : '', mult: 1, add: false, lines: [], dan: false, k: 5, play: 'zx', show: false, scan: null }; m.cur = blankCur(g, m); return m; }
function man() { if (!S.check.man || S.check.man.g !== S.check.game) S.check.man = newMan(S.check.game); return S.check.man; }
App.loadDraft = (d, scan) => { // 识别结果填进编辑器
  S.check.game = d.game; const m = newMan(d.game);
  Object.assign(m, { issue: d.issue || m.issue, mult: d.mult || 1, add: !!d.add, lines: d.lines || [], show: !!(d.lines && d.lines.length && d.issue), scan });
  const L0 = (d.lines || [])[0]; if (L0 && L0.k) m.k = L0.k; if (L0 && L0.play) m.play = L0.play; m.cur = blankCur(d.game, m);
  S.check.man = m;
};

function editorGrid(g, m) {
  const G = LT.GAMES[g], c = m.cur; let h = '';
  const nb = (z, n, label, cls) => { const dz = z === 'f' ? 'fd' : 'bd'; const inD = (c[dz] || []).includes(n), inN = (c[z] || []).includes(n);
    return `<button type="button" class="nb ${cls || ''} ${inD ? 'dan' : ''}" data-act="mn" data-z="${z}" data-n="${n}" aria-pressed="${inD || inN}">${label}</button>`; };
  if (G.kind === 'lotto') {
    h += `<div class="opt"><span class="lbl">选胆码<small>胆拖票：打开后点胆码，再关掉点拖码</small></span><button type="button" class="switch" role="switch" aria-checked="${m.dan}" data-act="mdan" aria-label="选胆码"></button></div>`;
    h += `<div class="sec-title" style="padding:0">${G.main.label}</div><div class="grid">${LT.range(G.main.min, G.main.max).map(n => nb('f', n, U.pad(n))).join('')}</div>`;
    if (G.sub) h += `<div class="sec-title" style="padding:0">${G.sub.label}</div><div class="grid">${LT.range(G.sub.min, G.sub.max).map(n => nb('b', n, U.pad(n), 'b')).join('')}</div>`;
  } else if (G.kind === 'keno') {
    h += `<div class="stepper" style="justify-content:flex-start">${G.picks.map(k => `<button type="button" data-act="mk" data-k="${k}" aria-pressed="${m.k === k}">${LT.KENO_NAME[k]}</button>`).join('')}</div>`;
    h += `<div class="opt"><span class="lbl">选胆码</span><button type="button" class="switch" role="switch" aria-checked="${m.dan}" data-act="mdan" aria-label="选胆码"></button></div>`;
    h += `<div class="grid">${LT.range(1, 80).map(n => nb('f', n, U.pad(n))).join('')}</div>`;
  } else if (G.kind === 'digit') {
    if (G.plays.length > 1) h += `<div class="seg">${G.plays.map(p => `<button type="button" data-act="mplay" data-p="${p}" aria-pressed="${m.play === p}">${LT.PLAY_NAME[p]}</button>`).join('')}</div>`;
    if (m.play === 'zx') G.posLabels.forEach((lb, i) => { h += `<div class="posrow"><span class="poslab">${lb}</span><div class="grid d10">${LT.range(0, 9).map(d => `<button type="button" class="nb" data-act="mpos" data-p="${i}" data-n="${d}" aria-pressed="${c.pos[i].includes(d)}">${d}</button>`).join('')}</div></div>`; });
    else h += `<p class="tiny faint">${m.play === 'z3' ? '组选3：选 2 个以上不同数字，开奖号有一对相同、且都在你选的数字里就中' : '组选6：选 3 个以上不同数字，开奖号三个都不同、且都在你选的数字里就中'}</p>
      <div class="grid d10">${LT.range(0, 9).map(d => `<button type="button" class="nb" data-act="mn" data-z="f" data-n="${d}" aria-pressed="${c.f.includes(d)}">${d}</button>`).join('')}</div>`;
  } else {
    G.posLabels.forEach((lb, i) => { h += `<div class="posrow"><span class="poslab">${lb}</span><div class="grid d10">${LT.range(0, 9).map(d => `<button type="button" class="nb" data-act="mpos" data-p="${i}" data-n="${d}" aria-pressed="${c.pos[i].includes(d)}">${d}</button>`).join('')}</div></div>`; });
    h += `<div class="posrow"><span class="poslab">第7位</span><div class="grid d15">${LT.range(0, 14).map(d => `<button type="button" class="nb b" data-act="mn" data-z="b" data-n="${d}" aria-pressed="${c.b.includes(d)}">${d}</button>`).join('')}</div></div>`;
  }
  return h;
}

function editorHTML() {
  const m = man(), g = m.g, G = LT.GAMES[g]; const c = m.cur; const n = LT.lineBets(g, c); const issue = LT.lineIssues(g, c);
  const tk = { game: g, issue: m.issue, lines: m.lines, mult: m.mult, add: m.add };
  let h = `<div class="glass card" id="editor"><div class="card-head"><h2>${m.scan ? '核对识别结果' : '手动输入'}</h2>${m.scan ? '<button type="button" class="btn sm ghost" data-act="mreset">清空重来</button>' : ''}</div>`;
  if (m.scan) h += `<div class="row">${m.scan.img ? `<img class="thumb" src="${esc(m.scan.img)}" alt="彩票照片">` : ''}<p class="small grow">认出 ${m.lines.length} 行号码。和票面对一下，有错就删掉那行重新点。${m.scan.notes && m.scan.notes.length ? `<br><span class="faint">没认出的行：${esc(m.scan.notes.slice(0, 3).join(' / '))}</span>` : ''}</p></div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 92px;gap:8px"><div class="field"><label for="m-issue">期号（7 位，如 ${Data.latest(g) ? Data.latest(g).code : '2026124'}）</label><input type="tel" id="m-issue" maxlength="7" value="${esc(m.issue)}"></div>
    <div class="field"><label for="m-mult">倍数</label><input type="number" id="m-mult" min="1" max="99" value="${m.mult}"></div></div>`;
  if (G.addPrice) h += `<div class="opt"><span class="lbl">这张票有追加</span><button type="button" class="switch" role="switch" aria-checked="${m.add}" data-act="madd2" aria-label="追加"></button></div>`;
  if (m.lines.length) h += `<div class="sec-title" style="padding:0">已输入 ${m.lines.length} 行 · ${LT.ticketBets(tk)} 注 · ${LT.ticketCost(tk)} 元</div>
    <div class="mlines">${m.lines.map((L, i) => `<div class="mline">${U.lineBalls(g, L, null, g === 'kl8' ? 'xs' : 'sm')}<button type="button" class="btn sm ghost" data-act="mdel" data-i="${i}">删除</button></div>`).join('')}</div>`;
  h += `<div class="sec-title" style="padding:0">${m.lines.length ? '再加一行' : '点选号码'}</div>${editorGrid(g, m)}
    <div class="row between"><span class="small ${n ? '' : 'faint'}">${n ? `这一行 ${n} 注` : esc(issue)}</span>
    <span class="row"><button type="button" class="btn sm ghost" data-act="mclear">清空</button><button type="button" class="btn sm primary" data-act="maddline" ${n ? '' : 'disabled'}>加入这一行</button></span></div>`;
  if (m.lines.length) h += `<div class="row"><button type="button" class="btn primary" data-act="mcheck">对奖</button><button type="button" class="btn" data-act="msave" data-k="real">存为实票</button><button type="button" class="btn ghost" data-act="msave" data-k="sim">存为模拟</button></div>`;
  if (m.show && m.lines.length) h += App.prizeHTML(tk);
  return h + '</div>';
}

App.pages.check = () => {
  const sc = S.check.scan; const can = HB.isNative && !!HB.plugin('TicketOcr');
  let h = `<header class="lt"><div><h1>对奖</h1><p>拍彩票自动读号，或者手动输入</p></div></header>`;
  h += `<div class="glass card scan-hero"><div class="lens">${I.scan}</div>`;
  if (sc.st === 'busy') h += `<div class="row">${sc.img ? `<img class="thumb" src="${esc(sc.img)}" alt="彩票照片">` : ''}<span class="spin"></span><span class="muted">正在读票面…</span></div>`;
  else if (can) h += `<p class="small muted">对准彩票正面，让号码区域占满画面，光线均匀、别反光。识别在手机上完成，不上传照片。</p>
      <div class="row" style="justify-content:center"><button type="button" class="btn primary" data-act="snap" data-src="CAMERA">${I.camera.replace('<svg', '<svg class="ico"')}拍照</button><button type="button" class="btn" data-act="snap" data-src="PHOTOS">${I.image.replace('<svg', '<svg class="ico"')}从相册选</button></div>`;
  else h += '<p class="small muted">拍票识别要在安卓 App 里用。这里可以用下面的手动输入。</p>';
  if (sc.st === 'fail') h += `<p class="note warn">${esc(sc.msg)}</p>${sc.raw ? `<details><summary class="small faint">查看识别出的文字</summary><div class="rawtext">${esc(sc.raw)}</div></details>` : ''}`;
  h += '</div>';
  h += App.gameChips(S.check.game, 'cgame');
  h += editorHTML();
  return h;
};

App.acts.cgame = (a) => { S.check.game = a.dataset.g; S.check.man = null; };
App.acts.mreset = () => { S.check.man = newMan(S.check.game); S.check.scan = { st: 'idle' }; };
App.acts.mdan = () => { man().dan = !man().dan; };
App.acts.mk = (a) => { const m = man(); m.k = +a.dataset.k; m.cur = blankCur(m.g, m); };
App.acts.mplay = (a) => { const m = man(); m.play = a.dataset.p; m.cur = blankCur(m.g, m); };
App.acts.madd2 = () => { man().add = !man().add; man().show = false; };
App.acts.mclear = () => { const m = man(); m.cur = blankCur(m.g, m); };
App.acts.mdel = (a) => { const m = man(); m.lines.splice(+a.dataset.i, 1); m.show = false; };
App.acts.mpos = (a) => { const m = man(); const p = +a.dataset.p, n = +a.dataset.n; const arr = m.cur.pos[p]; const i = arr.indexOf(n);
  if (i >= 0) arr.splice(i, 1); else { arr.push(n); arr.sort((x, y) => x - y); } U.haptic(); };
App.acts.mn = (a) => {
  const m = man(), G = LT.GAMES[m.g], c = m.cur; const z = a.dataset.z, n = +a.dataset.n; const dz = z === 'f' ? 'fd' : 'bd';
  if (G.kind === 'qxc' && z === 'b') { const i = c.b.indexOf(n); if (i >= 0) c.b.splice(i, 1); else { c.b.push(n); c.b.sort((x, y) => x - y); } U.haptic(); return; }
  if (c[dz] && c[dz].includes(n)) c[dz] = c[dz].filter(x => x !== n);
  else if (c[z].includes(n)) c[z] = c[z].filter(x => x !== n);
  else if (m.dan && c[dz]) {
    const maxD = G.kind === 'keno' ? m.k - 1 : z === 'f' ? G.main.n - 1 : (G.sub ? G.sub.n - 1 : 0);
    if (maxD < 1) { c[z].push(n); c[z].sort((x, y) => x - y); U.toast('这里不能设胆码，已作为普通号码'); }
    else if (c[dz].length >= maxD) U.toast(`胆码最多 ${maxD} 个`); else { c[dz].push(n); c[dz].sort((x, y) => x - y); }
  } else {
    const lim = G.kind === 'keno' ? 20 : G.kind === 'lotto' ? (z === 'f' ? 20 : G.sub ? G.sub.max : 0) : 10;
    if (c[z].length >= lim) U.toast(`最多选 ${lim} 个`); else { c[z].push(n); c[z].sort((x, y) => x - y); }
  }
  U.haptic();
};
App.acts.maddline = () => { const m = man(); if (!LT.lineBets(m.g, m.cur)) return; m.lines.push(m.cur); m.cur = blankCur(m.g, m); m.dan = false; m.show = false; };
const issueOk = (m) => /^20\d{5}$/.test(m.issue);
App.acts.mcheck = () => { const m = man(); if (!issueOk(m)) { U.toast('期号是 7 位数字，如 ' + (Data.latest(m.g) ? Data.latest(m.g).code : '2026124')); return; } m.show = true;
  setTimeout(() => { const el = document.querySelector('#editor .prize'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40); };
App.acts.msave = async (a) => { const m = man(); if (!issueOk(m)) { U.toast('期号是 7 位数字，如 ' + (Data.latest(m.g) ? Data.latest(m.g).code : '2026124')); return; }
  const kind = a.dataset.k;
  await App.addTicket({ id: App.uid(), game: m.g, issue: m.issue, lines: m.lines, mult: m.mult, add: !!(LT.GAMES[m.g].addPrice && m.add), kind, method: m.scan ? '拍票录入' : '手动录入', createdAt: Date.now() });
  U.toast(kind === 'real' ? '已存为实票' : '已存为模拟'); S.check.man = newMan(m.g); S.check.scan = { st: 'idle' }; };
App.inputs['m-issue'] = (t) => { const m = man(); const v = t.value.replace(/\D/g, '').slice(0, 7); if (v !== t.value) t.value = v; m.issue = v; m.show = false; return false; };
App.inputs['m-mult'] = (t) => { man().mult = Math.min(99, Math.max(1, parseInt(t.value, 10) || 1)); man().show = false; return false; };
App.changes['m-mult'] = () => true;

/* 拍票识别 */
App.acts.snap = async (a) => {
  const Cam = HB.plugin('Camera'), Ocr = HB.plugin('TicketOcr'); if (!Cam || !Ocr) { U.toast('这台手机用不了拍照识别'); return 'noRender'; }
  let photo;
  try { photo = await Cam.getPhoto({ quality: 85, resultType: 'uri', source: a.dataset.src, correctOrientation: true, width: 2200, saveToGallery: false }); }
  catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) U.toast('没拍成：' + (e.message || e)); return 'noRender'; }
  const img = photo.webPath || (window.Capacitor.convertFileSrc ? window.Capacitor.convertFileSrc(photo.path) : '');
  S.check.scan = { st: 'busy', img }; App.render();
  try {
    const r = await Ocr.recognize({ path: photo.path || photo.webPath });
    const text = (r && r.text) || '';
    const d = window.OCR.parseTicket(text, S.check.game);
    if (!d.ok) { S.check.scan = { st: 'fail', img, msg: d.msg, raw: text };
      if (d.game) { S.check.game = d.game; S.check.man = null; } }
    else { App.loadDraft(d, { img, notes: d.notes, raw: text }); S.check.scan = { st: 'idle' };
      U.toast(`认出${LT.GAMES[d.game].name}，请核对号码`);
      setTimeout(() => { const el = document.getElementById('editor'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
  } catch (e) { S.check.scan = { st: 'fail', img, msg: '识别出错：' + (e.message || e) + '。可以用下面的手动输入。' }; }
  App.render(); return 'noRender';
};
})();
