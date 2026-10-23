import sys; sys.path.insert(0,'/private/tmp/tc')
from pipe import *
import json
df=load(); s,bad=clean(df)
t=s.index.values.astype('datetime64[s]').astype(np.int64); v=s.values  # local naive epoch
def daymean(d0,gaplim=65):
    a=d0.value//10**9; b=a+86400
    lo,hi=np.searchsorted(t,[a-7200,b+7200])
    tt=t[lo:hi]; vv=v[lo:hi]
    if len(tt)<4 or tt[0]>a or tt[-1]<b: return None
    m=(tt>=a)&(tt<=b); n=int(m.sum())
    seg=np.r_[a,tt[m],b]; 
    if (np.diff(seg)/60).max()>gaplim and False: pass
    # gaps inside day (using bracket samples)
    tt2=np.r_[tt[(tt<a)][-1:] ,tt[m],tt[(tt>b)][:1]]
    mg=(np.diff(tt2)/60).max()
    if mg>gaplim: return None
    x=np.r_[a,tt[m],b]; y=np.r_[np.interp(a,tt,vv),vv[m],np.interp(b,tt,vv)]
    return float(np.trapezoid(y,x)/86400), n, float(mg)
days=pd.date_range(df.t.min().normalize()+pd.Timedelta(days=1),df.t.max().normalize()-pd.Timedelta(days=1))
rows=[]
for d in days:
    r=daymean(d,65)
    if r: rows.append((d,)+r)
dm=pd.DataFrame(rows,columns=['date','R','n','maxgap'])
dm['dense']=(dm.n>=260)&(dm.maxgap<=60)
print(len(dm),dm.dense.sum(),(~dm.dense).sum())
# decimation test on dense days: mean error of trapz when only sparse samples
rng=np.random.default_rng(3); errs=[]
for d in dm[dm.dense].date.sample(150,random_state=1):
    a=d.value//10**9; lo,hi=np.searchsorted(t,[a-7200,a+86400+7200]); tt=t[lo:hi]; vv=v[lo:hi]
    keep=[0]
    while True:
        nx=keep[-1]+max(1,int(rng.exponential(4)))
        if nx>=len(tt): break
        keep.append(nx)
    tk,vk=tt[keep],vv[keep]
    if (np.diff(tk)/60).max()>65: continue
    m=(tk>=a)&(tk<=a+86400); x=np.r_[a,tk[m],a+86400]; y=np.r_[np.interp(a,tk,vk),vk[m],np.interp(a+86400,tk,vk)]
    errs.append(np.trapezoid(y,x)/86400-np.interp(0,[0,1],[1,1])*dm.loc[dm.date==d,'R'].iloc[0])
errs=np.array(errs); print('sparse-day mean err cm: n',len(errs),'bias',round(errs.mean()*100,2),'rmse',round(np.sqrt((errs**2).mean())*100,2))
dm.to_pickle('daily_new.pkl')
# merge with v1 daily for pre-2024-11-07
v1=pd.DataFrame(D['history']['daily']); v1['date']=pd.to_datetime(v1.date)
pre=v1[v1.date<dm.date.min()]; print('v1 pre days',len(pre),pre.date.min(),pre.date.max())
ov=v1.merge(dm,on='date',suffixes=('_v1','_n')); print('overlap days',len(ov),'diff R cm',((ov.R_n-ov.R_v1)*100).describe().round(2).to_dict())
print('days where v1 had data but new not qualified',len(set(v1.date)-set(dm.date)), 'new has not v1',len(set(dm.date)-set(v1.date)))
print(sorted(set(dm.date)-set(v1.date))[:5], sorted(set(dm.date)-set(v1.date))[-3:])
