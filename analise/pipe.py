import pandas as pd,numpy as np,json
V1='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/src/data.json'
D=json.load(open(V1))
TZ=pd.Timedelta(hours=-3)
def load():
    df=pd.read_pickle('/private/tmp/tc/rls.pkl'); return df
def clean(df,thr=0.35,win=11):
    """remove spikes: points deviating > thr from rolling median on regularly sampled data"""
    s=df.set_index('t').v.copy()
    med=s.rolling(win,center=True,min_periods=5).median()
    dt=s.index.to_series().diff().dt.total_seconds()/60
    reg=(dt<=10)&(dt.shift(-1)<=10)
    bad=(s-med).abs()>thr
    bad&=reg
    return s[~bad],s[bad]
def swing_extremes(s,thr=0.5,seggap=90):
    t=s.index.values.astype('datetime64[s]').astype(np.int64); v=s.values
    out=[]
    # segments
    cut=np.where(np.diff(t)>seggap*60)[0]+1
    for a,b in zip(np.r_[0,cut],np.r_[cut,len(t)]):
        tt,vv=t[a:b],v[a:b]
        if len(vv)<5: continue
        # zigzag
        ext=[]; hi=lo=0; direction=0
        for i in range(1,len(vv)):
            if direction>=0 and vv[i]>vv[hi]: hi=i
            if direction<=0 and vv[i]<vv[lo]: lo=i
            if direction==0:
                if vv[hi]-vv[i]>=thr and hi>=lo: ext.append((lo if False else hi,'PM')); direction=-1; lo=i
                elif vv[i]-vv[lo]>=thr and lo>hi: ext.append((lo,'BM')); direction=1; hi=i
                elif vv[hi]-vv[i]>=thr: ext.append((hi,'PM')); direction=-1; lo=i
                elif vv[i]-vv[lo]>=thr: ext.append((lo,'BM')); direction=1; hi=i
            elif direction==1 and vv[hi]-vv[i]>=thr: ext.append((hi,'PM')); direction=-1; lo=i
            elif direction==-1 and vv[i]-vv[lo]>=thr: ext.append((lo,'BM')); direction=1; hi=i
        for i,ty in ext:
            # plateau: contiguous samples within 0.005 of extreme value
            val=vv[i]; j0=i; j1=i
            while j0>0 and abs(vv[j0-1]-val)<=0.005 and tt[j0]-tt[j0-1]<=900: j0-=1
            while j1<len(vv)-1 and abs(vv[j1+1]-val)<=0.005 and tt[j1+1]-tt[j1]<=900: j1+=1
            tc=(tt[j0]+tt[j1])/2
            lo_t=tt[max(j0-1,0)]; hi_t=tt[min(j1+1,len(tt)-1)]
            out.append(dict(ts=tc,type=ty,val=val,plateau=(tt[j1]-tt[j0])/60,gap=(hi_t-lo_t)/60 if True else 0,edge=(j0==0 or j1==len(vv)-1)))
    e=pd.DataFrame(out); 
    return e
def pair(e,pred,maxd=180):
    """pred: list of (ts_ms,h,type); one-to-one nearest same-type"""
    res=[]
    for ty in ['PM','BM']:
        p=[x for x in pred if x[2]==ty]; o=e[e.type==ty].sort_values('ts').reset_index(drop=True)
        ot=o.ts.values  # sec epoch (naive local treated as UTC-3 -> shift)
        used=set()
        cands=[]
        for k,(pts,ph,_) in enumerate(p):
            ps=pts/1000
            d=np.abs(ot-ps); 
            if len(d)==0: continue
            j=int(d.argmin())
            if d[j]<=maxd*60: cands.append((d[j],k,j))
        cands.sort(); usedk=set(); usedj=set()
        for d,k,j in cands:
            if k in usedk or j in usedj: continue
            usedk.add(k); usedj.add(j)
            r=o.loc[j].to_dict(); r.update(pts=p[k][0],ph=p[k][1],lag=(r['ts']-p[k][0]/1000)/60)
            res.append(r)
    return pd.DataFrame(res).sort_values('pts').reset_index(drop=True)
