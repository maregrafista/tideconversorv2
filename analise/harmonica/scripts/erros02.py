import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math
from harm import *
BASE='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/harmonica/bloco02'
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; AN=pickle.load(open('anual.pkl','rb')); raw=pickle.load(open('raw5.pkl','rb')); NRv=AN['S0_anual']-sum(float(R[2]['table'][R[2]['table'].name==n].H.iloc[0]) for n in ('M2','S2','N2','K2'))
def swing(t,v,thr=40.0):
    out=[]; hi=lo=0; d=0
    for i in range(1,len(v)):
        if v[i]>v[hi]: hi=i
        if v[i]<v[lo]: lo=i
        if d>=0 and v[hi]-v[i]>=thr: out.append((hi,'PM')); d=-1; lo=i
        elif d<=0 and v[i]-v[lo]>=thr: out.append((lo,'BM')); d=1; hi=i
    return [(t[i],v[i],ty) for i,ty in out]
MOD={'B02':(R[2]['table'],R[2]['mean']),'B02+Sa/Ssa':(AN['table3'],AN['S0_anual'])}
rows=[]
for n in (1,2,3,4):
    d=raw[n]; t=d.t.values.astype('datetime64[s]'); v=d.v.values*100.0
    g=np.arange(t[0],t[-1],np.timedelta64(300,'s')); vo=np.interp(g.astype(np.int64),t.astype(np.int64),v); eo=swing(g,vo)
    for mn,(tb,mean) in MOD.items():
        p=predict(tb,mean,g); ep=swing(g,p)
        for ty in ('PM','BM'):
            a=[x for x in eo if x[2]==ty]; b=[x for x in ep if x[2]==ty]; bt=np.array([x[0].astype(np.int64) for x in b])
            for ta,va,_ in a:
                k=np.abs(bt-ta.astype(np.int64)).argmin()
                if abs(bt[k]-ta.astype(np.int64))<=3*3600:
                    rows.append(dict(bloco=n,modelo=mn,tipo=ty,obs_data=str(ta)[:10],obs_hora=str(ta)[11:16],prev_hora=str(b[k][0])[11:16],erro_hora_min=round((bt[k]-ta.astype(np.int64))/60),obs_alt_NR_cm=round(va-NRv,1),prev_alt_NR_cm=round(b[k][1]-NRv,1),erro_alt_cm=round(b[k][1]-va,1)))
EV=pd.DataFrame(rows); EV.to_csv(BASE+'/previsao_vs_observado_PM_BM_eventos.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig'); print(len(EV))
# horário: erro por mês (agrega blocos que dividem o mesmo mês)
acc={}
for n,(t,v) in B.items():
    for mn,(tb,mean) in MOD.items():
        p=predict(tb,mean,t); mes=pd.Series(pd.to_datetime(t)).dt.to_period('M').astype(str).values; e=p-v
        for m in np.unique(mes): acc.setdefault((mn,m),[]).append(e[mes==m])
HM=pd.DataFrame([dict(modelo=k[0],mes=k[1],n=sum(len(x) for x in v),vies=np.concatenate(v).mean(),rmse=math.sqrt((np.concatenate(v)**2).mean()),dp=np.concatenate(v).std()) for k,v in sorted(acc.items(),key=lambda z:(z[0][1],z[0][0]))])
HM.round(1).to_csv(BASE+'/erro_mensal.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig')
pickle.dump(dict(EV=EV,HM=HM),open('erros02.pkl','wb'))
pd.set_option('display.width',200)
print(HM.pivot(index='mes',columns='modelo',values='rmse').round(1).join(HM.pivot(index='mes',columns='modelo',values='vies').round(1),rsuffix=' viés').to_string())
print(EV.groupby(['modelo','tipo']).agg(n=('erro_hora_min','size'),hora_media=('erro_hora_min','mean'),hora_abs=('erro_hora_min',lambda x:x.abs().mean()),alt_media=('erro_alt_cm','mean'),alt_abs=('erro_alt_cm',lambda x:x.abs().mean()),alt_dp=('erro_alt_cm','std')).round(1).to_string())
