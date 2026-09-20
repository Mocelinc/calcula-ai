/* =========================================================================
   Calcula.AI — ui/printers.js
   Tela Impressoras: catálogo de máquinas (consumo, valor de compra e vida
   útil) e o seletor que a calculadora usa. Grava sozinho a cada digitação.
   Público: UI.Printers.{ load, bind, atual, hint, renderSelect }
   ========================================================================= */

UI.Printers = (() => {
  const el = UI.el;
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;

  let perfis = [];

  function load() {
    perfis = Storage.getMachineProfiles();
    renderSelect();
    renderList();
  }

  function renderSelect() {
    const prev = el.machineProfileSelect.value;
    el.machineProfileSelect.innerHTML = perfis
      .map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join("");
    if (perfis.some((p) => p.id === prev)) el.machineProfileSelect.value = prev;
    hint();
  }

  function hint() {
    const m = atual();
    el.machineHint.textContent = m ? `${m.potenciaW} W · ${Calculator.formatarMoeda(m.valorCompra)}` : "";
  }

  /** A impressora escolhida no seletor da calculadora. */
  function atual() {
    return perfis.find((p) => p.id === el.machineProfileSelect.value) || perfis[0];
  }

  function renderList() {
    el.machineList.innerHTML = perfis.map((p) => `
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

  function bind() {
    $("btnAddMachine").addEventListener("click", () => {
      perfis.push({
        id: Storage.uid("machine"),
        nome: "Nova impressora",
        potenciaW: 0,
        valorCompra: 0,
        vidaUtilHoras: 8000, // estimativa de partida — ajustável
      });
      Storage.saveMachineProfiles(perfis);
      renderList();
      renderSelect();
      UI.recalc();
    });

    // Auto-save: qualquer digitação já grava no localStorage.
    el.machineList.addEventListener("input", (e) => {
      const item = e.target.closest(".profile-item");
      if (!item) return;
      const profile = perfis.find((p) => p.id === item.dataset.id);
      if (!profile) return;

      if (e.target.classList.contains("pf-nome")) profile.nome = e.target.value.trim() || "Sem nome";
      if (e.target.classList.contains("pf-potencia")) profile.potenciaW = Math.max(0, parseFloat(e.target.value) || 0);
      if (e.target.classList.contains("pf-valor")) profile.valorCompra = Math.max(0, parseFloat(e.target.value) || 0);
      if (e.target.classList.contains("pf-vida")) profile.vidaUtilHoras = Math.max(0, parseFloat(e.target.value) || 0);

      Storage.saveMachineProfiles(perfis);
      renderSelect();
      UI.recalc();
    });

    el.machineList.addEventListener("click", (e) => {
      if (!e.target.closest(".pf-del")) return;
      if (perfis.length <= 1) {
        alert("Você precisa manter ao menos uma impressora cadastrada.");
        return;
      }
      const item = e.target.closest(".profile-item");
      const profile = perfis.find((p) => p.id === item.dataset.id);
      if (!confirm(`Excluir "${profile.nome}"?`)) return;
      perfis = perfis.filter((p) => p.id !== profile.id);
      Storage.saveMachineProfiles(perfis);
      renderList();
      renderSelect();
      UI.recalc();
    });
  }

  return { load, bind, atual, hint, renderSelect };
})();
