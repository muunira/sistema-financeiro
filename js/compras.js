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

export async function render(el, prof, aba = null) {
  container = el;
  profile = prof;
  abaAtiva = aba || abaAtiva || "cotar";
  pendentes = await fetchPedidos(["solicitado", "em_cotacao"]);
  aprovados = await fetchPedidos(["aprovado"]);
  aConferir = await fetchPedidos(["pago", "recebido"]);
  outros = await fetchPedidos(["aguardando_diretoria", "aguardando_pagamento", "aguardando_recebimento", "recebido", "rejeitado", "pago", "conferido", "concluido"]);
  await Promise.all([loadFornecedores(), loadProdutos(), loadSolicitacoesProduto()]);
  draw(aprovados, outros);
}

async function loadSolicitacoesProduto() {
  const { data, error } = await supabase
    .from("solicitacoes_produto")
    .select("*")
    .eq("status", "pendente")
    .order("nome");
  if (error) throw error;
  solicitacoesProduto = data || [];
}

async function loadProdutos() {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw error;
  produtos = (data || []).sort((a, b) => String(a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
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
    conferir: "Confirmar entrega aos setores",
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
      <div class="card-head"><h3>Confirmar entrega aos setores (${aConferir.length})</h3></div>
      ${aConferir.map((p) => cardConferir(p)).join("") || `<p class="muted">Nenhum pedido recebido aguardando entrega/distribuição ao setor.</p>`}
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
    b.addEventListener("click", () => conferirPedido(null, b.dataset.conferir)));
  container.querySelectorAll("[data-add-cotacao]").forEach((f) => {
    f.addEventListener("submit", (e) => adicionarCotacao(e, f.dataset.addCotacao));
  });
  container.querySelectorAll("[data-arquivo-cot]").forEach((b) =>
    b.addEventListener("click", () => abrirArquivoCotacao(b.dataset.arquivoCot)));
  container.querySelectorAll("[data-remover-cot]").forEach((b) =>
    b.addEventListener("click", () => removerCotacao(b.dataset.removerCot)));
  container.querySelectorAll("[data-editar-cot]").forEach((b) =>
    b.addEventListener("click", () => editarCotacao(b.dataset.editarCot)));
  container.querySelectorAll("[data-enviar]").forEach((b) =>
    b.addEventListener("click", () => enviar(b.dataset.enviar)));
  container.querySelectorAll("[data-pagamento]").forEach((f) => {
    f.addEventListener("submit", (e) => enviarPagamento(e, f.dataset.pagamento));
    const sel = f.querySelector("select[name='forma']");
    sel?.addEventListener("change", () => toggleForma(f));
    toggleForma(f);
  });
  container.querySelectorAll("[data-pagar-apos]").forEach((chk) =>
    chk.addEventListener("change", () => {
      const label = container.querySelector(`[data-dias-label="${chk.dataset.pagarApos}"]`);
      if (label) label.style.display = chk.checked ? "block" : "none";
    }));
  const campoColuna = {
    "num-sol": "numero_solicitacao",
    "tipo": "tipo",
    "centro-custo": "centro_custo",
    "justificativa-compra": "justificativa_compra",
  };
  Object.entries(campoColuna).forEach(([attr, coluna]) => {
    container.querySelectorAll(`[data-${attr}]`).forEach((el) => {
      el.addEventListener("blur", async () => {
        const pedidoId = el.dataset[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
        const valor = el.value.trim() || null;
        await supabase.from("pedidos").update({ [coluna]: valor }).eq("id", pedidoId);
      });
    });
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

  const resumo = (p.pedido_itens || []).reduce((acc, i) => {
    const produto = produtos.find((x) => x.id === i.produto_id);
    const estoque = produto ? Number(produto.quantidade_atual || 0) : 0;
    const qtd = Number(i.quantidade);
    const doEstoque = produto ? Math.min(qtd, estoque) : 0;
    const aComprar = produto ? Math.max(0, qtd - doEstoque) : qtd;
    const retirado = Number(i.quantidade_retirada || 0);
    acc.pedido += qtd;
    acc.estoque += doEstoque;
    acc.comprar += aComprar;
    acc.retirado += retirado;
    return acc;
  }, { pedido: 0, estoque: 0, comprar: 0, retirado: 0 });

  const linhasItens = (p.pedido_itens || []).map((i) => {
    const produto = produtos.find((x) => x.id === i.produto_id);
    const estoque = produto ? Number(produto.quantidade_atual || 0) : 0;
    const qtd = Number(i.quantidade);
    const doEstoque = produto ? Math.min(qtd, estoque) : 0;
    const aComprar = produto ? Math.max(0, qtd - doEstoque) : qtd;
    const retirado = Number(i.quantidade_retirada || 0);
    const aviso = produto
      ? `<span class="muted">do estoque: ${doEstoque} — a comprar: ${aComprar} — já retirado: ${retirado}</span>`
      : `<span class="muted">avulso — a comprar: ${qtd}</span>`;
    return `<tr>
      <td>${esc(i.descricao)}</td>
      <td>${qtd}</td>
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

    <div class="pedido-campos" style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.8rem 0;align-items:start">
      <label>Nº da solicitação
        <input data-num-sol="${p.id}" value="${esc(p.numero_solicitacao || "")}" placeholder="Ex.: 12345" required />
      </label>
      <label>Especificação de Compra
        <input data-tipo="${p.id}" value="${esc(p.tipo || "")}" placeholder="Ex.: Materiais de Limpeza" />
      </label>
      <label>Centro de Custo ou Local de Faturamento
        <input data-centro-custo="${p.id}" value="${esc(p.centro_custo || "")}" placeholder="Ex.: Loja Centro" />
      </label>
      <label>Justificativa de Solicitação de Compra
        <textarea data-justificativa-compra="${p.id}" rows="1" style="width:100%" placeholder="Descreva o motivo da compra">${esc(p.justificativa_compra || "")}</textarea>
      </label>
    </div>

    ${p.justificativa ? `<div class="muted">Justificativa: ${esc(p.justificativa)}</div>` : ""}

    <h4 style="margin:.9rem 0 .2rem">Itens</h4>
    <div class="muted" style="margin:0 0 .6rem">
      Total do pedido: <strong>${resumo.pedido}</strong> —
      Do estoque: <strong>${resumo.estoque}</strong> —
      A comprar: <strong>${resumo.comprar}</strong> —
      Já retirado: <strong>${resumo.retirado}</strong>
    </div>
    <table class="table" style="margin:.4rem 0">
      <thead><tr><th>Item</th><th>Qtd</th><th>Estoque</th><th></th></tr></thead>
      <tbody>${linhasItens || `<tr><td colspan="4" class="muted">Nenhum item.</td></tr>`}</tbody>
    </table>

    <h4 style="margin:.9rem 0 .2rem">Cotações Realizadas:</h4>
    ${cotacoesHtml}

    <form data-add-cotacao="${p.id}" class="cotacao-form" style="margin-top:1rem">
      <h4 style="margin:.6rem 0 .2rem">Nova cotação</h4>
      <label>Distribuidora
        <input name="fornecedor" list="forn-list-${p.id}" required />
        <datalist id="forn-list-${p.id}">${fornList}</datalist>
      </label>
      <label>Valor final (R$)
        <input name="valor" type="number" step="0.01" min="0" required />
      </label>
      <label data-dias-label="${p.id}" style="display:${p.pagar_apos ? "block" : "none"}">Dias para pagar
        <input name="dias_pagamento" type="number" min="0" placeholder="Ex.: 30" />
      </label>
      <label>Arquivo da cotação (PDF/IMG, máx. 5MB)
        <input name="arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg" />
      </label>
      <label>Observações (opcional)
        <textarea name="obs" rows="2" style="width:100%" placeholder="Prazo de entrega, condições, validade..."></textarea>
      </label>
      <button type="submit" class="btn">Salvar cotação</button>
    </form>

    <label style="display:flex;align-items:center;gap:.5rem;margin:.6rem 0;font-weight:500">
      <input type="checkbox" data-pagar-apos="${p.id}" ${p.pagar_apos ? "checked" : ""} style="width:auto;margin:0" />
      Receber primeiro, pagar depois (o pedido vai ao Estoque antes do Financeiro)
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
  const arquivoBtn = c.arquivo_path
    ? ` <button class="btn-link" data-arquivo-cot="${esc(c.arquivo_path)}">Ver orçamento</button>`
    : ` <span class="muted">(sem arquivo)</span>`;
  const dias = c.dias_pagamento ? ` · ${c.dias_pagamento} dia(s)` : "";
  return `<div class="cotacao-box">
    <div class="cotacao-head">
      <strong>${esc(c.fornecedor)}</strong>
      <span>Valor: ${fmtMoney(c.valor)}${dias}</span>
      ${arquivoBtn}
      <button class="btn-link" data-editar-cot="${c.id}">Editar</button>
      <button class="btn-link" data-remover-cot="${c.id}">Excluir</button>
    </div>
    ${c.observacoes ? `<p class="muted">Observações: ${esc(c.observacoes)}</p>` : ""}
  </div>`;
}

function cardAprovado(p) {
  const escolhida = p.cotacoes?.find((c) => c.id === p.cotacao_escolhida);
  const total = escolhida ? Number(escolhida.valor || 0) : Number(p.valor_estimado || 0);
  const itensHtml = `<ul class="item-list">${(p.pedido_itens || []).map((i) => `<li>${esc(i.descricao)} (${Number(i.quantidade)})</li>`).join("")}</ul>`;
  const arquivoBtn = escolhida?.arquivo_path
    ? `<button type="button" class="btn-link" data-arquivo-cot="${esc(escolhida.arquivo_path)}">Ver orçamento da cotação</button>`
    : "";

  const forma = ["Boleto", "Transferência"].includes(p.forma_pagamento) ? p.forma_pagamento : "Transferência";
  const ehBoleto = forma === "Boleto";
  const ehTransf = forma === "Transferência";

  const boletosAnexados = Array.isArray(p.boletos) ? p.boletos : (p.boletos ? [p.boletos] : []);
  const boletoLinks = boletosAnexados.length
    ? `<div style="margin-top:.4rem">${boletosAnexados.map((b, i) => `<button type="button" class="btn-link" data-boleto="${esc(b)}">Ver boleto ${i + 1}</button>`).join(" ")}</div>`
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
    <p><strong>Valor final:</strong> ${fmtMoney(total)}</p>
    <p><strong>Nº solicitação:</strong> ${esc(p.numero_solicitacao || "-")}</p>
    <p><strong>Especificação de Compra:</strong> ${esc(p.tipo || "-")}</p>
    <p><strong>Centro de Custo / Local de Faturamento:</strong> ${esc(p.centro_custo || "-")}</p>
    ${p.justificativa_compra ? `<p><strong>Justificativa de Solicitação de Compra:</strong> ${esc(p.justificativa_compra)}</p>` : ""}
    <p><strong>Dias para pagar:</strong> ${p.dias_pagamento ?? "-"} ${arquivoBtn}</p>
    ${itensHtml}
    <p class="muted" style="margin-top:.6rem">
      ${p.pagar_apos
        ? "Fluxo: receber primeiro, pagar depois. Preencha os dados e envie ao Estoque para recebimento."
        : "Fluxo: pagar primeiro, receber depois. Preencha os dados e envie ao Financeiro para pagamento."}
    </p>

    <form data-pagamento="${p.id}" class="pagamento-form" style="margin-top:1rem">
      <label>Forma de pagamento
        <select name="forma">
          <option value="Boleto" ${forma === "Boleto" ? "selected" : ""}>Boleto</option>
          <option value="Transferência" ${forma === "Transferência" ? "selected" : ""}>Transferência</option>
        </select>
      </label>

      <div class="boleto-area" style="display:${ehBoleto ? 'block' : 'none'}">
        <label>Boletos (PDF/IMG, máx. 5MB cada — selecione 1 ou mais)
          <input name="arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg" multiple ${!boletosAnexados.length ? "required" : ""} />
          ${boletoLinks}
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

      <button type="submit" class="btn btn-ok">${p.pagar_apos ? "Enviar para Estoque (recebimento)" : "Enviar para Financeiro (pagamento)"}</button>
    </form>
  </div>`;
}

function cardConferir(p) {
  const linhas = (p.pedido_itens || []).map((i) => {
    const produto = produtos.find((x) => x.id === i.produto_id);
    const baixa = produto ? `<span class="muted">(baixa no estoque)</span>` : `<span class="muted">avulso</span>`;
    return `<li>${esc(i.descricao)} — ${Number(i.quantidade)} ${esc(produto?.unidade || "")} ${baixa}</li>`;
  }).join("");

  const podeConferir = (p.pagar_apos && p.status === "pago") || (!p.pagar_apos && p.status === "recebido");
  const botao = podeConferir
    ? `<button class="btn btn-ok" data-conferir="${p.id}">Confirmar distribuição ao setor</button>`
    : `<span class="muted">Aguardando ${p.pagar_apos ? "pagamento" : "recebimento"} antes de entregar.</span>`;

  return `<div class="pedido-box">
    <div class="pedido-top" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:1.1rem;font-weight:600">Pedido #${p.numero}</div>
        <div class="muted">Setor: ${esc(p.criador?.setor || "-")}</div>
        <div class="muted">Fornecedor: ${esc(p.fornecedor || "-")}</div>
        <div class="muted">Solicitado por: ${esc(p.criador?.nome || "-")}</div>
      </div>
      ${statusBadge(p.status)}
    </div>
    <h4 style="margin:.9rem 0 .2rem">Itens a distribuir</h4>
    <ul class="item-list">${linhas}</ul>
    <p class="muted">Confirme a distribuição dos itens ao setor solicitante. As quantidades vinculadas a produtos serão removidas do estoque automaticamente.</p>
    <div class="actions">${botao}</div>
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

async function adicionarCotacao(e, pedidoId) {
  e.preventDefault();
  const form = e.target;
  const fornecedor = form.fornecedor.value.trim();
  if (!fornecedor) return toast("Informe a distribuidora.", "error");

  const valor = Number(form.valor.value);
  if (!valor || valor <= 0) return toast("Informe o valor final da cotação.", "error");

  try {
    if (!fornecedoresErro && !fornecedores.some((f) => f.nome.toLowerCase() === fornecedor.toLowerCase())) {
      await supabase.from("fornecedores").insert({ nome: fornecedor, ativo: true });
    }

    let arquivoPath = null;
    const file = form.arquivo.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast("O arquivo deve ter no máximo 5MB.", "error");
      const ext = file.name.split(".").pop().toLowerCase();
      arquivoPath = `${pedidoId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cotacoes").upload(arquivoPath, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
    }

    const observacoes = form.obs.value.trim() || null;
    const diasPag = form.dias_pagamento?.value ? Number(form.dias_pagamento.value) : null;

    const { error } = await supabase
      .from("cotacoes")
      .insert({ pedido_id: pedidoId, fornecedor, valor, dias_pagamento: diasPag, observacoes, arquivo_path: arquivoPath });
    if (error) throw error;

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

async function editarCotacao(id) {
  let c, pedido;
  for (const p of pendentes) {
    const found = p.cotacoes.find((x) => x.id === id);
    if (found) { c = found; pedido = p; break; }
  }
  if (!c) return toast("Cotação não encontrada.", "error");

  const html = `
    <form id="form-editar-cotacao" class="modal-form">
      <label>Distribuidora
        <input name="fornecedor" value="${esc(c.fornecedor)}" required />
      </label>
      <label>Valor final (R$)
        <input name="valor" type="number" step="0.01" min="0" value="${c.valor}" required />
      </label>
      <label>Dias para pagar
        <input name="dias_pagamento" type="number" min="0" value="${c.dias_pagamento ?? ""}" />
      </label>
      <label>Arquivo da cotação (PDF/IMG, máx. 5MB)
        <input name="arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg" />
        ${c.arquivo_path ? `<p class="muted">Arquivo atual: <button type="button" class="btn-link" data-arquivo-cot="${esc(c.arquivo_path)}">Ver orçamento</button></p>` : ""}
      </label>
      <label>Observações
        <textarea name="obs" rows="3">${esc(c.observacoes || "")}</textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn-link" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-ok">Salvar</button>
      </div>
    </form>
  `;
  const overlay = modalContent("Editar cotação", html);
  overlay.querySelector("[data-cancel]")?.addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-arquivo-cot]")?.addEventListener("click", (e) => { e.preventDefault(); abrirArquivoCotacao(c.arquivo_path); });
  overlay.querySelector("#form-editar-cotacao").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await salvarCotacao(e.target, c, pedido);
    if (ok) overlay.remove();
  });
}

async function salvarCotacao(form, c, pedido) {
  const fornecedor = form.fornecedor.value.trim();
  if (!fornecedor) return toast("Informe a distribuidora.", "error"), false;

  const valor = Number(form.valor.value);
  if (!valor || valor <= 0) return toast("Informe o valor final da cotação.", "error"), false;

  try {
    if (!fornecedoresErro && !fornecedores.some((f) => f.nome.toLowerCase() === fornecedor.toLowerCase())) {
      await supabase.from("fornecedores").insert({ nome: fornecedor, ativo: true });
    }

    let arquivoPath = c.arquivo_path;
    const file = form.arquivo.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast("O arquivo deve ter no máximo 5MB.", "error"), false;
      const ext = file.name.split(".").pop().toLowerCase();
      arquivoPath = `${c.pedido_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cotacoes").upload(arquivoPath, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
    }

    const observacoes = form.obs.value.trim() || null;
    const diasPag = form.dias_pagamento?.value ? Number(form.dias_pagamento.value) : null;

    const { error } = await supabase
      .from("cotacoes")
      .update({ fornecedor, valor, dias_pagamento: diasPag, observacoes, arquivo_path: arquivoPath })
      .eq("id", c.id);
    if (error) throw error;

    if (pedido && pedido.cotacao_escolhida === c.id) {
      await supabase.from("pedidos").update({
        fornecedor,
        valor_estimado: valor,
        dias_pagamento: diasPag,
      }).eq("id", c.pedido_id);
    }

    toast(`Cotação de ${fornecedor} atualizada.`);
    render(container, profile);
    return true;
  } catch (err) {
    toast("Erro: " + err.message, "error");
    return false;
  }
}

async function enviar(pedidoId) {
  const pedido = pendentes.find((p) => p.id === pedidoId);
  if (!pedido.cotacoes.length) return toast("Adicione ao menos uma cotação.", "error");
  const pagarApos = container.querySelector(`[data-pagar-apos="${pedidoId}"]`)?.checked || false;
  const numSol = container.querySelector(`[data-num-sol="${pedidoId}"]`)?.value.trim() || null;
  const tipo = container.querySelector(`[data-tipo="${pedidoId}"]`)?.value.trim() || null;
  const centroCusto = container.querySelector(`[data-centro-custo="${pedidoId}"]`)?.value.trim() || null;
  const justificativaCompra = container.querySelector(`[data-justificativa-compra="${pedidoId}"]`)?.value.trim() || null;
  if (!numSol) return toast("Preencha o Nº da solicitação antes de enviar.", "error");
  const ok = await confirmDialog(
    "Enviar para Diretoria",
    `Tem certeza que deseja enviar o pedido #${pedido.numero} à Diretoria?${pagarApos ? "\n\nEste pedido será recebido antes de ser pago." : ""}`
  );
  if (!ok) return;
  try {
    await updatePedido(pedido, {
      comprador_id: profile.id,
      pagar_apos: pagarApos,
      numero_solicitacao: numSol,
      tipo,
      centro_custo: centroCusto,
      justificativa_compra: justificativaCompra,
    }, "aguardando_diretoria", profile.id);
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
    const boletosAtuais = Array.isArray(pedido.boletos) ? pedido.boletos : (pedido.boletos ? [pedido.boletos] : []);
    const files = Array.from(form.arquivo.files || []);
    if (!files.length && !boletosAtuais.length) return toast("Anexe pelo menos um boleto.", "error");

    const novosPaths = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) return toast(`Cada boleto deve ter no máximo 5MB: ${file.name}`, "error");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${pedido.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("boletos").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      novosPaths.push(path);
    }

    if (novosPaths.length) {
      patch.boletos = [...boletosAtuais, ...novosPaths];
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
    const novoStatus = pedido.pagar_apos ? "aguardando_recebimento" : "aguardando_pagamento";
    await updatePedido(pedido, patch, novoStatus, profile.id, `Pagamento: ${forma}`);
    toast(`Pedido #${pedido.numero} enviado para ${pedido.pagar_apos ? "Estoque (receber antes de pagar)" : "Financeiro (pagar antes de receber)"}.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}

async function conferirPedido(e, id) {
  e?.preventDefault();
  const pedido = aConferir.find((p) => p.id === id);
  if (!pedido || !["pago", "recebido"].includes(pedido.status)) return;
  const podeConferir = (pedido.pagar_apos && pedido.status === "pago") || (!pedido.pagar_apos && pedido.status === "recebido");
  if (!podeConferir) return toast("Este pedido ainda não pode ser entregue.", "error");

  const itensVinculados = (pedido.pedido_itens || []).filter((i) => i.produto_id);
  const aviso = itensVinculados.length
    ? `Serão baixados do estoque: ${itensVinculados.map((i) => `${i.descricao} (${i.quantidade})`).join(", ")}.`
    : "Nenhum item vinculado a produtos.";

  const ok = await confirmDialog(
    "Confirmar entrega ao setor",
    `Confirmar a entrega do pedido #${pedido.numero} ao setor ${pedido.criador?.setor || "-"}? ${aviso}`
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

    await updatePedido(pedido, {
      conferido_por: profile.id,
      data_conferencia: new Date().toISOString(),
    }, "concluido", profile.id, "Entregue");

    toast(`Pedido #${pedido.numero} entregue ao setor e baixado do estoque.`);
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

  const ehUltimoItem = (pedido.pedido_itens || []).length <= 1;
  const produto = produtos.find((x) => x.id === item.produto_id);
  const estoque = produto ? Number(produto.quantidade_atual || 0) : 0;
  const qtdAtual = Number(item.quantidade || 0);

  const v = await modalForm(
    `Retirar "${item.descricao}" do pedido`,
    [{
      name: "quantidade",
      label: `Quantidade a retirar (${produto ? `disponível em estoque: ${estoque} · ` : ""}pedido: ${qtdAtual})`,
      type: "number",
      min: 1,
      max: qtdAtual,
      value: produto ? Math.min(qtdAtual, estoque || qtdAtual) : qtdAtual,
      required: true,
    }],
    "Retirar"
  );
  if (!v) return;
  const retirada = Math.max(1, Math.min(qtdAtual, Number(v.quantidade) || 0));
  if (retirada <= 0) return;

  if (retirada >= qtdAtual && ehUltimoItem) {
    return toast("Não é possível remover totalmente o último item. Reduza a quantidade ou contate o administrador para cancelar a requisição.", "error");
  }

  // Se o item está vinculado a um produto, dá baixa no estoque das unidades
  // retiradas (elas serão atendidas pelo estoque, não compradas).
  const baixaEstoque = produto ? Math.min(retirada, estoque) : 0;
  if (produto && baixaEstoque < retirada) {
    const ok = await confirmDialog(
      "Estoque insuficiente",
      `Só há ${estoque} em estoque, mas você está retirando ${retirada}. Serão baixadas ${baixaEstoque} do estoque. Continuar?`
    );
    if (!ok) return;
  }

  try {
    if (produto && baixaEstoque > 0) {
      const nova = Math.max(0, estoque - baixaEstoque);
      const { error: e1 } = await supabase.from("produtos").update({ quantidade_atual: nova }).eq("id", produto.id);
      if (e1) throw e1;
    }

    if (retirada >= qtdAtual) {
      const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
      if (error) throw error;
      toast(`"${item.descricao}" retirado do pedido #${pedido.numero}.${baixaEstoque ? ` ${baixaEstoque} baixado(s) do estoque.` : ""}`);
    } else {
      const novaQtd = qtdAtual - retirada;
      const retiradaTotal = Number(item.quantidade_retirada || 0) + baixaEstoque;
      const { error } = await supabase.from("pedido_itens").update({ quantidade: novaQtd, quantidade_retirada: retiradaTotal }).eq("id", itemId);
      if (error) throw error;
      toast(`Retirada ${retirada} unidade(s) de "${item.descricao}". Novo total no pedido: ${novaQtd}.${baixaEstoque ? ` ${baixaEstoque} baixado(s) do estoque.` : ""}`);
    }
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
      const qtd = Number(item.quantidade || 0);
      const nova = Math.max(0, atual - qtd);
      const { error } = await supabase.from("produtos").update({ quantidade_atual: nova }).eq("id", item.produto_id);
      if (error) throw error;
      const retirado = Number(item.quantidade_retirada || 0) + qtd;
      await supabase.from("pedido_itens").update({ quantidade_retirada: retirado }).eq("id", item.id);
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
          const arquivoBtn = c.arquivo_path
            ? ` <button class="btn-link" data-arquivo-cot="${esc(c.arquivo_path)}">Ver orçamento</button>`
            : "";
          return `
            <p style="margin:.4rem 0 .6rem"><strong>Pedido #${p.numero}</strong> ${escolhida} — Valor: ${fmtMoney(c.valor)}${arquivoBtn}</p>`;
        }).join("");
        return `<div style="margin-bottom:.8rem">${detalhes}</div>`;
      }).join("")
    : `<p class="muted">Nenhuma cotação para este fornecedor.</p>`;
  const modal = modalContent(`Cotações de ${nome}`, html, true);
  modal.querySelectorAll("[data-arquivo-cot]").forEach((b) =>
    b.addEventListener("click", () => abrirArquivoCotacao(b.dataset.arquivoCot)));
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
