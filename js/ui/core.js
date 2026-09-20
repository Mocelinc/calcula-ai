/* =========================================================================
   Calcula.AI — ui/core.js
   O tronco da interface: cache de elementos, utilidades de formatação,
   navegação entre telas e a inicialização que acorda os outros módulos.

   Os módulos de ui/ pendurados aqui:
     UI.Printers      ui/printers.js       tela Impressoras
     UI.Filaments     ui/filaments.js      tela Filamentos
     UI.MaterialRows  ui/material-rows.js  filamentos usados na peça
     UI.Calc          ui/calc.js           entradas da calculadora
     UI.Result        ui/result.js         recálculo, detalhamento e orçamento
     UI.Settings      ui/settings.js       tela Ajustes e backup

   Regra de convivência: um módulo nunca chama função interna de outro.
   Quem precisa recalcular chama UI.recalc().
   ========================================================================= */

const UI = (() => {
  const el = {};
  let flashTimer = null;

  // ---------------------------------------------------------- Utilidades

  function $(id) { return document.getElementById(id); }

  function numVal(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : 0;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatGramas(g) {
    const n = Number.isFinite(g) ? g : 0;
    return `${(Math.round(n * 10) / 10).toString().replace(".", ",")} g`;
  }

  function formatTempo(horasDecimais) {
    const totalMin = Math.round(Math.max(0, horasDecimais) * 60);
    return `${Math.floor(totalMin / 60)}h ${totalMin % 60}min`;
  }

  function cacheElements() {
    [
      "tempoImpressao", "tempoHint", "tempoLabel", "machineProfileSelect", "machineHint",
      "materialRows", "pesoTotalDisplay", "filamentosSubheading",
      "modoLoteRow", "modoLoteChips", "modoLoteHint",
      "labelTempoTotal", "labelPesoTotal",
      "valorKwh", "prepMinutos", "valorHora", "custoEmbalagem", "custosExtras",
      "taxaFalhaSlider", "taxaFalhaNumber",
      "markupSlider", "markupNumber", "markupChips", "markupThermoMarker", "markupThermoLabel",
      "quantidadePecas", "precoMarketeiro", "pieceName",
      "outPrecoUnitario", "outPrecoMarketeiro", "outCustoTotal", "outLucroUnitario",
      "outTempoTotal", "outPesoTotalStat", "ratioBarFill", "ratioBarLabel", "insightCallout",
      "outQtdLabel", "outTotalQtd", "breakdownList", "copyFeedback",
      "machineList", "materialList",
    ].forEach((id) => { el[id] = $(id); });
  }

  // ------------------------------------------------------------ Navegação

  // Delegação: qualquer item de navegação funciona, inclusive os que forem
  // acrescentados à barra lateral depois da carga inicial.
  function bindNavigation() {
    document.querySelector(".side-nav").addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-item");
      if (btn) showView(btn.dataset.view);
    });
  }

  function showView(viewName) {
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = view.id !== `view-${viewName}`;
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === viewName);
    });
    window.scrollTo({ top: 0 });
  }

  // --------------------------------------------------------------- Avisos

  function flash(msg) {
    el.copyFeedback.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.copyFeedback.textContent = ""; }, 3500);
  }

  /** Porta de entrada única para "recalcule tudo". */
  function recalc() { UI.Result.recalcular(); }

  // ------------------------------------------------------- Inicialização

  /**
   * Escuta no documento inteiro (e não só no formulário) porque os campos de
   * Ajustes vivem em outra tela, fora do <form> da calculadora.
   */
  function bindLiveRecalculation() {
    document.addEventListener("input", (e) => {
      if (e.target.closest(".profile-item")) return; // listas têm handler próprio
      recalc();
    });
    document.addEventListener("change", (e) => {
      if (e.target.closest(".profile-item")) return;
      recalc();
    });
  }

  function init() {
    cacheElements();

    UI.Printers.load();
    UI.Filaments.load();
    UI.MaterialRows.reset();
    UI.Settings.applySaved();
    UI.Calc.start();

    bindNavigation();
    UI.Calc.bind();
    UI.Printers.bind();
    UI.Filaments.bind();
    UI.MaterialRows.bind();
    UI.Result.bind();
    UI.Settings.bind();
    bindLiveRecalculation();

    document.addEventListener("calculaai:themechange", () => CostChart.refreshColors());

    recalc();
  }

  return { el, $, numVal, escapeHtml, formatGramas, formatTempo, showView, flash, recalc, init };
})();
