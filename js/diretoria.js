// =====================================================================
// Módulo DIRETORIA: aprovar/rejeitar cotações e ajustes de estoque
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, toast, pageHeader, modalForm, modalContent } from "./ui.js";
import { fetchPedidos, updatePedido } from "./pedidos.js";

let container, profile, pendentes = [], ajustesPendentes = [], pedidosDecididos = [];
let produtos = [];
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
  const { data: prods } = await supabase.from("produtos").select("*").order("nome");
  produtos = (prods || []).sort((a, b) => String(a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
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
        <thead><tr><th>#</th><th>Fornecedor</th><th>Valor</th><th>Status</th><th>Decidido em</th><th>Retirado do estoque</th></tr></thead>
        <tbody>
          ${decididos.map((p) => {
            const totalRetirado = (p.pedido_itens || []).reduce((s, i) => s + Number(i.quantidade_retirada || 0), 0);
            return `<tr data-detalhes="${p.id}" style="cursor:pointer">
              <td>${p.numero}</td>
              <td>${esc(p.fornecedor || "-")}</td>
              <td>${fmtMoney(p.valor_estimado)}</td>
              <td>${statusBadge(p.status)}</td>
              <td>${fmtDate(p.data_decisao)}</td>
              <td>${totalRetirado}</td>
            </tr>`;
          }).join("") || `<tr><td colspan="6" class="muted">Nada ainda.</td></tr>`}
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
  container.querySelectorAll("[data-arquivo-cot]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); abrirArquivoCotacao(b.dataset.arquivoCot); }));
  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  mostrarAba(abaAtiva);
}

function verDetalhes(id) {
  const lista = [...pendentes, ...pedidosDecididos];
  const pedido = lista.find((p) => p.id === id);
  if (!pedido) return;

  const itens = (pedido.pedido_itens || []).map((i) => {
    const prod = produtos.find((x) => x.id === i.produto_id);
    const un = esc(prod?.unidade || "");
    const qtd = Number(i.quantidade);
    const estoque = prod ? Number(prod.quantidade_atual || 0) : 0;
    const retirado = Number(i.quantidade_retirada || 0);
    const comprar = prod ? Math.max(0, qtd - estoque) : qtd;
    const estoqueInfo = prod
      ? ` <span class="muted">(retirado do estoque: ${retirado} ${un}, comprar: ${comprar} ${un})</span>`
      : ` <span class="muted">(comprar: ${qtd} ${un})</span>`;
    return `<li>${esc(i.descricao)} — cotação: ${qtd} ${un}${estoqueInfo}</li>`;
  }).join("") || "<li class='muted'>Nenhum item.</li>";

  const totalPedido = (pedido.pedido_itens || []).reduce((s, i) => {
    const prod = produtos.find((x) => x.id === i.produto_id);
    const qtd = Number(i.quantidade);
    const estoque = prod ? Number(prod.quantidade_atual || 0) : 0;
    const retirado = Number(i.quantidade_retirada || 0);
    const comprar = prod ? Math.max(0, qtd - estoque) : qtd;
    return s + retirado + comprar;
  }, 0);

  const html = `
    <p><strong>Pedido:</strong> #${pedido.numero}</p>
    <p><strong>Solicitante:</strong> ${esc(pedido.criador?.nome || "-")} (${esc(pedido.criador?.setor || "-")})</p>
    <p><strong>Fornecedor:</strong> ${esc(pedido.fornecedor || "-")}</p>
    <p><strong>Valor final:</strong> ${fmtMoney(pedido.valor_estimado)}</p>
    <p><strong>Especificação:</strong> ${esc(pedido.tipo || "-")} · <strong>Nº solicitação:</strong> ${esc(pedido.numero_solicitacao || "-")} · <strong>Dias para pagar:</strong> ${pedido.dias_pagamento ?? "-"}</p>
    <p><strong>Centro de Custo / Local de Faturamento:</strong> ${esc(pedido.centro_custo || "-")}</p>
    ${pedido.justificativa_compra ? `<p><strong>Justificativa de Solicitação de Compra:</strong> ${esc(pedido.justificativa_compra)}</p>` : ""}
    <p><strong>Status:</strong> ${statusBadge(pedido.status)}</p>
    <p><strong>Decidido em:</strong> ${fmtDate(pedido.data_decisao)}</p>
    <p><strong>Total do pedido:</strong> ${totalPedido} unidades</p>
    ${pedido.motivo_rejeicao ? `<p class="muted"><strong>Motivo da rejeição:</strong> ${esc(pedido.motivo_rejeicao)}</p>` : ""}
    <h4 style="margin:.8rem 0 .2rem">Itens</h4>
    <ul class="item-list">${itens}</ul>
  `;
  modalContent(`Detalhes do pedido #${pedido.numero}`, html);
}

function cardPedido(p) {
  const cot = (p.cotacoes || []).slice().sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
  const menor = cot.length ? Number(cot[0].valor || 0) : null;

  const totalPedido = (p.pedido_itens || []).reduce((s, i) => {
    const prod = produtos.find((x) => x.id === i.produto_id);
    const qtd = Number(i.quantidade);
    const estoque = prod ? Number(prod.quantidade_atual || 0) : 0;
    const retirado = Number(i.quantidade_retirada || 0);
    const comprar = prod ? Math.max(0, qtd - estoque) : qtd;
    return s + retirado + comprar;
  }, 0);

  const itensPedido = `<p><strong>Total do pedido:</strong> ${totalPedido} unidades</p>
    <ul class="item-list">${(p.pedido_itens || []).map((i) => {
    const prod = produtos.find((x) => x.id === i.produto_id);
    const un = esc(prod?.unidade || "");
    const qtd = Number(i.quantidade);
    const estoque = prod ? Number(prod.quantidade_atual || 0) : 0;
    const retirado = Number(i.quantidade_retirada || 0);
    const comprar = prod ? Math.max(0, qtd - estoque) : qtd;
    const estoqueInfo = prod
      ? `<span class="muted"> — retirado do estoque: ${retirado} ${un}, comprar: ${comprar} ${un}</span>`
      : `<span class="muted"> — comprar: ${qtd} ${un}</span>`;
    return `<li>${esc(i.descricao)} — cotação: ${qtd} ${un}${estoqueInfo}</li>`;
  }).join("")}</ul>`;

  const opcoes = cot.map((c, i) => {
    const total = Number(c.valor || 0);
    const menorBadge = total === menor ? " <span class='badge badge-aprovado'>menor valor</span>" : "";
    const dias = c.dias_pagamento ? ` · ${c.dias_pagamento} dia(s) para pagar` : "";
    const rid = `cot-${p.id}-${c.id}`;
    const arquivoBtn = c.arquivo_path
      ? `<button type="button" class="btn-link" data-arquivo-cot="${esc(c.arquivo_path)}">Ver orçamento</button>`
      : `<span class="muted">(sem orçamento)</span>`;
    return `<div class="cotacao-opt" style="display:flex; flex-direction:column; gap:.4rem; margin:.5rem 0; padding:.6rem; border:1px solid var(--border); border-radius:8px">
      <div style="display:flex; align-items:center; gap:.6rem;">
        <label for="${rid}" style="flex:1; margin:0; font-weight:400; cursor:pointer"><strong>${esc(c.fornecedor)}</strong> — Valor final: ${fmtMoney(total)}${menorBadge}${dias}</label>
        ${arquivoBtn}
        <input type="radio" id="${rid}" name="cot-${p.id}" value="${c.id}" ${i === 0 ? "checked" : ""} style="width:auto;flex:none;margin:0" />
      </div>
      ${c.observacoes ? `<p class="muted" style="margin:0; font-size:.85rem">Obs: ${esc(c.observacoes)}</p>` : ""}
    </div>`;
  }).join("");

  return `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Pedido #${p.numero}</strong> ${statusBadge(p.status)}
      <span class="muted"> · solicitado por ${esc(p.criador?.nome || "-")}${p.criador?.setor ? ` (${esc(p.criador.setor)})` : ""} · cotado por ${esc(p.comprador?.nome || "-")} em ${fmtDate(p.created_at)}</span>
    </div>
    ${p.pagar_apos ? `<p class="muted" style="margin:.4rem 0"><strong>Receber antes de pagar</strong></p>` : ""}
    <div class="muted" style="margin:.6rem 0; line-height:1.7">
      <div><strong>Nº solicitação:</strong> ${esc(p.numero_solicitacao || "-")}</div>
      <div><strong>Especificação de Compra:</strong> ${esc(p.tipo || "-")}</div>
      <div><strong>Centro de Custo / Local de Faturamento:</strong> ${esc(p.centro_custo || "-")}</div>
      <div><strong>Justificativa de Solicitação de Compra:</strong> ${esc(p.justificativa_compra || "-")}</div>
    </div>

    <h4 style="margin:.9rem 0 .3rem">Itens</h4>
    ${itensPedido}

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

async function abrirArquivoCotacao(path) {
  try {
    const { data, error } = await supabase.storage.from("cotacoes").createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, "_blank");
  } catch (err) {
    toast("Não foi possível abrir o arquivo: " + err.message, "error");
  }
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
      valor_estimado: Number(escolhida.valor || 0),
      dias_pagamento: escolhida.dias_pagamento ?? null,
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
