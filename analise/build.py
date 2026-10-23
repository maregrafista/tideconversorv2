import sys; sys.path.insert(0,'/private/tmp/tc')
from pipe import *
import json,calendar
o=json.load(open('out.json')); cal=pd.read_pickle('cal_final.pkl'); dm=pd.read_pickle('daily_new.pkl')
v1=pd.DataFrame(D['history']['daily']); v1['date']=pd.to_datetime(v1.date)
pre=v1[v1.date<dm.date.min()][['date','R']].assign(src='v1')
new=dm[['date','R']].assign(src='new')
day=pd.concat([pre,new]).sort_values('date').reset_index(drop=True); day['H']=day.R-0.75
day['y']=day.date.dt.year; day['mo']=day.date.dt.month
monthly=[]
for (y,m),g in day.groupby(['y','mo']):
    cd=calendar.monthrange(y,m)[1]
    monthly.append(dict(year=int(y),month=int(m),n=int(len(g)),valid_days=int(len(g)),calendar_days=cd,mean_R=float(g.R.mean()),mean_H=float(g.H.mean()),partial=bool(len(g)<cd)))
M={(q['year'],q['month']):q for q in monthly}
comp=[]
for m in (10,11,12):
    a,b=M.get((2024,m)),M.get((2025,m))
    comp.append(dict(month=m,mean_2024=a['mean_H'],mean_2025=b['mean_H'],delta_cm=(a['mean_H']-b['mean_H'])*100,days2024=a['valid_days'],days2025=b['valid_days'],partial2024=a['partial']))
print([ (c['month'],round(c['delta_cm'],1),c['days2024'],c['days2025']) for c in comp])
names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro']
models={}
for k,v in o['models'].items():
    v=dict(v); v['name']=names[int(k)-1]; v['dense_events']=0; models[k]={x:v[x] for x in ['a','b','name','min','max','minT','maxT','n','days','first','last','rmse','rmse_R','a_ci','b_ci','weeks']}
pairs=[[int(r.pts),round(float(r.R),3),round(float(r.ph),3),0 if r.type=='PM' else 1] for r in cal.itertuples()]
qc=o['qc']; meta=dict(rows=qc['rows'],first=qc['first'],last=qc['last'],spikes=qc['removed_spikes'],extremes=o['n_extremes'],pairs=o['n_pairs'],cal_pairs=o['n_cal'],events_used=o['n_events_used'],last_pair=o['last_pair'],sigma_days=o['sigma_days'],pooled=o['pooled'],compare=o['model_compare'],resid=o['resid'],v1_compare=o['v1_compare'],generated='2026-10-23',source='atalaia-fazendinha-rls.xls')
out=dict(models=models,dcal=o['daily_cal'],pairs=pairs,events=o['events'],phases=D['phases'],predictions=[[p['ts'],p['h'],p['type']] for p in D['predictions']],monthly=monthly,comparison=comp,daily=[[r.date.strftime('%Y-%m-%d'),round(float(r.H),4)] for r in day.itertuples()],meta=meta)
for e in out['events']: e.pop('src',None)
p='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/tideconversorv2/data/'
open(p+'data.js','w').write('window.TC_DATA='+json.dumps(out,ensure_ascii=False,separators=(',',':'),default=lambda x:x.item() if hasattr(x,'item') else str(x))+';')
import os; print(os.path.getsize(p+'data.js'))
# CSVs
pd.DataFrame([{'month':int(k),'mes':v['name'],'pares':v['n'],'dias':v['days'],'a':v['a'],'b':v['b'],'a_ic95_lo':v['a_ci'][0],'a_ic95_hi':v['a_ci'][1],'b_ic95_lo':v['b_ci'][0],'b_ic95_hi':v['b_ci'][1],'min_R':v['min'],'max_R':v['max'],'RMSE_T_cm':v['rmse']*100,'RMSE_R_cm':v['rmse_R']*100} for k,v in models.items()]).to_csv(p+'calibracao_mensal.csv',index=False)
pd.DataFrame(monthly).to_csv(p+'medias_historicas.csv',index=False)
dc=pd.DataFrame(o['daily_cal'],columns=['a','b','n_efetivo','RMSE_T_m','min_R','max_R','min_T','max_T','status']); dc.insert(0,'data',pd.date_range('2026-01-01','2026-12-31').strftime('%Y-%m-%d')); dc.to_csv(p+'calibracao_diaria.csv',index=False)
pd.DataFrame(o['events']).to_csv(p+'defasagens_eventos.csv',index=False)
pairs_df=pd.DataFrame(pairs,columns=['ts_oficial_ms','R_m','T_m','tipo']); pairs_df['tipo']=pairs_df.tipo.map({0:'PM',1:'BM'}); pairs_df.to_csv(p+'pares_calibracao.csv',index=False)
import shutil; os.remove(p+'defasagens_mensais.csv') if os.path.exists(p+'defasagens_mensais.csv') else None
json.dump(meta,open(p+'auditoria.json','w'),ensure_ascii=False,indent=1,default=str)
print([ (q['year'],q['month'],q['valid_days'],q['partial']) for q in monthly if q['year']==2026])
