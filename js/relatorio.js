// =====================================================================
// Módulo RELATÓRIO: lista completa de pedidos, com filtros e export CSV
// =====================================================================
import { STATUS_LABELS } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, toast, pageHeader } from "./ui.js";
import { fetchPedidos, itensTexto } from "./pedidos.js";

let container, profile, todos = [];
let filtroStatus = "", filtroDe = "", filtroAte = "";

export async function render(el, prof) {
  container = el;
  profile = prof;
  todos = await fetchPedidos();
  draw();
}

function aplicarFiltros() {
  return todos.filter((p) => {
    if (filtroStatus && p.status !== filtroStatus) return false;
    if (filtroDe && new Date(p.created_at) < new Date(filtroDe)) return false;
    if (filtroAte && new Date(p.created_at) > new Date(filtroAte + "T23:59:59")) return false;
    return true;
  });
}

function draw() {
  const lista = aplicarFiltros();
  const total = lista.reduce((s, p) => s + Number(p.valor_pago || p.valor_estimado || 0), 0);

  const statusOpts = ['<option value="">Todos os status</option>']
    .concat(Object.entries(STATUS_LABELS).map(([v, l]) =>
      `<option value="${v}" ${v === filtroStatus ? "selected" : ""}>${l}</option>`))
    .join("");

  container.innerHTML = `
    ${pageHeader("Relatório de pedidos", "Filtre e exporte os pedidos de compra")}

    <section class="card">
      <div class="filters">
        <label>Status<select id="f-status">${statusOpts}</select></label>
        <label>De<input type="date" id="f-de" value="${filtroDe}" /></label>
        <label>Até<input type="date" id="f-ate" value="${filtroAte}" /></label>
        <button class="btn" id="btn-export">Exportar CSV</button>
      </div>
      <p class="muted">${lista.length} pedido(s) · valor total (pago/estimado): <strong>${fmtMoney(total)}</strong></p>
      <table class="table">
        <thead><tr>
          <th>#</th><th>Status</th><th>Itens</th><th>Solicitante</th>
          <th>Fornecedor</th><th>Valor est.</th><th>Valor pago</th>
          <th>Aberto em</th><th>Pago em</th>
        </tr></thead>
        <tbody>
          ${lista.map(row).join("") || `<tr><td colspan="9" class="muted">Nenhum pedido para os filtros.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  container.querySelector("#f-status").addEventListener("change", (e) => { filtroStatus = e.target.value; draw(); });
  container.querySelector("#f-de").addEventListener("change", (e) => { filtroDe = e.target.value; draw(); });
  container.querySelector("#f-ate").addEventListener("change", (e) => { filtroAte = e.target.value; draw(); });
  container.querySelector("#btn-export").addEventListener("click", () => exportCSV(lista));
}

function row(p) {
  return `<tr>
    <td>${p.numero}</td><td>${statusBadge(p.status)}</td>
    <td>${esc(itensTexto(p))}</td><td>${esc(p.criador?.nome || "-")}</td>
    <td>${esc(p.fornecedor || "-")}</td>
    <td>${fmtMoney(p.valor_estimado)}</td><td>${fmtMoney(p.valor_pago)}</td>
    <td>${fmtDate(p.created_at)}</td><td>${fmtDate(p.data_pagamento)}</td>
  </tr>`;
}

function exportCSV(lista) {
  if (!lista.length) return toast("Nada para exportar.", "error");
  const headers = ["Numero", "Status", "Itens", "Solicitante", "Justificativa",
    "Fornecedor", "ValorEstimado", "ValorPago", "FormaPagamento",
    "AbertoEm", "DecididoEm", "PagoEm"];
  const linhas = lista.map((p) => [
    p.numero,
    STATUS_LABELS[p.status] || p.status,
    itensTexto(p),
    p.criador?.nome || "",
    p.justificativa || "",
    p.fornecedor || "",
    p.valor_estimado ?? "",
    p.valor_pago ?? "",
    p.forma_pagamento || "",
    p.created_at || "",
    p.data_decisao || "",
    p.data_pagamento || "",
  ]);

  const csv = [headers, ...linhas]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");

  // BOM para o Excel reconhecer acentuação UTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV exportado.");
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
