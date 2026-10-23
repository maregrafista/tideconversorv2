# Análise harmônica, NR e previsão — Fazendinha (blocos 02 e 04)

> **Atualização v2.2 (23/10/2026):** o site passou a usar as 113 constantes geradas pelo PACMARÉ para o bloco 02 (`analise/pacmare/AH_02.txt`, `CH_B02.txt`). Comparadas com as 57 deste documento, elas reduziram o erro horário de 12,1→10,1 cm (B03), 11,8→9,5 cm (B04), 26,3→24,1 cm (B01) e 11,6→8,7 cm (B02, ajuste). Tabelas em `data/comparacao_meu_vs_pacmare_*.csv`. Desde então o NR de trabalho é 66,3 cm (229,7 − 163,4 com as constantes do PACMARÉ) e o site usa esse valor. O restante deste texto descreve a análise própria anterior.


Análise com o método do ANHAMA (frequência/FFT, seção 1). Dados: `FAZEND_B02.txt` (26/02/2025 a 05/01/2026, 7.510 h, 312,9 d) e `FAZEND_B04.txt` (24/03 a 31/07/2026, 3.082 h, 128,4 d). Alturas horárias em cm; para a análise foram devolvidas ao zero da régua (RLS = arquivo + 75 cm).

## 1. Método: reprodução do ANHAMA e conferência com a saída oficial
Pelo manual (cap. 1.1) o ANHAMA analisa **no domínio da frequência**: a série horária é interpolada com diferenças segundas, transformada por FFT de Cooley-Tukey, e as componentes são separadas por espécie (ciclos por dia) a partir das linhas de Fourier espaçadas de 360/T graus/h; entram as correções f e u, as constantes inferidas das componentes não resolvidas e o espectro de amplitudes residuais, que fixa a rejeição a 95 % (asterisco). É isso que `scripts/anhama.py` faz:

1. série de N horas → 2^k pontos por interpolação de diferenças segundas (B02: 7.510 h → 8.192 pontos; B04: 3.082 h → 4.096);
2. FFT; linhas de Fourier k·360/N;
3. por espécie, ajuste complexo por mínimos quadrados das componentes sobre as linhas da banda (com o núcleo espectral de cada componente, isto é, tratando o vazamento);
4. f e u de meio de série; constantes inferidas (P1, K2, T2, NU2…) por razão de amplitude de equilíbrio, retiradas do ajuste de forma iterativa;
5. espectro de resíduos por espécie; limiar de rejeição = amplitude de Rayleigh a 95 % do ruído da banda;
6. G = GW − fuso·v e K = GW − a·λ, como nas listagens do manual.

O algoritmo exato está no livro de Franco (2009, cap. 8), que não foi fornecido; por isso a reprodução foi **conferida contra o resultado do próprio PACMARÉ** com o seu `ODAS_REV1.txt` (saída `AHODAS1.txt`):

| Item | Aqui | PACMARÉ |
|---|---|---|
| nível médio | 191,12 | 191,06 |
| M2 H / GW | 110,46 / 359,7 | 110,39 / 359,69 |
| S2 H / GW | 24,42 / 21,6 | 24,47 / 22,23 |
| N2 H / GW | 22,28 / 328,6 | 22,56 / 328,17 |
| K1 H / GW | 9,49 / 313,5 | 9,53 / 312,97 |
| O1 H / GW | 8,72 / 273,3 | 8,71 / 273,18 |
| Q1 H / GW | 1,62 / 249,6 | 1,62 / 249,13 |
| M4 H / GW | 19,92 / 98,8 | 20,11 / 98,69 |
| P1 inferida H | 3,15 | 3,15 |
| K2 inferida H | 6,65 | 6,66 |
| T2 / NU2 / 2N2 inferidas H | 1,43 / 4,25 / 2,96 | 1,44 / 4,29 / 3,00 |
| resíduo na linha 30,196 °/h | 5,23 | 5,28 |
| resíduo na linha 29,804 °/h | 1,24 | 1,24 |
| limiares ±: espécies 1 / 2 / 7 / 8 | 1,45 / 4,18 / 0,46 / 0,99 | 1,40 / 3,72 / 0,45 / 1,07 |

**O que ainda não é idêntico:** (a) a fase das constantes pequenas que combinam S2 (MS4, 2MS6, 3MS8, MNS2, MU2, L2) difere de 13° a 26°, dentro das incertezas de fase que o PACMARÉ publica (20° a 40°); (b) a regra de fase das inferidas 2N2 e LAMBDA2 (aqui, mesma fase da referência) difere da do PACMARÉ; (c) o conjunto exato de componentes por espécie (as ~180 do programa) foi aproximado pela seleção de Rayleigh. **Não é possível garantir igualdade bit a bit sem o texto do livro.** Os componentes principais coincidem em décimos de cm e ≈ 0,5° de fase.

## 2. Constantes harmônicas (ver `tabelas/` e `analise/harmonica/figuras/1_…`)
| Componente | B02 H (cm) | B02 G (°) | B04 H (cm) | B04 G (°) |
|---|---|---|---|---|
| O1 | 4,95 | 342,5 | 4,09 | 346,8 |
| K1 | 6,75 | 8,1 | 6,77 | 5,8 |
| N2 | 20,17 | 90,2 | 21,05 | 91,7 |
| **M2** | **110,94** | 118,1 | **112,38** | 119,8 |
| **S2** | **24,64** | 150,2 | **24,54** | 149,3 |
| K2 | 7,28 | 145,3 | 6,68 (inferida) | 149,1 |
| L2 | 9,23 | 154,2 | 11,67 | 145,8 |
| MU2 | 6,87 | 298,4 | 7,53 | 305,3 |
| MO3 | 2,94 | 46,6 | 2,61 | 51,6 |
| MN4 | 8,16 | 136,4 | 8,70 | 140,3 |
| M4 | 21,45 | 163,6 | 22,78 | 167,3 |
| MS4 | 9,59 | 197,3 | 8,68 | 197,3 |
| M6 | 3,86 | 165,3 | 4,60 | 183,4 |

- Constantes arquivadas (não rejeitadas, incluindo inferidas): B02 = 55 (4 inferidas), B04 = 46 (13 inferidas); resíduo (desvio-padrão) de 20,8 e 16,3 cm; nível médio 231,20 e 239,79 cm.
- M2 e S2 concordam em 1,3 % e 0,4 % entre os blocos; as fases em ≤ 1,7°. As diferenças maiores estão em componentes que o bloco de 128 dias não separa (2N2, P1, NU2, Q1).
- A maré é **semidiurna pura**: F de Courtier = (K1 + O1)/(M2 + S2) = 0,085 (B02) e 0,079 (B04).

## 3. Nível de Redução (método do Alte Franco, 1997, igual à planilha `Calculo do NR - ODAS_REV1.xls`)
NR = S0 − [H(M2) + H(S2) + H(N2) + H(K2)], em cm acima do zero da régua.

| | B02 | B04 |
|---|---|---|
| S0 (nível médio do período de coleta) | 231,20 | 239,79 |
| M2 + S2 + N2 + K2 | 110,94 + 24,64 + 20,17 + 7,28 = 163,03 | 112,38 + 24,54 + 21,05 + 6,68 = 164,65 |
| **NR** | **68,2 cm** | **75,1 cm** |

A diferença de 7 cm vem quase toda do S0: o de B04 (março a julho, rio alto) é maior que o de B02, que cobre quase um ano. O resíduo diário (figura 5) mostra o nível médio oscilando de −60 a +40 cm. A fórmula pede o **S0 do período padrão (nível médio da carta)**, que não existe para esta estação; foi usado o do próprio bloco. O NR de 75 cm adotado antes coincide com o de B04.

## 4. Previsão × observado (`analise/harmonica/figuras/3_…`, `4_…`, `5_…`)
Previsão = nível médio do próprio bloco + Σ f·H·cos(V0 + u − GW), com as constantes não rejeitadas e as inferidas.

| Conjunto observado | Tipo | RMSE B02 | RMSE B04 | RMSE sem viés B02 | RMSE sem viés B04 |
|---|---|---|---|---|---|
| B01 (nov–dez/2024) | independente | 52,0 | 63,9 | 13,8 | 18,8 |
| B03 (jan–mar/2026) | independente | 17,6 | 23,7 | 16,8 | 23,5 |
| B02 | ajuste de B02 | 20,8 | 26,0 | 20,8 | 24,4 |
| B04 | ajuste de B04 | 15,7 | 16,3 | 13,0 | 16,3 |

Preamares e baixamares (B01 e B03, independentes): erro médio de horário **13,0 min (B02) × 16,9 min (B04)**; dispersão da altura 14,4 × 17,9 cm.

**Conclusão: as constantes do bloco 02 ficaram mais próximas do real**, em todos os conjuntos, inclusive no período do próprio B04 (15,7 contra 16,3 cm; sem o viés, 13,0 contra 16,3). Motivos: série de 313 dias contra 128; separa P1/K1, K2/S2 e MU2/2N2 sem inferir; cobre o ciclo anual.

Limites: o erro é dominado pelo **nível médio não-harmônico** (rio e clima). Em nov–dez/2024 a água ficou ≈ 50 cm abaixo do previsto (seca), com RMSE de 52 a 64 cm apesar de a forma da maré estar correta (13,8 cm sem o viés).

## 5. Arquivos
- `analise/harmonica/figuras/` 1 constantes, 2 NR, 3 previsão × observado, 4 métricas, 5 resíduo diário.
- `tabelas/` constantes completas por bloco, métricas gerais e de preamar/baixamar.
- `arquivos_pacmare/AHFAZEND_B02.txt`, `AHFAZEND_B04.txt` (listagem da análise no estilo do manual) e `CHFAZEND_B02.txt`, `CHFAZEND_B04.txt` (constantes para o programa PREVISÃO, no formato de `CHREV1ODAS.txt`, G em fase de fuso, nível médio em cm).
- `scripts/` código da análise.

Observações sobre os arquivos CH: usam o índice de componentes do PACMARÉ que consta do seu `CHREV1ODAS.txt`; constantes cujo índice não é conhecido (SIGMA1, PI1, PSI1, M3 em B02; SIGMA1, RO1, QUI1, PSI1, FI1, TETA1 em B04) foram deixadas de fora; são componentes pequenas. O nível médio gravado é o do bloco, e não o da carta náutica. Não foram testados dentro do PACMARÉ.

## 6. Conferência com Parker (2007), NOAA CO-OPS 3 *Tidal Analysis and Prediction*
- **Razões de inferência:** a Tabela A.1 (potencial de Cartwright) dá P1/K1 = 0,17543/0,53011 = 0,331, K2/S2 = 0,11498/0,42248 = 0,272, T2/S2 = 0,0586 e ν2/N2 = 0,19; são as razões usadas aqui.
- **Resolução:** os períodos sinódicos da tabela confirmam a seleção por Rayleigh: P1/K1 e K2/S2 exigem 182,6 dias, ν2/N2 e ρ1/Q1 205,9 dias, T2/S2 365,3 dias. O bloco 02 (313 d) separa os dois primeiros pares, mas não T2/S2; o bloco 04 (128 d) não separa nenhum desses pares, por isso P1, K2, NU2 e RO1 ficam inferidas.
- O livro (seções 3.4.4 e 4.2.4) descreve a análise de Fourier de Schureman e a inferência com correção de Godin/Foreman; **não traz o algoritmo do ANHAMA**, que está em Franco (2009).

## 7. Melhorias testadas enquanto o capítulo 8 do Franco não chega
**7.1 Correção de Godin/Foreman para as inferidas (Parker, seção 4.2.4).** Testada no ODAS contra o resultado oficial:

| | PACMARÉ | inferência iterativa (usada aqui) | sem correção | Foreman |
|---|---|---|---|---|
| K1 (H, cm) | 9,53 | 9,49 | 10,37 | 9,77 |
| S2 (H, cm) | 24,47 | 24,42 | 23,96 | 22,81 |

A fórmula de Foreman supõe que a diferença de frequência é muito menor que 1/T; com 1.836 h isso não vale (Δf·T ≈ 150°). A retirada iterativa das inferidas, que usa o núcleo espectral exato, fica a ≤ 0,05 cm do PACMARÉ e foi mantida.

**7.2 Componentes anuais Sa e Ssa (Parker, seção 3.7).** O resíduo dos blocos mostra o nível médio variando de +22 cm (abril) a −30 cm (novembro), um ciclo hidrológico anual. Sa e Ssa foram ajustadas ao resíduo horário de B02 + B04 (441 dias cobrindo todas as épocas do ano); B01 e B03 ficaram fora do ajuste, para teste independente. O bloco 02 sozinho (313 d) não separa Sa/Ssa, por isso só se obtém com os dois blocos, e **são constantes de natureza hidrológica, não astronômica**.

| Constante | H (cm) | G (°) | GW (°) |
|---|---|---|---|
| Sa (0,0410686 °/h) | 20,22 | 50,48 | 50,60 |
| Ssa (0,0821373 °/h) | 8,58 | 337,64 | 337,89 |

Nível médio anual do conjunto: **S0 = 229,7 cm** (o ajuste anula o viés sazonal que separava os S0 de B02 e B04).

| Conjunto | RMSE B02 | RMSE B04 | **RMSE B02 + Sa/Ssa** |
|---|---|---|---|
| B01 (independente, seca 2024) | 52,0 | 63,9 | **26,2** |
| B03 (independente) | 17,7 | 23,7 | **12,1** |
| B02 (ajuste) | 20,8 | 26,0 | 11,6 |
| B04 (ajuste) | 15,7 | 16,3 | 11,9 |

Em B03, preamares e baixamares: dispersão da altura 15,5/16,6 cm (B02) → **9,7/11,0 cm** (B02 + Sa/Ssa); o erro de horário não muda (≈ 13 min), pois Sa/Ssa só mexem na altura. Validação cruzada: ajustar só em B02 e testar em B04 reduz o erro diário de 12,7 para 8,7 cm; ajustar só em B04 e testar em B02 piora (56,8 cm), porque 4 meses não definem um ciclo anual.

**Cautelas.** Há menos de dois ciclos anuais; o ano de 2024 foi anômalo (seca): mesmo com Sa/Ssa o erro em B01 é 26 cm; as constantes só valem enquanto o regime do rio se parecer com 2025–26. O PACMARÉ só analisa Sa/Ssa com séries ≥ 1 ano (LONGSERIE/ANHAREF); aqui foram obtidas à parte, por mínimos quadrados.

**7.3 NR com o S0 anual.** NR = 229,7 − [M2 + S2 + N2 + K2]:

| Amplitudes de | NR |
|---|---|
| B02 (163,0 cm) | **66,7 cm** |
| B04 (164,7 cm) | **65,0 cm** |

Com S0 do próprio bloco o NR era 68,2 (B02) e 75,1 (B04). Usando um S0 que não depende da estação do ano, os dois blocos concordam em 65–67 cm, e o 75 cm adotado antes fica ≈ 8–10 cm acima.

## 8. Decisão
Em 23/10/2026 adotou-se como **valor de trabalho NR = 66,7 cm acima do zero da régua** (S0 anual de 229,7 cm menos M2 + S2 + N2 + K2 de B02), equivalente a RLS − 0,667 m. O valor de 75 cm (RLS − 0,75 m) deixa de ser o de trabalho. Pendências: confirmar o S0 com o nível médio da carta, se existir, e refazer com o capítulo 8 do Franco.

## 9. Bloco 02 consolidado (o mais longo, 313 dias) — quadro de marés e erros
Quadro de marés pelo modelo da planilha `Calculo do NR` (semidiurna pura), com NR de trabalho de 66,7 cm. Zo = M2 + S2 + N2 + K2 = 163,0 cm acima do NR (é o nível médio acima do NR).

| Nível | Acima do NR (cm) | Acima do zero da régua (cm) |
|---|---|---|
| Preamar média de sizígia (MHWS) | 298,6 | 365,3 |
| Preamar média de quadratura (MHWN) | 249,3 | 316,0 |
| Nível médio (Zo) | 163,0 | 229,7 |
| Baixamar média de quadratura (MLWN) | 76,7 | 143,4 |
| Baixamar média de sizígia (MLWS) | 27,5 | 94,1 |

Estabelecimento do porto (HWF&C) pela planilha: d = G(S2) − G(M2) = 32,05°, e = 5,66°, HWF&C = (e + G(M2))/28,984 = **4 h 16 min**. Classificação de Courtier F = 0,085: semidiurna pura.

Erros da previsão (ver `analise/harmonica/figuras/6_…`, `data/erro_mensal.csv` e `data/previsao_vs_observado_PM_BM_eventos.csv`; previsto − observado):

| Preamares e baixamares (todas as observações, n ≈ 1.044 de cada tipo) | B02 | B02 + Sa/Ssa |
|---|---|---|
| Erro de horário PM / BM (médio) | +9,0 / −6,3 min | +8,9 / −6,3 min |
| Erro absoluto de horário PM / BM | 11,0 / 12,2 min | 11,0 / 12,2 min |
| Erro de altura PM, média ± dp | −0,9 ± 24,5 cm | +0,1 ± 13,0 cm |
| Erro de altura BM, média ± dp | +1,6 ± 21,5 cm | +2,7 ± 11,8 cm |

O erro de horário é sistemático: a previsão atrasa a preamar em 9 min e adianta a baixamar em 6 min, e não melhora com Sa/Ssa. A previsão de extremos de nov–dez/2026 com B02 + Sa/Ssa está em `data/previsao_PM_BM_nov_dez_2026.csv` (alturas acima do NR de 66,3 cm).
