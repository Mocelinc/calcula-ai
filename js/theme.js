/* =========================================================================
   Calcula.AI — theme.js
   Catálogo de temas + seletor visual (menu com amostras de cor) na sidebar.
   A troca acontece pelo atributo [data-theme] na <html>.
   ========================================================================= */

const ThemeManager = (() => {
  const ROOT = document.documentElement;

  /**
   * Catálogo. As cores de `swatch` são literais (é uma prévia da paleta em si,
   * então não podem depender do tema ativo no momento).
   */
  const THEMES = [
    { id: "dark-dracula",     nome: "Dracula",         grupo: "Escuros", swatch: ["#282a36", "#bd93f9", "#ff79c6", "#50fa7b"] },
    { id: "dark-nord",        nome: "Nord",            grupo: "Escuros", swatch: ["#2e3440", "#88c0d0", "#b48ead", "#a3be8c"] },
    { id: "dark-tokyo",       nome: "Tokyo Night",     grupo: "Escuros", swatch: ["#1a1b26", "#7aa2f7", "#bb9af7", "#9ece6a"] },
    { id: "dark-gruvbox",     nome: "Gruvbox",         grupo: "Escuros", swatch: ["#282828", "#fabd2f", "#d3869b", "#b8bb26"] },
    { id: "dark-catppuccin",  nome: "Catppuccin",      grupo: "Escuros", swatch: ["#1e1e2e", "#cba6f7", "#f5c2e7", "#a6e3a1"] },
    { id: "light-minimal",    nome: "Minimalista",     grupo: "Claros",  swatch: ["#fafafa", "#2563eb", "#7c3aed", "#16a34a"] },
    { id: "light-ocean",      nome: "Ocean",           grupo: "Claros",  swatch: ["#f0f7fa", "#0284c7", "#06b6d4", "#059669"] },
    { id: "light-solarized",  nome: "Solarized",       grupo: "Claros",  swatch: ["#eee8d5", "#268bd2", "#6c71c4", "#859900"] },
  ];

  const DEFAULT_ID = "dark-dracula";

  function find(id) {
    return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_ID);
  }

  function dotsHtml(theme) {
    return theme.swatch.map((c) => `<span class="theme-dot" style="background:${c}"></span>`).join("");
  }

  function apply(themeId) {
    const theme = find(themeId);
    ROOT.setAttribute("data-theme", theme.id);
    Storage.saveTheme(theme.id);
    renderTrigger(theme);
    markActive(theme.id);

    // Avisa outros módulos (o gráfico repinta as fatias com as novas cores).
    document.dispatchEvent(new CustomEvent("calculaai:themechange", { detail: { theme: theme.id } }));
  }

  function renderTrigger(theme) {
    const dots = document.getElementById("themeDots");
    const name = document.getElementById("themeCurrentName");
    if (dots) dots.innerHTML = dotsHtml(theme);
    if (name) name.textContent = theme.nome;
  }

  function renderMenu() {
    const menu = document.getElementById("themeMenu");
    if (!menu) return;

    const grupos = ["Escuros", "Claros"];
    menu.innerHTML = grupos.map((grupo) => `
      <p class="theme-menu-group">${grupo}</p>
      ${THEMES.filter((t) => t.grupo === grupo).map((t) => `
        <button type="button" class="theme-option" data-theme-id="${t.id}">
          <span class="theme-dots">${dotsHtml(t)}</span>
          <span class="theme-option-name">${t.nome}</span>
          <span class="theme-option-check">✓</span>
        </button>
      `).join("")}
    `).join("");
  }

  function markActive(themeId) {
    document.querySelectorAll(".theme-option").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.themeId === themeId);
    });
  }

  function toggleMenu(open) {
    const menu = document.getElementById("themeMenu");
    const trigger = document.getElementById("btnThemePicker");
    if (!menu || !trigger) return;
    const willOpen = open !== undefined ? open : menu.hidden;
    menu.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
    trigger.classList.toggle("is-open", willOpen);
  }

  function init() {
    renderMenu();
    apply(Storage.getTheme());

    const trigger = document.getElementById("btnThemePicker");
    const menu = document.getElementById("themeMenu");

    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu();
      });
    }

    if (menu) {
      menu.addEventListener("click", (e) => {
        const option = e.target.closest(".theme-option");
        if (!option) return;
        apply(option.dataset.themeId);
        toggleMenu(false);
      });
    }

    // Fecha ao clicar fora ou apertar Esc.
    document.addEventListener("click", () => toggleMenu(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") toggleMenu(false);
    });
  }

  return { init, apply, THEMES };
})();
