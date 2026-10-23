import numpy as np
def quad_at(tt,vv,t0,half=90*60,minpts=4,deg=2):
    """local polynomial fit around t0 (seconds). returns value at t0, vertex time, n"""
    m=(tt>=t0-half)&(tt<=t0+half)
    if m.sum()<minpts: return np.nan,np.nan,int(m.sum())
    x=(tt[m]-t0)/3600.; y=vv[m]
    # need samples on both sides
    if (x<-0.15).sum()<1 or (x>0.15).sum()<1: return np.nan,np.nan,int(m.sum())
    c=np.polyfit(x,y,deg)
    val=np.polyval(c,0.0)
    vert=np.nan
    if deg==2 and c[0]!=0: vert=t0+(-c[1]/(2*c[0]))*3600
    return val,vert,int(m.sum())
