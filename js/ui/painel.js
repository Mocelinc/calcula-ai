/* =========================================================================
   Calcula.AI — ui/painel.js
   Tela Painel: o fechamento do período. Pega os registros de impressão e
   as despesas, passa pelo Negocio e mostra o que entrou, o que saiu e o
   que sobrou — mais os produtos que puxaram o lucro e o estoque em risco.
   Público: UI.Painel.{ load, bind, atualizar }
   ========================================================================= */

UI.Painel = (() => {
  const $ = UI.$;
  const escapeHtml = UI.escapeHtml;
  const moeda = (v) => Calculator.formatarMoeda(v);

  function load() {
    periodo("mes");
  }

  function de() { return $("painelDe").value; }
  function ate() { return $("painelAte").value; }

  /** Atalhos de período: este mês, o passado, o ano, ou tudo. */
  function periodo(qual) {
    const hoje = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let inicio, fim = hoje;

    if (qual === "mes") inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    else if (qual === "mes-passado") {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    } else if (qual === "ano") inicio = new Date(hoje.getFullYear(), 0, 1);
    else { inicio = new Date(2000, 0, 1); }

    $("painelDe").value = iso(inicio);
    $("painelAte").value = iso(fim);
    document.querySelectorAll("#atalhosPeriodo .chip").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.periodo === qual);
    });
    render();
  }

  // --------------------------------------------------------------- Desenho

  function render() {
    if (!$("painelDestaques")) return;
    const registros = Storage.getRegistros();
    const despesas = Storage.getDespesas();
    const rolos = UI.Rolos.lista();
    const ind = Negocio.indicadores(registros, despesas, rolos, de(), ate());

    destaques(ind);
    conta(ind);
    comparativo(registros, despesas, rolos);
    conferencia(ind);
    pessoal(ind);
    categorias(despesas);
    ranking(registros, rolos);
    estoque(rolos);
    mensal(registros, despesas, rolos);
  }

  /** Uma linha "rótulo à esquerda, número à direita". */
  function preencherLinhas(alvo, itens) {
    $(alvo).innerHTML = itens.map(([rotulo, valor, classe = "", cor = ""]) => `
      <li class="${classe}">
        <span>${rotulo}</span>
        <span class="num ${cor}">${valor}</span>
      </li>`).join("");
  }

  /** Período anterior de mesma duração, como na planilha. */
  function comparativo(registros, despesas, rolos) {
    const c = Negocio.comparativo(registros, despesas, rolos, de(), ate());
    if (!c.anterior) {
      $("painelComparativo").innerHTML = '<li class="nota">Escolha um período com data inicial e final para comparar.</li>';
      return;
    }
    const seta = (v, gastoEhRuim) => {
      if (v === null) return '<span class="variacao">—</span>';
      const sobe = v >= 0;
      const bom = gastoEhRuim ? !sobe : sobe;
      return `<span class="variacao ${bom ? "boa" : "ruim"}">${sobe ? "▲" : "▼"} ${Math.abs(v).toFixed(0)}%</span>`;
    };
    const item = (rotulo, chave, gastoEhRuim = false) => [
      rotulo,
      `${moeda(c.atual[chave])} <small>antes ${moeda(c.anterior[chave])}</small> ${seta(c.variacao[chave], gastoEhRuim)}`,
    ];
    preencherLinhas("painelComparativo", [
      item("Faturamento", "faturamento"),
      item("Despesas", "totalDespesas", true),
      item("Lucro das vendas", "lucroVendas"),
      item("Resultado líquido", "resultadoLiquido"),
    ]);
  }

  /** O custo informado pela calculadora contra o material que saiu mesmo. */
  function conferencia(ind) {
    const c = ind.conferencia;
    if (c.custoInformado <= 0) {
      $("painelConferencia").innerHTML = '<li class="nota">Nenhuma venda registrada no período.</li>';
      return;
    }
    preencherLinhas("painelConferencia", [
      ["Custo informado na calculadora", moeda(c.custoInformado)],
      ["Custo real do material", moeda(c.custoMaterialReal)],
      ["Material como % do custo", `${c.pctMaterial.toFixed(0)}%`],
      ["Outros custos embutidos", moeda(c.outrosCustos), "total", c.outrosCustos < 0 ? "ruim" : ""],
    ]);
  }

  function pessoal(ind) {
    const p = ind.pessoal;
    if (!p.pecas) {
      $("painelPessoal").innerHTML = '<li class="nota">Nenhuma impressão de uso pessoal no período.</li>';
      return;
    }
    preencherLinhas("painelPessoal", [
      ["Peças impressas para uso próprio", String(p.pecas)],
      ["Filamento consumido", `${p.pesoG.toFixed(0)} g`],
      ["Valor gasto em filamento", moeda(p.custoMaterial)],
      ["Custo total estimado das peças", moeda(p.custoTotal)],
      ["Do filamento do período", `${p.pctDoFilamento.toFixed(0)}%`, "nota"],
    ]);
  }

  function mensal(registros, despesas, rolos) {
    const meses = Negocio.resumoMensal(registros, despesas, rolos, de(), ate());
    const corpo = $("painelMensal");
    if (!meses.length) {
      corpo.innerHTML = '<tr><td colspan="6" class="nota">Nada lançado no período.</td></tr>';
      return;
    }
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    corpo.innerHTML = meses.map((m) => {
      const [ano, mes] = m.mes.split("-");
      return `
        <tr>
          <td>${MES[Number(mes) - 1]}/${ano.slice(2)}</td>
          <td class="num">${moeda(m.receitas)}</td>
          <td class="num">${moeda(m.custoPecas)}</td>
          <td class="num">${moeda(m.despesas)}</td>
          <td class="num ${m.resultado < 0 ? "ruim" : "boa"}"><strong>${moeda(m.resultado)}</strong></td>
          <td class="num">${(m.filamentoG / 1000).toFixed(2)} kg</td>
        </tr>`;
    }).join("");
  }

  function destaques(ind) {
    const sinal = ind.resultadoLiquido >= 0 ? "boa" : "ruim";
    $("painelDestaques").innerHTML = `
      <div class="destaque">
        <span>Faturamento</span>
        <strong>${moeda(ind.faturamento)}</strong>
        <small>${ind.pecasVendidas} peça${ind.pecasVendidas === 1 ? "" : "s"} vendida${ind.pecasVendidas === 1 ? "" : "s"}</small>
      </div>
      <div class="destaque">
        <span>Despesas</span>
        <strong>${moeda(ind.totalDespesas)}</strong>
        <small>saídas do caixa no período</small>
      </div>
      <div class="destaque destaque-forte">
        <span>Resultado líquido</span>
        <strong class="${sinal}">${moeda(ind.resultadoLiquido)}</strong>
        <small>lucro das vendas menos despesas</small>
      </div>
      <div class="destaque">
        <span>A receber</span>
        <strong class="${ind.aReceber > 0 ? "atencao" : ""}">${moeda(ind.aReceber)}</strong>
        <small>vendas ainda não pagas</small>
      </div>`;
  }

  function conta(ind) {
    const linhas = [
      ["Faturamento", ind.faturamento, ""],
      ["Custo das peças vendidas", -ind.custoPecas, ""],
      ["Lucro das vendas", ind.lucroVendas, "subtotal"],
      ["Despesas do período", -ind.totalDespesas, ""],
      ["Resultado líquido", ind.resultadoLiquido, "total"],
    ];
    $("painelConta").innerHTML = linhas.map(([rotulo, valor, classe]) => `
      <li class="${classe}">
        <span>${rotulo}</span>
        <span class="num ${valor < 0 ? "ruim" : classe === "total" || classe === "subtotal" ? "boa" : ""}">${moeda(valor)}</span>
      </li>`).join("") + `
      <li class="nota"><span>Margem média das vendas</span><span class="num">${ind.margemMedia.toFixed(0)}%</span></li>
      <li class="nota"><span>Peças vendidas</span><span class="num">${ind.pecasVendidas} em ${ind.vendas} venda${ind.vendas === 1 ? "" : "s"}</span></li>
      <li class="nota"><span>Ticket médio por venda</span><span class="num">${moeda(ind.ticketMedio)}</span></li>
      <li class="nota"><span>Já recebido</span><span class="num">${moeda(ind.recebido)}</span></li>
      <li class="nota"><span>Filamento consumido</span><span class="num">${(ind.pesoTotal / 1000).toFixed(2)} kg</span></li>`;
  }

  /** Lista com barra proporcional — serve para categorias e ranking. */
  function barras(alvo, itens, vazio) {
    if (!itens.length) {
      $(alvo).innerHTML = `<li class="nota">${vazio}</li>`;
      return;
    }
    const maior = Math.max(...itens.map((i) => Math.abs(i.valor))) || 1;
    $(alvo).innerHTML = itens.slice(0, 6).map((i) => `
      <li>
        <div class="barra-topo">
          <span>${escapeHtml(i.rotulo)}</span>
          <span class="num">${moeda(i.valor)}</span>
        </div>
        <div class="barra"><div class="barra-fill ${i.classe || ""}" style="width:${(Math.abs(i.valor) / maior) * 100}%"></div></div>
        ${i.sub ? `<small>${escapeHtml(i.sub)}</small>` : ""}
      </li>`).join("");
  }

  function categorias(despesas) {
    const itens = Negocio.despesasPorCategoria(despesas, de(), ate())
      .map((c) => ({ rotulo: c.categoria, valor: c.valor }));
    barras("painelCategorias", itens, "Nenhuma despesa lançada no período.");
  }

  function ranking(registros, rolos) {
    const itens = Negocio.ranking(registros, UI.Produtos.lista(), rolos, de(), ate())
      .map((p) => ({ rotulo: p.nome, valor: p.lucro, classe: p.lucro < 0 ? "negativo" : "", sub: `${p.qtd} vendida${p.qtd === 1 ? "" : "s"} · ${moeda(p.valor)} em vendas` }));
    barras("painelRanking", itens, "Nenhuma venda registrada no período.");
  }

  function estoque(rolos) {
    const regs = Storage.getRegistros();
    const cfg = Storage.getNegocio();
    const itens = rolos
      .map((r) => ({ rolo: r, e: Negocio.estadoDoRolo(r, regs, cfg) }))
      .filter((x) => x.e.status !== "ok" || (x.e.diasRestantes !== null && x.e.diasRestantes <= cfg.alertaTerminoDias))
      .sort((a, b) => a.e.pct - b.e.pct)
      .map((x) => ({
        rotulo: x.rolo.nome,
        valor: x.e.restante * x.e.custoG,
        classe: x.e.status === "esgotado" ? "negativo" : "",
        sub: `${x.e.restante.toFixed(0)} g (${x.e.pct.toFixed(0)}%)` +
             (x.e.diasRestantes !== null ? ` · acaba em ~${x.e.diasRestantes} dia${x.e.diasRestantes === 1 ? "" : "s"}` : ""),
      }));
    barras("painelEstoque", itens, "Todos os rolos com folga. Nada para repor agora.");
  }

  // --------------------------------------------------------------- Eventos

  function bind() {
    $("atalhosPeriodo").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (chip) periodo(chip.dataset.periodo);
    });
    $("painelDe").addEventListener("change", render);
    $("painelAte").addEventListener("change", render);
  }

  function atualizar() { render(); }

  return { load, bind, atualizar };
})();
