# Calcula.AI

Calculadora de custos e precificação de impressão 3D — 100% front-end, sem back-end.

🔗 **Demo:** `https://mocelinc.github.io/calcula-ai/`

## Funcionalidades

- Cálculo em tempo real (filamento, energia, depreciação da máquina, mão de obra, embalagem, taxa de falha)
- Perfis salvos de Máquina e Material
- Markup rápido ou personalizado + "Preço Marketeiro" (arredondamento estratégico, ex.: R$43,20 → R$44,90)
- Simulador de quantidade de peças
- Gráfico de rosca com a composição do custo (Chart.js)
- 4 temas: Dark/Dracula, Dark/Nord, Light/Minimalista, Light/Ocean
- Botão "Copiar Orçamento" (texto pronto para WhatsApp)
- Backup dos dados via exportação/importação `.json`

## Rodando localmente

Abra o `index.html` diretamente no navegador, ou sirva com:

```bash
npx serve .
```

## Publicando no GitHub Pages

`Settings` → `Pages` → Source: **Deploy from a branch** → Branch: **main** / **/(root)** → Save.

## Privacidade

Nenhum dado sai do seu navegador — tudo é salvo localmente via `localStorage`.
