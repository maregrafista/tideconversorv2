# TideConversor v2

Conversão sazonal entre a régua de Fazendinha e a tábua de Porto de Santana, com horários, série histórica e previsão. Setor de Hidrografia da UNIPILOT.

Versão 2 da [v1](https://maregrafista.github.io/hidrometria-zp1/tideconversor/). Aplicativo estático (HTML, CSS e JS sem dependências), funciona offline após a primeira visita.

## Novidades em relação à v1

- Arquivos separados e legíveis (a v1 era uma página de 390 KB com tudo embutido).
- Tema escuro automático, acessibilidade (teclado, ARIA, setas entre abas) e links diretos por aba (`#lunar`, `#history`, `#forecast`).
- **Alturas:** mês atual por padrão, botão para inverter o sentido, ajuste fino ±5 cm, RMSE junto ao resultado, barra com a faixa calibrada, reta de calibração, conversão em lote (CSV), copiar resultado, novembro/dezembro com aviso de extrapolação.
- **Horários:** mediana, IC 95% e barras de incerteza; avisos para meses com poucos pares.
- **Histórico:** comparação 2026 × 2025 e séries diárias sobrepostas.
- **Previsão:** data/hora atuais, próximo extremo, vista de 7 dias, defasagem média opcional.
- Reanálise completa em [ANALISE.md](ANALISE.md).

## Equações

R = régua acima do zero; H = nível acima do NR; T = tábua de Santana (m). H = R − 0,75; T = a + bR; R = (T − a)/b, com a e b mensais (`data/calibracao_mensal.csv`). Validação por semanas excluídas: RMSE 8,30 cm (T) e 7,94 cm (R); validação temporal interna de 2026, não é intervalo de confiança.

## Estrutura

`index.html`, `styles.css`, `app.js`, `data/data.js` (dados derivados), `data/*.csv`, `sw.js`, `manifest.webmanifest`. Os arquivos brutos de calibração não são publicados.

## Aviso

Uso técnico e de apoio. Não substitui a Tábua de Marés oficial da DHN nem serve à navegação.

Fontes: dados locais fornecidos pelo usuário; tábua oficial de Porto de Santana 2026; fases lunares do U.S. Naval Observatory; logotipo UNIPILOT.
