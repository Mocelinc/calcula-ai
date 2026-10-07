/* =========================================================================
   Calcula.AI — ui/despesas.js
   Tela Despesas: tudo que saiu do caixa, por categoria e fornecedor.
   É o outro lado da conta no painel: o lucro das vendas menos o que foi
   gasto no mesmo período dá o resultado de verdade.
   Público: UI.Despesas.{ load, bind, lista, atualizar }
   ========================================================================= */

UI.Despesas = (() => {
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;
  const moeda = (v) => Calculator.formatarMoeda(v);

  let despesas = [];
  let editando = null;

  function load() {
    despesas = Storage.getDespesas();
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    if ($("despesaDe") && !$("despesaDe").value) $("despesaDe").value = inicioMes.toISOString().slice(0, 10);
    if ($("despesaAte") && !$("despesaAte").value) $("despesaAte").value = hoje.toISOString().slice(0, 10);
    render();
  }

  function lista() { return despesas; }

  function total(d) { return (Number(d.valorUnit) || 0) * Math.max(1, Number(d.qtd) || 1); }

  // --------------------------------------------------------------- Desenho

  function filtradas() {
    const de = $("despesaDe").value, ate = $("despesaAte").value;
    const cat = $("despesaFiltroCat").value;
    return despesas
      .filter((d) => Negocio.dentroDoPeriodo(d.data, de, ate))
      .filter((d) => !cat || d.categoria === cat)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  function render() {
    const corpo = $("corpoDespesas");
    if (!corpo) return;

    atualizarCategorias();
    const linhas = filtradas();
    $("vazioDespesas").hidden = linhas.length > 0;

    corpo.innerHTML = linhas.map((d) => `
      <tr data-id="${d.id}">
        <td>${formatarData(d.data)}</td>
        <td><strong>${escapeHtml(d.descricao || "—")}</strong></td>
        <td>${d.categoria ? `<span class="selo">${escapeHtml(d.categoria)}</span>` : "—"}</td>
        <td>${escapeHtml(d.fornecedor || "—")}</td>
        <td class="num">${Math.max(1, Number(d.qtd) || 1)}</td>
        <td class="num">${moeda(d.valorUnit)}</td>
        <td class="num"><strong>${moeda(total(d))}</strong></td>
        <td class="acoes">
          <button type="button" class="btn btn-icon desp-editar" title="Editar">✏️</button>
          <button type="button" class="btn btn-icon btn-danger desp-excluir" title="Excluir">🗑️</button>
        </td>
      </tr>`).join("");

    renderResumo(linhas);
  }

  function renderResumo(linhas) {
    const alvo = $("resumoDespesas");
    if (!alvo) return;
    const soma = linhas.reduce((s, d) => s + total(d), 0);
    const porCat = Negocio.despesasPorCategoria(linhas, "", "");
    const maior = porCat[0];
    alvo.innerHTML = `
      <div class="resumo-item"><span>Total no período</span><strong>${moeda(soma)}</strong></div>
      <div class="resumo-item"><span>Lançamentos</span><strong>${linhas.length}</strong></div>
      <div class="resumo-item"><span>Maior categoria</span><strong>${maior ? escapeHtml(maior.categoria) : "—"}</strong></div>
      <div class="resumo-item"><span>Nessa categoria</span><strong>${maior ? moeda(maior.valor) : "—"}</strong></div>`;
  }

  function atualizarCategorias() {
    const sel = $("despesaFiltroCat");
    if (!sel) return;
    const atual = sel.value;
    const cats = [...new Set(despesas.map((d) => d.categoria).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todas</option>' +
      cats.map((c) => `<option value="${escapeHtml(c)}"${c === atual ? " selected" : ""}>${escapeHtml(c)}</option>`).join("");
  }

  function formatarData(iso) {
    if (!iso) return "—";
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  // ---------------------------------------------------------------- Janela

  function abrir(d) {
    editando = d || null;
    $("tituloDespesa").textContent = d ? "Editar despesa" : "Lançar despesa";
    $("despData").value = d ? d.data : new Date().toISOString().slice(0, 10);
    $("despCategoria").value = d ? (d.categoria || "") : "";
    $("despDescricao").value = d ? (d.descricao || "") : "";
    $("despFornecedor").value = d ? (d.fornecedor || "") : "";
    $("despQtd").value = d ? (d.qtd || 1) : 1;
    $("despValor").value = d ? (d.valorUnit || 0) : 0;
    previa();
    $("dlgDespesa").showModal();
  }

  function previa() {
    const q = Math.max(1, parseInt($("despQtd").value, 10) || 1);
    const v = Math.max(0, parseFloat($("despValor").value) || 0);
    $("previaDespesa").textContent = q > 1 ? `Total: ${moeda(q * v)} (${q} × ${moeda(v)})` : `Total: ${moeda(v)}`;
  }

  function salvar(e) {
    e.preventDefault();
    const dados = {
      data: $("despData").value,
      categoria: $("despCategoria").value.trim(),
      descricao: $("despDescricao").value.trim() || "Sem descrição",
      fornecedor: $("despFornecedor").value.trim(),
      qtd: Math.max(1, parseInt($("despQtd").value, 10) || 1),
      valorUnit: Math.max(0, parseFloat($("despValor").value) || 0),
    };

    if (editando) Object.assign(editando, dados);
    else despesas.push({ id: Storage.uid("desp"), ...dados });

    Storage.saveDespesas(despesas);
    $("dlgDespesa").close();
    editando = null;
    render();
    UI.Painel.atualizar();
    UI.flash("Despesa salva.");
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddDespesa").addEventListener("click", () => abrir(null));
    $("formDespesa").addEventListener("submit", salvar);
    $("despQtd").addEventListener("input", previa);
    $("despValor").addEventListener("input", previa);

    ["despesaDe", "despesaAte", "despesaFiltroCat"].forEach((id) => {
      $(id).addEventListener("change", render);
    });

    $("corpoDespesas").addEventListener("click", (e) => {
      const linha = e.target.closest("tr");
      if (!linha) return;
      const d = despesas.find((x) => x.id === linha.dataset.id);
      if (!d) return;

      if (e.target.closest(".desp-editar")) abrir(d);

      if (e.target.closest(".desp-excluir")) {
        if (!confirm(`Excluir "${d.descricao}"?`)) return;
        despesas = despesas.filter((x) => x.id !== d.id);
        Storage.saveDespesas(despesas);
        render();
        UI.Painel.atualizar();
      }
    });
  }

  function atualizar() { render(); }

  return { load, bind, lista, atualizar };
})();
