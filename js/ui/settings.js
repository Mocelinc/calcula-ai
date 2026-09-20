/* =========================================================================
   Calcula.AI — ui/settings.js
   Tela Ajustes: aplica os valores salvos (energia, valor da hora, markup)
   e cuida do backup em .json — exportar e importar.
   Público: UI.Settings.{ bind, applySaved }
   ========================================================================= */

UI.Settings = (() => {
  const el = UI.el;
  const $ = UI.$;

  function applySaved() {
    const s = Storage.getSettings();
    el.valorKwh.value = s.valorKwh;
    el.valorHora.value = s.valorHora;

    // Migração: versões antigas guardavam markup como "50"/"100"/"custom".
    let markupVal = parseFloat(s.markup);
    if (!Number.isFinite(markupVal)) markupVal = parseFloat(s.markupCustom);
    if (!Number.isFinite(markupVal)) markupVal = 100;
    UI.Calc.syncMarkup(markupVal, "init");
  }

  function bind() {
    $("btnExport").addEventListener("click", () => {
      Storage.downloadExport();
      UI.flash("Backup exportado.");
    });

    $("btnImportTrigger").addEventListener("click", () => $("btnImportFile").click());

    $("btnImportFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const count = Storage.importAll(JSON.parse(reader.result));
          alert(`Backup importado (${count} chave(s) restaurada(s)). A página será recarregada.`);
          location.reload();
        } catch (err) {
          alert(`Erro ao importar backup: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  return { bind, applySaved };
})();
