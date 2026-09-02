/* =========================================================================
   Calcula.AI — chart.js
   Gráfico de rosca (Doughnut) com a composição do custo final,
   usando Chart.js (carregado via CDN em index.html).
   ========================================================================= */

const CostChart = (() => {
  let chartInstance = null;

  const LABELS = ["Filamento", "Energia", "Depreciação", "Operacional/Extras", "Lucro"];

  function _cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function _colors() {
    return [
      _cssVar("--chart-filamento"),
      _cssVar("--chart-energia"),
      _cssVar("--chart-depreciacao"),
      _cssVar("--chart-operacional"),
      _cssVar("--chart-lucro"),
    ];
  }

  function _buildDataset(result) {
    const operacional = result.custoMaoDeObra + result.custoEmbalagem + result.custosExtras;
    return [
      result.custoFilamento,
      result.custoEnergia,
      result.custoDepreciacao,
      operacional,
      Math.max(0, result.lucroFinal),
    ];
  }

  function render(result) {
    const canvas = document.getElementById("costChart");
    if (!canvas || typeof Chart === "undefined") return; // Chart.js ainda carregando

    const data = _buildDataset(result);
    const colors = _colors();

    if (!chartInstance) {
      chartInstance = new Chart(canvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: LABELS,
          datasets: [{
            data,
            backgroundColor: colors,
            borderColor: _cssVar("--surface"),
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false }, // legenda customizada em HTML
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${Calculator.formatarMoeda(ctx.raw)}`,
              },
            },
          },
        },
      });
    } else {
      chartInstance.data.datasets[0].data = data;
      chartInstance.data.datasets[0].backgroundColor = colors;
      chartInstance.data.datasets[0].borderColor = _cssVar("--surface");
      chartInstance.update("none"); // sem animação em cada tecla digitada
    }

    _renderLegend(LABELS, colors, data);
  }

  function _renderLegend(labels, colors, data) {
    const legendEl = document.getElementById("chartLegend");
    if (!legendEl) return;
    legendEl.innerHTML = labels.map((label, i) => `
      <li>
        <span class="dot" style="background:${colors[i]}"></span>
        <span>${label}</span>
        <span class="legend-val">${Calculator.formatarMoeda(data[i])}</span>
      </li>
    `).join("");
  }

  /** Re-renderiza cores quando o tema muda (mesmo sem novos dados). */
  function refreshColors() {
    if (!chartInstance) return;
    const colors = _colors();
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.data.datasets[0].borderColor = _cssVar("--surface");
    chartInstance.update("none");
    _renderLegend(LABELS, colors, chartInstance.data.datasets[0].data);
  }

  return { render, refreshColors };
})();
