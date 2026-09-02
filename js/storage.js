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
  };

  /** Perfis padrão criados na primeira execução (primeiro uso do app). */
  const DEFAULT_MACHINE_PROFILES = [
    // Consumo médio durante a impressão (~55W) baseado em medições da comunidade;
    // a potência nominal/máxima da fonte é 150W (usada só em aquecimento).
    { id: "machine-default-1", nome: "Bambu Lab A1 mini", potenciaW: 55, valorCompra: 2600, vidaUtilHoras: 8000 },
    { id: "machine-default-2", nome: "Ender 3 V2", potenciaW: 150, valorCompra: 1200, vidaUtilHoras: 8000 },
  ];

  const DEFAULT_MATERIAL_PROFILES = [
    { id: "material-default-1", nome: "PLA Genérico", precoKg: 90 },
    { id: "material-default-2", nome: "PETG Premium", precoKg: 150 },
  ];

  const DEFAULT_SETTINGS = {
    valorKwh: 4.0,
    valorHora: 20,
    markup: "100",
    markupCustom: 100,
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
    getSettings,
    saveSettings,
    getTheme,
    saveTheme,
    downloadExport,
    importAll,
  };
})();
