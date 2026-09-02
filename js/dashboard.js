// =====================================================================
// Módulo DASHBOARD: visão geral do fluxo e alertas de estoque
// =====================================================================
import { supabase, STATUS_LABELS } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, pageHeader, modalContent } from "./ui.js";
import { fetchPedidos, itensTexto } from "./pedidos.js";
import { getProdutos } from "./cache.js";

let container, profile, pedidos = [], produtos = [];

export async function render(el, prof) {
  container = el;
  profile = prof;
  [pedidos, produtos] = await Promise.all([fetchPedidos(), getProdutos()]);
  produtos = produtos.sort((a, b) => String(a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
  draw();
}

// Cada categoria: função que filtra os pedidos
const CATEGORIAS = {
  total:      { titulo: "Todos os pedidos",        filtro: () => pedidos },
  compras:    { titulo: "Pedidos em compras",      filtro: () => pedidos.filter((p) => ["solicitado", "em_cotacao"].includes(p.status)) },
  diretoria:  { titulo: "Pedidos na diretoria",    filtro: () => pedidos.filter((p) => p.status === "aguardando_diretoria") },
  aprovado:   { titulo: "Aguardando pagamento",    filtro: () => pedidos.filter((p) => p.status === "aprovado") },
  pago:       { titulo: "Pedidos pagos",           filtro: () => pedidos.filter((p) => p.status === "pago") },
};

function draw() {
  const counts = {};
  Object.keys(STATUS_LABELS).forEach((s) => (counts[s] = 0));
  pedidos.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));

  const totalPago = pedidos.filter((p) => p.status === "pago")
    .reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const aguardandoPagamento = pedidos.filter((p) => p.status === "aprovado")
    .reduce((s, p) => s + Number(p.valor_estimado || 0), 0);

  const baixos = produtos.filter((p) => Number(p.quantidade_atual) <= Number(p.estoque_minimo));

  const abertos = pedidos.filter((p) => !["pago", "recebido", "rejeitado"].includes(p.status)).slice(0, 8);

  container.innerHTML = `
    ${pageHeader("Dashboard", "Clique em um cartão para ver os detalhes")}

    <section class="stats-grid" style="margin-bottom:1.4rem">
      ${statCard("total", pedidos.length, "Pedidos no total")}
      ${statCard("compras", counts.solicitado + counts.em_cotacao, "Em compras")}
      ${statCard("diretoria", counts.aguardando_diretoria, "Na diretoria")}
      ${statCard("aprovado", counts.aprovado, "Aguardando pagamento")}
      ${statCard("pago", counts.pago, "Pagos")}
      ${statCard("baixo", baixos.length, "Estoque baixo")}
    </section>

    <section class="stats-grid" style="margin-bottom:1.4rem">
      ${statCard("aprovado", fmtMoney(aguardandoPagamento), "A pagar (aprovados)", "#d97706")}
      ${statCard("pago", fmtMoney(totalPago), "Total já pago", "#16a34a")}
    </section>

    <section class="card">
      <div class="card-head"><h3>Pedidos em andamento</h3></div>
      ${tabelaPedidos(abertos)}
    </section>

    <section class="card">
      <div class="card-head"><h3>Alertas de estoque baixo (${baixos.length})</h3></div>
      ${tabelaProdutos(baixos)}
    </section>
  `;

  container.querySelectorAll(".stat-card[data-cat]").forEach((c) =>
    c.addEventListener("click", () => abrirCategoria(c.dataset.cat)));
}

function statCard(cat, num, lbl, color = "") {
  return `<div class="stat-card clickable" data-cat="${cat}" title="Ver ${esc(lbl)}">
    <div class="num" ${color ? `style="color:${color}"` : ""}>${esc(num)}</div>
    <div class="lbl">${esc(lbl)}</div>
  </div>`;
}

function abrirCategoria(cat) {
  if (cat === "baixo") {
    const baixos = produtos.filter((p) => Number(p.quantidade_atual) <= Number(p.estoque_minimo));
    modalContent(`Estoque baixo (${baixos.length})`, tabelaProdutos(baixos), true);
    return;
  }
  const c = CATEGORIAS[cat];
  if (!c) return;
  const lista = c.filtro();
  modalContent(`${c.titulo} (${lista.length})`, tabelaPedidos(lista), true);
}

function tabelaPedidos(lista) {
  if (!lista.length) return `<p class="muted">Nenhum pedido nesta categoria.</p>`;
  return `<table class="table">
    <thead><tr><th>#</th><th>Itens</th><th>Status</th><th>Solicitante</th><th>Fornecedor</th><th>Valor</th><th>Aberto em</th></tr></thead>
    <tbody>
      ${lista.map((p) => `<tr>
        <td>${p.numero}</td>
        <td>${esc(itensTexto(p))}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${esc(p.criador?.nome || "-")}</td>
        <td>${esc(p.fornecedor || "-")}</td>
        <td>${fmtMoney(p.valor_pago ?? p.valor_estimado)}</td>
        <td>${fmtDate(p.created_at)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function tabelaProdutos(lista) {
  if (!lista.length) return `<p class="muted">Nenhum produto abaixo do mínimo.</p>`;
  return `<table class="table">
    <thead><tr><th>Produto</th><th>SKU</th><th>Qtd. atual</th><th>Estoque mín.</th></tr></thead>
    <tbody>
      ${lista.map((p) => `<tr class="row-alert">
        <td>${esc(p.nome)}</td><td>${esc(p.sku || "-")}</td>
        <td>${esc(p.quantidade_atual)}</td><td>${esc(p.estoque_minimo)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}
