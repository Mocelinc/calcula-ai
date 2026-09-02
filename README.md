# Calcula.AI

Calculadora profissional de custos e precificação de impressão 3D — **100% front-end, sem back-end**, otimizada para uso em **Desktop**.

🔗 **Demo (após publicar no GitHub Pages):** `https://mocelinc.github.io/calcula-ai/`

## ✨ Funcionalidades

- **Dashboard de tela dividida**: controles à esquerda, resultados em tempo real à direita (sem botão "Calcular" — tudo atualiza ao digitar).
- **Cálculo completo de custo**: filamento, energia (kWh), depreciação da máquina, mão de obra, embalagem, taxa de falha e custos extras.
- **Perfis salvos**: crie, edite e exclua múltiplos perfis de **Máquina** e **Material** (ex.: "PLA Genérico R$90", "PETG Premium R$150").
- **Margem de lucro flexível**: markup rápido (+50% / +75% / +100% / +200%) ou personalizado.
- **Preço Marketeiro**: arredonda o valor final para finais estratégicos de venda (ex.: de R$43,20 → R$44,90).
- **Simulador de quantidade**: multiplica custo/preço/lucro pela quantidade de peças do pedido.
- **Gráfico de rosca (Chart.js)**: dissecção visual do custo — Filamento vs. Energia vs. Depreciação vs. Operacional vs. Lucro.
- **4 temas** via CSS variables: Dark/Dracula, Dark/Nord, Light/Minimalista, Light/Ocean.
- **Copiar Orçamento**: gera um texto limpo com um clique, pronto para colar no WhatsApp do cliente.
- **Backup local**: exporta/importa todos os dados (`localStorage`) em um arquivo `.json`.
- **Navegação por Tab**: todos os campos seguem uma ordem lógica de tabulação.

## 🗂️ Estrutura do projeto

```
calcula-ai/
├── index.html          # Estrutura da página (dashboard)
├── css/
│   ├── themes.css      # Variáveis CSS das 4 paletas de tema
│   └── style.css       # Layout e estilos gerais
├── js/
│   ├── storage.js       # Persistência em localStorage + backup import/export
│   ├── theme.js          # Troca de tema
│   ├── calculator.js     # Regras de negócio / fórmulas de custo (módulo puro)
│   ├── chart.js           # Gráfico de rosca (Chart.js)
│   ├── ui.js               # Liga o DOM aos módulos acima
│   └── main.js             # Ponto de entrada
├── .gitignore
└── README.md
```

## 🚀 Rodando localmente

Como é um projeto 100% estático, basta abrir o `index.html` no navegador — ou, para evitar eventuais restrições de `file://` no Chrome, sirva com um servidor simples:

```bash
npx serve .
```

## 🌐 Publicando no GitHub Pages

Veja o passo a passo completo de Git/Deploy enviado junto com este projeto. Resumo:

1. `Settings` → `Pages` → Source: **Deploy from a branch**
2. Branch: **main**, pasta: **/(root)**
3. Salvar — o site fica disponível em `https://mocelinc.github.io/calcula-ai/`

## 🔒 Privacidade

Nenhum dado é enviado para servidores externos. Todos os perfis e configurações ficam salvos apenas no `localStorage` do seu navegador. Use o botão **Exportar Dados** regularmente para manter um backup seguro.

---

Feito com ❤️ para makers que vivem de impressão 3D.
