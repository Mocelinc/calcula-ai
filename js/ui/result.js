/* =========================================================================
   Calcula.AI — ui/result.js
   O painel de resultados: dispara o cálculo, escreve os números na tela,
   monta o detalhamento de custos e o texto do "Copiar orçamento".
   Todo mundo chega aqui por UI.recalc().
   Público: UI.Result.{ bind, recalcular, ultimo }
   ========================================================================= */

UI.Result = (() => {
  const el = UI.el;
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;
  const formatGramas = UI.formatGramas;
  const formatTempo = UI.formatTempo;

  let lastResult = null;

  function recalcular() {
    const input = UI.Calc.entrada();
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
    UI.Calc.syncLote();

    const pctLucro = r.precoFinal > 0 ? Math.max(0, Math.min(100, (r.lucroFinal / r.precoFinal) * 100)) : 0;
    el.ratioBarFill.style.width = `${pctLucro}%`;
    el.ratioBarLabel.textContent = `${Math.round(pctLucro)}% do preço é lucro`;

    el.pesoTotalDisplay.textContent = formatGramas(r.pesoTotalG);
    el.outCustoTotal.textContent = Calculator.formatarMoeda(r.custoAjustado);
    el.outLucroUnitario.textContent = Calculator.formatarMoeda(r.lucroUnitario);
    el.outTempoTotal.textContent = formatTempo(r.tempoImpressaoH);
    el.outPesoTotalStat.textContent = formatGramas(r.pesoTotalG);

    UI.Printers.hint();
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
    const machine = UI.Printers.atual();
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

  // ------------------------------------------------------ Copiar orçamento

  function bind() {
    $("btnCopyBudget").addEventListener("click", async () => {
      if (!lastResult) return;
      const texto = buildBudgetText(lastResult);
      try {
        await navigator.clipboard.writeText(texto);
        UI.flash("Orçamento copiado! Cole no WhatsApp do cliente.");
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

  return { bind, recalcular, ultimo: () => lastResult };
})();
