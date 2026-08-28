// =====================================================================
// Módulo AUDITORIA: log de ações principais do sistema
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, fmtDate, fmtMoney, pageHeader, toast, modalContent } from "./ui.js";

let container, profile, logs = [], usuarios = [];

const LABEL_ACAO = {
  INSERT: "inseriu",
  UPDATE: "alterou",
  DELETE: "excluiu",
};

export async function render(el, prof) {
  container = el;
  profile = prof;
  await carregarDados();
  draw();
}

async function carregarDados() {
  const { data: l, error: e1 } = await supabase
    .from("auditoria")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (e1) throw e1;
  logs = l || [];

  const { data: u, error: e2 } = await supabase.from("profiles").select("id, nome").order("nome");
  if (e2) throw e2;
  usuarios = u || [];
}

function nomeUsuario(id) {
  const u = usuarios.find((x) => x.id === id);
  return u ? u.nome : "Sistema";
}

function formatarDataHora(dt) {
  const d = new Date(dt);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function gerarResumo(l) {
  const u = nomeUsuario(l.usuario_id);
  const a = LABEL_ACAO[l.acao] || l.acao.toLowerCase();
  const d = l.detalhes || {};

  if (l.tabela === "pedidos") {
    if (l.acao === "UPDATE" && d.status === "aprovado") {
      return `<strong>${esc(u)}</strong> aprovou o pedido <strong>#${esc(d.numero || "-")}</strong>`;
    }
    return `<strong>${esc(u)}</strong> ${a} o pedido <strong>#${esc(d.numero || "-")}</strong>`;
  }

  if (l.tabela === "pedido_itens") {
    const local = d.pedido_id ? `no pedido ${esc(d.pedido_id)}` : "em um pedido";
    return `<strong>${esc(u)}</strong> ${a} o item <strong>${esc(d.descricao || "-")}</strong> ${local}`;
  }

  if (l.tabela === "produtos") {
    return `<strong>${esc(u)}</strong> ${a} o produto <strong>${esc(d.nome || "-")}</strong>`;
  }

  if (l.tabela === "fornecedores") {
    return `<strong>${esc(u)}</strong> ${a} o fornecedor <strong>${esc(d.nome || "-")}</strong>`;
  }

  if (l.tabela === "cotacoes") {
    return `<strong>${esc(u)}</strong> ${a} a cotação <strong>${esc(d.fornecedor || "-")}</strong>`;
  }

  if (l.tabela === "profiles") {
    return `<strong>${esc(u)}</strong> ${a} o usuário <strong>${esc(d.nome || d.email || "-")}</strong>`;
  }

  return `<strong>${esc(u)}</strong> ${a} registro em <strong>${esc(l.tabela)}</strong>`;
}

function detalhesAuditoria(id) {
  const l = logs.find((x) => x.id === id);
  if (!l) return;
  const d = l.detalhes || {};

  const infos = [];

  if (l.tabela === "pedidos") {
    if (d.numero) infos.push(["Pedido", `#${d.numero}`]);
    if (d.criador) infos.push(["Solicitante", `${d.criador.nome} (${d.criador.setor})`]);
    if (d.fornecedor) infos.push(["Fornecedor", d.fornecedor]);
    if (d.valor_estimado != null) infos.push(["Valor", fmtMoney(d.valor_estimado)]);
    if (d.forma_pagamento) infos.push(["Forma de pagamento", d.forma_pagamento]);
    if (d.status) infos.push(["Status", d.status]);
    if (d.justificativa) infos.push(["Justificativa", d.justificativa]);
    if (d.motivo_rejeicao) infos.push(["Motivo da rejeição", d.motivo_rejeicao]);
    if (Array.isArray(d.pedido_itens) && d.pedido_itens.length) {
      infos.push(["Itens", `<ul class="item-list">${d.pedido_itens.map((i) => `<li>${esc(i.descricao)} — ${Number(i.quantidade)}</li>`).join("")}</ul>`]);
    }
  } else if (l.tabela === "produtos") {
    if (d.nome) infos.push(["Produto", d.nome]);
    if (d.unidade) infos.push(["Unidade", d.unidade]);
    if (d.quantidade_atual != null) infos.push(["Quantidade atual", d.quantidade_atual]);
    if (d.estoque_minimo != null) infos.push(["Estoque mínimo", d.estoque_minimo]);
  } else if (l.tabela === "pedido_itens") {
    if (d.descricao) infos.push(["Item", d.descricao]);
    if (d.quantidade != null) infos.push(["Quantidade", d.quantidade]);
  } else if (l.tabela === "cotacoes") {
    if (d.fornecedor) infos.push(["Fornecedor", d.fornecedor]);
    if (d.valor != null) infos.push(["Valor", fmtMoney(d.valor)]);
    if (d.observacoes) infos.push(["Observações", d.observacoes]);
  } else if (l.tabela === "fornecedores") {
    if (d.nome) infos.push(["Fornecedor", d.nome]);
  } else {
    for (const [k, v] of Object.entries(d)) {
      if (["id", "created_at"].includes(k) || v == null) continue;
      if (typeof v === "object") continue;
      infos.push([capitalizar(k), v]);
    }
  }

  const detalhesHtml = infos.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${v}</li>`).join("") || "<li class='muted'>Sem detalhes adicionais.</li>";

  const html = `
    <p><strong>Ação:</strong> ${esc(acaoPortugues(l.acao))}</p>
    <p><strong>Tabela:</strong> ${esc(tabelaPortugues(l.tabela))}</p>
    <p><strong>Usuário:</strong> ${esc(nomeUsuario(l.usuario_id))}</p>
    <p><strong>Data/Hora:</strong> ${formatarDataHora(l.created_at)}</p>
    <h4 style="margin:.8rem 0 .2rem">Detalhes</h4>
    <ul class="item-list">${detalhesHtml}</ul>
  `;
  modalContent("Detalhes da ação", html);
}

function capitalizar(str) {
  return str.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function acaoPortugues(acao) {
  const map = { INSERT: "Inseriu", UPDATE: "Alterou", DELETE: "Excluiu" };
  return map[acao] || acao;
}

function tabelaPortugues(tabela) {
  const map = {
    pedidos: "Pedido",
    pedido_itens: "Item do pedido",
    produtos: "Produto",
    fornecedores: "Fornecedor",
    cotacoes: "Cotação",
    profiles: "Usuário",
    ajustes_estoque: "Ajuste de estoque",
    solicitacoes_produto: "Solicitação de produto",
    auditoria: "Auditoria",
  };
  return map[tabela] || tabela;
}

function draw() {
  const rows = logs.map((l) => `<tr data-detalhes-auditoria="${l.id}" style="cursor:pointer">
    <td>${formatarDataHora(l.created_at)}</td>
    <td>${gerarResumo(l)}</td>
  </tr>`).join("") || `<tr><td colspan="2" class="muted">Nenhum registro.</td></tr>`;

  container.innerHTML = `
    ${pageHeader("Registros de Auditoria", "Log das ações realizadas no sistema — clique para ver detalhes")}

    <section class="card">
      <table class="table">
        <thead><tr><th>Data/Hora</th><th>Resumo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;

  container.querySelectorAll("[data-detalhes-auditoria]").forEach((r) =>
    r.addEventListener("click", () => detalhesAuditoria(r.dataset.detalhesAuditoria)));
}
