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

    const n = Storage.getNegocio();
    $("limiteEstoqueBaixo").value = n.limiteEstoqueBaixoPct;
    $("alertaTermino").value = n.alertaTerminoDias;

    // Migração: versões antigas guardavam markup como "50"/"100"/"custom".
    let markupVal = parseFloat(s.markup);
    if (!Number.isFinite(markupVal)) markupVal = parseFloat(s.markupCustom);
    if (!Number.isFinite(markupVal)) markupVal = 100;
    UI.Calc.syncMarkup(markupVal, "init");
  }

  /** Mostra, em português claro, em que pé está a conversa com o servidor. */
  function mostrarSync() {
    const alvo = $("estadoSync");
    if (!alvo) return;
    const e = Storage.estadoSync();
    if (!e.servidor) {
      alvo.className = "estado-sync off";
      alvo.textContent = "Só neste aparelho — servidor fora de alcance. O que você lançar fica guardado aqui e sobe quando ele voltar.";
      return;
    }
    const hora = e.ultimaSync ? new Date(e.ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "agora";
    alvo.className = "estado-sync on";
    alvo.textContent = e.pendentes
      ? `Conectado ao servidor. ${e.pendentes} alteração(ões) esperando para subir.`
      : `Sincronizado com o servidor às ${hora}.`;
  }

  function bind() {
    $("btnSincronizar").addEventListener("click", async () => {
      $("btnSincronizar").disabled = true;
      const r = await Storage.sincronizar();
      if (r.trouxe.length) {
        UI.recarregarDados();
        UI.flash(`Trouxe do servidor: ${r.trouxe.join(", ")}.`);
      } else if (r.servidor) {
        UI.flash("Tudo igual nos dois lados.");
      } else {
        UI.flash("Servidor fora de alcance.");
      }
      mostrarSync();
      $("btnSincronizar").disabled = false;
    });

    // Parâmetros de estoque: redesenham as telas que dependem deles.
    ["limiteEstoqueBaixo", "alertaTermino"].forEach((id) => {
      $(id).addEventListener("change", () => {
        Storage.saveNegocio({
          limiteEstoqueBaixoPct: Math.max(1, Math.min(90, parseFloat($("limiteEstoqueBaixo").value) || 20)),
          alertaTerminoDias: Math.max(1, Math.min(120, parseFloat($("alertaTermino").value) || 15)),
        });
        UI.Rolos.atualizar();
        UI.Painel.atualizar();
      });
    });

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

  return { bind, applySaved, mostrarSync };
})();
