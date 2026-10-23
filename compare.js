'use strict';
/* Aba "Previsto × observado": uma janela de 3 a 30 dias, escala fixa, resumo em linguagem direta,
   tabela de preamares e baixamares e erro mês a mês. Nada é redesenhado ao passar o cursor. */
(function () {
  const $ = id => document.getElementById(id), A = window.TCApp, TCH = window.TCH;
  const T = TCH.OBS_T, V = TCH.OBS_V, NR = TCH.NR, N = T.length, DAY = 864e5, H3 = 36e5, EPOCH = Date.UTC(2024, 0, 1);
  const GREEN = '#1b9664', ORANGE = '#eb6834', BLUE = '#3a7bd5';
  const Y_MAIN = [-0.2, 4.0], Y_ERR = 60;                     // escalas fixas (m acima do NR; cm de erro)
  const loc = ms => new Date(ms - 3 * H3), pad = n => String(n).padStart(2, '0');
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dm = ms => { const d = loc(ms); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`; };
  const hm = ms => { const d = loc(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const iso = ms => loc(ms).toISOString().slice(0, 10);
  const dayStart = ms => { const d = loc(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * H3; };
  const parseLocal = s => Date.parse(s.length > 10 ? s + '-03:00' : s + 'T00:00:00-03:00');
  const fmt = (v, n = 0) => A.fmt(v, n), sgn = (v, n = 0) => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '') + A.fmt(Math.abs(v), n);
  const lb = x => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < x) lo = m + 1; else hi = m; } return lo; };
  const SPARSE = parseLocal('2026-08-11'), FIT = [TCH.blocks[2]].map(b => b.map(parseLocal)), B01 = TCH.blocks[1].map(parseLocal);
  const inFit = t => FIT.some(([a, b]) => t >= a && t <= b);
  let P = null; const pred = () => P || (P = Float64Array.from(T, t => TCH.predictCm(t, true)));
  const m_ = cm => (cm - NR) / 100;
  const PRESETS = [
    { id: 'teste', label: 'Teste independente · fev/2026', start: '2026-02-09' },
    { id: 'seca', label: 'Seca de 2024 · nov/2024', start: '2024-11-18' },
    { id: 'ajuste', label: 'Usado no ajuste · mai/2025', start: '2025-05-12' },
    { id: 'fim', label: 'Últimos dados · out/2026', start: null }
  ];
  const LENS = [3, 7, 15, 30];
  let start = 0, len = 7, active = null, built = false, G = null, month = null;
  const first = dayStart(T[0]), last = dayStart(T[N - 1]);

  function build() {
    $('cmpPresets').innerHTML = PRESETS.map(p => `<button class="chip" data-p="${p.id}" aria-pressed="false">${p.label}</button>`).join('');
    $('cmpLen').innerHTML = LENS.map(d => `<button class="chip" data-d="${d}" aria-pressed="false">${d} dias</button>`).join('');
    $('cmpPresets').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = PRESETS.find(x => x.id === b.dataset.p); len = 7; go(p.start ? parseLocal(p.start) : last - 6 * DAY, p.id); };
    $('cmpLen').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { len = +b.dataset.d; go(start, active); } };
    $('cmpPrev').onclick = () => go(start - len * DAY, null);
    $('cmpNext').onclick = () => go(start + len * DAY, null);
    $('cmpDate').onchange = () => { if ($('cmpDate').value) go(parseLocal($('cmpDate').value), null); };
    $('cmpCsv').onclick = exportCsv;
    $('cmpMonths').onclick = e => { const r = $('cmpMonths').getBoundingClientRect(), i = Math.floor((e.clientX - r.left - mx.L) / mx.bw); if (month && i >= 0 && i < month.list.length) { len = 7; go(month.list[i].t0, null); } };
    const wrap = $('cmpWrap');
    wrap.addEventListener('pointermove', hover); wrap.addEventListener('pointerleave', () => { $('cmpCursor').hidden = true; $('cmpTip').hidden = true; });
    window.addEventListener('resize', () => { if (!$('compare').hidden) render(); });
    built = true; go(parseLocal(PRESETS[0].start), 'teste');
  }
  function go(s, preset) { start = Math.max(first, Math.min(dayStart(s), last - (len - 1) * DAY)); active = preset; render(); }
  function show() { if (!built) build(); else render(); }

  /* ---------- estatísticas da janela ---------- */
  /* o erro é medido só nas preamares e baixamares: altura prevista − altura observada (cm) */
  function stats(ev) {
    let n = 0, sp = 0, sq = 0; const ab = [];
    for (const v of ev) { const e = v.prev - v.obs; n++; sp += e; sq += e * e; ab.push(Math.abs(e)); }
    if (!n) return null; ab.sort((a, b) => a - b); return { n, bias: sp / n, rmse: Math.sqrt(sq / n), p90: ab[Math.floor(.9 * (n - 1))] };
  }
  const events = (t0, t1) => TCH.ev.map(e => ({ t: EPOCH + (e[0] + 180) * 6e4, type: e[1] ? 'Baixamar' : 'Preamar', obs: e[2] / 10, prev: e[3] / 10, dt: e[4] })).filter(e => e.t >= t0 && e.t < t1);
  const rating = r => r <= 10 ? 'muito boa' : r <= 15 ? 'boa' : r <= 25 ? 'razoável' : 'fraca';

  function render() {
    const t0 = start, t1 = start + len * DAY, i0 = lb(t0), i1 = lb(t1), ev = events(t0, t1), s = stats(ev);
    $('cmpDate').value = iso(t0); $('cmpDate').min = iso(first); $('cmpDate').max = iso(last);
    document.querySelectorAll('#cmpPresets [data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === active));
    document.querySelectorAll('#cmpLen [data-d]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.d === len));
    let fitH = 0; for (let i = i0; i < i1; i++) if (inFit(T[i])) fitH++;
    const fit = i1 > i0 && fitH / (i1 - i0) > .5, sparse = t0 >= SPARSE, drought = t0 >= B01[0] - DAY && t0 <= B01[1];
    const tag = $('cmpTag'); tag.className = 'cmp-tag ' + (sparse ? 'sparse' : fit ? 'fit' : 'test');
    tag.textContent = (fit ? 'Período usado no ajuste da previsão: o erro aqui é menor do que seria em dados novos.' : 'Período de teste: estes dados não foram usados para ajustar a previsão. É o teste mais honesto.') +
      (drought ? ' Em 2024 houve seca extrema: o rio estava bem abaixo do normal.' : '') + (sparse ? ' Depois de 11/08/2026 a régua grava de forma irregular, com menos horas.' : '');
    if (!s) { $('cmpCards').innerHTML = ''; $('cmpVerdict').textContent = 'Sem preamares e baixamares observadas neste período. Escolha outro.'; }
    else {
      const evT = ev.length ? ev.reduce((a, e) => a + Math.abs(e.dt), 0) / ev.length : null;
      const bTxt = Math.abs(s.bias) < 1 ? 'sem tendência de ficar acima ou abaixo da água' : `a previsão ficou, em média, ${fmt(Math.abs(s.bias))} cm ${s.bias > 0 ? 'acima' : 'abaixo'} da água`;
      $('cmpCards').innerHTML = [
        ['Erro típico', `${fmt(s.rmse)} <small>cm</small>`, 'diferença típica de altura entre as preamares e baixamares previstas e observadas'],
        ['Tendência', `${sgn(s.bias)} <small>cm</small>`, bTxt],
        ['9 em cada 10 marés', `&lt; ${fmt(s.p90)} <small>cm</small>`, 'o erro de altura foi menor que isso em 90 % das preamares e baixamares'],
        ['Horário da maré', evT === null ? '—' : `${fmt(evT)} <small>min</small>`, evT === null ? 'sem preamar ou baixamar completa neste período' : `diferença média entre a hora prevista e a observada (${ev.length} marés)`]
      ].map(c => `<div class="cmp-card"><div class="k">${c[0]}</div><div class="v">${c[1]}</div><div class="s">${c[2]}</div></div>`).join('');
      const why = Math.abs(s.bias) >= 10 ? ` O nível médio da água estava diferente do usual (rio ${s.bias > 0 ? 'mais baixo' : 'mais alto'} que o esperado), e isso explica boa parte do erro.` : '';
      $('cmpVerdict').innerHTML = `Nestes ${len} dias (${fmt(s.n)} preamares e baixamares) a previsão foi <b>${rating(s.rmse)}</b>: errou em média ${fmt(s.rmse)} cm na altura.${why}`;
    }
    sizeCanvases(); drawMain(i0, i1, t0, t1); drawErr(i0, i1, t0, t1); table(ev); drawMonths();
    $('cmpCursor').hidden = true; $('cmpTip').hidden = true;
  }

  /* ---------- gráficos (escalas fixas) ---------- */
  const tall = () => (innerHeight >= 760 ? 1 : innerHeight >= 640 ? .85 : .7);
  function sizeCanvases() { const k = tall(); $('cmpMain').setAttribute('height', Math.round(300 * k)); $('cmpErr').setAttribute('height', Math.round(130 * k)); $('cmpMonths').setAttribute('height', Math.round(190 * Math.max(k, .8))); }
  function setup(c) { const r = devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height'); c.width = Math.round(w * r); c.height = Math.round(h * r); const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return { x, w, h }; }
  function xticks(t0, t1, x, X, ph, Tp, h, pw) {
    const dayW = pw / len, step = Math.max(1, Math.ceil(56 / dayW)), grid = A.css('--chart-grid'), txt = A.css('--chart-text'), wd = dayW * step >= 64;
    x.textAlign = 'center'; x.fillStyle = txt; x.strokeStyle = grid; x.font = '11px system-ui';
    for (let k = 0, t = t0; t < t1; k++, t += DAY) {
      x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke();
      if (h && k % step === 0) x.fillText((wd ? WD[loc(t).getUTCDay()] + ' ' : '') + dm(t), X(t + DAY / 2), h - 6);
    }
  }
  function drawMain(i0, i1, t0, t1) {
    const { x, w, h } = setup($('cmpMain')), L = 48, R = 8, Tp = 8, B = 22, pw = w - L - R, ph = h - Tp - B;
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => Tp + ph - (v - Y_MAIN[0]) / (Y_MAIN[1] - Y_MAIN[0]) * ph;
    const grid = A.css('--chart-grid'), txt = A.css('--chart-text'), ink = A.css('--ink') || '#1c1c1c', p = pred();
    x.lineWidth = 1; xticks(t0, t1, x, X, ph, Tp, h, pw);
    x.textAlign = 'right'; x.fillStyle = txt; x.strokeStyle = grid;
    for (let v = 0; v <= 4; v++) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); x.fillText(v + ' m', L - 6, Y(v) + 4); }
    x.setLineDash([5, 4]); x.strokeStyle = txt; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(w - R, Y(0)); x.stroke(); x.setLineDash([]);
    x.textAlign = 'left'; x.fillText('NR', L + 4, Y(0) - 4);
    const line = (arr, col, wd) => { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); let prev = -1; for (let i = i0; i < i1; i++) { const v = m_(arr[i]); if (prev >= 0 && T[i] - T[prev] <= 90 * 6e4) x.lineTo(X(T[i]), Y(v)); else x.moveTo(X(T[i]), Y(v)); prev = i; } x.stroke(); };
    line(p, GREEN, 2.6); line(V, ink, 1.6);
    G = { L, R, pw, w, t0, t1, i0, i1 };
  }
  function drawErr(i0, i1, t0, t1) {
    const { x, w, h } = setup($('cmpErr')), L = 48, R = 8, Tp = 6, B = 6, pw = w - L - R, ph = h - Tp - B, p = pred();
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => Tp + ph / 2 - v / Y_ERR * ph / 2, grid = A.css('--chart-grid'), txt = A.css('--chart-text');
    x.font = '11px system-ui'; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right';
    for (const v of [-60, -30, 0, 30, 60]) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); x.fillText((v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' cm', L - 6, Y(v) + 4); }
    for (let t = t0; t < t1; t += DAY) { x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke(); }
    const bw = Math.max(3, Math.min(10, pw / (len * 2) * .5));
    for (const v of events(t0, t1)) { const e = Math.max(-Y_ERR, Math.min(Y_ERR, v.prev - v.obs)); x.fillStyle = e > 0 ? ORANGE : BLUE; const y0 = Y(0), y1 = Y(e); x.fillRect(X(v.t) - bw / 2, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0))); }
    x.strokeStyle = txt; x.lineWidth = 1; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(w - R, Y(0)); x.stroke();
  }
  /* cursor e dica: elementos HTML, sem redesenhar os gráficos */
  function hover(e) {
    if (!G) return; const r = $('cmpWrap').getBoundingClientRect(), px = e.clientX - r.left;
    if (px < G.L || px > G.w - G.R) { $('cmpCursor').hidden = true; $('cmpTip').hidden = true; return; }
    const t = G.t0 + (px - G.L) / G.pw * (G.t1 - G.t0), i = lb(t), k = i > G.i0 && (i >= G.i1 || Math.abs(T[i - 1] - t) < Math.abs(T[i] - t)) ? i - 1 : i;
    if (k < G.i0 || k >= G.i1) { $('cmpCursor').hidden = true; $('cmpTip').hidden = true; return; }
    const o = m_(V[k]), p = m_(pred()[k]), d = (p - o) * 100, cur = $('cmpCursor'), tip = $('cmpTip');
    cur.hidden = false; cur.style.left = (G.L + (T[k] - G.t0) / (G.t1 - G.t0) * G.pw) + 'px'; tip.hidden = false;
    tip.innerHTML = `<b>${WD[loc(T[k]).getUTCDay()]} ${dm(T[k])} ${hm(T[k])}</b><br>Observado: ${fmt(o, 2)} m<br>Previsto: ${fmt(p, 2)} m<br>Diferença: ${sgn(d)} cm${Math.abs(d) < 1 ? '' : d > 0 ? ' (previsto acima)' : ' (previsto abaixo)'}`;
    const cx = parseFloat(cur.style.left), tw = tip.offsetWidth; tip.style.left = (cx + tw + 16 > r.width ? cx - tw - 10 : cx + 10) + 'px';
  }
  /* ---------- tabela de preamares e baixamares ---------- */
  function table(ev) {
    const el = $('cmpEvents');
    if (!ev.length) { el.innerHTML = '<tbody><tr><td>Sem preamares e baixamares completas neste período.</td></tr></tbody>'; return; }
    el.innerHTML = '<thead><tr><th>Maré</th><th>Quando (observado)</th><th>Hora prevista</th><th>Altura observada</th><th>Altura prevista</th><th>Erro de altura</th></tr></thead><tbody>' +
      ev.map(e => { const ph = hm(e.t + e.dt * 6e4), da = e.prev - e.obs; return `<tr><td>${e.type}</td><td>${WD[loc(e.t).getUTCDay()]} ${dm(e.t)} ${hm(e.t)}</td><td class="${Math.abs(e.dt) > 25 ? 'bad' : ''}">${ph} (${e.dt === 0 ? 'igual' : sgn(e.dt) + ' min'})</td><td>${fmt(e.obs / 100, 2)} m</td><td>${fmt(e.prev / 100, 2)} m</td><td class="${Math.abs(da) > 20 ? 'bad' : Math.abs(da) <= 10 ? 'good' : ''}">${sgn(da)} cm</td></tr>`; }).join('') + '</tbody>';
  }
  /* ---------- erro mês a mês (escala fixa) ---------- */
  const mx = { L: 46, bw: 1 };
  function monthsData() {
    if (month) return month; const acc = new Map();
    for (const v of events(-Infinity, Infinity)) { const d = loc(v.t), k = d.getUTCFullYear() * 12 + d.getUTCMonth(), e = v.prev - v.obs; let a = acc.get(k); if (!a) acc.set(k, a = { y: d.getUTCFullYear(), m: d.getUTCMonth(), n: 0, sq: 0, fit: 0, t0: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 3 * H3 }); a.n++; a.sq += e * e; if (inFit(v.t)) a.fit++; }
    const list = [...acc.values()].filter(a => a.n >= 10).map(a => ({ ...a, rmse: Math.sqrt(a.sq / a.n), kind: a.t0 >= SPARSE - 11 * DAY ? 'sparse' : a.fit / a.n > .5 ? 'fit' : 'test' }));
    return (month = { list });
  }
  const MN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function drawMonths() {
    const { x, w, h } = setup($('cmpMonths')), list = monthsData().list, L = mx.L, R = 6, Tp = 14, B = 22, pw = w - L - R, ph = h - Tp - B, bw = pw / list.length, Y = v => Tp + ph - v / 60 * ph;
    mx.bw = bw; const grid = A.css('--chart-grid'), txt = A.css('--chart-text'), cur = loc(start); x.font = '11px system-ui'; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right';
    for (const v of [0, 20, 40, 60]) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); x.fillText(v + ' cm', L - 5, Y(v) + 4); }
    list.forEach((a, i) => {
      const col = a.kind === 'test' ? GREEN : a.kind === 'fit' ? '#9aa39c' : '#d9a441', xa = L + i * bw + bw * .15, wd = bw * .7, top = Y(Math.min(a.rmse, 60)), sel = a.y === cur.getUTCFullYear() && a.m === cur.getUTCMonth();
      x.fillStyle = col; x.fillRect(xa, top, wd, Y(0) - top);
      if (sel) { x.strokeStyle = A.css('--ink') || '#000'; x.lineWidth = 2; x.strokeRect(xa - 1, top - 1, wd + 2, Y(0) - top + 2); x.lineWidth = 1; }
      x.fillStyle = txt; x.textAlign = 'center'; x.fillText(fmt(a.rmse), xa + wd / 2, top - 3);
      x.fillText(MN[a.m] + (a.m === 0 || i === 0 ? '/' + String(a.y).slice(2) : ''), xa + wd / 2, h - 6);
    });
  }
  function exportCsv() {
    let csv = '﻿Mare;Data_hora_observada_UTC-3;Hora_prevista;Erro_horario_min;Altura_observada_m_acima_NR;Altura_prevista_m_acima_NR;Erro_altura_cm (previsto - observado)\r\n';
    for (const e of events(start, start + len * DAY)) csv += [e.type, `${iso(e.t)} ${hm(e.t)}`, hm(e.t + e.dt * 6e4), e.dt, A.fmt(e.obs / 100, 3), A.fmt(e.prev / 100, 3), A.fmt(e.prev - e.obs, 1)].join(';') + '\r\n';
    A.download(csv, 'text/csv;charset=utf-8', `Previsto_x_Observado_PM_BM_${iso(start)}_${len}dias.csv`);
  }
  window.TCCompare = { show };
  if (!$('compare').hidden) show();
})();
