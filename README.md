# TideConversor v2.1

Conversão entre a régua de Fazendinha e a tábua de Porto de Santana, horários, série histórica, **previsão harmônica com componentes anuais** e **comparação previsto × observado**. Setor de Hidrografia da UNIPILOT. Aplicativo estático (HTML, CSS e JS), funciona offline após a primeira visita.

## Novidades da v2.1 (23/10/2026)
- **Previsão harmônica de Fazendinha** (aba Previsão): 57 constantes obtidas da série de 313 dias do bloco 02, com as componentes anuais **Sa (20,2 cm) e Ssa (8,6 cm)**; vale de 2024 a 2030. O método da tábua de Santana convertida continua disponível.
- **Aba Previsto × observado:** 16.154 horas observadas na régua (nov/2024 a out/2026) contra as previsões, com gráfico de erro, zoom por arraste, tabela de erros do trecho visível (viés, RMSE, EAM, P95, r), dispersão, histograma e exportação em CSV.
- **NR de trabalho = 66,7 cm acima do zero da régua** (RLS − 0,667 m), pelo método do Alte Franco (1997) com o nível médio anual S0 = 229,7 cm: NR = 229,7 − (M2 + S2 + N2 + K2) = 229,7 − 163,0. Substitui o RLS − 0,75 m. Todos os níveis acima do NR, inclusive o histórico, foram recalculados.
- **Quadro de marés** de Fazendinha: preamar e baixamar média de sizígia e de quadratura, nível médio e estabelecimento do porto (4 h 16 min).

## Desempenho (previsto − observado, RMSE horário em cm)
| Período | só marés | com Sa/Ssa |
|---|---|---|
| B03 jan–mar/2026 (independente) | 17,7 | **12,1** |
| B01 nov–dez/2024 (seca, independente) | 52,0 | **26,2** |
| B02 (ajuste) | 20,8 | 11,6 |
| B04 (ajuste) | 15,7 | 11,9 |

Erro de horário de preamar/baixamar: +9 / −6 min em média (erro absoluto ≈ 11 a 12 min). Sa e Ssa vêm de menos de dois ciclos anuais e refletem o regime do rio de 2025–2026; fora dele o nível médio pode mudar até ±30 cm.

## Equações
R = leitura da régua; H = nível acima do NR; T = tábua de Santana (m). H = R − 0,667; T = a + bR com a e b locais no tempo (`data/calibracao_diaria.csv`). Previsão: nível = S0 + Σ f·H·cos(V0 + u − GW).

## Documentação e dados
- [ANALISE_HARMONICA.md](ANALISE_HARMONICA.md): análise harmônica, NR, previsão e erros (com figuras e scripts em `analise/harmonica/`).
- [ANALISE.md](ANALISE.md): reanálise da calibração e das defasagens com a série RLS.
- `data/`: constantes (`constantes_B02.csv`, `constantes_Sa_Ssa.csv`), erros (`erro_mensal.csv`, `previsao_vs_observado_PM_BM_eventos.csv`), previsão de preamares e baixamares de nov–dez/2026 e as tabelas anteriores.

## Aviso
Uso técnico e de apoio. Não substitui a Tábua de Marés oficial da DHN nem serve à navegação. O método de análise reproduz o descrito no manual do PACMARÉ 2003 e foi conferido contra a saída do próprio programa em um caso; o algoritmo exato do ANHAMA (Franco, 2009, cap. 8) ainda não foi aplicado.
