// Picker metadata only; each theme's tokens live in styles/tokens.css under `:root[data-theme="<id>"]`.
const THEMES = [
    { id: "light", label: "Light", swatch: "#f7f6f3" },
    { id: "dark", label: "Dark", swatch: "#17181b" },
];

const THEME_IDS = THEMES.map((t) => t.id);
// Light is the product's own default. A stored preference always wins over it.
const DEFAULT_THEME = "light";

const isValidTheme = (id) => THEME_IDS.includes(id);

export { THEMES, DEFAULT_THEME, isValidTheme };
