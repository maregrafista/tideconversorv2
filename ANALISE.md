# Reanálise completa a partir da série RLS de Fazendinha

Dados: `atalaia-fazendinha-rls.xls` (tabela HTML com data/hora Brasil e RLS, em metros acima do zero da régua), 185.773 leituras de 07/11/2024 18:45 a 23/10/2026 08:50. Tábua: os 1.411 extremos de Santana 2026 já embutidos na v1 (o PDF original não foi fornecido). Fases lunares: USNO, como na v1. Todo o processamento foi refeito do zero (scripts em `analise/`).

## 1. Qualidade da série

- RLS = leitura da régua (R): as médias diárias coincidem com as da v1 (diferença mediana 0,0 cm em 602 dias comuns).
- Amostragem de 5 min até 10/08/2026. **A partir de 11/08/2026 o registrador passa a gravar de forma irregular** (mediana 15 min em outubro, p90 de 60 min). Antes disso houve lacunas de 24 h (17–18/01/2025, 03–04/02/2025, 18–19/02/2025, 23–24/03/2026), de 48 h (31/07–02/08/2026) e de 221 h (02–11/08/2026), e uma lacuna de 23 dias (16/09 a 09/10/2026).
- 22 pontos espúrios removidos (desvio > 0,35 m da mediana móvel em trechos regulares), entre eles os de 05–06/01/2026 (saltos de ±1,7 m) e 09/06/2026 10:30.
- A série da v1 (XLSX + Reports) marcava os extremos até 13/07/2026 cerca de uma amostra (5 min) antes desta; depois de 14/07 as fontes coincidem. A origem desse deslocamento de relógio não pode ser decidida só com os dados.

## 2. Extremos e pares

- 2.640 extremos observados (oscilação mínima de 0,50 m, horário no centro do patamar), 1.001 pares um a um com a tábua (distância máxima 180 min). A recontagem reproduz a v1: 966 dos 970 eventos coincidem.
- **Teste de decimação** (dias de 5 min reduzidos a amostras irregulares): a altura no horário oficial por interpolação linear tem erro de 0,4 cm (intervalo ≤20 min), 1,2 cm (20–40), 3,0 cm (40–65) e 11 cm acima de 65 min (3,1 cm com ajuste quadrático local). A v1 exigia ≤20 min; basta ≤40 min (linear) ou ≤90 min com ajuste quadrático. Resultado: 972 pares de calibração (agosto 72, setembro 59, outubro 32; a v1 usava só os pares densos nesses meses).
- O horário do extremo em dados esparsos: ajuste parabólico erra ≈ 10,6 min (RMS) contra 18,8 min pela amostra mais alta.

## 3. Calibração de alturas

Método da v1 reproduzido (T da tábua contra R lida no horário oficial do extremo): coeficientes de janeiro a julho coincidem com a v1 em ±0,003 (a) e ±0,004 (b).

**Erro por semanas excluídas** (validação cruzada, todos os pares, RMSE em cm):

| modelo | RMSE | ago–out |
|---|---|---|
| uma reta para o ano | 11,8 | 20,0 |
| reta + efeito PM/BM | 11,4 | 18,5 |
| 1 harmônico anual | 9,2 | 10,5 |
| 2 harmônicos anuais | 7,85 | 7,6 |
| **mensal (v1)** | **8,10** | 7,7 |
| local, σ = 7 / 10 / **15** / 20 dias | 7,85 / 7,82 / **7,80** / 7,84 | ≈ 8,0 |
| local, R no pico observado | 7,70 | – |

- Os ajustes mensais da v1 são adequados (8,1 cm; v1 publicava 8,30 com menos pares). O ajuste **local no tempo (σ = 15 d)** tem erro igual (7,8 cm), sem degraus na virada do mês e com extrapolação mais estável. É o que o app usa agora.
- Referenciar a altura ao pico observado em vez do horário oficial quase não reduz o erro (7,7 cm): o espalhamento de ≈ 8 cm vem da diferença entre a tábua de Santana e o nível real em Fazendinha (vazão do rio, meteorologia, tábua harmônica), não do descompasso de horário.
- Regredir R sobre T diretamente (7,7 cm) e inverter a reta T~R (7,8 cm) dão o mesmo erro; a conversão pode ser invertida sem perda.
- Resíduos: PM +0,3 cm, BM −0,2 cm; por terço de altura +1,9 / −2,4 / +0,8 cm (estrutura pequena); autocorrelação 0,30 entre pares consecutivos (os intervalos de confiança sem bootstrap por semana seriam otimistas).
- Coeficientes mensais com IC 95% (reamostragem de semanas), em `data/calibracao_mensal.csv`. Ex.: junho b = 1,023 [1,004–1,037]; outubro a = −0,459 [−0,489 a −0,438].
- Deriva sazonal: a varia de −0,83 (março) a −0,46 (outubro), b de 1,014 (maio) a 1,068 (agosto).
- Depois de 23/10/2026 não há pares: repete-se a calibração mais recente e o app avisa.

## 4. Defasagens de horário (observado − tábua de Santana)

Janela ±2 dias, resolução preferencial (lacuna ≤20 min, patamar ≤40 min); IC 95% da média:

| | n | média | mediana | DP | IC |
|---|---|---|---|---|---|
| Sizígia, PM | 93 | −17,5 | −17,0 | 11,1 | ±2,3 |
| Quadratura, PM | 74 | −15,6 | −16,0 | 9,7 | ±2,2 |
| Sizígia, BM | 94 | +3,7 | +3,5 | 6,8 | ±1,4 |
| Quadratura, BM | 73 | −3,5 | −1,0 | 11,8 | ±2,7 |

- Jan–jul (5 min): PM −15,3 ± 9,4 min (n = 264); BM +0,4 ± 9,4 min (n = 277).
- Sizígia × quadratura: PM −1,9 min (t = −1,2, **não significativo**; a v1 indicava significância); BM +7,1 min (t = 4,6, **significativo**: a baixamar de sizígia atrasa cerca de 7 min em relação à de quadratura).
- Variação sazonal da preamar: de −10 (janeiro) e −11 (julho) a −22 min (abril e maio).
- **A anomalia de outubro da v1 (+14/+19 min) desapareceu**: vinha de 6 eventos com amostragem esparsa; agora, em ago–out, os eventos de resolução preferencial são 45 e as médias (PM −14,5; BM +1,8) não diferem de jan–jul dado o DP de 14–19 min. Com amostragem de 15–60 min o horário é incerto; use o modo ampliado com cautela.
- 943 dos 1.001 pares têm suporte de até 65 min (586 preferenciais). Os 58 restantes (intervalos > 65 min) são excluídos.

## 5. Série histórica

- Médias diárias por trapézios, exigindo cobertura de 24 h e maior intervalo ≤65 min (≥260 amostras e ≤60 min nos dias de 5 min, como na v1). Em teste de decimação o erro da média diária foi de ≈ 0,1 cm. Isso recupera 63 dias de 14/07 a 22/10/2026 e fecha out–dez/2024 com 31, 30 e 30 dias.
- Out–dez de 2024 × 2025: −30,2; −23,6; −22,9 cm (dezembro de 2024 com 30/31 dias). Pré-07/11/2024 usa os dados da v1 (esta série começa em 07/11).
- 2026 × 2025 em meses completos: abril −6,5; maio −5,7; junho −6,9 cm.

## 6. O que continua em aberto

1. O deslocamento de ≈ 5 min entre a v1 e esta série até 13/07/2026 e o verdadeiro referencial de relógio.
2. Nivelamento independente da régua (o NR de 0,75 m é premissa).
3. Tábua oficial em PDF: os extremos usados são os da v1; qualquer correção na tábua exige reprocessar.
4. Novembro/dezembro: sem pares. Recalibrar quando houver dados.
5. Validação das alturas intermediárias e da curva horária de Previsão com um segundo ano.
