import sys, os, math, pickle
sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd
from harm import *
from PIL import Image, ImageDraw, ImageFont
BASE='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/harmonica'
os.makedirs(BASE+'/figuras',exist_ok=True); os.makedirs(BASE+'/tabelas',exist_ok=True); os.makedirs(BASE+'/arquivos_pacmare',exist_ok=True)
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; P=pickle.load(open('pred.pkl','rb')); M,PR=P['M'],P['PR']; E=pickle.load(open('extr.pkl','rb'))
LAT,LONW=-0.05675956929795816,51.10875044680691
# ---------------- NR (Alte Franco, 1997 / planilha de cálculo do NR) ----------------
def nr_franco(tb,S0):
    H=lambda n: float(tb[tb.name==n].H.iloc[0]); G=lambda n: float(tb[tb.name==n].G.iloc[0])
    F=(H('K1')+H('O1'))/(H('M2')+H('S2'))
    if F<0.25: tipo='Semidiurna pura'; soma=H('M2')+H('S2')+H('N2')+H('K2'); form='M2+S2+N2+K2'
    elif F<1.5:
        tipo='Desigualdades diurnas (Balay, 1952)'; k2=(G('M2')-G('K1')-G('O1'))%360
        if abs(k2)<1e-9: soma=H('M2')+H('S2')+H('N2'); form='M2+S2+N2'
        elif abs(k2-180)<1e-9: soma=H('M2')+H('S2')+H('N2')+H('K1')+H('O1'); form='M2+S2+N2+K1+O1'
        else: soma=H('M2')+H('S2')+H('K1')+H('O1')+H('P1'); form='M2+S2+K1+O1+P1'
    elif F<3: tipo='Mista'; soma=H('M2')+H('S2')+H('K1')+H('O1'); form='M2+S2+K1+O1'
    else: tipo='Diurna'; soma=H('M2')+H('S2')+H('K1')+H('O1')+H('P1'); form='M2+S2+K1+O1+P1'
    return dict(F=F,tipo=tipo,soma=soma,formula=form,S0=S0,NR=S0-soma)
NR={n:nr_franco(R[n]['table'],R[n]['mean']) for n in (2,4)}
# combinação: amplitudes de B02 (melhor resolvidas) com S0 de cada bloco
for n in (2,4): print(n,{k:(round(v,2) if isinstance(v,float) else v) for k,v in NR[n].items()})
AN_=pickle.load(open('anual.pkl','rb')); tb2=R[2]['table']; sm=sum(float(tb2[tb2.name==n].H.iloc[0]) for n in ('M2','S2','N2','K2')); tb4_=R[4]['table']; sm4=sum(float(tb4_[tb4_.name==n].H.iloc[0]) for n in ('M2','S2','N2','K2'))
NR['anual']=dict(S0=AN_['S0_anual'],NR_B02=AN_['S0_anual']-sm,NR_B04=AN_['S0_anual']-sm4); print(NR['anual'])
AN_['AN'].round(4).to_csv(BASE+'/tabelas/constantes_Sa_Ssa.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig')
pickle.dump(NR,open('nr.pkl','wb'))
# ---------------- tabelas ----------------
for n in (2,4):
    tb=R[n]['table'].copy(); tb.insert(0,'bloco',f'B0{n}')
    tb.rename(columns={'name':'simbolo','speed':'gr_por_h','species':'especie','H':'H_cm','pm':'mais_menos_cm','G':'G_gr','K':'K_gr','GW':'GW_gr','pm_phase':'mais_menos_fase_gr','rejected':'rejeitada','inferred':'inferida'},inplace=True)
    tb.drop(columns=[c for c in ['ref'] if c in tb.columns]).round(4).to_csv(f'{BASE}/tabelas/constantes_B0{n}.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig')
M.round(3).to_csv(BASE+'/tabelas/previsao_vs_observado_metricas.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig')
E.round(2).to_csv(BASE+'/tabelas/previsao_vs_observado_preamar_baixamar.csv',index=False,sep=';',decimal=',',encoding='utf-8-sig')
# ---------------- arquivos no estilo PACMARÉ ----------------
def dm(x): a=abs(x); d=int(a); m=(a-d)*60; return d,m
def ah_text(n):
    r=R[n]; tb=r['table']; t,v=B[n]; ld,lm=dm(LAT); od,om=dm(-LONW)
    L=['','','                          ANÁLISE HARMÔNICA DA MARÉ','','',
       f'                        ESTAÇÃO MAREGRÁFICA:FAZEND_B0{n}',f'                        LATITUDE:   {ld} {lm:4.1f}  {"S" if LAT<0 else "N"}',
       f'                        LONGITUDE:  {od} {om:4.1f}  W','                        FUSO HORÁRIO: 3','                        HORA INICIAL:   0.0000 0  hora(s)',
       f'                        DATA: {t[0].astype(object).day} / {t[0].astype(object).month} / {t[0].astype(object).year}',f'                        NÚMERO DE DIAS DA ANÁLISE: {r["N"]/24:7.2f}',
       f"                        NÍVEL 'MÉDIO' DO MAR: {r['mean']:7.2f} cm",'                        PORCENT. PARA REJEIÇÃO DE COMPONENTES:  95%',
       f'                        DESVIO PADRÃO RESIDUAL TOTAL: {r["rms"]:6.2f} cm','',
       '                        MÉTODO: ANHAMA (FFT sobre série interpolada a 2^k pontos, ajuste por espécie, f e u de meio de série, inferência e rejeição a 95%)','']
    for a in sorted(set(tb.species)):
        s=tb[tb.species==a]
        if (~s.inferred).any():
            L+= ['',f'                        CICLOS POR DIA: {a}   (limiar de rejeição ±{r["thr"].get(a,float("nan")):.2f} cm)','','                           CONSTANTES HARMÔNICAS','   No.  SÍMBOLO         gr./h       H cm      +/-    G  gr.   K  gr.  GW  gr.   +/-']
            for i,x in enumerate(s[~s.inferred].itertuples(),1):
                ph='*****' if math.isnan(x.pm_phase) else f'{x.pm_phase:5.2f}'
                L.append(f'{i:5d} {"*" if x.rejected else " "}{x.name:<12s}{x.speed:12.7f}{x.H:9.2f}{x.pm:9.2f}{x.G:9.2f}{x.K:9.2f}{x.GW:9.2f}  {ph}')
        if s.inferred.any():
            L+= ['','                           CONSTANTES INFERIDAS','           No. SÍMBOLO       Gr./h       H cm   G Gr.   K Gr.  GW Gr.']
            for i,x in enumerate(s[s.inferred].itertuples(),1): L.append(f'{i:12d}  {x.name:<10s}{x.speed:12.7f}{x.H:8.2f}{x.G:8.2f}{x.K:8.2f}{x.GW:8.2f}')
    L+=['',f'            No. DE COMPONENTES ARQUIVADAS:  {int((~tb.rejected).sum())}']
    open(f'{BASE}/arquivos_pacmare/AHFAZEND_B0{n}.txt','w',newline='').write('\r\n'.join(L)+'\r\n')
IDX={'Q1':8,'O1':10,'M1':12,'P1':15,'S1':16,'K1':17,'2N2':24,'MU2':25,'N2':26,'NU2':27,'M2':28,'LAMBDA2':29,'L2':30,'T2':31,'S2':32,'R2':33,'K2':34}
def encode(name):
    if name in IDX: return [(IDX[name],1)]
    c=COMP.get(name)
    if not c or any(float(v)!=int(v) for v in c.values()) or any(k not in IDX for k in c): return None
    return [(IDX[k],int(v)) for k,v in c.items()]
def ch_text(n):
    r=R[n]; tb=r['table']; tb=tb[(~tb.rejected)&(tb.speed>10)]; rows=[]; skipped=[]
    for x in tb.itertuples():
        e=encode(x.name)
        if e is None: skipped.append(x.name); continue
        # ordem como no arquivo do PACMARÉ: componentes diretos primeiro
        idx=' '.join(str(i) for i,_ in e); mul=' '.join(f'{m:2d}' if len(e)>1 else '1' for _,m in e)
        rows.append(f'"{x.name}"'.ljust(11)+f'{len(e):2d}    {idx}'.ljust(33)+f'{mul}'.ljust(14)+f'{x.H:9.2f}{x.G:8.2f}')
    ld,lm=dm(LAT); od,om=dm(-LONW)
    L=['S','1  "FAZEND_B0%d"'%n,f'  {ld} {lm:4.2f}" S"',f' {od} {om:5.2f}" W"',' 3 ',f'  {len(rows)}      {int(round(r["mean"]))}']+rows
    open(f'{BASE}/arquivos_pacmare/CHFAZEND_B0{n}.txt','w',newline='').write('\r\n'.join(L)+'\r\n'); return skipped
for n in (2,4): ah_text(n); print('CH',n,'sem índice:',ch_text(n))
