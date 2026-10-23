import re,pandas as pd,numpy as np
s=open("atalaia-fazendinha-rls.xls",encoding='utf-8-sig').read()
rows=re.findall(r'<tr[^>]*>(.*?)</tr>',s,re.S)
d=[re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',r,re.S) for r in rows]
bad=[x for x in d if len(x)!=2]; print('rows !=2 cols',len(bad),bad[:3])
df=pd.DataFrame([x for x in d if len(x)==2][1:],columns=['t','v'])
df['t']=pd.to_datetime(df.t,errors='coerce'); df['v']=pd.to_numeric(df.v.str.replace(',','.'),errors='coerce')
print('nan',df.isna().sum().to_dict(),len(df)); df=df.dropna().sort_values('t').reset_index(drop=True)
df.to_pickle('rls.pkl')
