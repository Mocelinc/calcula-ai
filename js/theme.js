/* =========================================================================
   Calcula.AI — theme.js
   Controla a troca entre as 4 paletas (Dark/Dracula, Dark/Nord,
   Light/Minimalista, Light/Ocean) usando o atributo [data-theme] na <html>.
   ========================================================================= */

const ThemeManager = (() => {
  const ROOT = document.documentElement;
  const VALID_THEMES = ["dark-dracula", "dark-nord", "light-minimal", "light-ocean"];

  function apply(themeName) {
    const theme = VALID_THEMES.includes(themeName) ? themeName : VALID_THEMES[0];
    ROOT.setAttribute("data-theme", theme);
    Storage.saveTheme(theme);

    const select = document.getElementById("themeSelect");
    if (select) select.value = theme;

    // Notifica outros módulos (ex.: gráfico) que as cores podem ter mudado.
    document.dispatchEvent(new CustomEvent("calculaai:themechange", { detail: { theme } }));
  }

  function init() {
    apply(Storage.getTheme());

    const select = document.getElementById("themeSelect");
    if (select) {
      select.addEventListener("change", (e) => apply(e.target.value));
    }
  }

  return { init, apply };
})();
