// =====================================================================
// Módulo REQUISIÇÕES: líderes de setor solicitam itens de compra
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, statusBadge, toast, pageHeader, modalForm, modalContent } from "./ui.js";
import { getProdutos } from "./cache.js";

let container, profile, produtos = [], requisicoes = [], solicitacoes = [];
let abaAtiva = "nova";

function mostrarAba(nome) {
  abaAtiva = nome;
  container.querySelectorAll("[data-sec]").forEach((s) => {
    s.style.display = s.dataset.sec === nome ? "block" : "none";
  });
  container.querySelectorAll("[data-tab]").forEach((b) => {
    b.className = b.dataset.tab === nome ? "btn btn-ok" : "btn";
  });
}

export async function render(el, prof, aba = "nova") {
  container = el;
  profile = prof;
  abaAtiva = aba;
  await Promise.all([getProdutos().then((p) => (produtos = p)), loadSolicitacoes()]);
  requisicoes = await loadMinhasRequisicoes();
  draw(requisicoes);
}

async function loadSolicitacoes() {
  const { data, error } = await supabase
    .from("solicitacoes_produto")
    .select("*")
    .eq("solicitante_id", profile.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  solicitacoes = data || [];
}

async function loadMinhasRequisicoes() {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, pedido_itens(*)")
    .eq("criado_por", profile.id)
    .order("numero", { ascending: false });
  if (error) throw error;
  return data || [];
}

function draw(requisicoes) {
  const rowsSolicitacoes = solicitacoes.map((s) => `<tr>
    <td>${esc(s.nome)}</td>
    <td>${esc(s.justificativa || "-")}</td>
    <td>${statusBadge(s.status)}</td>
    <td>${fmtDate(s.created_at)}</td>
  </tr>`).join("") || `<tr><td colspan="4" class="muted">Nenhuma solicitação ainda.</td></tr>`;

  const titulo = {
    nova: "Nova requisição",
    historico: "Histórico de requisições",
    produtos: "Itens solicitados para cadastro",
  }[abaAtiva] || "Requisições";

  container.innerHTML = `
    ${pageHeader(titulo, profile.setor ? `Setor: ${profile.setor}` : "")}

    <section class="card" data-sec="nova" style="display:none">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
        <h3>Nova requisição</h3>
        <button type="button" class="btn" id="add-produto">+ Solicitar cadastro de produto</button>
      </div>
      <form id="form-requisicao">
        <div id="itens-requisicao"></div>
        <button type="button" class="btn btn-outline" id="add-item" style="margin-bottom:1rem">+ Adicionar item</button>
        <label>Justificativa de Solicitação de Compra
          <textarea id="justificativa-compra" rows="2" placeholder="Descreva o motivo da compra" required></textarea>
        </label>
        <label>Observações (opcional)
          <textarea id="justificativa" rows="2" placeholder="Ex.: item diferente do cadastro, quantidade maior que o padrão..."></textarea>
        </label>
        <button type="submit" class="btn">Enviar requisição para Compras</button>
      </form>
    </section>

    <section class="card" data-sec="historico" style="display:none">
      <div class="card-head"><h3>Histórico de requisições</h3></div>
      <table class="table">
        <thead><tr><th>#</th><th>Criada em</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${requisicoes.map(rowRequisicao).join("") || `<tr><td colspan="4" class="muted">Nenhuma requisição ainda.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="card" data-sec="produtos" style="display:none">
      <div class="card-head"><h3>Itens solicitados para cadastro</h3></div>
      <table class="table">
        <thead><tr><th>Item</th><th>Observações</th><th>Status</th><th>Solicitado em</th></tr></thead>
        <tbody>${rowsSolicitacoes}</tbody>
      </table>
    </section>
  `;

  container.querySelector("#add-item").addEventListener("click", addItemRow);
  container.querySelector("#add-produto").addEventListener("click", novoProduto);
  container.querySelector("#form-requisicao").addEventListener("submit", enviarRequisicao);
  container.querySelectorAll("[data-detalhes]").forEach((r) =>
    r.addEventListener("click", () => verDetalhes(r.dataset.detalhes)));
  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  mostrarAba(abaAtiva);
  addItemRow(); // começa com uma linha
}

function statusEntrega(status) {
  const label = status === "conferido" ? "ENTREGUE" : null;
  return statusBadge(status, label);
}

function rowRequisicao(p) {
  return `<tr data-detalhes="${p.id}" style="cursor:pointer" class="row-click">
    <td><strong>#${p.numero}</strong></td>
    <td>${fmtDate(p.created_at)}</td>
    <td>${statusEntrega(p.status)}</td>
    <td><button class="btn-link" data-detalhes="${p.id}">Ver detalhes</button></td>
  </tr>`;
}

function verDetalhes(id) {
  const p = requisicoes.find((x) => x.id === id);
  if (!p) return;
  const itens = (p.pedido_itens || []).map((i) =>
    `<li>${esc(i.descricao)} — quantidade: ${Number(i.quantidade)}</li>`
  ).join("") || "<li class=\"muted\">Nenhum item.</li>";
  const html = `
    <p><strong>Número:</strong> #${p.numero}</p>
    <p><strong>Status:</strong> ${statusBadge(p.status)}</p>
    <p><strong>Criada em:</strong> ${fmtDate(p.created_at)}</p>
    <p><strong>Justificativa de Solicitação de Compra:</strong> ${esc(p.justificativa_compra || "-")}</p>
    <p><strong>Observações:</strong> ${esc(p.justificativa || "-")}</p>
    <h4 style="margin:.8rem 0 .2rem">Itens</h4>
    <ul class="item-list">${itens}</ul>
  `;
  modalContent(`Detalhes da requisição #${p.numero}`, html);
}

// Formata o nome no padrão: primeira letra de cada palavra maiúscula,
// preposições pequenas minúsculas, exceto se for a primeira palavra.
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

async function novoProduto() {
  const v = await modalForm("Solicitar cadastro de produto", [
    { name: "nome", label: "Nome:", required: true },
    { name: "observacoes", label: "Observações (opcional)", type: "textarea" },
  ], "Solicitar cadastro");
  if (!v) return;

  const nome = formatarNomeProduto(v.nome);

  const { error } = await supabase.from("solicitacoes_produto").insert({
    nome,
    unidade: "UN",
    justificativa: v.observacoes?.trim() || null,
    solicitante_id: profile.id,
    setor: profile.setor || null,
  });
  if (error) return toast("Erro: " + error.message, "error");

  toast(`Solicitação de cadastro para "${nome}" enviada ao setor de Compras.`);
}

// -------- Itens do formulário de requisição --------
function addItemRow(produtoId = null) {
  const wrap = container.querySelector("#itens-requisicao");
  const div = document.createElement("div");
  div.className = "item-row";
  const opts = produtos.map((p) => `<option value="${p.id}" ${p.id === produtoId ? "selected" : ""}>${esc(p.nome)}</option>`).join("");
  div.innerHTML = `
    <div class="item-grid">
      <label>Produto
        <select class="item-produto">
          <option value="">Selecione ou deixe em branco para item avulso</option>${opts}
        </select>
      </label>
      <label>Descrição
        <input class="item-desc" placeholder="Ex.: Luvas de segurança" />
      </label>
      <label>Qtd
        <input class="item-qtd" type="number" min="1" value="1" />
      </label>
      <button type="button" class="btn-link remove-item" title="Remover item">×</button>
    </div>
  `;
  const sel = div.querySelector(".item-produto");
  const desc = div.querySelector(".item-desc");
  const p = produtos.find((x) => x.id === produtoId);
  if (p) desc.value = p.nome;
  sel.addEventListener("change", () => {
    const p = produtos.find((x) => x.id === sel.value);
    if (p) desc.value = p.nome;
  });
  div.querySelector(".remove-item").addEventListener("click", () => div.remove());
  wrap.appendChild(div);
}

async function enviarRequisicao(e) {
  e.preventDefault();
  const rows = [...container.querySelectorAll(".item-row")];
  const itens = rows.map((r) => ({
    produto_id: r.querySelector(".item-produto").value || null,
    descricao: r.querySelector(".item-desc").value.trim(),
    quantidade: Number(r.querySelector(".item-qtd").value) || 1,
  })).filter((i) => i.descricao);

  if (!itens.length) return toast("Adicione pelo menos um item.", "error");

  const justificativaCompra = container.querySelector("#justificativa-compra").value.trim();
  if (!justificativaCompra) return toast("Preencha a Justificativa de Solicitação de Compra.", "error");
  const justificativa = container.querySelector("#justificativa").value.trim() || null;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      criado_por: profile.id,
      justificativa_compra: justificativaCompra,
      justificativa,
      status: "solicitado",
    })
    .select()
    .single();
  if (error) return toast("Erro: " + error.message, "error");

  const itensPayload = itens.map((i) => ({ ...i, pedido_id: pedido.id }));
  const { error: e2 } = await supabase.from("pedido_itens").insert(itensPayload);
  if (e2) return toast("Erro nos itens: " + e2.message, "error");

  await supabase.from("historico").insert({
    pedido_id: pedido.id, de_status: null, para_status: "solicitado", usuario_id: profile.id,
  });

  toast("Requisição #" + pedido.numero + " enviada para Compras.");
  render(container, profile);
}
