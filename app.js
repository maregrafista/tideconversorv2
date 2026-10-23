'use strict';
(() => {
const D = window.TC_DATA, MODELS = D.models, TCH = window.TCH, NRM = TCH.NR / 100;
const $ = id => document.getElementById(id);
const HM = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LAST_MODEL = 10, TZ = 'America/Fortaleza';
const fmt = (v, n = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n });
const signed = (v, n = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), n);
const parse = s => /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : NaN;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const wide = () => window.innerWidth <= 600, fs = () => (wide() ? 15 : 12);   // fontes dos gráficos SVG maiores no celular, onde a figura é reduzida

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
const PANELS = ['converter', 'lunar', 'forecast', 'compare', 'carta'];
function showPanel(name, push = true) {
  if (!PANELS.includes(name)) name = 'converter';
  PANELS.forEach(p => { $(p).hidden = p !== name; $('tab-' + p).setAttribute('aria-selected', p === name); $('tab-' + p).tabIndex = p === name ? 0 : -1; });
  if (push) try { history.replaceState(null, '', '#' + name); } catch {}
  if (name === 'compare' && window.TCCompare) TCCompare.show(); if (name === 'lunar') drawLagChart(); if (name === 'forecast' && window.TCForecast) TCForecast.show();
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
  const W = wide() ? 400 : 920, el = $('lagChart'); el.setAttribute('viewBox', `0 0 ${W} 300`);
  $('springChart').setAttribute('aria-pressed', activeChart === 'S'); $('neapChart').setAttribute('aria-pressed', activeChart === 'Q');
  const arr = ['PM', 'BM'].map(t => HM.slice(0, LAST_MODEL).map((_, i) => getStats(i + 1, activeChart, t)));
  const vals = arr.flat().filter(s => s.mean !== null).flatMap(s => [s.mean - s.ci, s.mean + s.ci]);
  const lo = Math.min(-10, ...vals) - 5, hi = Math.max(10, ...vals) + 5, x = i => 48 + i * (W - 78) / 9, y = v => 240 - (v - lo) / (hi - lo) * 200;
  const grid = css('--chart-grid'), txt = css('--chart-text'), month = Number($('lunarMonth').value);
  let s = `<rect x="${x(month - 1) - 25}" y="20" width="50" height="235" rx="12" fill="${css('--sage')}"/>`;
  for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) s += `<line x1="45" y1="${y(v)}" x2="${W - 22}" y2="${y(v)}" stroke="${v === 0 ? txt : grid}" ${v === 0 ? 'stroke-dasharray="5 4"' : ''}/><text x="34" y="${y(v) + 4}" text-anchor="end" fill="${txt}" font-size="${fs() - 1}">${v}</text>`;
  [0, 1].forEach(j => {
    const color = j === 0 ? css('--pm') : css('--bm'), dx = j === 0 ? -4 : 4;
    for (let i = 1; i < 10; i++) { const a = arr[j][i - 1], b = arr[j][i]; if (a.mean !== null && b.mean !== null) s += `<line x1="${x(i - 1) + dx}" y1="${y(a.mean)}" x2="${x(i) + dx}" y2="${y(b.mean)}" stroke="${color}" stroke-width="2" opacity=".5"/>`; }
    arr[j].forEach((a, i) => {
      if (a.mean === null) return;
      s += `<line x1="${x(i) + dx}" x2="${x(i) + dx}" y1="${y(a.mean - a.ci)}" y2="${y(a.mean + a.ci)}" stroke="${color}" stroke-width="2" opacity=".6"/>`;
      s += `<circle class="plotpoint" data-month="${i + 1}" role="button" tabindex="0" aria-label="${HM[i]}, ${j === 0 ? 'preamar' : 'baixamar'}, ${signed(a.mean)} minutos, ${a.n} pares" cx="${x(i) + dx}" cy="${y(a.mean)}" r="${i + 1 === month ? 6 : 4.5}" fill="${a.n < 10 ? css('--card') : color}" stroke="${color}" stroke-width="2"><title>${HM[i]} · ${j === 0 ? 'PM' : 'BM'}: ${signed(a.mean)} min (IC ±${fmt(a.ci, 1)}) · n=${a.n}</title></circle>`;
    });
  });
  HM.slice(0, LAST_MODEL).forEach((m, i) => s += `<text x="${x(i)}" y="275" text-anchor="middle" fill="${txt}" font-size="${fs()}">${m.slice(0, 3)}</text>`);
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

/* ================= PREVISÃO: dados para a aba (interface em forecast.js) ================= */
const PRED = D.predictions.map(([ts, h, type]) => ({ ts, h, type }));
function interpT(ts, arr) {
  if (!Number.isFinite(ts) || ts < arr[0].ts || ts > arr[arr.length - 1].ts) return null;
  let lo = 0, hi = arr.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].ts < ts) lo = mid + 1; else hi = mid; }
  if (arr[lo].ts === ts) return arr[lo].h;
  const l = arr[lo - 1], r = arr[lo], u = (ts - l.ts) / (r.ts - l.ts); return l.h + (r.h - l.h) * (1 - Math.cos(Math.PI * u)) / 2;
}
window.TCHost = {
  value: (ts, loc) => loc === 'san' ? interpT(ts, PRED) : (TCH.predictCm(ts, true) - TCH.NR) / 100,
  extremes: (day, loc) => loc === 'san' ? PRED : TCH.extremes(day - 12 * 36e5, day + 60 * 36e5, true).map(e => ({ ts: e.ts, h: (e.cm - TCH.NR) / 100, type: e.type }))
};
window.TCApp = { fmt, css, download, toast, NRM, wide, signed };
/* ================= início ================= */
const defMonth = NOW.year === 2026 ? NOW.month : 1;
const richMonth = [7, 6, 5, 4, 3, 2, 1].find(m => D.events.filter(e => e.m === m && e.t === 'PM' && e.d && e.dist <= 2).length >= 15) || 1;
monthOptions($('lunarMonth'), richMonth);
$('calDate').value = NOW.year === 2026 ? NOW.date : '2026-01-01';
fillModelTable(); renderConverter(); renderLunar();
showPanel((location.hash || '').slice(1), false);
window.addEventListener('resize', () => { drawLagChart(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderConverter(); drawLagChart(); if (window.TCForecast) TCForecast.show(); });
window.addEventListener('hashchange', () => showPanel(location.hash.slice(1), false));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
let deferred; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('installOffline').hidden = false; });
$('installOffline').onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; $('installOffline').hidden = true; } };
})();
