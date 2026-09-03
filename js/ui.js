/* =========================================================================
   Calcula.AI — ui.js
   Liga o DOM aos módulos Storage / Calculator / CostChart.
   Responsável por: perfis (CRUD), cálculo em tempo real, backup e
   o botão "Copiar Orçamento".
   ========================================================================= */

const UI = (() => {
  // Cache dos elementos usados com frequência.
  const el = {};

  let machineProfiles = [];
  let materialProfiles = [];

  // ---------------------------------------------------------- Utilidades

  function $(id) { return document.getElementById(id); }

  function numVal(id) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : 0;
  }

  function cacheElements() {
    [
      "tempoHoras", "tempoMinutos",
      "machineProfileSelect", "machineProfileEditSelect",
      "machineNome", "machinePotencia", "machineValor", "machineVidaUtil",
      "materialRows", "pesoTotalDisplay",
      "materialProfileSelect", "materialNome", "materialPrecoKg",
      "valorKwh", "prepMinutos", "valorHora", "custoEmbalagem", "custosExtras",
      "taxaFalhaSlider", "taxaFalhaNumber",
      "markupSlider", "markupNumber", "markupChips", "markupThermoMarker", "markupThermoLabel",
      "quantidadePecas", "precoMarketeiro", "pieceName",
      "outPrecoUnitario", "outPrecoMarketeiro", "outCustoTotal", "outLucroUnitario",
      "outTempoTotal", "outPesoTotalStat", "ratioBarFill", "ratioBarLabel", "insightCallout",
      "outQtdLabel", "outTotalQtd", "breakdownList", "copyFeedback",
    ].forEach((id) => { el[id] = $(id); });
  }

  function formatGramas(g) {
    const n = Number.isFinite(g) ? g : 0;
    return `${(Math.round(n * 10) / 10).toString().replace(".", ",")} g`;
  }

  // ------------------------------------------------------ Perfis: Máquina

  // machineProfileSelect (painel principal) escolhe qual máquina é usada
  // NESTA peça; machineProfileEditSelect (Configurações fixas) escolhe qual
  // perfil está sendo editado no formulário de CRUD — são independentes.

  function loadMachineProfiles() {
    machineProfiles = Storage.getMachineProfiles();
    renderProfileSelect(el.machineProfileSelect, machineProfiles);
    renderProfileSelect(el.machineProfileEditSelect, machineProfiles);
    fillMachineFields(currentMachineEditProfile());
  }

  function fillMachineFields(profile) {
    if (!profile) return;
    el.machineNome.value = profile.nome;
    el.machinePotencia.value = profile.potenciaW;
    el.machineValor.value = profile.valorCompra;
    el.machineVidaUtil.value = profile.vidaUtilHoras;
  }

  function currentMachineProfile() {
    return machineProfiles.find((p) => p.id === el.machineProfileSelect.value) || machineProfiles[0];
  }

  function currentMachineEditProfile() {
    return machineProfiles.find((p) => p.id === el.machineProfileEditSelect.value) || machineProfiles[0];
  }

  // ------------------------------------------------------ Perfis: Material

  function loadMaterialProfiles() {
    materialProfiles = Storage.getMaterialProfiles();
    renderProfileSelect(el.materialProfileSelect, materialProfiles);
    fillMaterialFields(materialProfiles[0]);
  }

  function fillMaterialFields(profile) {
    if (!profile) return;
    el.materialNome.value = profile.nome;
    el.materialPrecoKg.value = profile.precoKg;
  }

  function currentMaterialProfile() {
    return materialProfiles.find((p) => p.id === el.materialProfileSelect.value) || materialProfiles[0];
  }

  // ---------------------------------------------- Filamentos usados na peça
  // Suporta multi-material: cada linha é um filamento com peso e perfil
  // (preço/kg) próprios — ex.: 2 cores de PLA com preços diferentes.

  let materialRowSeq = 0;

  function materialRowOptionsHtml(selectedId) {
    return materialProfiles.map((p) => `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${escapeHtml(p.nome)}</option>`).join("");
  }

  function addMaterialRow(profileId, pesoG) {
    const rowId = `mrow-${++materialRowSeq}`;
    const row = document.createElement("div");
    row.className = "material-row";
    row.dataset.rowId = rowId;
    row.innerHTML = `
      <select class="material-row-select" aria-label="Perfil de material desta linha">${materialRowOptionsHtml(profileId)}</select>
      <input type="number" class="material-row-peso" min="0" step="0.1" value="${pesoG}" aria-label="Peso deste filamento (g)" />
      <button type="button" class="btn btn-icon btn-danger material-row-remove" title="Remover filamento">🗑️</button>
    `;
    el.materialRows.appendChild(row);
  }

  function resetMaterialRows() {
    el.materialRows.innerHTML = "";
    const firstId = materialProfiles[0] ? materialProfiles[0].id : "";
    addMaterialRow(firstId, 0);
  }

  /** Reconstrói as <option> de todas as linhas quando o catálogo de perfis muda. */
  function refreshMaterialRowSelects() {
    el.materialRows.querySelectorAll(".material-row-select").forEach((select) => {
      const prev = select.value;
      const stillExists = materialProfiles.some((p) => p.id === prev);
      const fallbackId = materialProfiles[0] ? materialProfiles[0].id : "";
      select.innerHTML = materialRowOptionsHtml(stillExists ? prev : fallbackId);
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
      const firstId = materialProfiles[0] ? materialProfiles[0].id : "";
      addMaterialRow(firstId, 0);
      recalculate();
    });

    // Remoção via delegação (as linhas são criadas dinamicamente).
    el.materialRows.addEventListener("click", (e) => {
      const btn = e.target.closest(".material-row-remove");
      if (!btn) return;
      if (el.materialRows.querySelectorAll(".material-row").length <= 1) {
        alert("A peça precisa ter ao menos um filamento.");
        return;
      }
      btn.closest(".material-row").remove();
      recalculate();
    });

    // Alterações de select/peso dentro das linhas já disparam recalculate()
    // via bindLiveRecalculation(), pois as linhas vivem dentro de #calcForm.
  }

  // ------------------------------------------------------------- Genérico

  function renderProfileSelect(selectEl, list) {
    const prevValue = selectEl.value;
    selectEl.innerHTML = list.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join("");
    if (list.some((p) => p.id === prevValue)) selectEl.value = prevValue;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function bindProfileCrud() {
    // --- Máquina ---
    // Select principal: só escolhe qual perfil vale para a peça atual.
    el.machineProfileSelect.addEventListener("change", recalculate);

    // Select de edição (dentro de "Configurações fixas"): carrega os campos do CRUD.
    el.machineProfileEditSelect.addEventListener("change", () => {
      fillMachineFields(currentMachineEditProfile());
    });

    $("btnMachineNew").addEventListener("click", () => {
      const novo = {
        id: Storage.uid("machine"),
        nome: "Nova Máquina",
        potenciaW: 150,
        valorCompra: 1000,
        vidaUtilHoras: 0,
      };
      machineProfiles.push(novo);
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
      renderProfileSelect(el.machineProfileEditSelect, machineProfiles);
      el.machineProfileEditSelect.value = novo.id;
      fillMachineFields(novo);
      el.machineNome.focus();
      recalculate();
    });

    $("btnMachineSave").addEventListener("click", () => {
      const profile = currentMachineEditProfile();
      if (!profile) return;
      profile.nome = el.machineNome.value.trim() || "Sem nome";
      profile.potenciaW = numVal("machinePotencia");
      profile.valorCompra = numVal("machineValor");
      profile.vidaUtilHoras = Math.max(0, numVal("machineVidaUtil"));
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
      renderProfileSelect(el.machineProfileEditSelect, machineProfiles);
      el.machineProfileEditSelect.value = profile.id;
      flashFeedback("Perfil de máquina salvo.");
      recalculate();
    });

    $("btnMachineDelete").addEventListener("click", () => {
      if (machineProfiles.length <= 1) {
        alert("Você precisa manter ao menos um perfil de máquina.");
        return;
      }
      const profile = currentMachineEditProfile();
      if (!confirm(`Excluir o perfil "${profile.nome}"?`)) return;
      machineProfiles = machineProfiles.filter((p) => p.id !== profile.id);
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
      renderProfileSelect(el.machineProfileEditSelect, machineProfiles);
      fillMachineFields(machineProfiles[0]);
      recalculate();
    });

    // --- Material ---
    el.materialProfileSelect.addEventListener("change", () => {
      fillMaterialFields(currentMaterialProfile());
      recalculate();
    });

    $("btnMaterialNew").addEventListener("click", () => {
      const novo = { id: Storage.uid("material"), nome: "Novo Material", precoKg: 100 };
      materialProfiles.push(novo);
      Storage.saveMaterialProfiles(materialProfiles);
      renderProfileSelect(el.materialProfileSelect, materialProfiles);
      el.materialProfileSelect.value = novo.id;
      fillMaterialFields(novo);
      refreshMaterialRowSelects();
      el.materialNome.focus();
      recalculate();
    });

    $("btnMaterialSave").addEventListener("click", () => {
      const profile = currentMaterialProfile();
      if (!profile) return;
      profile.nome = el.materialNome.value.trim() || "Sem nome";
      profile.precoKg = numVal("materialPrecoKg");
      Storage.saveMaterialProfiles(materialProfiles);
      renderProfileSelect(el.materialProfileSelect, materialProfiles);
      el.materialProfileSelect.value = profile.id;
      refreshMaterialRowSelects();
      flashFeedback("Perfil de material salvo.");
      recalculate();
    });

    $("btnMaterialDelete").addEventListener("click", () => {
      if (materialProfiles.length <= 1) {
        alert("Você precisa manter ao menos um perfil de material.");
        return;
      }
      const profile = currentMaterialProfile();
      if (!confirm(`Excluir o perfil "${profile.nome}"?`)) return;
      materialProfiles = materialProfiles.filter((p) => p.id !== profile.id);
      Storage.saveMaterialProfiles(materialProfiles);
      renderProfileSelect(el.materialProfileSelect, materialProfiles);
      fillMaterialFields(materialProfiles[0]);
      refreshMaterialRowSelects();
      recalculate();
    });
  }

  // ------------------------------------------------------------- Markup UI
  // Slider + campo numérico ficam sincronizados nos dois sentidos, e os
  // chips de preset (+50/+75/+100/+200%) pulam direto para o valor.

  /** @param {"slider"|"number"|"chip"|"init"} source Quem originou a mudança, pra não sobrescrever o próprio controle. */
  function syncMarkupUI(value, source) {
    const v = Math.max(0, Number.isFinite(value) ? value : 0);
    if (source !== "slider") el.markupSlider.value = Math.min(v, parseFloat(el.markupSlider.max));
    if (source !== "number") el.markupNumber.value = v;
    el.markupChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("is-active", parseFloat(chip.dataset.markup) === v);
    });
    updateMarkupThermo(v);
  }

  /** Termômetro visual: indica se a margem está baixa/moderada/saudável/premium. */
  function updateMarkupThermo(v) {
    const max = parseFloat(el.markupSlider.max);
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    el.markupThermoMarker.style.left = `${pct}%`;

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

  function currentMarkupPct() {
    return numVal("markupNumber");
  }

  // -------------------------------------------------------- Taxa de falha

  /** @param {"slider"|"number"|"init"} source */
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
    return {
      materiais: readMaterialRows(),
      tempoHoras: numVal("tempoHoras"),
      tempoMinutos: numVal("tempoMinutos"),
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

  function formatTempo(horasDecimais) {
    const totalMin = Math.round(Math.max(0, horasDecimais) * 60);
    return `${Math.floor(totalMin / 60)}h ${totalMin % 60}min`;
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

    // Barra "custo × lucro": qual fatia do preço final é lucro de fato.
    const pctLucro = r.precoFinal > 0 ? Math.max(0, Math.min(100, (r.lucroFinal / r.precoFinal) * 100)) : 0;
    el.ratioBarFill.style.width = `${pctLucro}%`;
    el.ratioBarLabel.textContent = `${Math.round(pctLucro)}% do preço é lucro`;

    el.pesoTotalDisplay.textContent = formatGramas(r.pesoTotalG);
    el.outCustoTotal.textContent = Calculator.formatarMoeda(r.custoAjustado);
    el.outLucroUnitario.textContent = Calculator.formatarMoeda(r.lucroUnitario);
    el.outTempoTotal.textContent = formatTempo(r.tempoImpressaoH);
    el.outPesoTotalStat.textContent = formatGramas(r.pesoTotalG);

    updateInsightCallout(r);
    renderBreakdown(r);
    CostChart.render(r);

    // Persiste as configurações gerais (não os perfis) para a próxima sessão.
    Storage.saveSettings({
      valorKwh: input.valorKwh,
      valorHora: input.valorHoraTrabalho,
      markup: input.markupPct,
    });
  }

  /** Mensagem contextual: quantas peças como essa pagam o investimento na impressora. */
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
    // "Anatomia do custo": uma barrinha por item, proporcional ao maior valor
    // da lista — dá pra ver de relance o que mais pesa no preço.
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
    html += plainRow("Ajuste por taxa de falha", r.custoAjustado - r.custoBase);
    html += plainRow("Custo total ajustado", r.custoAjustado, "total");

    el.breakdownList.innerHTML = html;
  }

  // --------------------------------------------------------------- Backup

  function bindBackup() {
    $("btnExport").addEventListener("click", () => {
      Storage.downloadExport();
      flashFeedback("Backup exportado com sucesso.");
    });

    $("btnImportTrigger").addEventListener("click", () => $("btnImportFile").click());

    $("btnImportFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          const count = Storage.importAll(payload);
          alert(`Backup importado com sucesso (${count} chave(s) restaurada(s)). A página será recarregada.`);
          location.reload();
        } catch (err) {
          alert(`Erro ao importar backup: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = ""; // permite reimportar o mesmo arquivo depois
    });
  }

  // --------------------------------------------------------- Copiar orçamento

  function bindCopyBudget() {
    $("btnCopyBudget").addEventListener("click", async () => {
      if (!lastResult) return;
      const texto = buildBudgetText(lastResult);
      try {
        await navigator.clipboard.writeText(texto);
        flashFeedback("Orçamento copiado! Cole no WhatsApp do cliente.");
      } catch (err) {
        // Fallback para navegadores sem permissão de clipboard.
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
    if (r.quantidade > 1) {
      linhas.push(`Valor total: ${Calculator.formatarMoeda(r.precoTotalQtd)}`);
    }
    linhas.push(`— Gerado com Calcula.AI`);
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
      if (!confirm("Limpar todos os campos do orçamento atual? Perfis salvos não serão apagados.")) return;
      $("calcForm").reset();
      el.pieceName.value = "";
      syncMarkupUI(100, "init");
      syncTaxaFalhaUI(0, "init");
      resetMaterialRows();
      recalculate();
    });
  }

  /** Atalhos de teclado do workflow: Alt+R = Novo Orçamento. */
  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        $("btnReset").click();
      }
    });
  }

  // -------------------------------------------------- Configurações fixas

  /** Painel recolhível com tudo que raramente muda entre peças. */
  function bindAdvancedToggle() {
    const btn = $("btnToggleAdvanced");
    const content = $("advancedContent");
    btn.addEventListener("click", () => {
      const willOpen = content.hidden;
      content.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
      btn.classList.toggle("is-open", willOpen);
    });
  }

  // ------------------------------------------------------- Inicialização

  function bindLiveRecalculation() {
    const form = $("calcForm");
    form.addEventListener("input", recalculate);
    form.addEventListener("change", recalculate);
  }

  function applySavedSettings() {
    const s = Storage.getSettings();
    el.valorKwh.value = s.valorKwh;
    el.valorHora.value = s.valorHora;

    // Migração: versões antigas guardavam markup como "50"/"100"/"custom"
    // + markupCustom separado. Aceita ambos os formatos com segurança.
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
    bindProfileCrud();
    bindMaterialRows();
    bindMarkupControls();
    bindTaxaFalhaControls();
    bindQuantityStepper();
    bindBackup();
    bindCopyBudget();
    bindReset();
    bindKeyboardShortcuts();
    bindAdvancedToggle();
    bindLiveRecalculation();

    document.addEventListener("calculaai:themechange", () => CostChart.refreshColors());

    recalculate();
  }

  return { init };
})();
