// =====================================================================
// Helpers de UI compartilhados entre os módulos
// =====================================================================
import { STATUS_LABELS } from "./supabase.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function fmtMoney(v) {
  if (v == null || v === "") return "-";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function statusBadge(status, label) {
  return `<span class="badge badge-${status}">${esc(label || STATUS_LABELS[status] || status)}</span>`;
}

// Toast simples
export function toast(msg, type = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  setTimeout(() => el.classList.remove("show"), 3000);
}

// Cabeçalho de seção
export function pageHeader(title, subtitle = "") {
  return `<div class="page-header">
    <h2>${esc(title)}</h2>
    ${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ""}
  </div>`;
}

// ---------------------------------------------------------------------
// Modal de formulário (substitui prompt()/alert(), que são bloqueados
// dentro de previews/iframes). Retorna uma Promise com os valores ou null.
// fields: [{ name, label, type='text', value, options[], required, min, step, rows }]
// ---------------------------------------------------------------------
export function modalForm(title, fields, submitLabel = "Salvar") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const fieldsHtml = fields.map((f) => {
      const req = f.required ? "required" : "";
      if (f.type === "select") {
        const opts = (f.options || [])
          .map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`)
          .join("");
        return `<label>${esc(f.label)}<select name="${f.name}" ${req}>${opts}</select></label>`;
      }
      if (f.type === "textarea") {
        return `<label>${esc(f.label)}<textarea name="${f.name}" rows="${f.rows || 3}" ${req}>${esc(f.value ?? "")}</textarea></label>`;
      }
      const extra = [
        f.min != null ? `min="${f.min}"` : "",
        f.step != null ? `step="${f.step}"` : "",
      ].join(" ");
      return `<label>${esc(f.label)}<input name="${f.name}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" ${extra} ${req} /></label>`;
    }).join("");

    overlay.innerHTML = `
      <div class="modal">
        <h3>${esc(title)}</h3>
        <form class="modal-form">
          ${fieldsHtml}
          <div class="modal-actions">
            <button type="button" class="btn-link" data-cancel>Cancelar</button>
            <button type="submit" class="btn">${esc(submitLabel)}</button>
          </div>
        </form>
      </div>`;

    document.body.appendChild(overlay);
    const form = overlay.querySelector("form");
    const first = form.querySelector("input, select, textarea");
    if (first) first.focus();

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector("[data-cancel]").addEventListener("click", () => close(null));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(null); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = {};
      fields.forEach((f) => { values[f.name] = form.elements[f.name].value; });
      close(values);
    });
  });
}

// Modal genérico de conteúdo (HTML livre) — para listagens, detalhes, etc.
export function modalContent(title, html, wide = false) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${wide ? "modal-wide" : ""}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="modal-close" data-close aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">${html}</div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  return overlay;
}

// Diálogo de confirmação (substitui confirm())
export function confirmDialog(title, message, okLabel = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn-link" data-cancel>Cancelar</button>
          <button type="button" class="btn btn-danger" data-ok>${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (r) => { overlay.remove(); resolve(r); };
    overlay.querySelector("[data-cancel]").addEventListener("click", () => close(false));
    overlay.querySelector("[data-ok]").addEventListener("click", () => close(true));
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(false); });
  });
}
