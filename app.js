'use strict';
(() => {
const D = window.TC_DATA, MODELS = D.models, TCH = window.TCH, NRM = TCH.NR / 100, CUR = { method: 'harmA' };
// o NR de trabalho (66,7 cm acima do zero da régua) substitui o antigo RLS − 0,75 m nos dados históricos
D.daily.forEach(d => d[1] = d[1] + .75 - NRM); D.monthly.forEach(q => { if (q.mean_R !== null) q.mean_H = q.mean_R - NRM; }); D.comparison.forEach(q => { q.mean_2024 += .75 - NRM; q.mean_2025 += .75 - NRM; });
const $ = id => document.getElementById(id);
const HM = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LAST_MODEL = 10, TZ = 'America/Fortaleza';
const fmt = (v, n = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n });
const signed = (v, n = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), n);
const parse = s => /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : NaN;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const wide = () => window.innerWidth <= 600;

/* ---------- utilitários ---------- */
const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const tcrit = df => df < 1 ? NaN : df <= 30 ? T975[df] : 1.96 + 2.4 / df;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado'); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); toast('Copiado'); } catch { toast('Não foi possível copiar'); } t.remove(); }
}
function nowParts() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { year: +p.year, month: +p.month, date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const NOW = nowParts();
const clock = ts => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ts);
const monthOf = ts => new Date(ts - 10800000).getUTCMonth() + 1;
function setupSubnav(nav, onChange) {
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    nav.querySelectorAll('[data-view]').forEach(x => { x.setAttribute('aria-pressed', x === b); $(x.dataset.view).hidden = x !== b; });
    if (onChange) onChange(b.dataset.view);
  });
}
function monthOptions(sel, defMonth) {
  sel.innerHTML = HM.slice(0, LAST_MODEL).map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
  sel.value = String(defMonth);
}
function lagBadge(m) {
  m = Number(m);
  if (m < 8) return '';
  const n = D.events.filter(e => e.m === m && e.d).length;
  return `A partir de 11/08/2026 o registrador passou a amostrar de forma irregular (15 a 60 min). Há ${n} eventos de resolução preferencial em ${HM[m - 1].toLowerCase()}; use "≤65 min · ampliado" com cautela, pois o horário do extremo é estimado por ajuste local.`;
}
/* ---------- abas ---------- */
const PANELS = ['converter', 'lunar', 'history', 'forecast', 'compare'];
function showPanel(name, push = true) {
  if (!PANELS.includes(name)) name = 'converter';
  PANELS.forEach(p => { $(p).hidden = p !== name; $('tab-' + p).setAttribute('aria-selected', p === name); $('tab-' + p).tabIndex = p === name ? 0 : -1; });
  if (push) try { history.replaceState(null, '', '#' + name); } catch {}
  if (name === 'compare' && window.TCCompare) TCCompare.show(); if (name === 'lunar') drawLagChart(); if (name === 'history') drawHistory(); if (name === 'forecast') renderForecast();
}
document.querySelector('.topnav').addEventListener('click', e => { const b = e.target.closest('[data-panel]'); if (b) showPanel(b.dataset.panel); });
document.querySelector('.topnav').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = PANELS.findIndex(p => !$(p).hidden), n = PANELS[(i + (e.key === 'ArrowRight' ? 1 : PANELS.length - 1)) % PANELS.length];
  showPanel(n); $('tab-' + n).focus();
});
document.querySelectorAll('[data-method]').forEach(b => b.onclick = () => {
  const section = $(b.dataset.method), d = section.querySelector('details.method'), clone = d.cloneNode(true);
  clone.querySelector('summary').remove();
  $('methodTitle').textContent = d.querySelector('summary').textContent;
  $('methodBody').innerHTML = clone.innerHTML;
  $('methodDialog').showModal();
});
$('closeMethod').onclick = () => $('methodDialog').close();
$('methodDialog').onclick = e => { if (e.target === $('methodDialog')) $('methodDialog').close(); };

/* ================= ALTURAS ================= */
let mode = 'staff';
const DCAL = D.dcal, META = D.meta, LASTPAIR = META.last_pair.slice(0, 10);
const dateISO = ts => new Date(ts - 10800000).toISOString().slice(0, 10);
const fmtBR = iso => iso.split('-').reverse().join('/');
// calibração local por data: reta T = a + b·R ajustada com pesos gaussianos (σ = 15 dias) em torno da data
function calFor(iso) {
  const d = new Date(iso + 'T00:00:00Z'), raw = Math.floor((d - Date.UTC(2026, 0, 1)) / 864e5) + 1, doy = Math.max(1, Math.min(365, raw));
  const r = DCAL[doy - 1];
  return { a: r[0], b: r[1], neff: r[2], rmse: r[3], rmse_R: r[3] / r[1], min: r[4], max: r[5], minT: r[6], maxT: r[7], flag: r[8], outside: raw < 1 || raw > 365, iso, doy };
}
function calBadge(p) {
  if (p.outside) return 'A calibração cobre somente 2026; usando o ajuste do dia mais próximo.';
  if (p.flag === 2) return `Ainda não há pares depois de ${fmtBR(LASTPAIR)}: usando a calibração mais recente (extrapolação). Maior incerteza.`;
  if (p.neff < 20) return `Ajuste local com poucos pares (≈${Math.round(p.neff)} efetivos), o que amplia a incerteza.`;
  return '';
}
function convert(v, source, p) {
  const r = source === 'staff' ? v : (v - p.a) / p.b;
  return { r, h: r - NRM, t: source === 'table' ? v : p.a + p.b * r };
}
function renderRange(v, lo, hi) {
  const pad = (hi - lo) * .35, a = lo - pad, b = hi + pad, pos = x => Math.max(0, Math.min(100, (x - a) / (b - a) * 100));
  $('rangebar').innerHTML = `<div class="track"></div><div class="calib" style="left:${pos(lo)}%;width:${pos(hi) - pos(lo)}%"></div>` +
    (Number.isFinite(v) ? `<div class="mark" style="left:${pos(v)}%"></div>` : '') +
    `<span class="lbl" style="left:${pos(lo)}%">${fmt(lo)}</span><span class="lbl" style="left:${pos(hi)}%;transform:translateX(-100%)">${fmt(hi)}</span>`;
}
function renderConverter() {
  const iso = $('calDate').value || NOW.date, p = calFor(iso), v = parse($('value').value), ok = Number.isFinite(v);
  $('staffMode').setAttribute('aria-pressed', mode === 'staff'); $('tableMode').setAttribute('aria-pressed', mode === 'table');
  $('valueLabel').textContent = mode === 'staff' ? 'Régua acima do zero' : 'Altura da tábua de Santana';
  $('equivLabel').innerHTML = mode === 'staff' ? 'Equivalente na tábua<br>de Santana' : 'Equivalente na régua<br>acima do zero';
  $('nrNote').textContent = mode === 'staff' ? 'Leitura − ' + fmt(NRM, 3) + ' m' : 'Estimativa para Fazendinha';
  $('basis').textContent = 'NR = leitura da régua − ' + fmt(NRM, 3) + ' m. A equivalência usa o ajuste local da data selecionada (janela gaussiana de ' + META.sigma_days + ' dias).';
  const badge = calBadge(p); $('monthBadge').hidden = !badge; $('monthBadge').textContent = badge;
  const lo = mode === 'staff' ? p.min : p.minT, hi = mode === 'staff' ? p.max : p.maxT;
  $('value').setAttribute('aria-invalid', !ok && $('value').value.trim() !== '');
  $('warning').hidden = true; $('calculation').textContent = '';
  renderRange(ok ? v : NaN, lo, hi);
  if (ok) {
    const q = convert(v, mode, p), err = (mode === 'staff' ? p.rmse : p.rmse_R) * 100;
    $('nr').innerHTML = (mode === 'table' ? '≈ ' : '') + fmt(q.h) + ' <small>m</small>';
    $('equiv').innerHTML = '≈ ' + fmt(mode === 'staff' ? q.t : q.r) + ' <small>m</small>';
    $('equivNote').textContent = (mode === 'staff' ? 'Estimativa para Santana' : 'Estimativa para Fazendinha') + ' · erro típico ≈ ' + fmt(err, 1) + ' cm';
    $('calculation').textContent = mode === 'staff'
      ? `Cálculo: NR = ${fmt(v)} − ${fmt(NRM, 3)} = ${fmt(q.h)} m. Tábua = ${fmt(p.a, 3)} + ${fmt(p.b, 3)} × ${fmt(v)} = ${fmt(q.t)} m.`
      : `Cálculo: régua = (${fmt(v)} − (${fmt(p.a, 3)})) / ${fmt(p.b, 3)} = ${fmt(q.r)} m; NR = ${fmt(q.r)} − ${fmt(NRM, 3)} = ${fmt(q.h)} m.`;
    $('plain').textContent = mode === 'staff'
      ? `Régua em ${fmt(v)} m significa ${fmt(q.h)} m acima do NR e corresponde a cerca de ${fmt(q.t)} m na tábua de Santana (erro típico ≈ ${fmt(err, 0)} cm).`
      : `Uma altura de ${fmt(v)} m na tábua de Santana equivale a cerca de ${fmt(q.r)} m na régua de Fazendinha, ou ${fmt(q.h)} m acima do NR (erro típico ≈ ${fmt(err, 0)} cm).`;
    $('rangeNote').textContent = v < lo || v > hi ? '' : `O valor está dentro da faixa em que a calibração foi testada (${fmt(lo)} a ${fmt(hi)} m).`;
    if (v < lo || v > hi) { $('warning').hidden = false; $('warning').textContent = `Extrapolação: altura fora da faixa calibrada nesta época (${fmt(lo)} a ${fmt(hi)} m). Maior incerteza.`; }
  } else {
    $('nr').textContent = '—'; $('equiv').textContent = '—'; $('equivNote').textContent = ''; $('plain').textContent = ''; $('rangeNote').textContent = '';
    if ($('value').value.trim()) { $('warning').hidden = false; $('warning').textContent = 'Informe uma altura válida em metros. Exemplo: 2,00.'; }
  }
  $('model').textContent = `${fmtBR(iso)} · T = ${fmt(p.a, 6)} + ${fmt(p.b, 6)} × R · ≈${Math.round(p.neff)} pares efetivos · erro típico (validação por semanas excluídas): tábua ${fmt(p.rmse * 100, 1)} cm; régua ${fmt(p.rmse_R * 100, 1)} cm.`;
  renderBatch();
}
function renderBatch() {
  const p = calFor($('calDate').value || NOW.date), lines = $('batch').value.split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) { $('batchOut').innerHTML = ''; return; }
  const lo = mode === 'staff' ? p.min : p.minT, hi = mode === 'staff' ? p.max : p.maxT;
  $('batchOut').innerHTML = '<table><thead><tr><th>' + (mode === 'staff' ? 'Régua (m)' : 'Tábua (m)') + '</th><th>NR (m)</th><th>' + (mode === 'staff' ? 'Tábua (m)' : 'Régua (m)') + '</th><th>Obs.</th></tr></thead><tbody>' +
    lines.map(l => { const v = parse(l); if (!Number.isFinite(v)) return `<tr><td>${l.replace(/[<>&]/g, '')}</td><td>—</td><td>—</td><td>inválido</td></tr>`; const q = convert(v, mode, p); return `<tr><td>${fmt(v)}</td><td>${fmt(q.h)}</td><td>${fmt(mode === 'staff' ? q.t : q.r)}</td><td>${v < lo || v > hi ? 'extrapolado' : ''}</td></tr>`; }).join('') + '</tbody></table>';
}
function fillModelTable() {
  $('modelTable').querySelector('tbody').innerHTML = Object.entries(MODELS).map(([m, p]) => `<tr data-m="${m}"><td>${p.name}</td><td>${fmt(p.a, 3)}</td><td>${fmt(p.b, 3)}<small> [${fmt(p.b_ci[0], 3)}–${fmt(p.b_ci[1], 3)}]</small></td><td>${p.n}</td><td>${fmt(p.rmse * 100, 1)}</td><td>${fmt(p.rmse_R * 100, 1)}</td><td>${fmt(p.min)}–${fmt(p.max)}</td></tr>`).join('');
  $('calibText').textContent = `A série RLS de Fazendinha (${META.rows.toLocaleString('pt-BR')} leituras de ${fmtBR(META.first.slice(0, 10))} a ${fmtBR(META.last.slice(0, 10))}) é usada somente para calibração: ${META.cal_pairs} pares de extremos PM/BM de 2026, comparados com a tábua de Santana. O ajuste é local no tempo (pesos gaussianos de ${META.sigma_days} dias), de modo que não há saltos na virada do mês. Último par: ${fmtBR(LASTPAIR)}. Não há consulta em tempo real.`;
}
function chooseMonth(m) { $('lunarMonth').value = String(m); renderLunar(); }
function setCalDate(iso) { $('calDate').value = iso; renderConverter(); }
$('staffMode').onclick = () => { mode = 'staff'; renderConverter(); };
$('tableMode').onclick = () => { mode = 'table'; renderConverter(); };
$('swapMode').onclick = () => {
  const v = parse($('value').value);
  if (Number.isFinite(v)) { const q = convert(v, mode, calFor($('calDate').value || NOW.date)); $('value').value = fmt(mode === 'staff' ? q.t : q.r); }
  mode = mode === 'staff' ? 'table' : 'staff'; renderConverter();
};
$('value').addEventListener('input', renderConverter);
$('calDate').onchange = renderConverter;
$('batch').addEventListener('input', renderBatch);
const stepValue = d => { const v = parse($('value').value); $('value').value = fmt((Number.isFinite(v) ? v : 0) + d); renderConverter(); };
$('valueUp').onclick = () => stepValue(.05); $('valueDown').onclick = () => stepValue(-.05);
$('value').addEventListener('keydown', e => { if (e.key === 'ArrowUp') { e.preventDefault(); stepValue(.01); } if (e.key === 'ArrowDown') { e.preventDefault(); stepValue(-.01); } });
$('copyResult').onclick = () => {
  const v = parse($('value').value); if (!Number.isFinite(v)) return toast('Informe uma altura válida');
  const iso = $('calDate').value || NOW.date, q = convert(v, mode, calFor(iso));
  copy(mode === 'staff' ? `Régua ${fmt(v)} m (${fmtBR(iso)}): NR ${fmt(q.h)} m; tábua de Santana ≈ ${fmt(q.t)} m.` : `Tábua ${fmt(v)} m (${fmtBR(iso)}): régua ≈ ${fmt(q.r)} m; NR ≈ ${fmt(q.h)} m.`);
};
$('batchCsv').onclick = () => {
  const lines = $('batch').value.split(/\n+/).map(x => x.trim()).filter(Boolean); if (!lines.length) return toast('Cole valores primeiro');
  const iso = $('calDate').value || NOW.date, p = calFor(iso); let csv = '﻿Entrada_m;NR_m;Equivalente_m;Sentido;Data_calibracao\r\n';
  lines.forEach(l => { const v = parse(l); if (!Number.isFinite(v)) return; const q = convert(v, mode, p); csv += [fmt(v, 4), fmt(q.h, 4), fmt(mode === 'staff' ? q.t : q.r, 4), mode === 'staff' ? 'regua->tabua' : 'tabua->regua', iso].join(';') + '\r\n'; });
  download(csv, 'text/csv;charset=utf-8', 'TideConversor_Lote.csv');
};

/* ================= HORÁRIOS ================= */
let activeChart = 'S';
function getStats(month, cycle, type) {
  const width = Number($('window').value), dense = $('support').value === 'dense';
  const z = D.events.filter(e => e.m === Number(month) && e.c === cycle && e.t === type && e.dist <= width && (!dense || e.d)).map(e => e.lag), n = z.length;
  if (n < 3) return { n, mean: null };
  const mean = z.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(z.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)), s = [...z].sort((a, b) => a - b);
  return { n, mean, sd, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, ci: tcrit(n - 1) * sd / Math.sqrt(n), min: s[0], max: s[n - 1] };
}
const CYC = { S: 'Sizígia', Q: 'Quadratura' };
function phaseValue(month, c, t) {
  const s = getStats(month, c, t), ok = s.mean !== null;
  return `<div><div class="kind"><i class="dot ${t === 'BM' ? 'bm' : ''}"></i>${t === 'PM' ? 'Preamar' : 'Baixamar'}</div>
  <div class="lagvalue ${ok ? '' : 'empty'}">${ok ? signed(s.mean) + ' <small>min</small>' : '—'}</div>
  <div class="direction">${ok ? (s.mean < 0 ? 'Antes da previsão' : s.mean > 0 ? 'Depois da previsão' : 'Sem diferença média') : 'Sem média disponível'}</div>
  <div class="stats">${s.n} pares${ok ? ` · IC 95% ±${fmt(s.ci, 1)} min<br>Mediana ${signed(s.median)} · DP ${fmt(s.sd, 1)} min<br>Faixa ${signed(s.min)} a ${signed(s.max)} min` : ' · mínimo de 3'}</div>
  ${s.n > 0 && s.n < 10 ? '<div class="sample">Poucos pares neste recorte</div>' : ''}</div>`;
}
function renderLunar() {
  const month = Number($('lunarMonth').value), width = $('window').value;
  $('phaseCards').innerHTML = ['S', 'Q'].map(c => `<article class="card phasecard"><div class="phase-title"><div><h3>${CYC[c]}</h3><p>${HM[month - 1]} · ${c === 'S' ? 'Lua nova e cheia' : 'Quartos crescente e minguante'}</p></div><div class="moonicon" aria-hidden="true"><span class="moon ${c === 'S' ? '' : 'quarter'}"></span><span class="moon ${c === 'S' ? 'full' : 'last'}"></span></div></div><div class="phase-values">${phaseValue(month, c, 'PM')}${phaseValue(month, c, 'BM')}</div></article>`).join('');
  $('phaseNote').textContent = `Janelas de ±${width} dia${width === '1' ? '' : 's'} em torno das fases. Eventos de transição ficam fora das médias. ` + ($('support').value === 'dense' ? 'Suporte: até 20 min e patamar até 40 min.' : 'Suporte: até 65 min.');
  const sp = t => getStats(month, 'S', t), qd = t => getStats(month, 'Q', t);
  const sent = (t, nm) => { const all = ['S', 'Q'].map(c => getStats(month, c, t)).filter(x => x.mean !== null); if (!all.length) return `<p><b>${nm}:</b> poucos dados neste recorte para calcular uma média.</p>`; const w = all.reduce((a, x) => a + x.n, 0), m = all.reduce((a, x) => a + x.mean * x.n, 0) / w, a = Math.abs(m); return `<p><b>${nm}:</b> em ${HM[month - 1].toLowerCase()}, ${a < 3 ? 'ocorre praticamente no mesmo horário previsto para Santana' : `ocorre em média ${fmt(a, 0)} min ${m < 0 ? 'antes' : 'depois'} do horário previsto para Santana`} (${w} observações${w < 10 ? ', poucas: interprete com cautela' : ''}).</p>`; };
  $('lunarPlain').innerHTML = '<p><b>Em resumo</b></p>' + sent('PM', 'Preamar (maré cheia)') + sent('BM', 'Baixamar (maré seca)');
  const lb = lagBadge(month);
  $('lunarBadge').hidden = !lb; $('lunarBadge').textContent = lb;
  const fmtDay = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
  $('calendar').innerHTML = D.phases.filter(p => monthOf(p.ts) === month).map(p => `<span>${p.phase} · ${fmtDay.format(p.ts)}</span>`).join('');
  $('summaryTable').innerHTML = HM.slice(0, LAST_MODEL).map((name, i) => `<tr class="${i + 1 === month ? 'selected' : ''}"><td><button class="monthbtn" data-month="${i + 1}">${name}</button></td>` + [['S', 'PM'], ['S', 'BM'], ['Q', 'PM'], ['Q', 'BM']].map(([c, t]) => { const s = getStats(i + 1, c, t); return `<td>${s.mean === null ? '—' : signed(s.mean) + ' <small>[' + signed(s.median) + ']</small>'} <small>n=${s.n}</small></td>`; }).join('') + '</tr>').join('');
  drawLagChart();
}
function drawLagChart() {
  if ($('lunar').hidden || $('lunarGraphView').hidden) return;
  const W = wide() ? 460 : 920, el = $('lagChart'); el.setAttribute('viewBox', `0 0 ${W} 300`);
  $('springChart').setAttribute('aria-pressed', activeChart === 'S'); $('neapChart').setAttribute('aria-pressed', activeChart === 'Q');
  const arr = ['PM', 'BM'].map(t => HM.slice(0, LAST_MODEL).map((_, i) => getStats(i + 1, activeChart, t)));
  const vals = arr.flat().filter(s => s.mean !== null).flatMap(s => [s.mean - s.ci, s.mean + s.ci]);
  const lo = Math.min(-10, ...vals) - 5, hi = Math.max(10, ...vals) + 5, x = i => 48 + i * (W - 78) / 9, y = v => 240 - (v - lo) / (hi - lo) * 200;
  const grid = css('--chart-grid'), txt = css('--chart-text'), month = Number($('lunarMonth').value);
  let s = `<rect x="${x(month - 1) - 25}" y="20" width="50" height="235" rx="12" fill="${css('--sage')}"/>`;
  for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) s += `<line x1="45" y1="${y(v)}" x2="${W - 22}" y2="${y(v)}" stroke="${v === 0 ? txt : grid}" ${v === 0 ? 'stroke-dasharray="5 4"' : ''}/><text x="34" y="${y(v) + 4}" text-anchor="end" fill="${txt}" font-size="11">${v}</text>`;
  [0, 1].forEach(j => {
    const color = j === 0 ? css('--pm') : css('--bm'), dx = j === 0 ? -4 : 4;
    for (let i = 1; i < 10; i++) { const a = arr[j][i - 1], b = arr[j][i]; if (a.mean !== null && b.mean !== null) s += `<line x1="${x(i - 1) + dx}" y1="${y(a.mean)}" x2="${x(i) + dx}" y2="${y(b.mean)}" stroke="${color}" stroke-width="2" opacity=".5"/>`; }
    arr[j].forEach((a, i) => {
      if (a.mean === null) return;
      s += `<line x1="${x(i) + dx}" x2="${x(i) + dx}" y1="${y(a.mean - a.ci)}" y2="${y(a.mean + a.ci)}" stroke="${color}" stroke-width="2" opacity=".6"/>`;
      s += `<circle class="plotpoint" data-month="${i + 1}" role="button" tabindex="0" aria-label="${HM[i]}, ${j === 0 ? 'preamar' : 'baixamar'}, ${signed(a.mean)} minutos, ${a.n} pares" cx="${x(i) + dx}" cy="${y(a.mean)}" r="${i + 1 === month ? 6 : 4.5}" fill="${a.n < 10 ? css('--card') : color}" stroke="${color}" stroke-width="2"><title>${HM[i]} · ${j === 0 ? 'PM' : 'BM'}: ${signed(a.mean)} min (IC ±${fmt(a.ci, 1)}) · n=${a.n}</title></circle>`;
    });
  });
  HM.slice(0, LAST_MODEL).forEach((m, i) => s += `<text x="${x(i)}" y="275" text-anchor="middle" fill="${txt}" font-size="12">${m.slice(0, 3)}</text>`);
  el.innerHTML = s; el.setAttribute('aria-label', `Diferença temporal média em ${CYC[activeChart]}. Negativo antes, positivo depois da previsão de Santana.`);
}
setupSubnav($('lunarNav'), drawLagChart);
$('lunarMonth').onchange = () => chooseMonth($('lunarMonth').value);
$('window').onchange = renderLunar; $('support').onchange = renderLunar;
$('springChart').onclick = () => { activeChart = 'S'; drawLagChart(); }; $('neapChart').onclick = () => { activeChart = 'Q'; drawLagChart(); };
const pick = e => { const b = e.target.closest('[data-month]'); if (b) chooseMonth(b.dataset.month); };
$('summaryTable').onclick = pick; $('lagChart').onclick = pick;
$('lagChart').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } };
$('exportCSV').onclick = () => {
  let csv = '﻿Mes;Ciclo;Tipo;N;Media_min;Mediana_min;DP_min;IC95_min;Min_min;Max_min;Janela_dias;Suporte;Sinal\r\n';
  HM.slice(0, LAST_MODEL).forEach((name, i) => ['S', 'Q'].forEach(c => ['PM', 'BM'].forEach(t => {
    const s = getStats(i + 1, c, t), f = k => s.mean === null ? '' : fmt(s[k], 3);
    csv += [name, CYC[c], t, s.n, f('mean'), f('median'), f('sd'), f('ci'), f('min'), f('max'), $('window').value, $('support').value, 'Observado menos tabua: negativo antes, positivo depois'].join(';') + '\r\n';
  })));
  download(csv, 'text/csv;charset=utf-8', 'TideConversor_Horarios_2026.csv');
};

/* ================= HISTÓRICO ================= */
const hval = q => $('historyDatum').value === 'nr' ? q.mean_H : q.mean_R;
const refLabel = () => $('historyDatum').value === 'nr' ? 'acima do NR' : 'acima do zero da régua';
let histScale = 'monthly';
const YC = { 2024: '--c2024', 2025: '--c2025', 2026: '--c2026' };
const mrow = (y, m) => D.monthly.find(q => q.year === y && q.month === m);
function renderHistory() {
  $('droughtCards').innerHTML = D.comparison.map(q => `<article class="card comparison-card"><h3>${HM[q.month - 1]} · 2024 × 2025${q.partial2024 ? ' *' : ''}</h3><div class="number">${fmt(Math.abs(q.delta_cm), 1)} <small>cm abaixo</small></div><div class="hint">Média acima do NR: ${fmt(q.mean_2024, 3)} m em 2024; ${fmt(q.mean_2025, 3)} m em 2025.<br>${q.days2024} e ${q.days2025} dias válidos.</div></article>`).join('');
  const yoy = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(m => [mrow(2025, m), mrow(2026, m)]).filter(([a, b]) => a && b && !a.partial && !b.partial && a.mean_H !== null && b.mean_H !== null);
  $('yoyCards').innerHTML = yoy.map(([a, b]) => { const d = (b.mean_H - a.mean_H) * 100; return `<article class="card comparison-card"><h3>${HM[b.month - 1]} · 2026 × 2025</h3><div class="number">${fmt(Math.abs(d), 1)} <small>cm ${d < 0 ? 'abaixo' : 'acima'}</small></div><div class="hint">Média acima do NR: ${fmt(b.mean_H, 3)} m em 2026; ${fmt(a.mean_H, 3)} m em 2025.<br>${b.valid_days} e ${a.valid_days} dias válidos.</div></article>`; }).join('') || '<p class="note">Sem meses completos comparáveis.</p>';
  $('historyCaption').textContent = `Médias mensais ${refLabel()} (m). Dias válidos entre parênteses; * mês parcial.`;
  $('historyTable').innerHTML = HM.map((m, i) => `<tr><td>${m}</td>` + [2024, 2025, 2026].map(y => { const q = mrow(y, i + 1); return `<td>${!q || q.mean_H === null ? '—' : fmt(hval(q), 3) + (q.partial ? '*' : '') + ` <small>(${q.valid_days}/${q.calendar_days})</small>`}</td>`; }).join('') + '</tr>').join('');
  drawHistory();
}
function selectedYears() { return [...document.querySelectorAll('[data-year]:checked')].map(e => +e.dataset.year); }
function drawHistory() {
  if ($('history').hidden || $('historyGraphView').hidden) return;
  const W = wide() ? 480 : 920, el = $('historyChart'), years = selectedYears(), daily = histScale === 'daily';
  el.setAttribute('viewBox', `0 0 ${W} 320`);
  $('histMonthly').setAttribute('aria-pressed', !daily); $('histDaily').setAttribute('aria-pressed', daily);
  $('historyTitle').textContent = daily ? 'Médias diárias sobrepostas por ano' : 'Médias mensais';
  const dayIdx = s => { const d = new Date(s + 'T00:00:00Z'); return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5); };
  const off = $('historyDatum').value === 'nr' ? 0 : NRM;
  const pts = daily ? D.daily.filter(d => years.includes(+d[0].slice(0, 4))) : D.monthly.filter(q => years.includes(q.year) && q.mean_H !== null);
  const vs = pts.map(p => daily ? p[1] + off : hval(p));
  const lo = Math.floor((Math.min(0, ...vs) - .05) * 5) / 5, hi = Math.ceil((Math.max(1, ...vs) + .1) * 5) / 5;
  const x = daily ? d => 48 + d / 365 * (W - 78) : m => 48 + (m - 1) * (W - 78) / 11, y = v => 250 - (v - lo) / (hi - lo) * 205;
  const grid = css('--chart-grid'), txt = css('--chart-text');
  let s = '';
  for (let k = Math.ceil(lo * 5); k <= Math.floor(hi * 5); k++) { const v = k / 5; s += `<line x1="45" x2="${W - 22}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}"/><text x="35" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${txt}">${fmt(v, 1)}</text>`; }
  s += `<text x="45" y="20" fill="${txt}" font-size="11">Nível médio ${refLabel()} (m)</text>`;
  const mdays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  HM.forEach((m, i) => s += `<text x="${daily ? x(mdays[i] + 15) : x(i + 1)}" y="284" text-anchor="middle" font-size="12" fill="${txt}">${m.slice(0, 3)}</text>`);
  for (const year of years) {
    const color = css(YC[year]);
    if (daily) {
      const a = D.daily.filter(d => +d[0].slice(0, 4) === year); let path = '', prev = null;
      a.forEach(d => { const i = dayIdx(d[0]); path += (prev !== null && i - prev <= 2 ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(d[1] + off).toFixed(1) + ' '; prev = i; });
      s += `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    } else {
      const a = D.monthly.filter(q => q.year === year && q.mean_H !== null).sort((p, q) => p.month - q.month);
      a.forEach((q, i) => {
        const p = a[i - 1];
        if (p && q.month - p.month === 1) s += `<line x1="${x(p.month)}" y1="${y(hval(p))}" x2="${x(q.month)}" y2="${y(hval(q))}" stroke="${color}" stroke-width="2"/>`;
        s += `<circle class="history-point" tabindex="0" role="button" data-y="${year}" data-m="${q.month}" cx="${x(q.month)}" cy="${y(hval(q))}" r="5" stroke="${color}" stroke-width="2" fill="${q.partial ? css('--card') : color}" aria-label="${HM[q.month - 1]} de ${year}, ${fmt(hval(q), 3)} metros, ${q.valid_days} dias válidos"><title>${HM[q.month - 1]} ${year}: ${fmt(hval(q), 3)} m · ${q.valid_days}/${q.calendar_days} dias</title></circle>`;
      });
    }
  }
  el.innerHTML = s;
  if (!$('historyReadout').dataset.set) $('historyReadout').textContent = (daily ? 'Toque no gráfico para comparar o mesmo dia do ano.' : 'Selecione um ponto no gráfico.') + ' Referência: ' + refLabel() + '.';
}
function inspectHistory(e) {
  const out = $('historyReadout'); out.dataset.set = '1';
  if (histScale === 'daily') {
    const el = $('historyChart'), box = el.getBoundingClientRect(), W = +el.getAttribute('viewBox').split(' ')[2], sx = (e.clientX - box.left) / box.width * W, di = Math.round((sx - 48) / (W - 78) * 365);
    if (di < 0 || di > 365) return;
    const off = $('historyDatum').value === 'nr' ? 0 : NRM, parts = [];
    selectedYears().forEach(y => { const t0 = Date.UTC(y, 0, 1) + di * 864e5, iso = new Date(t0).toISOString().slice(0, 10), r = D.daily.find(d => d[0] === iso); parts.push(`${y}: ${r ? fmt(r[1] + off, 3) + ' m' : 'sem dado'}`); });
    const dd = new Date(Date.UTC(2025, 0, 1) + di * 864e5); out.textContent = `${String(dd.getUTCDate()).padStart(2, '0')}/${String(dd.getUTCMonth() + 1).padStart(2, '0')} · ${parts.join(' · ')} (${refLabel()})`; return;
  }
  const p = e.target.closest('[data-y]'); if (!p) return;
  const q = mrow(+p.dataset.y, +p.dataset.m);
  out.textContent = `${HM[q.month - 1]} de ${q.year}: ${fmt(hval(q), 3)} m ${refLabel()}. ${q.valid_days} de ${q.calendar_days} dias válidos. ${q.partial ? 'Mês parcial.' : 'Mês completo.'}`;
}
setupSubnav($('historyNav'), v => { $('historyRef').hidden = v === 'historySummary'; drawHistory(); });
$('historyDatum').onchange = () => { $('historyReadout').dataset.set = ''; renderHistory(); };
document.querySelectorAll('[data-year]').forEach(e => e.onchange = drawHistory);
$('histMonthly').onclick = () => { histScale = 'monthly'; $('historyReadout').dataset.set = ''; drawHistory(); };
$('histDaily').onclick = () => { histScale = 'daily'; $('historyReadout').dataset.set = ''; drawHistory(); };
$('historyChart').onclick = inspectHistory;
$('historyChart').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspectHistory(e); } };
$('exportHistory').onclick = () => {
  let csv = '﻿Ano;Mes;Media_zero_m;Media_NR_m;Dias_validos;Dias_mes;Parcial\r\n';
  D.monthly.forEach(q => csv += [q.year, q.month, q.mean_R === null ? '' : fmt(q.mean_R, 6), q.mean_H === null ? '' : fmt(q.mean_H, 6), q.valid_days, q.calendar_days, q.partial ? 'Sim' : 'Nao'].join(';') + '\r\n');
  download(csv, 'text/csv;charset=utf-8', 'TideConversor_Historico_2024_2026.csv');
};

/* ================= PREVISÃO ================= */
// média de defasagem por mês e tipo (eventos de resolução preferencial, todos os ciclos)
const LAGMEAN = (() => {
  const g = (m, t) => { const z = D.events.filter(e => e.m === m && e.t === t && e.d).map(e => e.lag); return { n: z.length, mean: z.length ? z.reduce((a, b) => a + b, 0) / z.length : 0 }; };
  const out = {};
  for (const t of ['PM', 'BM']) {
    const pool = D.events.filter(e => e.m <= 7 && e.t === t && e.d).map(e => e.lag), pm = pool.reduce((a, b) => a + b, 0) / pool.length;
    for (let m = 1; m <= 12; m++) { const r = m <= LAST_MODEL ? g(m, t) : { n: 0 }; out[m + t] = r.n >= 10 ? r.mean : pm; }
  }
  return out;
})();
const PRED = D.predictions.map(([ts, h, type]) => ({ ts, h, type }));
const PRED_LAG = PRED.map(p => ({ ...p, ts: p.ts + LAGMEAN[monthOf(p.ts) + p.type] * 60000 }));
const predsFor = (loc, lagOn) => loc === 'faz' && lagOn ? PRED_LAG : PRED;
function interpT(ts, a) {
  if (!Number.isFinite(ts) || ts < a[0].ts || ts > a[a.length - 1].ts) return null;
  let lo = 0, hi = a.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].ts < ts) lo = mid + 1; else hi = mid; }
  if (a[lo].ts === ts) return a[lo].h;
  const l = a[lo - 1], r = a[lo], u = (ts - l.ts) / (r.ts - l.ts); return l.h + (r.h - l.h) * (1 - Math.cos(Math.PI * u)) / 2;
}
const inRange = (iso, method) => method === 'tabua' ? iso >= '2026-01-01' && iso <= '2026-12-31' : iso >= '2024-01-01' && iso <= '2030-12-31';
function waterForecast(ts, loc, depth, lagOn, method = CUR.method) {
  let t = null, h;
  if (loc === 'faz' && method !== 'tabua') h = (TCH.predictCm(ts, method === 'harmA') - TCH.NR) / 100;
  else {
    t = interpT(ts, predsFor(loc, lagOn)); if (t === null) return null; h = t;
    if (loc === 'faz') { const p = calFor(dateISO(ts)); h = (t - p.a) / p.b - NRM; }
  }
  return { t, h, column: depth === null ? null : Math.max(0, depth + h), dry: depth !== null && depth + h < 0 };
}
function extremesFor(q) {
  if (q.location === 'faz' && q.method !== 'tabua') return TCH.extremes(q.day - 12 * 36e5, q.day + 60 * 36e5, q.method === 'harmA').map(e => ({ ts: e.ts, h: (e.cm - TCH.NR) / 100, type: e.type }));
  return predsFor(q.location, q.lagOn);
}
function forecastInputs() {
  CUR.method = $('forecastLocation').value === 'faz' ? $('forecastMethod').value : 'tabua';
  const date = $('forecastDate').value, time = $('forecastTime').value, ds = $('forecastDepth').value.trim(), depth = ds === '' ? null : parse(ds);
  return { date, time, depth, method: CUR.method, location: $('forecastLocation').value, lagOn: $('lagToggle').checked, ts: Date.parse(date + 'T' + time + ':00-03:00'), day: Date.parse(date + 'T00:00:00-03:00'), validDepth: depth === null || (Number.isFinite(depth) && depth >= 0) };
}
const fcName = loc => loc === 'faz' ? 'Fazendinha' : 'Porto de Santana';
function renderForecast() {
  if ($('forecast').hidden) return;
  const q = forecastInputs(), w = $('forecastWarning'); w.hidden = true;
  $('lagToggle').disabled = q.location !== 'faz' || q.method !== 'tabua'; $('forecastMethod').disabled = q.location !== 'faz'; $('fcNote').textContent = '';
  ['fcLevel', 'fcNextPM', 'fcNextBM'].forEach(i => $(i).textContent = '—'); ['fcTrend', 'fcNextPMs', 'fcNextBMs'].forEach(i => $(i).textContent = '');
  $('fcColumn').hidden = true; $('tideList').innerHTML = ''; $('forecastChart').innerHTML = '';
  let why = '';
  if (!q.date || !q.time || !Number.isFinite(q.ts)) why = 'Selecione uma data e um horário válidos.';
  else if (!inRange(q.date, q.method)) why = q.method === 'tabua' ? 'A tábua disponível cobre somente 2026.' : 'A previsão harmônica está disponível de 2024 a 2030.';
  else if (!q.validDepth) why = 'A profundidade deve ser um número maior ou igual a zero, em metros.';
  if (why) { $('fcSentence').textContent = why; return; }
  const place = fcName(q.location), harm = q.location === 'faz' && q.method !== 'tabua', arr = extremesFor(q);
  if (q.location === 'faz' && !harm) { const cb = calBadge(calFor(q.date)); if (cb) { w.textContent = cb; w.hidden = false; } }
  if (harm) $('fcNote').textContent = q.method === 'harmA' ? 'Previsão harmônica de Fazendinha com as componentes anuais Sa e Ssa. Erro típico de ±12 cm em dados de teste; fora do regime de 2025–2026 o nível médio pode mudar até ±30 cm (seca ou cheia incomuns).' : 'Previsão harmônica de Fazendinha só com as marés (sem Sa e Ssa). Erro típico de ±17 cm em dados de teste; o nível médio do rio não é previsto.';
  const f = waterForecast(q.ts, q.location, q.depth, q.lagOn), f2 = waterForecast(q.ts + 600000, q.location, q.depth, q.lagOn);
  const ref = q.location === 'faz' ? 'acima do NR' : 'na tábua';
  if (f) {
    const trend = f2 ? (f2.h > f.h + 0.003 ? 'subindo' : f2.h < f.h - 0.003 ? 'baixando' : 'estável') : '';
    $('fcLevel').innerHTML = fmt(f.h) + ' <small>m</small>'; $('fcTrend').textContent = (trend ? trend.charAt(0).toUpperCase() + trend.slice(1) + ' · ' : '') + ref;
    $('fcSentence').textContent = `Em ${place}, em ${fmtBR(q.date)} às ${q.time}, o nível previsto é de ${fmt(f.h)} m ${ref}${trend ? ' e a maré está ' + trend : ''}.`;
    if (q.depth !== null) { $('fcColumn').hidden = false; $('fcColumn').textContent = f.dry ? 'Com a profundidade informada, o fundo fica acima do nível estimado (ponto emerso).' : `Coluna d’água: ${fmt(q.depth)} m (profundidade) + ${fmt(f.h)} m (nível) = ${fmt(f.column)} m.`; }
  } else { $('fcSentence').textContent = 'Este horário está fora do período coberto pela tábua.'; }
  const nextOf = type => arr.find(p => p.type === type && p.ts > q.ts);
  [['PM', 'fcNextPM', 'fcNextPMs'], ['BM', 'fcNextBM', 'fcNextBMs']].forEach(([type, vid, sid]) => {
    const n = nextOf(type); if (!n) return;
    const g = waterForecast(n.ts, q.location, q.depth, q.lagOn), mins = Math.round((n.ts - q.ts) / 60000), other = dateISO(n.ts) !== q.date;
    $(vid).textContent = clock(n.ts) + (other ? ' (dia seguinte)' : ''); $(sid).textContent = `em ${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min` + (g ? ' · ' + fmt(g.h) + ' m' : '');
  });
  const daily = arr.filter(p => p.ts >= q.day && p.ts < q.day + 86400000), nx = arr.find(p => p.ts > q.ts);
  $('tideList').innerHTML = daily.length ? daily.map(p => { const g = waterForecast(p.ts, q.location, q.depth, q.lagOn); return `<div class="tide ${nx && p.ts === nx.ts ? 'next' : ''} ${p.ts < q.ts ? 'past' : ''}"><b>${p.type === 'PM' ? '▲ Preamar' : '▼ Baixamar'}${nx && p.ts === nx.ts ? ' · próxima' : ''}</b><span class="t">${clock(p.ts)}</span><span class="h">${g ? fmt(g.h) + ' m ' + ref : ''}</span></div>`; }).join('') : '<p class="note">Sem marés registradas na tábua para este dia.</p>';
  drawForecast(q, daily);
}
function drawForecast(q, daily) {
  const W = wide() ? 460 : 920, el = $('forecastChart'); el.setAttribute('viewBox', `0 0 ${W} 250`);
  const pts = []; for (let min = 0; min <= 1440; min += 5) { const ts = q.day + min * 60000, f = waterForecast(ts, q.location, q.depth, q.lagOn); pts.push({ min, v: f ? (q.depth === null ? f.h : f.column) : null }); }
  const valid = pts.filter(p => p.v !== null); if (!valid.length) return;
  const vs = valid.map(p => p.v), lo = Math.floor((Math.min(...vs) - .2) * 2) / 2, hi = Math.ceil((Math.max(...vs) + .25) * 2) / 2, x = m => 48 + m / 1440 * (W - 68), y = v => 205 - (v - lo) / (hi - lo) * 170;
  const grid = css('--chart-grid'), txt = css('--chart-text'), line = css('--pm'), bm = css('--bm'), oc = css('--ochre');
  let s = `<text x="48" y="16" fill="${txt}" font-size="12">${q.depth === null ? 'Nível acima do NR (m)' : 'Coluna d’água (m)'}</text>`;
  const step = hi - lo > 5 ? 1 : .5; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-8; v += step) s += `<line x1="43" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}"/><text x="35" y="${y(v) + 4}" text-anchor="end" fill="${txt}" font-size="11">${fmt(v, 1)}</text>`;
  let path = ''; pts.forEach((p, i) => { if (p.v === null) return; path += (i > 0 && pts[i - 1].v !== null ? 'L' : 'M') + x(p.min).toFixed(1) + ',' + y(p.v).toFixed(1) + ' '; });
  s += `<path d="${path}" fill="none" stroke="${line}" stroke-width="2.5"/>`;
  daily.forEach(p => { const f = waterForecast(p.ts, q.location, q.depth, q.lagOn), v = f ? (q.depth === null ? f.h : f.column) : null; if (v === null) return; const cx = x((p.ts - q.day) / 60000); s += `<circle cx="${cx}" cy="${y(v)}" r="4" fill="${bm}"><title>${p.type} · ${clock(p.ts)} · ${fmt(v)} m</title></circle><text x="${cx}" y="${p.type === 'PM' ? y(v) - 9 : y(v) + 17}" text-anchor="middle" font-size="11" fill="${txt}">${clock(p.ts)}</text>`; });
  for (let h = 0; h <= 24; h += 3) s += `<text x="${x(h * 60)}" y="238" text-anchor="middle" fill="${txt}" font-size="12">${String(h).padStart(2, '0')}h</text>`;
  if (q.date === NOW.date) { const nm = (Date.now() - q.day) / 60000; if (nm >= 0 && nm <= 1440) s += `<line x1="${x(nm)}" x2="${x(nm)}" y1="30" y2="210" stroke="${txt}" stroke-width="1" stroke-dasharray="2 3"/><text x="${x(nm)}" y="26" text-anchor="middle" font-size="10" fill="${txt}">agora</text>`; }
  const sel = waterForecast(q.ts, q.location, q.depth, q.lagOn);
  if (sel) { const v = q.depth === null ? sel.h : sel.column, cx = x((q.ts - q.day) / 60000); s += `<line x1="${cx}" x2="${cx}" y1="30" y2="210" stroke="${oc}" stroke-dasharray="4 4"/><circle cx="${cx}" cy="${y(v)}" r="5.5" fill="${oc}"/>`; }
  el.innerHTML = s;
}
function shiftDay(n) {
  const d = new Date($('forecastDate').value + 'T12:00:00Z'); if (isNaN(d)) return;
  d.setUTCDate(d.getUTCDate() + n); const iso = d.toISOString().slice(0, 10); if (!inRange(iso, forecastInputs().method)) return toast('Data fora do período disponível'); $('forecastDate').value = iso; renderForecast();
}
function setNow() {
  const n = nowParts();
  if (inRange(n.date, forecastInputs().method)) { $('forecastDate').value = n.date; $('forecastTime').value = n.time; } else { $('forecastDate').value = '2026-01-01'; $('forecastTime').value = '12:00'; toast('A data atual está fora do período disponível'); }
  renderForecast();
}
function syncDateRange() { const m = forecastInputs().method, lo = m === 'tabua' ? '2026-01-01' : '2024-01-01', hi = m === 'tabua' ? '2026-12-31' : '2030-12-31'; $('forecastDate').min = lo; $('forecastDate').max = hi; if ($('forecastDate').value < lo) $('forecastDate').value = lo; if ($('forecastDate').value > hi) $('forecastDate').value = hi; }
['forecastLocation', 'forecastDate', 'forecastTime', 'lagToggle', 'forecastMethod'].forEach(id => $(id).addEventListener('change', () => { if (id === 'forecastLocation') $('forecastDepth').value = ''; if (id === 'forecastLocation' || id === 'forecastMethod') syncDateRange(); renderForecast(); }));
$('forecastDepth').addEventListener('input', renderForecast);
$('dayPrev').onclick = () => shiftDay(-1); $('dayNext').onclick = () => shiftDay(1); $('nowBtn').onclick = setNow;
$('forecastChart').onclick = e => {
  const box = $('forecastChart').getBoundingClientRect(), W = +$('forecastChart').getAttribute('viewBox').split(' ')[2], sx = (e.clientX - box.left) / box.width * W;
  if (sx < 48 || sx > W - 20) return;
  const m = Math.max(0, Math.min(1435, Math.round((sx - 48) / (W - 68) * 1440 / 5) * 5));
  $('forecastTime').value = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); renderForecast();
};
$('exportForecast').onclick = () => {
  const q = forecastInputs(); if (!q.validDepth || !Number.isFinite(q.day) || !inRange(q.date, q.method)) return toast('Revise data e profundidade');
  let csv = '﻿Local;Data_hora_UTC-03;Nivel_NR_m;Profundidade_NR_m;Coluna_m;Metodo\r\n';
  const met = q.location === 'faz' && q.method !== 'tabua' ? 'Previsao harmonica de Fazendinha (B02' + (q.method === 'harmA' ? ' + Sa/Ssa' : ' so mares') + '); NR ' + fmt(NRM, 3) + ' m' : 'Interpolacao cossenoidal da tabua' + (q.location === 'faz' ? (q.lagOn ? '; defasagem media aplicada (experimental)' : '; sem correcao de fase local') : '');
  for (let min = 0; min < 1440; min += 15) { const ts = q.day + min * 60000, f = waterForecast(ts, q.location, q.depth, q.lagOn); csv += [q.location, q.date + ' ' + clock(ts), f ? fmt(f.h, 5) : '', q.depth === null ? '' : fmt(q.depth, 5), f && f.column !== null ? fmt(f.column, 5) : '', met].join(';') + '\r\n'; }
  download(csv, 'text/csv;charset=utf-8', 'TideConversor_Previsao_' + q.date + '.csv');
};

function fillQuadro() {
  const q = TCH.quadro, nr = TCH.NR, row = (l, v) => `<tr><td>${l}</td><td>${fmt(v / 100)}</td><td>${fmt((v + nr) / 100)}</td></tr>`;
  $('quadroBody').innerHTML = row('Preamar média de sizígia (MHWS)', q.MHWS) + row('Preamar média de quadratura (MHWN)', q.MHWN) + row('Nível médio (Zo)', q.Zo) + row('Baixamar média de quadratura (MLWN)', q.MLWN) + row('Baixamar média de sizígia (MLWS)', q.MLWS);
  const hh = Math.floor(q.HWFC_h), mm = Math.round((q.HWFC_h - hh) * 60);
  $('quadroNote').textContent = `Maré semidiurna pura (F de Courtier = ${fmt(q.F, 3)}). Estabelecimento do porto (HWF&C): ${hh} h ${String(mm).padStart(2, '0')} min. NR = S0 − (M2 + S2 + N2 + K2) = ${fmt(q.S0 / 100)} − ${fmt(q.Zo / 100)} = ${fmt(q.NR / 100)} m acima do zero da régua (método do Alte Franco, 1997). S0 anual = nível médio ajustado com as componentes anuais.`;
}
window.TCApp = { waterForecast, fmt, css, download, toast, NRM, wide, signed };
/* ================= início ================= */
const defMonth = NOW.year === 2026 ? NOW.month : 1;
const richMonth = [7, 6, 5, 4, 3, 2, 1].find(m => D.events.filter(e => e.m === m && e.t === 'PM' && e.d && e.dist <= 2).length >= 15) || 1;
monthOptions($('lunarMonth'), richMonth);
$('calDate').value = NOW.year === 2026 ? NOW.date : '2026-01-01';
fillModelTable(); fillQuadro(); renderConverter(); renderLunar(); renderHistory();
$('historyReadout').textContent = 'Selecione um ponto no gráfico. Referência: ' + refLabel() + '.';
$('forecastDate').value = NOW.year === 2026 ? NOW.date : '2026-01-01'; $('forecastTime').value = NOW.year === 2026 ? NOW.time : '12:00';
showPanel((location.hash || '').slice(1), false);
window.addEventListener('resize', () => { drawLagChart(); drawHistory(); renderForecast(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderConverter(); drawLagChart(); drawHistory(); renderForecast(); });
window.addEventListener('hashchange', () => showPanel(location.hash.slice(1), false));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
let deferred; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('installOffline').hidden = false; });
$('installOffline').onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; $('installOffline').hidden = true; } };
})();
