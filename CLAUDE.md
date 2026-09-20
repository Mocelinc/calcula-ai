# Calcula.AI

Calculadora de custos e precificação para impressão 3D. HTML, CSS e JavaScript puros,
sem build e sem framework. A única dependência externa é o Chart.js por CDN. Tudo roda
no navegador e o estado mora no `localStorage`.

## Onde mexer

Abra só o arquivo da linha correspondente — cada um é autossuficiente.

| Se a tarefa é sobre | Abra |
| --- | --- |
| Fórmula de custo, preço, lote, formatação de moeda | `js/calculator.js` (puro, sem DOM) |
| Salvar, ler, exportar e importar dados | `js/storage.js` |
| Catálogo de temas e troca de tema | `js/theme.js` + `css/themes.css` |
| Gráfico de rosca da composição do custo | `js/chart.js` |
| Cache de elementos, navegação entre telas, `UI.recalc()` | `js/ui/core.js` |
| Tela Calculadora: tempo, markup, risco, quantidade, lote | `js/ui/calc.js` |
| Painel de resultados, detalhamento, copiar orçamento | `js/ui/result.js` |
| Filamentos usados na peça (linhas multi-material) | `js/ui/material-rows.js` |
| Tela Impressoras | `js/ui/printers.js` |
| Tela Filamentos | `js/ui/filaments.js` |
| Tela Ajustes e backup `.json` | `js/ui/settings.js` |
| Marcação das quatro telas | `index.html` |
| Barra lateral, marca e área de conteúdo | `css/layout.css` |
| Cards, formulários e botões | `css/components.css` |
| Visual da calculadora e do painel de resultados | `css/calc.css` |
| Visual das telas de lista e de ajustes | `css/lists.css` |

## Regras da casa

- **Sem build.** Arquivo novo precisa ser declarado no `index.html` como `<script defer>` ou
  `<link>`, e a **ordem importa**: o CSS segue a cascata original e os módulos de `ui/`
  dependem de `ui/core.js` ter rodado antes.
- **Os módulos de `ui/` conversam só pela fachada `UI`.** Nenhum deles chama função interna
  de outro. Para recalcular, `UI.recalc()`. Para trocar de tela, `UI.showView()`. Para avisar
  a pessoa, `UI.flash()`.
- **Cor sempre por variável** de `css/themes.css` (`var(--primary)`, `var(--text)`…). Hex solto
  no CSS quebra sete dos oito temas.
- **Regra de negócio não mora na interface.** Conta nova entra em `js/calculator.js`, que não
  toca no DOM e é o que um dia vira endpoint.
- **Texto em português do Brasil**, direto, sem jargão técnico na tela.
- A marca está em `docs/marca/`, em SVG com `currentColor`, e o traço do `.AI` usa
  `var(--primary)`.

## Para onde isso vai

A ideia é migrar o back para FastAPI e o front para Ionic. A separação atual já prepara
o caminho: `js/calculator.js` é lógica pura e vira serviço do back; `js/storage.js` é a
única porta de dados e vira o cliente HTTP; cada arquivo de `js/ui/` corresponde a uma
tela e vira um componente. Mexa em uma seção por vez.
