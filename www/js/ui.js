/* 快乐密码 · 界面公共部件 */
(function () {
'use strict';
const LT = window.LT;
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = LT.pad2;
const WEEK = '日一二三四五六';
const wk = (iso) => WEEK[new Date(iso + 'T12:00:00Z').getUTCDay()];
const md = (iso) => iso ? `${+iso.slice(5, 7)}月${+iso.slice(8, 10)}日` : '';
const mdw = (iso) => iso ? `${md(iso)} 周${wk(iso)}` : '';
function money(v) { // 元 → 读得懂的金额
  if (v == null) return '—';
  if (v >= 1e8) return (v / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(v >= 1e6 ? 0 : 1).replace(/\.0$/, '') + '万';
  return LT.fmtMoney(v);
}
function ago(ts) { if (!ts) return '从未'; const m = Math.round((Date.now() - ts) / 60000); if (m < 1) return '刚刚'; if (m < 60) return m + ' 分钟前'; const h = Math.round(m / 60); if (h < 48) return h + ' 小时前'; return Math.round(h / 24) + ' 天前'; }

/* 图标：线条风格，路径都是手画的简单几何 */
const I = {
  draw: '<svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="4.2"/><circle cx="16.4" cy="14.6" r="4.2"/><path d="M8 7.4v3.2M16.4 13v3.2"/></svg>',
  pick: '<svg viewBox="0 0 24 24"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M5 16l4.5-5 3.5 3 6-7"/><circle cx="19" cy="7" r="1.2"/></svg>',
  mine: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-8 9"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  // 选号方式
  random: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/></svg>',
  hot: '<svg viewBox="0 0 24 24"><path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-3.9-3-6.3-4.3-10.3-2.6 2-3.4 4.3-3.3 6.3-1-.6-1.8-1.8-2-3C7.4 9.6 5.5 12 5.5 14.8 5.5 18.4 8 21 12 21z"/></svg>',
  cold: '<svg viewBox="0 0 24 24"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2"/></svg>',
  shape: '<svg viewBox="0 0 24 24"><path d="M3 15c2.2 0 2.2-6 4.5-6s2.2 6 4.5 6 2.2-6 4.5-6 2.2 6 4.5 6"/></svg>',
  birthday: '<svg viewBox="0 0 24 24"><path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 15.5c1.3 1.2 2.7 1.2 4 0s2.7-1.2 4 0 2.7 1.2 4 0 2.7-1.2 4 0"/><path d="M12 11V8M12 5.5v-.5"/></svg>',
  zodiac: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/></svg>',
  wuxing: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a4.25 4.25 0 0 1 0 8.5 4.25 4.25 0 0 0 0 8.5"/><circle cx="12" cy="7.8" r="1"/><circle cx="12" cy="16.2" r="1"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/><circle cx="12" cy="15" r="1.6"/></svg>',
  words: '<svg viewBox="0 0 24 24"><path d="M5 18l-1 3 3.5-1.6A9 9 0 1 0 5 18z"/><path d="M9 10.5h6M9 13.5h4"/></svg>'
};

/* 号码球 */
function ball(v, cls, digit) { return `<span class="ball ${cls || ''}">${digit ? v : pad(v)}</span>`; }
// 开奖号码
function drawBalls(g, d, size) {
  const G = LT.GAMES[g]; const s = size || '';
  if (!d) return '';
  if (G.kind === 'lotto') return `<span class="balls">${d.n.map(x => ball(x, s)).join('')}${d.s.length ? `<span class="plus">+</span>${d.s.map(x => ball(x, 'b ' + s)).join('')}` : ''}</span>`;
  if (G.kind === 'keno') return `<span class="balls">${d.n.map(x => ball(x, s || 'sm')).join('')}</span>`;
  if (G.kind === 'digit') return `<span class="balls">${d.n.map(x => ball(x, s, true)).join('')}</span>`;
  if (G.kind === 'qxc') return `<span class="balls">${d.n.map(x => ball(x, s, true)).join('')}<span class="plus">+</span>${ball(d.s[0], 'b ' + s, true)}</span>`;
  return '';
}
// 投注行；给了 draw 就把没中的号码画成空心
function lineBalls(g, L, draw, size) {
  const G = LT.GAMES[g]; const s = size || 'sm';
  const hitN = (x) => !draw || draw.n.includes(x), hitS = (x) => !draw || (draw.s || []).includes(x);
  if (G.kind === 'lotto') {
    const spec = (x) => g === 'qlc' && draw && draw.s.includes(x);
    const mk = (x, dan) => ball(x, (spec(x) ? 'g ' : '') + (hitN(x) || spec(x) ? '' : 'miss ') + (dan ? 'dan ' : '') + s);
    const mkB = (x, dan) => ball(x, 'b ' + (hitS(x) ? '' : 'miss ') + (dan ? 'dan ' : '') + s);
    return `<span class="balls">${(L.fd || []).map(x => mk(x, 1)).join('')}${(L.f || []).map(x => mk(x)).join('')}${G.sub ? `<span class="plus">+</span>${(L.bd || []).map(x => mkB(x, 1)).join('')}${(L.b || []).map(x => mkB(x)).join('')}` : ''}</span>`;
  }
  if (G.kind === 'keno') return `<span class="balls"><span class="badge sim">${LT.KENO_NAME[L.k] || ''}</span>${(L.fd || []).map(x => ball(x, (hitN(x) ? '' : 'miss ') + 'dan ' + s)).join('')}${(L.f || []).map(x => ball(x, (hitN(x) ? '' : 'miss ') + s)).join('')}</span>`;
  if (G.kind === 'digit') {
    if (L.play === 'zx') return `<span class="balls">${L.pos.map((a, i) => a.map(x => ball(x, (!draw || draw.n[i] === x ? '' : 'miss ') + s, true)).join('')).join('<span class="plus">·</span>')}</span>`;
    const ds = L.d || L.f || [];
    return `<span class="balls"><span class="badge sim">${LT.PLAY_NAME[L.play]}</span>${ds.map(x => ball(x, (!draw || draw.n.includes(x) ? '' : 'miss ') + s, true)).join('')}</span>`;
  }
  if (G.kind === 'qxc') return `<span class="balls">${L.pos.map((a, i) => a.map(x => ball(x, (!draw || draw.n[i] === x ? '' : 'miss ') + s, true)).join('')).join('<span class="plus">·</span>')}<span class="plus">+</span>${(L.b || []).map(x => ball(x, 'b ' + (!draw || draw.s[0] === x ? '' : 'miss ') + s, true)).join('')}</span>`;
  return '';
}
function lineText(g, L) {
  const G = LT.GAMES[g];
  if (G.kind === 'lotto') { const f = (L.fd && L.fd.length ? '胆' + L.fd.map(pad).join(' ') + ' 拖' : '') + (L.f || []).map(pad).join(' ');
    if (!G.sub) return f; const b = (L.bd && L.bd.length ? '胆' + L.bd.map(pad).join(' ') + ' 拖' : '') + (L.b || []).map(pad).join(' '); return f + ' + ' + b; }
  if (G.kind === 'keno') return LT.KENO_NAME[L.k] + ' ' + (L.fd && L.fd.length ? '胆' + L.fd.map(pad).join(' ') + ' 拖' : '') + (L.f || []).map(pad).join(' ');
  if (G.kind === 'digit') return L.play === 'zx' ? '直选 ' + L.pos.map(a => a.join('')).join(' | ') : LT.PLAY_NAME[L.play] + ' ' + (L.d || L.f).join(' ');
  if (G.kind === 'qxc') return L.pos.map(a => a.join('')).join(' ') + ' + ' + (L.b || []).join(',');
  return '';
}

/* 提示 */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function haptic() { try { const H = window.HB.plugin('Haptics'); if (window.HB.isNative && H) H.impact({ style: 'LIGHT' }); } catch (e) {} }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制'); return true; }
  catch (e) { try { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('已复制'); return true; } catch (e2) { toast('复制没成功'); return false; } }
}

window.U = { $, esc, pad, wk, md, mdw, money, ago, I, ball, drawBalls, lineBalls, lineText, toast, haptic, copy };
})();
