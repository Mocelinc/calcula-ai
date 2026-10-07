/* =========================================================================
   Calcula.AI — negocio.js
   Regras de negócio da operação: rolos de filamento, produtos, registros de
   impressão e despesas. Tudo aqui é cálculo puro, sem DOM e sem storage —
   recebe listas, devolve números. É o que um dia vira endpoint no back.

   O encadeamento é o mesmo da planilha que deu origem a estas telas:
   o registro de impressão consome gramas de um ou mais rolos, o rolo define
   o custo por grama, e esse custo volta para o produto e para o fechamento.
   ========================================================================= */

const Negocio = (() => {

  function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

  /** Aceita lista de rolos ou Map já pronto — os dois aparecem por aqui. */
  function mapaDeRolos(rolos) {
    if (rolos instanceof Map) return rolos;
    if (rolos && rolos.id) return new Map([[rolos.id, rolos]]);   // um rolo só
    return new Map((rolos || []).map((r) => [r.id, r]));
  }

  /**
   * Uma impressão pode usar mais de um filamento (peça de duas cores, por
   * exemplo). O formato novo guarda uma lista; registros antigos tinham um
   * rolo só, e continuam valendo.
   */
  function filamentosDe(reg) {
    if (Array.isArray(reg.filamentos) && reg.filamentos.length) return reg.filamentos;
    if (reg.roloId) return [{ roloId: reg.roloId, pesoUnitG: num(reg.pesoUnitG) }];
    return [];
  }

  // ------------------------------------------------------------- Rolos

  function custoPorGrama(rolo) {
    const peso = num(rolo && rolo.pesoInicialG);
    return peso > 0 ? num(rolo.custoTotal) / peso : 0;
  }

  function custoPorKg(rolo) { return custoPorGrama(rolo) * 1000; }

  /** Quantas gramas já saíram deste rolo, somando todos os registros. */
  function consumoDoRolo(roloId, registros) {
    return (registros || []).reduce((soma, reg) => {
      const qtd = Math.max(1, num(reg.qtd));
      return soma + filamentosDe(reg)
        .filter((f) => f.roloId === roloId)
        .reduce((s, f) => s + num(f.pesoUnitG) * qtd, 0);
    }, 0);
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
    const usos = (registros || [])
      .filter((r) => r.data && filamentosDe(r).some((f) => f.roloId === rolo.id))
      .map((r) => r.data).sort();
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
   * @param {object} reg    registro de impressão
   * @param {*} rolos       lista, Map ou um rolo só — para o custo do material
   */
  function totaisDoRegistro(reg, rolos) {
    const mapa = mapaDeRolos(rolos);
    const qtd = Math.max(1, num(reg.qtd));
    const fils = filamentosDe(reg);

    const pesoUnitG = fils.reduce((s, f) => s + num(f.pesoUnitG), 0);
    const pesoTotalG = pesoUnitG * qtd;
    const custoMaterialUnit = fils.reduce((s, f) => s + num(f.pesoUnitG) * custoPorGrama(mapa.get(f.roloId)), 0);
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

    return { qtd, pesoUnitG, pesoTotalG, custoMaterialUnit, custoMaterialTotal,
             custoUnit, custoTotal, precoUnit, valorTotal, lucro, margem,
             filamentos: fils };
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
    const mapa = mapaDeRolos(rolos);
    const noPeriodo = (registros || []).filter((r) => dentroDoPeriodo(r.data, de, ate));

    let faturamento = 0, recebido = 0, aReceber = 0, custoPecas = 0, custoMaterialVendas = 0;
    let pesoVendido = 0, pecasVendidas = 0, vendas = 0;
    let pesoPessoal = 0, pecasPessoais = 0, custoPessoal = 0, materialPessoal = 0;

    noPeriodo.forEach((reg) => {
      const t = totaisDoRegistro(reg, mapa);
      if (reg.tipo === "venda") {
        vendas++;
        faturamento += t.valorTotal;
        custoPecas += t.custoTotal;
        custoMaterialVendas += t.custoMaterialTotal;
        pesoVendido += t.pesoTotalG;
        pecasVendidas += t.qtd;
        if (reg.statusPagamento === "pago") recebido += t.valorTotal;
        else aReceber += t.valorTotal;
      } else {
        pesoPessoal += t.pesoTotalG;
        pecasPessoais += t.qtd;
        custoPessoal += t.custoTotal;
        materialPessoal += t.custoMaterialTotal;
      }
    });

    const totalDespesas = (despesas || [])
      .filter((d) => dentroDoPeriodo(d.data, de, ate))
      .reduce((s, d) => s + num(d.valorUnit) * Math.max(1, num(d.qtd)), 0);

    const lucroVendas = faturamento - custoPecas;
    const pesoTotal = pesoVendido + pesoPessoal;

    return {
      faturamento, recebido, aReceber, custoPecas, lucroVendas,
      totalDespesas,
      resultadoLiquido: lucroVendas - totalDespesas,
      margemMedia: faturamento > 0 ? (lucroVendas / faturamento) * 100 : 0,
      ticketMedio: vendas > 0 ? faturamento / vendas : 0,
      vendas, pecasVendidas, pesoVendido,
      // Bloco de uso pessoal: não entra no faturamento nem no resultado.
      pessoal: {
        pecas: pecasPessoais,
        pesoG: pesoPessoal,
        custoMaterial: materialPessoal,
        custoTotal: custoPessoal,
        pctDoFilamento: pesoTotal > 0 ? (pesoPessoal / pesoTotal) * 100 : 0,
      },
      // Conferência: o custo que a calculadora informou x o material de verdade.
      conferencia: {
        custoInformado: custoPecas,
        custoMaterialReal: custoMaterialVendas,
        pctMaterial: custoPecas > 0 ? (custoMaterialVendas / custoPecas) * 100 : 0,
        outrosCustos: custoPecas - custoMaterialVendas,
      },
      pesoTotal,
      registros: noPeriodo.length,
    };
  }

  /**
   * Mesmo período, mesma duração, imediatamente antes — é assim que a
   * planilha compara. Devolve os dois conjuntos e a variação de cada um.
   */
  function comparativo(registros, despesas, rolos, de, ate) {
    const atual = indicadores(registros, despesas, rolos, de, ate);
    if (!de || !ate) return { atual, anterior: null, variacao: {} };

    const dia = 86400000;
    const inicio = new Date(de + "T00:00:00").getTime();
    const fim = new Date(ate + "T00:00:00").getTime();
    const duracao = fim - inicio + dia;
    const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

    const anterior = indicadores(registros, despesas, rolos, iso(inicio - duracao), iso(inicio - dia));

    const varia = (a, b) => (b === 0 ? null : ((a - b) / Math.abs(b)) * 100);
    return {
      atual, anterior,
      variacao: {
        faturamento: varia(atual.faturamento, anterior.faturamento),
        totalDespesas: varia(atual.totalDespesas, anterior.totalDespesas),
        lucroVendas: varia(atual.lucroVendas, anterior.lucroVendas),
        resultadoLiquido: varia(atual.resultadoLiquido, anterior.resultadoLiquido),
      },
    };
  }

  /** Um resumo por mês dentro do período, como na aba Dashboard. */
  function resumoMensal(registros, despesas, rolos, de, ate) {
    const mapa = mapaDeRolos(rolos);
    const meses = new Map();

    const garante = (chave) => {
      if (!meses.has(chave)) meses.set(chave, { mes: chave, receitas: 0, custoPecas: 0, despesas: 0, filamentoG: 0 });
      return meses.get(chave);
    };

    (registros || []).filter((r) => dentroDoPeriodo(r.data, de, ate)).forEach((reg) => {
      const m = garante(reg.data.slice(0, 7));
      const t = totaisDoRegistro(reg, mapa);
      m.filamentoG += t.pesoTotalG;
      if (reg.tipo === "venda") { m.receitas += t.valorTotal; m.custoPecas += t.custoTotal; }
    });

    (despesas || []).filter((d) => dentroDoPeriodo(d.data, de, ate)).forEach((d) => {
      garante(d.data.slice(0, 7)).despesas += num(d.valorUnit) * Math.max(1, num(d.qtd));
    });

    return [...meses.values()]
      .map((m) => ({ ...m, resultado: m.receitas - m.custoPecas - m.despesas }))
      .sort((a, b) => (a.mes < b.mes ? -1 : 1));
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
    const mapa = mapaDeRolos(rolos);
    const nomes = new Map((produtos || []).map((p) => [p.id, p.nome]));
    const linhas = new Map();
    (registros || [])
      .filter((r) => r.tipo === "venda" && dentroDoPeriodo(r.data, de, ate))
      .forEach((reg) => {
        const t = totaisDoRegistro(reg, mapa);
        const chave = reg.produtoId || reg.produtoNome || "—";
        const atual = linhas.get(chave) || { nome: nomes.get(reg.produtoId) || reg.produtoNome || "—", qtd: 0, valor: 0, lucro: 0 };
        atual.qtd += t.qtd;
        atual.valor += t.valorTotal;
        atual.lucro += t.lucro;
        linhas.set(chave, atual);
      });
    return [...linhas.values()]
      .map((l) => ({ ...l, margem: l.valor > 0 ? (l.lucro / l.valor) * 100 : 0 }))
      .sort((a, b) => b.lucro - a.lucro);
  }

  /** Custo médio de um produto, pela média dos registros já feitos. */
  function custoMedioDoProduto(produtoId, registros, rolos) {
    const mapa = mapaDeRolos(rolos);
    const usos = (registros || []).filter((r) => r.produtoId === produtoId);
    if (!usos.length) return 0;
    const soma = usos.reduce((s, reg) => s + totaisDoRegistro(reg, mapa).custoUnit, 0);
    return soma / usos.length;
  }

  return { custoPorGrama, custoPorKg, consumoDoRolo, estadoDoRolo, totaisDoRegistro,
           filamentosDe, indicadores, comparativo, resumoMensal, despesasPorCategoria,
           ranking, custoMedioDoProduto, dentroDoPeriodo };
})();
