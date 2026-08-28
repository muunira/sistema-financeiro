// =====================================================================
// Módulo COMPRAS: cotações + preenchimento de pagamento após aprovação
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, fmtMoney, statusBadge, toast, pageHeader, modalForm, modalContent, confirmDialog } from "./ui.js";
import { fetchPedidos, updatePedido } from "./pedidos.js";

let container, profile, pendentes = [], aprovados = [], aConferir = [], outros = [], fornecedores = [], fornecedoresErro = null, produtos = [], solicitacoesProduto = [];
let abaAtiva = "cotar";
let fornModal = null;

function mostrarAba(nome) {
  abaAtiva = nome;
  container.querySelectorAll("[data-sec]").forEach((s) => {
    s.style.display = s.dataset.sec === nome ? "block" : "none";
  });
  container.querySelectorAll("[data-tab]").forEach((b) => {
    b.className = b.dataset.tab === nome ? "btn btn-ok" : "btn";
  });
}

export async function render(el, prof, aba = "cotar") {
  container = el;
  profile = prof;
  abaAtiva = aba;
  pendentes = await fetchPedidos(["solicitado", "em_cotacao"]);
  aprovados = await fetchPedidos(["aprovado"]);
  aConferir = await fetchPedidos(["recebido"]);
  outros = await fetchPedidos(["aguardando_diretoria", "aguardando_pagamento", "rejeitado", "pago", "conferido"]);
  await Promise.all([loadFornecedores(), loadProdutos(), loadSolicitacoesProduto()]);
  draw(aprovados, outros);
}

async function loadSolicitacoesProduto() {
  const { data, error } = await supabase
    .from("solicitacoes_produto")
    .select("*")
    .eq("status", "pendente")
    .order("created_at");
  if (error) throw error;
  solicitacoesProduto = data || [];
}

async function loadProdutos() {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw error;
  produtos = data || [];
}

async function loadFornecedores() {
  fornecedoresErro = null;
  try {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    fornecedores = data || [];
  } catch (err) {
    fornecedores = [];
    fornecedoresErro = err.message;
  }
}

function draw(aprovados, outros) {
  const fornList = fornecedores.map((f) => `<option value="${esc(f.nome)}">${esc(f.nome)}</option>`).join("");

  const solicitacoesHtml = solicitacoesProduto.map((s) => `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Solicitação de produto</strong>
      <span class="muted"> por ${esc(s.setor || "-")} em ${fmtDate(s.created_at)}</span>
    </div>
    <p><strong>Nome:</strong> ${esc(s.nome)}</p>
    <p><strong>Unidade:</strong> ${esc(s.unidade)}</p>
    ${s.sku ? `<p><strong>SKU:</strong> ${esc(s.sku)}</p>` : ""}
    ${s.justificativa ? `<p class="muted">Justificativa: ${esc(s.justificativa)}</p>` : ""}
    <div class="actions">
      <button class="btn btn-ok" data-cadastrar-produto="${s.id}">Cadastrar produto</button>
    </div>
  </div>`).join("");

  const titulo = {
    cotar: "Pedidos a cotar",
    pagar: "Aprovados — preencher pagamento",
    conferir: "Confirmar entrega de requisições",
    historico: "Histórico de requisições",
    fornecedores: "Lista de fornecedores",
    solicitacoes: "Solicitações de novos produtos",
  }[abaAtiva] || "Compras";

  container.innerHTML = `
    ${pageHeader(titulo, "")}

    <section class="card" data-sec="cotar" style="display:none">
      <div class="card-head"><h3>Pedidos a cotar (${pendentes.length})</h3></div>
      ${pendentes.map((p) => cardPedido(p, fornList)).join("") || `<p class="muted">Nenhum pedido aguardando cotação.</p>`}
    </section>

    <section class="card" data-sec="pagar" style="display:none">
      <div class="card-head"><h3>Aprovados — preencher pagamento (${aprovados.length})</h3></div>
      ${aprovados.map((p) => cardAprovado(p)).join("") || `<p class="muted">Nenhum pedido aprovado aguardando pagamento.</p>`}
    </section>

    <section class="card" data-sec="conferir" style="display:none">
      <div class="card-head"><h3>Confirmar entrega de requisições (${aConferir.length})</h3></div>
      ${aConferir.map((p) => cardConferir(p)).join("") || `<p class="muted">Nenhum pedido aguardando conferência.</p>`}
    </section>

    <section class="card" data-sec="historico" style="display:none">
      <div class="card-head"><h3>Histórico de requisições</h3></div>
      <table class="table">
        <thead><tr><th>#</th><th>Itens</th><th>Setor</th><th>Fornecedor</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          ${outros.map((p) => `<tr>
            <td>${p.numero}</td>
            <td><ul class="item-list">${(p.pedido_itens || []).map((i) => `<li>${esc(i.descricao)} (${i.quantidade})</li>`).join("")}</ul></td>
            <td>${esc(p.criador?.setor || "-")}</td>
            <td>${esc(p.fornecedor || "-")}</td><td>${fmtMoney(p.valor_estimado)}</td>
            <td>${statusBadge(p.status)}</td>
          </tr>`).join("") || `<tr><td colspan="6" class="muted">Nada aqui ainda.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="card" data-sec="solicitacoes" style="display:none">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
        <h3>Solicitações de novos produtos (${solicitacoesProduto.length})</h3>
        <button type="button" class="btn" id="btn-novo-produto">+ Novo produto</button>
      </div>
      ${solicitacoesHtml || `<p class="muted">Nenhuma solicitação pendente.</p>`}
    </section>

    <section class="card" data-sec="fornecedores" style="display:none">
      <div class="card-head"><h3>Lista de fornecedores</h3></div>
      <p>Gerencie os fornecedores para cotações e pagamentos.</p>
      <button class="btn" id="btn-fornecedores">Gerenciar fornecedores (${fornecedores.length})</button>
    </section>
  `;

  container.querySelector("#btn-fornecedores")?.addEventListener("click", abrirListaFornecedores);
  container.querySelector("#btn-novo-produto")?.addEventListener("click", () => cadastrarProduto());
  container.querySelectorAll("[data-cadastrar-produto]").forEach((b) =>
    b.addEventListener("click", () => cadastrarProduto(b.dataset.cadastrarProduto)));
  container.querySelectorAll("[data-conferir]").forEach((b) =>
    b.addEventListener("click", () => conferirPedido(b.dataset.conferir)));
  container.querySelectorAll("[data-add-cotacao]").forEach((f) => {
    f.addEventListener("submit", (e) => adicionarCotacao(e, f.dataset.addCotacao));
    f.addEventListener("input", () => atualizarTotais(f));
    atualizarTotais(f);
  });
  container.querySelectorAll("[data-remover-cot]").forEach((b) =>
    b.addEventListener("click", () => removerCotacao(b.dataset.removerCot)));
  container.querySelectorAll("[data-enviar]").forEach((b) =>
    b.addEventListener("click", () => enviar(b.dataset.enviar)));
  container.querySelectorAll("[data-pagamento]").forEach((f) => {
    f.addEventListener("submit", (e) => enviarPagamento(e, f.dataset.pagamento));
    const sel = f.querySelector("select[name='forma']");
    sel.addEventListener("change", () => toggleForma(f));
    toggleForma(f);
  });
  container.querySelectorAll("[data-retirar-item]").forEach((b) =>
    b.addEventListener("click", () => retirarItem(b.dataset.retirarItem)));
  container.querySelectorAll("[data-atender-estoque]").forEach((b) =>
    b.addEventListener("click", () => atenderDoEstoque(b.dataset.atenderEstoque)));
  container.querySelectorAll("[data-boleto]").forEach((b) =>
    b.addEventListener("click", () => abrirBoleto(b.dataset.boleto)));
  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  mostrarAba(abaAtiva);
}

function toggleForma(form) {
  const forma = form.forma.value;
  form.querySelector(".boleto-area").style.display = forma === "Boleto" ? "block" : "none";
  form.querySelector(".transf-area").style.display = forma === "Transferência" ? "block" : "none";

  form.querySelectorAll(".boleto-area input, .transf-area input").forEach((i) => {
    i.disabled = true;
  });
  if (forma === "Boleto") {
    form.querySelector(".boleto-area input").disabled = false;
  } else if (forma === "Transferência") {
    form.querySelectorAll(".transf-area input").forEach((i) => (i.disabled = false));
  }
}

function cardPedido(p, fornList) {
  const cotacoesHtml = p.cotacoes.length
    ? p.cotacoes.map((c) => cotationBox(c, p)).join("")
    : `<p class="muted" style="margin:.4rem 0">Nenhuma cotação adicionada.</p>`;

  const linhas = (p.pedido_itens || []).map((i) => `
    <tr data-pedido-item-id="${i.id}">
      <td>${esc(i.descricao)}</td>
      <td class="qtd">${Number(i.quantidade)}</td>
      <td><input name="unit-${i.id}" type="number" step="0.01" min="0" class="valor-unit" data-qtd="${Number(i.quantidade)}" /></td>
    </tr>`).join("");

  const linhasItens = (p.pedido_itens || []).map((i) => {
    const produto = produtos.find((x) => x.id === i.produto_id);
    const estoque = produto ? Number(produto.quantidade_atual || 0) : 0;
    const aviso = produto
      ? `<span class="muted">estoque atual: ${estoque} ${estoque >= Number(i.quantidade) ? '<span class="badge badge-aprovado">já tem</span>' : ''}</span>`
      : `<span class="muted">avulso</span>`;
    return `<tr>
      <td>${esc(i.descricao)}</td>
      <td>${Number(i.quantidade)}</td>
      <td>${aviso}</td>
      <td style="width:130px"><button class="btn-link" data-retirar-item="${p.id}:${i.id}">Retirar do pedido</button></td>
    </tr>`;
  }).join("");

  const atendimentoEstoque = (p.pedido_itens || []).every((i) => {
    if (!i.produto_id) return false;
    const produto = produtos.find((x) => x.id === i.produto_id);
    return produto && Number(produto.quantidade_atual || 0) >= Number(i.quantidade);
  }) && (p.pedido_itens || []).length > 0 && (p.pedido_itens || []).every((i) => i.produto_id);

  return `<div class="pedido-box">
    <div class="pedido-top" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:1.1rem;font-weight:600">Pedido #${p.numero}</div>
        <div class="muted">Setor: ${esc(p.criador?.setor || "-")}</div>
        <div class="muted">Solicitado por: ${esc(p.criador?.nome || "-")} em ${fmtDate(p.created_at)}</div>
      </div>
      ${statusBadge(p.status)}
    </div>
    ${p.justificativa ? `<div class="muted">Justificativa: ${esc(p.justificativa)}</div>` : ""}

    <h4 style="margin:.9rem 0 .2rem">Itens</h4>
    <table class="table" style="margin:.4rem 0">
      <thead><tr><th>Item</th><th>Qtd</th><th>Estoque</th><th></th></tr></thead>
      <tbody>${linhasItens || `<tr><td colspan="4" class="muted">Nenhum item.</td></tr>`}</tbody>
    </table>

    <h4 style="margin:.9rem 0 .2rem">Cotações</h4>
    ${cotacoesHtml}

    <form data-add-cotacao="${p.id}" class="cotacao-form" style="margin-top:1rem">
      <h4 style="margin:.6rem 0 .2rem">Nova cotação</h4>
      <label>Fornecedor
        <input name="fornecedor" list="forn-list-${p.id}" required />
        <datalist id="forn-list-${p.id}">${fornList}</datalist>
      </label>
      <table class="table" style="margin:.4rem 0">
        <thead><tr><th>Item</th><th>Qtd</th><th>Valor unitário (R$)</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <label>Observações (opcional)
        <textarea name="obs" rows="2" style="width:100%" placeholder="Prazo de entrega, condições, validade..."></textarea>
      </label>
      <div class="total-row">Total estimado: <strong class="total">-</strong></div>
      <button type="submit" class="btn">Salvar cotação</button>
    </form>

    <label>Observações finais (opcional)
      <textarea data-obs="${p.id}" rows="2" style="width:100%">${esc(p.obs_compras || "")}</textarea>
    </label>

    <div class="actions">
      ${atendimentoEstoque ? `
        <button class="btn btn-ok" data-atender-estoque="${p.id}" title="Todos os itens já estão disponíveis em estoque">
          ✅ Atender do estoque
        </button>
      ` : `
        <button class="btn btn-ok" data-enviar="${p.id}" ${p.cotacoes.length ? "" : "disabled"}>
          Enviar para Diretoria
        </button>
        ${p.cotacoes.length ? "" : `<span class="muted">Adicione ao menos uma cotação.</span>`}
      `}
    </div>
  </div>`;
}

function cotationBox(c, p) {
  const itens = (c.itens || []).map((ci) => {
    const item = (p.pedido_itens || []).find((i) => i.id === ci.pedido_item_id);
    if (!item) return "";
    const sub = (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
    return `<li>${esc(item.descricao)} (${item.quantidade}) × ${fmtMoney(ci.valor_unitario)} = ${fmtMoney(sub)}</li>`;
  }).join("");
  const total = (c.itens || []).reduce((s, ci) => {
    const item = (p.pedido_itens || []).find((i) => i.id === ci.pedido_item_id);
    if (!item) return s;
    return s + (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
  }, 0);

  return `<div class="cotacao-box">
    <div class="cotacao-head">
      <strong>${esc(c.fornecedor)}</strong>
      <span>Total: ${fmtMoney(total)}</span>
      <button class="btn-link" data-remover-cot="${c.id}">Excluir</button>
    </div>
    <ul class="item-list">${itens}</ul>
    ${c.observacoes ? `<p class="muted">Observações: ${esc(c.observacoes)}</p>` : ""}
  </div>`;
}

function cardAprovado(p) {
  const escolhida = p.cotacoes?.find((c) => c.id === p.cotacao_escolhida);
  const total = escolhida ? cotacaoTotal(escolhida, p) : 0;
  const itensHtml = escolhida
    ? `<ul class="item-list">${(escolhida.itens || []).map((ci) => {
        const item = p.pedido_itens.find((i) => i.id === ci.pedido_item_id);
        if (!item) return "";
        const sub = (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
        return `<li>${esc(item.descricao)} (${item.quantidade}) × ${fmtMoney(ci.valor_unitario)} = ${fmtMoney(sub)}</li>`;
      }).join("")}</ul>`
    : `<p class="muted">Cotação não encontrada.</p>`;

  const forma = ["Boleto", "Transferência"].includes(p.forma_pagamento) ? p.forma_pagamento : "Transferência";
  const ehBoleto = forma === "Boleto";
  const ehTransf = forma === "Transferência";

  const boletoLink = p.boleto_path
    ? ` <button type="button" class="btn-link" data-boleto="${esc(p.boleto_path)}">Ver boleto anexo</button>`
    : "";

  return `<div class="pedido-box">
    <div class="pedido-top" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:1.1rem;font-weight:600">Pedido #${p.numero}</div>
        <div class="muted">Setor: ${esc(p.criador?.setor || "-")}</div>
        <div class="muted">Fornecedor: ${esc(p.fornecedor || "-")}</div>
        <div class="muted">Aprovado em: ${fmtDate(p.data_decisao)}</div>
      </div>
      ${statusBadge(p.status)}
    </div>
    <p><strong>Total:</strong> ${fmtMoney(total)}</p>
    ${itensHtml}

    <form data-pagamento="${p.id}" class="pagamento-form" style="margin-top:1rem">
      <label>Forma de pagamento
        <select name="forma">
          <option value="Boleto" ${forma === "Boleto" ? "selected" : ""}>Boleto</option>
          <option value="Transferência" ${forma === "Transferência" ? "selected" : ""}>Transferência</option>
        </select>
      </label>

      <div class="boleto-area" style="display:${ehBoleto ? 'block' : 'none'}">
        <label>Boleto (PDF/IMG, máx. 5MB)
          <input name="arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg" ${!p.boleto_path ? "required" : ""} />
          ${boletoLink}
        </label>
      </div>

      <div class="transf-area" style="display:${ehTransf ? 'block' : 'none'}">
        <label>Banco <input name="banco" value="${esc(p.banco || "")}" required /></label>
        <label>Agência <input name="agencia" value="${esc(p.agencia || "")}" required /></label>
        <label>Conta <input name="conta" value="${esc(p.conta || "")}" required /></label>
        <label>Razão social <input name="razao" value="${esc(p.razao_social || "")}" required /></label>
        <label>CPF/CNPJ <input name="cpf_cnpj" value="${esc(p.cpf_cnpj || "")}" required /></label>
        <label>PIX <input name="pix" value="${esc(p.pix || "")}" required /></label>
      </div>

      <button type="submit" class="btn btn-ok">Enviar para Financeiro</button>
    </form>
  </div>`;
}

function cardConferir(p) {
  const linhas = (p.pedido_itens || []).map((i) => {
    const produto = produtos.find((x) => x.id === i.produto_id);
    const baixa = produto ? `<span class="muted">(baixa no estoque)</span>` : `<span class="muted">avulso</span>`;
    return `<li>${esc(i.descricao)} — ${Number(i.quantidade)} ${esc(produto?.unidade || "")} ${baixa}</li>`;
  }).join("");
  return `<div class="pedido-box">
    <div class="pedido-top" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:1.1rem;font-weight:600">Pedido #${p.numero}</div>
        <div class="muted">Setor: ${esc(p.criador?.setor || "-")}</div>
        <div class="muted">Fornecedor: ${esc(p.fornecedor || "-")}</div>
        <div class="muted">Recebido em: ${fmtDate(p.data_recebimento)}</div>
      </div>
      ${statusBadge(p.status)}
    </div>
    <h4 style="margin:.9rem 0 .2rem">Itens</h4>
    <ul class="item-list">${linhas}</ul>
    <div class="actions">
      <button class="btn btn-ok" data-conferir="${p.id}">Conferir e baixar do estoque</button>
    </div>
  </div>`;
}

function cotacaoTotal(c, p) {
  return (c.itens || []).reduce((s, ci) => {
    const item = (p.pedido_itens || []).find((i) => i.id === ci.pedido_item_id);
    if (!item) return s;
    return s + (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
  }, 0);
}

function atualizarTotais(form) {
  const rows = form.querySelectorAll("tbody tr[data-pedido-item-id]");
  let total = 0;
  rows.forEach((r) => {
    const qtd = Number(r.querySelector(".qtd").textContent) || 0;
    const unit = Number(r.querySelector(".valor-unit").value) || 0;
    total += qtd * unit;
  });
  form.querySelector(".total").textContent = fmtMoney(total);
}

async function adicionarCotacao(e, pedidoId) {
  e.preventDefault();
  const form = e.target;
  const pedido = pendentes.find((p) => p.id === pedidoId);
  const fornecedor = form.fornecedor.value.trim();
  if (!fornecedor) return toast("Informe o fornecedor.", "error");

  const rows = form.querySelectorAll("tbody tr[data-pedido-item-id]");
  const itensPayload = [];
  let total = 0;
  rows.forEach((r) => {
    const pedidoItemId = r.dataset.pedidoItemId;
    const qtd = Number(r.querySelector(".qtd").textContent) || 0;
    const unit = Number(r.querySelector(".valor-unit").value) || 0;
    total += qtd * unit;
    itensPayload.push({ pedido_item_id: pedidoItemId, valor_unitario: unit });
  });

  if (!itensPayload.length) return toast("Pedido sem itens.", "error");

  try {
    if (!fornecedoresErro && !fornecedores.some((f) => f.nome.toLowerCase() === fornecedor.toLowerCase())) {
      await supabase.from("fornecedores").insert({ nome: fornecedor, ativo: true });
    }

    const observacoes = form.obs.value.trim() || null;

    const { data: cotacao, error } = await supabase
      .from("cotacoes")
      .insert({ pedido_id: pedidoId, fornecedor, valor: total, observacoes })
      .select()
      .single();
    if (error) throw error;

    const payload = itensPayload.map((i) => ({ ...i, cotacao_id: cotacao.id }));
    const { error: e2 } = await supabase.from("cotacao_itens").insert(payload);
    if (e2) throw e2;

    toast(`Cotação de ${fornecedor} salva.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function removerCotacao(id) {
  if (!await confirmDialog("Excluir cotação", "Tem certeza?")) return;
  const { error } = await supabase.from("cotacoes").delete().eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast("Cotação removida.");
  render(container, profile);
}

async function enviar(pedidoId) {
  const pedido = pendentes.find((p) => p.id === pedidoId);
  if (!pedido.cotacoes.length) return toast("Adicione ao menos uma cotação.", "error");
  const obsEl = container.querySelector(`[data-obs="${pedidoId}"]`);
  const obs = obsEl?.value.trim() || null;
  const ok = await confirmDialog(
    "Enviar para Diretoria",
    `Tem certeza que deseja enviar o pedido #${pedido.numero} à Diretoria?`
  );
  if (!ok) return;
  try {
    await updatePedido(pedido, { comprador_id: profile.id, obs_compras: obs }, "aguardando_diretoria", profile.id);
    toast(`Pedido #${pedido.numero} enviado para a Diretoria.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function enviarPagamento(e, pedidoId) {
  e.preventDefault();
  const form = e.target;
  const pedido = aprovados.find((p) => p.id === pedidoId);
  const forma = form.forma.value;
  const patch = { forma_pagamento: forma };

  if (forma === "Boleto") {
    const file = form.arquivo.files[0];
    if (!file && !pedido.boleto_path) return toast("Anexe o boleto.", "error");
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast("Boleto deve ter no máximo 5MB.", "error");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${pedido.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("boletos").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      patch.boleto_path = path;
    }
  } else if (forma === "Transferência") {
    const campos = ["banco", "agencia", "conta", "razao", "cpf_cnpj", "pix"];
    for (const c of campos) {
      const v = form[c]?.value.trim();
      if (!v) return toast(`Preencha todos os campos obrigatórios de ${forma.toLowerCase()}.`, "error");
      patch[{
        banco: "banco", agencia: "agencia", conta: "conta", razao: "razao_social", cpf_cnpj: "cpf_cnpj", pix: "pix"
      }[c]] = v;
    }
  }

  try {
    await updatePedido(pedido, patch, "aguardando_pagamento", profile.id, `Pagamento: ${forma}`);
    toast(`Pedido #${pedido.numero} enviado ao Financeiro.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function conferirPedido(id) {
  const pedido = aConferir.find((p) => p.id === id);
  if (!pedido || pedido.status !== "recebido") return;

  const itensVinculados = (pedido.pedido_itens || []).filter((i) => i.produto_id);
  const aviso = itensVinculados.length
    ? `Serão baixados do estoque: ${itensVinculados.map((i) => `${i.descricao} (${i.quantidade})`).join(", ")}.`
    : "Nenhum item vinculado a produtos.";

  const ok = await confirmDialog(
    "Conferir recebimento",
    `Confirmar o pedido #${pedido.numero}? ${aviso}`
  );
  if (!ok) return;

  try {
    for (const item of itensVinculados) {
      const produto = produtos.find((x) => x.id === item.produto_id);
      const atual = Number(produto?.quantidade_atual || 0);
      const nova = Math.max(0, atual - Number(item.quantidade || 0));
      const { error } = await supabase.from("produtos").update({ quantidade_atual: nova }).eq("id", item.produto_id);
      if (error) throw error;
    }

    const { error } = await supabase.from("pedidos").update({
      status: "conferido",
      conferido_por: profile.id,
      data_conferencia: new Date().toISOString(),
    }).eq("id", pedido.id);
    if (error) throw error;

    await supabase.from("historico").insert({
      pedido_id: pedido.id, de_status: "recebido", para_status: "conferido", usuario_id: profile.id,
    });

    toast(`Pedido #${pedido.numero} conferido e baixado do estoque.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function retirarItem(chave) {
  const [pedidoId, itemId] = chave.split(":");
  const pedido = pendentes.find((p) => p.id === pedidoId);
  if (!pedido) return;
  const item = (pedido.pedido_itens || []).find((i) => i.id === itemId);
  if (!item) return;

  if ((pedido.pedido_itens || []).length <= 1) {
    return toast("Não é possível retirar o último item. Para cancelar a requisição, contate o administrador.", "error");
  }

  const ok = await confirmDialog(
    "Retirar item do pedido",
    `Tem certeza que deseja retirar "${item.descricao}" do pedido #${pedido.numero}?`
  );
  if (!ok) return;

  try {
    // Remove os valores unitários do item em cada cotação existente
    const cotaAfetadas = (pedido.cotacoes || []).filter((c) =>
      (c.itens || []).some((ci) => ci.pedido_item_id === itemId)
    );

    for (const c of cotaAfetadas) {
      const ci = (c.itens || []).find((x) => x.pedido_item_id === itemId);
      if (ci) {
        const { error: e1 } = await supabase.from("cotacao_itens").delete().eq("id", ci.id);
        if (e1) throw e1;
      }
      // Recalcula o total da cotação sem o item removido
      const total = (c.itens || [])
        .filter((x) => x.pedido_item_id !== itemId)
        .reduce((s, ci) => {
          const pi = (pedido.pedido_itens || []).find((i) => i.id === ci.pedido_item_id && i.id !== itemId);
          if (!pi) return s;
          return s + (Number(pi.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
        }, 0);
      const { error: e2 } = await supabase.from("cotacoes").update({ valor: total }).eq("id", c.id);
      if (e2) throw e2;
    }

    // Remove o item do pedido
    const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
    if (error) throw error;

    toast(`"${item.descricao}" retirado do pedido #${pedido.numero}.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function atenderDoEstoque(id) {
  const pedido = pendentes.find((p) => p.id === id);
  if (!pedido) return;

  const itens = (pedido.pedido_itens || []).filter((i) => i.produto_id);
  const aviso = itens.map((i) => `${esc(i.descricao)} (${i.quantidade})`).join(", ");

  const ok = await confirmDialog(
    "Atender do estoque",
    `Todos os itens deste pedido já existem em estoque na quantidade solicitada: ${aviso}. Deseja dar baixa imediata e marcar como conferido?`
  );
  if (!ok) return;

  try {
    for (const item of itens) {
      const produto = produtos.find((x) => x.id === item.produto_id);
      const atual = Number(produto?.quantidade_atual || 0);
      const nova = Math.max(0, atual - Number(item.quantidade || 0));
      const { error } = await supabase.from("produtos").update({ quantidade_atual: nova }).eq("id", item.produto_id);
      if (error) throw error;
    }

    const { error } = await supabase.from("pedidos").update({
      status: "conferido",
      conferido_por: profile.id,
      data_conferencia: new Date().toISOString(),
    }).eq("id", pedido.id);
    if (error) throw error;

    await supabase.from("historico").insert({
      pedido_id: pedido.id, de_status: "solicitado", para_status: "conferido", usuario_id: profile.id,
    });

    toast(`Pedido #${pedido.numero} atendido do estoque.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function abrirBoleto(path) {
  try {
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, "_blank");
  } catch (err) {
    toast("Não foi possível abrir o boleto: " + err.message, "error");
  }
}

// Formata o nome do produto (padroniza maiúsculas/minúsculas)
function formatarNomeProduto(nome) {
  const preposicoes = ["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "nas", "nos", "com", "por", "para", "sem", "sob"];
  const partes = nome.trim().toLowerCase().replace(/\s+/g, " ").split(" ");
  return partes.map((p, i) => {
    if (!p) return "";
    if (i === 0 || !preposicoes.includes(p)) {
      return p[0].toUpperCase() + p.slice(1);
    }
    return p;
  }).join(" ");
}

async function cadastrarProduto(solicitacaoId = null) {
  const solicitacao = solicitacaoId ? solicitacoesProduto.find((s) => s.id === solicitacaoId) : null;
  const valorNome = solicitacao ? solicitacao.nome : "";

  const v = await modalForm("Cadastrar produto", [
    { name: "nome", label: "Nome:", value: valorNome, required: true },
    { name: "estoque_minimo", label: "Estoque mínimo (opcional):", type: "number", value: "0", min: 0 },
  ], "Cadastrar");
  if (!v) return;

  const nome = formatarNomeProduto(v.nome);
  const estoque_minimo = Number(v.estoque_minimo) || 0;

  const { error } = await supabase.from("produtos").insert({
    nome,
    unidade: "UN",
    estoque_minimo,
    quantidade_atual: 0,
  });
  if (error) return toast("Erro: " + error.message, "error");

  if (solicitacao) {
    const { error: e2 } = await supabase.from("solicitacoes_produto").update({ status: "cadastrado" }).eq("id", solicitacao.id);
    if (e2) return toast("Erro ao atualizar solicitação: " + e2.message, "error");
  }

  toast(`Produto "${nome}" cadastrado.`);
  render(container, profile);
}

function abrirListaFornecedores() {
  const html = `
    ${fornecedoresErro ? `<p class="error">Fornecedores não carregaram: ${esc(fornecedoresErro)} — execute a migração 03 no Supabase.</p>` : ""}
    <table class="table fornecedores-table">
      <thead><tr><th>Nome</th><th style="width:130px">Ações</th></tr></thead>
      <tbody>
        ${fornecedores.map((f) => `<tr class="forn-row" data-fornecedor="${esc(f.nome)}" data-forn-id="${f.id}" style="cursor:pointer">
          <td>${esc(f.nome)}</td>
          <td>
            <button class="btn-link" data-edit-forn="${f.id}" data-nome="${esc(f.nome)}">Editar</button>
            <button class="btn-link" data-del-forn="${f.id}">Excluir</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="2" class="muted">Nenhum fornecedor cadastrado.</td></tr>`}
      </tbody>
    </table>`;

  fornModal = modalContent(`Fornecedores (${fornecedores.length})`, html, true);

  fornModal.querySelectorAll(".forn-row").forEach((r) =>
    r.addEventListener("click", () => verFornecedor(r.dataset.fornecedor)));
  fornModal.querySelectorAll("[data-edit-forn]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); editarFornecedor(b.dataset.editForn, b.dataset.nome); }));
  fornModal.querySelectorAll("[data-del-forn]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); excluirFornecedor(b.dataset.delForn); }));
}

// Recarrega os fornecedores, atualiza a página e reabre o modal da lista
async function refreshFornecedores() {
  if (fornModal) { fornModal.remove(); fornModal = null; }
  await loadFornecedores();
  draw(aprovados, outros);
  abrirListaFornecedores();
}

function verFornecedor(nome) {
  const pedidos = [...pendentes, ...aprovados, ...outros].filter((p) =>
    p.fornecedor === nome || (p.cotacoes || []).some((c) => c.fornecedor === nome)
  );
  const html = pedidos.length
    ? pedidos.map((p) => {
        const cots = (p.cotacoes || []).filter((c) => c.fornecedor === nome);
        const escolhida = p.fornecedor === nome ? ` <span class="badge badge-aprovado">escolhido</span>` : "";
        const detalhes = cots.map((c) => {
          const total = cotacaoTotal(c, p);
          const linhas = (c.itens || []).map((ci) => {
            const item = (p.pedido_itens || []).find((i) => i.id === ci.pedido_item_id);
            if (!item) return "";
            const sub = (Number(item.quantidade) || 0) * (Number(ci.valor_unitario) || 0);
            return `<tr><td>${esc(item.descricao)}</td><td>${item.quantidade}</td><td>${fmtMoney(ci.valor_unitario)}</td><td>${fmtMoney(sub)}</td></tr>`;
          }).join("");
          return `
            <p style="margin:.4rem 0 0"><strong>Pedido #${p.numero}</strong> ${escolhida} — Total: ${fmtMoney(total)}</p>
            <table class="table" style="margin:0 0 .6rem"><thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${linhas}</tbody></table>`;
        }).join("");
        return `<div style="margin-bottom:.8rem">${detalhes}</div>`;
      }).join("")
    : `<p class="muted">Nenhuma cotação para este fornecedor.</p>`;
  modalContent(`Cotações de ${nome}`, html, true);
}

async function editarFornecedor(id, nomeAtual) {
  const v = await modalForm("Editar fornecedor", [
    { name: "nome", label: "Nome", value: nomeAtual, required: true },
  ], "Salvar");
  if (!v) return;
  const { error } = await supabase.from("fornecedores").update({ nome: v.nome.trim() }).eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast("Fornecedor atualizado.");
  await refreshFornecedores();
}

async function excluirFornecedor(id) {
  if (!await confirmDialog("Excluir fornecedor", "Tem certeza que deseja excluir este fornecedor?")) return;
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast("Fornecedor excluído.");
  await refreshFornecedores();
}
