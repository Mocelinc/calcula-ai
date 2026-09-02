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
      "pesoPeca", "tempoHoras", "tempoMinutos",
      "machineProfileSelect", "machineNome", "machinePotencia", "machineValor", "machineVidaUtil",
      "materialProfileSelect", "materialNome", "materialPrecoKg",
      "valorKwh", "prepMinutos", "valorHora", "custoEmbalagem", "taxaFalha", "custosExtras",
      "markupSelect", "customMarkupWrap", "markupCustom",
      "quantidadePecas", "precoMarketeiro", "pieceName",
      "outPrecoUnitario", "outPrecoMarketeiro", "outCustoTotal", "outLucroUnitario",
      "outQtdLabel", "outTotalQtd", "outLucroTotal", "breakdownList", "copyFeedback",
    ].forEach((id) => { el[id] = $(id); });
  }

  // ------------------------------------------------------ Perfis: Máquina

  function loadMachineProfiles() {
    machineProfiles = Storage.getMachineProfiles();
    renderProfileSelect(el.machineProfileSelect, machineProfiles);
    fillMachineFields(machineProfiles[0]);
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
    el.machineProfileSelect.addEventListener("change", () => {
      fillMachineFields(currentMachineProfile());
      recalculate();
    });

    $("btnMachineNew").addEventListener("click", () => {
      const novo = {
        id: Storage.uid("machine"),
        nome: "Nova Máquina",
        potenciaW: 150,
        valorCompra: 1000,
        vidaUtilHoras: 5000,
      };
      machineProfiles.push(novo);
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
      el.machineProfileSelect.value = novo.id;
      fillMachineFields(novo);
      el.machineNome.focus();
      recalculate();
    });

    $("btnMachineSave").addEventListener("click", () => {
      const profile = currentMachineProfile();
      if (!profile) return;
      profile.nome = el.machineNome.value.trim() || "Sem nome";
      profile.potenciaW = numVal("machinePotencia");
      profile.valorCompra = numVal("machineValor");
      profile.vidaUtilHoras = Math.max(1, numVal("machineVidaUtil"));
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
      el.machineProfileSelect.value = profile.id;
      flashFeedback("Perfil de máquina salvo.");
      recalculate();
    });

    $("btnMachineDelete").addEventListener("click", () => {
      if (machineProfiles.length <= 1) {
        alert("Você precisa manter ao menos um perfil de máquina.");
        return;
      }
      const profile = currentMachineProfile();
      if (!confirm(`Excluir o perfil "${profile.nome}"?`)) return;
      machineProfiles = machineProfiles.filter((p) => p.id !== profile.id);
      Storage.saveMachineProfiles(machineProfiles);
      renderProfileSelect(el.machineProfileSelect, machineProfiles);
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
      recalculate();
    });
  }

  // ------------------------------------------------------------- Markup UI

  function bindMarkupToggle() {
    el.markupSelect.addEventListener("change", () => {
      el.customMarkupWrap.hidden = el.markupSelect.value !== "custom";
      recalculate();
    });
  }

  function currentMarkupPct() {
    return el.markupSelect.value === "custom" ? numVal("markupCustom") : parseFloat(el.markupSelect.value);
  }

  // --------------------------------------------------------- Cálculo (core)

  function gatherInput() {
    const machine = currentMachineProfile() || {};
    const material = currentMaterialProfile() || {};
    return {
      pesoPecaG: numVal("pesoPeca"),
      tempoHoras: numVal("tempoHoras"),
      tempoMinutos: numVal("tempoMinutos"),
      potenciaW: machine.potenciaW || 0,
      valorCompraMaquina: machine.valorCompra || 0,
      vidaUtilHoras: machine.vidaUtilHoras || 1,
      precoFilamentoKg: material.precoKg || 0,
      valorKwh: numVal("valorKwh"),
      prepMinutos: numVal("prepMinutos"),
      valorHoraTrabalho: numVal("valorHora"),
      custoEmbalagem: numVal("custoEmbalagem"),
      taxaFalhaPct: numVal("taxaFalha"),
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

    el.outCustoTotal.textContent = Calculator.formatarMoeda(r.custoAjustado);
    el.outLucroUnitario.textContent = Calculator.formatarMoeda(r.lucroUnitario);
    el.outQtdLabel.textContent = r.quantidade;
    el.outTotalQtd.textContent = Calculator.formatarMoeda(r.precoTotalQtd);
    el.outLucroTotal.textContent = Calculator.formatarMoeda(r.lucroTotalQtd);

    renderBreakdown(r);
    CostChart.render(r);

    // Persiste as configurações gerais (não os perfis) para a próxima sessão.
    Storage.saveSettings({
      valorKwh: input.valorKwh,
      valorHora: input.valorHoraTrabalho,
      markup: el.markupSelect.value,
      markupCustom: numVal("markupCustom"),
    });
  }

  function renderBreakdown(r) {
    const rows = [
      ["Filamento", r.custoFilamento],
      ["Energia", r.custoEnergia],
      ["Depreciação da máquina", r.custoDepreciacao],
      ["Mão de obra", r.custoMaoDeObra],
      ["Embalagem", r.custoEmbalagem],
      ["Custos extras", r.custosExtras],
    ];
    let html = rows.map(([label, value]) => `
      <li><span class="label">${label}</span><span class="value">${Calculator.formatarMoeda(value)}</span></li>
    `).join("");

    html += `<li><span class="label">Custo base</span><span class="value">${Calculator.formatarMoeda(r.custoBase)}</span></li>`;
    html += `<li><span class="label">Ajuste por taxa de falha</span><span class="value">${Calculator.formatarMoeda(r.custoAjustado - r.custoBase)}</span></li>`;
    html += `<li class="total"><span class="label">Custo total ajustado</span><span class="value">${Calculator.formatarMoeda(r.custoAjustado)}</span></li>`;

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
    const material = currentMaterialProfile();
    const linhas = [
      `🧾 Orçamento — ${nome}`,
      `Material: ${material ? material.nome : "-"}`,
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
      el.customMarkupWrap.hidden = el.markupSelect.value !== "custom";
      recalculate();
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
    el.markupSelect.value = s.markup;
    el.markupCustom.value = s.markupCustom;
    el.customMarkupWrap.hidden = s.markup !== "custom";
  }

  function init() {
    cacheElements();
    loadMachineProfiles();
    loadMaterialProfiles();
    applySavedSettings();
    bindProfileCrud();
    bindMarkupToggle();
    bindBackup();
    bindCopyBudget();
    bindReset();
    bindLiveRecalculation();

    document.addEventListener("calculaai:themechange", () => CostChart.refreshColors());

    recalculate();
  }

  return { init };
})();
