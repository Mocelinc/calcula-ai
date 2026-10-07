/* =========================================================================
   Calcula.AI — ui/vendas.js
   Tela Vendas e impressões: cada linha é uma impressão que aconteceu.
   É ela que amarra o resto — consome gramas do rolo, usa o custo do
   produto e alimenta o faturamento. Uso pessoal entra aqui também, mas
   só como consumo: não vira receita nem lucro.
   Público: UI.Vendas.{ load, bind, atualizarListas, registros, atualizar }
   ========================================================================= */

UI.Vendas = (() => {
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;
  const moeda = (v) => Calculator.formatarMoeda(v);

  let registros = [];
  let editando = null;

  function load() {
    registros = Storage.getRegistros();
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    if ($("vendaDe") && !$("vendaDe").value) $("vendaDe").value = inicioMes.toISOString().slice(0, 10);
    if ($("vendaAte") && !$("vendaAte").value) $("vendaAte").value = hoje.toISOString().slice(0, 10);
    render();
  }

  function lista() { return registros; }

  // -------------------------------------------------------------- Filtros

  function filtrados() {
    const de = $("vendaDe").value, ate = $("vendaAte").value;
    const tipo = $("vendaFiltroTipo").value, status = $("vendaFiltroStatus").value;
    return registros
      .filter((r) => Negocio.dentroDoPeriodo(r.data, de, ate))
      .filter((r) => !tipo || r.tipo === tipo)
      .filter((r) => !status || r.statusPagamento === status)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  // --------------------------------------------------------------- Desenho

  const SELO_PGTO = { pago: "Pago", pendente: "Pendente", parcial: "Parcial" };

  function render() {
    const corpo = $("corpoVendas");
    if (!corpo) return;
    const linhas = filtrados();
    $("vazioVendas").hidden = linhas.length > 0;

    corpo.innerHTML = linhas.map((reg) => {
      const rolo = UI.Rolos.rolo(reg.roloId);
      const prod = UI.Produtos.produto(reg.produtoId);
      const t = Negocio.totaisDoRegistro(reg, rolo);
      const venda = reg.tipo === "venda";
      return `
        <tr data-id="${reg.id}" class="${venda ? "" : "linha-pessoal"}">
          <td>${formatarData(reg.data)}</td>
          <td><span class="selo selo-${venda ? "venda" : "pessoal"}">${venda ? "Venda" : "Pessoal"}</span></td>
          <td>${escapeHtml(reg.cliente || "—")}</td>
          <td>${escapeHtml(prod ? prod.nome : reg.produtoNome || "—")}</td>
          <td class="num">${t.qtd}</td>
          <td>${escapeHtml(rolo ? rolo.nome : "—")}</td>
          <td class="num">${t.pesoTotalG.toFixed(0)} g</td>
          <td class="num">${moeda(t.custoTotal)}</td>
          <td class="num">${venda ? moeda(t.valorTotal) : "—"}</td>
          <td class="num ${venda && t.lucro < 0 ? "ruim" : ""}">${venda ? moeda(t.lucro) : "—"}</td>
          <td>${venda ? `<span class="selo selo-${reg.statusPagamento}">${SELO_PGTO[reg.statusPagamento] || "—"}</span>` : "—"}</td>
          <td class="acoes">
            <button type="button" class="btn btn-icon venda-editar" title="Editar">✏️</button>
            <button type="button" class="btn btn-icon btn-danger venda-excluir" title="Excluir">🗑️</button>
          </td>
        </tr>`;
    }).join("");

    renderResumo(linhas);
  }

  function renderResumo(linhas) {
    const alvo = $("resumoVendas");
    if (!alvo) return;
    const de = $("vendaDe").value, ate = $("vendaAte").value;
    const ind = Negocio.indicadores(registros, Storage.getDespesas(), UI.Rolos.lista(), de, ate);
    alvo.innerHTML = `
      <div class="resumo-item"><span>Faturamento</span><strong>${moeda(ind.faturamento)}</strong></div>
      <div class="resumo-item"><span>Recebido</span><strong class="boa">${moeda(ind.recebido)}</strong></div>
      <div class="resumo-item ${ind.aReceber > 0 ? "atencao" : ""}"><span>A receber</span><strong>${moeda(ind.aReceber)}</strong></div>
      <div class="resumo-item"><span>Lucro das vendas</span><strong>${moeda(ind.lucroVendas)}</strong></div>
      <div class="resumo-item"><span>Filamento usado</span><strong>${((ind.pesoVendido + ind.pesoPessoal) / 1000).toFixed(2)} kg</strong></div>`;
  }

  function formatarData(iso) {
    if (!iso) return "—";
    const [a, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  // ---------------------------------------------------------------- Janela

  function atualizarListas() {
    if (!$("vendaProduto")) return;
    const prodAtual = $("vendaProduto").value;
    const roloAtual = $("vendaRolo").value;
    $("vendaProduto").innerHTML = '<option value="">— sem produto —</option>' + UI.Produtos.opcoesHtml(prodAtual);
    $("vendaRolo").innerHTML = UI.Rolos.opcoesHtml(roloAtual);
    render();
  }

  function abrir(reg) {
    editando = reg || null;
    $("tituloVenda").textContent = reg ? "Editar registro" : "Registrar impressão";
    $("vendaProduto").innerHTML = '<option value="">— sem produto —</option>' + UI.Produtos.opcoesHtml(reg ? reg.produtoId : "");
    $("vendaRolo").innerHTML = UI.Rolos.opcoesHtml(reg ? reg.roloId : UI.Rolos.primeiroId());

    $("vendaData").value = reg ? reg.data : new Date().toISOString().slice(0, 10);
    $("vendaTipo").value = reg ? reg.tipo : "venda";
    $("vendaCliente").value = reg ? (reg.cliente || "") : "";
    $("vendaQtd").value = reg ? reg.qtd : 1;
    $("vendaPeso").value = reg ? reg.pesoUnitG : 0;
    $("vendaCusto").value = reg ? reg.custoUnit : 0;
    $("vendaPreco").value = reg ? reg.precoUnit : 0;
    $("vendaStatus").value = reg ? (reg.statusPagamento || "pago") : "pago";

    aplicarTipo();
    previa();
    $("dlgVenda").showModal();
  }

  /** Uso pessoal não tem preço nem pagamento: os campos somem. */
  function aplicarTipo() {
    const venda = $("vendaTipo").value === "venda";
    $("campoPreco").hidden = !venda;
    $("campoPagamento").hidden = !venda;
    aplicarGuardarPreco();
  }

  /**
   * A oferta de guardar o preço só faz sentido quando é venda e o produto
   * escolhido ainda não tem preço cadastrado — que é o caso de quem salvou
   * o produto pela calculadora, com custo mas sem preço.
   */
  function aplicarGuardarPreco() {
    const campo = $("campoGuardarPreco");
    if (!campo) return;
    const p = UI.Produtos.produto($("vendaProduto").value);
    const cabe = $("vendaTipo").value === "venda" && p && !p.precoPadrao;
    campo.hidden = !cabe;
    if (cabe) $("vendaGuardarPreco").checked = true;
  }

  /** Mostra, antes de salvar, o que aquele registro vai significar. */
  function previa() {
    const rolo = UI.Rolos.rolo($("vendaRolo").value);
    const reg = lerFormulario();
    const t = Negocio.totaisDoRegistro(reg, rolo);
    const partes = [`${t.pesoTotalG.toFixed(0)} g de filamento`, `custo ${moeda(t.custoTotal)}`];
    if (reg.tipo === "venda") {
      partes.push(`valor ${moeda(t.valorTotal)}`);
      partes.push(`lucro ${moeda(t.lucro)} (${t.margem.toFixed(0)}%)`);
    }
    if (rolo) {
      const e = UI.Rolos.estado(rolo);
      const sobra = e.restante - t.pesoTotalG + (editando && editando.roloId === rolo.id ? editando.pesoUnitG * Math.max(1, editando.qtd) : 0);
      partes.push(`sobram ${Math.max(0, sobra).toFixed(0)} g no rolo`);
    }
    $("previaVenda").textContent = partes.join(" · ");
  }

  function lerFormulario() {
    return {
      data: $("vendaData").value,
      tipo: $("vendaTipo").value,
      cliente: $("vendaCliente").value.trim(),
      produtoId: $("vendaProduto").value,
      roloId: $("vendaRolo").value,
      qtd: Math.max(1, parseInt($("vendaQtd").value, 10) || 1),
      pesoUnitG: Math.max(0, parseFloat($("vendaPeso").value) || 0),
      custoUnit: Math.max(0, parseFloat($("vendaCusto").value) || 0),
      precoUnit: Math.max(0, parseFloat($("vendaPreco").value) || 0),
      statusPagamento: $("vendaStatus").value,
    };
  }

  function salvar(e) {
    e.preventDefault();
    const dados = lerFormulario();
    const prod = UI.Produtos.produto(dados.produtoId);
    dados.produtoNome = prod ? prod.nome : "";

    if (editando) Object.assign(editando, dados);
    else registros.push({ id: Storage.uid("reg"), ...dados });

    Storage.saveRegistros(registros);

    // O preço definido aqui pode virar o preço padrão do produto, para a
    // próxima venda já vir preenchida.
    if (prod && dados.tipo === "venda" && dados.precoUnit > 0 &&
        !$("campoGuardarPreco").hidden && $("vendaGuardarPreco").checked) {
      UI.Produtos.definirPreco(prod.id, dados.precoUnit);
    }

    $("dlgVenda").close();
    editando = null;
    render();
    UI.Rolos.atualizar();      // o consumo mudou: o estoque precisa redesenhar
    UI.Produtos.atualizar();   // e o custo médio do produto também
    UI.flash("Registro salvo.");
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddVenda").addEventListener("click", () => abrir(null));
    $("formVenda").addEventListener("submit", salvar);
    $("vendaTipo").addEventListener("change", () => { aplicarTipo(); previa(); });

    ["vendaProduto", "vendaRolo", "vendaQtd", "vendaPeso", "vendaCusto", "vendaPreco"].forEach((id) => {
      $(id).addEventListener("input", previa);
    });

    // Escolher o produto traz o que já se sabe dele: custo de produção,
    // peso por peça e, se existir, o preço de venda cadastrado.
    $("vendaProduto").addEventListener("change", () => {
      const p = UI.Produtos.produto($("vendaProduto").value);
      aplicarGuardarPreco();
      if (!p) return;

      const custo = UI.Produtos.custoMedio(p);
      if (custo) $("vendaCusto").value = custo.toFixed(2);
      if (p.pesoG) $("vendaPeso").value = p.pesoG.toFixed(1);

      if (p.precoPadrao) $("vendaPreco").value = p.precoPadrao;
      else if (p.precoSugerido) {
        // Sem preço definido: entra a sugestão da calculadora, para você
        // confirmar ou trocar antes de salvar.
        $("vendaPreco").value = p.precoSugerido.toFixed(2);
      }
      previa();
    });

    ["vendaDe", "vendaAte", "vendaFiltroTipo", "vendaFiltroStatus"].forEach((id) => {
      $(id).addEventListener("change", render);
    });

    $("corpoVendas").addEventListener("click", (e) => {
      const linha = e.target.closest("tr");
      if (!linha) return;
      const reg = registros.find((r) => r.id === linha.dataset.id);
      if (!reg) return;

      if (e.target.closest(".venda-editar")) abrir(reg);

      if (e.target.closest(".venda-excluir")) {
        if (!confirm("Excluir este registro? O filamento volta para o estoque.")) return;
        registros = registros.filter((r) => r.id !== reg.id);
        Storage.saveRegistros(registros);
        render();
        UI.Rolos.atualizar();
        UI.Produtos.atualizar();
      }
    });

    document.querySelectorAll("[data-fechar]").forEach((b) => {
      b.addEventListener("click", () => b.closest("dialog").close());
    });
  }

  function atualizar() { render(); }

  return { load, bind, atualizarListas, registros: lista, atualizar };
})();
