/* =========================================================================
   Calcula.AI — negocio.js
   Regras de negócio da operação: rolos de filamento, produtos, registros de
   impressão e despesas. Tudo aqui é cálculo puro, sem DOM e sem storage —
   recebe listas, devolve números. É o que um dia vira endpoint no back.

   O encadeamento é o mesmo da planilha que deu origem a estas telas:
   o registro de impressão consome gramas de um rolo, o rolo define o custo
   por grama, e esse custo volta para o produto e para o resultado do mês.
   ========================================================================= */

const Negocio = (() => {

  function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

  // ------------------------------------------------------------- Rolos

  function custoPorGrama(rolo) {
    const peso = num(rolo && rolo.pesoInicialG);
    return peso > 0 ? num(rolo.custoTotal) / peso : 0;
  }

  function custoPorKg(rolo) { return custoPorGrama(rolo) * 1000; }

  /** Quantas gramas já saíram deste rolo, somando todos os registros. */
  function consumoDoRolo(roloId, registros) {
    return (registros || [])
      .filter((r) => r.roloId === roloId)
      .reduce((soma, r) => soma + num(r.pesoUnitG) * Math.max(1, num(r.qtd)), 0);
  }

  /**
   * Situação completa de um rolo: quanto sobrou, em que faixa está e,
   * quando dá para estimar, em quantos dias acaba no ritmo atual.
   */
  function estadoDoRolo(rolo, registros, config) {
    const cfg = config || {};
    const limite = num(cfg.limiteEstoqueBaixoPct) || 20;
    const inicial = num(rolo.pesoInicialG);
    const usado = consumoDoRolo(rolo.id, registros);
    const restante = Math.max(0, inicial - usado);
    const pct = inicial > 0 ? (restante / inicial) * 100 : 0;

    let status = "ok";
    if (restante <= 0) status = "esgotado";
    else if (pct <= limite) status = "baixo";

    // Ritmo de consumo: gramas por dia desde a compra (ou desde o primeiro uso).
    const usos = (registros || []).filter((r) => r.roloId === rolo.id && r.data).map((r) => r.data).sort();
    const inicio = rolo.dataCompra || usos[0] || "";
    let consumoDiarioG = 0;
    let diasRestantes = null;
    if (inicio && usado > 0) {
      const dias = Math.max(1, Math.round((Date.now() - new Date(inicio + "T00:00:00").getTime()) / 86400000));
      consumoDiarioG = usado / dias;
      if (consumoDiarioG > 0) diasRestantes = Math.floor(restante / consumoDiarioG);
    }

    return { inicial, usado, restante, pct, status, consumoDiarioG, diasRestantes,
             custoG: custoPorGrama(rolo), custoKg: custoPorKg(rolo) };
  }

  // -------------------------------------------------- Registros de impressão

  /**
   * Fecha a conta de um registro. "Uso pessoal" não gera receita nem lucro:
   * entra só como consumo de filamento e custo, igual na planilha.
   * @param {object} reg     registro de impressão
   * @param {object} rolo    rolo usado (para o custo real do material)
   */
  function totaisDoRegistro(reg, rolo) {
    const qtd = Math.max(1, num(reg.qtd));
    const pesoUnitG = num(reg.pesoUnitG);
    const pesoTotalG = pesoUnitG * qtd;
    const custoMaterialUnit = pesoUnitG * custoPorGrama(rolo);
    const custoMaterialTotal = custoMaterialUnit * qtd;

    // Custo unitário cheio: o que veio da calculadora quando o produto foi
    // cadastrado. Sem ele, usa ao menos o custo do material.
    const custoUnit = num(reg.custoUnit) || custoMaterialUnit;
    const custoTotal = custoUnit * qtd;

    const venda = reg.tipo === "venda";
    const precoUnit = venda ? num(reg.precoUnit) : 0;
    const valorTotal = precoUnit * qtd;
    const lucro = venda ? valorTotal - custoTotal : 0;
    const margem = venda && valorTotal > 0 ? (lucro / valorTotal) * 100 : 0;

    return { qtd, pesoTotalG, custoMaterialUnit, custoMaterialTotal,
             custoUnit, custoTotal, precoUnit, valorTotal, lucro, margem };
  }

  // ----------------------------------------------------------- Indicadores

  function dentroDoPeriodo(data, de, ate) {
    if (!data) return false;
    if (de && data < de) return false;
    if (ate && data > ate) return false;
    return true;
  }

  /**
   * Os números do painel, no período escolhido. Mesma lógica da planilha:
   * uso pessoal fica fora do faturamento, e o resultado líquido desconta
   * as despesas lançadas no mesmo período.
   */
  function indicadores(registros, despesas, rolos, de, ate) {
    const porId = new Map((rolos || []).map((r) => [r.id, r]));
    const noPeriodo = (registros || []).filter((r) => dentroDoPeriodo(r.data, de, ate));

    let faturamento = 0, recebido = 0, aReceber = 0, custoPecas = 0;
    let pesoVendido = 0, pesoPessoal = 0, pecasVendidas = 0;

    noPeriodo.forEach((reg) => {
      const t = totaisDoRegistro(reg, porId.get(reg.roloId));
      if (reg.tipo === "venda") {
        faturamento += t.valorTotal;
        custoPecas += t.custoTotal;
        pesoVendido += t.pesoTotalG;
        pecasVendidas += t.qtd;
        if (reg.statusPagamento === "pago") recebido += t.valorTotal;
        else aReceber += t.valorTotal;
      } else {
        pesoPessoal += t.pesoTotalG;
      }
    });

    const totalDespesas = (despesas || [])
      .filter((d) => dentroDoPeriodo(d.data, de, ate))
      .reduce((s, d) => s + num(d.valorUnit) * Math.max(1, num(d.qtd)), 0);

    const lucroVendas = faturamento - custoPecas;

    return {
      faturamento, recebido, aReceber, custoPecas, lucroVendas,
      totalDespesas,
      resultadoLiquido: lucroVendas - totalDespesas,
      margemMedia: faturamento > 0 ? (lucroVendas / faturamento) * 100 : 0,
      pesoVendido, pesoPessoal, pecasVendidas,
      registros: noPeriodo.length,
    };
  }

  /** Despesas agrupadas por categoria, da maior para a menor. */
  function despesasPorCategoria(despesas, de, ate) {
    const mapa = new Map();
    (despesas || [])
      .filter((d) => dentroDoPeriodo(d.data, de, ate))
      .forEach((d) => {
        const cat = d.categoria || "Sem categoria";
        mapa.set(cat, (mapa.get(cat) || 0) + num(d.valorUnit) * Math.max(1, num(d.qtd)));
      });
    return [...mapa.entries()].map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  }

  /** Produtos que mais deram lucro no período. */
  function ranking(registros, produtos, rolos, de, ate) {
    const porRolo = new Map((rolos || []).map((r) => [r.id, r]));
    const nomes = new Map((produtos || []).map((p) => [p.id, p.nome]));
    const mapa = new Map();
    (registros || [])
      .filter((r) => r.tipo === "venda" && dentroDoPeriodo(r.data, de, ate))
      .forEach((reg) => {
        const t = totaisDoRegistro(reg, porRolo.get(reg.roloId));
        const chave = reg.produtoId || reg.produtoNome || "—";
        const atual = mapa.get(chave) || { nome: nomes.get(reg.produtoId) || reg.produtoNome || "—", qtd: 0, valor: 0, lucro: 0 };
        atual.qtd += t.qtd;
        atual.valor += t.valorTotal;
        atual.lucro += t.lucro;
        mapa.set(chave, atual);
      });
    return [...mapa.values()].sort((a, b) => b.lucro - a.lucro);
  }

  /** Custo médio de um produto, pela média dos registros já feitos. */
  function custoMedioDoProduto(produtoId, registros, rolos) {
    const porRolo = new Map((rolos || []).map((r) => [r.id, r]));
    const usos = (registros || []).filter((r) => r.produtoId === produtoId);
    if (!usos.length) return 0;
    const soma = usos.reduce((s, reg) => s + totaisDoRegistro(reg, porRolo.get(reg.roloId)).custoUnit, 0);
    return soma / usos.length;
  }

  return { custoPorGrama, custoPorKg, consumoDoRolo, estadoDoRolo, totaisDoRegistro,
           indicadores, despesasPorCategoria, ranking, custoMedioDoProduto, dentroDoPeriodo };
})();
