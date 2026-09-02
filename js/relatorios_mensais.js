// =====================================================================
// Módulo RELATÓRIOS MENSAIS: acesso restrito à Diretoria/Admin
// =====================================================================
import { STATUS_LABELS } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, pageHeader } from "./ui.js";
import { fetchPedidos, itensTexto } from "./pedidos.js";

let container, profile, pedidos = [];

export async function render(el, prof) {
  container = el;
  profile = prof;
  pedidos = await fetchPedidos();
  draw();
}

function nomeMes(ano, mes) {
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function agruparPorMes(lista) {
  const grupos = {};
  for (const p of lista) {
    const d = p.data_pagamento ? new Date(p.data_pagamento) : null;
    const chave = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "nao-pago";
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(p);
  }
  return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
}

function draw() {
  const pagos = pedidos.filter((p) => p.data_pagamento || ["pago", "concluido"].includes(p.status));
  const grupos = agruparPorMes(pagos);
  const totalGeral = pagos.reduce((s, p) => s + Number(p.valor_pago || p.valor_estimado || 0), 0);

  const mesesHtml = grupos.map(([chave, lista]) => {
    const [ano, mes] = chave.split("-");
    const titulo = chave === "nao-pago" ? "Pagamentos pendentes" : nomeMes(ano, mes);
    const totalMes = lista.reduce((s, p) => s + Number(p.valor_pago || p.valor_estimado || 0), 0);
    const linhas = lista.map((p) => `
      <tr>
        <td>#${p.numero}</td>
        <td>${esc(p.fornecedor || "-")}</td>
        <td>${esc(itensTexto(p))}</td>
        <td>${esc(p.criador?.nome || "-")}</td>
        <td>${fmtMoney(p.valor_pago || p.valor_estimado)}</td>
        <td>${fmtDate(p.data_pagamento)}</td>
        <td>${statusBadge(p.status)}</td>
      </tr>
    `).join("");
    return `
      <section class="card" style="margin-bottom:1rem">
        <div class="card-head"><h3>${esc(titulo)} <span class="muted">(${lista.length}) · ${fmtMoney(totalMes)}</span></h3></div>
        <table class="table">
          <thead><tr><th>#</th><th>Fornecedor</th><th>Itens</th><th>Solicitante</th><th>Valor</th><th>Pago em</th><th>Status</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </section>
    `;
  }).join("");

  container.innerHTML = `
    ${pageHeader("Relatórios Mensais", "Todos os pedidos e pagamentos realizados, agrupados por mês")}
    <p class="muted" style="margin-bottom:1rem">${pagos.length} pedido(s) · valor total: <strong>${fmtMoney(totalGeral)}</strong></p>
    ${mesesHtml || `<p class="muted">Nenhum pedido pago ainda.</p>`}
  `;
}
