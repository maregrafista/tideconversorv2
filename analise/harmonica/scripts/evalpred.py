import sys; sys.path.insert(0,'/private/tmp/tc/har'); sys.path.insert(0,'/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare')
import numpy as np, pandas as pd, pickle, math
from harm import *
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; AN=pickle.load(open('anual.pkl','rb'))
out={}
def metrics(o,p):
    e=p-o; return dict(n=len(o),bias=e.mean(),rmse=math.sqrt((e**2).mean()),mae=np.abs(e).mean(),r=np.corrcoef(o,p)[0,1],
        rmse_nobias=e.std(),maxerr=np.abs(e).max(),p95=np.percentile(np.abs(e),95))
rows=[]; PR={}
for n,(t,v) in B.items():
    for m in (2,4,3):
        tb_,mn_=(R[m]['table'],R[m]['mean']) if m!=3 else (AN['table3'],AN['S0_anual']); p=predict(tb_,mn_,t); PR[(n,m)]=p
        mt=metrics(v,p); mt.update(bloco=n,modelo=m,tipo=('ajuste' if ((n==m and m!=3) or (m==3 and n in (2,4))) else 'independente')); rows.append(mt)
M=pd.DataFrame(rows); pd.set_option('display.width',200)
print(M[['bloco','modelo','tipo','n','bias','rmse','rmse_nobias','mae','p95','r']].round(2).to_string())
pickle.dump(dict(M=M,PR=PR),open('pred.pkl','wb'))
