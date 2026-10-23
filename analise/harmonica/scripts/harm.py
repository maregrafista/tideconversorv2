"""Análise harmônica de marés por mínimos quadrados, com o conjunto de componentes, seleção por
resolução (Rayleigh), inferência e rejeição estatística descritos no manual PACMARÉ 2003 (Franco)."""
import numpy as np, math, pandas as pd

SPEED = dict(T=15.0, s=0.5490165, h=0.0410686, p=0.0046418, p1=0.0000019)
D2R = math.pi / 180

# ------------------------------------------------------------ constituintes
# nome: (T, s, h, p, p1, deslocamento_graus, chave_nodal)
BASE = {
 '2Q1': (1,-4,1,2,0,90,'O1'), 'SIGMA1': (1,-4,3,0,0,90,'O1'), 'Q1': (1,-3,1,1,0,90,'O1'), 'RO1': (1,-3,3,-1,0,90,'O1'),
 'O1': (1,-2,1,0,0,90,'O1'), 'M1': (1,-1,1,1,0,-90,'M1'), 'QUI1': (1,-1,3,-1,0,-90,'O1'), 'PI1': (1,0,-2,0,1,90,'1'),
 'P1': (1,0,-1,0,0,90,'1'), 'S1': (1,0,0,0,0,0,'1'), 'K1': (1,0,1,0,0,-90,'K1'), 'PSI1': (1,0,2,0,-1,-90,'1'),
 'FI1': (1,0,3,0,0,-90,'1'), 'TETA1': (1,1,-1,1,0,-90,'J1'), 'J1': (1,1,1,-1,0,-90,'J1'), 'OO1': (1,2,1,0,0,-90,'OO1'),
 '2N2': (2,-4,2,2,0,0,'M2'), 'MU2': (2,-4,4,0,0,0,'M2'), 'N2': (2,-3,2,1,0,0,'M2'), 'NU2': (2,-3,4,-1,0,0,'M2'),
 'M2': (2,-2,2,0,0,0,'M2'), 'LAMBDA2': (2,-1,0,1,0,180,'M2'), 'L2': (2,-1,2,-1,0,180,'M2'), 'T2': (2,0,-1,0,1,0,'1'),
 'S2': (2,0,0,0,0,0,'1'), 'R2': (2,0,1,0,-1,180,'1'), 'K2': (2,0,2,0,0,0,'K2'),
 'Sa': (0,0,1,0,0,0,'1'), 'Ssa': (0,0,2,0,0,0,'1'),
 'Mm': (0,1,0,-1,0,0,'Mm'), 'Mf': (0,2,0,0,0,0,'Mf'),
}
COMP = {  # compostos: nome: {base: n}
 'MNS2': {'M2':1,'N2':1,'S2':-1}, '2NS2': {'N2':2,'S2':-1}, 'MSN2': {'M2':1,'S2':1,'N2':-1}, '2SM2': {'S2':2,'M2':-1},
 'MKS2': {'M2':1,'K2':1,'S2':-1}, 'KJ2': {'K2':1,'J1':1,'K1':-1}, 'MSF': {'S2':1,'M2':-1},
 'NO3': {'N2':1,'O1':1}, 'MO3': {'M2':1,'O1':1}, 'M3': {'M2':1.5}, 'MK3': {'M2':1,'K1':1}, 'SO3': {'S2':1,'O1':1}, 'SK3': {'S2':1,'K1':1},
 'SQ3': {'S2':1,'Q1':1}, '2MQ3': {'M2':2,'Q1':-1}, '2MP3': {'M2':2,'P1':-1},
 'N4': {'N2':2}, 'MN4': {'M2':1,'N2':1}, 'M4': {'M2':2}, 'SN4': {'S2':1,'N2':1}, 'MS4': {'M2':1,'S2':1}, 'MK4': {'M2':1,'K2':1}, 'S4': {'S2':2}, 'SK4': {'S2':1,'K2':1},
 'MNO5': {'M2':1,'N2':1,'O1':1}, '2MO5': {'M2':2,'O1':1}, '2MK5': {'M2':2,'K1':1}, 'MSK5': {'M2':1,'S2':1,'K1':1},
 '2MN6': {'M2':2,'N2':1}, 'M6': {'M2':3}, 'MSN6': {'M2':1,'S2':1,'N2':1}, '2MS6': {'M2':2,'S2':1}, '2SM6': {'S2':2,'M2':1},
 '2MNO7': {'M2':2,'N2':1,'O1':1}, 'M8': {'M2':4}, '3MN8': {'M2':3,'N2':1}, '3MS8': {'M2':3,'S2':1},
 'M10': {'M2':5}, '4MN10': {'M2':4,'N2':1}, '4MS10': {'M2':4,'S2':1}, '5MN12': {'M2':5,'N2':1}, '5MS12': {'M2':5,'S2':1}, 'M12': {'M2':6},
}
# prioridade de seleção (componentes principais primeiro)
PRIORITY = ['M2','S2','N2','K1','O1','K2','P1','Q1','L2','MU2','NU2','2N2','T2','R2','LAMBDA2','M1','J1','OO1','2Q1','SIGMA1','RO1','QUI1','PI1','PSI1','FI1','TETA1','S1',
 'MSN2','2SM2','MNS2','2NS2','MKS2','KJ2',
 'M4','MS4','MN4','M6','2MS6','2MN6','MSN6','MO3','M3','MK3','SK3','SO3','NO3','SQ3','2MQ3','2MP3','N4','SN4','MK4','S4','SK4',
 '2MO5','MNO5','2MK5','MSK5','2MNO7','M8','3MS8','3MN8','M10','4MS10','4MN10','M12','5MS12','5MN12','Mf','Mm','MSF']
# inferência (constituinte: (referência, razão de amplitude de equilíbrio)); razões CTE
INFER = {'2Q1':('Q1',.1253),'SIGMA1':('Q1',.1519),'RO1':('Q1',.1893),'QUI1':('O1',.0073),'PI1':('K1',.0198),'P1':('K1',.3320),'PSI1':('K1',.0079),'FI1':('K1',.0141),'TETA1':('K1',.0108),
         'J1':('K1',.0800),'OO1':('K1',.0440),
         '2N2':('N2',.1328),'NU2':('N2',.1909),'MU2':('M2',.0305),'LAMBDA2':('M2',.0074),'L2':('M2',.0283),'T2':('S2',.0587),'R2':('S2',.0083),'K2':('S2',.2721)}
NAMES = list(BASE) + list(COMP)

def vcoef(name):
    """(T,s,h,p,p1,offset) e fatores nodais por composição"""
    if name in BASE:
        b = BASE[name]; return np.array(b[:5], float), float(b[5]), {name: 1.0}
    c = np.zeros(5); off = 0.0; comp = {}
    for k, n in COMP[name].items():
        b = BASE[k]; c += n * np.array(b[:5], float); off += n * b[5]; comp[k] = n
    return c, off, comp

def speed(name):
    c, _, _ = vcoef(name); return c[0]*SPEED['T'] + c[1]*SPEED['s'] + c[2]*SPEED['h'] + c[3]*SPEED['p'] + c[4]*SPEED['p1']

# ------------------------------------------------------------ astronomia
def astro(t_local, fuso=3):
    """t_local: datetime64 (hora legal, UTC-fuso). Retorna dict de ângulos em graus."""
    ut = t_local.astype('datetime64[s]').astype(np.int64) + fuso * 3600
    jd = 2440587.5 + ut / 86400.0
    T = (jd - 2451545.0) / 36525.0
    hours = (ut % 86400) / 3600.0
    a = dict(
        s = 218.3164477 + 481267.88123421*T - 0.0015786*T**2,
        h = 280.46646 + 36000.76983*T + 0.0003032*T**2,
        p = 83.3532465 + 4069.0137287*T - 0.0103200*T**2,
        N = 125.04452 - 1934.136261*T + 0.0020708*T**2,
        p1 = 282.93735 + 1.71946*T + 0.00046*T**2,
        T = 15.0*hours - 180.0)
    return a

def nodal(N):
    n = np.asarray(N) * D2R
    I = np.arccos(0.9136949 - 0.0356926*np.cos(n))
    nu = np.arcsin(0.0897056*np.sin(n)/np.sin(I))
    xi = n - 2*np.arctan(0.64412*np.tan(n/2)) - nu
    nup = np.arctan(np.sin(2*I)*np.sin(nu)/(np.sin(2*I)*np.cos(nu) + 0.3347))
    nupp = 0.5*np.arctan(np.sin(I)**2*np.sin(2*nu)/(np.sin(I)**2*np.cos(2*nu) + 0.0727))
    f = {}; u = {}
    f['1'] = np.ones_like(n); u['1'] = np.zeros_like(n)
    f['M2'] = np.cos(I/2)**4/0.9154; u['M2'] = 2*xi - 2*nu
    f['O1'] = np.sin(I)*np.cos(I/2)**2/0.3800; u['O1'] = 2*xi - nu
    f['K1'] = np.sqrt(0.8965*np.sin(2*I)**2 + 0.6001*np.sin(2*I)*np.cos(nu) + 0.1006); u['K1'] = -nup
    f['K2'] = np.sqrt(19.0444*np.sin(I)**4 + 2.7702*np.sin(I)**2*np.cos(2*nu) + 0.0981); u['K2'] = -2*nupp
    f['J1'] = np.sin(2*I)/0.7214; u['J1'] = -nu
    f['OO1'] = np.sin(I)*np.sin(I/2)**2/0.0164; u['OO1'] = -2*xi - nu
    f['M1'] = np.ones_like(n); u['M1'] = np.zeros_like(n)
    f['Mm'] = 1 - 0.130*np.cos(n); u['Mm'] = np.zeros_like(n)
    f['Mf'] = 1.043 + 0.414*np.cos(n); u['Mf'] = (-23.7*np.sin(n) + 2.7*np.sin(2*n) - 0.4*np.sin(3*n))*D2R
    return f, u

def args_fu(names, t_local, fuso=3):
    """Retorna dict nome -> (arg_graus (V0+u), f)"""
    a = astro(t_local, fuso); f, u = nodal(a['N'])
    out = {}
    for nm in names:
        c, off, comp = vcoef(nm)
        V0 = c[0]*a['T'] + c[1]*a['s'] + c[2]*a['h'] + c[3]*a['p'] + c[4]*a['p1'] + off
        F = np.ones_like(V0); U = np.zeros_like(V0)
        for k, n in comp.items():
            key = BASE[k][6]
            F = F * f[key]**abs(n); U = U + n*u[key]
        out[nm] = (V0 + U/D2R, F)
    return out

# ------------------------------------------------------------ análise
def design(names, t_local, fuso=3, extra_mean=True):
    af = args_fu(names, t_local, fuso); cols = []
    if extra_mean: cols.append(np.ones(len(t_local)))
    for nm in names:
        arg, F = af[nm]; cols.append(F*np.cos(arg*D2R)); cols.append(F*np.sin(arg*D2R))
    return np.column_stack(cols)

def select_components(T_hours, rf=1.0):
    """Seleciona por resolução de Rayleigh (Δf >= rf*360/T) dentro da mesma espécie; os demais ficam para inferência."""
    df = rf*360.0/T_hours; chosen = []; skipped = []
    for nm in PRIORITY:
        v = speed(nm)
        if v < 0.4 and nm not in ('Mm','Mf','MSF'): continue
        ok = all(abs(v - speed(c)) >= df - 1e-9 for c in chosen)
        if v < 0.4: ok = False
        (chosen if ok else skipped).append(nm)
    # longo período só com resolução suficiente (e nunca com menos de 1 ano de série para Sa/Ssa)
    return chosen, skipped

def species(v): return int(round(v/15.0))

def fit(y, t_local, names, fuso=3, y_inferred=None):
    X = design(names, t_local, fuso)
    yy = y if y_inferred is None else y - y_inferred
    coef, *_ = np.linalg.lstsq(X, yy, rcond=None)
    return coef, X

def inferred_series(res, t_local, fuso=3):
    """Contribuição das constantes inferidas (amplitude = razão × amplitude da referência; mesma fase GW)."""
    inf = res['inferred']
    if not inf: return np.zeros(len(t_local))
    af = args_fu(list(inf), t_local, fuso); out = np.zeros(len(t_local))
    for nm, d in inf.items():
        arg, F = af[nm]; out += F*d['H']*np.cos((arg - d['g'])*D2R)
    return out

def residual_spectrum(r, t_hours, comps_speed, T_hours, width=2.5, nband=None):
    """Espectro de amplitudes residuais em linhas de Fourier 360/T, por espécie."""
    df = 360.0/T_hours; out = {}
    for a in range(0, 13):
        lo = 15.0*a - width if a else 0.1; hi = 15.0*a + width
        if a == 0: lo, hi = df, 2.0
        if a >= 3: lo, hi = 15.0*a - 1.6, 15.0*a + 1.6
        freqs = np.arange(math.ceil(lo/df)*df, hi, df)
        freqs = [f for f in freqs if all(abs(f - c) > 0.5*df for c in comps_speed)]
        if not freqs: continue
        amps = []
        for f in freqs:
            w = f*D2R*t_hours
            amps.append(2.0/len(r)*abs(np.sum(r*np.exp(-1j*w))))
        out[a] = (np.array(freqs), np.array(amps))
    return out

def analyze(y_cm, t_local, lat, lon_w, fuso=3, rf=1.0, p_reject=0.95, iters=4):
    """y_cm: alturas horárias (cm); t_local: datetime64 horário (hora legal). lon_w: longitude oeste positiva (graus)."""
    t_local = np.asarray(t_local, dtype='datetime64[s]'); y = np.asarray(y_cm, float)
    t_hours = (t_local.astype(np.int64) - t_local.astype(np.int64)[0]) / 3600.0
    T_hours = t_hours[-1] - t_hours[0] + (t_hours[1]-t_hours[0])
    chosen, skipped = select_components(T_hours, rf)
    res = dict(inferred={}, chosen=chosen, skipped=skipped, T_hours=T_hours, N=len(y))
    yinf = np.zeros(len(y))
    for it in range(iters):
        coef, X = fit(y, t_local, chosen, fuso, yinf)
        A = {}
        for i, nm in enumerate(chosen):
            a_, b_ = coef[1+2*i], coef[2+2*i]; H = math.hypot(a_, b_); g = math.degrees(math.atan2(b_, a_)) % 360
            A[nm] = (H, g)
        inf = {}
        for nm in skipped:
            if nm in INFER and INFER[nm][0] in A:
                ref, ratio = INFER[nm]; inf[nm] = dict(ref=ref, H=ratio*A[ref][0], g=A[ref][1])
        res['inferred'] = inf; yinf = inferred_series(res, t_local, fuso)
    fitted = X @ coef + yinf; r = y - fitted
    res.update(mean=coef[0], A=A, resid=r, rms=float(np.std(r, ddof=len(coef))), fitted=fitted)
    # rejeição por espécie
    spec = residual_spectrum(r, t_hours, [speed(n) for n in chosen] , T_hours)
    k95 = math.sqrt(-2*math.log(1 - p_reject))/math.sqrt(2)      # a = k*rms(A)
    thr = {a: k95*float(np.sqrt(np.mean(am**2))) for a, (fq, am) in spec.items()}
    res['thr'] = thr; res['spec'] = spec
    rows = []
    for nm in chosen:
        H, g = A[nm]; v = speed(nm); a = species(v); th = thr.get(a, thr.get(min(thr, key=lambda k: abs(k-a))) if thr else 0)
        GW = g; G = (GW - fuso*v) % 360
        a_cyc = vcoef(nm)[0][0]; K = (GW - a_cyc*lon_w) % 360
        pm = th; phs = math.degrees(math.asin(min(1.0, pm/H))) if H > pm else float('nan')
        rows.append(dict(name=nm, speed=v, species=a, H=H, pm=pm, G=G, K=K, GW=GW, pm_phase=phs, rejected=H < th, inferred=False))
    for nm, d in res['inferred'].items():
        v = speed(nm); a_cyc = vcoef(nm)[0][0]
        rows.append(dict(name=nm, speed=v, species=species(v), H=d['H'], pm=float('nan'), G=(d['g']-fuso*v) % 360, K=(d['g']-a_cyc*lon_w) % 360, GW=d['g'], pm_phase=float('nan'), rejected=False, inferred=True, ref=d['ref']))
    res['table'] = pd.DataFrame(rows).sort_values('speed').reset_index(drop=True)
    return res

def predict(res_table, mean_cm, t_local, fuso=3, use_inferred=True, include_rejected=False):
    """Previsão: nível médio + Σ f H cos(V0+u − GW)."""
    tb = res_table
    if not include_rejected: tb = tb[~tb.rejected]
    if not use_inferred: tb = tb[~tb.inferred]
    t_local = np.asarray(t_local, dtype='datetime64[s]'); af = args_fu(list(tb.name), t_local, fuso)
    out = np.full(len(t_local), float(mean_cm))
    for r in tb.itertuples():
        arg, F = af[r.name]; out += F*r.H*np.cos((arg - r.GW)*D2R)
    return out
