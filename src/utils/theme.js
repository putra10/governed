// src/utils/theme.js — Applies the active color theme to the document root.
// The CSS token files key off [data-theme="dark"]; "light" is the default
// (no attribute needed, but we set it explicitly for clarity).

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
}
