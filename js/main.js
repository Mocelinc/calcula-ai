/* =========================================================================
   Calcula.AI — main.js
   Ponto de entrada da aplicação. Inicializa tema e UI assim que o DOM
   e os demais scripts (carregados com "defer") estiverem prontos.
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
  UI.init();
});
