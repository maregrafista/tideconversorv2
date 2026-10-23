import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, math, pickle
from harm import predict
from anhama import analyze_anhama
exec(open('run.py').read().split('R={}')[0])      # carrega B (blocos) e constantes
R={}
for n in (2,4):
    t,v=B[n]; r=analyze_anhama(v,t[0],LAT,LONW,fuso=3)
    pr=predict(r['table'],r['mean'],t); r['rms']=float(np.std(v-pr)); r['resid_ts']=v-pr; r['thr']=r['thr']
    R[n]=r; tb=r['table']
    print(f'B0{n}: N={r["N"]} h  M={r["M"]} pontos FFT  nível médio={r["mean"]:.2f} cm  resíduo rms={r["rms"]:.2f} cm  analisadas={len(r["chosen"])} inferidas={len(r["inferred"])} rejeitadas={int(tb.rejected.sum())}')
    print(tb[tb.name.isin(['Q1','O1','K1','P1','N2','M2','S2','K2','M4','MS4','MN4','M6'])][['name','speed','H','pm','G','K','GW','inferred','rejected']].round(2).to_string())
    print({a:round(x,2) for a,x in r['thr'].items() if a<=6})
pickle.dump(dict(R=R,B=B),open('res.pkl','wb'))
