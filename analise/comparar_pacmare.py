import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math, re
from harm import *
U='/Users/cooperativaunipilot/.claude/uploads/4e3db02b-a924-4939-8e24-c594f1ccf739/'
IDX={1:'Sa',2:'Ssa',3:'Mm',4:'Mf',7:'SIGMA1',8:'Q1',10:'O1',12:'M1',15:'P1',16:'S1',17:'K1',24:'2N2',25:'MU2',26:'N2',27:'NU2',28:'M2',29:'LAMBDA2',30:'L2',31:'T2',32:'S2',34:'K2',37:'M3'}
# oficial: composicao do CH, GW do AH
comp={}
for l in open(U+'0d855733-CH_B02.txt',encoding='latin-1'):
    m=re.match(r'"([^"]+)"\s+(\d+)\s+(.*)',l)
    if not m: continue
    n=int(m.group(2)); t=m.group(3).split()
    comp[m.group(1).upper()]=(list(map(int,t[:n])),list(map(int,t[n:2*n])))
off=[]
f=lambda s:float(s.replace(',','.'))
for l in open(U+'549bb114-AH_02.txt',encoding='latin-1'):
    m=re.match(r'\s+(\d+)\s+(\*?)(\S+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)',l)
    if m and not m.group(2): off.append((m.group(3).upper(),f(m.group(5)),f(m.group(9))))
bases=set(IDX.values()); 
def pred_off(t,mean,subset=None):
    t=np.asarray(t,dtype='datetime64[s]'); af=args_fu(sorted(bases),t); o=np.full(len(t),float(mean)); nm=0
    for s,H,GW in off:
        key=s if s!='SA' and s!='SSA' and s!='MF' and s!='MM' else {'SA':'Sa','SSA':'Ssa','MF':'Mf','MM':'Mm'}[s]
        ix,cf=comp[s if s in comp else s]
        arg=0;F=1
        for i,c in zip(ix,cf):
            a,ff=af[IDX[i]]; arg=arg+c*a; F=F*ff**abs(c)
        o+=F*H*np.cos((arg-GW)*D2R); nm+=1
    return o
# conjunto proprio (site): tabela anual + S0 anual
AN=pickle.load(open('anual.pkl','rb')); raw=pickle.load(open('raw5.pkl','rb'))
def pred_mine(t): return predict(AN['table3'],AN['S0_anual'],t)
S=pickle.load(open('res.pkl','rb')); 
print('nomes oficiais sem composicao:',[s for s,_,_ in off if s not in comp])
print('S0 meu',AN['S0_anual'],' n comps',len(AN['table3'][~AN['table3'].rejected]),' n oficiais',len(off))
def swing(t,v,thr=40.0):
    out=[]; hi=lo=0; d=0
    for i in range(1,len(v)):
        if v[i]>v[hi]: hi=i
        if v[i]<v[lo]: lo=i
        if d>=0 and v[hi]-v[i]>=thr: out.append((hi,'PM')); d=-1; lo=i
        elif d<=0 and v[i]-v[lo]>=thr: out.append((lo,'BM')); d=1; hi=i
    return [(t[i],v[i],ty) for i,ty in out]
MOD={'Meu (B02+Sa/Ssa, S0 anual)':pred_mine,'PACMARE (113 const., nivel medio proprio)':lambda t:pred_off(t,231.38),'PACMARE com S0 anual':lambda t:pred_off(t,AN['S0_anual'])}
rows=[];ext=[]
for n in (1,2,3,4):
    d=raw[n]; t=d.t.values.astype('datetime64[s]'); v=d.v.values*100.0
    g=np.arange(t[0],t[-1],np.timedelta64(300,'s')); vo=np.interp(g.astype(np.int64),t.astype(np.int64),v); eo=swing(g,vo)
    for k,fn in MOD.items():
        p=fn(t); e=p-v
        rows.append(dict(bloco=n,modelo=k,n=len(v),vies=e.mean(),rmse=math.sqrt((e**2).mean()),dp=e.std(),mae=abs(e).mean(),p95=np.percentile(abs(e),95)))
        pg=fn(g); ep=swing(g,pg)
        for ty in ('PM','BM'):
            a=[(x[0],x[1]) for x in eo if x[2]==ty]; b=[(x[0],x[1]) for x in ep if x[2]==ty]; bt=np.array([x[0].astype(np.int64) for x in b]); dt=[];dh=[]
            for ta,va in a:
                j=np.abs(bt-ta.astype(np.int64)).argmin()
                if abs(bt[j]-ta.astype(np.int64))<=3*3600: dt.append((bt[j]-ta.astype(np.int64))/60); dh.append(b[j][1]-va)
            dt=np.array(dt);dh=np.array(dh)
            ext.append(dict(bloco=n,modelo=k,tipo=ty,n=len(dt),t_vies=dt.mean(),t_mae=abs(dt).mean(),h_vies=dh.mean(),h_mae=abs(dh).mean(),h_dp=dh.std()))
R=pd.DataFrame(rows);E=pd.DataFrame(ext)
pd.set_option('display.width',220)
print(R.round(2).to_string());print(E.round(1).to_string())
pickle.dump((R,E),open('/private/tmp/claude-501/-Users-cooperativaunipilot-Mare-Fazendinha-PACMARE/4e3db02b-a924-4939-8e24-c594f1ccf739/scratchpad/dois.pkl','wb'))
