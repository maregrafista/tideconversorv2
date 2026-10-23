import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, math, pickle
from harm import *
P='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/arquivos_pacmare/'
LAT,LONW=-0.05675956929795816,51.10875044680691
def load(n):
    L=open(P+f'FAZEND_B0{n}.txt','rb').read().decode().split('\r\n'); h=L[3].split()
    fuso,hr,d,m,y,_,N,dt=[int(x) for x in h]
    v=np.array([int(x) for l in L[4:] for x in l.split()],float)+75.0   # volta à referência do zero da régua (RLS)
    t=np.datetime64(f'{y:04d}-{m:02d}-{d:02d}T{hr:02d}:00:00')+np.arange(len(v))*np.timedelta64(dt,'h')
    assert len(v)==N; return t,v
B={n:load(n) for n in (1,2,3,4)}
R={}
for n in (2,4):
    t,v=B[n]; R[n]=analyze(v,t,LAT,LONW,fuso=3); r=R[n]
    print(f'B0{n}: N={r["N"]} h ({r["N"]/24:.1f} d) mean={r["mean"]:.2f} cm rms={r["rms"]:.2f} cm  chosen={len(r["chosen"])} inferred={len(r["inferred"])}')
    tb=r['table']; print(tb[tb.name.isin(['Q1','O1','K1','P1','N2','M2','S2','K2','M4','MS4','MN4','M6'])][['name','speed','H','pm','G','K','GW','inferred','rejected']].round(2).to_string())
pickle.dump(dict(R=R,B=B),open('res.pkl','wb'))
