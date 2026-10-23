'use strict';
/* Quadro de maré no estilo das cartas náuticas (alturas acima do NR). Usa as constantes e o quadro de TCH. */
(function () {
  const T = window.TCH, $ = id => document.getElementById(id);
  if (!T || !$('carta')) return;
  const f = (v, d = 2) => v.toFixed(d).replace('.', ','), m = cm => f(cm / 100), NR = T.NR, q = T.quadro;
  const SP = [15, .5490165, .0410686, .0046418, .0000019], mod = a => ((a % 360) + 360) % 360;
  const niveis = [['Preamar média de sizígia', 'MHWS', q.MHWS], ['Preamar média de quadratura', 'MHWN', q.MHWN], ['Nível médio do mar', 'MSL', q.Zo],
    ['Baixamar média de quadratura', 'MLWN', q.MLWN], ['Baixamar média de sizígia', 'MLWS', q.MLWS]];
  $('cartaNiveis').innerHTML = niveis.map(([n, s, v]) => `<tr><td>${n}</td><td>${s}</td><td>${m(v)}</td><td>${m(v + NR)}</td></tr>`).join('') +
    `<tr class="ref"><td>Nível de redução</td><td>NR</td><td>0,00</td><td>${f(NR / 100, 3)}</td></tr>`;
  // quadro no formato das cartas: Lugar | Lat | Long | HWF&C | alturas em metros sobre o NR (1 casa decimal)
  const f1 = v => (v / 100).toFixed(1).replace('.', ','), hwf = h => { const a = Math.floor(h), b = Math.round((h - a) * 60); return String(a).padStart(2, '0') + 'h' + String(b).padStart(2, '0') + 'min'; };
  const ref = [['Macapá', "0°02'N", "51°02'W", '03h48min', ['2,8', '2,3', '0,7', '0,3', '1,5']], ['Companhia das Docas de Santana', "0°03'S", "51°10'W", '04h21min', ['3,0', '2,5', '0,8', '0,3', '1,6']]];
  $('cartaCarta').innerHTML = `<tr class="faz"><td>Atalaia de Fazendinha</td><td>0°03,4'S</td><td>51°06,5'W</td><td>${hwf(q.HWFC_h)}</td>` + [q.MHWS, q.MHWN, q.MLWN, q.MLWS, q.Zo].map(v => `<td>${f1(v)}</td>`).join('') + '</tr>' +
    ref.map(r => `<tr class="oficial"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td>` + r[4].map(v => `<td>${v}</td>`).join('') + '</tr>').join('');
  const hw = q.HWFC_h, hh = Math.floor(hw), mm = Math.round((hw - hh) * 60);
  const gerais = [['Tipo de maré (critério de Courtier)', `Semidiurna: C = (K1 + O1)/(M2 + S2) = ${f(q.F, 2)}, dentro de 0 ≤ C ≤ 0,25`], ['Estabelecimento do porto (HWF&C)', `${hh} h ${String(mm).padStart(2, '0')} min`],
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
  // referência vertical e qualidade (IHO S-44): datum, período, incerteza a 95 %
  const pt = x => Date.parse(x + '-03:00'), b2 = T.blocks[2], t0 = pt(b2[0]), t1 = pt(b2[1]), dias = Math.round((t1 - t0) / 864e5 + 1 / 24);
  const p95 = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.ceil(.95 * v.length) - 1)]; };
  const EP = Date.UTC(2024, 0, 1), ev = T.ev.map(e => ({ t: EP + (e[0] + 180) * 6e4, h: Math.abs(e[3] - e[2]) / 10, dt: Math.abs(e[4]) })), teste = ev.filter(e => e.t < t0 || e.t > t1);
  const dd = x => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
  const qual = [['Nível de redução (NR)', 'NR = S0 − Zo, com Zo = H(M2) + H(S2) + H(N2) + H(K2) (maré semidiurna, NORMAM-501, Anexo J, Ap. I); referido ao zero da régua de Fazendinha'],
    ['Zo (NR abaixo do nível médio)', `${m(q.Zo)} m = ${m(por.M2.H)} + ${m(por.S2.H)} + ${m(por.N2.H)} + ${m(por.K2.H)}`],
    ['Nível médio (S0)', `${m(q.S0)} m acima do zero da régua (média anual, com Sa e Ssa); período padrão de nível médio não definido`],
    ['Observação e método', `${dias} dias de régua (${dd(b2[0])} a ${dd(b2[1])}), análise harmônica pelo PACMARÉ; mínimo: 32 dias (NORMAM-501) e 30 dias (S-44)`],
    ['Hora', 'UTC−3 (fuso PAPA), sem horário de verão; amostragem constante em minutos cheios. As cartas usam a Hora Média de Greenwich, salvo indicação em contrário (NORMAM-511)'],
    ['Convenções', 'alturas acima do NR, a mesma referência das profundidades das cartas (NORMAM-511); posição aproximada, datum não informado'],
    ['Ficha da estação (F-41)', 'pendente: faltam 3 a 5 referências de nível (RN), nivelamento entre régua e RN e comprimento da régua'],
    ['Ratificação do NR', 'NR de trabalho do Setor de Hidrografia da UNIPILOT; não foi ratificado pelo CHM/DHN'],
    ['Ligação com datum terrestre', 'não determinada (sem RN nem ligação geodésica da régua)'],
    ['Origem das alturas', 'constantes harmônicas (previsão). Para reduzir sondagens a NORMAM-501 aceita só maré observada durante o levantamento, não a prevista'],
    ['Incerteza da altura (95 %)', `± ${f(p95(teste.map(e => e.h)) / 100, 2)} m nas preamares e baixamares, em dados fora do ajuste (${teste.length} marés)`],
    ['Incerteza do horário (95 %)', `± ${Math.round(p95(teste.map(e => e.dt)))} min nas preamares e baixamares, em dados fora do ajuste`],
    ['Variação do nível médio', 'o rio desloca o nível médio ao longo do ano; Sa (21,6 cm) e Ssa (8,3 cm) já estão incluídas, mas anos secos ou cheios diferem']];
  $('cartaQual').innerHTML = qual.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  // esquema dos níveis (figura de revista): desenhado na largura real do contêiner, fontes em tamanho fixo (px)
  function drawSvg() {
    const svg = $('cartaSvg'), W = Math.max(300, Math.round(svg.parentNode.clientWidth || 560)), big = W >= 520, nar = W < 420;
    const fs = { tick: big ? 14 : 12.5, name: big ? 17 : 14.5, val: big ? 16 : 14, dim: big ? 14 : 12 }, AX = big ? 62 : 50, XR = Math.round(AX + (W - AX) * (nar ? .40 : .36));
    const TOP = 16, BOT = Math.round(Math.min(430, Math.max(250, W * .75))), Ht = BOT + 18, hi = q.MHWS / 100 + .3, lo = -.25, Y = v => TOP + (hi - v / 100) / (hi - lo) * (BOT - TOP);
    const fnt = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif', ink = 'var(--ink,#222)', mut = 'var(--muted,#667)', ln = 'var(--line,#ccc)', wat = 'var(--water,#2f7283)', och = 'var(--ochre,#9d6c2b)';
    let s = `<g font-family='${fnt}'>`;
    for (let v = 0; v <= 3.01; v += .5) { const y = Y(v * 100); s += `<line x1="${AX}" x2="${XR}" y1="${y}" y2="${y}" stroke="${ln}"/><line x1="${AX - 5}" x2="${AX}" y1="${y}" y2="${y}" stroke="${ink}"/><text x="${AX - 8}" y="${y + fs.tick * .35}" text-anchor="end" font-size="${fs.tick}" fill="${mut}">${f(v, 1)}</text>`; }
    s += `<line x1="${AX}" x2="${AX}" y1="${TOP}" y2="${BOT}" stroke="${ink}" stroke-width="1.2"/><text transform="translate(${big ? 14 : 12} ${(TOP + BOT) / 2}) rotate(-90)" text-anchor="middle" font-size="${fs.tick}" fill="${mut}">Altura acima do NR (m)</text>`;
    const bw = (XR - AX) * .78, bx = AX + (XR - AX) * .11;
    s += `<rect x="${bx}" y="${Y(q.MHWS)}" width="${bw}" height="${Y(q.MLWS) - Y(q.MHWS)}" style="fill:${wat};opacity:.14"/><rect x="${bx + bw * .17}" y="${Y(q.MHWN)}" width="${bw * .66}" height="${Y(q.MLWN) - Y(q.MHWN)}" style="fill:${wat};opacity:.28"/>`;
    const lv = [['MHWS', q.MHWS, 1.6], ['MHWN', q.MHWN, 1.6], ['MSL', q.Zo, 1.6, '6 4'], ['MLWN', q.MLWN, 1.6], ['MLWS', q.MLWS, 1.6], ['NR', 0, 2.6]];
    for (const [n, v, wd, dash] of lv) {
      const y = Y(v), isNR = n === 'NR', c2 = isNR ? och : ink;
      s += `<line x1="${AX}" x2="${XR}" y1="${y}" y2="${y}" stroke="${c2}" stroke-width="${wd}" ${dash ? `stroke-dasharray="${dash}"` : ''}/><text x="${XR + 8}" y="${y + fs.name * .34}" fill="${c2}"><tspan font-size="${fs.name}" font-weight="700">${n}</tspan><tspan dx="7" font-size="${fs.val}">${m(v)} m</tspan></text>`;
    }
    if (!nar) {
      const dim = (x0, a, b, label) => `<line x1="${x0}" x2="${x0}" y1="${Y(a) + 1}" y2="${Y(b) - 1}" stroke="${ink}" stroke-width="1.2" marker-start="url(#arr)" marker-end="url(#arr)"/><text transform="translate(${x0 - 7} ${(Y(a) + Y(b)) / 2}) rotate(-90)" text-anchor="middle" font-size="${fs.dim}" fill="${ink}">${label}</text>`;
      s += `<defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${ink}"/></marker></defs>` + dim(W - 8 - (big ? 34 : 28), q.MHWS, q.MLWS, `sizígia ${m(q.MHWS - q.MLWS)} m`) + dim(W - 10, q.MHWN, q.MLWN, `quadratura ${m(q.MHWN - q.MLWN)} m`);
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`); svg.setAttribute('height', Ht); svg.setAttribute('width', W); svg.innerHTML = s + '</g>';
  }
  drawSvg(); let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawSvg, 120); });
  if (window.ResizeObserver) { let lw = 0; new ResizeObserver(() => { const w = $('cartaSvg').parentNode.clientWidth; if (w && w !== lw) { lw = w; drawSvg(); } }).observe($('cartaSvg').parentNode); }
  $('cartaPrint').onclick = () => window.print();
})();
