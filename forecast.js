'use strict';
/* Aba Previsão: curva do dia com leitura da hora escolhida e lista de preamares e baixamares. */
(function () {
  const $ = id => document.getElementById(id), HOST = window.TCHost, A = window.TCApp;
  if (!HOST || !$('fcChart')) return;
  const Y = [-0.2, 3.6], L = 58, R = 10, TP = 12, BT = 26, DAY = 864e5, H3 = 36e5;
  const FONT = '12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', GREEN = '#009E73';
  const pad = n => String(n).padStart(2, '0'), fmt = (v, n = 2) => A.fmt(v, n);
  const clock = ms => { const d = new Date(ms - 3 * H3); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
  const now = () => { const s = new Date(Date.now() - 3 * H3).toISOString(); return { date: s.slice(0, 10), time: s.slice(11, 16) }; };
  const css = n => A.css(n) || '';
  let G = null;
  function inputs() {
    const loc = $('fcLoc').value, date = $('fcDate').value, time = $('fcTime').value;
    return { loc, date, time, ts: Date.parse(date + 'T' + time + ':00-03:00'), day: Date.parse(date + 'T00:00:00-03:00') };
  }
  function dur(ms) { const m = Math.max(0, Math.round(ms / 6e4)); return `em ${Math.floor(m / 60)} h ${pad(m % 60)} min`; }
  function render() {
    if ($('forecast').hidden) return;
    const q = inputs(), warn = $('fcWarn'); warn.hidden = true;
    const lo = q.loc === 'san' ? '2026-01-01' : '2024-01-01', hi = q.loc === 'san' ? '2026-12-31' : '2030-12-31'; $('fcDate').min = lo; $('fcDate').max = hi;
    const clear = () => { ['fcAt', 'fcLevel', 'fcPM', 'fcBM'].forEach(i => $(i).textContent = '—'); ['fcTrend', 'fcPMs', 'fcBMs'].forEach(i => $(i).textContent = ''); $('fcDay').innerHTML = ''; G = null; draw(null); };
    if (!q.date || !q.time || !Number.isFinite(q.ts)) { clear(); return; }
    if (q.date < lo || q.date > hi) { clear(); warn.textContent = q.loc === 'san' ? 'A tábua de Santana cobre só 2026.' : 'A previsão vale de 2024 a 2030.'; warn.hidden = false; return; }
    const v = HOST.value(q.ts, q.loc), v2 = HOST.value(q.ts + 6e5, q.loc);
    $('fcAt').textContent = q.time; $('fcLevel').innerHTML = v === null ? '—' : fmt(v) + ' <small>m</small>';
    $('fcTrend').textContent = v === null || v2 === null ? '' : (v2 > v + .003 ? 'subindo' : v2 < v - .003 ? 'baixando' : 'estável') + (q.loc === 'san' ? ' · na tábua' : ' · acima do NR');
    const ext = HOST.extremes(q.day, q.loc), nextOf = t => ext.find(e => e.type === t && e.ts > q.ts);
    for (const [t, a, b] of [['PM', 'fcPM', 'fcPMs'], ['BM', 'fcBM', 'fcBMs']]) { const n = nextOf(t); $(a).textContent = n ? clock(n.ts) : '—'; $(b).textContent = n ? (n.ts - q.day >= DAY ? 'dia seguinte · ' : '') + dur(n.ts - q.ts) + ' · ' + fmt(n.h) + ' m' : ''; }
    const day = ext.filter(e => e.ts >= q.day && e.ts < q.day + DAY);
    $('fcDay').innerHTML = day.map(e => `<li class="${e.type === 'PM' ? 'pm' : 'bm'}"><b>${e.type === 'PM' ? '▲ Preamar' : '▼ Baixamar'}</b> ${clock(e.ts)} · ${fmt(e.h)} m</li>`).join('') || '<li>Sem marés neste dia.</li>';
    draw({ q, day });
  }
  function draw(d) {
    const c = $('fcChart'), r = devicePixelRatio || 1, w = c.clientWidth, h = Math.round((innerHeight >= 760 ? 320 : innerHeight >= 640 ? 280 : 240)); c.setAttribute('height', h);
    c.width = Math.round(w * r); c.height = Math.round(h * r); const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h);
    const ink = css('--ink') || '#222', txt = css('--chart-text') || '#667', grid = css('--chart-grid') || '#ddd', pw = w - L - R, ph = h - TP - BT;
    const dark = (document.body && (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255]).slice(0, 3).reduce((a, b) => a + +b, 0) / 3 < 110), PM = dark ? '#F28E4B' : '#D55E00', BM = dark ? '#56B4E9' : '#0072B2';
    const X = m => L + m / 1440 * pw, Yv = v => TP + ph - (v - Y[0]) / (Y[1] - Y[0]) * ph;
    x.font = FONT; x.lineWidth = 1; x.textAlign = 'right';
    for (let v = 0; v <= 3.5; v += .5) { x.strokeStyle = grid; x.beginPath(); x.moveTo(L, Yv(v)); x.lineTo(w - R, Yv(v)); x.stroke(); x.strokeStyle = ink; x.beginPath(); x.moveTo(L - 4, Yv(v)); x.lineTo(L, Yv(v)); x.stroke(); x.fillStyle = txt; x.fillText(fmt(v, 1), L - 7, Yv(v) + 4); }
    x.textAlign = 'center'; for (let hh = 0; hh <= 24; hh += 3) { x.strokeStyle = grid; x.beginPath(); x.moveTo(X(hh * 60), TP); x.lineTo(X(hh * 60), TP + ph); x.stroke(); x.fillStyle = txt; x.fillText(pad(hh) + 'h', X(hh * 60), h - 8); }
    x.save(); x.translate(13, TP + ph / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.fillStyle = txt; x.fillText(d && d.q.loc === 'san' ? 'Altura na tábua (m)' : 'Altura acima do NR (m)', 0, 0); x.restore();
    x.strokeStyle = ink; x.globalAlpha = .85; x.strokeRect(L + .5, TP + .5, pw, ph); x.globalAlpha = 1;
    if (!d) { G = null; return; }
    const { q, day } = d; G = { w, pw, q };
    x.strokeStyle = GREEN; x.lineWidth = 2.6; x.beginPath(); let f = true;
    for (let m = 0; m <= 1440; m += 5) { const v = HOST.value(q.day + m * 6e4, q.loc); if (v === null) { f = true; continue; } if (f) { x.moveTo(X(m), Yv(v)); f = false; } else x.lineTo(X(m), Yv(v)); } x.stroke();
    const nw = now(); if (nw.date === q.date) { const m = (Date.now() - q.day) / 6e4; x.setLineDash([2, 3]); x.strokeStyle = txt; x.lineWidth = 1; x.beginPath(); x.moveTo(X(m), TP); x.lineTo(X(m), TP + ph); x.stroke(); x.setLineDash([]); x.fillStyle = txt; x.textAlign = 'left'; x.fillText('agora', X(m) + 4, TP + 12); }
    x.textAlign = 'center';
    for (const e of day) { const m = (e.ts - q.day) / 6e4, px = X(m), py = Yv(e.h), col = e.type === 'PM' ? PM : BM; x.beginPath(); x.arc(px, py, 4.5, 0, 7); x.fillStyle = col; x.fill(); x.fillStyle = ink; x.font = '600 12px ui-sans-serif, system-ui, sans-serif'; const ly = e.type === 'PM' ? py - 10 : py + 20; x.fillText(clock(e.ts), Math.max(L + 20, Math.min(w - R - 20, px)), ly); x.font = FONT; }
    const v = HOST.value(q.ts, q.loc);
    if (v !== null) { const m = (q.ts - q.day) / 6e4, px = X(m), py = Yv(v); x.strokeStyle = css('--ochre') || '#a56c34'; x.lineWidth = 1.5; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(px, TP); x.lineTo(px, TP + ph); x.stroke(); x.setLineDash([]); x.beginPath(); x.arc(px, py, 6, 0, 7); x.fillStyle = css('--ochre') || '#a56c34'; x.fill(); x.strokeStyle = css('--card') || '#fff'; x.lineWidth = 2; x.stroke(); }
  }
  function pick(e) { if (!G) return; const r = $('fcChart').getBoundingClientRect(), px = e.clientX - r.left; if (px < L || px > G.w - R) return; const m = Math.max(0, Math.min(1435, Math.round((px - L) / G.pw * 1440 / 5) * 5)); $('fcTime').value = pad(Math.floor(m / 60)) + ':' + pad(m % 60); render(); }
  let drag = false; const cv = $('fcChart');
  cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); pick(e); }); cv.addEventListener('pointermove', e => { if (drag) pick(e); }); cv.addEventListener('pointerup', () => drag = false); cv.addEventListener('pointercancel', () => drag = false);
  cv.style.touchAction = 'pan-y';
  function shift(n) { const d = new Date($('fcDate').value + 'T12:00:00Z'); if (isNaN(d)) return; d.setUTCDate(d.getUTCDate() + n); $('fcDate').value = d.toISOString().slice(0, 10); render(); }
  function setNow() { const n = now(); $('fcDate').value = n.date; $('fcTime').value = n.time; render(); }
  ['fcLoc', 'fcDate', 'fcTime'].forEach(i => $(i).addEventListener('change', render)); $('fcPrev').onclick = () => shift(-1); $('fcNext').onclick = () => shift(1); $('fcNow').onclick = setNow;
  $('fcCsv').onclick = () => {
    const q = inputs(); if (!Number.isFinite(q.day)) return; let csv = '﻿Local;Data_hora_UTC-03;Altura_m\r\n';
    for (let m = 0; m < 1440; m += 15) { const ts = q.day + m * 6e4, v = HOST.value(ts, q.loc); csv += [q.loc === 'san' ? 'Porto de Santana (tábua)' : 'Fazendinha (acima do NR)', q.date + ' ' + clock(ts), v === null ? '' : fmt(v, 3)].join(';') + '\r\n'; }
    A.download(csv, 'text/csv;charset=utf-8', 'Previsao_' + q.loc + '_' + q.date + '.csv');
  };
  const n0 = now(); const inY = n0.date >= '2024-01-01' && n0.date <= '2030-12-31'; $('fcDate').value = inY ? n0.date : '2026-01-01'; $('fcTime').value = inY ? n0.time : '12:00';
  window.addEventListener('resize', render); if (window.ResizeObserver) new ResizeObserver(() => { if (!$('forecast').hidden) render(); }).observe($('fcChart').parentNode);
  window.TCForecast = { show: render };
  if (!$('forecast').hidden) render();
})();
