import sys, os, math, pickle
sys.path.insert(0,'/private/tmp/tc/har')
import numpy as np, pandas as pd
from harm import *
from PIL import Image, ImageDraw, ImageFont
BASE='/Users/cooperativaunipilot/Library/Application Support/Claude/scratch-workspaces/593eae28-9a87-4a31-acf2-58d7f6d0ffe4/7aeb6f4a-534e-45f4-8a19-c7719fb8418c/scratch-2026-10-23-6a45ce/pacmare/harmonica'
S=pickle.load(open('res.pkl','rb')); R,B=S['R'],S['B']; P=pickle.load(open('pred.pkl','rb')); M,PR=P['M'],P['PR']; E=pickle.load(open('extr.pkl','rb')); NR=pickle.load(open('nr.pkl','rb'))
FP='/System/Library/Fonts/Helvetica.ttc'; F=lambda s:ImageFont.truetype(FP,s)
BG=(252,252,249); INK=(36,48,42); MUT=(110,118,110); GRID=(226,229,221)
C={2:(235,104,52),4:(98,80,214),3:(27,150,100),'obs':(30,30,30)}
LAB={2:'constantes de B02',4:'constantes de B04',3:'B02 + Sa/Ssa'}
def canvas(w,h): im=Image.new('RGB',(w,h),BG); return im,ImageDraw.Draw(im)
def axes(d,box,xr,yr,xt=None,yt=None,xl='',yl='',log=False,fmtx=None,fmty=None):
    x0,y0,x1,y1=box; fx=lambda x:x0+(x-xr[0])/(xr[1]-xr[0])*(x1-x0)
    if log: fy=lambda y:y1-(math.log10(max(y,1e-9))-math.log10(yr[0]))/(math.log10(yr[1])-math.log10(yr[0]))*(y1-y0)
    else: fy=lambda y:y1-(y-yr[0])/(yr[1]-yr[0])*(y1-y0)
    for v in (yt or []):
        d.line([(x0,fy(v)),(x1,fy(v))],fill=GRID); d.text((x0-8,fy(v)),(fmty or str)(v),font=F(18),fill=MUT,anchor='rm')
    for v in (xt or []):
        d.line([(fx(v),y0),(fx(v),y1)],fill=GRID); d.text((fx(v),y1+8),(fmtx or str)(v),font=F(18),fill=MUT,anchor='mt')
    d.rectangle(box,outline=(200,203,195)); 
    if yl: d.text((x0-70,(y0+y1)/2),yl,font=F(18),fill=MUT,anchor='mm')
    if xl: d.text(((x0+x1)/2,y1+34),xl,font=F(18),fill=MUT,anchor='mm')
    return fx,fy
def title(d,x,y,s,size=26): d.text((x,y),s,font=F(size),fill=INK)
def legend(d,x,y,items):
    for lab,col in items:
        d.rectangle([x,y,x+22,y+14],fill=col); d.text((x+30,y-3),lab,font=F(20),fill=INK); x+=40+d.textlength(lab,font=F(20))+20
# ==================== Fig 1: constantes harmônicas ====================
t2,t4=R[2]['table'],R[4]['table']
names=[n for n in dict.fromkeys(list(t2.name)+list(t4.name))]
def Hn(tb,n): r=tb[(tb.name==n)&(~tb.rejected)]; return float(r.H.iloc[0]) if len(r) else 0.0
sel=[n for n in names if max(Hn(t2,n),Hn(t4,n))>=1.2 and speed(n)>10]; sel.sort(key=speed)
W,H=2000,1500; im,d=canvas(W,H); title(d,40,24,'Constantes harmônicas — Bloco 02 (313 d, 26/02/2025–05/01/2026) × Bloco 04 (128 d, 24/03–31/07/2026)',30)
legend(d,40,76,[('Bloco 02',C[2]),('Bloco 04',C[4]),('contorno preto = constante inferida',(150,150,150))])
n=len(sel); x0,x1=110,W-40; bw=(x1-x0)/n
# painel A: H log
box=(x0,150,x1,560); fx,fy=axes(d,box,(0,n),(0.5,150),yt=[1,2,5,10,20,50,100],yl='H (cm)',log=True); d.text((x0,128),'A · Amplitude H (cm, escala logarítmica)',font=F(22),fill=INK)
for i,nm in enumerate(sel):
    for k,(b,off) in enumerate(((2,0.12),(4,0.52))):
        tb=R[b]['table']; r=tb[(tb.name==nm)&(~tb.rejected)]
        if len(r)==0: continue
        h=float(r.H.iloc[0]); xa=x0+(i+off)*bw; xb=xa+0.36*bw
        d.rectangle([xa,fy(h),xb,box[3]],fill=C[b]); 
        if bool(r.inferred.iloc[0]): d.rectangle([xa,fy(h),xb,box[3]],outline=INK)
        if h>=3: d.text(((xa+xb)/2,fy(h)-4),f'{h:.1f}',font=F(15),fill=INK,anchor='ms')
    d.text((x0+(i+0.5)*bw,box[3]+8),nm,font=F(16),fill=INK,anchor='mt')
# painel B: fase G
box=(x0,650,x1,1010); fx,fy=axes(d,box,(0,n),(0,360),yt=[0,90,180,270,360],yl='G (gr.)'); d.text((x0,628),'B · Atraso de fase G (graus, referido ao fuso −3 h)',font=F(22),fill=INK)
for i,nm in enumerate(sel):
    for b,off in ((2,0.3),(4,0.7)):
        tb=R[b]['table']; r=tb[(tb.name==nm)&(~tb.rejected)]
        if len(r)==0: continue
        g=float(r.G.iloc[0]); cx=x0+(i+off)*bw; cy=fy(g); d.ellipse([cx-8,cy-8,cx+8,cy+8],fill=C[b])
    d.text((x0+(i+0.5)*bw,box[3]+8),nm,font=F(16),fill=INK,anchor='mt')
# painel C: diferenças
box=(x0,1110,x1,1430); fx,fy=axes(d,box,(0,n),(-30,30),yt=[-30,-20,-10,0,10,20,30],yl='Δ (B04 − B02)'); d.text((x0,1088),'C · Diferença entre blocos: fase em graus (pontos pretos) e amplitude em % de B02 (barras cinza; limitada a ±30)',font=F(22),fill=INK)
for i,nm in enumerate(sel):
    h2,h4=Hn(t2,nm),Hn(t4,nm)
    if h2>0 and h4>0:
        dh=max(-30,min(30,(h4-h2)/h2*100)); xa=x0+(i+0.15)*bw; d.rectangle([xa,fy(max(dh,0)),xa+0.3*bw,fy(min(dh,0))],fill=(170,175,168))
        g2=float(t2[(t2.name==nm)&(~t2.rejected)].G.iloc[0]); g4=float(t4[(t4.name==nm)&(~t4.rejected)].G.iloc[0]); dg=((g4-g2+180)%360)-180; dg=max(-30,min(30,dg))
        cx=x0+(i+0.7)*bw; d.ellipse([cx-7,fy(dg)-7,cx+7,fy(dg)+7],fill=INK)
    d.text((x0+(i+0.5)*bw,box[3]+8),nm,font=F(16),fill=INK,anchor='mt')
im.save(BASE+'/figuras/1_constantes_harmonicas.png')
# ==================== Fig 2: NR ====================
W,H=1750,1100; im,d=canvas(W,H); title(d,40,24,'Nível de Redução (NR) pelo método do Alte Franco (1997) — NR = S0 − [M2 + S2 + N2 + K2]',28)
box=(130,130,W-40,H-110); fx,fy=axes(d,box,(0,5),(0,260),yt=list(range(0,261,25)),yl='cm')
bx={2:(330,520),4:(690,880)}
AN_=pickle.load(open('anual.pkl','rb'))
for b,(xa,xb) in bx.items():
    r=R[b]; tb=r['table']; s0=NR[b]['S0']; y=s0
    d.line([(xa-60,fy(s0)),(xb+60,fy(s0))],fill=INK,width=3); d.text((xa-66,fy(s0)),f'S0 = {s0:.1f}',font=F(22),fill=INK,anchor='rm')
    cols={'M2':(235,104,52),'S2':(240,160,100),'N2':(100,160,200),'K2':(150,200,150)}
    for nm in ('M2','S2','N2','K2'):
        h=float(tb[tb.name==nm].H.iloc[0]); d.rectangle([xa,fy(y),xb,fy(y-h)],fill=cols[nm],outline=BG); d.text(((xa+xb)/2,(fy(y)+fy(y-h))/2),f'{nm} {h:.1f}',font=F(20),fill=INK,anchor='mm'); y-=h
    d.line([(xa-60,fy(y)),(xb+60,fy(y))],fill=(180,40,40),width=4); d.text((xb+70,fy(y)+(18 if b==4 else 0)),f'NR = {y:.1f} cm',font=F(24),fill=(180,40,40),anchor='lm')
    d.text(((xa+xb)/2,box[3]+30),f'Bloco 0{b}  ·  {R[b]["N"]/24:.0f} dias',font=F(24),fill=INK,anchor='mm')
xa,xb=1170,1360; tb=R[2]['table']; s0=AN_['S0_anual']; y=s0
d.line([(xa-60,fy(s0)),(xb+60,fy(s0))],fill=INK,width=3); d.text((xa-66,fy(s0)),f'S0 anual = {s0:.1f}',font=F(22),fill=INK,anchor='rm')
cols={'M2':(235,104,52),'S2':(240,160,100),'N2':(100,160,200),'K2':(150,200,150)}
for nm in ('M2','S2','N2','K2'):
    h=float(tb[tb.name==nm].H.iloc[0]); d.rectangle([xa,fy(y),xb,fy(y-h)],fill=cols[nm],outline=BG); d.text(((xa+xb)/2,(fy(y)+fy(y-h))/2),f'{nm} {h:.1f}',font=F(20),fill=INK,anchor='mm'); y-=h
d.line([(xa-60,fy(y)),(xb+60,fy(y))],fill=(180,40,40),width=4); d.text((xb+70,fy(y)+22),f'NR = {y:.1f} cm',font=F(24),fill=(180,40,40),anchor='lm')
d.text(((xa+xb)/2,box[3]+30),'B02 + Sa/Ssa (S0 anual)',font=F(24),fill=INK,anchor='mm')
d.line([(box[0],fy(75)),(box[2],fy(75))],fill=(30,120,60),width=3); d.text((box[0]+10,fy(35)),'linha verde: NR adotado até aqui, 75 cm (RLS − 0,75 m)',font=F(22),fill=(30,120,60),anchor='lm'); d.text((box[0],box[1]-24),'altura em cm acima do zero da régua (RLS)',font=F(20),fill=MUT)
im.save(BASE+'/figuras/2_nivel_de_reducao.png')

# ==================== Fig 3: previsão × observado (janelas de 12 dias) ====================
def window(n,start_off_days,days=12):
    t,v=B[n]; i0=int(start_off_days*24); i1=min(len(t),i0+days*24); return slice(i0,i1)
wins=[(1,10,'Bloco 01 · nov–dez/2024 (independente)'),(2,150,'Bloco 02 · meio do período de B02 (ajuste de B02)'),(3,20,'Bloco 03 · jan–mar/2026 (independente)'),(4,60,'Bloco 04 · meio do período de B04 (ajuste de B04)')]
W,H=2000,1700; im,d=canvas(W,H); title(d,40,22,'Previsão × observado (horário, cm acima do zero da régua)',30); legend(d,40,70,[('Observado',C['obs']),('Previsão: constantes de B02',C[2]),('Previsão: constantes de B04',C[4]),('Previsão: B02 + Sa/Ssa',C[3])])
for k,(n,off,lab) in enumerate(wins):
    t,v=B[n]; sl=window(n,off); tt=t[sl]; vo=v[sl]; p2=PR[(n,2)][sl]; p4=PR[(n,4)][sl]; p3=PR[(n,3)][sl]
    y0=140+k*390; box=(120,y0,W-40,y0+300); xs=np.arange(len(tt)); lo=min(vo.min(),p2.min(),p4.min(),p3.min())-20; hi=max(vo.max(),p2.max(),p4.max(),p3.max())+20
    ytk=list(range(int(lo//50*50),int(hi)+1,50)); fx,fy=axes(d,box,(0,len(tt)),(lo,hi),xt=list(range(0,len(tt),24)),yt=[y for y in ytk if lo<=y<=hi],fmtx=lambda x:str(tt[min(int(x),len(tt)-1)])[5:10].replace('-','/')[3:5]+'/'+str(tt[min(int(x),len(tt)-1)])[5:7],yl='cm')
    d.text((box[0],y0-26),lab,font=F(22),fill=INK)
    for arr,col,w_ in ((p2,C[2],3),(p4,C[4],3),(p3,C[3],3),(vo,C['obs'],3)):
        pts=[(fx(i),fy(a)) for i,a in enumerate(arr)]; d.line(pts,fill=col,width=w_)
    e2=p2-vo; e4=p4-vo; e3=p3-vo
    d.text((box[2]-8,box[1]+8),f'RMSE  B02 {np.sqrt((e2**2).mean()):.1f} · B04 {np.sqrt((e4**2).mean()):.1f} · B02+Sa/Ssa {np.sqrt((e3**2).mean()):.1f} cm   (viés {e2.mean():+.1f} / {e4.mean():+.1f} / {e3.mean():+.1f})',font=F(20),fill=INK,anchor='ra')
im.save(BASE+'/figuras/3_previsao_vs_observado.png')
# ==================== Fig 4: métricas ====================
W,H=2000,1300; im,d=canvas(W,H); title(d,40,22,'Qual constante prevê melhor? Erros da previsão em cada conjunto de observações',30)
legend(d,40,70,[('Constantes de B02',C[2]),('Constantes de B04',C[4]),('B02 + Sa/Ssa',C[3])])
labs={1:'B01\nindep.',3:'B03\nindep.',2:'B02\n(ajuste B02)',4:'B04\n(ajuste B04)'}; order=[1,3,2,4]
def bars(box,key,ttl,yr,yt):
    fx,fy=axes(d,box,(0,4),yr,yt=yt,yl='cm'); d.text((box[0],box[1]-26),ttl,font=F(22),fill=INK)
    for i,n in enumerate(order):
        for m,off in ((2,0.04),(4,0.35),(3,0.66)):
            r=M[(M.bloco==n)&(M.modelo==m)].iloc[0]; h=float(r[key]); xa=box[0]+(i+off)*(box[2]-box[0])/4; xb=xa+0.29*(box[2]-box[0])/4
            d.rectangle([xa,fy(h),xb,box[3]],fill=C[m]); d.text(((xa+xb)/2,fy(h)-4),f'{h:.1f}',font=F(18),fill=INK,anchor='ms')
        d.text((box[0]+(i+0.5)*(box[2]-box[0])/4,box[3]+8),labs[n].split('\n')[0]+'  '+labs[n].split('\n')[1],font=F(18),fill=INK,anchor='mt')
bars((120,140,980,520),'rmse','A · RMSE total (inclui o erro do nível médio)',(0,70),[0,10,20,30,40,50,60,70])
bars((1100,140,1960,520),'rmse_nobias','B · RMSE sem o viés (só a forma da maré e o ruído não-harmônico)',(0,30),[0,5,10,15,20,25,30])
# dispersão previsto × observado em B03 (independente)
t,v=B[3]; box=(120,640,980,1220); fx,fy=axes(d,box,(0,420),(0,420),xt=[0,100,200,300,400],yt=[0,100,200,300,400],xl='observado (cm)  ·  eixo vertical: previsto (cm)',yl=''); d.text((box[0],box[1]-26),'C · Dispersão no Bloco 03 (independente)',font=F(22),fill=INK)
d.line([(fx(0),fy(0)),(fx(420),fy(420))],fill=(150,150,150),width=2)
for m in (2,4,3):
    p=PR[(3,m)]
    for a,b in zip(v[::2],p[::2]): d.ellipse([fx(a)-3,fy(b)-3,fx(a)+3,fy(b)+3],fill=C[m])
# histograma de erros (B01 sem viés não; usar B03 + B04/B02 cruzado)
box=(1100,640,1960,1220); d.text((box[0],box[1]-26),'D · Distribuição do erro (previsto − observado) em B03',font=F(22),fill=INK)
bins=np.arange(-80,81,5); mx=0; hs={}
for m in (2,4,3): e=PR[(3,m)]-v; h_,_=np.histogram(e,bins=bins); hs[m]=h_; mx=max(mx,h_.max())
fx,fy=axes(d,box,(-80,80),(0,mx*1.1),xt=list(range(-80,81,20)),yt=[0,50,100,150],xl='erro (cm)  ·  eixo vertical: nº de horas',yl='')
for m in (2,4,3):
    for j,c in enumerate(hs[m]):
        xa=fx(bins[j])+{2:1,4:7,3:13}[m]; xb=xa+5; d.rectangle([xa,fy(c),xb,box[3]],fill=C[m])
im.save(BASE+'/figuras/4_metricas_de_erro.png')
# ==================== Fig 5: resíduo diário no tempo ====================
W,H=2000,900; im,d=canvas(W,H); title(d,40,22,'Resíduo diário (observado − previsto, média de 24 h) em todos os blocos: nível médio e ruído não-harmônico',30)
legend(d,40,70,[('Constantes de B02',C[2]),('Constantes de B04',C[4]),('B02 + Sa/Ssa',C[3])])
box=(120,140,W-40,780); t0=B[1][0][0]; t1=B[4][0][-1]; span=(t1-t0).astype('timedelta64[D]').astype(int)
fx,fy=axes(d,box,(0,span),(-80,40),yt=[-80,-60,-40,-20,0,20,40],yl='cm')
for ym in pd.date_range('2024-12-01','2026-08-01',freq='2MS'):
    x=(np.datetime64(ym.date())-t0).astype('timedelta64[D]').astype(int); d.line([(fx(x),box[1]),(fx(x),box[3])],fill=GRID); d.text((fx(x),box[3]+8),ym.strftime('%m/%y'),font=F(18),fill=MUT,anchor='mt')
for n in (1,2,3,4):
    t,v=B[n]
    for m in (2,4,3):
        e=v-PR[(n,m)]; nd=len(e)//24; dm_=e[:nd*24].reshape(nd,24).mean(1); x0_=(t[0]-t0).astype('timedelta64[h]').astype(int)/24
        pts=[(fx(x0_+i+0.5),fy(a)) for i,a in enumerate(dm_)]; d.line(pts,fill=C[m],width=3)
d.text((box[0]+10,box[1]+8),'Valor positivo: a água observada ficou acima da prevista (nível médio maior, p.ex. cheia do rio).',font=F(20),fill=MUT)
im.save(BASE+'/figuras/5_residuo_diario.png')
print('figs ok')
