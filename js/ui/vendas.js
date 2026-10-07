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

    const rolos = UI.Rolos.lista();
    corpo.innerHTML = linhas.map((reg) => {
      const prod = UI.Produtos.produto(reg.produtoId);
      const t = Negocio.totaisDoRegistro(reg, rolos);
      const venda = reg.tipo === "venda";
      const fils = t.filamentos.map((f) => {
        const r = UI.Rolos.rolo(f.roloId);
        return r ? r.nome : "—";
      });
      const filamentoTexto = fils.length > 1
        ? `<span title="${escapeHtml(fils.join(", "))}">${fils.length} filamentos</span>`
        : escapeHtml(fils[0] || "—");
      return `
        <tr data-id="${reg.id}" class="${venda ? "" : "linha-pessoal"}">
          <td>${formatarData(reg.data)}</td>
          <td><span class="selo selo-${venda ? "venda" : "pessoal"}">${venda ? "Venda" : "Pessoal"}</span></td>
          <td>${escapeHtml(reg.cliente || "—")}</td>
          <td>${escapeHtml(prod ? prod.nome : reg.produtoNome || "—")}</td>
          <td class="num">${t.qtd}</td>
          <td>${filamentoTexto}</td>
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
    $("vendaProduto").innerHTML = '<option value="">— sem produto —</option>' + UI.Produtos.opcoesHtml(prodAtual);
    // As linhas de filamento acompanham mudanças no estoque sem perder a escolha.
    $("vendaFilamentos").querySelectorAll(".vf-rolo").forEach((sel) => {
      const atual = sel.value;
      sel.innerHTML = UI.Rolos.opcoesHtml(UI.Rolos.existe(atual) ? atual : UI.Rolos.primeiroId());
    });
    render();
  }

  // ------------------------------------------- Linhas de filamento da peça
  // Uma impressão pode usar mais de um rolo — peça de duas cores, troca de
  // filamento no meio. Cada linha é um rolo com o peso que ele entrou.

  function linhaFilamento(roloId, pesoG) {
    const div = document.createElement("div");
    div.className = "venda-filamento";
    div.innerHTML = `
      <select class="vf-rolo" aria-label="Rolo usado">${UI.Rolos.opcoesHtml(roloId)}</select>
      <input type="number" class="vf-peso" min="0" step="0.1" value="${pesoG}" aria-label="Peso por peça (g)" />
      <button type="button" class="btn btn-icon btn-danger vf-remover" title="Remover filamento">🗑️</button>`;
    $("vendaFilamentos").appendChild(div);
  }

  function montarFilamentos(reg) {
    $("vendaFilamentos").innerHTML = "";
    const fils = reg ? Negocio.filamentosDe(reg) : [];
    if (!fils.length) linhaFilamento(UI.Rolos.primeiroId(), 0);
    else fils.forEach((f) => linhaFilamento(f.roloId, f.pesoUnitG));
  }

  function lerFilamentos() {
    return [...$("vendaFilamentos").querySelectorAll(".venda-filamento")].map((l) => ({
      roloId: l.querySelector(".vf-rolo").value,
      pesoUnitG: Math.max(0, parseFloat(l.querySelector(".vf-peso").value) || 0),
    })).filter((f) => f.roloId);
  }

  function abrir(reg) {
    editando = reg || null;
    $("tituloVenda").textContent = reg ? "Editar registro" : "Registrar impressão";
    $("vendaProduto").innerHTML = '<option value="">— sem produto —</option>' + UI.Produtos.opcoesHtml(reg ? reg.produtoId : "");
    montarFilamentos(reg);

    $("vendaData").value = reg ? reg.data : new Date().toISOString().slice(0, 10);
    $("vendaTipo").value = reg ? reg.tipo : "venda";
    $("vendaCliente").value = reg ? (reg.cliente || "") : "";
    $("vendaQtd").value = reg ? reg.qtd : 1;
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
    const reg = lerFormulario();
    const rolos = UI.Rolos.lista();
    const t = Negocio.totaisDoRegistro(reg, rolos);
    const partes = [`${t.pesoTotalG.toFixed(0)} g de filamento`,
                    `material ${moeda(t.custoMaterialTotal)}`,
                    `custo ${moeda(t.custoTotal)}`];
    if (reg.tipo === "venda") {
      partes.push(`valor ${moeda(t.valorTotal)}`);
      partes.push(`lucro ${moeda(t.lucro)} (${t.margem.toFixed(0)}%)`);
    }

    // Quanto sobra em cada rolo depois deste registro. Se estiver editando,
    // devolve antes o que o registro antigo já tinha consumido.
    const sobras = reg.filamentos.map((f) => {
      const rolo = UI.Rolos.rolo(f.roloId);
      if (!rolo) return null;
      const e = UI.Rolos.estado(rolo);
      let devolver = 0;
      if (editando) {
        devolver = Negocio.filamentosDe(editando)
          .filter((x) => x.roloId === f.roloId)
          .reduce((s, x) => s + x.pesoUnitG * Math.max(1, editando.qtd), 0);
      }
      const sobra = e.restante + devolver - f.pesoUnitG * reg.qtd;
      return `${rolo.nome}: ${Math.max(0, sobra).toFixed(0)} g`;
    }).filter(Boolean);

    $("previaVenda").textContent = partes.join(" · ") + (sobras.length ? ` — sobra ${sobras.join(", ")}` : "");
  }

  function lerFormulario() {
    return {
      data: $("vendaData").value,
      tipo: $("vendaTipo").value,
      cliente: $("vendaCliente").value.trim(),
      produtoId: $("vendaProduto").value,
      filamentos: lerFilamentos(),
      qtd: Math.max(1, parseInt($("vendaQtd").value, 10) || 1),
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
    UI.Painel.atualizar();     // e o fechamento do período
    UI.flash("Registro salvo.");
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("btnAddVenda").addEventListener("click", () => abrir(null));
    $("formVenda").addEventListener("submit", salvar);
    $("vendaTipo").addEventListener("change", () => { aplicarTipo(); previa(); });

    ["vendaProduto", "vendaQtd", "vendaCusto", "vendaPreco"].forEach((id) => {
      $(id).addEventListener("input", previa);
    });

    // Linhas de filamento: adicionar, remover e recalcular a prévia.
    $("btnAddFilamentoVenda").addEventListener("click", () => {
      linhaFilamento(UI.Rolos.primeiroId(), 0);
      previa();
    });
    $("vendaFilamentos").addEventListener("input", previa);
    $("vendaFilamentos").addEventListener("change", previa);
    $("vendaFilamentos").addEventListener("click", (e) => {
      if (!e.target.closest(".vf-remover")) return;
      if ($("vendaFilamentos").querySelectorAll(".venda-filamento").length <= 1) {
        alert("A impressão precisa ter ao menos um filamento.");
        return;
      }
      e.target.closest(".venda-filamento").remove();
      previa();
    });

    // Escolher o produto traz o que já se sabe dele: custo de produção,
    // peso por peça e, se existir, o preço de venda cadastrado.
    $("vendaProduto").addEventListener("change", () => {
      const p = UI.Produtos.produto($("vendaProduto").value);
      aplicarGuardarPreco();
      if (!p) return;

      const custo = UI.Produtos.custoMedio(p);
      if (custo) $("vendaCusto").value = custo.toFixed(2);
      // Peso do produto entra na primeira linha de filamento, se ela estiver zerada.
      const primeiroPeso = $("vendaFilamentos").querySelector(".vf-peso");
      if (p.pesoG && primeiroPeso && !parseFloat(primeiroPeso.value)) {
        primeiroPeso.value = p.pesoG.toFixed(1);
      }

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
        UI.Painel.atualizar();
      }
    });

    document.querySelectorAll("[data-fechar]").forEach((b) => {
      b.addEventListener("click", () => b.closest("dialog").close());
    });
  }

  function atualizar() { render(); }

  return { load, bind, atualizarListas, registros: lista, atualizar };
})();
