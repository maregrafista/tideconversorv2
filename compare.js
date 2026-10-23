'use strict';
/* Aba "Previsto × observado": série horária observada na régua contra três previsões, com erro, estatísticas e dispersão. */
(function () {
  const $ = id => document.getElementById(id), A = window.TCApp, TCH = window.TCH;
  const T = TCH.OBS_T, V = TCH.OBS_V, NR = TCH.NR, N = T.length, H3 = 36e5, DAY = 864e5;
  const MODELS = [
    { k: 'harmA', label: 'Harmônica + anuais (B02 + Sa/Ssa)', col: '#1b9664', on: true },
    { k: 'harm', label: 'Harmônica só marés (B02)', col: '#eb6834', on: true },
    { k: 'tabua', label: 'Tábua de Santana convertida', col: '#6250d6', on: false }
  ];
  const P = {};                       // previsões (cm acima do zero da régua) nas horas observadas, preenchidas sob demanda
  const loc = ms => new Date(ms - 3 * H3), pad = n => String(n).padStart(2, '0');
  const fdate = ms => { const d = loc(ms); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
  const fdt = ms => { const d = loc(ms); return `${fdate(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const iso = ms => loc(ms).toISOString().slice(0, 10);
  const parseLocal = s => Date.parse(s.length > 10 ? s + '-03:00' : s + 'T00:00:00-03:00');
  function pred(k) {
    if (P[k]) return P[k];
    const a = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (k === 'tabua') { const f = A.waterForecast(T[i], 'faz', null, false, 'tabua'); a[i] = f ? f.h * 100 + NR : NaN; }
      else a[i] = TCH.predictCm(T[i], k === 'harmA');
    }
    return (P[k] = a);
  }
  const blk = n => TCH.blocks[n].map(parseLocal);
  const PRESETS = [
    { id: 'b3', label: 'Bloco 03 · independente', r: () => blk(3) },
    { id: 'b1', label: 'Bloco 01 · seca de 2024', r: () => blk(1) },
    { id: 'b2', label: 'Bloco 02 · ajuste', r: () => blk(2) },
    { id: 'b4', label: 'Bloco 04 · ajuste', r: () => blk(4) },
    { id: 'last', label: 'Últimos 30 dias com dado', r: () => [T[N - 1] - 30 * DAY, T[N - 1]] },
    { id: 'all', label: 'Todo o período', r: () => [T[0], T[N - 1]] }
  ];
  let win = null, base = null, hover = -1, sel = null, built = false;
  const ref = () => $('cmpRef').value, off = () => ref() === 'nr' ? NR : 0, toM = cm => (cm - off()) / 100;
  const lb = x => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < x) lo = m + 1; else hi = m; } return lo; };
  const active = () => MODELS.filter(m => m.on);
  const cache = {}; const conv = (arr, key) => { const ck = key + '|' + ref(); return cache[ck] || (cache[ck] = Float64Array.from(arr, toM)); };

  function build() {
    $('cmpPresets').innerHTML = PRESETS.map(p => `<button class="chip" data-p="${p.id}" aria-pressed="false">${p.label}</button>`).join('');
    $('cmpModels').innerHTML = MODELS.map(m => `<label><input type="checkbox" data-m="${m.k}" ${m.on ? 'checked' : ''}><i style="background:${m.col}"></i>${m.label}</label>`).join('');
    $('cmpScatterModel').innerHTML = MODELS.map(m => `<option value="${m.k}">${m.label}</option>`).join('');
    $('cmpPresets').onclick = e => { const b = e.target.closest('[data-p]'); if (b) setPreset(b.dataset.p); };
    $('cmpModels').onchange = e => { const c = e.target.closest('[data-m]'); if (!c) return; MODELS.find(m => m.k === c.dataset.m).on = c.checked; draw(); };
    $('cmpRef').onchange = draw; $('cmpScatterModel').onchange = drawScatter;
    $('cmpFrom').onchange = $('cmpTo').onchange = () => { const a = parseLocal($('cmpFrom').value), b = parseLocal($('cmpTo').value) + DAY; if (a < b) { win = [a, b]; base = win.slice(); setPressed(null); draw(); } };
    $('cmpCsv').onclick = exportCsv;
    attach($('cmpMain')); attach($('cmpErr'));
    window.addEventListener('resize', () => { if (!$('compare').hidden) draw(); });
    built = true; setPreset('b3');
  }
  function setPressed(id) { document.querySelectorAll('#cmpPresets [data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === id)); }
  function setPreset(id) { const p = PRESETS.find(x => x.id === id); base = p.r(); win = base.slice(); setPressed(id); draw(); }
  function show() { if (!built) build(); else draw(); }

  /* ---------- desenho ---------- */
  function setup(c) { const r = devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height'); c.width = Math.round(w * r); c.height = Math.round(h * r); const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return { x, w, h }; }
  function ticks(t0, t1) {
    const span = (t1 - t0) / DAY, steps = [0.25, 0.5, 1, 2, 5, 7, 14, 30, 61, 91, 182]; let st = steps.find(s => span / s <= 9) || 182;
    const out = [], o = 3 * H3; let t = Math.ceil((t0 - o) / (st * DAY)) * st * DAY + o;
    if (st >= 30) { const d = loc(t0); let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; const k = Math.round(st / 30.4); for (;;) { const ms = Date.UTC(y, m, 1) + o; if (ms > t1) break; if (ms >= t0) out.push(ms); m += k; while (m > 11) { m -= 12; y++; } } return { out, fmt: ms => { const d = loc(ms); return pad(d.getUTCMonth() + 1) + '/' + String(d.getUTCFullYear()).slice(2); } }; }
    for (; t <= t1; t += st * DAY) out.push(t);
    return { out, fmt: st < 1 ? ms => { const d = loc(ms); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + ' ' + pad(d.getUTCHours()) + 'h'; } : ms => { const d = loc(ms); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1); } };
  }
  function series(x, arr, i0, i1, X, Y, col, wid, plotW) {
    x.strokeStyle = col; x.lineWidth = wid; const cnt = i1 - i0; x.beginPath();
    if (cnt > plotW * 4) {                      // muitos pontos: envelope mínimo/máximo por coluna
      const bucket = new Map();
      for (let i = i0; i < i1; i++) { const v = arr[i]; if (!Number.isFinite(v)) continue; const px = Math.round(X(T[i])), b = bucket.get(px); if (!b) bucket.set(px, [v, v]); else { if (v < b[0]) b[0] = v; if (v > b[1]) b[1] = v; } }
      for (const [px, [lo, hi]] of bucket) { x.moveTo(px + .5, Y(lo)); x.lineTo(px + .5, Y(hi) - (lo === hi ? 1 : 0)); }
    } else {
      let prev = -1;
      for (let i = i0; i < i1; i++) { const v = arr[i]; if (!Number.isFinite(v)) { prev = -1; continue; } if (prev >= 0 && T[i] - T[prev] <= 90 * 6e4) x.lineTo(X(T[i]), Y(v)); else x.moveTo(X(T[i]), Y(v)); prev = i; }
    }
    x.stroke();
  }
  function frame(c, yr, unit, yfmt) {
    const { x, w, h } = setup(c), L = 54, R = 10, Tp = 8, B = 24, pw = w - L - R, ph = h - Tp - B, [t0, t1] = win;
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => Tp + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph;
    const grid = A.css('--chart-grid'), txt = A.css('--chart-text'); x.font = '11px system-ui'; x.lineWidth = 1;
    const rng = yr[1] - yr[0], st = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50].find(s => rng / s <= 7) || 50;
    x.textAlign = 'right'; x.fillStyle = txt; x.strokeStyle = grid;
    for (let v = Math.ceil(yr[0] / st) * st; v <= yr[1] + 1e-9; v += st) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); x.fillText(yfmt(v), L - 6, Y(v) + 4); }
    const tk = ticks(t0, t1); x.textAlign = 'center';
    for (const t of tk.out) { x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke(); x.fillText(tk.fmt(t), X(t), h - 8); }
    x.fillStyle = txt; x.textAlign = 'left'; x.fillText(unit, 4, 12);
    return { x, w, h, L, R, Tp, ph, pw, X, Y, inv: px => win[0] + (px - L) / pw * (win[1] - win[0]) };
  }
  let G1 = null, G2 = null;
  function draw() { render(true); }
  function render(full) {
    if (!win) return;
    const [t0, t1] = win, i0 = lb(t0), i1 = lb(t1 + 1), ms = active(), unit = ref() === 'nr' ? 'm acima do NR' : 'm acima do zero da régua';
    if (full) { $('cmpFrom').value = iso(t0); $('cmpTo').value = iso(t1 - 1);
    $('cmpLegend').innerHTML = `<span><i style="background:#222"></i>Observado</span>` + ms.map(m => `<span><i style="background:${m.col}"></i>${m.label}</span>`).join(''); }
    // faixa vertical
    let lo = Infinity, hi = -Infinity; const arrs = [V, ...ms.map(m => pred(m.k))];
    for (const a of arrs) for (let i = i0; i < i1; i++) { const v = a[i]; if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (!Number.isFinite(lo)) { lo = 100; hi = 300; }
    const padv = Math.max(10, (hi - lo) * .06); const yr = [toM(lo - padv), toM(hi + padv)];
    G1 = frame($('cmpMain'), yr, unit, v => v.toFixed(v % 1 ? 2 : 1).replace('.', ','));
    const dark = matchMedia('(prefers-color-scheme:dark)').matches, ink = dark ? '#eee' : '#1c1c1c';
    series(G1.x, conv(V, 'obs'), i0, i1, G1.X, G1.Y, ink, 1.6, G1.pw);
    G1.x.globalAlpha = .85; for (const m of ms) series(G1.x, conv(pred(m.k), m.k), i0, i1, G1.X, G1.Y, m.col, 1.3, G1.pw); G1.x.globalAlpha = 1;
    // erro
    let em = 0; const errs = ms.map(m => { const p = pred(m.k), e = new Float64Array(N).fill(NaN); for (let i = i0; i < i1; i++) { const v = p[i] - V[i]; if (Number.isFinite(v)) { e[i] = v; if (Math.abs(v) > em) em = Math.abs(v); } } return e; });
    const lim = Math.max(20, Math.ceil(Math.min(em, 150) / 10) * 10);
    G2 = frame($('cmpErr'), [-lim, lim], 'erro (cm)', v => Math.round(v));
    G2.x.strokeStyle = A.css('--chart-text'); G2.x.setLineDash([4, 3]); G2.x.beginPath(); G2.x.moveTo(G2.L, G2.Y(0)); G2.x.lineTo(G2.w - G2.R, G2.Y(0)); G2.x.stroke(); G2.x.setLineDash([]);
    ms.forEach((m, k) => series(G2.x, errs[k], i0, i1, G2.X, G2.Y, m.col, 1.4, G2.pw));
    // cursor e seleção
    for (const g of [G1, G2]) {
      if (hover >= g.L && hover <= g.w - g.R) { g.x.strokeStyle = A.css('--ochre'); g.x.lineWidth = 1; g.x.beginPath(); g.x.moveTo(hover, g.Tp); g.x.lineTo(hover, g.Tp + g.ph); g.x.stroke(); }
      if (sel) { const a = Math.min(sel[0], sel[1]), b = Math.max(sel[0], sel[1]); g.x.fillStyle = 'rgba(40,110,200,.15)'; g.x.fillRect(a, g.Tp, b - a, g.ph); }
    }
    if (full) { stats(i0, i1, ms); drawScatter(); drawHist(i0, i1, ms); }
  }
  /* ---------- estatísticas ---------- */
  function stat(k, i0, i1) {
    const p = pred(k); let n = 0, sp = 0, sq = 0, so = 0, spp = 0, soo = 0, spo = 0; const ab = [];
    for (let i = i0; i < i1; i++) { const e = p[i] - V[i]; if (!Number.isFinite(e)) continue; n++; sp += e; sq += e * e; ab.push(Math.abs(e)); so += V[i]; soo += V[i] * V[i]; spp += p[i] * p[i]; spo += p[i] * V[i]; }
    if (!n) return null; ab.sort((a, b) => a - b); const mp = (so + sp) / n, mo = so / n;
    const cov = spo / n - mp * mo, vp = spp / n - mp * mp, vo = soo / n - mo * mo;
    return { n, bias: sp / n, rmse: Math.sqrt(sq / n), mae: ab.reduce((a, b) => a + b, 0) / n, p95: ab[Math.floor(.95 * (n - 1))], r: cov / Math.sqrt(vp * vo) };
  }
  function stats(i0, i1, ms) {
    const f = (v, d = 1) => A.fmt(v, d), rows = ms.map(m => ({ m, s: stat(m.k, i0, i1) })), valid = rows.filter(r => r.s), best = valid.length > 1 ? Math.min(...valid.map(r => r.s.rmse)) : -1;
    $('cmpSub').textContent = `${fdt(win[0])} a ${fdt(win[1])} · ${A.fmt(i1 - i0, 0)} horas observadas no trecho. Erro = previsto − observado, em cm.`;
    $('cmpStats').innerHTML = '<thead><tr><th>Modelo</th><th>Horas</th><th>Viés</th><th>RMSE</th><th>EAM</th><th>P95</th><th>r</th></tr></thead><tbody>' +
      rows.map(({ m, s }) => s ? `<tr><td><i style="background:${m.col};display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px"></i>${m.label}</td><td>${A.fmt(s.n, 0)}</td><td>${A.signed(s.bias)}</td><td class="${s.rmse === best ? 'best' : ''}">${f(s.rmse)}</td><td>${f(s.mae)}</td><td>${f(s.p95)}</td><td>${f(s.r, 3)}</td></tr>` : `<tr><td>${m.label}</td><td colspan="6">sem previsão neste período</td></tr>`).join('') + '</tbody>';
  }
  function drawScatter() {
    const c = $('cmpScatter'); if (!c.clientWidth || !win) return; const { x, w, h } = setup(c), k = $('cmpScatterModel').value, p = pred(k), i0 = lb(win[0]), i1 = lb(win[1] + 1);
    let lo = Infinity, hi = -Infinity; for (let i = i0; i < i1; i++) { if (Number.isFinite(p[i])) { lo = Math.min(lo, p[i], V[i]); hi = Math.max(hi, p[i], V[i]); } }
    if (!Number.isFinite(lo)) { x.fillStyle = A.css('--chart-text'); x.fillText('sem previsão neste período', 20, 30); return; }
    lo = toM(lo) - .1; hi = toM(hi) + .1; const L = 44, B = 28, S = Math.min(w - L - 10, h - B - 10), X = v => L + (v - lo) / (hi - lo) * S, Y = v => 10 + S - (v - lo) / (hi - lo) * S;
    const grid = A.css('--chart-grid'), txt = A.css('--chart-text'); x.font = '11px system-ui'; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right';
    const st = [0.1, 0.2, 0.5, 1].find(s => (hi - lo) / s <= 6) || 1;
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(L + S, Y(v)); x.stroke(); x.fillText(v.toFixed(1).replace('.', ','), L - 5, Y(v) + 4); x.textAlign = 'center'; x.fillText(v.toFixed(1).replace('.', ','), X(v), 10 + S + 16); x.beginPath(); x.moveTo(X(v), 10); x.lineTo(X(v), 10 + S); x.stroke(); x.textAlign = 'right'; }
    x.strokeStyle = txt; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(X(lo), Y(lo)); x.lineTo(X(hi), Y(hi)); x.stroke(); x.setLineDash([]);
    x.textAlign = 'left'; x.fillText('observado (m) →', L, h - 4); x.save(); x.translate(10, 10 + S / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.fillText('previsto (m)', 0, 0); x.restore();
    x.fillStyle = MODELS.find(m => m.k === k).col; x.globalAlpha = .45; const stp = Math.max(1, Math.floor((i1 - i0) / 5000));
    for (let i = i0; i < i1; i += stp) if (Number.isFinite(p[i])) { x.beginPath(); x.arc(X(toM(V[i])), Y(toM(p[i])), 2.4, 0, 7); x.fill(); } x.globalAlpha = 1;
  }
  function drawHist(i0, i1, ms) {
    const c = $('cmpHist'); if (!c.clientWidth) return; const { x, w, h } = setup(c), bins = 30, lo = -60, wd = 120 / bins, counts = ms.map(m => { const p = pred(m.k), a = new Array(bins).fill(0); for (let i = i0; i < i1; i++) { const e = p[i] - V[i]; if (Number.isFinite(e)) a[Math.max(0, Math.min(bins - 1, Math.floor((e - lo) / wd)))]++; } return a; });
    const mx = Math.max(1, ...counts.flat()), L = 44, B = 28, pw = w - L - 10, ph = h - B - 12, grid = A.css('--chart-grid'), txt = A.css('--chart-text');
    x.font = '11px system-ui'; x.fillStyle = txt; x.strokeStyle = grid; x.textAlign = 'right';
    for (let k = 0; k <= 4; k++) { const v = mx * k / 4, y = 12 + ph - ph * k / 4; x.beginPath(); x.moveTo(L, y); x.lineTo(L + pw, y); x.stroke(); x.fillText(Math.round(v), L - 5, y + 4); }
    x.textAlign = 'center'; for (let e = -60; e <= 60; e += 20) { const px = L + (e - lo) / 120 * pw; x.fillText(e, px, h - 12); }
    x.fillText('erro (cm) · eixo vertical: nº de horas', L + pw / 2, h - 1);
    const bw = pw / bins; ms.forEach((m, k) => { x.fillStyle = m.col; counts[k].forEach((cnt, j) => { const bh = cnt / mx * ph, sw = bw / ms.length; x.fillRect(L + j * bw + k * sw + 1, 12 + ph - bh, Math.max(1, sw - 1), bh); }); });
    x.strokeStyle = txt; x.lineWidth = 1.5; const z = L + (0 - lo) / 120 * pw; x.beginPath(); x.moveTo(z, 12); x.lineTo(z, 12 + ph); x.stroke();
  }
  /* ---------- interação ---------- */
  function attach(c) {
    const pos = e => e.clientX - c.getBoundingClientRect().left;
    c.addEventListener('pointermove', e => {
      const x = pos(e); hover = x; if (sel) sel[1] = x;
      const g = G1, t = g.inv(x), i = lb(t), k = i > 0 && Math.abs(T[i - 1] - t) < Math.abs((T[i] ?? Infinity) - t) ? i - 1 : i;
      if (k < N && x >= g.L && x <= g.w - g.R) {
        const parts = active().map(m => { const p = pred(m.k)[k]; return Number.isFinite(p) ? `<b style="color:${m.col}">${m.label.split(' (')[0]}</b> ${A.fmt(toM(p))} m (erro ${A.signed(p - V[k])} cm)` : null; }).filter(Boolean);
        $('cmpReadout').innerHTML = `${fdt(T[k])} · <b>observado ${A.fmt(toM(V[k]))} m</b> · ` + parts.join(' · ');
      }
      render(false);
    });
    c.addEventListener('pointerleave', () => { hover = -1; if (!sel) render(false); });
    c.addEventListener('pointerdown', e => { sel = [pos(e), pos(e)]; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointerup', e => {
      if (!sel) return; const a = Math.min(sel[0], pos(e)), b = Math.max(sel[0], pos(e)); sel = null;
      if (b - a > 8) { const t0 = G1.inv(a), t1 = G1.inv(b); win = [Math.max(T[0], t0), Math.min(T[N - 1], t1)]; setPressed(null); }
      draw();
    });
    c.addEventListener('dblclick', () => { win = base.slice(); draw(); });
  }
  function exportCsv() {
    const i0 = lb(win[0]), i1 = lb(win[1] + 1), ms = active(); let csv = '﻿Data_hora_UTC-3;Observado_m_acima_NR;' + ms.map(m => `Previsto_${m.k}_m;Erro_${m.k}_cm`).join(';') + '\r\n';
    for (let i = i0; i < i1; i++) { const row = [fdt(T[i]), A.fmt((V[i] - NR) / 100, 3)]; for (const m of ms) { const p = pred(m.k)[i]; row.push(Number.isFinite(p) ? A.fmt((p - NR) / 100, 3) : '', Number.isFinite(p) ? A.fmt(p - V[i], 1) : ''); } csv += row.join(';') + '\r\n'; }
    A.download(csv, 'text/csv;charset=utf-8', `TideConversor_Previsto_x_Observado_${iso(win[0])}_${iso(win[1] - 1)}.csv`);
  }
  window.TCCompare = { show };
  if (!$('compare').hidden) show();
})();
