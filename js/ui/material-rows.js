/* =========================================================================
   Calcula.AI — ui/material-rows.js
   Os filamentos usados na peça, dentro da calculadora. Multi-material:
   cada linha é um filamento com peso e preço/kg próprios. O preço vem do
   catálogo (ui/filaments.js) mas pode ser editado só naquele orçamento.
   Público: UI.MaterialRows.{ bind, reset, refresh, ler, adicionar }
   ========================================================================= */

UI.MaterialRows = (() => {
  const el = UI.el;
  const $ = UI.$;

  /**
   * O preço da linha vem preenchido do catálogo, mas é editável: serve para
   * um "e se este rolo custasse X?" sem sujar o cadastro. O valor de origem
   * fica em data-base-preco para sabermos se houve edição manual.
   */
  function adicionar(profileId, pesoG, precoKg) {
    const base = UI.Filaments.preco(profileId);
    const preco = precoKg === undefined ? base : precoKg;

    const row = document.createElement("div");
    row.className = "material-row";
    row.dataset.basePreco = String(base);
    row.innerHTML = `
      <select class="material-row-select" aria-label="Filamento desta linha">${UI.Filaments.opcoesHtml(profileId)}</select>
      <input type="number" class="material-row-peso" min="0" step="0.1" value="${pesoG}" aria-label="Peso deste filamento (g)" />
      <input type="number" class="material-row-preco" min="0" step="0.01" value="${preco}" aria-label="Preço por quilo deste filamento" />
      <button type="button" class="btn btn-icon btn-danger material-row-remove" title="Remover filamento">🗑️</button>
    `;
    el.materialRows.appendChild(row);
    marcarPrecoEditado(row);
  }

  /** Destaca o campo quando o preço difere do que está salvo no catálogo. */
  function marcarPrecoEditado(rowEl) {
    const input = rowEl.querySelector(".material-row-preco");
    const base = parseFloat(rowEl.dataset.basePreco);
    const atual = parseFloat(input.value);
    const editado = Number.isFinite(atual) && Number.isFinite(base) && Math.abs(atual - base) > 0.0001;
    input.classList.toggle("is-overridden", editado);
    input.title = editado
      ? "Preço só deste orçamento — o catálogo continua com " + Calculator.formatarMoeda(base) + "/kg"
      : "Preço vindo do catálogo de filamentos";
  }

  function reset() {
    el.materialRows.innerHTML = "";
    adicionar(UI.Filaments.primeiroId(), 0);
  }

  /**
   * Reconstrói as <option> quando o catálogo muda. Linhas com preço não
   * editado acompanham o novo valor; as editadas mantêm o override.
   */
  function refresh() {
    el.materialRows.querySelectorAll(".material-row").forEach((rowEl) => {
      const select = rowEl.querySelector(".material-row-select");
      const precoInput = rowEl.querySelector(".material-row-preco");
      const prev = select.value;
      const id = UI.Filaments.existe(prev) ? prev : UI.Filaments.primeiroId();
      select.innerHTML = UI.Filaments.opcoesHtml(id);

      const baseAntiga = parseFloat(rowEl.dataset.basePreco);
      const baseNova = UI.Filaments.preco(id);
      const naoEditado = Math.abs(parseFloat(precoInput.value) - baseAntiga) < 0.0001;
      rowEl.dataset.basePreco = String(baseNova);
      if (naoEditado) precoInput.value = baseNova;
      marcarPrecoEditado(rowEl);
    });
  }

  /** O que a calculadora consome: nome, preço/kg e peso de cada linha. */
  function ler() {
    return Array.from(el.materialRows.querySelectorAll(".material-row")).map((rowEl) => {
      const select = rowEl.querySelector(".material-row-select");
      const profile = UI.Filaments.perfil(select.value);
      const pesoG = parseFloat(rowEl.querySelector(".material-row-peso").value);
      const precoKg = parseFloat(rowEl.querySelector(".material-row-preco").value);
      return {
        nome: profile ? profile.nome : "Material",
        precoKg: Number.isFinite(precoKg) ? precoKg : 0,
        pesoG: Number.isFinite(pesoG) ? pesoG : 0,
      };
    });
  }

  function bind() {
    $("btnAddMaterialRow").addEventListener("click", () => {
      adicionar(UI.Filaments.primeiroId(), 0);
      UI.recalc();
    });

    // Trocar de filamento repõe o preço do novo perfil (descarta o override).
    el.materialRows.addEventListener("change", (e) => {
      if (!e.target.classList.contains("material-row-select")) return;
      const rowEl = e.target.closest(".material-row");
      const base = UI.Filaments.preco(e.target.value);
      rowEl.dataset.basePreco = String(base);
      rowEl.querySelector(".material-row-preco").value = base;
      marcarPrecoEditado(rowEl);
    });

    el.materialRows.addEventListener("input", (e) => {
      if (!e.target.classList.contains("material-row-preco")) return;
      marcarPrecoEditado(e.target.closest(".material-row"));
    });

    el.materialRows.addEventListener("click", (e) => {
      if (!e.target.closest(".material-row-remove")) return;
      if (el.materialRows.querySelectorAll(".material-row").length <= 1) {
        alert("A peça precisa ter ao menos um filamento.");
        return;
      }
      e.target.closest(".material-row").remove();
      UI.recalc();
    });
  }

  return { bind, reset, refresh, ler, adicionar };
})();
