/* =========================================================================
   Calcula.AI — ui.js
   Liga o DOM aos módulos Storage / Calculator / CostChart.
   Cuida da navegação entre telas, das listas de perfis (impressoras e
   filamentos), do cálculo em tempo real, do backup e do "Copiar orçamento".
   ========================================================================= */

const UI = (() => {
  const el = {};

  let machineProfiles = [];
  let materialProfiles = [];

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
      "tempoImpressao", "tempoHint", "machineProfileSelect", "machineHint",
      "materialRows", "pesoTotalDisplay",
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

  function bindNavigation() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
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
      atualizarTempoHint();
      recalculate();
    });
    // Ao sair do campo, normaliza o texto para o formato canônico "8:30".
    el.tempoImpressao.addEventListener("blur", () => {
      const { horas, minutos } = parseTempo(el.tempoImpressao.value);
      if (horas === 0 && minutos === 0) { el.tempoImpressao.value = ""; }
      else { el.tempoImpressao.value = `${horas}:${String(minutos).padStart(2, "0")}`; }
      atualizarTempoHint();
    });
  }

  function atualizarTempoHint() {
    const { horas, minutos } = parseTempo(el.tempoImpressao.value);
    el.tempoHint.textContent = `= ${horas}h ${minutos}min`;
  }

  // ------------------------------------------------- Perfis de impressora

  function loadMachineProfiles() {
    machineProfiles = Storage.getMachineProfiles();
    renderMachineSelect();
    renderMachineList();
  }

  function renderMachineSelect() {
    const prev = el.machineProfileSelect.value;
    el.machineProfileSelect.innerHTML = machineProfiles
      .map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join("");
    if (machineProfiles.some((p) => p.id === prev)) el.machineProfileSelect.value = prev;
    atualizarMachineHint();
  }

  function atualizarMachineHint() {
    const m = currentMachineProfile();
    el.machineHint.textContent = m ? `${m.potenciaW} W · ${Calculator.formatarMoeda(m.valorCompra)}` : "";
  }

  function currentMachineProfile() {
    return machineProfiles.find((p) => p.id === el.machineProfileSelect.value) || machineProfiles[0];
  }

  function renderMachineList() {
    el.machineList.innerHTML = machineProfiles.map((p) => `
      <div class="profile-item" data-id="${p.id}">
        <div class="profile-item-head">
          <input type="text" class="pf-nome" value="${escapeHtml(p.nome)}" aria-label="Nome da impressora" />
          <button type="button" class="btn btn-icon btn-danger pf-del" title="Excluir impressora">🗑️</button>
        </div>
        <div class="profile-fields three-col">
          <label>Consumo (W)
            <input type="number" class="pf-potencia" min="0" step="1" value="${p.potenciaW}" />
          </label>
          <label>Valor de compra (R$)
            <input type="number" class="pf-valor" min="0" step="0.01" value="${p.valorCompra}" />
          </label>
          <label>Vida útil (h)
            <input type="number" class="pf-vida" min="0" step="1" value="${p.vidaUtilHoras}" />
          </label>
        </div>
        ${p.vidaUtilHoras > 0 ? "" : '<span class="profile-badge">Sem depreciação até definir a vida útil</span>'}
      </div>
    `).join("");
  }

  function bindMachineList() {
    $("btnAddMachine").addEventListener("click", () => {
      machineProfiles.push({
        id: Storage.uid("machine"),
        nome: "Nova impressora",
        potenciaW: 0,
        valorCompra: 0,
        vidaUtilHoras: 0,
      });
      Storage.saveMachineProfiles(machineProfiles);
      renderMachineList();
      renderMachineSelect();
      recalculate();
    });

    // Auto-save: qualquer digitação já grava no localStorage.
    el.machineList.addEventListener("input", (e) => {
      const item = e.target.closest(".profile-item");
      if (!item) return;
      const profile = machineProfiles.find((p) => p.id === item.dataset.id);
      if (!profile) return;

      if (e.target.classList.contains("pf-nome")) profile.nome = e.target.value.trim() || "Sem nome";
      if (e.target.classList.contains("pf-potencia")) profile.potenciaW = Math.max(0, parseFloat(e.target.value) || 0);
      if (e.target.classList.contains("pf-valor")) profile.valorCompra = Math.max(0, parseFloat(e.target.value) || 0);
      if (e.target.classList.contains("pf-vida")) profile.vidaUtilHoras = Math.max(0, parseFloat(e.target.value) || 0);

      Storage.saveMachineProfiles(machineProfiles);
      renderMachineSelect();
      recalculate();
    });

    el.machineList.addEventListener("click", (e) => {
      if (!e.target.closest(".pf-del")) return;
      if (machineProfiles.length <= 1) {
        alert("Você precisa manter ao menos uma impressora cadastrada.");
        return;
      }
      const item = e.target.closest(".profile-item");
      const profile = machineProfiles.find((p) => p.id === item.dataset.id);
      if (!confirm(`Excluir "${profile.nome}"?`)) return;
      machineProfiles = machineProfiles.filter((p) => p.id !== profile.id);
      Storage.saveMachineProfiles(machineProfiles);
      renderMachineList();
      renderMachineSelect();
      recalculate();
    });
  }

  // -------------------------------------------------- Perfis de filamento

  function loadMaterialProfiles() {
    materialProfiles = Storage.getMaterialProfiles();
    renderMaterialList();
  }

  function renderMaterialList() {
    el.materialList.innerHTML = materialProfiles.map((p) => `
      <div class="profile-item" data-id="${p.id}">
        <div class="profile-item-head">
          <input type="text" class="pf-nome" value="${escapeHtml(p.nome)}" aria-label="Nome do filamento" />
          <button type="button" class="btn btn-icon btn-danger pf-del" title="Excluir filamento">🗑️</button>
        </div>
        <div class="profile-fields">
          <label>Preço do rolo (R$/kg)
            <input type="number" class="pf-preco" min="0" step="0.01" value="${p.precoKg}" />
          </label>
        </div>
      </div>
    `).join("");
  }

  function bindMaterialList() {
    $("btnAddMaterial").addEventListener("click", () => {
      materialProfiles.push({ id: Storage.uid("material"), nome: "Novo filamento", precoKg: 0 });
      Storage.saveMaterialProfiles(materialProfiles);
      renderMaterialList();
      refreshMaterialRowSelects();
      recalculate();
    });

    el.materialList.addEventListener("input", (e) => {
      const item = e.target.closest(".profile-item");
      if (!item) return;
      const profile = materialProfiles.find((p) => p.id === item.dataset.id);
      if (!profile) return;

      if (e.target.classList.contains("pf-nome")) profile.nome = e.target.value.trim() || "Sem nome";
      if (e.target.classList.contains("pf-preco")) profile.precoKg = Math.max(0, parseFloat(e.target.value) || 0);

      Storage.saveMaterialProfiles(materialProfiles);
      refreshMaterialRowSelects();
      recalculate();
    });

    el.materialList.addEventListener("click", (e) => {
      if (!e.target.closest(".pf-del")) return;
      if (materialProfiles.length <= 1) {
        alert("Você precisa manter ao menos um filamento cadastrado.");
        return;
      }
      const item = e.target.closest(".profile-item");
      const profile = materialProfiles.find((p) => p.id === item.dataset.id);
      if (!confirm(`Excluir "${profile.nome}"?`)) return;
      materialProfiles = materialProfiles.filter((p) => p.id !== profile.id);
      Storage.saveMaterialProfiles(materialProfiles);
      renderMaterialList();
      refreshMaterialRowSelects();
      recalculate();
    });
  }

  // ---------------------------------------------- Filamentos usados na peça
  // Multi-material: cada linha é um filamento com peso e preço/kg próprios.

  function materialRowOptionsHtml(selectedId) {
    return materialProfiles
      .map((p) => `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${escapeHtml(p.nome)}</option>`)
      .join("");
  }

  function addMaterialRow(profileId, pesoG) {
    const row = document.createElement("div");
    row.className = "material-row";
    row.innerHTML = `
      <select class="material-row-select" aria-label="Filamento desta linha">${materialRowOptionsHtml(profileId)}</select>
      <input type="number" class="material-row-peso" min="0" step="0.1" value="${pesoG}" aria-label="Peso deste filamento (g)" />
      <button type="button" class="btn btn-icon btn-danger material-row-remove" title="Remover filamento">🗑️</button>
    `;
    el.materialRows.appendChild(row);
  }

  function resetMaterialRows() {
    el.materialRows.innerHTML = "";
    addMaterialRow(materialProfiles[0] ? materialProfiles[0].id : "", 0);
  }

  /** Reconstrói as <option> de todas as linhas quando o catálogo muda. */
  function refreshMaterialRowSelects() {
    el.materialRows.querySelectorAll(".material-row-select").forEach((select) => {
      const prev = select.value;
      const valido = materialProfiles.some((p) => p.id === prev);
      const fallback = materialProfiles[0] ? materialProfiles[0].id : "";
      select.innerHTML = materialRowOptionsHtml(valido ? prev : fallback);
    });
  }

  function readMaterialRows() {
    return Array.from(el.materialRows.querySelectorAll(".material-row")).map((rowEl) => {
      const select = rowEl.querySelector(".material-row-select");
      const pesoInput = rowEl.querySelector(".material-row-peso");
      const profile = materialProfiles.find((p) => p.id === select.value);
      const pesoG = parseFloat(pesoInput.value);
      return {
        nome: profile ? profile.nome : "Material",
        precoKg: profile ? profile.precoKg : 0,
        pesoG: Number.isFinite(pesoG) ? pesoG : 0,
      };
    });
  }

  function bindMaterialRows() {
    $("btnAddMaterialRow").addEventListener("click", () => {
      addMaterialRow(materialProfiles[0] ? materialProfiles[0].id : "", 0);
      recalculate();
    });

    el.materialRows.addEventListener("click", (e) => {
      if (!e.target.closest(".material-row-remove")) return;
      if (el.materialRows.querySelectorAll(".material-row").length <= 1) {
        alert("A peça precisa ter ao menos um filamento.");
        return;
      }
      e.target.closest(".material-row").remove();
      recalculate();
    });
  }

  // ------------------------------------------------------------- Markup UI

  /** @param {"slider"|"number"|"chip"|"init"} source */
  function syncMarkupUI(value, source) {
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
      syncMarkupUI(parseFloat(el.markupSlider.value), "slider");
      recalculate();
    });
    el.markupNumber.addEventListener("input", () => {
      syncMarkupUI(parseFloat(el.markupNumber.value), "number");
      recalculate();
    });
    el.markupChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      syncMarkupUI(parseFloat(chip.dataset.markup), "chip");
      recalculate();
    });
  }

  function currentMarkupPct() { return numVal("markupNumber"); }

  // -------------------------------------------------------- Taxa de falha

  function syncTaxaFalhaUI(value, source) {
    const max = parseFloat(el.taxaFalhaSlider.max);
    const v = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
    if (source !== "slider") el.taxaFalhaSlider.value = v;
    if (source !== "number") el.taxaFalhaNumber.value = v;
  }

  function bindTaxaFalhaControls() {
    el.taxaFalhaSlider.addEventListener("input", () => {
      syncTaxaFalhaUI(parseFloat(el.taxaFalhaSlider.value), "slider");
      recalculate();
    });
    el.taxaFalhaNumber.addEventListener("input", () => {
      syncTaxaFalhaUI(parseFloat(el.taxaFalhaNumber.value), "number");
      recalculate();
    });
  }

  // ------------------------------------------------------ Stepper de qtd.

  function bindQuantityStepper() {
    $("btnQtdMinus").addEventListener("click", () => {
      el.quantidadePecas.value = Math.max(1, numVal("quantidadePecas") - 1);
      recalculate();
    });
    $("btnQtdPlus").addEventListener("click", () => {
      el.quantidadePecas.value = Math.max(1, numVal("quantidadePecas") + 1);
      recalculate();
    });
  }

  // --------------------------------------------------------- Cálculo (core)

  function gatherInput() {
    const machine = currentMachineProfile() || {};
    const tempo = parseTempo(el.tempoImpressao.value);
    return {
      materiais: readMaterialRows(),
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
      precoMarketeiro: el.precoMarketeiro.checked,
    };
  }

  let lastResult = null;

  function recalculate() {
    const input = gatherInput();
    const r = Calculator.calcular(input);
    lastResult = r;

    el.outPrecoUnitario.textContent = Calculator.formatarMoeda(r.precoFinal);

    if (input.precoMarketeiro) {
      el.outPrecoMarketeiro.hidden = false;
      el.outPrecoMarketeiro.textContent = `Preço cheio: ${Calculator.formatarMoeda(r.precoSugerido)}`;
    } else {
      el.outPrecoMarketeiro.hidden = true;
    }

    el.outQtdLabel.textContent = r.quantidade;
    el.outTotalQtd.textContent = Calculator.formatarMoeda(r.precoTotalQtd);

    const pctLucro = r.precoFinal > 0 ? Math.max(0, Math.min(100, (r.lucroFinal / r.precoFinal) * 100)) : 0;
    el.ratioBarFill.style.width = `${pctLucro}%`;
    el.ratioBarLabel.textContent = `${Math.round(pctLucro)}% do preço é lucro`;

    el.pesoTotalDisplay.textContent = formatGramas(r.pesoTotalG);
    el.outCustoTotal.textContent = Calculator.formatarMoeda(r.custoAjustado);
    el.outLucroUnitario.textContent = Calculator.formatarMoeda(r.lucroUnitario);
    el.outTempoTotal.textContent = formatTempo(r.tempoImpressaoH);
    el.outPesoTotalStat.textContent = formatGramas(r.pesoTotalG);

    atualizarMachineHint();
    updateInsightCallout(r);
    renderBreakdown(r);
    CostChart.render(r);

    Storage.saveSettings({
      valorKwh: input.valorKwh,
      valorHora: input.valorHoraTrabalho,
      markup: input.markupPct,
    });
  }

  /** Quantas peças como essa pagam o investimento na impressora. */
  function updateInsightCallout(r) {
    const machine = currentMachineProfile();
    if (machine && machine.valorCompra > 0 && r.lucroUnitario > 0) {
      const pecas = Math.ceil(machine.valorCompra / r.lucroUnitario);
      el.insightCallout.hidden = false;
      el.insightCallout.textContent = `💡 Com esse lucro, ${pecas} peça${pecas === 1 ? "" : "s"} como essa pagam sua ${machine.nome}.`;
    } else {
      el.insightCallout.hidden = true;
    }
  }

  function renderBreakdown(r) {
    const itemRows = r.materiaisDetalhe.map((m) => ({
      label: `Filamento — ${escapeHtml(m.nome)} (${formatGramas(m.pesoG)})`,
      value: m.custo,
    }));
    itemRows.push(
      { label: "Energia", value: r.custoEnergia },
      { label: "Depreciação da máquina", value: r.custoDepreciacao },
      { label: "Mão de obra", value: r.custoMaoDeObra },
      { label: "Embalagem", value: r.custoEmbalagem },
      { label: "Custos extras", value: r.custosExtras },
    );

    const maxValue = Math.max(1, ...itemRows.map((row) => row.value));
    let html = itemRows.map((row) => {
      const pct = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
      return `
        <li>
          <div class="breakdown-row"><span class="label">${row.label}</span><span class="value">${Calculator.formatarMoeda(row.value)}</span></div>
          <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${pct}%"></div></div>
        </li>
      `;
    }).join("");

    const plainRow = (label, value, extraClass = "") => `
      <li class="plain ${extraClass}"><div class="breakdown-row"><span class="label">${label}</span><span class="value">${Calculator.formatarMoeda(value)}</span></div></li>
    `;
    html += plainRow("Custo base", r.custoBase);
    html += plainRow("Ajuste por risco de falha", r.custoAjustado - r.custoBase);
    html += plainRow("Custo total ajustado", r.custoAjustado, "total");

    el.breakdownList.innerHTML = html;
  }

  // --------------------------------------------------------------- Backup

  function bindBackup() {
    $("btnExport").addEventListener("click", () => {
      Storage.downloadExport();
      flashFeedback("Backup exportado.");
    });

    $("btnImportTrigger").addEventListener("click", () => $("btnImportFile").click());

    $("btnImportFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const count = Storage.importAll(JSON.parse(reader.result));
          alert(`Backup importado (${count} chave(s) restaurada(s)). A página será recarregada.`);
          location.reload();
        } catch (err) {
          alert(`Erro ao importar backup: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  // ----------------------------------------------------- Copiar orçamento

  function bindCopyBudget() {
    $("btnCopyBudget").addEventListener("click", async () => {
      if (!lastResult) return;
      const texto = buildBudgetText(lastResult);
      try {
        await navigator.clipboard.writeText(texto);
        flashFeedback("Orçamento copiado! Cole no WhatsApp do cliente.");
      } catch (err) {
        window.prompt("Copie o orçamento abaixo (Ctrl+C):", texto);
      }
    });
  }

  function buildBudgetText(r) {
    const nome = el.pieceName.value.trim() || "Peça 3D";
    const materiaisLinha = r.materiaisDetalhe
      .filter((m) => m.pesoG > 0)
      .map((m) => `${m.nome} (${formatGramas(m.pesoG)})`)
      .join(", ");
    const linhas = [
      `🧾 Orçamento — ${nome}`,
      `Material: ${materiaisLinha || "-"}`,
      `Quantidade: ${r.quantidade}`,
      `Valor unitário: ${Calculator.formatarMoeda(r.precoFinal)}`,
    ];
    if (r.quantidade > 1) linhas.push(`Valor total: ${Calculator.formatarMoeda(r.precoTotalQtd)}`);
    linhas.push("— Gerado com Calcula.AI");
    return linhas.join("\n");
  }

  function flashFeedback(msg) {
    el.copyFeedback.textContent = msg;
    clearTimeout(flashFeedback._t);
    flashFeedback._t = setTimeout(() => { el.copyFeedback.textContent = ""; }, 3500);
  }

  // -------------------------------------------------------------- Reset

  function bindReset() {
    $("btnReset").addEventListener("click", () => {
      if (!confirm("Limpar os campos do orçamento atual? Impressoras, filamentos e ajustes não são apagados.")) return;
      $("calcForm").reset();
      el.pieceName.value = "";
      el.tempoImpressao.value = "";
      atualizarTempoHint();
      syncMarkupUI(100, "init");
      syncTaxaFalhaUI(0, "init");
      resetMaterialRows();
      showView("calc");
      recalculate();
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

  // ------------------------------------------------------- Inicialização

  /**
   * Escuta no documento inteiro (e não só no formulário) porque os campos de
   * Ajustes vivem em outra tela, fora do <form> da calculadora.
   */
  function bindLiveRecalculation() {
    document.addEventListener("input", (e) => {
      if (e.target.closest(".profile-item")) return; // listas têm handler próprio
      recalculate();
    });
    document.addEventListener("change", (e) => {
      if (e.target.closest(".profile-item")) return;
      recalculate();
    });
  }

  function applySavedSettings() {
    const s = Storage.getSettings();
    el.valorKwh.value = s.valorKwh;
    el.valorHora.value = s.valorHora;

    // Migração: versões antigas guardavam markup como "50"/"100"/"custom".
    let markupVal = parseFloat(s.markup);
    if (!Number.isFinite(markupVal)) markupVal = parseFloat(s.markupCustom);
    if (!Number.isFinite(markupVal)) markupVal = 100;
    syncMarkupUI(markupVal, "init");
  }

  function init() {
    cacheElements();
    loadMachineProfiles();
    loadMaterialProfiles();
    resetMaterialRows();
    applySavedSettings();
    atualizarTempoHint();

    bindNavigation();
    bindTempoField();
    bindMachineList();
    bindMaterialList();
    bindMaterialRows();
    bindMarkupControls();
    bindTaxaFalhaControls();
    bindQuantityStepper();
    bindBackup();
    bindCopyBudget();
    bindReset();
    bindKeyboardShortcuts();
    bindLiveRecalculation();

    document.addEventListener("calculaai:themechange", () => CostChart.refreshColors());

    recalculate();
  }

  return { init };
})();
