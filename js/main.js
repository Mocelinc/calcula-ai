/* =========================================================================
   Calcula.AI — main.js
   Ponto de entrada da aplicação. Inicializa tema e UI assim que o DOM
   e os demais scripts (carregados com "defer") estiverem prontos.
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
  UI.init();
  corDaBarraDoCelular();
  document.addEventListener("calculaai:themechange", corDaBarraDoCelular);
});

/* A barra de status do celular acompanha o fundo do tema escolhido. */
function corDaBarraDoCelular() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const cor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (cor) meta.setAttribute("content", cor);
}

/* Guarda o site no aparelho para abrir sem internet. So funciona em HTTPS
   ou em localhost; onde nao funcionar, o site segue normal. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
