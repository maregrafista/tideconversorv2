import sys, json, math, pickle
sys.path.insert(0,'/private/tmp/tc/har'); sys.path.insert(0,'.')
import numpy as np, pandas as pd
from harm import *
import blocos
S=pickle.load(open('/private/tmp/tc/har/res.pkl','rb')); R=S['R']; AN=pickle.load(open('/private/tmp/tc/har/anual.pkl','rb')); Q=pickle.load(open('/private/tmp/tc/har/quadro.pkl','rb'))
tb=AN['table3']; tb=tb[~tb.rejected].copy()
comps=[]
for r in tb.itertuples():
    c,off,comp=vcoef(r.name); keys={}
    for k,n in comp.items():
        key=BASE[k][6]; a=keys.setdefault(key,[0.0,0.0]); a[0]+=abs(n); a[1]+=n
    comps.append(dict(n=r.name,c=[float(x) for x in c],o=float(off),k=[[k,v[0],v[1]] for k,v in keys.items() if k!='1'],H=round(float(r.H),4),g=round(float(r.GW),3),sa=bool(r.name in('Sa','Ssa')),inf=bool(r.inferred)))
NR_cm=float(Q['NR']); 
# série observada horária (hora local), cm na referência do zero da régua
df,_,_=blocos.load(blocos.SRC)
t=df.t.values.astype('datetime64[s]').astype(np.int64); v=df.v.values*100.0
h0=np.datetime64('2024-01-01T00:00:00').astype(np.int64)
hs=np.arange(math.ceil((t[0]-h0)/3600),math.floor((t[-1]-h0)/3600)+1)
sec=h0+hs*3600; j=np.searchsorted(t,sec)
ok=(j>0)&(j<len(t))
val=np.full(len(hs),np.nan)
for i in np.where(ok)[0]:
    a,b=j[i]-1,j[i]
    if t[b]==sec[i]: val[i]=v[b]
    elif (t[b]-t[a])<=3600: val[i]=v[a]+(v[b]-v[a])*(sec[i]-t[a])/(t[b]-t[a])
good=~np.isnan(val); idx=np.where(good)[0]
runs=[]; start=None; prev=None; cur=[]
for i in idx:
    if prev is not None and i==prev+1: cur.append(int(round(val[i])))
    else:
        if cur: runs.append([int(hs[start]),cur])
        start=i; cur=[int(round(val[i]))]
    prev=i
if cur: runs.append([int(hs[start]),cur])
nobs=sum(len(r[1]) for r in runs); print('horas observadas',nobs,'trechos',len(runs),'de',len(hs))
blocks={n:[str(R_[0][0]),str(R_[0][-1])] for n,R_ in S['B'].items()}
out=dict(epoch0='2024-01-01T00:00',nr_cm=round(NR_cm,2),S0_anual=round(float(AN['S0_anual']),2),S0_bloco02=round(float(R[2]['mean']),2),
  comps=comps,obs=runs,blocks=blocks,quadro={k:(round(float(x),2) if not isinstance(x,str) else x) for k,x in Q.items()},
  metodo=dict(ajuste='B02 (26/02/2025–05/01/2026, 7.510 h) + Sa e Ssa ajustadas em B02+B04',analise='FFT/ANHAMA por espécie com f e u de meio de série, inferência e rejeição a 95%'))
json.dump(out,open('/private/tmp/tc/har/harm.json','w'),separators=(',',':'))
import os; print(os.path.getsize('/private/tmp/tc/har/harm.json'),len(comps))
# valores de referência para teste do JS
tests=[np.datetime64(x) for x in ['2025-03-15T06:00:00','2025-09-01T18:00:00','2026-01-24T12:00:00','2026-06-30T00:00:00','2026-11-15T09:00:00','2027-03-01T00:00:00']]
ref=[]
for tt in tests:
    tl=np.array([tt]); ref.append(dict(local=str(tt),cm=float(predict(AN['table3'],AN['S0_anual'],tl)[0]),cm_B02=float(predict(R[2]['table'],R[2]['mean'],tl)[0])))
json.dump(ref,open('/private/tmp/tc/har/ref.json','w')); print(ref)
