import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np
from anhama import *
L=open('/private/tmp/tc/val/ODAS_REV1.txt','rb').read().decode().split('\r\n')
y=np.array([int(x) for l in L[4:] for x in l.split()],float)
r=analyze_anhama(y,'2025-10-07T00:00:00',1.4350,49.2217)
print('M',r['M'],'mean',r['mean'],'(PAC 191.06)')
ref={'Q1':(1.62,249.13),'O1':(8.71,273.18),'K1':(9.53,312.97),'MNS2':(4.82,195.63),'MU2':(10.35,251.72),'N2':(22.56,328.17),'M2':(110.39,359.69),'L2':(9.58,34.83),'S2':(24.47,22.23),'MO3':(1.67,35.32),'MN4':(6.80,79.75),'M4':(20.11,98.69),'MS4':(9.18,150.58),'2MN6':(4.72,344.33),'M6':(9.59,10.37),'2MS6':(7.22,43.99),'M8':(1.95,95.74),'3MN8':(2.20,80.58),'3MS8':(2.06,153.28)}
tb=r['table']
for nm,(h,gw) in ref.items():
    q=tb[tb.name==nm]
    if len(q): q=q.iloc[0]; print(f'{nm:6s} H {q.H:6.2f} vs {h:6.2f}   GW {q.GW:6.1f} vs {gw:6.1f}  d={((q.GW-gw+180)%360)-180:6.1f}')
print(tb[tb.inferred][['name','H','GW']].round(2).to_string())
ks,am=r['resid_pac'][2]; fr=r['fl'][ks]
pac={30.196:5.28,29.804:1.24,27.843:3.56,28.039:2.31,28.627:3.32,28.824:3.26,30.0:0.01,29.216:1.88,26.078:0.48}
for f,v in pac.items():
    i=np.argmin(abs(fr-f)); print(f'linha {fr[i]:.3f} res mine {am[i]:.2f} vs PAC {v}')
print({a:round(v,2) for a,v in r['thr'].items()}, '(PAC ±: 1:1.40 2:3.72 3:1.0 4:3.0 5:.66 6:1.78 7:.45 8:1.07)')
