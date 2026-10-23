# TideConversor v2

Conversão sazonal entre a régua de Fazendinha e a tábua de Porto de Santana, com horários, série histórica e previsão. Setor de Hidrografia da UNIPILOT.

Versão 2 da [v1](https://maregrafista.github.io/hidrometria-zp1/tideconversor/). Aplicativo estático (HTML, CSS e JS sem dependências), funciona offline após a primeira visita.

## Novidades em relação à v1

- Arquivos separados e legíveis (a v1 era uma página de 390 KB com tudo embutido).
- Tema escuro automático, acessibilidade (teclado, ARIA, setas entre abas) e links diretos por aba (`#lunar`, `#history`, `#forecast`).
- **Alturas:** calibração local por data (em vez de mensal), botão para inverter o sentido, ajuste fino ±5 cm, RMSE junto ao resultado, barra com a faixa calibrada, reta de calibração, conversão em lote (CSV), copiar resultado, aviso quando a data excede o último par observado.
- **Horários:** mediana, IC 95% e barras de incerteza; avisos para meses com poucos pares.
- **Histórico:** comparação 2026 × 2025 e séries diárias sobrepostas.
- **Previsão:** data/hora atuais, próximo extremo, vista de 7 dias, defasagem média opcional.
- Reanálise completa com a série RLS de Fazendinha (jan/2026–out/2026) em [ANALISE.md](ANALISE.md); scripts em `analise/`.

## Equações

R = régua acima do zero; H = nível acima do NR; T = tábua de Santana (m). H = R − 0,75; T = a + bR; R = (T − a)/b, com a e b ajustados localmente no tempo (`data/calibracao_diaria.csv`; referência mensal em `data/calibracao_mensal.csv`). Validação por semanas excluídas: erro de 7,8 cm (T), validação temporal interna de 2026, não é intervalo de confiança.

## Estrutura

`index.html`, `styles.css`, `app.js`, `data/data.js` (dados derivados), `data/*.csv`, `analise/`, `sw.js`, `manifest.webmanifest`. A série bruta (21 MB) não é publicada; `data/pares_calibracao.csv` e `data/defasagens_eventos.csv` trazem os pares e eventos derivados.

## Aviso

Uso técnico e de apoio. Não substitui a Tábua de Marés oficial da DHN nem serve à navegação.

Fontes: dados locais fornecidos pelo usuário; tábua oficial de Porto de Santana 2026; fases lunares do U.S. Naval Observatory; logotipo UNIPILOT.
