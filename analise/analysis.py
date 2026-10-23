import sys; sys.path.insert(0,'/private/tmp/tc')
from pipe import *; from refine import *
import json, math
OUT={}
df=load(); s,bad=clean(df)
OUT['qc']={'rows':int(len(df)),'first':str(df.t.min()),'last':str(df.t.max()),'removed_spikes':int(len(bad)),'removed':[[str(t),float(v)] for t,v in bad.items()]}
idx=s.index.values.astype('datetime64[s]').astype(np.int64)+3*3600; vals=s.values   # epoch s (UTC) of local naive stamps (UTC-3)
# ---- extremes + pairs
e=swing_extremes(s); e['ts']=e.ts+3*3600
pred=[(p['ts'],p['h'],p['type']) for p in D['predictions']]
pr=pair(e,pred); pr['dt']=pd.to_datetime(pr.pts,unit='ms')+TZ; pr['m']=pr.dt.dt.month
def bracket(ts):
    j=np.searchsorted(idx,ts); 
    if j==0 or j>=len(idx): return None
    return j
# refined observed time and R at official time
Roff=[];Rq=[];br=[];tref=[];meth=[]
for _,r in pr.iterrows():
    tp=r.pts/1000; j=bracket(tp)
    if j is None: Roff.append(np.nan); br.append(np.nan); Rq.append('')
    else:
        t0,t1=idx[j-1],idx[j]; b=(t1-t0)/60 if t1!=tp else 0; br.append(b)
        if b<=40: Roff.append(float(np.interp(tp,[t0,t1],[vals[j-1],vals[j]]))); Rq.append('lin')
        else:
            v,_,n=quad_at(idx,vals,tp,half=90*60,minpts=4); Roff.append(v); Rq.append('quad' if v==v else 'none')
    if r.gap<=20: tref.append(r.ts); meth.append('plateau')
    else:
        lo,hi=np.searchsorted(idx,[r.ts-90*60,r.ts+90*60]); 
        v,vert,n=quad_at(idx,vals,r.ts,half=90*60,minpts=4)
        if vert==vert and abs(vert-r.ts)<=60*60: tref.append(vert); meth.append('vertex')
        else: tref.append(r.ts); meth.append('sample')
pr['R']=Roff; pr['Rq']=Rq; pr['br']=br; pr['tref']=tref; pr['tmeth']=meth
pr['lag_new']=(pr.tref-pr.pts/1000)/60
pr['lagq']=np.where((pr.gap<=20)&(pr.plateau<=40),0,np.where((pr.gap<=65)&(pr.plateau<=65),1,2))
pr['wk']=pr.dt.dt.isocalendar().week.astype(int)
pr['doy']=pr.dt.dt.dayofyear
OUT['n_extremes']=int(len(e)); OUT['n_pairs']=int(len(pr))
cal=pr.dropna(subset=['R']).copy().reset_index(drop=True)
OUT['n_cal']=int(len(cal)); OUT['cal_by_month']=cal.groupby('m').size().to_dict()
OUT['Rq_counts']=cal.Rq.value_counts().to_dict()
# ---- monthly fits
def fit(x,y): b,a=np.polyfit(x,y,1); return a,b
models={}
rng=np.random.default_rng(7)
Ntot=0;se_T=0;se_R=0
for m,g in cal.groupby('m'):
    a,b=fit(g.R,g.ph); res=g.ph-(a+b*g.R)
    # LOWO CV within month
    eT=[];eR=[];eRd=[]
    for wk,te in g.groupby('wk'):
        tr=g[g.wk!=wk]
        if len(tr)<10: continue
        a2,b2=fit(tr.R,tr.ph); eT+=list(te.ph-(a2+b2*te.R)); eR+=list(te.R-(te.ph-a2)/b2)
        a3,b3=fit(tr.ph,tr.R); eRd+=list(te.R-(a3+b3*te.ph))
    wks=g.wk.unique(); bs=[]
    for _ in range(600):
        pick=rng.choice(wks,len(wks)); gg=pd.concat([g[g.wk==w] for w in pick]); 
        if gg.R.nunique()>3: bs.append(fit(gg.R,gg.ph))
    bs=np.array(bs)
    models[int(m)]=dict(a=a,b=b,n=len(g),days=int(g.dt.dt.normalize().nunique()),rmse_in=float(np.sqrt((res**2).mean())),rmse=float(np.sqrt(np.mean(np.square(eT)))) if eT else None,rmse_R=float(np.sqrt(np.mean(np.square(eR)))) if eR else None,rmse_R_direct=float(np.sqrt(np.mean(np.square(eRd)))) if eRd else None,
        a_ci=[float(np.percentile(bs[:,0],2.5)),float(np.percentile(bs[:,0],97.5))],b_ci=[float(np.percentile(bs[:,1],2.5)),float(np.percentile(bs[:,1],97.5))],
        min=float(g.R.min()),max=float(g.R.max()),minT=float(g.ph.min()),maxT=float(g.ph.max()),first=str(g.dt.min()),last=str(g.dt.max()),weeks=int(len(wks)),
        r=float(np.corrcoef(g.R,g.ph)[0,1]))
OUT['models']=models
tot=sum(v['n'] for v in models.values())
OUT['pooled']={'n':tot,'rmse':math.sqrt(sum(v['n']*v['rmse']**2 for v in models.values())/tot),'rmse_R':math.sqrt(sum(v['n']*v['rmse_R']**2 for v in models.values())/tot)}
# ---- model comparison (LOWO across all, pooled)
cal['th']=2*np.pi*cal.doy/365.25
def ols(X,y,w=None):
    if w is None: w=np.ones(len(y))
    W=np.sqrt(w)[:,None]; return np.linalg.lstsq(X*W,y*W[:,0],rcond=None)[0]
def dsg(d,k):
    R=d.R.values; one=np.ones(len(d)); c,sn=np.cos(d.th.values),np.sin(d.th.values); c2,s2=np.cos(2*d.th.values),np.sin(2*d.th.values)
    return {'global':np.c_[one,R],'global_type':np.c_[one,R,(d.type=='PM').values*1.0],'season1':np.c_[one,c,sn,R,R*c,R*sn],'season2':np.c_[one,c,sn,c2,s2,R,R*c,R*sn,R*c2,R*s2]}[k]
kinds=['global','global_type','season1','season2','monthly','local7','local10','local15','local20']
err={k:{} for k in kinds}
for wk in sorted(cal.wk.unique()):
    te=cal[cal.wk==wk]; tr=cal[cal.wk!=wk]
    for k in kinds:
        if k=='monthly':
            for m,g in te.groupby('m'):
                t=tr[tr.m==m]
                if len(t)<10: continue
                c=ols(dsg(t,'global'),t.ph.values); p=dsg(g,'global')@c
                for i,v in zip(g.index,g.ph.values-p): err[k][i]=v
        elif k.startswith('local'):
            sg=float(k[5:])
            for i,r in te.iterrows():
                w=np.exp(-0.5*((tr.doy.values-r.doy)/sg)**2); c=ols(dsg(tr,'global'),tr.ph.values,w); err[k][i]=r.ph-(c[0]+c[1]*r.R)
        else:
            c=ols(dsg(tr,k),tr.ph.values); p=dsg(te,k)@c
            for i,v in zip(te.index,te.ph.values-p): err[k][i]=v
cmp={}
for k in kinds:
    ee=pd.Series(err[k]); cmp[k]={'n':int(len(ee)),'rmse':float(np.sqrt((ee**2).mean())*100),'mae':float(ee.abs().mean()*100),'bias':float(ee.mean()*100),
      'rmse_aug_oct':float(np.sqrt((ee[cal.loc[ee.index,'m']>=8]**2).mean())*100)}
# extremo-a-extremo (R no pico observado) para comparação
eE={}
for wk in sorted(cal.wk.unique()):
    te=cal[cal.wk==wk]; tr=cal[cal.wk!=wk]
    for i,r in te.iterrows():
        w=np.exp(-0.5*((tr.doy.values-r.doy)/15)**2); c=ols(np.c_[np.ones(len(tr)),tr.val.values],tr.ph.values,w); eE[i]=r.ph-(c[0]+c[1]*r.val)
ee=pd.Series(eE); cmp['local15_pico_observado']={'n':int(len(ee)),'rmse':float(np.sqrt((ee**2).mean())*100),'mae':float(ee.abs().mean()*100),'bias':float(ee.mean()*100),'rmse_aug_oct':float(np.sqrt((ee[cal.loc[ee.index,'m']>=8]**2).mean())*100)}
OUT['model_compare']=cmp
cal['cv_local10']=pd.Series(err['local15'])
# residual diagnostics for the chosen local10
r10=cal.cv_local10
OUT['resid']={'by_type':{t:{'mean_cm':float(r10[cal.type==t].mean()*100),'sd_cm':float(r10[cal.type==t].std()*100)} for t in ['PM','BM']},
  'by_R_tercile':{},'lag1_autocorr':float(pd.Series(r10.values).autocorr(1))}
cal['Rt']=pd.qcut(cal.R,3,labels=['baixo','médio','alto'])
OUT['resid']['by_R_tercile']={str(k):{'mean_cm':float(r10[cal.Rt==k].mean()*100),'sd_cm':float(r10[cal.Rt==k].std()*100)} for k in ['baixo','médio','alto']}
# ---- daily local calibration
days=pd.date_range('2026-01-01','2026-12-31'); last_pair=cal.dt.max().normalize()
sig=15.0; dcal=[]
for d in days:
    doy=d.dayofyear; eff_d=min(doy,last_pair.dayofyear); extrap=doy>last_pair.dayofyear+2
    w=np.exp(-0.5*((cal.doy.values-eff_d)/sig)**2)
    c=ols(np.c_[np.ones(len(cal)),cal.R.values],cal.ph.values,w)
    neff=w.sum()**2/(w**2).sum()
    cv=cal.cv_local10.values; ok=~np.isnan(cv); rm=math.sqrt((w[ok]*cv[ok]**2).sum()/w[ok].sum())
    mk=w>0.05; sub=cal[mk]
    flag=2 if extrap else (1 if neff<12 else 0)
    dcal.append([round(float(c[0]),5),round(float(c[1]),5),round(float(neff),1),round(rm,4),round(float(sub.R.min()),3),round(float(sub.R.max()),3),round(float(sub.ph.min()),3),round(float(sub.ph.max()),3),flag])
OUT['daily_cal']=dcal; OUT['sigma_days']=sig; OUT['last_pair']=str(cal.dt.max())
# reverse direct RMSE local too skipped
# ---- lags/events
ph=pd.DataFrame(D['phases']); ph['t']=pd.to_datetime(ph.ts,unit='ms')+TZ
ev=pr.copy()
dd=[];cy=[];pn=[]
pht=ph.ts.values
for ts in ev.pts.values:
    k=np.abs(pht-ts).argmin(); dd.append(abs(pht[k]-ts)/864e5); cy.append(ph.cycle.iloc[k]); pn.append(ph.phase.iloc[k])
ev['dist']=dd; ev['cycle']=cy; ev['phase']=pn
ev=ev[ev.lagq<=1].copy()
OUT['events']=[{'ts':int(r.pts),'m':int(r.m),'t':r.type,'lag':round(float(r.lag_new),1),'d':bool(r.lagq==0),'c':r.cycle[0],'dist':round(float(r.dist),3),'src':r.tmeth[0]} for r in ev.itertuples()]
OUT['n_events_all']=int(len(pr)); OUT['n_events_used']=int(len(ev)); OUT['lagq_counts']=pr.lagq.value_counts().to_dict()
# v1 comparison
v1=pd.DataFrame(D['events']); mm=v1.merge(pr[['pts','type','lag_new','lagq']],left_on=['ts','type'],right_on=['pts','type'])
OUT['v1_compare']={'matched':int(len(mm)),'mean_diff_min':float((mm.lag_new-mm.lag).mean())}
mm['dt']=pd.to_datetime(mm.ts,unit='ms')+TZ
OUT['v1_compare']['by_period']={'ate_13jul':float((mm[mm.dt<'2026-07-14'].lag_new-mm[mm.dt<'2026-07-14'].lag).mean()),'apos_14jul':float((mm[mm.dt>='2026-07-14'].lag_new-mm[mm.dt>='2026-07-14'].lag).mean())}
pr.to_pickle('pairs_final.pkl'); cal.to_pickle('cal_final.pkl')
json.dump(OUT,open('out.json','w'),default=lambda o:o.item() if hasattr(o,'item') else str(o))
print(json.dumps({k:v for k,v in OUT.items() if k not in('daily_cal','events','qc')},default=str,indent=1)[:9000])
