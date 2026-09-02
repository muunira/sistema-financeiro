// =====================================================================
// Alternância de tema claro/escuro (persistido no navegador)
// =====================================================================
const KEY = "tema";

const SOL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

export function getTheme() {
  // Modo escuro é o padrão. Só respeita localStorage se o usuário tiver escolhido claro.
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" ? "light" : "dark";
  } catch { return "dark"; }
}

export function applyTheme(t) {
  document.documentElement.classList.toggle("theme-light", t === "light");
}

// Atualiza o conteúdo (ícone + texto opcional) de um botão de tema
export function paintButton(btn, withLabel = true) {
  if (!btn) return;
  const dark = getTheme() === "dark";
  const label = dark ? "Modo claro" : "Modo escuro";
  btn.innerHTML = `${dark ? SOL : LUA}${withLabel ? `<span>${label}</span>` : ""}`;
  btn.title = label;
}

export function toggleTheme() {
  const novo = getTheme() === "dark" ? "light" : "dark";
  try { localStorage.setItem(KEY, novo); } catch {}
  applyTheme(novo);
  return novo;
}

// Liga um botão à alternância de tema
export function bindThemeButton(btn, withLabel = true) {
  applyTheme(getTheme());
  paintButton(btn, withLabel);
  btn.addEventListener("click", () => { toggleTheme(); paintButton(btn, withLabel); });
}
