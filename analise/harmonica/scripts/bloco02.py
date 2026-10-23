import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math
from harm import *
BASE='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/harmonica'
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; AN=pickle.load(open('anual.pkl','rb'))
tb=R[2]['table']; H=lambda n: float(tb[tb.name==n].H.iloc[0]); G=lambda n: float(tb[tb.name==n].G.iloc[0])
S0=AN['S0_anual']; Zo=H('M2')+H('S2')+H('N2')+H('K2'); NRv=S0-Zo
F=(H('K1')+H('O1'))/(H('M2')+H('S2'))
D=H('S2')/H('M2'); d=math.radians((G('S2')-G('M2'))%360)
e=math.degrees(math.atan2(D*math.sin(d),1+D*math.cos(d))); hwfc=((e+G('M2'))%360)/28.984
q=dict(F=F,tipo='Semidiurna pura',S0=S0,Zo=Zo,NR=NRv,D=D,d=math.degrees(d),e=e,HWFC_h=hwfc,
  MHWS=Zo+H('M2')+H('S2'),MLWS=Zo-(H('M2')+H('S2')),MHWN=Zo+(H('M2')-H('S2')),MLWN=Zo-(H('M2')-H('S2')))
for k,v in q.items(): print(k, round(v,2) if not isinstance(v,str) else v)
print('HWF&C = %dh %02dmin'%(int(hwfc),round((hwfc-int(hwfc))*60)))
# níveis acima do zero da régua
for k in ('MHWS','MHWN','MLWN','MLWS'): print(k,'acima do NR %.1f cm | acima do zero da régua %.1f cm'%(q[k],q[k]+NRv))
pickle.dump(q,open('quadro.pkl','wb'))
# extremos previstos nov–dez/2026 com B02 + Sa/Ssa, alturas acima do NR
tb3=AN['table3']; g=np.arange(np.datetime64('2026-11-01T00:00:00'),np.datetime64('2027-01-01T00:00:00'),np.timedelta64(300,'s'))
p=predict(tb3,S0,g)-NRv
ev=[]; hi=lo=0; dr=0
for i in range(1,len(p)):
    if p[i]>p[hi]: hi=i
    if p[i]<p[lo]: lo=i
    if dr>=0 and p[hi]-p[i]>=40: ev.append((g[hi],p[hi],'PM')); dr=-1; lo=i
    elif dr<=0 and p[i]-p[lo]>=40: ev.append((g[lo],p[lo],'BM')); dr=1; hi=i
ev=[e for e in ev if e[0]>g[0]+np.timedelta64(3600,'s')]
E_=pd.DataFrame([(str(t)[:10],str(t)[11:16],round(float(v),1),ty) for t,v,ty in ev],columns=['data','hora_UTC-3','altura_acima_NR_cm','tipo'])
import os; os.makedirs(BASE+'/bloco02',exist_ok=True)
E_.to_csv(BASE+'/bloco02/previsao_PM_BM_nov_dez_2026.csv',index=False,sep=';',encoding='utf-8-sig'); print(len(E_),'extremos'); print(E_.head(6).to_string())
