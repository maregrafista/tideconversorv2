'use strict';
/* Previsão harmônica de Fazendinha: constantes do bloco 02 (análise no estilo ANHAMA) + Sa e Ssa.
   Nível = S0 + Σ f·H·cos(V0 + u − GW), referido ao zero da régua (cm). Argumentos astronômicos de Schureman. */
(function () {
  const H = window.TC_HARM, D2R = Math.PI / 180;
  function astro(ut) {
    const jd = 2440587.5 + ut / 864e5, T = (jd - 2451545) / 36525, hrs = ((ut / 36e5) % 24 + 24) % 24;
    return {
      s: 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T, h: 280.46646 + 36000.76983 * T + 0.0003032 * T * T,
      p: 83.3532465 + 4069.0137287 * T - 0.0103200 * T * T, N: 125.04452 - 1934.136261 * T + 0.0020708 * T * T,
      p1: 282.93735 + 1.71946 * T + 0.00046 * T * T, T: 15 * hrs - 180
    };
  }
  function nodal(Ndeg) {
    const n = Ndeg * D2R, I = Math.acos(0.9136949 - 0.0356926 * Math.cos(n)), nu = Math.asin(0.0897056 * Math.sin(n) / Math.sin(I)),
      xi = n - 2 * Math.atan(0.64412 * Math.tan(n / 2)) - nu, nup = Math.atan(Math.sin(2 * I) * Math.sin(nu) / (Math.sin(2 * I) * Math.cos(nu) + 0.3347)),
      nupp = 0.5 * Math.atan(Math.sin(I) ** 2 * Math.sin(2 * nu) / (Math.sin(I) ** 2 * Math.cos(2 * nu) + 0.0727));
    const f = {}, u = {};
    f.M2 = Math.cos(I / 2) ** 4 / 0.9154; u.M2 = 2 * xi - 2 * nu;
    f.O1 = Math.sin(I) * Math.cos(I / 2) ** 2 / 0.3800; u.O1 = 2 * xi - nu;
    f.K1 = Math.sqrt(0.8965 * Math.sin(2 * I) ** 2 + 0.6001 * Math.sin(2 * I) * Math.cos(nu) + 0.1006); u.K1 = -nup;
    f.K2 = Math.sqrt(19.0444 * Math.sin(I) ** 4 + 2.7702 * Math.sin(I) ** 2 * Math.cos(2 * nu) + 0.0981); u.K2 = -2 * nupp;
    f.J1 = Math.sin(2 * I) / 0.7214; u.J1 = -nu;
    f.OO1 = Math.sin(I) * Math.sin(I / 2) ** 2 / 0.0164; u.OO1 = -2 * xi - nu;
    f.M1 = 1; u.M1 = 0; f.Mm = 1 - 0.130 * Math.cos(n); u.Mm = 0;
    f.Mf = 1.043 + 0.414 * Math.cos(n); u.Mf = (-23.7 * Math.sin(n) + 2.7 * Math.sin(2 * n) - 0.4 * Math.sin(3 * n)) * D2R;
    return { f, u };
  }
  /** nível (cm acima do zero da régua) em um instante (ms UTC); annual=true inclui Sa/Ssa e o S0 anual */
  function predictCm(utMs, annual) {
    const a = astro(utMs), nd = nodal(a.N); let lvl = annual ? H.S0_anual : H.S0_bloco02;
    for (const c of H.comps) {
      if (c.sa && !annual) continue;
      let F = 1, U = 0; for (const [k, ab, sg] of c.k) { F *= Math.pow(nd.f[k], ab); U += sg * nd.u[k]; }
      const arg = c.c[0] * a.T + c.c[1] * a.s + c.c[2] * a.h + c.c[3] * a.p + c.c[4] * a.p1 + c.o + U / D2R;
      lvl += F * c.H * Math.cos((arg - c.g) * D2R);
    }
    return lvl;
  }
  /** preamares e baixamares entre dois instantes (varredura de 5 min + vértice parabólico) */
  function extremes(t0, t1, annual) {
    const step = 300000, n = Math.ceil((t1 - t0) / step) + 2, p = new Float64Array(n), out = [];
    for (let i = 0; i < n; i++) p[i] = predictCm(t0 + i * step, annual);
    for (let i = 1; i < n - 1; i++) {
      const up = p[i] > p[i - 1] && p[i] >= p[i + 1], dn = p[i] < p[i - 1] && p[i] <= p[i + 1];
      if (!up && !dn) continue;
      const den = p[i - 1] - 2 * p[i] + p[i + 1], off = den ? 0.5 * (p[i - 1] - p[i + 1]) / den : 0;
      out.push({ ts: t0 + (i + off) * step, cm: p[i] - 0.25 * (p[i - 1] - p[i + 1]) * off, type: up ? 'PM' : 'BM' });
    }
    return out;
  }
  // observações horárias (hora legal UTC−3 → ms UTC)
  const base = Date.UTC(2024, 0, 1), OBS_T = [], OBS_V = [];
  for (const [h0, vals] of H.obs) vals.forEach((v, i) => { OBS_T.push(base + (h0 + i + 3) * 36e5); OBS_V.push(v); });
  window.TCH = { predictCm, extremes, OBS_T, OBS_V, NR: H.nr_cm, S0: H.S0_anual, quadro: H.quadro, blocks: H.blocks, comps: H.comps };
})();
