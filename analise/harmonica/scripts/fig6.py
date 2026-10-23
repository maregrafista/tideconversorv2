import sys; sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd, pickle, math
from PIL import Image, ImageDraw, ImageFont
from harm import *
BASE='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/harmonica'
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; AN=pickle.load(open('anual.pkl','rb')); X=pickle.load(open('erros02.pkl','rb')); EV,HM=X['EV'],X['HM']
FP='/System/Library/Fonts/Helvetica.ttc'; F=lambda s:ImageFont.truetype(FP,s)
BG=(252,252,249); INK=(36,48,42); MUT=(110,118,110); GRID=(226,229,221); C2=(235,104,52); C3=(27,150,100); CO=(30,30,30)
im=Image.new('RGB',(2000,1560),BG); d=ImageDraw.Draw(im)
def axes(box,xr,yr,xt,yt,fx_=str,fy_=str):
    x0,y0,x1,y1=box; fx=lambda x:x0+(x-xr[0])/(xr[1]-xr[0])*(x1-x0); fy=lambda y:y1-(y-yr[0])/(yr[1]-yr[0])*(y1-y0)
    for v in yt: d.line([(x0,fy(v)),(x1,fy(v))],fill=GRID); d.text((x0-8,fy(v)),fy_(v),font=F(18),fill=MUT,anchor='rm')
    for v in xt: d.line([(fx(v),y0),(fx(v),y1)],fill=GRID); d.text((fx(v),y1+8),fx_(v),font=F(18),fill=MUT,anchor='mt')
    d.rectangle(box,outline=(200,203,195)); return fx,fy
def leg(x,y,items):
    for lab,col in items: d.rectangle([x,y,x+22,y+14],fill=col); d.text((x+30,y-3),lab,font=F(20),fill=INK); x+=60+d.textlength(lab,font=F(20))
d.text((40,22),'Previsão com as constantes do bloco 02 e seus erros (previsto − observado)',font=F(30),fill=INK); leg(40,76,[('B02 (só marés)',C2),('B02 + Sa/Ssa',C3),('Observado',CO)])
# A: janela de 9 dias do B03 (independente) + erro
t,v=B[3]; sl=slice(24*5,24*14); tt=t[sl]; vo=v[sl]; p2=predict(R[2]['table'],R[2]['mean'],t)[sl]; p3=predict(AN['table3'],AN['S0_anual'],t)[sl]
d.text((120,116),'A · Bloco 03 (independente): 9 dias, alturas (cm acima do zero da régua)',font=F(22),fill=INK)
box=(120,150,1960,520); fx,fy=axes(box,(0,len(tt)),(80,430),list(range(0,len(tt),24)),[100,200,300,400],lambda x:str(tt[min(int(x),len(tt)-1)])[8:10]+'/'+str(tt[min(int(x),len(tt)-1)])[5:7])
for arr,col in ((p2,C2),(p3,C3),(vo,CO)): d.line([(fx(i),fy(a)) for i,a in enumerate(arr)],fill=col,width=3)
box2=(120,580,1960,740); fx2,fy2=axes(box2,(0,len(tt)),(-60,60),list(range(0,len(tt),24)),[-40,-20,0,20,40],lambda x:'')
d.text((120,556),'erro horário (cm)',font=F(20),fill=INK)
for arr,col in ((p2-vo,C2),(p3-vo,C3)): d.line([(fx2(i),fy2(a)) for i,a in enumerate(arr)],fill=col,width=3)
d.line([(box2[0],fy2(0)),(box2[2],fy2(0))],fill=MUT,width=1)
# B: RMSE mensal
d.text((120,790),'B · RMSE por mês, todas as observações (cm)',font=F(22),fill=INK)
mes=sorted(HM.mes.unique()); box=(120,830,1960,1130); fx,fy=axes(box,(0,len(mes)),(0,60),[],[0,10,20,30,40,50,60])
bw=(box[2]-box[0])/len(mes)
for i,m in enumerate(mes):
    for k,(mn,col,off) in enumerate((('B02',C2,0.1),('B02+Sa/Ssa',C3,0.5))):
        r=HM[(HM.mes==m)&(HM.modelo==mn)].iloc[0]; xa=box[0]+(i+off)*bw; d.rectangle([xa,fy(r.rmse),xa+0.4*bw,box[3]],fill=col)
        if mn=='B02+Sa/Ssa' or r.rmse>40: d.text((xa+0.2*bw,fy(r.rmse)-3),f'{r.rmse:.0f}',font=F(15),fill=INK,anchor='ms')
    d.text((box[0]+(i+0.5)*bw,box[3]+8),m[2:],font=F(15),fill=INK,anchor='mt')
# C: dispersão PM/BM altura prevista × observada (modelo 3 e 2)
d.text((120,1190),'C · Preamares e baixamares: altura prevista × observada (cm acima do NR)',font=F(22),fill=INK)
box=(120,1230,900,1500); fx,fy=axes(box,(0,360),(0,360),[0,100,200,300],[0,100,200,300])
d.line([(fx(0),fy(0)),(fx(360),fy(360))],fill=MUT)
for mn,col in (('B02',C2),('B02+Sa/Ssa',C3)):
    s=EV[EV.modelo==mn]
    for a,b in zip(s.obs_alt_NR_cm,s.prev_alt_NR_cm): d.ellipse([fx(a)-3,fy(b)-3,fx(a)+3,fy(b)+3],fill=col)
d.text((box[0]+6,box[1]+6),'eixo x: observado · eixo y: previsto',font=F(18),fill=MUT)
# D: histograma do erro de horário
d.text((1060,1190),'D · Erro de horário de PM e BM (min, previsto − observado)',font=F(22),fill=INK)
box=(1060,1230,1960,1500); bins=np.arange(-60,61,5); fx,fy=axes(box,(-60,60),(0,1),[-60,-30,0,30,60],[])
hs={}
for mn in ('B02',): 
    h_,_=np.histogram(EV[EV.modelo==mn].erro_hora_min,bins=bins); hs[mn]=h_
mx=max(h_)*1.1; fy=lambda y,mx=mx:box[3]-y/mx*(box[3]-box[1])
for j,c in enumerate(hs['B02']): d.rectangle([fx(bins[j])+2,fy(c),fx(bins[j+1])-2,box[3]],fill=(120,125,120))
for v_,lab in ((0,'0'),): d.line([(fx(0),box[1]),(fx(0),box[3])],fill=(30,30,30),width=2)
sd=EV[EV.modelo=='B02'].erro_hora_min; d.text((box[2]-8,box[1]+8),f'média {sd.mean():+.1f} min · erro absoluto médio {sd.abs().mean():.1f} min · n={len(sd)}',font=F(20),fill=INK,anchor='ra')
im.save(BASE+'/figuras/6_previsao_bloco02_e_erros.png'); print('ok')
