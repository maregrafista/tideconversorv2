import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math
from harm import *
S=pickle.load(open('res.pkl','rb')); R=S['R']; AN=pickle.load(open('anual.pkl','rb')); raw=pickle.load(open('raw5.pkl','rb'))
def swing(t,v,thr=40.0):
    out=[]; hi=lo=0; d=0
    for i in range(1,len(v)):
        if v[i]>v[hi]: hi=i
        if v[i]<v[lo]: lo=i
        if d>=0 and v[hi]-v[i]>=thr: out.append((hi,'PM')); d=-1; lo=i
        elif d<=0 and v[i]-v[lo]>=thr: out.append((lo,'BM')); d=1; hi=i
    return [(t[i],v[i],ty) for i,ty in out]
rows=[]
for n in (1,2,3,4):
    d=raw[n]; t=d.t.values.astype('datetime64[s]'); v=d.v.values*100.0
    g=np.arange(t[0],t[-1],np.timedelta64(300,'s')); vo=np.interp(g.astype(np.int64),t.astype(np.int64),v); eo=swing(g,vo)
    for m in (2,4,3):
        tb_,mn_=(R[m]['table'],R[m]['mean']) if m!=3 else (AN['table3'],AN['S0_anual']); p=predict(tb_,mn_,g); ep=swing(g,p)
        for ty in ('PM','BM'):
            a=[(x[0],x[1]) for x in eo if x[2]==ty]; b=[(x[0],x[1]) for x in ep if x[2]==ty]; bt=np.array([x[0].astype(np.int64) for x in b]); dt=[];dh=[]
            for ta,va in a:
                k=np.abs(bt-ta.astype(np.int64)).argmin()
                if abs(bt[k]-ta.astype(np.int64))<=3*3600: dt.append((bt[k]-ta.astype(np.int64))/60); dh.append(b[k][1]-va)
            dt=np.array(dt);dh=np.array(dh)
            rows.append(dict(bloco=n,modelo=m,tipo=ty,n=len(dt),t_bias=dt.mean(),t_mae=np.abs(dt).mean(),t_rmse=math.sqrt((dt**2).mean()),h_bias=dh.mean(),h_mae=np.abs(dh).mean(),h_rmse=math.sqrt((dh**2).mean()),h_sd=dh.std()))
pickle.dump(pd.DataFrame(rows),open('extr.pkl','wb'))
