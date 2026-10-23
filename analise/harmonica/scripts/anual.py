import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math
from harm import *
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; PR=pickle.load(open('pred.pkl','rb'))['PR']
LONW=51.10875044680691
# resíduo horário do modelo B02 nos blocos de treino (B02 + B04); B01 (seca de 2024) e B03 ficam para teste
tt=np.concatenate([B[n][0] for n in (2,4)]); ee=np.concatenate([B[n][1]-PR[(n,2)] for n in (2,4)])
X=design(['Sa','Ssa'],tt,3)                        # [1, Sa cos, Sa sen, Ssa cos, Ssa sen]
c,*_=np.linalg.lstsq(X,ee,rcond=None)
rows=[]
for i,nm in enumerate(['Sa','Ssa']):
    a,b=c[1+2*i],c[2+2*i]; H=math.hypot(a,b); g=math.degrees(math.atan2(b,a))%360; v=speed(nm)
    rows.append(dict(name=nm,speed=v,species=0,H=H,pm=float('nan'),G=(g-3*v)%360,K=g%360,GW=g,pm_phase=float('nan'),rejected=False,inferred=False))
AN=pd.DataFrame(rows); c0=float(c[0])
print('c0 (ajuste ao nível médio) = %.2f cm;  S0 anual = %.2f cm'%(c0,R[2]['mean']+c0)); print(AN.round(2).to_string())
def pred3(t):
    return PR_fn(t)
tb=pd.concat([R[2]['table'],AN],ignore_index=True)
pickle.dump(dict(AN=AN,c0=c0,S0_anual=R[2]['mean']+c0,table3=tb),open('anual.pkl','wb'))
# avaliação
def metrics(o,p): e=p-o; return dict(bias=e.mean(),rmse=math.sqrt((e**2).mean()),rmse_nobias=e.std(),mae=np.abs(e).mean())
for n,(t,v) in B.items():
    p3=predict(tb,R[2]['mean']+c0,t); m=metrics(v,p3); m2=metrics(v,PR[(n,2)])
    print('B0%d'%n,'RMSE B02: %.1f -> B02+Sa/Ssa: %.1f   (sem viés %.1f -> %.1f)  viés %.1f -> %.1f'%(m2['rmse'],m['rmse'],m2['rmse_nobias'],m['rmse_nobias'],m2['bias'],m['bias']))
# NR com S0 anual
tbm=R[2]['table']; H=lambda n: float(tbm[tbm.name==n].H.iloc[0]); soma=H('M2')+H('S2')+H('N2')+H('K2')
tb4=R[4]['table']; H4=lambda n: float(tb4[tb4.name==n].H.iloc[0]); soma4=H4('M2')+H4('S2')+H4('N2')+H4('K2')
print('NR (S0 anual %.1f): amplitudes B02 %.1f ; amplitudes B04 %.1f'%(R[2]['mean']+c0,R[2]['mean']+c0-soma,R[2]['mean']+c0-soma4))
