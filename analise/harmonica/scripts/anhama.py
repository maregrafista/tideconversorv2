"""Análise harmônica no domínio da frequência, conforme a descrição do ANHAMA no manual PACMARÉ 2003 (Franco):
interpolação da série horária para 2^k pontos (diferenças segundas / Bessel), FFT de Cooley-Tukey, ajuste por espécie
(ciclos por dia) sobre as linhas de Fourier 360/T, f e u de meio de série, espectro de amplitudes residuais e rejeição a 95%."""
import numpy as np, math, pandas as pd
from harm import vcoef, speed, args_fu, BASE, COMP, PRIORITY, INFER, select_components, D2R, astro, nodal, species

def interp_bessel(y, x):
    """Interpolação por diferenças segundas (Bessel = Lagrange de 4 pontos em torno do intervalo)."""
    N = len(y); i = np.clip(np.floor(x).astype(int), 1, N-3); s = x - i
    ym1, y0, y1, y2 = y[i-1], y[i], y[i+1], y[i+2]
    d1 = y1 - y0; d2m = (y1 - 2*y0 + ym1); d2p = (y2 - 2*y1 + y0)
    return y0 + s*d1 + s*(s-1)/2*(0.5*(d2m + d2p)) + s*(s-0.5)*(s-1)/3*0  # termo de 3ª ordem omitido (Bessel de 2ª diferença)

def kernel(dw, M, delta):
    """(1/M) Σ_j exp(i dw j delta), j=0..M-1 (dw em rad/h)"""
    dw = np.asarray(dw, float); out = np.ones_like(dw, dtype=complex)
    nz = np.abs(dw*delta) > 1e-12
    z = np.exp(1j*dw[nz]*delta)
    out[nz] = (1 - z**M)/(1 - z)/M
    return out

def analyze_anhama(y_cm, t0, lat, lonw, fuso=3, p_reject=0.95, iters=4, comps=None, band_pad=2, subtract_inferred=True):
    y = np.asarray(y_cm, float); N = len(y); T = float(N)
    M = 1 << int(math.ceil(math.log2(N))); delta = N/M
    x = np.minimum(np.arange(M)*delta, N-1.0001)
    yj = interp_bessel(y, x)
    F = np.fft.rfft(yj)/M                         # F[k]: linha k  (frequência k*360/N graus/h)
    kmax = len(F)-1; fl = np.arange(kmax+1)*360.0/N
    t_mid = np.datetime64(t0) + np.timedelta64(int(round(N/2*3600)), 's')
    ang = astro(np.array([np.datetime64(t0)]), fuso); ang_mid = astro(np.array([t_mid]), fuso)
    fN, uN = nodal(ang_mid['N'])
    chosen, skipped = select_components(T, 1.0) if comps is None else (comps, [])
    chosen = [c for c in chosen if speed(c) >= 0.4]
    info = {}
    for nm in chosen + list(INFER):
        c, off, comp = vcoef(nm); V0 = c[0]*ang['T'][0] + c[1]*ang['s'][0] + c[2]*ang['h'][0] + c[3]*ang['p'][0] + c[4]*ang['p1'][0] + off
        Fm = 1.0; U = 0.0
        for k, n in comp.items():
            key = BASE[k][6]; Fm *= float(np.ravel(fN[key])[0])**abs(n); U += n*float(np.ravel(uN[key])[0])
        info[nm] = dict(v=speed(nm), theta=V0 + math.degrees(U), f=Fm)
    def model_lines(zs, ks):
        out = np.zeros(len(ks), complex)
        for nm, z in zs.items():
            dw = (info[nm]['v'] - fl[ks])*D2R
            out += 0.5*z*kernel(dw, M, delta)
        return out
    zfix = {}; res = {}
    for it in range(iters):
        zs = {}; resid = {}; residc = {}; sp_thr = {}
        # espécies
        by_sp = {}
        for nm in chosen: by_sp.setdefault(species(info[nm]['v']), []).append(nm)
        mean = None
        for a, names in sorted(by_sp.items()):
            vs = [info[n]['v'] for n in names]; klo = int(math.floor(min(vs)*N/360)) - band_pad; khi = int(math.floor(max(vs)*N/360)) + band_pad
            if a == 0: klo = 0
            klo = max(klo, 0); khi = min(khi, kmax); ks = np.arange(klo, khi+1)
            tgt = F[ks] - (model_lines(zfix, ks) if (zfix and subtract_inferred) else 0)
            cols = []
            for nm in names:
                dw = (info[nm]['v'] - fl[ks])*D2R; cols.append(0.5*kernel(dw, M, delta))
            if a == 0:
                cols.append(kernel(-fl[ks]*D2R*0, M, delta)*0 + kernel(0*fl[ks] - fl[ks]*D2R, M, delta))   # termo do nível médio (ω=0)
            A = np.column_stack(cols)
            sol, *_ = np.linalg.lstsq(A, tgt, rcond=None)
            for i, nm in enumerate(names): zs[nm] = sol[i]
            if a == 0: mean = sol[-1].real
            r = tgt - A @ sol; resid[a] = (ks, 2*np.abs(r)); residc[a] = (ks, r)
        res['zs'] = zs; res['mean'] = mean; res['resid'] = resid; res['residc'] = residc
        # inferência
        zfix = {}; 
        for nm in skipped + [n for n in INFER if n not in chosen]:
            if nm in INFER and INFER[nm][0] in zs and nm in info:
                ref, ratio = INFER[nm]; zr = zs[ref]; Hr = abs(zr)/info[ref]['f']; gr = info[ref]['theta'] - math.degrees(np.angle(zr))
                H = ratio*Hr; z = H*info[nm]['f']*np.exp(1j*(info[nm]['theta'] - gr)*D2R); zfix[nm] = z
    resid_pac = {}
    for a, (ks, rc) in res['residc'].items():
        rr = rc + (model_lines(zfix, ks) if (zfix and subtract_inferred) else 0)
        resid_pac[a] = (ks, 2*np.abs(rr))
    res['resid_pac'] = resid_pac
    # limiares e tabela
    k95 = math.sqrt(-2*math.log(1-p_reject))/math.sqrt(2)
    rows = []
    for a, (ks, am) in res['resid_pac'].items(): sp_thr[a] = k95*float(np.sqrt(np.mean(am**2)))
    for nm, z in res['zs'].items():
        v = info[nm]['v']; a = species(v); H = abs(z)/info[nm]['f']; g = (info[nm]['theta'] - math.degrees(np.angle(z))) % 360
        a_cyc = vcoef(nm)[0][0]; th = sp_thr.get(a, np.nan)
        rows.append(dict(name=nm, speed=v, species=a, H=H, pm=th, G=(g - fuso*v) % 360, K=(g - a_cyc*lonw) % 360, GW=g, rejected=H < th, inferred=False, pm_phase=(math.degrees(math.asin(min(1, th/H))) if H > th else float('nan'))))
    for nm, z in zfix.items():
        v = info[nm]['v']; H = abs(z)/info[nm]['f']; g = (info[nm]['theta'] - math.degrees(np.angle(z))) % 360; a_cyc = vcoef(nm)[0][0]
        rows.append(dict(name=nm, speed=v, species=species(v), H=H, pm=float('nan'), G=(g - fuso*v) % 360, K=(g - a_cyc*lonw) % 360, GW=g, rejected=False, inferred=True, pm_phase=float('nan')))
    tb = pd.DataFrame(rows).sort_values('speed').reset_index(drop=True)
    return dict(table=tb, mean=res['mean'], resid=res['resid'], resid_pac=res['resid_pac'], thr=sp_thr, N=N, M=M, fl=fl, F=F, chosen=chosen, inferred=zfix)
