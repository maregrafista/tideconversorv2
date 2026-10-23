'use strict';
/* Quadro de maré no estilo das cartas náuticas (alturas acima do NR). Usa as constantes e o quadro de TCH. */
(function () {
  const T = window.TCH, $ = id => document.getElementById(id);
  if (!T || !$('carta')) return;
  const f = (v, d = 2) => v.toFixed(d).replace('.', ','), m = cm => f(cm / 100), NR = T.NR, q = T.quadro;
  const SP = [15, .5490165, .0410686, .0046418, .0000019], mod = a => ((a % 360) + 360) % 360;
  const niveis = [['Preamar média de sizígia', 'PMS', q.MHWS], ['Preamar média de quadratura', 'PMQ', q.MHWN], ['Nível médio', 'NM', q.Zo],
    ['Baixamar média de quadratura', 'BMQ', q.MLWN], ['Baixamar média de sizígia', 'BMS', q.MLWS]];
  $('cartaNiveis').innerHTML = niveis.map(([n, s, v]) => `<tr><td>${n}</td><td>${s}</td><td>${m(v)}</td><td>${m(v + NR)}</td></tr>`).join('') +
    `<tr class="ref"><td>Nível de redução</td><td>NR</td><td>0,00</td><td>${f(NR / 100, 3)}</td></tr>`;
  const hw = q.HWFC_h, hh = Math.floor(hw), mm = Math.round((hw - hh) * 60);
  const gerais = [['Tipo de maré', `Semidiurna (F = ${f(q.F, 2)})`], ['Estabelecimento do porto (HWF&C)', `${hh} h ${String(mm).padStart(2, '0')} min`],
    ['Amplitude média de sizígia', `${m(q.MHWS - q.MLWS)} m`], ['Amplitude média de quadratura', `${m(q.MHWN - q.MLWN)} m`],
    ['Nível médio acima do zero da régua', `${m(q.S0)} m`], ['NR acima do zero da régua', `${f(NR / 100, 3)} m (RLS − ${f(NR / 100, 3)} m)`]];
  $('cartaGerais').innerHTML = gerais.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  const por = Object.fromEntries(T.comps.map(c => [c.n, c])), ordem = ['M2', 'S2', 'N2', 'K2', 'K1', 'O1', 'P1', 'Q1', 'M4', 'MS4', 'MN4', 'Sa', 'Ssa'];
  $('cartaConst').innerHTML = ordem.filter(n => por[n]).map(n => {
    const c = por[n], v = c.c.reduce((s, x, i) => s + x * SP[i], 0);
    return `<tr><td>${n}</td><td>${f(v, 4)}</td><td>${f(c.H / 100, 3)}</td><td>${f(mod(c.g - 3 * v), 1)}</td><td>${f(mod(c.g), 1)}</td></tr>`;
  }).join('');
  const b = T.blocks[2];
  $('cartaFonte').textContent = `Fonte: análise harmônica do PACMARÉ (113 componentes) de 313 dias de registro da régua de Fazendinha, de ${b[0].slice(8, 10)}/${b[0].slice(5, 7)}/${b[0].slice(0, 4)} a ${b[1].slice(8, 10)}/${b[1].slice(5, 7)}/${b[1].slice(0, 4)}. Sa e Ssa são as componentes anuais (efeito do rio); H em metros, G em graus. NR = S0 − (M2 + S2 + N2 + K2), método do Alte Franco (1997).`;
  // esquema dos níveis
  const lv = [['PMS', q.MHWS], ['PMQ', q.MHWN], ['NM', q.Zo], ['BMQ', q.MLWN], ['BMS', q.MLWS], ['NR', 0], ['Zero da régua', -NR]];
  const top = 20, bot = 380, hi = Math.max(q.MHWS) / 100 + .2, lo = -NR / 100 - .2, Y = v => top + (hi - v / 100) / (hi - lo) * (bot - top);
  let s = `<rect x="150" y="${Y(q.MHWS)}" width="90" height="${Y(-NR) - Y(q.MHWS)}" fill="var(--sage,#e6ece1)" stroke="var(--line,#ccc)"/>`;
  s += `<rect x="150" y="${Y(q.MLWS)}" width="90" height="${Y(0) - Y(q.MLWS)}" fill="none"/>`;
  s += `<text x="195" y="${(Y(q.MHWS) + Y(q.MLWS)) / 2 + 4}" text-anchor="middle" font-size="12" fill="var(--muted,#667)">faixa da maré</text>`;
  for (const [n, v] of lv) {
    const y = Y(v), ref = n === 'NR' || n === 'Zero da régua', col = ref ? '#a56c34' : 'var(--forest,#173f35)';
    s += `<line x1="${ref ? 90 : 150}" x2="${ref ? 300 : 240}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="${ref ? 1.6 : 1.4}" ${n === 'Zero da régua' ? 'stroke-dasharray="5 3"' : ''}/>` +
      `<text x="${ref ? 84 : 144}" y="${y + 4}" text-anchor="end" font-size="13" font-weight="600" fill="${col}">${n}</text>` +
      `<text x="${ref ? 306 : 246}" y="${y + 4}" font-size="13" fill="var(--ink,#222)">${n === 'Zero da régua' ? '−' + f(NR / 100, 3) : m(v)} m</text>`;
  }
  s += `<text x="12" y="14" font-size="11" fill="var(--muted,#667)">altura acima do NR (m)</text>`;
  $('cartaSvg').innerHTML = s;
  $('cartaPrint').onclick = () => window.print();
})();
