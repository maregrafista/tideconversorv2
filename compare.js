'use strict';
/* Aba "Previsto × observado": todo o registro numa visão geral, uma janela de 3 a 30 dias em detalhe,
   escala fixa, erro medido só nas preamares e baixamares, gráficos de pontos e curvas. */
(function () {
  const $ = id => document.getElementById(id), A = window.TCApp, TCH = window.TCH;
  const T = TCH.OBS_T, V = TCH.OBS_V, NR = TCH.NR, N = T.length, DAY = 864e5, H3 = 36e5, EPOCH = Date.UTC(2024, 0, 1);
  let ORANGE = '#D55E00', BLUE = '#0072B2'; const GREEN = '#009E73', GRAY = '#8a9590', AMBER = '#E69F00';   // paleta Okabe–Ito (legível por daltônicos)
  const FONT = '12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', PL = 'italic 700 14px Charter, "Iowan Old Style", Georgia, serif', AL = 58;
  const Y_MAIN = [-0.2, 4.0], Y_ERR = 60, Y_OV = [0.4, 2.8];   // escalas fixas
  const loc = ms => new Date(ms - 3 * H3), pad = n => String(n).padStart(2, '0');
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], MN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dm = ms => { const d = loc(ms); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`; };
  const hm = ms => { const d = loc(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const iso = ms => loc(ms).toISOString().slice(0, 10);
  const dayStart = ms => { const d = loc(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * H3; };
  const parseLocal = s => Date.parse(s.length > 10 ? s + '-03:00' : s + 'T00:00:00-03:00');
  const fmt = (v, n = 0) => A.fmt(v, n), sgn = (v, n = 0) => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '') + A.fmt(Math.abs(v), n);
  const lb = x => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < x) lo = m + 1; else hi = m; } return lo; };
  const SPARSE = parseLocal('2026-08-11'), FIT = [TCH.blocks[2]].map(b => b.map(parseLocal)), B01 = TCH.blocks[1].map(parseLocal);
  const inFit = t => FIT.some(([a, b]) => t >= a && t <= b);
  const m_ = cm => (cm - NR) / 100, first = dayStart(T[0]), last = dayStart(T[N - 1]);
  let P = null; const pred = () => P || (P = Float64Array.from(T, t => TCH.predictCm(t, true)));
  const EV = TCH.ev.map(e => ({ t: EPOCH + (e[0] + 180) * 6e4, type: e[1] ? 'Baixamar' : 'Preamar', bm: !!e[1], obs: e[2] / 10, prev: e[3] / 10, dt: e[4] })).sort((a, b) => a.t - b.t);
  const events = (t0, t1) => EV.filter(e => e.t >= t0 && e.t < t1);
  const PRESETS = [
    { id: 'teste', label: 'Teste independente · fev/2026', start: '2026-02-09' },
    { id: 'seca', label: 'Seca de 2024 · nov/2024', start: '2024-11-18' },
    { id: 'ajuste', label: 'Usado no ajuste · mai/2025', start: '2025-05-12' },
    { id: 'fim', label: 'Últimos dados · out/2026', start: null }
  ];
  const LENS = [3, 7, 15, 30];
  let start = 0, len = 7, active = null, built = false, G = null, month = null, daily = null, showAll = false;
  const rating = r => r <= 10 ? 'muito boa' : r <= 15 ? 'boa' : r <= 25 ? 'razoável' : 'fraca';

  /* ---------- estatísticas: só preamares e baixamares (previsto − observado, cm) ---------- */
  function stats(ev) {
    let n = 0, sp = 0, sq = 0; const ab = [];
    for (const v of ev) { const e = v.prev - v.obs; n++; sp += e; sq += e * e; ab.push(Math.abs(e)); }
    if (!n) return null; ab.sort((a, b) => a - b); return { n, bias: sp / n, rmse: Math.sqrt(sq / n), p90: ab[Math.floor(.9 * (n - 1))] };
  }

  function build() {
    $('cmpPresets').innerHTML = PRESETS.map(p => `<button class="chip" data-p="${p.id}" aria-pressed="false">${p.label}</button>`).join('');
    $('cmpLen').innerHTML = LENS.map(d => `<button class="chip" data-d="${d}" aria-pressed="false">${d} dias</button>`).join('');
    $('cmpPresets').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = PRESETS.find(x => x.id === b.dataset.p); len = 7; go(p.start ? parseLocal(p.start) : last - 6 * DAY, p.id); };
    $('cmpLen').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { len = +b.dataset.d; go(start, active); } };
    $('cmpPrev').onclick = () => go(start - len * DAY, null);
    $('cmpNext').onclick = () => go(start + len * DAY, null);
    $('cmpDate').onchange = () => { if ($('cmpDate').value) go(parseLocal($('cmpDate').value), null); };
    $('cmpCsv').onclick = () => exportCsv(false); $('cmpCsvAll').onclick = () => exportCsv(true);
    $('cmpAll').onclick = () => { showAll = !showAll; render(); };
    const pick = (cv, e, W) => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left; return W(x); };
    $('cmpOv').onpointerdown = e => { const r = $('cmpOv').getBoundingClientRect(), L = AL, R = 8, t = first + (e.clientX - r.left - L) / (r.width - L - R) * (last + DAY - first); len = len; go(t - len * DAY / 2, null); };
    $('cmpMonths').onclick = e => { const r = $('cmpMonths').getBoundingClientRect(), i = Math.floor((e.clientX - r.left - mx.L) / mx.bw); if (month && i >= 0 && i < month.list.length) { len = 30; go(month.list[i].t0, null); } };
    const wrap = $('cmpWrap');
    wrap.addEventListener('pointermove', hover); wrap.addEventListener('pointerleave', () => { $('cmpCursor').hidden = true; $('cmpTip').hidden = true; });
    window.addEventListener('resize', () => { if (!$('compare').hidden) render(); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (!$('compare').hidden && built) render(); }).observe($('cmpWrap'));
    built = true; go(parseLocal(PRESETS[0].start), 'teste');
  }
  function go(s, preset) { start = Math.max(first, Math.min(dayStart(s), last - (len - 1) * DAY)); active = preset; render(); }
  function show() { if (!built) build(); else render(); }

  function summary() {
    const all = stats(EV), test = stats(EV.filter(e => !inFit(e.t))), fit = stats(EV.filter(e => inFit(e.t)));
    const c = (k, s, sub) => `<div class="cmp-card"><div class="k">${k}</div><div class="v">${s ? fmt(s.rmse, 1) : '—'} <small>cm</small></div><div class="s">${sub}${s ? ` · ${fmt(s.n)} marés · tendência ${sgn(s.bias, 1)} cm` : ''}</div></div>`;
    $('cmpSummary').innerHTML = c('Todo o registro', all, 'erro típico de altura') + c('Só teste independente', test, 'dados não usados no ajuste') + c('Usado no ajuste', fit, 'bloco 02 (erro menor por construção)');
  }

  function render() {
    const t0 = start, t1 = start + len * DAY, ev = events(t0, t1), s = stats(ev), i0 = lb(t0), i1 = lb(t1);
    { const m = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255]).map(Number), dark = (m[0] + m[1] + m[2]) / 3 < 110;   // fundo escuro: tons mais claros da mesma paleta
      ORANGE = dark ? '#F28E4B' : '#D55E00'; BLUE = dark ? '#56B4E9' : '#0072B2'; $('compare').style.setProperty('--c-pm', ORANGE); $('compare').style.setProperty('--c-bm', BLUE); }
    $('cmpDate').value = iso(t0); $('cmpDate').min = iso(first); $('cmpDate').max = iso(last);
    document.querySelectorAll('#cmpPresets [data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === active));
    document.querySelectorAll('#cmpLen [data-d]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.d === len));
    const nfit = ev.filter(e => inFit(e.t)).length, fit = ev.length && nfit / ev.length > .5, sparse = t0 >= SPARSE, drought = t0 >= B01[0] - DAY && t0 <= B01[1];
    const tag = $('cmpTag'); tag.className = 'cmp-tag ' + (sparse ? 'sparse' : fit ? 'fit' : 'test');
    tag.textContent = (fit ? 'Período usado no ajuste da previsão: o erro aqui é menor do que seria em dados novos.' : 'Período de teste: estes dados não foram usados para ajustar a previsão. É o teste mais honesto.') +
      (drought ? ' Em 2024 houve seca extrema: o rio estava bem abaixo do normal.' : '') + (sparse ? ' Depois de 11/08/2026 a régua grava de forma irregular, com menos horas.' : '');
    if (!s) { $('cmpCards').innerHTML = ''; $('cmpVerdict').textContent = (t0 > Date.parse('2026-07-31T12:00:00-03:00') ? 'Depois de 31/07/2026 o registrador grava de forma irregular e as preamares e baixamares observadas não puderam ser medidas com precisão; as curvas acima continuam disponíveis. Escolha outro período para ver o erro.' : 'Sem preamares e baixamares observadas neste período. Escolha outro.'); }
    else {
      const evT = ev.reduce((a, e) => a + Math.abs(e.dt), 0) / ev.length;
      const bTxt = Math.abs(s.bias) < 1 ? 'sem tendência de ficar acima ou abaixo da água' : `a previsão ficou, em média, ${fmt(Math.abs(s.bias))} cm ${s.bias > 0 ? 'acima' : 'abaixo'} da água`;
      $('cmpCards').innerHTML = [
        ['Erro típico', `${fmt(s.rmse)} <small>cm</small>`, 'diferença típica de altura entre as preamares e baixamares previstas e observadas'],
        ['Tendência', `${sgn(s.bias)} <small>cm</small>`, bTxt],
        ['9 em cada 10 marés', `&lt; ${fmt(s.p90)} <small>cm</small>`, 'o erro de altura foi menor que isso em 90 % das preamares e baixamares'],
        ['Horário da maré', `${fmt(evT)} <small>min</small>`, `diferença média entre a hora prevista e a observada (${ev.length} marés)`]
      ].map(c => `<div class="cmp-card"><div class="k">${c[0]}</div><div class="v">${c[1]}</div><div class="s">${c[2]}</div></div>`).join('');
      const why = Math.abs(s.bias) >= 10 ? ` O nível médio da água estava diferente do usual (rio ${s.bias > 0 ? 'mais baixo' : 'mais alto'} que o esperado), e isso explica boa parte do erro.` : '';
      $('cmpVerdict').innerHTML = `Nestes ${len} dias (${fmt(s.n)} preamares e baixamares) a previsão foi <b>${rating(s.rmse)}</b>: errou em média ${fmt(s.rmse)} cm na altura.${why}`;
    }
    summary(); sizeCanvases(); drawOverview(t0, t1); drawMain(i0, i1, t0, t1, ev); drawErr(t0, t1, ev); table(ev); drawMonths();
    $('cmpCursor').hidden = true; $('cmpTip').hidden = true;
  }

  /* ---------- utilidades de desenho ---------- */
  const tall = () => (innerHeight >= 760 ? 1 : innerHeight >= 640 ? .85 : .7);
  function sizeCanvases() { const k = tall(); $('cmpOv').setAttribute('height', Math.round(150 * Math.max(k, .8))); $('cmpMain').setAttribute('height', Math.round(300 * k)); $('cmpErr').setAttribute('height', Math.round(140 * k)); $('cmpMonths').setAttribute('height', Math.round(190 * Math.max(k, .8))); }
  function setup(c) { const r = devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height'); c.width = Math.round(w * r); c.height = Math.round(h * r); const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return { x, w, h }; }
  const col = n => A.css(n), INK = () => A.css('--ink') || '#1c1c1c';
  /** curva suave por uma lista de pontos [x,y] (pontos médios, sem sobressair) */
  function smooth(x, pts) {
    if (pts.length < 2) return; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx_ = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; x.quadraticCurveTo(pts[i][0], pts[i][1], mx_, my); }
    x.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); x.stroke();
  }
  const dot = (x, px, py, r, fill, stroke, tri) => { x.beginPath(); if (tri) { x.moveTo(px, py - r * 1.2); x.lineTo(px + r * 1.1, py + r * .8); x.lineTo(px - r * 1.1, py + r * .8); x.closePath(); } else x.arc(px, py, r, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.6; x.stroke(); } };
  /** moldura de figura científica: eixos, marcas externas, título do eixo y e letra do painel */
  function frame(x, L, Tp, pw, ph, ytitle, letter) {
    const ink = INK(); x.save(); x.strokeStyle = ink; x.lineWidth = 1; x.globalAlpha = .85; x.strokeRect(L + .5, Tp + .5, pw, ph); x.restore();
    if (ytitle) { x.save(); x.translate(13, Tp + ph / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.fillStyle = col('--chart-text'); x.font = FONT; x.fillText(ytitle, 0, 0); x.restore(); }
    if (letter) { x.fillStyle = ink; x.font = PL; x.textAlign = 'left'; x.fillText(letter, L + 8, Tp + 17); }
  }
  const ytick = (x, L, y, label) => { x.beginPath(); x.moveTo(L - 4, y); x.lineTo(L, y); x.strokeStyle = INK(); x.lineWidth = 1; x.stroke(); x.fillStyle = col('--chart-text'); x.textAlign = 'right'; x.font = FONT; x.fillText(label, L - 7, y + 4); };
  function xticks(t0, t1, x, X, ph, Tp, h, pw) {
    const dayW = pw / len, step = Math.max(1, Math.ceil(56 / dayW)), grid = col('--chart-grid'), txt = col('--chart-text'), wd = dayW * step >= 64;
    x.textAlign = 'center'; x.fillStyle = txt; x.strokeStyle = grid; x.font = FONT; x.lineWidth = 1;
    for (let k = 0, t = t0; t < t1; k++, t += DAY) {
      x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke();
      if (h && k % step === 0) x.fillText((wd ? WD[loc(t).getUTCDay()] + ' ' : '') + dm(t), X(t + DAY / 2), h - 6);
    }
  }

  /* ---------- visão geral: todo o registro, média diária ---------- */
  function dailyData() {
    if (daily) return daily; const p = pred(), map = new Map();
    for (let i = 0; i < N; i++) { const k = dayStart(T[i]); let a = map.get(k); if (!a) map.set(k, a = { t: k, n: 0, o: 0, p: 0 }); a.n++; a.o += V[i]; a.p += p[i]; }
    return (daily = [...map.values()].filter(a => a.n >= 18).map(a => ({ t: a.t, o: m_(a.o / a.n), p: m_(a.p / a.n) })));
  }
  function drawOverview(t0, t1) {
    const { x, w, h } = setup($('cmpOv')), L = AL, R = 8, Tp = 8, B = 22, pw = w - L - R, ph = h - Tp - B, ta = first, tb = last + DAY, d = dailyData();
    const X = t => L + (t - ta) / (tb - ta) * pw, Y = v => Tp + ph - (v - Y_OV[0]) / (Y_OV[1] - Y_OV[0]) * ph, grid = col('--chart-grid'), txt = col('--chart-text');
    x.font = FONT; x.lineWidth = 1; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right';
    for (const v of [0.5, 1, 1.5, 2, 2.5]) { x.strokeStyle = grid; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); ytick(x, L, Y(v), fmt(v, 1)); }
    x.fillStyle = 'rgba(150,160,150,.18)'; for (const [a, b] of FIT) x.fillRect(X(a), Tp, X(b) - X(a), ph);
    x.fillStyle = txt; x.textAlign = 'center'; let lm = -1;
    for (let t = first; t < tb; t += DAY) { const dd = loc(t); if (dd.getUTCDate() === 1) { const mo = dd.getUTCFullYear() * 12 + dd.getUTCMonth(); x.strokeStyle = grid; x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke(); if (mo !== lm && dd.getUTCMonth() % (pw > 760 ? 2 : 3) === 0) x.fillText(MN[dd.getUTCMonth()] + '/' + String(dd.getUTCFullYear()).slice(2), X(t), h - 5); lm = mo; } }
    x.fillStyle = txt; x.textAlign = 'left'; x.font = FONT; x.fillText('ajuste (bloco 02)', X(FIT[0][0]) + 4, Tp + 13);
    const line = (key, c, wd) => { x.strokeStyle = c; x.lineWidth = wd; x.beginPath(); let pt = null; for (const a of d) { if (pt !== null && a.t - pt <= 2 * DAY) x.lineTo(X(a.t + DAY / 2), Y(a[key])); else x.moveTo(X(a.t + DAY / 2), Y(a[key])); pt = a.t; } x.stroke(); };
    line('p', GREEN, 1.9); line('o', INK(), 1.3); frame(x, L, Tp, pw, ph, 'Nível médio diário (m)', null);
    x.fillStyle = 'rgba(165,108,52,.16)'; x.strokeStyle = '#a56c34'; x.lineWidth = 1.5; const wx = X(t0), ww = Math.max(3, X(t1) - X(t0)); x.fillRect(wx, Tp, ww, ph); x.strokeRect(wx, Tp, ww, ph);
  }

  /* ---------- gráfico principal: curvas + pontos das preamares e baixamares ---------- */
  function drawMain(i0, i1, t0, t1, ev) {
    const { x, w, h } = setup($('cmpMain')), L = AL, R = 8, Tp = 8, B = 24, pw = w - L - R, ph = h - Tp - B;
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => Tp + ph - (v - Y_MAIN[0]) / (Y_MAIN[1] - Y_MAIN[0]) * ph;
    const grid = col('--chart-grid'), txt = col('--chart-text'), ink = INK();
    x.lineWidth = 1; xticks(t0, t1, x, X, ph, Tp, h, pw);
    x.textAlign = 'right'; x.fillStyle = txt; x.strokeStyle = grid;
    for (let v = 0; v <= 4; v++) { x.strokeStyle = grid; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); ytick(x, L, Y(v), String(v)); }
    x.setLineDash([5, 4]); x.strokeStyle = txt; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(w - R, Y(0)); x.stroke(); x.setLineDash([]);
    x.font = FONT; x.textAlign = 'left'; x.fillStyle = txt; x.fillText('NR', L + 5, Y(0) - 5);
    // faixas sem registro
    x.fillStyle = 'rgba(150,160,150,.16)'; let ps = t0;
    for (let i = Math.max(i0 - 1, 0); i <= Math.min(i1, N - 1); i++) { if (i > 0 && T[i] - T[i - 1] > 90 * 6e4) { const a = Math.max(T[i - 1], t0), b = Math.min(T[i], t1); if (b > a) x.fillRect(X(a), Tp, X(b) - X(a), ph); } }
    if (i0 >= N || T[i0] > t0 + 90 * 6e4) x.fillRect(X(t0), Tp, X(Math.min(i0 < N ? T[i0] : t1, t1)) - X(t0), ph);
    if (i1 > 0 && i1 <= N && T[i1 - 1] < t1 - 90 * 6e4) x.fillRect(X(T[i1 - 1]), Tp, X(t1) - X(T[i1 - 1]), ph);
    // previsto: curva contínua a cada 10 min
    x.strokeStyle = GREEN; x.lineWidth = 2.4; x.beginPath(); for (let t = t0, f = true; t <= t1; t += 6e5, f = false) { const px = X(t), py = Y(m_(TCH.predictCm(t, true))); if (f) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke();
    // observado: curva (quebra onde há lacuna)
    x.strokeStyle = ink; x.lineWidth = 1.6; x.beginPath(); let prev = -1; for (let i = i0; i < i1; i++) { const v = m_(V[i]); if (prev >= 0 && T[i] - T[prev] <= 90 * 6e4) x.lineTo(X(T[i]), Y(v)); else x.moveTo(X(T[i]), Y(v)); prev = i; } x.stroke();
    // pontos das preamares e baixamares
    for (const e of ev) { const ob = Y(m_(e.obs + NR)), pr = Y(m_(e.prev + NR)); x.strokeStyle = 'rgba(120,120,120,.45)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X(e.t), ob); x.lineTo(X(e.t + e.dt * 6e4), pr); x.stroke(); }
    for (const e of ev) { dot(x, X(e.t), Y(m_(e.obs + NR)), 3.6, ink, null); dot(x, X(e.t + e.dt * 6e4), Y(m_(e.prev + NR)), 3.8, col('--card') || '#fff', GREEN); }
    frame(x, L, Tp, pw, ph, 'Altura sobre o NR (m)', '(a)');
    G = { L, R, pw, w, t0, t1, i0, i1, ev };
  }

  /* ---------- erro de altura: pontos e curvas ---------- */
  function drawErr(t0, t1, ev) {
    const { x, w, h } = setup($('cmpErr')), L = AL, R = 8, Tp = 8, B = 8, pw = w - L - R, ph = h - Tp - B;
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => Tp + ph / 2 - v / Y_ERR * ph / 2, grid = col('--chart-grid'), txt = col('--chart-text');
    x.font = FONT; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right'; x.lineWidth = 1;
    for (const v of [-60, -30, 0, 30, 60]) { x.strokeStyle = grid; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); ytick(x, L, Y(v), (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v)); }
    for (let t = t0; t < t1; t += DAY) { x.beginPath(); x.moveTo(X(t), Tp); x.lineTo(X(t), Tp + ph); x.stroke(); }
    x.strokeStyle = txt; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(w - R, Y(0)); x.stroke();
    for (const bm of [false, true]) {
      const c = bm ? BLUE : ORANGE, list = ev.filter(e => e.bm === bm), pts = list.map(e => [X(e.t), Y(Math.max(-Y_ERR, Math.min(Y_ERR, e.prev - e.obs)))]);
      x.strokeStyle = c; x.lineWidth = 1.5; x.globalAlpha = .75; smooth(x, pts); x.globalAlpha = 1;
      list.forEach((e, i) => { const out = Math.abs(e.prev - e.obs) > Y_ERR; dot(x, pts[i][0], pts[i][1], 3.8, out ? null : c, out ? c : null, bm); });
    }
    frame(x, L, Tp, pw, ph, 'Erro de altura (cm)', '(b)');
  }
  /* cursor e dica: elementos HTML, sem redesenhar os gráficos */
  function hover(e) {
    if (!G) return; const r = $('cmpWrap').getBoundingClientRect(), px = e.clientX - r.left;
    if (px < G.L || px > G.w - G.R) { $('cmpCursor').hidden = true; $('cmpTip').hidden = true; return; }
    const t = G.t0 + (px - G.L) / G.pw * (G.t1 - G.t0), cur = $('cmpCursor'), tip = $('cmpTip'), tol = 9 * (G.t1 - G.t0) / G.pw;
    let ne = null, bd = tol; for (const v of G.ev) { const d = Math.min(Math.abs(v.t - t), Math.abs(v.t + v.dt * 6e4 - t)); if (d < bd) { bd = d; ne = v; } }
    cur.hidden = false; tip.hidden = false;
    if (ne) {
      const d = ne.prev - ne.obs; cur.style.left = (G.L + (ne.t - G.t0) / (G.t1 - G.t0) * G.pw) + 'px';
      tip.innerHTML = `<b>${ne.type} · ${WD[loc(ne.t).getUTCDay()]} ${dm(ne.t)}</b><br>Observada: ${fmt(m_(ne.obs + NR), 2)} m às ${hm(ne.t)}<br>Prevista: ${fmt(m_(ne.prev + NR), 2)} m às ${hm(ne.t + ne.dt * 6e4)}<br>Erro: ${sgn(d)} cm na altura, ${sgn(ne.dt)} min no horário`;
    } else {
      const i = lb(t), k = i > G.i0 && (i >= G.i1 || Math.abs(T[i - 1] - t) < Math.abs(T[i] - t)) ? i - 1 : i;
      if (k < G.i0 || k >= G.i1 || Math.abs(T[k] - t) > 90 * 6e4) { cur.hidden = true; tip.hidden = true; return; }
      const o = m_(V[k]), p = m_(pred()[k]), d = (p - o) * 100; cur.style.left = (G.L + (T[k] - G.t0) / (G.t1 - G.t0) * G.pw) + 'px';
      tip.innerHTML = `<b>${WD[loc(T[k]).getUTCDay()]} ${dm(T[k])} ${hm(T[k])}</b><br>Observado: ${fmt(o, 2)} m<br>Previsto: ${fmt(p, 2)} m<br>Diferença: ${sgn(d)} cm${Math.abs(d) < 1 ? '' : d > 0 ? ' (previsto acima)' : ' (previsto abaixo)'}`;
    }
    const cx = parseFloat(cur.style.left), tw = tip.offsetWidth; tip.style.left = (cx + tw + 16 > r.width ? cx - tw - 10 : cx + 10) + 'px';
  }
  /* ---------- tabela de preamares e baixamares ---------- */
  function table(ev) {
    const el = $('cmpEvents'), list = showAll ? EV : ev;
    $('cmpAll').textContent = showAll ? 'Ver só este período' : `Ver todas as ${fmt(EV.length)} marés do registro`;
    $('cmpEvTitle').textContent = showAll ? `Todas as preamares e baixamares do registro (${fmt(EV.length)})` : 'Preamares e baixamares neste período';
    if (!list.length) { el.innerHTML = '<tbody><tr><td>Sem preamares e baixamares completas neste período.</td></tr></tbody>'; return; }
    const day = e => `${WD[loc(e.t).getUTCDay()]} ${dm(e.t)}${showAll ? '/' + String(loc(e.t).getUTCFullYear()).slice(2) : ''} ${hm(e.t)}`;
    el.innerHTML = '<thead><tr><th>Maré</th><th>Quando (observado)</th><th>Hora prevista</th><th>Altura observada</th><th>Altura prevista</th><th>Erro de altura</th></tr></thead><tbody>' +
      list.map(e => { const ph = hm(e.t + e.dt * 6e4), da = e.prev - e.obs; return `<tr><td>${e.type}</td><td>${day(e)}</td><td class="${Math.abs(e.dt) > 25 ? 'bad' : ''}">${ph} (${e.dt === 0 ? 'igual' : sgn(e.dt) + ' min'})</td><td>${fmt(e.obs / 100, 2)} m</td><td>${fmt(e.prev / 100, 2)} m</td><td class="${Math.abs(da) <= 10 ? 'good' : Math.abs(da) > 25 ? 'bad' : ''}">${sgn(da)} cm</td></tr>`; }).join('') + '</tbody>';
  }
  /* ---------- erro mês a mês: pontos e curva ---------- */
  const mx = { L: AL, bw: 1 };
  function monthsData() {
    if (month) return month; const acc = new Map();
    for (const v of EV) { const d = loc(v.t), k = d.getUTCFullYear() * 12 + d.getUTCMonth(), e = v.prev - v.obs; let a = acc.get(k); if (!a) acc.set(k, a = { y: d.getUTCFullYear(), m: d.getUTCMonth(), n: 0, sq: 0, fit: 0, t0: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 3 * H3 }); a.n++; a.sq += e * e; if (inFit(v.t)) a.fit++; }
    const list = [...acc.values()].filter(a => a.n >= 10).map(a => ({ ...a, rmse: Math.sqrt(a.sq / a.n), kind: a.t0 >= SPARSE - 11 * DAY ? 'sparse' : a.fit / a.n > .5 ? 'fit' : 'test' }));
    return (month = { list });
  }
  function drawMonths() {
    const { x, w, h } = setup($('cmpMonths')), list = monthsData().list, L = mx.L, R = 10, Tp = 16, B = 22, pw = w - L - R, ph = h - Tp - B, bw = pw / list.length, Y = v => Tp + ph - v / 60 * ph;
    mx.bw = bw; const grid = col('--chart-grid'), txt = col('--chart-text'), cur = loc(start); x.font = FONT; x.strokeStyle = grid; x.fillStyle = txt; x.textAlign = 'right'; x.lineWidth = 1;
    for (const v of [0, 20, 40, 60]) { x.strokeStyle = grid; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke(); ytick(x, L, Y(v), String(v)); }
    frame(x, L, Tp, pw, ph, 'Erro típico (cm)', null);
    const pts = list.map((a, i) => [L + (i + .5) * bw, Y(Math.min(a.rmse, 60))]);
    x.strokeStyle = txt; x.lineWidth = 1.6; x.globalAlpha = .7; smooth(x, pts); x.globalAlpha = 1;
    list.forEach((a, i) => {
      const c = a.kind === 'test' ? GREEN : a.kind === 'fit' ? GRAY : AMBER, sel = a.y === cur.getUTCFullYear() && a.m === cur.getUTCMonth();
      dot(x, pts[i][0], pts[i][1], sel ? 6 : 4.6, c, sel ? INK() : null);
      x.fillStyle = txt; x.font = FONT; x.textAlign = 'center'; x.fillText(fmt(a.rmse), pts[i][0], pts[i][1] - 9);
      x.fillText(MN[a.m] + (a.m === 0 || i === 0 ? '/' + String(a.y).slice(2) : ''), pts[i][0], h - 6);
    });
  }
  function exportCsv(all) {
    const list = all ? EV : events(start, start + len * DAY);
    let csv = '﻿Mare;Data_hora_observada_UTC-3;Hora_prevista;Erro_horario_min;Altura_observada_m_acima_NR;Altura_prevista_m_acima_NR;Erro_altura_cm (previsto - observado)\r\n';
    for (const e of list) csv += [e.type, `${iso(e.t)} ${hm(e.t)}`, hm(e.t + e.dt * 6e4), e.dt, A.fmt(e.obs / 100, 3), A.fmt(e.prev / 100, 3), A.fmt(e.prev - e.obs, 1)].join(';') + '\r\n';
    A.download(csv, 'text/csv;charset=utf-8', all ? 'Previsto_x_Observado_PM_BM_todo_o_registro.csv' : `Previsto_x_Observado_PM_BM_${iso(start)}_${len}dias.csv`);
  }
  window.TCCompare = { show };
  if (!$('compare').hidden) show();
})();
