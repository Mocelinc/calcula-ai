/* =========================================================================
   Calcula.AI — ui/calc.js
   As entradas da calculadora: campo de tempo, markup, risco de falha,
   quantidade, modo de lote e o botão de limpar. Monta o objeto que vai
   para o Calculator; quem exibe o resultado é ui/result.js.
   Público: UI.Calc.{ bind, start, entrada, syncMarkup, syncLote, tempoHint }
   ========================================================================= */

UI.Calc = (() => {
  const el = UI.el;
  const $ = UI.$;
  const numVal = UI.numVal;

  // ------------------------------------------------ Tempo (campo unificado)

  /**
   * Aceita os formatos que a pessoa naturalmente digitaria:
   *   "8"        -> 8h 00min
   *   "8,30"     -> 8h 30min      (mesma coisa com "8.30" ou "8:30")
   *   "8,5"      -> 8h 05min      (dígitos após o separador são minutos literais)
   *   "90min"    -> 1h 30min      (só minutos)
   * @returns {{horas:number, minutos:number}}
   */
  function parseTempo(texto) {
    const bruto = String(texto || "").trim().toLowerCase();
    if (!bruto) return { horas: 0, minutos: 0 };

    // Só minutos: "90min", "90m"
    const soMinutos = bruto.match(/^(\d+(?:[.,]\d+)?)\s*m(?:in)?$/);
    if (soMinutos) {
      const min = Math.round(parseFloat(soMinutos[1].replace(",", ".")));
      return { horas: Math.floor(min / 60), minutos: min % 60 };
    }

    const partes = bruto.replace(/\s|h/g, "").split(/[.,:]/);
    const horas = Math.max(0, parseInt(partes[0], 10) || 0);
    if (partes.length < 2 || partes[1] === "") return { horas, minutos: 0 };

    // Minutos acima de 59 transbordam para a hora seguinte em vez de serem
    // descartados ("2,75" vira 3h15min, não 2h59min).
    const total = horas * 60 + Math.max(0, parseInt(partes[1], 10) || 0);
    return { horas: Math.floor(total / 60), minutos: total % 60 };
  }

  function bindTempoField() {
    el.tempoImpressao.addEventListener("input", () => {
      tempoHint();
      UI.recalc();
    });
    // Ao sair do campo, normaliza o texto para o formato canônico "8:30".
    el.tempoImpressao.addEventListener("blur", () => {
      const { horas, minutos } = parseTempo(el.tempoImpressao.value);
      if (horas === 0 && minutos === 0) { el.tempoImpressao.value = ""; }
      else { el.tempoImpressao.value = `${horas}:${String(minutos).padStart(2, "0")}`; }
      tempoHint();
    });
  }

  function tempoHint() {
    const { horas, minutos } = parseTempo(el.tempoImpressao.value);
    el.tempoHint.textContent = `= ${horas}h ${minutos}min`;
  }

  // ------------------------------------------------------------- Markup UI

  /** @param {"slider"|"number"|"chip"|"init"} source */
  function syncMarkup(value, source) {
    const v = Math.max(0, Number.isFinite(value) ? value : 0);
    if (source !== "slider") el.markupSlider.value = Math.min(v, parseFloat(el.markupSlider.max));
    if (source !== "number") el.markupNumber.value = v;
    el.markupChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("is-active", parseFloat(chip.dataset.markup) === v);
    });
    updateMarkupThermo(v);
  }

  function updateMarkupThermo(v) {
    const max = parseFloat(el.markupSlider.max);
    el.markupThermoMarker.style.left = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

    let tier, label;
    if (v < 30) { tier = "tier-low"; label = "Baixa"; }
    else if (v < 80) { tier = "tier-mid"; label = "Moderada"; }
    else if (v < 150) { tier = "tier-healthy"; label = "Saudável"; }
    else { tier = "tier-premium"; label = "Premium"; }
    el.markupThermoLabel.textContent = label;
    el.markupThermoLabel.className = `markup-thermo-label ${tier}`;
  }

  function bindMarkupControls() {
    el.markupSlider.addEventListener("input", () => {
      syncMarkup(parseFloat(el.markupSlider.value), "slider");
      UI.recalc();
    });
    el.markupNumber.addEventListener("input", () => {
      syncMarkup(parseFloat(el.markupNumber.value), "number");
      UI.recalc();
    });
    el.markupChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      syncMarkup(parseFloat(chip.dataset.markup), "chip");
      UI.recalc();
    });
  }

  function currentMarkupPct() { return numVal("markupNumber"); }

  // ---------------------------------------------------------- Taxa de falha

  function syncTaxaFalha(value, source) {
    const max = parseFloat(el.taxaFalhaSlider.max);
    const v = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
    if (source !== "slider") el.taxaFalhaSlider.value = v;
    if (source !== "number") el.taxaFalhaNumber.value = v;
  }

  function bindTaxaFalhaControls() {
    el.taxaFalhaSlider.addEventListener("input", () => {
      syncTaxaFalha(parseFloat(el.taxaFalhaSlider.value), "slider");
      UI.recalc();
    });
    el.taxaFalhaNumber.addEventListener("input", () => {
      syncTaxaFalha(parseFloat(el.taxaFalhaNumber.value), "number");
      UI.recalc();
    });
  }

  // ---------------------------------------------- Quantidade e modo de lote
  // "por peça": cada peça é uma impressão separada — tempo e peso se repetem.
  // "do lote": as peças saem juntas na mesma mesa — tempo, peso e preparo
  // informados cobrem todas elas e são divididos entre as peças.

  let modoLote = false;

  function bindModoLote() {
    el.modoLoteChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      modoLote = chip.dataset.modo === "lote";
      syncLote();
      UI.recalc();
    });
  }

  /** Ajusta rótulos e visibilidade conforme o modo e a quantidade. */
  function syncLote() {
    const qtd = Math.max(1, numVal("quantidadePecas"));

    // Com uma peça só a escolha não muda nada, então nem aparece.
    el.modoLoteRow.hidden = qtd <= 1;

    el.modoLoteChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("is-active", (chip.dataset.modo === "lote") === modoLote);
    });

    el.tempoLabel.textContent = modoLote ? "Tempo de impressão (do lote)" : "Tempo de impressão";
    el.filamentosSubheading.textContent = modoLote ? "Filamentos (do lote)" : "Filamentos";
    el.labelTempoTotal.textContent = modoLote ? "Tempo do lote" : "Tempo de impressão";
    el.labelPesoTotal.textContent = modoLote ? "Filamento do lote" : "Peso de filamento";
    el.modoLoteHint.textContent = modoLote
      ? `Filamento, energia, depreciação e preparo divididos entre ${qtd} peças. Embalagem continua por peça.`
      : "Cada peça é uma impressão separada, com tempo e filamento próprios.";
  }

  function bindQuantityStepper() {
    $("btnQtdMinus").addEventListener("click", () => {
      el.quantidadePecas.value = Math.max(1, numVal("quantidadePecas") - 1);
      UI.recalc();
    });
    $("btnQtdPlus").addEventListener("click", () => {
      el.quantidadePecas.value = Math.max(1, numVal("quantidadePecas") + 1);
      UI.recalc();
    });
  }

  // ------------------------------------------------ Entrada para o cálculo

  function entrada() {
    const machine = UI.Printers.atual() || {};
    const tempo = parseTempo(el.tempoImpressao.value);
    return {
      materiais: UI.MaterialRows.ler(),
      tempoHoras: tempo.horas,
      tempoMinutos: tempo.minutos,
      potenciaW: machine.potenciaW || 0,
      valorCompraMaquina: machine.valorCompra || 0,
      vidaUtilHoras: machine.vidaUtilHoras || 0,
      valorKwh: numVal("valorKwh"),
      prepMinutos: numVal("prepMinutos"),
      valorHoraTrabalho: numVal("valorHora"),
      custoEmbalagem: numVal("custoEmbalagem"),
      taxaFalhaPct: numVal("taxaFalhaNumber"),
      custosExtras: numVal("custosExtras"),
      markupPct: currentMarkupPct(),
      quantidade: numVal("quantidadePecas"),
      modoLote,
      precoMarketeiro: el.precoMarketeiro.checked,
    };
  }

  // ---------------------------------------------------- Limpar e atalhos

  function bindReset() {
    $("btnReset").addEventListener("click", () => {
      if (!confirm("Limpar os campos do orçamento atual? Impressoras, filamentos e ajustes não são apagados.")) return;
      $("calcForm").reset();
      el.pieceName.value = "";
      el.tempoImpressao.value = "";
      tempoHint();
      syncMarkup(100, "init");
      syncTaxaFalha(0, "init");
      modoLote = false;
      syncLote();
      UI.MaterialRows.reset();
      UI.showView("calc");
      UI.recalc();
    });
  }

  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        $("btnReset").click();
      }
    });
  }

  /** Estado inicial da tela, depois que os ajustes salvos já foram aplicados. */
  function start() {
    tempoHint();
  }

  function bind() {
    bindTempoField();
    bindMarkupControls();
    bindTaxaFalhaControls();
    bindQuantityStepper();
    bindModoLote();
    bindReset();
    bindKeyboardShortcuts();
  }

  return { bind, start, entrada, syncMarkup, syncLote, tempoHint };
})();
