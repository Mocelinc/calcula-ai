/* =========================================================================
   Calcula.AI — ui/rolos.js
   Tela Estoque: um cartão por rolo de filamento, com peso restante, custo
   por grama e barra de estoque. O peso restante nunca é digitado — ele sai
   do peso inicial menos o que as impressões registradas consumiram.
   Público: UI.Rolos.{ load, bind, lista, rolo, preco, opcoesHtml, existe, primeiroId, estado }
   ========================================================================= */

UI.Rolos = (() => {
  const el = UI.el;
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;

  let rolos = [];

  function load() {
    rolos = Storage.getRolos();
    render();
  }

  function registros() { return Storage.getRegistros(); }
  function config() { return Storage.getNegocio(); }

  function estado(rolo) { return Negocio.estadoDoRolo(rolo, registros(), config()); }

  // --------------------------------------------------------------- Desenho

  const ROTULO = { ok: "Em uso", baixo: "Estoque baixo", esgotado: "Esgotado" };

  function render() {
    const regs = registros();
    const cfg = config();

    el.materialList.innerHTML = rolos.map((p) => {
      const e = Negocio.estadoDoRolo(p, regs, cfg);
      const aviso = e.diasRestantes !== null && e.diasRestantes <= cfg.alertaTerminoDias
        ? `<span class="profile-badge alerta">Acaba em ~${e.diasRestantes} dia${e.diasRestantes === 1 ? "" : "s"}</span>` : "";
      return `
      <div class="profile-item rolo-item" data-id="${p.id}">
        <div class="profile-item-head">
          <input type="text" class="pf-nome" value="${escapeHtml(p.nome)}" aria-label="Nome do rolo" />
          <span class="selo selo-${e.status}">${ROTULO[e.status]}</span>
          <button type="button" class="btn btn-icon btn-danger pf-del" title="Excluir rolo">🗑️</button>
        </div>

        <div class="barra-estoque" title="${e.pct.toFixed(0)}% restante">
          <div class="barra-estoque-fill nivel-${e.status}" style="width:${Math.max(0, Math.min(100, e.pct))}%"></div>
        </div>
        <div class="rolo-numeros">
          <span><strong>${e.restante.toFixed(0)} g</strong> de ${e.inicial.toFixed(0)} g</span>
          <span>${Calculator.formatarMoeda(e.custoKg)}/kg</span>
          <span>${e.usado.toFixed(0)} g já usados</span>
        </div>

        <div class="profile-fields three-col">
          <label>Material
            <input type="text" class="pf-material" value="${escapeHtml(p.material || "")}" placeholder="PLA" />
          </label>
          <label>Cor
            <input type="text" class="pf-cor" value="${escapeHtml(p.cor || "")}" placeholder="Preto" />
          </label>
          <label>Marca
            <input type="text" class="pf-marca" value="${escapeHtml(p.marca || "")}" placeholder="Voolt3D" />
          </label>
        </div>
        <div class="profile-fields three-col">
          <label>Peso do rolo (g)
            <input type="number" class="pf-peso" min="0" step="1" value="${p.pesoInicialG}" />
          </label>
          <label>Custo pago (R$)
            <input type="number" class="pf-custo" min="0" step="0.01" value="${p.custoTotal}" />
          </label>
          <label>Data da compra
            <input type="date" class="pf-data" value="${escapeHtml(p.dataCompra || "")}" />
          </label>
        </div>
        ${aviso}
      </div>`;
    }).join("");

    renderResumo();
  }

  /** Faixa de resumo no topo: quanto de filamento existe e quanto vale. */
  function renderResumo() {
    const alvo = $("resumoEstoque");
    if (!alvo) return;
    const regs = registros(), cfg = config();
    let gramas = 0, valor = 0, baixos = 0;
    rolos.forEach((p) => {
      const e = Negocio.estadoDoRolo(p, regs, cfg);
      gramas += e.restante;
      valor += e.restante * e.custoG;
      if (e.status !== "ok") baixos++;
    });
    alvo.innerHTML = `
      <div class="resumo-item"><span>Rolos</span><strong>${rolos.length}</strong></div>
      <div class="resumo-item"><span>Filamento em estoque</span><strong>${(gramas / 1000).toFixed(2)} kg</strong></div>
      <div class="resumo-item"><span>Valor parado</span><strong>${Calculator.formatarMoeda(valor)}</strong></div>
      <div class="resumo-item ${baixos ? "atencao" : ""}"><span>Precisam de atenção</span><strong>${baixos}</strong></div>`;
  }

  // ------------------------------------------- Consultas dos outros módulos

  function lista() { return rolos; }
  function rolo(id) { return rolos.find((p) => p.id === id); }
  function preco(id) { return Negocio.custoPorKg(rolo(id)); }
  function existe(id) { return rolos.some((p) => p.id === id); }
  function primeiroId() { return rolos[0] ? rolos[0].id : ""; }

  function opcoesHtml(selecionado) {
    return rolos.map((p) => {
      const e = estado(p);
      const sufixo = e.status === "esgotado" ? " (esgotado)" : "";
      return `<option value="${p.id}"${p.id === selecionado ? " selected" : ""}>${escapeHtml(p.nome)}${sufixo}</option>`;
    }).join("");
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddMaterial").addEventListener("click", () => {
      rolos.push({
        id: Storage.uid("rolo"), nome: "Novo rolo", material: "PLA", cor: "", marca: "",
        pesoInicialG: 1000, custoTotal: 0, dataCompra: new Date().toISOString().slice(0, 10),
        fornecedor: "", ativo: true,
      });
      Storage.saveRolos(rolos);
      render();
      UI.MaterialRows.refresh();
      UI.recalc();
    });

    el.materialList.addEventListener("input", (e) => {
      const item = e.target.closest(".profile-item");
      if (!item) return;
      const p = rolo(item.dataset.id);
      if (!p) return;
      const v = e.target.value;
      if (e.target.classList.contains("pf-nome")) p.nome = v.trim() || "Sem nome";
      if (e.target.classList.contains("pf-material")) p.material = v;
      if (e.target.classList.contains("pf-cor")) p.cor = v;
      if (e.target.classList.contains("pf-marca")) p.marca = v;
      if (e.target.classList.contains("pf-peso")) p.pesoInicialG = Math.max(0, parseFloat(v) || 0);
      if (e.target.classList.contains("pf-custo")) p.custoTotal = Math.max(0, parseFloat(v) || 0);
      if (e.target.classList.contains("pf-data")) p.dataCompra = v;

      Storage.saveRolos(rolos);
      renderResumo();
      UI.MaterialRows.refresh();
      UI.recalc();
    });

    el.materialList.addEventListener("click", (e) => {
      if (!e.target.closest(".pf-del")) return;
      if (rolos.length <= 1) {
        alert("Você precisa manter ao menos um rolo cadastrado.");
        return;
      }
      const item = e.target.closest(".profile-item");
      const p = rolo(item.dataset.id);
      const usos = Storage.getRegistros().filter((r) => r.roloId === p.id).length;
      const aviso = usos
        ? `"${p.nome}" aparece em ${usos} registro${usos === 1 ? "" : "s"} de impressão. Excluir o rolo mantém os registros, mas eles ficam sem filamento. Continuar?`
        : `Excluir "${p.nome}"?`;
      if (!confirm(aviso)) return;
      rolos = rolos.filter((r) => r.id !== p.id);
      Storage.saveRolos(rolos);
      render();
      UI.MaterialRows.refresh();
      UI.recalc();
    });
  }

  /** Redesenha quando outra tela mexe no consumo (um registro novo, por exemplo). */
  function atualizar() { render(); }

  return { load, bind, lista, rolo, preco, opcoesHtml, existe, primeiroId, estado, atualizar };
})();
