// =====================================================================
// Módulo DIRETORIA: aprovar/rejeitar cotações e ajustes de estoque
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, toast, pageHeader, modalForm, modalContent } from "./ui.js";
import { fetchPedidos, updatePedido } from "./pedidos.js";

let container, profile, pendentes = [], ajustesPendentes = [], pedidosDecididos = [];
let abaAtiva = "compras";

function mostrarAba(nome) {
  abaAtiva = nome;
  container.querySelectorAll("[data-sec]").forEach((s) => {
    s.style.display = s.dataset.sec === nome ? "block" : "none";
  });
  container.querySelectorAll("[data-tab]").forEach((b) => {
    b.className = b.dataset.tab === nome ? "btn btn-ok" : "btn";
  });
}

export async function render(el, prof, aba = "compras") {
  container = el;
  profile = prof;
  abaAtiva = aba;
  pendentes = await fetchPedidos(["aguardando_diretoria"]);
  const todos = await fetchPedidos();
  ajustesPendentes = await carregarAjustesPendentes();
  draw(todos);
}

async function carregarAjustesPendentes() {
  const { data, error } = await supabase
    .from("ajustes_estoque")
    .select("*, produto:produto_id(nome, quantidade_atual, unidade), solicitante:solicitante_id(nome)")
    .eq("status", "pendente")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

const TITULO_DIRETORIA = {
  compras: "Cotações para aprovar",
  historico: "Histórico de pedidos dos líderes",
  ajustes: "Ajustes manuais de estoque",
};

function draw(decididos) {
  pedidosDecididos = decididos || [];
  const titulo = TITULO_DIRETORIA[abaAtiva] || "Aprovações";
  container.innerHTML = `
    ${pageHeader(titulo, "")}

    <section class="card" data-sec="compras" style="display:none">
      <div class="card-head"><h3>Cotações para aprovar (${pendentes.length})</h3></div>
      ${pendentes.map(cardPedido).join("") || `<p class="muted">Nenhuma solicitação pendente.</p>`}
    </section>

    <section class="card" data-sec="historico" style="display:none" id="sec-historico">
      <div class="card-head"><h3>Histórico de pedidos dos líderes</h3></div>
      <table class="table">
        <thead><tr><th>#</th><th>Fornecedor</th><th>Valor</th><th>Status</th><th>Decidido em</th></tr></thead>
        <tbody>
          ${decididos.map((p) => `<tr data-detalhes="${p.id}" style="cursor:pointer">
            <td>${p.numero}</td>
            <td>${esc(p.fornecedor || "-")}</td>
            <td>${fmtMoney(p.valor_estimado)}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${fmtDate(p.data_decisao)}</td>
          </tr>`).join("") || `<tr><td colspan="5" class="muted">Nada ainda.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="card" data-sec="ajustes" style="display:none">
      <div class="card-head"><h3>Ajustes manuais de estoque pendentes (${ajustesPendentes.length})</h3></div>
      ${ajustesPendentes.map(cardAjuste).join("") || `<p class="muted">Nenhum ajuste pendente.</p>`}
    </section>
  `;

  container.querySelectorAll("[data-aprovar]").forEach((b) =>
    b.addEventListener("click", () => aprovar(b.dataset.aprovar)));
  container.querySelectorAll("[data-rejeitar]").forEach((b) =>
    b.addEventListener("click", () => rejeitar(b.dataset.rejeitar)));
  container.querySelectorAll("[data-aprovar-ajuste]").forEach((b) =>
    b.addEventListener("click", () => aprovarAjuste(b.dataset.aprovarAjuste)));
  container.querySelectorAll("[data-rejeitar-ajuste]").forEach((b) =>
    b.addEventListener("click", () => rejeitarAjuste(b.dataset.rejeitarAjuste)));
  container.querySelectorAll("[data-detalhes]").forEach((r) =>
    r.addEventListener("click", () => verDetalhes(r.dataset.detalhes)));
  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  mostrarAba(abaAtiva);
}

function verDetalhes(id) {
  const lista = [...pendentes, ...pedidosDecididos];
  const pedido = lista.find((p) => p.id === id);
  if (!pedido) return;

  const itens = (pedido.pedido_itens || []).map((i) =>
    `<li>${esc(i.descricao)} — ${Number(i.quantidade)}</li>`
  ).join("") || "<li class='muted'>Nenhum item.</li>";

  const html = `
    <p><strong>Pedido:</strong> #${pedido.numero}</p>
    <p><strong>Solicitante:</strong> ${esc(pedido.criador?.nome || "-")} (${esc(pedido.criador?.setor || "-")})</p>
    <p><strong>Fornecedor:</strong> ${esc(pedido.fornecedor || "-")}</p>
    <p><strong>Valor estimado:</strong> ${fmtMoney(pedido.valor_estimado)}</p>
    <p><strong>Status:</strong> ${statusBadge(pedido.status)}</p>
    <p><strong>Decidido em:</strong> ${fmtDate(pedido.data_decisao)}</p>
    ${pedido.motivo_rejeicao ? `<p class="muted"><strong>Motivo da rejeição:</strong> ${esc(pedido.motivo_rejeicao)}</p>` : ""}
    <h4 style="margin:.8rem 0 .2rem">Itens</h4>
    <ul class="item-list">${itens}</ul>
  `;
  modalContent(`Detalhes do pedido #${pedido.numero}`, html);
}

function cotacaoTotal(c, p) {
  return (c.itens || []).reduce((s, ci) => {
    const item = (p.pedido_itens || []).find((i) => i.id === ci.pedido_item_id);
    if (!item) return s;
    return s + (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
  }, 0);
}

function cardPedido(p) {
  const cot = (p.cotacoes || []).slice().sort((a, b) => cotacaoTotal(a, p) - cotacaoTotal(b, p));
  const menor = cot.length ? cotacaoTotal(cot[0], p) : null;

  const opcoes = cot.map((c, i) => {
    const total = cotacaoTotal(c, p);
    const linhas = (c.itens || []).map((ci) => {
      const item = (p.pedido_itens || []).find((it) => it.id === ci.pedido_item_id);
      if (!item) return "";
      const sub = (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
      return `<tr><td>${esc(item.descricao)}</td><td>${item.quantidade}</td><td>${fmtMoney(ci.valor_unitario)}</td><td>${fmtMoney(sub)}</td></tr>`;
    }).join("");
    const menorBadge = total === menor ? " <span class='badge badge-aprovado'>melhor preço</span>" : "";
    const obs = c.observacoes ? `<div class="muted" style="margin:.3rem 0">Observações: ${esc(c.observacoes)}</div>` : "";
    return `<label class="cotacao-opt" style="display:block; margin:.5rem 0; padding:.6rem; border:1px solid var(--border); border-radius:8px; cursor:pointer">
      <input type="radio" name="cot-${p.id}" value="${c.id}" ${i === 0 ? "checked" : ""} />
      <div style="display:inline-block; vertical-align:top; margin-left:.3rem">
        <strong>${esc(c.fornecedor)}</strong> — Total: ${fmtMoney(total)}${menorBadge}
        ${obs}
        <table class="table" style="margin:.4rem 0 0"><thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${linhas}</tbody></table>
      </div>
    </label>`;
  }).join("");

  return `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Pedido #${p.numero}</strong> ${statusBadge(p.status)}
      <span class="muted"> · solicitado por ${esc(p.criador?.nome || "-")}${p.criador?.setor ? ` (${esc(p.criador.setor)})` : ""} · cotado por ${esc(p.comprador?.nome || "-")} em ${fmtDate(p.created_at)}</span>
    </div>
    ${p.justificativa ? `<div class="muted">Justificativa: ${esc(p.justificativa)}</div>` : ""}

    <h4 style="margin:.9rem 0 .3rem">Cotações — escolha uma para aprovar</h4>
    ${opcoes}

    <div class="actions">
      <button class="btn btn-ok" data-aprovar="${p.id}">Aprovar selecionada</button>
      <button class="btn btn-danger" data-rejeitar="${p.id}">Rejeitar</button>
    </div>
  </div>`;
}

function cardAjuste(a) {
  const sinal = a.tipo === "adicionar" ? "+" : "-";
  const novaQtd = a.tipo === "adicionar"
    ? Number(a.produto?.quantidade_atual || 0) + Number(a.quantidade)
    : Number(a.produto?.quantidade_atual || 0) - Number(a.quantidade);
  return `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Ajuste de estoque</strong> ${statusBadge(a.status)}
      <span class="muted"> · solicitado por ${esc(a.solicitante?.nome || "-")} em ${fmtDate(a.created_at)}</span>
    </div>
    <p><strong>Produto:</strong> ${esc(a.produto?.nome || "-")}</p>
    <p><strong>Tipo:</strong> ${a.tipo === "adicionar" ? "Adicionar" : "Remover"}</p>
    <p><strong>Quantidade:</strong> ${sinal}${Number(a.quantidade)} ${esc(a.produto?.unidade || "")}</p>
    <p><strong>Quantidade atual:</strong> ${Number(a.produto?.quantidade_atual || 0)} → <strong>nova quantidade:</strong> ${novaQtd}</p>
    <p><strong>Justificativa:</strong> ${esc(a.justificativa || "-")}</p>
    <div class="actions">
      <button class="btn btn-ok" data-aprovar-ajuste="${a.id}">Aprovar</button>
      <button class="btn btn-danger" data-rejeitar-ajuste="${a.id}">Rejeitar</button>
    </div>
  </div>`;
}

async function aprovar(id) {
  const pedido = pendentes.find((p) => p.id === id);
  const sel = container.querySelector(`input[name="cot-${id}"]:checked`);
  if (!sel) return toast("Selecione uma cotação.", "error");
  const escolhida = (pedido.cotacoes || []).find((c) => c.id === sel.value);
  if (!escolhida) return toast("Cotação não encontrada.", "error");

  try {
    await updatePedido(pedido, {
      aprovado_por: profile.id,
      data_decisao: new Date().toISOString(),
      motivo_rejeicao: null,
      cotacao_escolhida: escolhida.id,
      fornecedor: escolhida.fornecedor,
      valor_estimado: cotacaoTotal(escolhida, pedido),
    }, "aprovado", profile.id, `Aprovado: ${escolhida.fornecedor}`);
    toast(`Pedido #${pedido.numero} aprovado.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function rejeitar(id) {
  const pedido = pendentes.find((p) => p.id === id);
  const v = await modalForm(`Rejeitar pedido #${pedido.numero}`, [
    { name: "motivo", label: "Motivo da rejeição", type: "textarea", required: true },
  ], "Rejeitar");
  if (!v) return;
  try {
    await updatePedido(pedido, {
      aprovado_por: profile.id,
      data_decisao: new Date().toISOString(),
      motivo_rejeicao: v.motivo.trim(),
    }, "rejeitado", profile.id, v.motivo.trim());
    toast(`Pedido #${pedido.numero} rejeitado.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function aprovarAjuste(id) {
  const a = ajustesPendentes.find((x) => x.id === id);
  if (!a) return;
  try {
    const atual = Number(a.produto?.quantidade_atual || 0);
    const nova = a.tipo === "adicionar" ? atual + Number(a.quantidade) : atual - Number(a.quantidade);

    const { error: e1 } = await supabase.from("produtos").update({ quantidade_atual: nova }).eq("id", a.produto_id);
    if (e1) throw e1;

    const { error: e2 } = await supabase.from("ajustes_estoque").update({
      status: "aprovado",
      aprovador_id: profile.id,
      data_decisao: new Date().toISOString(),
    }).eq("id", a.id);
    if (e2) throw e2;

    toast(`Ajuste aprovado. Quantidade de ${a.produto?.nome || "produto"} alterada para ${nova}.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function rejeitarAjuste(id) {
  const a = ajustesPendentes.find((x) => x.id === id);
  if (!a) return;
  const v = await modalForm("Rejeitar ajuste de estoque", [
    { name: "motivo", label: "Motivo da rejeição", type: "textarea", required: true },
  ], "Rejeitar");
  if (!v) return;
  try {
    const { error } = await supabase.from("ajustes_estoque").update({
      status: "rejeitado",
      aprovador_id: profile.id,
      data_decisao: new Date().toISOString(),
    }).eq("id", a.id);
    if (error) throw error;
    toast(`Ajuste de ${a.produto?.nome || "produto"} rejeitado.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}
