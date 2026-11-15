// Launch Radar dashboard. Renders everything from window.RADAR (data.js);
// no network, no framework. All numbers come from the data, never hardcoded.
(function () {
'use strict';
var R = window.RADAR, M = R.meta, ROWS = R.rows, LIVE = R.live_rows, ASIDE = R.aside_rows, COMPS = R.comps;
var $ = function (id) { return document.getElementById(id); };

// ---- formatting ----
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function round2(x) { return Math.round(x * 100) / 100; }
function int(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function usd(n) {
  var a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}
function m2(n, sign) {
  var cents = Math.round(Math.abs(n) * 100);
  var w = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  var c = (cents % 100).toString().padStart(2, '0');
  return (n < 0 ? '-' : (sign && n > 0 ? '+' : '')) + '$' + w + '.' + c;
}
function ageFmt(d) { if (d === null || d === undefined) return '—'; if (d < 365) return d + 'd'; return (d / 365).toFixed(1) + 'y'; }
function chgFmt(c) { if (c === null || c === undefined) return '<span class="mut">—</span>'; var cls = c > 0 ? 'teal' : (c < 0 ? 'red' : 'mut'); return '<span class="' + cls + '">' + (c > 0 ? '+' : '') + c.toFixed(1) + '%</span>'; }
function verdictCls(v) { return v === 'FARM' ? 'teal' : (v === 'THIN' ? 'amber' : 'red'); }
function tickLabel(v) { if (v >= 1e9) return '$' + (v / 1e9) + 'B'; if (v >= 1e6) return '$' + (v / 1e6) + 'M'; return '$' + (v / 1e3) + 'K'; }
function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }

// ---- state + hash ----
var S = { tab: 'board', q: '', fam: '', cat: '', chain: '', verdict: '', tier: '', minTvl: 0, capital: 1000, share: 0.10, sort: 'value', dir: -1, tq: '', tsort: 'mcap', tdir: -1, detail: null };
function parseHash() {
  // Reset every hash-managed field: a hash that omits a key clears it.
  S.tab = 'board'; S.detail = null; S.fam = ''; S.cat = ''; S.chain = ''; S.verdict = ''; S.tier = ''; S.q = ''; S.capital = 1000; S.share = 0.10;
  var h = location.hash.replace(/^#/, '');
  if (!h) return;
  h.split('&').forEach(function (kv) {
    var p = kv.split('='), k = p[0], v = decodeURIComponent(p[1] || '');
    if (k === 'tab' && ['board', 'trades', 'aside', 'method'].indexOf(v) >= 0) S.tab = v;
    else if (k === 'detail') S.detail = v;
    else if (k === 'fam') S.fam = v;
    else if (k === 'cat') S.cat = v;
    else if (k === 'chain') S.chain = v;
    else if (k === 'verdict') S.verdict = v;
    else if (k === 'tier') S.tier = v;
    else if (k === 'watchlist' && v === '1') S.tier = 'watchlist';
    else if (k === 'q') S.q = v;
    else if (k === 'capital' && [100, 1000, 10000].indexOf(+v) >= 0) S.capital = +v;
    else if (k === 'share' && [0.05, 0.10, 0.20].indexOf(+v) >= 0) S.share = +v;
  });
}
function writeHash() {
  var p = [];
  if (S.detail) p.push('detail=' + encodeURIComponent(S.detail));
  else {
    if (S.tab !== 'board') p.push('tab=' + S.tab);
    if (S.fam) p.push('fam=' + encodeURIComponent(S.fam));
    if (S.cat) p.push('cat=' + encodeURIComponent(S.cat));
    if (S.chain) p.push('chain=' + encodeURIComponent(S.chain));
    if (S.verdict) p.push('verdict=' + S.verdict);
    if (S.tier) p.push('tier=' + S.tier);
    if (S.q) p.push('q=' + encodeURIComponent(S.q));
    if (S.capital !== 1000) p.push('capital=' + S.capital);
    if (S.share !== 0.10) p.push('share=' + S.share);
  }
  history.replaceState(null, '', p.length ? '#' + p.join('&') : '#');
}

// ---- economics, recomputed live from the row's stored factors ----
function econAt(r, cap, share) {
  var slice = round2((cap / (r.tvl_usd + cap)) * share * r.implied_value_usd);
  var fees = r.econ.fees_usd;
  var tb = round2(cap * M.economics.tbill_rate * (M.economics.hold_days / 365));
  var net = round2(slice - fees - tb);
  var verdict = net > 0 ? 'FARM' : (slice > fees ? 'THIN' : 'SKIP');
  return { slice: slice, fees: fees, tb: tb, net: net, verdict: verdict, ph: round2(net / (M.economics.work_minutes / 60)) };
}

// ---- log-log scatter helper ----
function logScatter(o) {
  var W = o.w, H = o.h, pl = 36, pb = 16, pt = 6, pr = 8;
  var lx0 = Math.log10(o.x0), lx1 = Math.log10(o.x1), ly0 = Math.log10(o.y0), ly1 = Math.log10(o.y1);
  function X(v) { return pl + (Math.log10(v) - lx0) / (lx1 - lx0) * (W - pl - pr); }
  function Y(v) { return pt + (1 - (Math.log10(v) - ly0) / (ly1 - ly0)) * (H - pt - pb); }
  var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
  for (var e = Math.ceil(lx0); e <= Math.floor(lx1); e++) {
    var gx = X(Math.pow(10, e));
    s += '<line class="grid" x1="' + gx + '" y1="' + pt + '" x2="' + gx + '" y2="' + (H - pb) + '"/>';
    var first = e === Math.ceil(lx0), last = e === Math.floor(lx1);
    var anchor = first ? 'start' : (last ? 'end' : 'middle');
    var tx = first ? gx + 2 : (last ? W - 2 : gx);
    s += '<text x="' + tx + '" y="' + (H - 4) + '" text-anchor="' + anchor + '">' + tickLabel(Math.pow(10, e)) + '</text>';
  }
  for (var f = Math.ceil(ly0); f <= Math.floor(ly1); f++) {
    var gy = Y(Math.pow(10, f));
    s += '<line class="grid" x1="' + pl + '" y1="' + gy + '" x2="' + (W - pr) + '" y2="' + gy + '"/>';
    s += '<text x="' + (pl - 4) + '" y="' + (gy + 3) + '" text-anchor="end">' + tickLabel(Math.pow(10, f)) + '</text>';
  }
  if (o.band) {
    var up = [], dn = [];
    for (var k = 0; k <= 8; k++) {
      var xv = Math.pow(10, lx0 + (lx1 - lx0) * k / 8);
      up.push(X(xv) + ',' + Y(Math.min(o.y1, Math.max(o.y0, 3 * xv))));
      dn.push(X(xv) + ',' + Y(Math.min(o.y1, Math.max(o.y0, xv / 3))));
    }
    s += '<polygon class="band" points="' + up.join(' ') + ' ' + dn.reverse().join(' ') + '"/>';
  }
  if (o.diag) s += '<line class="diag" x1="' + X(Math.max(o.x0, o.y0)) + '" y1="' + Y(Math.max(o.x0, o.y0)) + '" x2="' + X(Math.min(o.x1, o.y1)) + '" y2="' + Y(Math.min(o.x1, o.y1)) + '"/>';
  if (o.line) {
    var pts = [];
    for (var i = 0; i <= 24; i++) {
      var xv2 = Math.pow(10, lx0 + (lx1 - lx0) * i / 24);
      pts.push(X(xv2).toFixed(1) + ',' + Y(o.line(xv2)).toFixed(1));
    }
    s += '<polyline class="curve" points="' + pts.join(' ') + '"/>';
  }
  (o.pts || []).forEach(function (p) {
    s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.r || 2) + '" fill="' + p.c + '"' + (p.o ? ' opacity="' + p.o + '"' : '') + '/>';
  });
  if (o.mark) s += '<circle cx="' + X(o.mark.x).toFixed(1) + '" cy="' + Y(o.mark.y).toFixed(1) + '" r="4.5" fill="none" stroke="#f5a524" stroke-width="2"/>';
  s += '</svg>';
  return s;
}

// ---- header + hero ----
function renderHeader() {
  $('subtitle').textContent = 'DefiLlama snapshot ' + M.as_of + ' · ' + int(M.totals.protocols_scanned) + ' protocols over $5M TVL · one model prices the page and board.json';
  $('badgeWatch').textContent = 'Watchlist ' + M.totals.watchlist + '/' + M.totals.watchlist + ' on board';
  $('badgeRows').textContent = 'Page = board.json ' + M.totals.ranked + '/' + M.totals.ranked + ' rows';
}

function renderHero() {
  var t = M.totals, v = t.verdicts;
  $('heroPanel').innerHTML =
    '<div class="lede">' + t.ranked + ' protocols record no token. Here is what each launch would be worth, and what farming it costs.</div>' +
    '<p class="small">Each value is read off a curve fitted to the ' + M.curve.n_comps + ' tokens that already trade, then adjusted for 7-day TVL growth and time without a token. No name is hand-picked. Every row has a farm plan with a dollar cost and minutes per step, netted against the T-bill yield the capital gives up.</p>' +
    '<div class="chips">' +
    '<span class="chip">Ranked <b>' + t.ranked + '</b></span>' +
    '<span class="chip">Token trades kept apart <b>' + t.live + '</b></span>' +
    '<span class="chip">Set aside <b>' + t.set_aside + '</b></span>' +
    '<span class="chip"><span class="teal">FARM ' + v.farm + '</span> · <span class="amber">THIN ' + v.thin + '</span> · <span class="red">SKIP ' + v.skip + '</span> at $1.0K</span>' +
    '<span class="chip">Total implied <b class="amber">' + usd(t.total_implied_usd) + '</b></span>' +
    '<span class="chip">Median <b>' + usd(t.median_implied_usd) + '</b></span></div>';
  var wl = ROWS.filter(function (r) { return r.watchlist; }).slice().sort(function (a, b) { return b.econ.per_hour_usd - a.econ.per_hour_usd; }).slice(0, 2);
  var bt = M.backtest;
  $('pricePanel').innerHTML =
    '<h2>How a launch is priced</h2>' +
    '<div class="formula">value = 10^' + M.curve.a.toFixed(4) + ' × (TVL/$100M)^' + M.curve.b.toFixed(4) + '\n        × family × growth × seasoning × sibling</div>' +
    '<table><tr><th></th><th class="num">Model</th><th class="num">Flat</th></tr>' +
    '<tr><td>Blind miss, each token left out</td><td class="num">x' + bt.loo.median_miss + '</td><td class="num">x' + bt.loo_flat.median_miss + '</td></tr>' +
    '<tr><td>Time split, fit pre-2024, test newer</td><td class="num">x' + bt.time_split.median_miss + '</td><td class="num">x' + bt.time_split_flat.median_miss + '</td></tr>' +
    '<tr><td>Within 3x of the real cap</td><td class="num">' + bt.loo.within3 + '%</td><td class="num">' + bt.loo_flat.within3 + '%</td></tr>' +
    '<tr><td>Inside the blind 80% band</td><td class="num">' + bt.band.coverage + '%</td><td class="num">—</td></tr></table>' +
    '<p class="small">Best net per hour on the watchlist: <b>' + esc(wl[0].name) + '</b> ' + m2(wl[0].econ.per_hour_usd, true) + '/h, <b>' + esc(wl[1].name) + '</b> ' + m2(wl[1].econ.per_hour_usd, true) + '/h.</p>';
  var curveFn = function (x) { return Math.pow(10, M.curve.a + M.curve.b * Math.log10(x / 1e8)); };
  var pts = COMPS.map(function (c) { return { x: c.tvl_usd, y: c.mcap_usd, c: '#64748b', r: 2 }; });
  ROWS.forEach(function (r) { pts.push({ x: r.tvl_usd, y: r.implied_value_usd, c: '#f5a524', r: 2 }); });
  $('scatterPanel').innerHTML =
    '<h2>Traded tokens and the curve</h2>' +
    logScatter({ w: 400, h: 148, x0: 1e5, x1: 1e11, y0: 1e5, y1: 1e11, pts: pts, line: curveFn }) +
    '<p class="cap">Grey: ' + M.curve.n_comps + ' traded tokens, market cap on TVL. Amber: the board at its implied value. Line: the size curve before family offsets.</p>';
}

// ---- tabs ----
function renderTabs() {
  var t = M.totals;
  var tabs = [['board', 'No token yet ' + t.ranked], ['trades', 'Token trades ' + t.live], ['aside', 'Set aside ' + t.set_aside], ['method', 'Method and backtest']];
  $('tabs').innerHTML = tabs.map(function (x) {
    return '<button data-tab="' + x[0] + '" class="' + (S.tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
  }).join('');
}
function setTab(tab) {
  S.tab = tab; S.detail = null;
  ['board', 'trades', 'aside', 'method'].forEach(function (x) { $('tab-' + x).hidden = x !== tab; });
  $('detail').hidden = true;
  $('heroRow').hidden = false; $('tabs').hidden = false;
  renderTabs(); writeHash();
  if (tab === 'board') { buildControls(); renderBoard(); }
  if (tab === 'trades') renderTrades();
  if (tab === 'aside') renderAside();
  if (tab === 'method') renderMethod();
}

// ---- board controls ----
function uniqSorted(a) { return Array.from(new Set(a)).sort(); }
function capLabel(c) { return c === 100 ? '$100' : (c === 1000 ? '$1K' : '$10K'); }
function buildControls() {
  var fams = uniqSorted(ROWS.map(function (r) { return r.family; }));
  var cats = uniqSorted(ROWS.map(function (r) { return r.category || '(no category)'; }));
  var chains = uniqSorted(ROWS.reduce(function (a, r) { return a.concat(r.chains); }, []));
  function opts(list, cur, all) {
    return '<option value="">' + all + '</option>' + list.map(function (x) { return '<option value="' + esc(x) + '"' + (cur === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
  }
  $('controls').innerHTML =
    '<input id="c-q" type="search" placeholder="Search name/slug" value="' + esc(S.q) + '">' +
    '<select id="c-fam">' + opts(fams, S.fam, 'All families') + '</select>' +
    '<select id="c-cat">' + opts(cats, S.cat === '' ? '' : (S.cat || '(no category)'), 'All categories') + '</select>' +
    '<select id="c-chain">' + opts(chains, S.chain, 'All chains') + '</select>' +
    '<select id="c-verdict"><option value="">All verdicts</option>' + ['FARM', 'THIN', 'SKIP'].map(function (v) { return '<option' + (S.verdict === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
    '<select id="c-tier"><option value="">All tiers</option><option value="watchlist"' + (S.tier === 'watchlist' ? ' selected' : '') + '>Watchlist</option><option value="early"' + (S.tier === 'early' ? ' selected' : '') + '>Early</option><option value="sibling"' + (S.tier === 'sibling' ? ' selected' : '') + '>Sibling-linked</option></select>' +
    '<select id="c-tvl"><option value="0">Min TVL $0</option><option value="50000000"' + (S.minTvl === 50000000 ? ' selected' : '') + '>Min TVL $50M</option><option value="100000000"' + (S.minTvl === 100000000 ? ' selected' : '') + '>Min TVL $100M</option><option value="250000000"' + (S.minTvl === 250000000 ? ' selected' : '') + '>Min TVL $250M</option></select>' +
    '<label>Capital <select id="c-cap"><option value="100"' + (S.capital === 100 ? ' selected' : '') + '>$100</option><option value="1000"' + (S.capital === 1000 ? ' selected' : '') + '>$1,000</option><option value="10000"' + (S.capital === 10000 ? ' selected' : '') + '>$10,000</option></select></label>' +
    '<label>Airdrop <select id="c-share"><option value="0.05"' + (S.share === 0.05 ? ' selected' : '') + '>5%</option><option value="0.1"' + (S.share === 0.10 ? ' selected' : '') + '>10%</option><option value="0.2"' + (S.share === 0.20 ? ' selected' : '') + '>20%</option></select></label>' +
    '<label>Sort <select id="c-sort"><option value="value"' + (S.sort === 'value' ? ' selected' : '') + '>Implied value</option><option value="tvl"' + (S.sort === 'tvl' ? ' selected' : '') + '>TVL</option><option value="chg"' + (S.sort === 'chg' ? ' selected' : '') + '>7-day change</option><option value="age"' + (S.sort === 'age' ? ' selected' : '') + '>Age</option><option value="name"' + (S.sort === 'name' ? ' selected' : '') + '>Name</option><option value="net"' + (S.sort === 'net' ? ' selected' : '') + '>Net</option></select></label>' +
    '<button id="c-reset">Reset</button>';
  if (!buildControls.wired) {
    buildControls.wired = true;
    $('controls').addEventListener('input', onControl);
    $('controls').addEventListener('change', onControl);
  }
  $('c-reset').addEventListener('click', function () {
    S.q = ''; S.fam = ''; S.cat = ''; S.chain = ''; S.verdict = ''; S.tier = ''; S.minTvl = 0; S.capital = 1000; S.share = 0.10; S.sort = 'value'; S.dir = -1;
    buildControls(); renderBoard(); writeHash();
  });
}
function onControl(ev) {
  var id = ev.target.id;
  if (id === 'c-q') S.q = ev.target.value;
  else if (id === 'c-fam') S.fam = ev.target.value;
  else if (id === 'c-cat') S.cat = ev.target.value === '(no category)' ? null : ev.target.value;
  else if (id === 'c-chain') S.chain = ev.target.value;
  else if (id === 'c-verdict') S.verdict = ev.target.value;
  else if (id === 'c-tier') S.tier = ev.target.value;
  else if (id === 'c-tvl') S.minTvl = +ev.target.value;
  else if (id === 'c-cap') S.capital = +ev.target.value;
  else if (id === 'c-share') S.share = +ev.target.value;
  else if (id === 'c-sort') { S.sort = ev.target.value; S.dir = S.sort === 'name' ? 1 : -1; }
  else return;
  renderBoard(); writeHash();
}

// ---- board table ----
function boardFiltered() {
  var q = S.q.trim().toLowerCase();
  var out = ROWS.filter(function (r) {
    if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
    if (S.fam && r.family !== S.fam) return false;
    if (S.cat !== '' && S.cat !== undefined && (r.category || null) !== (S.cat === null ? null : S.cat)) return false;
    if (S.chain && r.chains.indexOf(S.chain) < 0) return false;
    if (S.minTvl && r.tvl_usd < S.minTvl) return false;
    if (S.tier === 'watchlist' && !r.watchlist) return false;
    if (S.tier === 'early' && !r.early) return false;
    if (S.tier === 'sibling' && !r.sibling) return false;
    if (S.verdict && econAt(r, S.capital, S.share).verdict !== S.verdict) return false;
    return true;
  });
  var key = S.sort, dir = S.dir;
  out.sort(function (a, b) {
    var d = 0;
    if (key === 'value') d = a.implied_value_usd - b.implied_value_usd;
    else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
    else if (key === 'chg') d = (a.change_7d === null ? -1e9 : a.change_7d) - (b.change_7d === null ? -1e9 : b.change_7d);
    else if (key === 'age') d = (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days);
    else if (key === 'name') d = a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    else if (key === 'net') d = econAt(a, S.capital, S.share).net - econAt(b, S.capital, S.share).net;
    if (d === 0) d = a.rank - b.rank;
    return d * dir;
  });
  return out;
}
function sortArrow(key) { return S.sort === key ? (S.dir === -1 ? ' ↓' : ' ↑') : ''; }
function badges(r) {
  var b = '';
  if (r.watchlist) b += ' <span class="badge wl">WATCHLIST</span>';
  if (r.early) b += ' <span class="badge er">EARLY</span>';
  if (r.sibling) b += ' <span class="badge sb">SIBLING</span>';
  return b;
}
function renderBoard() {
  var list = boardFiltered();
  $('countLine').textContent = 'Showing ' + list.length + ' of ' + ROWS.length + ' rows · capital ' + capLabel(S.capital) + ' · airdrop ' + Math.round(S.share * 100) + '% of value · hold 90 days';
  var h = '<thead><tr>' +
    '<th class="sort num" data-sort="value">Rank' + sortArrow('value') + '</th>' +
    '<th class="sort" data-sort="name">Protocol' + sortArrow('name') + '</th>' +
    '<th class="sort num" data-sort="tvl">TVL' + sortArrow('tvl') + '</th>' +
    '<th class="sort num" data-sort="chg">7d' + sortArrow('chg') + '</th>' +
    '<th class="sort num" data-sort="age">No token for' + sortArrow('age') + '</th>' +
    '<th class="sort num" data-sort="value">Implied value' + sortArrow('value') + '</th>' +
    '<th class="num">' + capLabel(S.capital) + ' slice</th>' +
    '<th class="sort num" data-sort="net">Net of all costs' + sortArrow('net') + '</th>' +
    '<th>Farm · fees · hold</th></tr></thead>';
  var body = list.map(function (r) {
    var e = econAt(r, S.capital, S.share);
    var pos = (Math.log10(r.implied_value_usd) - Math.log10(r.p10_usd)) / (Math.log10(r.p90_usd) - Math.log10(r.p10_usd)) * 100;
    pos = Math.max(0, Math.min(100, pos));
    return '<tr class="row" data-slug="' + esc(r.slug) + '">' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><b>' + esc(r.name) + '</b>' + badges(r) + '<span class="sub2 mono">' + esc(r.slug) + ' · ' + esc(r.family) + '</span></td>' +
      '<td class="num">' + usd(r.tvl_usd) + '</td>' +
      '<td class="num">' + chgFmt(r.change_7d) + '</td>' +
      '<td class="num">' + ageFmt(r.age_days) + '</td>' +
      '<td class="num"><span class="amber"><b>' + usd(r.implied_value_usd) + '</b></span><div class="rangebar"><i style="left:' + pos.toFixed(0) + '%"></i></div><span class="rangelab">' + usd(r.p10_usd) + ' – ' + usd(r.p90_usd) + '</span></td>' +
      '<td class="num">' + m2(e.slice) + '</td>' +
      '<td class="num"><span class="' + verdictCls(e.verdict) + '"><b>' + e.verdict + '</b></span> ' + m2(e.net, true) + '<span class="sub2">' + m2(e.ph, true) + '/h</span></td>' +
      '<td>' + esc(r.mechanism) + '<span class="sub2">' + esc(r.econ.plan_chain) + ' · ' + m2(e.fees) + ' fees · 90d hold · 2.3h work</span></td></tr>';
  }).join('');
  $('boardTable').innerHTML = h + '<tbody>' + body + '</tbody>';
  renderHist(list);
}
function renderHist(filtered) {
  var vals = ROWS.map(function (r) { return Math.log10(r.implied_value_usd); });
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), nb = 12, W = 900, H = 36;
  var all = new Array(nb).fill(0), kept = new Array(nb).fill(0);
  vals.forEach(function (v) { all[Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb))]++; });
  filtered.forEach(function (r) { var v = Math.log10(r.implied_value_usd); kept[Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb))]++; });
  var mx = Math.max.apply(null, all);
  var bw = W / nb;
  var s = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
  for (var i = 0; i < nb; i++) {
    var x = i * bw + 1;
    s += '<rect x="' + x + '" y="' + (H - all[i] / mx * (H - 4)) + '" width="' + (bw - 2) + '" height="' + (all[i] / mx * (H - 4)) + '" fill="#22345a"/>';
    s += '<rect x="' + x + '" y="' + (H - kept[i] / mx * (H - 4)) + '" width="' + (bw - 2) + '" height="' + (kept[i] / mx * (H - 4)) + '" fill="#f5a524"/>';
  }
  s += '</svg><p class="cap">How the board\'s implied values are distributed, log scale (' + usd(Math.pow(10, lo)) + ' to ' + usd(Math.pow(10, hi)) + '). Solid bars are the rows this filter keeps.</p>';
  $('histWrap').innerHTML = s;
}

// ---- trades tab (all live-token protocols) ----
function renderTrades() {
  var q = S.tq.trim().toLowerCase();
  var list = LIVE.filter(function (r) {
    return !q || r.name.toLowerCase().indexOf(q) >= 0 || r.slug.indexOf(q) >= 0;
  });
  list.sort(function (a, b) {
    var d = 0;
    if (S.tsort === 'mcap') d = (a.mcap_usd === null ? -1 : a.mcap_usd) - (b.mcap_usd === null ? -1 : b.mcap_usd);
    else if (S.tsort === 'tvl') d = a.tvl_usd - b.tvl_usd;
    else if (S.tsort === 'ratio') d = (a.ratio === null ? -1 : a.ratio) - (b.ratio === null ? -1 : b.ratio);
    else if (S.tsort === 'name') d = a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    if (d === 0) d = a.slug < b.slug ? -1 : 1;
    return d * S.tdir;
  });
  $('tradesCount').textContent = 'Showing ' + list.length + ' of ' + LIVE.length + ' tokens that already trade — the comparison set the curve is fitted on. These are never board rows.';
  function th(key, label) { return '<th class="sort num" data-tsort="' + key + '">' + label + (S.tsort === key ? (S.tdir === -1 ? ' ↓' : ' ↑') : '') + '</th>'; }
  var h = '<thead><tr><th class="sort" data-tsort="name">Protocol' + (S.tsort === 'name' ? (S.tdir === -1 ? ' ↓' : ' ↑') : '') + '</th>' + th('mcap', 'Market cap') + th('tvl', 'TVL') + th('ratio', 'Mcap / TVL') + '<th>Chains</th></tr></thead>';
  var body = list.map(function (r) {
    return '<tr><td><b>' + esc(r.name) + '</b><span class="sub2 mono">' + esc(r.slug) + (r.category ? ' · ' + esc(r.category) : '') + '</span></td>' +
      '<td class="num">' + (r.mcap_usd === null ? '<span class="mut">—</span>' : usd(r.mcap_usd)) + '</td>' +
      '<td class="num">' + usd(r.tvl_usd) + '</td>' +
      '<td class="num">' + (r.ratio === null ? '<span class="mut">—</span>' : r.ratio.toFixed(2) + 'x') + '</td>' +
      '<td class="mut">' + esc(r.chains.join(', ')) + '</td></tr>';
  }).join('');
  $('tradesTable').innerHTML = h + '<tbody>' + body + '</tbody>';
}
function buildTradesControls() {
  $('tradesControls').innerHTML = '<input id="t-q" type="search" placeholder="Search name/slug" value="' + esc(S.tq) + '">';
  $('t-q').addEventListener('input', function (ev) { S.tq = ev.target.value; renderTrades(); });
}

// ---- aside tab ----
function renderAside() {
  $('asideNote').textContent = M.totals.set_aside + ' pre-token protocols were set aside, not ranked: a wrapped or bridged product, a liquid staking product, a centralized exchange, a versioned release, or a sibling of a token that already trades is not a launch of its own. The top 40 by TVL are shown.';
  $('asideCounts').innerHTML = Object.keys(R.aside_counts).map(function (k) {
    return '<span class="chip">' + esc(k) + ' <b>' + R.aside_counts[k] + '</b></span>';
  }).join('');
  var h = '<thead><tr><th>Protocol</th><th class="num">TVL</th><th>Reason</th><th>Chains</th></tr></thead>';
  var body = ASIDE.map(function (r) {
    return '<tr><td><b>' + esc(r.name) + '</b><span class="sub2 mono">' + esc(r.slug) + (r.category ? ' · ' + esc(r.category) : '') + '</span></td>' +
      '<td class="num">' + usd(r.tvl_usd) + '</td><td>' + esc(r.reason) + '</td><td class="mut">' + esc(r.chains.join(', ')) + '</td></tr>';
  }).join('');
  $('asideTable').innerHTML = h + '<tbody>' + body + '</tbody>';
}

// ---- method tab ----
var SCEN_LABEL = { 'base': 'Base (fitted curve)', 'slope−': 'Slope b − 0.05', 'slope+': 'Slope b + 0.05', 'family×0.8': 'Family effects × 0.8', 'family×1.25': 'Family effects × 1.25' };
function renderMethod() {
  var t = M.totals, bt = M.backtest, fams = M.families;
  var pre = t.ranked + t.set_aside;
  var multAt = function (tvl) { return Math.pow(10, M.curve.a + M.curve.b * Math.log10(tvl / 1e8)) / tvl; };
  var seasAt = function (days) { return Math.pow(10, M.seasoning.coef_used * (Math.log10(days) - Math.log10(365))); };
  var famRows = Object.keys(fams).map(function (f) {
    return '<tr><td>' + esc(f) + '</td><td class="num">' + fams[f].n + '</td><td class="num">×' + fams[f].effect.toFixed(3) + '</td></tr>';
  }).join('');
  var looPts = COMPS.map(function (c) { return { x: c.loo, y: c.mcap_usd, c: '#64748b', r: 2.5 }; });
  var sc = M.sensitivity.scenarios;
  var scenRows = sc.map(function (s) {
    return '<tr><td>' + esc(SCEN_LABEL[s.name] || s.name) + '</td><td class="num">' + usd(s.median_implied_usd) + '</td><td class="num">' + s.verdicts.farm + ' / ' + s.verdicts.thin + ' / ' + s.verdicts.skip + '</td><td class="num">' + usd(s.top1_implied_usd) + '</td><td class="num">' + s.verdict_changes + '</td></tr>';
  }).join('');
  var slopeChg = Math.max(sc[1].verdict_changes, sc[2].verdict_changes);
  var famChg = Math.max(sc[3].verdict_changes, sc[4].verdict_changes);
  var stable = Math.max(slopeChg, famChg) <= Math.round(t.ranked * 0.15) ? 'stable' : 'fragile';
  $('methodBody').innerHTML = '<div class="method">' +
    '<section><h2>Universe</h2><p>The snapshot carries ' + int(t.protocols_scanned) + ' protocols at or above $5M TVL, fetched ' + M.as_of + '. ' + t.live + ' record a token and are kept apart as the comparison set. ' + pre + ' record no token; of those, ' + t.set_aside + ' are set aside by the house exclusion rule — bridges, liquid staking and restaking, restaked BTC, CEXs, exchange names, version listings, wrapped or staked names, siblings of traded tokens — leaving ' + t.ranked + ' rankable rows, all ' + t.watchlist + ' watchlist names included; a watchlist sibling stays at half value.</p></section>' +
    '<section><h2>Curve</h2><p>Comparables: the ' + M.curve.n_comps + ' traded tokens left after merging listings that share a token, dropping bridge categories and versioned listings, and trimming mcap/TVL outside [0.002, 50]. Fitted by least squares: log10(mcap) = ' + M.curve.a.toFixed(4) + ' + ' + M.curve.b.toFixed(4) + ' × log10(TVL/$100M), R² ' + M.curve.r2.toFixed(3) + '. A slope under 1 means small protocols trade at a higher multiple of TVL than large ones: the curve values a $10M-TVL protocol at about ' + multAt(1e7).toFixed(2) + '× its TVL and a $1B one at about ' + multAt(1e9).toFixed(2) + '×.</p></section>' +
    '<section><h2>Family</h2><p>Each category belongs to a family; a family\'s effect is the mean of its comparables\' curve-only log residuals, shrunk toward zero by n/(n+4). Shrinkage keeps a small family from swinging on one token.</p><table><thead><tr><th>Family</th><th class="num">Tokens</th><th class="num">Effect</th></tr></thead><tbody>' + famRows + '</tbody></table></section>' +
    '<section><h2>Growth and seasoning</h2><p>Growth: the 7-day change, clamped to ±30%, is projected two more weeks — projected TVL = TVL × (1+g)² — and the curve is read off the projected TVL. Seasoning: the fitted coefficient on log age is ' + M.seasoning.coef_fitted.toFixed(4) + ', shrunk 50% to ' + M.seasoning.coef_used.toFixed(4) + '; a 30-day protocol gets ×' + seasAt(30).toFixed(2) + ', a 5-year protocol ×' + seasAt(1825).toFixed(2) + ', a 1-year protocol ×1.00, clamped to [0.80, 1.15]. Factor check: the curve-only residuals correlate r = ' + bt.factor_check.r_growth.toFixed(2) + ' with 7-day growth and r = ' + bt.factor_check.r_age.toFixed(2) + ' with log age — the snapshot cannot confirm either effect, so both stay small; size and family carry the value.</p></section>' +
    '<section><h2>Tests</h2><p>Leave-one-out: each token is predicted by a curve and family effects fitted without it. The time split fits on tokens listed before 2024-01-01 (' + bt.time_split.n_train + ' tokens) and tests on the ' + bt.time_split.n_test + ' listed since. The flat baseline predicts with the median mcap/TVL of the others.</p><table><thead><tr><th>Model</th><th class="num">Median miss</th><th class="num">Within 3x</th><th class="num">Within 2x</th></tr></thead><tbody>' +
    '<tr><td>Curve + family (leave-one-out)</td><td class="num">x' + bt.loo.median_miss + '</td><td class="num">' + bt.loo.within3 + '%</td><td class="num">' + bt.loo.within2 + '%</td></tr>' +
    '<tr><td>Curve only (leave-one-out)</td><td class="num">x' + bt.loo_curve.median_miss + '</td><td class="num">' + bt.loo_curve.within3 + '%</td><td class="num">' + bt.loo_curve.within2 + '%</td></tr>' +
    '<tr><td>Flat median multiple (leave-one-out)</td><td class="num">x' + bt.loo_flat.median_miss + '</td><td class="num">' + bt.loo_flat.within3 + '%</td><td class="num">' + bt.loo_flat.within2 + '%</td></tr>' +
    '<tr><td>Time split, model</td><td class="num">x' + bt.time_split.median_miss + '</td><td class="num">' + bt.time_split.within3 + '%</td><td class="num">—</td></tr>' +
    '<tr><td>Time split, flat</td><td class="num">x' + bt.time_split_flat.median_miss + '</td><td class="num">' + bt.time_split_flat.within3 + '%</td><td class="num">—</td></tr></tbody></table>' +
    '<p>The P10–P90 band (' + bt.band.p10.toFixed(2) + '× to ' + bt.band.p90.toFixed(2) + '× the point estimate) holds ' + bt.band.coverage + '% of the leave-one-out residuals, against a nominal 80%.</p>' +
    logScatter({ w: 460, h: 260, x0: 1e5, x1: 1e11, y0: 1e5, y1: 1e11, pts: looPts, diag: true, band: true }) +
    '<p class="cap">Out of sample: x = leave-one-out predicted value, y = real market cap. The shaded band is within 3x of the diagonal.</p></section>' +
    '<section><h2>Sensitivity</h2><p>The verdicts rest on the fitted curve and family effects. This table re-prices all ' + t.ranked + ' rows under five scenarios — the fitted model, the slope shifted ±0.05, and every family effect scaled ×0.8 or ×1.25 — and counts how many verdicts move. The base row reproduces the board exactly.</p><table><thead><tr><th>Scenario</th><th class="num">Median implied</th><th class="num">FARM / THIN / SKIP</th><th class="num">Top-1 implied</th><th class="num">Verdicts changed</th></tr></thead><tbody>' + scenRows + '</tbody></table>' +
    '<p>Under a ±0.05 slope shift, ' + slopeChg + ' of ' + t.ranked + ' verdicts change; under ±20% family effects, ' + famChg + ' of ' + t.ranked + ' change — the FARM set is ' + stable + '.</p></section>' +
    '<section><h2>Farm plans</h2><p>Every row carries an 8-step plan: fund, verify, core play, second action, weekly upkeep, risk trigger, claim, exit. Seven paid transactions on the protocol\'s cheapest chain, 140 minutes of work, a 90-day hold. Slice = (capital / (TVL + capital)) × share × implied value. Fees = 7 × gas on the plan chain, plus a $2 bridge allowance when the plan chain is not Ethereum and the protocol is multi-chain. T-bill forgone = capital × 4% × 90/365. FARM when net &gt; $0; THIN when the slice beats the fees but not the T-bill; SKIP otherwise. No step promises an airdrop, a token, or a return.</p></section>' +
    '<section><h2>Limits</h2><p>One day of DefiLlama data. It does not say whether or when a token launches. Read the board as a ranking and an order of magnitude, not a price. A protocol that records no token may still have one its DefiLlama record does not carry.</p></section></div>';
}

// ---- detail view ----
var STEP_TXS = [1, 0, 2, 2, 0, 0, 1, 1];
var STEP_MIN = [5, 15, 15, 15, 65, 5, 10, 10];
function chgText(c) { if (c === null || c === undefined) return '—'; return (c > 0 ? '+' : '') + c.toFixed(1) + '%'; }
function whySentence(r) {
  var famMed = median(ROWS.map(function (x) { return x.model.family_effect; }));
  var gMed = median(ROWS.map(function (x) { return x.model.growth_pct; }));
  var m = r.model;
  var base = Math.pow(10, M.curve.a + M.curve.b * Math.log10(r.tvl_usd / 1e8));
  var growthF = m.curve_value_usd / base;
  var factors = [
    { f: m.family_effect, txt: 'its ' + r.family + ' family trades at ×' + m.family_effect.toFixed(2) + ' of the curve (board median ×' + famMed.toFixed(2) + ')' },
    { f: growthF, txt: 'its ' + chgText(m.growth_pct) + ' week ' + (m.growth_pct >= 0 ? 'lifts' : 'cuts') + ' projected TVL to ' + usd(m.projected_tvl_usd) + ' (board median ' + chgText(gMed) + ')' },
    { f: m.seasoning, txt: 'its ' + ageFmt(r.age_days) + ' without a token seasons it at ×' + m.seasoning.toFixed(2) },
  ];
  if (m.sibling_factor !== 1) factors.push({ f: 0.5, txt: 'it shares a first word with a traded token, so the value is halved' });
  var big = factors[0];
  factors.forEach(function (x) { if (Math.abs(Math.log10(x.f)) > Math.abs(Math.log10(big.f))) big = x; });
  return 'Why this ranks here: ' + big.txt + ' — the biggest single move on the curve value.';
}
function openDetail(slug) {
  var r = null;
  for (var i = 0; i < ROWS.length; i++) if (ROWS[i].slug === slug) { r = ROWS[i]; break; }
  if (!r) { S.detail = null; setTab('board'); return; }
  S.detail = slug;
  $('heroRow').hidden = true; $('tabs').hidden = true;
  ['board', 'trades', 'aside', 'method'].forEach(function (x) { $('tab-' + x).hidden = true; });
  $('detail').hidden = false;
  var e = r.econ, m = r.model;
  var recomputed = Math.round(m.curve_value_usd * m.family_effect * m.seasoning * m.sibling_factor);
  var match = recomputed === r.implied_value_usd;
  var near = COMPS.map(function (c) { return { c: c, d: Math.abs(Math.log10(c.tvl_usd) - Math.log10(r.tvl_usd)) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 24).map(function (x) { return x.c; });
  var xs = near.map(function (c) { return c.tvl_usd; }).concat([r.tvl_usd]);
  var ys = near.map(function (c) { return c.mcap_usd; }).concat([r.implied_value_usd]);
  var x0 = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, xs)) - 0.3));
  var x1 = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, xs)) + 0.3));
  var y0 = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, ys)) - 0.3));
  var y1 = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, ys)) + 0.3));
  var peers = LIVE.filter(function (x) { return x.mcap_usd !== null; }).map(function (x) { return { x: x, d: Math.abs(Math.log10(x.tvl_usd) - Math.log10(r.tvl_usd)) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 5).map(function (z) { return z.x; });
  var peerRows = peers.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td class="num">' + usd(p.tvl_usd) + '</td><td class="num">' + usd(p.mcap_usd) + '</td><td class="num">' + p.ratio.toFixed(2) + 'x</td></tr>';
  }).join('');
  var steps = r.farm_steps.map(function (s, i) {
    var cost = STEP_TXS[i] * e.gas_usd;
    return '<li><span>' + esc(s) + '</span><span class="c">' + m2(cost) + '</span><span class="t">' + STEP_MIN[i] + ' min</span></li>';
  }).join('');
  var caps = [1000, 10000, 100000], drops = [0.05, 0.10, 0.20];
  var netCells = caps.map(function (c) {
    return '<tr><td>' + (c === 1000 ? '$1K' : (c === 10000 ? '$10K' : '$100K')) + '</td>' + drops.map(function (d) {
      var net = round2((c / (r.tvl_usd + c)) * d * r.implied_value_usd - e.fees_usd - c * M.economics.tbill_rate * (M.economics.hold_days / 365));
      return '<td class="' + (net > 0 ? 'teal' : 'red') + '">' + m2(net, true) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  var pays = e.pays_from_usd === null ? 'Never beats a T-bill at any size.' : (e.pays_from_usd >= 100000 ? 'Pays from $100K+.' : 'Pays from $' + int(e.pays_from_usd) + '.');
  $('detail').innerHTML =
    '<button class="back" id="d-back">← Back to board</button>' +
    '<h2>#' + r.rank + ' ' + esc(r.name) + badges(r) + '</h2>' +
    '<p class="mut">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc(r.family) + ' · ' + esc(r.mechanism) + ' · ' + esc(r.chains.join(', ')) + '</p>' +
    '<div class="statcards">' +
    '<div class="stat"><div class="k">Implied value</div><div class="v amber">' + usd(r.implied_value_usd) + '</div><div class="s">P25–P75 ' + usd(r.p25_usd) + ' – ' + usd(r.p75_usd) + '</div></div>' +
    '<div class="stat"><div class="k">TVL</div><div class="v">' + usd(r.tvl_usd) + '</div><div class="s">7-day change ' + chgText(r.change_7d) + '</div></div>' +
    '<div class="stat"><div class="k">No token for</div><div class="v">' + ageFmt(r.age_days) + '</div><div class="s">' + (r.listed_at ? 'tracked since ' + r.listed_at : 'tracked since unknown') + '</div></div>' +
    '<div class="stat"><div class="k">$1K slice</div><div class="v">' + m2(e.slice_usd) + '</div><div class="s">at 10% to depositors</div></div>' +
    '<div class="stat"><div class="k">Net of all costs</div><div class="v ' + verdictCls(e.verdict) + '">' + e.verdict + ' ' + m2(e.net_usd, true) + '</div><div class="s">fees ' + m2(e.fees_usd) + ' · T-bill ' + m2(e.tbill_usd) + '</div></div></div>' +
    '<div class="detail-cols"><div>' +
    '<div class="card"><h3>How the value is built</h3><table>' +
    '<tr><td>TVL today</td><td class="num">' + usd(r.tvl_usd) + '</td></tr>' +
    '<tr><td>Projected TVL (7d ' + chgText(m.growth_pct) + ', 2 more weeks)</td><td class="num">' + usd(m.projected_tvl_usd) + '</td></tr>' +
    '<tr><td>Size curve · 10^' + M.curve.a.toFixed(4) + ' × (TVL/$100M)^' + M.curve.b.toFixed(4) + '</td><td class="num">' + usd(m.curve_value_usd) + '</td></tr>' +
    '<tr><td>Family effect · ' + esc(r.family) + ', ' + m.family_peer_count + ' peers</td><td class="num">×' + m.family_effect.toFixed(3) + '</td></tr>' +
    '<tr><td>Seasoning · ' + ageFmt(r.age_days) + ' without a token</td><td class="num">×' + m.seasoning.toFixed(3) + '</td></tr>' +
    (m.sibling_factor !== 1 ? '<tr><td>Sibling · shares a first word with a traded token</td><td class="num">×0.5</td></tr>' : '') +
    '<tr><td><b>Implied value</b></td><td class="num"><b class="amber">' + usd(r.implied_value_usd) + '</b></td></tr></table>' +
    '<p class="cap">Product check: curve × family × seasoning × sibling = ' + usd(recomputed) + ' — ' + (match ? '<span class="teal">matches board.json</span>' : '<span class="red">differs by ' + m2(Math.abs(recomputed - r.implied_value_usd)) + '</span>') + '. Range: P10 ' + usd(r.p10_usd) + ' to P90 ' + usd(r.p90_usd) + '.</p></div>' +
    '<div class="card"><h3>Against traded peers</h3>' +
    logScatter({ w: 400, h: 150, x0: x0, x1: x1, y0: y0, y1: y1, pts: near.map(function (c) { return { x: c.tvl_usd, y: c.mcap_usd, c: '#64748b', r: 2.5 }; }), mark: { x: r.tvl_usd, y: r.implied_value_usd } }) +
    '<p class="cap">Grey: the 24 traded tokens nearest this TVL. Ring: this protocol at its implied value.</p>' +
    '<table><thead><tr><th>Nearest trading token</th><th class="num">TVL</th><th class="num">Mcap</th><th class="num">Mcap/TVL</th></tr></thead><tbody>' + peerRows + '</tbody></table></div></div>' +
    '<div><div class="card"><h3>Farm plan · ' + esc(e.plan_chain) + ' · $1,000 · 90 days</h3><ol class="steps">' + steps + '</ol>' +
    '<p class="cap">Total: 7 paid transactions · ' + m2(e.fees_usd) + ' fees · 140 minutes (2.3h) of work.</p>' +
    '<div class="econfoot">Slice ' + m2(e.slice_usd) + ' · Fees −' + m2(e.fees_usd) + ' · T-bill forgone −' + m2(e.tbill_usd) + ' · Net <span class="' + verdictCls(e.verdict) + '"><b>' + m2(e.net_usd, true) + '</b></span> · Work 2.3h · Per hour ' + m2(e.per_hour_usd, true) + '</div></div>' +
    '<div class="card"><h3>Net at other sizes</h3><table class="netgrid"><thead><tr><th>Capital</th><th>5% drop</th><th>10% drop</th><th>20% drop</th></tr></thead><tbody>' + netCells + '</tbody></table>' +
    '<p class="cap">Fees fixed, T-bill scales with capital. ' + pays + '</p><p class="cap">' + whySentence(r) + '</p></div></div></div>';
  $('d-back').addEventListener('click', function () { S.detail = null; setTab(S.tab); });
  writeHash();
  window.scrollTo(0, 0);
}

// ---- events + init ----
$('tabs').addEventListener('click', function (ev) {
  var b = ev.target.closest('button[data-tab]');
  if (b) setTab(b.getAttribute('data-tab'));
});
$('boardTable').addEventListener('click', function (ev) {
  var th = ev.target.closest('th.sort');
  if (th) {
    var k = th.getAttribute('data-sort');
    if (S.sort === k) S.dir = -S.dir;
    else { S.sort = k; S.dir = k === 'name' ? 1 : -1; }
    var sel = $('c-sort'); if (sel) sel.value = S.sort;
    renderBoard(); return;
  }
  var tr = ev.target.closest('tr.row');
  if (tr) openDetail(tr.getAttribute('data-slug'));
});
$('tradesTable').addEventListener('click', function (ev) {
  var th = ev.target.closest('th[data-tsort]');
  if (!th) return;
  var k = th.getAttribute('data-tsort');
  if (S.tsort === k) S.tdir = -S.tdir;
  else { S.tsort = k; S.tdir = k === 'name' ? 1 : -1; }
  renderTrades();
});
window.addEventListener('hashchange', function () {
  var keep = S.detail;
  parseHash();
  if (S.detail && S.detail !== keep) openDetail(S.detail);
  else if (!S.detail && keep) setTab(S.tab);
  else { setTab(S.tab); buildControls(); renderBoard(); }
});

parseHash();
renderHeader();
renderHero();
renderTabs();
buildControls();
buildTradesControls();
if (S.detail) openDetail(S.detail);
else setTab(S.tab);
})();
