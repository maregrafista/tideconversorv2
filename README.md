# TideConversor v2.2

Conversão entre a régua de Fazendinha e a tábua de Porto de Santana, horários, série histórica, **previsão harmônica com componentes anuais** e **comparação previsto × observado**. Setor de Hidrografia da UNIPILOT. Aplicativo estático (HTML, CSS e JS), funciona offline após a primeira visita.

## Novidades da v2.2 (23/10/2026)
- **Constantes do PACMARÉ:** a previsão de Fazendinha passou a usar as **113 constantes harmônicas geradas pelo PACMARÉ** para o bloco 02 (arquivos `AH_02` e `CH_B02`), incluindo Sa (21,6 cm) e Ssa (8,3 cm), no lugar das 57 do ajuste próprio. O erro caiu em todos os blocos (tabela abaixo). Quadro de marés, preamares/baixamares e curva previsto × observado foram recalculados. O NR foi alinhado às novas constantes: **66,3 cm** (era 66,7 cm).

## Novidades da v2.1
- **Previsão harmônica de Fazendinha** (aba Previsão): 57 constantes obtidas da série de 313 dias do bloco 02, com as componentes anuais **Sa (20,2 cm) e Ssa (8,6 cm)** (substituídas na v2.2 pelas do PACMARÉ); vale de 2024 a 2030. É a previsão que apresentou menos erros e a única usada para Fazendinha; para o Porto de Santana segue a tábua oficial.
- **Aba Previsto × observado:** uma janela de 3 a 30 dias (setas, data e 4 atalhos), com escala fixa que não muda de um período para outro. Mostra o resumo em linguagem direta (erro típico, tendência, 9 em cada 10 horas, horário da maré), o gráfico observado × previsto com as diferenças hora a hora, a tabela de preamares e baixamares previstas e observadas, o erro mês a mês e a exportação em CSV. Indica se o período foi usado no ajuste ou é teste independente.
- **NR de trabalho = 66,3 cm acima do zero da régua** (RLS − 0,663 m), pelo método do Alte Franco (1997) com o nível médio anual S0 = 229,7 cm: NR = 229,7 − (M2 + S2 + N2 + K2) = 229,7 − 163,4. Substitui o RLS − 0,75 m. Todos os níveis acima do NR, inclusive o histórico, foram recalculados.
- **Quadro de marés** de Fazendinha: preamar e baixamar média de sizígia e de quadratura, nível médio e estabelecimento do porto (4 h 16 min).

## Desempenho (previsto − observado, RMSE horário em cm)
| Período | ajuste próprio (57 const.) | PACMARÉ (113 const.) |
|---|---|---|
| B03 jan–mar/2026 (independente) | 12,1 | **10,1** |
| B04 mar–jul/2026 (independente) | 11,8 | **9,5** |
| B01 nov–dez/2024 (seca, independente) | 26,3 | **24,1** |
| B02 (ajuste) | 11,6 | **8,7** |

Com o nível médio S0 anual (229,7 cm). Preamar/baixamar: desvio-padrão da altura de cerca de 8 cm (antes 10 a 11 cm); erro de horário médio de baixamar próximo de 0 min. Sa e Ssa vêm de menos de dois ciclos anuais e refletem o regime do rio de 2025–2026; fora dele o nível médio pode mudar até ±30 cm. Comparação completa em `data/comparacao_meu_vs_pacmare_*.csv`.

## Equações
R = leitura da régua; H = nível acima do NR; T = tábua de Santana (m). H = R − 0,663; T = a + bR com a e b locais no tempo (`data/calibracao_diaria.csv`). Previsão: nível = S0 + Σ f·H·cos(V0 + u − GW).

## Documentação e dados
- [ANALISE_HARMONICA.md](ANALISE_HARMONICA.md): análise harmônica, NR, previsão e erros (com figuras e scripts em `analise/harmonica/`).
- [ANALISE.md](ANALISE.md): reanálise da calibração e das defasagens com a série RLS.
- `data/`: constantes (`constantes_B02.csv`, `constantes_Sa_Ssa.csv`), erros (`erro_mensal.csv`, `previsao_vs_observado_PM_BM_eventos.csv`), previsão de preamares e baixamares de nov–dez/2026 e as tabelas anteriores.

## Aviso
Uso técnico e de apoio. Não substitui a Tábua de Marés oficial da DHN nem serve à navegação. O método de análise reproduz o descrito no manual do PACMARÉ 2003 e foi conferido contra a saída do próprio programa em um caso; o algoritmo exato do ANHAMA (Franco, 2009, cap. 8) ainda não foi aplicado.
