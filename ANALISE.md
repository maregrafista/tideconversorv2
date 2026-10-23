# Reanálise dos dados do TideConversor

Refeita em 23/10/2026 a partir de tudo o que a versão 1 publicou: 10 ajustes mensais, 970 eventos de defasagem, 1.411 extremos da tábua, 22 médias mensais e 643 médias diárias.

**Limite importante:** as leituras brutas dos marégrafos (XLSX Atalaia e arquivos Report) e o PDF da tábua não estão no repositório. Por isso **os coeficientes a e b não foram reajustados**; foram auditados. A regressão só pode ser refeita com os arquivos originais.

## 1. Calibração de alturas (T = a + b·R)

- Os RMSE mensais reproduzem os valores publicados: 1.003 pares, **RMSE 8,30 cm (tábua) e 7,94 cm (régua)**, ponderados por pares.
- Janeiro–julho isolados: 8,18 cm e 7,87 cm. Os meses cheios são estáveis.
- Agosto, setembro e outubro têm só 77, 61 e 51 pares (21, 16 e 14 dias), e 34, 39 e 23 eventos com resolução preferencial. A faixa calibrada de outubro (régua 0,83–3,46 m) é menor que a dos outros meses (até ≈4,2 m). O RMSE por semanas excluídas (outubro 11,3 cm) é otimista com tão poucas semanas.
- Os ajustes variam entre b = 1,016 e 1,073 e a = −0,83 e −0,50: há deriva sazonal real, então usar o ajuste do mês certo importa.
- **Mudança no app:** sinaliza meses com calibração parcial; mostra a faixa calibrada na barra e na reta; usa outubro como extrapolação (com aviso) em novembro e dezembro, em vez de recusar.

## 2. Defasagens de horário (observado em Fazendinha − previsto em Santana)

Janela ±2 dias, resolução preferencial:

| | n | média | mediana | DP | IC 95% da média |
|---|---|---|---|---|---|
| Sizígia, preamar | 130 | −18,9 min | −19,8 | 9,8 | ±1,7 |
| Quadratura, preamar | 115 | −15,9 min | −17,0 | 11,0 | ±2,0 |
| Sizígia, baixamar | 127 | +0,7 min | +1,0 | 5,8 | ±1,0 |
| Quadratura, baixamar | 122 | −2,2 min | −3,5 | 10,1 | ±1,8 |

- A preamar chega ≈ 16–19 min **antes** da previsão de Santana; a baixamar praticamente coincide.
- Sizígia × quadratura: diferença de −3,0 min na preamar (t ≈ −2,3) e +3,0 min na baixamar (t ≈ 2,8). Existe, mas é pequena perante o DP de 6–11 min; não é um efeito que mude uso prático.
- Janeiro–julho agrupados: PM −18,6 ± 8,5 min (n = 225); BM −1,4 ± 7,5 min (n = 223).
- A média mensal da preamar varia de −23 min (abril) a −12 min (julho), um padrão sazonal.
- **Outubro destoa:** PM +13,7 min e BM +19,2 min (n = 6 cada), contra ≈ −19 e ≈ −1 min no resto do ano. Há ainda 7 eventos com |defasagem| > 60 min, todos de agosto a outubro e quase todos fora da resolução preferencial. Isso é compatível com deslocamento de relógio do registrador ou amostra insuficiente, e não deve ser lido como mudança física. O app avisa nesses meses.
- Eventos de resolução ampliada têm média −15,0 min contra −8,5 min nos preferenciais, o que justifica manter o padrão em ≤20 min.
- **Mudança no app:** acrescenta mediana e IC 95% (distribuição t) a cada média, barras de IC no gráfico, marcador vazado com menos de 10 pares. O IC supõe eventos independentes; eventos de dias seguidos são correlacionados, então ele é otimista.

## 3. Série histórica

- Comparações out–dez de 2024 × 2025 reproduzidas: −30,2; −23,6; −23,1 cm.
- Nova comparação 2026 × 2025 (meses completos nos dois anos): abril −6,5; maio −5,7; junho −7,0 cm. Janeiro, fevereiro, março e julho foram excluídos por serem parciais em algum dos anos (janeiro/fevereiro de 2025 e março/julho de 2026).
- **Mudança no app:** cartões 2026 × 2025 e série diária sobreposta por dia do ano (antes os 643 dias estavam nos dados, mas sem uso).

## 4. Previsão

- 1.411 extremos, alternando PM/BM sem falha; intervalo de 4,3 a 8,4 h (média 6,2 h); alturas de 0,13 a 3,58 m, dentro das faixas calibradas.
- **Mudanças:** abre na data e hora atuais, mostra o próximo extremo, navegação por dia, vista de 7 dias e opção experimental de aplicar a defasagem média (por mês e tipo; meses com menos de 10 eventos usam a média de janeiro–julho). Sem validação independente, fica desligada por padrão.

## 5. O que ainda depende dos dados brutos

1. Reajuste dos coeficientes com intervalos de confiança (bootstrap por semana).
2. Verificar deslocamento de relógio de agosto a outubro.
3. Validar alturas intermediárias e a curva horária da previsão.
4. Calibrar novembro e dezembro quando houver pares.
