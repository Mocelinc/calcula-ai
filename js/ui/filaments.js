/* =========================================================================
   Calcula.AI — ui/filaments.js
   Tela Filamentos: o catálogo de materiais com preço por quilo. É a fonte
   de onde as linhas de filamento da peça (ui/material-rows.js) tiram nome
   e preço de partida.
   Público: UI.Filaments.{ load, bind, opcoesHtml, preco, perfil, existe, primeiroId }
   ========================================================================= */

UI.Filaments = (() => {
  const el = UI.el;
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;

  let perfis = [];

  function load() {
    perfis = Storage.getMaterialProfiles();
    renderList();
  }

  function renderList() {
    el.materialList.innerHTML = perfis.map((p) => `
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

  // ------------------------------------------- Consultas dos outros módulos

  function opcoesHtml(selectedId) {
    return perfis
      .map((p) => `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${escapeHtml(p.nome)}</option>`)
      .join("");
  }

  function preco(profileId) {
    const p = perfis.find((m) => m.id === profileId);
    return p ? p.precoKg : 0;
  }

  function perfil(profileId) { return perfis.find((p) => p.id === profileId); }

  function existe(profileId) { return perfis.some((p) => p.id === profileId); }

  function primeiroId() { return perfis[0] ? perfis[0].id : ""; }

  // ------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddMaterial").addEventListener("click", () => {
      perfis.push({ id: Storage.uid("material"), nome: "Novo filamento", precoKg: 0 });
      Storage.saveMaterialProfiles(perfis);
      renderList();
      UI.MaterialRows.refresh();
      UI.recalc();
    });

    el.materialList.addEventListener("input", (e) => {
      const item = e.target.closest(".profile-item");
      if (!item) return;
      const profile = perfis.find((p) => p.id === item.dataset.id);
      if (!profile) return;

      if (e.target.classList.contains("pf-nome")) profile.nome = e.target.value.trim() || "Sem nome";
      if (e.target.classList.contains("pf-preco")) profile.precoKg = Math.max(0, parseFloat(e.target.value) || 0);

      Storage.saveMaterialProfiles(perfis);
      UI.MaterialRows.refresh();
      UI.recalc();
    });

    el.materialList.addEventListener("click", (e) => {
      if (!e.target.closest(".pf-del")) return;
      if (perfis.length <= 1) {
        alert("Você precisa manter ao menos um filamento cadastrado.");
        return;
      }
      const item = e.target.closest(".profile-item");
      const profile = perfis.find((p) => p.id === item.dataset.id);
      if (!confirm(`Excluir "${profile.nome}"?`)) return;
      perfis = perfis.filter((p) => p.id !== profile.id);
      Storage.saveMaterialProfiles(perfis);
      renderList();
      UI.MaterialRows.refresh();
      UI.recalc();
    });
  }

  return { load, bind, opcoesHtml, preco, perfil, existe, primeiroId };
})();
