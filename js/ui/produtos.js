/* =========================================================================
   Calcula.AI — ui/produtos.js
   Tela Produtos: o que você imprime, com preço de venda e custo médio.
   O custo médio é calculado pelas impressões já registradas, então ele
   acompanha a realidade em vez de ficar preso ao que foi digitado uma vez.
   Público: UI.Produtos.{ load, bind, lista, produto, opcoesHtml, salvarDaCalculadora, atualizar }
   ========================================================================= */

UI.Produtos = (() => {
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;

  let produtos = [];
  let editando = null;

  function load() {
    produtos = Storage.getProdutos();
    render();
  }

  function lista() { return produtos; }
  function produto(id) { return produtos.find((p) => p.id === id); }

  function custoMedio(p) {
    const calculado = Negocio.custoMedioDoProduto(p.id, Storage.getRegistros(), UI.Rolos.lista());
    return calculado || Number(p.custoMedio) || 0;
  }

  // --------------------------------------------------------------- Desenho

  function render() {
    const corpo = $("corpoProdutos");
    const vazio = $("vazioProdutos");
    if (!corpo) return;

    vazio.hidden = produtos.length > 0;
    corpo.innerHTML = produtos.map((p) => {
      const custo = custoMedio(p);
      const preco = Number(p.precoPadrao) || 0;
      const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
      const classeMargem = preco <= 0 ? "" : margem < 20 ? "ruim" : margem < 50 ? "media" : "boa";
      return `
        <tr data-id="${p.id}">
          <td>
            <strong>${escapeHtml(p.nome)}</strong>
            ${p.obs ? `<span class="sub">${escapeHtml(p.obs)}</span>` : ""}
          </td>
          <td><span class="selo selo-${p.categoria === "venda" ? "venda" : "pessoal"}">${p.categoria === "venda" ? "Venda" : "Uso pessoal"}</span></td>
          <td class="num">${preco > 0
            ? Calculator.formatarMoeda(preco)
            : p.precoSugerido
              ? `<span class="sugerido">a definir<span class="sub">sugestão ${Calculator.formatarMoeda(p.precoSugerido)}</span></span>`
              : "a definir"}</td>
          <td class="num">${custo > 0 ? Calculator.formatarMoeda(custo) : "—"}</td>
          <td class="num ${classeMargem}">${preco > 0 ? margem.toFixed(0) + "%" : "—"}</td>
          <td>${p.ativo === false ? "Não" : "Sim"}</td>
          <td class="acoes">
            <button type="button" class="btn btn-icon prod-editar" title="Editar">✏️</button>
            <button type="button" class="btn btn-icon btn-danger prod-excluir" title="Excluir">🗑️</button>
          </td>
        </tr>`;
    }).join("");
  }

  function opcoesHtml(selecionado) {
    return produtos
      .filter((p) => p.ativo !== false || p.id === selecionado)
      .map((p) => `<option value="${p.id}"${p.id === selecionado ? " selected" : ""}>${escapeHtml(p.nome)}</option>`)
      .join("");
  }

  // ---------------------------------------------------------------- Janela

  function abrir(p) {
    editando = p || null;
    $("tituloProduto").textContent = p ? "Editar produto" : "Novo produto";
    $("prodNome").value = p ? p.nome : "";
    $("prodCategoria").value = p ? (p.categoria || "venda") : "venda";
    // Campo vazio quer dizer "preço ainda a definir" — a sugestão da
    // calculadora fica só como dica dentro do campo.
    $("prodPreco").value = p && p.precoPadrao ? p.precoPadrao : "";
    $("prodPreco").placeholder = p && p.precoSugerido
      ? `a definir — sugestão ${p.precoSugerido.toFixed(2)}`
      : "a definir";
    $("prodCusto").value = p ? (p.custoMedio || 0) : 0;
    $("prodAtivo").value = p && p.ativo === false ? "nao" : "sim";
    $("prodObs").value = p ? (p.obs || "") : "";
    $("dlgProduto").showModal();
  }

  function salvar(e) {
    e.preventDefault();
    const dados = {
      nome: $("prodNome").value.trim() || "Sem nome",
      categoria: $("prodCategoria").value,
      precoPadrao: Math.max(0, parseFloat($("prodPreco").value) || 0),
      custoMedio: Math.max(0, parseFloat($("prodCusto").value) || 0),
      ativo: $("prodAtivo").value === "sim",
      obs: $("prodObs").value.trim(),
    };

    if (editando) Object.assign(editando, dados);
    else produtos.push({ id: Storage.uid("prod"), ...dados });

    Storage.saveProdutos(produtos);
    $("dlgProduto").close();
    render();
    UI.Vendas.atualizarListas();
    UI.flash(editando ? "Produto atualizado." : "Produto cadastrado.");
    editando = null;
  }

  /**
   * Atalho da calculadora: o orçamento vira produto já com o custo de
   * produção. O preço de venda fica em branco de propósito — ele é decidido
   * na hora de vender, e o valor sugerido fica guardado só como referência.
   */
  function salvarDaCalculadora({ nome, custoUnitario, pesoG, precoSugerido }) {
    const novo = {
      id: Storage.uid("prod"),
      nome: nome || "Peça sem nome",
      categoria: "venda",
      precoPadrao: 0,
      precoSugerido: Math.max(0, precoSugerido || 0),
      custoMedio: Math.max(0, custoUnitario || 0),
      pesoG: Math.max(0, pesoG || 0),
      ativo: true,
      obs: "",
    };
    produtos.push(novo);
    Storage.saveProdutos(produtos);
    render();
    UI.Vendas.atualizarListas();
    return novo;
  }

  /** Usado quando o preço é definido na venda e você manda guardar. */
  function definirPreco(id, preco) {
    const p = produto(id);
    if (!p) return;
    p.precoPadrao = Math.max(0, preco || 0);
    Storage.saveProdutos(produtos);
    render();
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddProduto").addEventListener("click", () => abrir(null));
    $("formProduto").addEventListener("submit", salvar);

    $("corpoProdutos").addEventListener("click", (e) => {
      const linha = e.target.closest("tr");
      if (!linha) return;
      const p = produto(linha.dataset.id);
      if (!p) return;

      if (e.target.closest(".prod-editar")) abrir(p);

      if (e.target.closest(".prod-excluir")) {
        const usos = Storage.getRegistros().filter((r) => r.produtoId === p.id).length;
        const aviso = usos
          ? `"${p.nome}" aparece em ${usos} registro${usos === 1 ? "" : "s"}. Os registros continuam, mas sem o produto. Excluir?`
          : `Excluir "${p.nome}"?`;
        if (!confirm(aviso)) return;
        produtos = produtos.filter((x) => x.id !== p.id);
        Storage.saveProdutos(produtos);
        render();
        UI.Vendas.atualizarListas();
      }
    });
  }

  function atualizar() { render(); }

  return { load, bind, lista, produto, opcoesHtml, salvarDaCalculadora, definirPreco, atualizar, custoMedio };
})();
