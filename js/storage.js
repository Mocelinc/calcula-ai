/* =========================================================================
   Calcula.AI — storage.js
   Camada de persistência. Tudo é salvo no localStorage do navegador.
   Nenhum dado sai da máquina do usuário (sem back-end).
   ========================================================================= */

const Storage = (() => {
  const PREFIX = "calculaAI_";

  const KEYS = {
    MACHINE_PROFILES: PREFIX + "machineProfiles",
    MATERIAL_PROFILES: PREFIX + "materialProfiles",
    SETTINGS: PREFIX + "settings",
    THEME: PREFIX + "theme",
    ROLOS: PREFIX + "rolos",
    PRODUTOS: PREFIX + "produtos",
    REGISTROS: PREFIX + "registros",
    DESPESAS: PREFIX + "despesas",
    NEGOCIO: PREFIX + "negocio",
    SYNC: PREFIX + "sync",
  };

  /**
   * Quais chaves viajam para o servidor, e com que nome lá. O resto
   * (tema, marcas de sincronização) é de cada aparelho e fica aqui.
   */
  const COLECOES = {
    [PREFIX + "rolos"]: "rolos",
    [PREFIX + "produtos"]: "produtos",
    [PREFIX + "registros"]: "registros",
    [PREFIX + "despesas"]: "despesas",
    [PREFIX + "negocio"]: "negocio",
    [PREFIX + "machineProfiles"]: "impressoras",
    [PREFIX + "settings"]: "ajustes",
  };

  /** Perfis padrão criados na primeira execução (primeiro uso do app). */
  const DEFAULT_MACHINE_PROFILES = [
    // Consumo médio durante a impressão (~55W) baseado em medições da comunidade
    // Bambu Lab; a potência nominal/máxima da fonte é 150W (só no aquecimento).
    // Vida útil de 8.000h é uma estimativa de partida — ajuste conforme seu uso.
    // Se zerar, a depreciação simplesmente sai do cálculo.
    { id: "machine-default-1", nome: "Bambu Lab A1 mini", potenciaW: 55, valorCompra: 2600, vidaUtilHoras: 8000 },
  ];

  // Preços de exemplo (os mesmos usados como referência no briefing do projeto).
  const DEFAULT_MATERIAL_PROFILES = [
    { id: "material-default-1", nome: "PLA Genérico", precoKg: 90 },
    { id: "material-default-2", nome: "PETG Premium", precoKg: 150 },
  ];

  /** Parâmetros do negócio — os mesmos da aba "Configuracoes" da planilha. */
  const DEFAULT_NEGOCIO = {
    limiteEstoqueBaixoPct: 20,   // abaixo disso o rolo entra como estoque baixo
    alertaTerminoDias: 15,       // aviso quando a previsão de término for menor que isso
  };

  const DEFAULT_SETTINGS = {
    // R$/kWh residencial da RGE Sul (distribuidora que atende Frederico
    // Westphalen/RS), tarifa vigente a partir de 06/2026. Ajuste se sua
    // conta de luz mostrar um valor diferente (impostos variam por conta).
    valorKwh: 0.945,
    valorHora: 0, // não confirmado — defina quanto vale a sua hora de trabalho
    markup: 100, // markup numérico (%) — controlado pelo slider no card "Margem de Lucro"
  };

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Calcula.AI: falha ao ler "${key}" do localStorage`, err);
      return fallback;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Gravou algo que o servidor também guarda? Marca a hora e manda.
      const colecao = COLECOES[key];
      if (colecao) {
        _marcar(colecao, Date.now());
        _agendarEnvio(colecao);
      }
      return true;
    } catch (err) {
      console.error(`Calcula.AI: falha ao gravar "${key}" no localStorage`, err);
      return false;
    }
  }

  function _uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ---------------------------------------------------------------- Perfis

  function getMachineProfiles() {
    const list = _read(KEYS.MACHINE_PROFILES, null);
    if (!list || !list.length) {
      _write(KEYS.MACHINE_PROFILES, DEFAULT_MACHINE_PROFILES);
      return structuredClone(DEFAULT_MACHINE_PROFILES);
    }
    return list;
  }

  function saveMachineProfiles(list) {
    return _write(KEYS.MACHINE_PROFILES, list);
  }

  function getMaterialProfiles() {
    const list = _read(KEYS.MATERIAL_PROFILES, null);
    if (!list || !list.length) {
      _write(KEYS.MATERIAL_PROFILES, DEFAULT_MATERIAL_PROFILES);
      return structuredClone(DEFAULT_MATERIAL_PROFILES);
    }
    return list;
  }

  function saveMaterialProfiles(list) {
    return _write(KEYS.MATERIAL_PROFILES, list);
  }

  /* =======================================================================
     Sincronização com o servidor de casa
     -----------------------------------------------------------------------
     O app continua guardando tudo no navegador — é o que o deixa rápido e
     funcionando sem internet. Quando o servidor está ao alcance, cada
     coleção também sobe para lá, com a hora da última alteração, e quem
     tiver a versão mais nova vence. Sem servidor, nada quebra: o aparelho
     trabalha sozinho e manda quando ele voltar.

     Como são dezenas de registros, cada coleção viaja inteira. Sincronizar
     item a item seria mais código para resolver um problema que não existe
     nesta escala.
     ======================================================================= */

  const API = "api";
  const CHAVE_DE = Object.fromEntries(Object.entries(COLECOES).map(([k, n]) => [n, k]));

  let servidorOk = false;
  let ultimaSync = 0;
  const pendentes = new Set();
  let timerEnvio = null;

  function _marcas() { return _read(KEYS.SYNC, {}) || {}; }
  function _marca(nome) { return _marcas()[nome] || 0; }
  function _marcar(nome, quando) {
    const m = _marcas();
    m[nome] = quando;
    try { localStorage.setItem(KEYS.SYNC, JSON.stringify(m)); } catch (err) { /* sem espaço: segue sem marca */ }
  }

  async function _api(caminho, opcoes = {}, ms = 5000) {
    const ctrl = new AbortController();
    const corta = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(`${API}/${caminho}`, { ...opcoes, signal: ctrl.signal, cache: "no-store" });
    } finally {
      clearTimeout(corta);
    }
  }

  async function _enviar(nome) {
    const chave = CHAVE_DE[nome];
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return;
    const r = await _api(`colecao/${nome}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados: JSON.parse(bruto), atualizadoEm: _marca(nome) || Date.now() }),
    });
    if (!r.ok) throw new Error(`servidor recusou ${nome}`);
  }

  /** Junta as gravações de um segundo e manda de uma vez só. */
  function _agendarEnvio(nome) {
    pendentes.add(nome);
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(async () => {
      if (!servidorOk) return;
      for (const colecao of [...pendentes]) {
        try { await _enviar(colecao); pendentes.delete(colecao); }
        catch (err) { servidorOk = false; }   // tenta de novo na próxima rodada
      }
      if (!pendentes.size) ultimaSync = Date.now();
    }, 1200);
  }

  /**
   * Conversa completa com o servidor: traz o que lá está mais novo, manda
   * o que aqui está mais novo.
   * @returns {Promise<{servidor:boolean, trouxe:string[]}>}
   */
  async function sincronizar() {
    let remoto;
    try {
      const r = await _api("estado");
      if (!r.ok) throw new Error("sem servidor");
      remoto = await r.json();
      servidorOk = true;
    } catch (err) {
      servidorOk = false;
      return { servidor: false, trouxe: [] };
    }

    const trouxe = [];
    for (const [chave, nome] of Object.entries(COLECOES)) {
      const aqui = _marca(nome);
      const la = remoto[nome];
      try {
        if (!la) {
          if (localStorage.getItem(chave) !== null) await _enviar(nome);
        } else if (la.atualizadoEm > aqui) {
          localStorage.setItem(chave, JSON.stringify(la.dados));
          _marcar(nome, la.atualizadoEm);
          trouxe.push(nome);
        } else if (aqui > la.atualizadoEm) {
          await _enviar(nome);
        }
      } catch (err) {
        servidorOk = false;
      }
    }
    if (servidorOk) ultimaSync = Date.now();
    return { servidor: servidorOk, trouxe };
  }

  /** Para a tela de Ajustes mostrar em que pé está. */
  function estadoSync() {
    return { servidor: servidorOk, ultimaSync, pendentes: pendentes.size };
  }

  // ----------------------------------------------------- Listas do negócio
  // Rolos, produtos, registros de impressão e despesas. Todas seguem o mesmo
  // formato: uma lista de objetos, cada um com o seu id.

  function _lista(key) { return _read(key, []) || []; }

  /**
   * Na primeira vez, aproveita o catálogo antigo de filamentos — em que cada
   * item era só um preço por quilo — e transforma cada um num rolo de 1 kg.
   * Assim ninguém perde o que já tinha cadastrado.
   */
  function getRolos() {
    const atual = _read(KEYS.ROLOS, null);
    if (atual) return atual;

    const antigos = _read(KEYS.MATERIAL_PROFILES, null) || DEFAULT_MATERIAL_PROFILES;
    const convertidos = antigos.map((m) => ({
      id: m.id || _uid("rolo"),
      nome: m.nome,
      material: "PLA",
      cor: "",
      marca: "",
      pesoInicialG: 1000,
      custoTotal: Number(m.precoKg) || 0,
      dataCompra: "",
      fornecedor: "",
      ativo: true,
    }));
    _write(KEYS.ROLOS, convertidos);
    return convertidos;
  }
  function saveRolos(lista) { return _write(KEYS.ROLOS, lista); }

  function getProdutos() { return _lista(KEYS.PRODUTOS); }
  function saveProdutos(lista) { return _write(KEYS.PRODUTOS, lista); }

  function getRegistros() { return _lista(KEYS.REGISTROS); }
  function saveRegistros(lista) { return _write(KEYS.REGISTROS, lista); }

  function getDespesas() { return _lista(KEYS.DESPESAS); }
  function saveDespesas(lista) { return _write(KEYS.DESPESAS, lista); }

  function getNegocio() { return { ...DEFAULT_NEGOCIO, ..._read(KEYS.NEGOCIO, {}) }; }
  function saveNegocio(partial) { return _write(KEYS.NEGOCIO, { ...getNegocio(), ...partial }); }

  // -------------------------------------------------------------- Settings

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ..._read(KEYS.SETTINGS, {}) };
  }

  function saveSettings(partial) {
    const merged = { ...getSettings(), ...partial };
    return _write(KEYS.SETTINGS, merged);
  }

  // ----------------------------------------------------------------- Tema

  function getTheme() {
    return _read(KEYS.THEME, "dark-dracula");
  }

  function saveTheme(themeName) {
    return _write(KEYS.THEME, themeName);
  }

  // --------------------------------------------------------- Backup (I/O)

  /** Reúne todas as chaves do app num único objeto para exportação. */
  function exportAll() {
    const dump = {};
    Object.values(KEYS).forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw !== null) dump[key] = JSON.parse(raw);
    });
    return {
      app: "Calcula.AI",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: dump,
    };
  }

  function downloadExport() {
    const payload = exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `calcula-ai-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Restaura dados a partir de um objeto de backup previamente exportado.
   * Faz validação básica de formato antes de sobrescrever o localStorage.
   */
  function importAll(payload) {
    if (!payload || typeof payload !== "object" || !payload.data) {
      throw new Error("Arquivo de backup inválido: formato inesperado.");
    }
    const validKeys = new Set(Object.values(KEYS));
    let restored = 0;
    Object.entries(payload.data).forEach(([key, value]) => {
      if (validKeys.has(key)) {
        localStorage.setItem(key, JSON.stringify(value));
        restored++;
      }
    });
    if (restored === 0) {
      throw new Error("Nenhum dado reconhecido foi encontrado no arquivo.");
    }
    return restored;
  }

  return {
    KEYS,
    uid: _uid,
    getMachineProfiles,
    saveMachineProfiles,
    getMaterialProfiles,
    saveMaterialProfiles,
    getRolos,
    saveRolos,
    getProdutos,
    saveProdutos,
    getRegistros,
    saveRegistros,
    getDespesas,
    saveDespesas,
    getNegocio,
    saveNegocio,
    getSettings,
    saveSettings,
    getTheme,
    saveTheme,
    downloadExport,
    importAll,
    sincronizar,
    estadoSync,
  };
})();
