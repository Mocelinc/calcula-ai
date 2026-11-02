/* =========================================================================
   Calcula.AI — main.js
   Ponto de entrada. Antes de desenhar a tela, tenta trazer os dados do
   servidor de casa; sem ele, segue com o que está guardado no aparelho.
   ========================================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  ThemeManager.init();

  // Uma conversa rápida com o servidor antes de montar a tela evita o
  // efeito de ver os dados antigos e eles trocarem na sua frente.
  await Storage.sincronizar();

  UI.init();
  corDaBarraDoCelular();
  document.addEventListener("calculaai:themechange", corDaBarraDoCelular);

  // De minuto em minuto, confere se o outro aparelho mexeu em algo.
  setInterval(async () => {
    const r = await Storage.sincronizar();
    if (r.trouxe.length) UI.recarregarDados();
    if (typeof UI.Settings.mostrarSync === "function") UI.Settings.mostrarSync();
  }, 60000);
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
