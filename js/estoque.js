// =====================================================================
// Módulo ESTOQUE: controle de quantidades e recebimento de pedidos pagos
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, statusBadge, toast, pageHeader, modalForm, confirmDialog } from "./ui.js";

let container, profile, produtos = [], aReceber = [], ajustesPendentes = [];
let abaAtiva = "produtos";

function mostrarAba(nome) {
  abaAtiva = nome;
  container.querySelectorAll("[data-sec]").forEach((s) => {
    s.style.display = s.dataset.sec === nome ? "block" : "none";
  });
  container.querySelectorAll("[data-tab]").forEach((b) => {
    b.className = b.dataset.tab === nome ? "btn btn-ok" : "btn";
  });
}

export async function render(el, prof, aba = "produtos") {
  container = el;
  profile = prof;
  abaAtiva = aba;
  await Promise.all([loadProdutos(), loadAReceber(), loadAjustesPendentes()]);
  draw();
}

async function loadAjustesPendentes() {
  const { data, error } = await supabase
    .from("ajustes_estoque")
    .select("*, produto:produto_id(nome)")
    .eq("solicitante_id", profile.id)
    .in("status", ["pendente", "aprovado", "rejeitado"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  ajustesPendentes = data || [];
}

async function loadProdutos() {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw error;
  produtos = data || [];
}

// Pedidos já pagos, aguardando a chegada física dos itens
async function loadAReceber() {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, pedido_itens(*)")
    .eq("status", "pago")
    .order("numero", { ascending: false });
  if (error) throw error;
  aReceber = data || [];
}

const TITULO_ESTOQUE = {
  produtos: "Estoque",
  recebimento: "Aguardando recebimento",
  ajustes: "Ajustes manuais de estoque",
};

function draw() {
  const titulo = TITULO_ESTOQUE[abaAtiva] || "Estoque";
  container.innerHTML = `
    ${pageHeader(titulo, "")}

    <section class="card" data-sec="produtos" style="display:none">
      <div class="card-head"><h3>Produtos em estoque</h3></div>
      <table class="table">
        <thead><tr>
          <th>Produto</th><th>SKU</th><th>Un.</th>
          <th>Qtd. atual</th><th>Estoque mín.</th><th></th>
        </tr></thead>
        <tbody>
          ${produtos.map(rowProduto).join("") || `<tr><td colspan="6" class="muted">Nenhum produto cadastrado.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="card" data-sec="recebimento" style="display:none">
      <div class="card-head"><h3>Aguardando recebimento (${aReceber.length})</h3></div>
      ${aReceber.map(cardRecebimento).join("") || `<p class="muted">Nenhum pedido pago aguardando recebimento.</p>`}
    </section>

    <section class="card" data-sec="ajustes" style="display:none">
      <div class="card-head"><h3>Ajustes manuais de estoque</h3></div>
      <table class="table">
        <thead><tr><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Justificativa</th><th>Status</th><th>Solicitado em</th></tr></thead>
        <tbody>
          ${ajustesPendentes.map(rowAjuste).join("") || `<tr><td colspan="6" class="muted">Nenhum ajuste solicitado.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  container.querySelectorAll("[data-adicionar]").forEach((b) =>
    b.addEventListener("click", () => ajustarEstoque(b.dataset.adicionar, "adicionar")));
  container.querySelectorAll("[data-remover]").forEach((b) =>
    b.addEventListener("click", () => ajustarEstoque(b.dataset.remover, "remover")));
  container.querySelectorAll("[data-excluir-produto]").forEach((b) =>
    b.addEventListener("click", () => excluirProduto(b.dataset.excluirProduto)));
  container.querySelectorAll("[data-receber]").forEach((b) =>
    b.addEventListener("click", () => confirmarRecebimento(b.dataset.receber)));
  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  mostrarAba(abaAtiva);
}

function rowProduto(p) {
  const baixo = Number(p.quantidade_atual) <= Number(p.estoque_minimo);
  return `<tr class="${baixo ? "row-alert" : ""}">
    <td>${esc(p.nome)}</td><td>${esc(p.sku || "-")}</td><td>${esc(p.unidade)}</td>
    <td>${esc(p.quantidade_atual)} ${baixo ? "⚠️" : ""}</td>
    <td>${esc(p.estoque_minimo)}</td>
    <td>
      <button class="btn-link" data-adicionar="${p.id}">+ Adicionar</button>
      <button class="btn-link" data-remover="${p.id}">- Remover</button>
      <button class="btn-link" data-excluir-produto="${p.id}">Excluir</button>
    </td>
  </tr>`;
}

function cardRecebimento(p) {
  const linhas = (p.pedido_itens || []).map((i) => {
    const vinculado = i.produto_id
      ? `<span class="badge badge-aprovado">soma no estoque</span>`
      : `<span class="muted">avulso — ajuste manual</span>`;
    return `<li>${esc(i.descricao)} (${i.quantidade}) ${vinculado}</li>`;
  }).join("");
  const temAvulso = (p.pedido_itens || []).some((i) => !i.produto_id);
  return `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Pedido #${p.numero}</strong> ${statusBadge(p.status)}
      <span class="muted"> · fornecedor ${esc(p.fornecedor || "-")} · pago em ${fmtDate(p.data_pagamento)}</span>
    </div>
    <ul class="item-list">${linhas}</ul>
    ${temAvulso ? `<p class="muted">Itens avulsos não são somados automaticamente. Ajuste a quantidade manualmente na tabela de produtos.</p>` : ""}
    <div class="actions">
      <button class="btn btn-ok" data-receber="${p.id}">Dar OK no recebimento</button>
    </div>
  </div>`;
}

// -------- Recebimento: soma os itens no estoque --------
async function excluirProduto(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;
  const ok = await confirmDialog("Excluir produto", `Tem certeza que deseja excluir "${produto.nome}"? Itens antigos vinculados a este produto serão desvinculados, mas os pedidos permanecem.`);
  if (!ok) return;

  try {
    const { error: e1 } = await supabase.from("pedido_itens").update({ produto_id: null }).eq("produto_id", id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("produtos").delete().eq("id", id);
    if (e2) throw e2;
    toast(`Produto "${produto.nome}" excluído.`);
    render(container, profile);
  } catch (err) {
    console.error("Erro ao excluir produto:", err);
    toast("Erro: " + err.message, "error");
  }
}

async function confirmarRecebimento(id) {
  const pedido = aReceber.find((p) => p.id === id);
  if (!pedido) return;
  const ok = await confirmDialog(
    "Confirmar recebimento",
    `Confirmar a chegada dos itens do pedido #${pedido.numero}? As quantidades vinculadas a produtos serão somadas ao estoque.`
  );
  if (!ok) return;

  try {
    // Soma no estoque cada item vinculado a um produto cadastrado
    for (const item of pedido.pedido_itens || []) {
      if (!item.produto_id) continue;
      const produto = produtos.find((p) => p.id === item.produto_id);
      const atual = Number(produto?.quantidade_atual || 0);
      const nova = atual + Number(item.quantidade || 0);
      const { error } = await supabase.from("produtos")
        .update({ quantidade_atual: nova })
        .eq("id", item.produto_id);
      if (error) throw error;
    }

    const { error: e1 } = await supabase.from("pedidos")
      .update({
        status: "recebido",
        recebido_por: profile.id,
        data_recebimento: new Date().toISOString(),
      })
      .eq("id", pedido.id);
    if (e1) throw e1;

    await supabase.from("historico").insert({
      pedido_id: pedido.id, de_status: "pago", para_status: "recebido", usuario_id: profile.id,
    });

    toast(`Pedido #${pedido.numero} recebido e lançado no estoque.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

function rowAjuste(a) {
  const sinal = a.tipo === "adicionar" ? "+" : "-";
  return `<tr>
    <td>${esc(a.produto?.nome || "-")}</td>
    <td>${a.tipo === "adicionar" ? "Adicionar" : "Remover"}</td>
    <td>${sinal}${Number(a.quantidade)}</td>
    <td>${esc(a.justificativa || "-")}</td>
    <td>${statusBadge(a.status)}</td>
    <td>${fmtDate(a.created_at)}</td>
  </tr>`;
}

async function ajustarEstoque(id, tipo) {
  const p = produtos.find((x) => x.id === id);
  const v = await modalForm(tipo === "adicionar" ? `Adicionar no estoque: ${p.nome}` : `Remover do estoque: ${p.nome}`, [
    { name: "quantidade", label: `Quantos você quer ${tipo === "adicionar" ? "adicionar" : "remover"}?`, type: "number", min: 1, value: "1", required: true },
    { name: "justificativa", label: "Justificativa", type: "textarea", required: true },
  ], "Solicitar ajuste");
  if (!v) return;

  const qtd = Number(v.quantidade);
  if (!qtd || qtd <= 0) return toast("Informe uma quantidade maior que zero.", "error");
  if (tipo === "remover" && qtd > Number(p.quantidade_atual || 0)) {
    return toast("Não é possível remover mais do que existe em estoque.", "error");
  }

  const { error } = await supabase.from("ajustes_estoque").insert({
    produto_id: p.id,
    tipo,
    quantidade: qtd,
    justificativa: v.justificativa.trim(),
    solicitante_id: profile.id,
    status: "pendente",
  });
  if (error) return toast("Erro: " + error.message, "error");

  toast(`Solicitação de ${tipo} enviada para a Diretoria.`);
  render(container, profile);
}


