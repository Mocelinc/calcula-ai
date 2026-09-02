/* =========================================================================
   Calcula.AI — calculator.js
   Núcleo de regras de negócio: todas as fórmulas de custo e precificação.
   Módulo puro (sem acesso ao DOM) para facilitar testes e manutenção.
   ========================================================================= */

const Calculator = (() => {

  /**
   * Calcula o orçamento completo de uma peça impressa em 3D.
   *
   * @param {Object} input
   * @param {number} input.pesoPecaG          Peso da peça em gramas
   * @param {number} input.tempoHoras         Horas de impressão
   * @param {number} input.tempoMinutos       Minutos de impressão (adicionais)
   * @param {number} input.potenciaW          Consumo médio da impressora em Watts
   * @param {number} input.valorCompraMaquina Valor pago na impressora (R$)
   * @param {number} input.vidaUtilHoras      Vida útil estimada da impressora (horas)
   * @param {number} input.precoFilamentoKg   Preço do rolo de filamento por KG (R$)
   * @param {number} input.valorKwh           Valor do kWh da energia local (R$)
   * @param {number} input.prepMinutos        Tempo de preparo/pós-processamento (min)
   * @param {number} input.valorHoraTrabalho  Valor da hora de trabalho (R$)
   * @param {number} input.custoEmbalagem     Custo de embalagem (R$)
   * @param {number} input.taxaFalhaPct       Taxa de falha estimada (%)
   * @param {number} input.custosExtras       Custos extras gerais (R$)
   * @param {number} input.markupPct          Margem de lucro desejada (%)
   * @param {number} input.quantidade         Quantidade de peças do pedido
   * @param {boolean} input.precoMarketeiro   Se true, arredonda o preço final
   *
   * @returns {Object} Resultado detalhado do orçamento.
   */
  function calcular(input) {
    const {
      pesoPecaG = 0,
      tempoHoras = 0,
      tempoMinutos = 0,
      potenciaW = 0,
      valorCompraMaquina = 0,
      vidaUtilHoras = 1, // evita divisão por zero
      precoFilamentoKg = 0,
      valorKwh = 0,
      prepMinutos = 0,
      valorHoraTrabalho = 0,
      custoEmbalagem = 0,
      taxaFalhaPct = 0,
      custosExtras = 0,
      markupPct = 0,
      quantidade = 1,
      precoMarketeiro = false,
    } = input;

    // 1. Tempo total de impressão, em horas decimais.
    const tempoImpressaoH = Math.max(0, tempoHoras) + Math.max(0, tempoMinutos) / 60;

    // 2. Custo de filamento: proporcional ao peso da peça.
    const custoFilamento = (Math.max(0, pesoPecaG) / 1000) * Math.max(0, precoFilamentoKg);

    // 3. Custo de energia: potência (kW) x tempo de impressão x tarifa.
    const custoEnergia = (Math.max(0, potenciaW) / 1000) * tempoImpressaoH * Math.max(0, valorKwh);

    // 4. Depreciação da máquina: fração do valor de compra consumida
    //    proporcionalmente ao tempo de impressão desta peça.
    const vidaUtilSegura = vidaUtilHoras > 0 ? vidaUtilHoras : 1;
    const custoDepreciacao = (Math.max(0, valorCompraMaquina) / vidaUtilSegura) * tempoImpressaoH;

    // 5. Mão de obra: tempo de preparo/pós-processamento convertido em horas.
    const custoMaoDeObra = (Math.max(0, prepMinutos) / 60) * Math.max(0, valorHoraTrabalho);

    // 6. Custo base = soma de todos os componentes diretos.
    const custoBase =
      custoFilamento + custoEnergia + custoDepreciacao + custoMaoDeObra +
      Math.max(0, custoEmbalagem) + Math.max(0, custosExtras);

    // 7. Ajuste pela taxa de falha: infla o custo para cobrir peças perdidas
    //    em impressões malsucedidas (ex.: 5% de falha -> custo x1,05).
    const taxaFalhaSegura = Math.min(Math.max(0, taxaFalhaPct), 90) / 100;
    const custoAjustado = custoBase * (1 + taxaFalhaSegura);

    // 8. Preço de venda sugerido, aplicando o markup sobre o custo ajustado.
    const markupSeguro = Math.max(0, markupPct) / 100;
    const precoSugerido = custoAjustado * (1 + markupSeguro);

    // 9. Lucro unitário.
    const lucroUnitario = precoSugerido - custoAjustado;

    // 10. "Preço Marketeiro": arredonda para o próximo múltiplo de R$5
    //     e subtrai R$0,10, gerando finais estratégicos (ex: X4,90 / X9,90).
    //     Ex.: R$43,20 -> arredonda p/ R$45,00 -> resultado R$44,90.
    const precoMarketeiroValor = arredondarPrecoMarketeiro(precoSugerido);
    const precoFinal = precoMarketeiro ? precoMarketeiroValor : precoSugerido;
    const lucroFinal = precoFinal - custoAjustado;

    // 11. Totais pela quantidade de peças do pedido.
    const qtd = Math.max(1, Math.round(quantidade) || 1);
    const custoTotalQtd = custoAjustado * qtd;
    const precoTotalQtd = precoFinal * qtd;
    const lucroTotalQtd = lucroFinal * qtd;

    return {
      tempoImpressaoH,
      custoFilamento,
      custoEnergia,
      custoDepreciacao,
      custoMaoDeObra,
      custoEmbalagem: Math.max(0, custoEmbalagem),
      custosExtras: Math.max(0, custosExtras),
      custoBase,
      custoAjustado,
      precoSugerido,
      precoMarketeiroValor,
      precoFinal,
      lucroUnitario,
      lucroFinal,
      quantidade: qtd,
      custoTotalQtd,
      precoTotalQtd,
      lucroTotalQtd,
    };
  }

  /**
   * Arredonda um preço para um final "marketeiro" (ex.: ...4,90 / ...9,90).
   * Estratégia: sobe para o próximo múltiplo de R$5 e subtrai R$0,10.
   */
  function arredondarPrecoMarketeiro(preco) {
    if (preco <= 0) return 0;
    const proximoMultiploDe5 = Math.ceil(preco / 5) * 5;
    const resultado = proximoMultiploDe5 - 0.1;
    // Garante que o preço marketeiro nunca fique abaixo do preço original.
    return resultado >= preco ? resultado : resultado + 5;
  }

  /** Formata um número como moeda brasileira (R$). */
  function formatarMoeda(valor) {
    const n = Number.isFinite(valor) ? valor : 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return { calcular, arredondarPrecoMarketeiro, formatarMoeda };
})();
