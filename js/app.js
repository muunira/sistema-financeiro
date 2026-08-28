// =====================================================================
// Shell da aplicação: autenticação, navegação por papel e roteamento
// =====================================================================
import { requireAuth, logout } from "./auth.js";
import { ROLE_LABELS, supabase } from "./supabase.js";
import { bindThemeButton } from "./theme.js";
import { esc } from "./ui.js";

// Módulos (cada um exporta uma função render(container, profile))
import * as requisicoes from "./requisicoes.js";
import * as estoque from "./estoque.js";
import * as compras from "./compras.js";
import * as diretoria from "./diretoria.js";
import * as financeiro from "./financeiro.js";
import * as admin from "./admin.js";
import * as conta from "./conta.js";
import * as dashboard from "./dashboard.js";
import * as relatorio from "./relatorio.js";
import * as auditoria from "./auditoria.js";

const TODOS = ["admin", "lider", "estoque", "compras", "diretoria", "financeiro"];

// Ícones (SVG inline, herdam a cor via currentColor)
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  requisicoes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><rect x="4" y="4" width="16" height="18" rx="2"/><path d="M9 12h6M9 16h4"/></svg>',
  estoque:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12l8.73-5.04M12 22V12"/></svg>',
  compras:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  diretoria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  financeiro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  relatorio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h2v4H8zM14 11h2v6h-2z"/></svg>',
  auditoria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>',
  usuarios:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  conta:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',

  // Líder
  req_nova:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  req_historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  req_produtos:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',

  // Estoque
  est_produtos:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12l8.73-5.04M12 22V12"/></svg>',
  est_recebimento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9M12 12V3m0 0l-4 4m4-4l4 4"/></svg>',
  est_ajustes:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',

  // Compras
  comp_cotar:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  comp_aprovados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>',
  comp_conferir:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  comp_historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  comp_solicitacoes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/><line x1="16" y1="2" x2="16" y1="8"/><line x1="20" y1="6" x2="14" y2="6"/></svg>',
  comp_fornecedores:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',

  // Diretoria
  dir_cotacoes:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  dir_historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  dir_ajustes:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',

  // Financeiro
  fin_pagar:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  fin_relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h2v4H8zM14 11h2v6h-2z"/></svg>',
  fin_realizados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
};

// Definição das telas: id -> { label, roles permitidos, render }
const VIEWS = {
  // Líder
  req_nova:       { label: "Nova requisição",              group: "Líderes",    roles: ["lider", "admin"],                        render: (el, prof) => requisicoes.render(el, prof, "nova") },
  req_historico:  { label: "Histórico de requisições",     group: "Líderes",    roles: ["lider", "admin"],                        render: (el, prof) => requisicoes.render(el, prof, "historico") },
  req_produtos:   { label: "Itens solicitados para cadastro", group: "Líderes", roles: ["lider", "admin"],                     render: (el, prof) => requisicoes.render(el, prof, "produtos") },

  // Estoque/Compras
  est_produtos:   { label: "Estoque",                      group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => estoque.render(el, prof, "produtos") },
  comp_solicitacoes: { label: "Solicitações de novos produtos", group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "solicitacoes") },
  comp_cotar:     { label: "Pedidos a cotar",              group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "cotar") },
  comp_aprovados: { label: "Aprovados (preencher pagamento)", group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "pagar") },
  est_recebimento:{ label: "Aguardando recebimento",       group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => estoque.render(el, prof, "recebimento") },
  comp_conferir:  { label: "Confirmar entrega de requisições", group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "conferir") },
   comp_historico: { label: "Histórico de requisições",     group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "historico") },
  est_ajustes:    { label: "Ajustes manuais de estoque",   group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => estoque.render(el, prof, "ajustes") },
  comp_fornecedores:{ label: "Lista de fornecedores",     group: "Compras / Estoque", roles: ["estoque", "compras", "estoque_compras", "admin"], render: (el, prof) => compras.render(el, prof, "fornecedores") },

  // Diretoria
  dir_cotacoes:   { label: "Cotações para aprovar",        group: "Diretoria",  roles: ["diretoria", "admin"],                       render: (el, prof) => diretoria.render(el, prof, "compras") },
  dir_historico:  { label: "Histórico de pedidos dos líderes", group: "Diretoria", roles: ["diretoria", "admin"],                    render: (el, prof) => diretoria.render(el, prof, "historico") },
  dir_ajustes:    { label: "Ajustes manuais de estoque",   group: "Diretoria",  roles: ["diretoria", "admin"],                       render: (el, prof) => diretoria.render(el, prof, "ajustes") },
  auditoria:      { label: "Registros de Auditoria",       group: "Diretoria",  roles: ["diretoria", "admin"],                       render: auditoria.render },

  // Financeiro
  fin_pagar:      { label: "Aguardando pagamento",         group: "Financeiro", roles: ["financeiro", "admin"],                      render: (el, prof) => financeiro.render(el, prof, "pagar") },
  fin_relatorios: { label: "Relatórios",                   group: "Financeiro", roles: ["financeiro", "admin"],                      render: (el, prof) => financeiro.render(el, prof, "relatorios") },
  fin_realizados: { label: "Pagamentos realizados",        group: "Financeiro", roles: ["financeiro", "admin"],                      render: (el, prof) => financeiro.render(el, prof, "realizados") },
  usuarios:       { label: "Usuários",                     group: "Admin",      roles: ["admin", "diretoria", "financeiro"],         render: admin.render },

  // Geral
  dashboard:      { label: "Dashboard",                    group: "Admin",      roles: ["admin"],                                      render: dashboard.render },
  conta:          { label: "Minha conta",                group: "Geral",      roles: TODOS,                                        render: conta.render },
};

let profile = null;

function availableViews() {
  return Object.entries(VIEWS).filter(([, v]) => v.roles.includes(profile.role));
}

function iniciais(nome) {
  const parts = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Exposto para outros módulos (ex.: Minha conta ao trocar o nome)
export function renderUserChip() {
  document.getElementById("user-info").innerHTML = `
    <div class="user-chip">
      <div class="avatar">${iniciais(profile.nome)}</div>
      <div class="user-meta">
        <strong>${profile.nome}</strong>
        <span>${ROLE_LABELS[profile.role] || profile.role}</span>
      </div>
    </div>`;
}

function renderNav(activeId) {
  const nav = document.getElementById("nav-menu");
  const views = availableViews();
  if (profile.role === "admin") {
    let html = "";
    let grupoAtual = null;
    for (const [id, v] of views) {
      if (v.group && v.group !== grupoAtual) {
        grupoAtual = v.group;
        html += `<div class="nav-section">${esc(grupoAtual)}</div>`;
      }
      html += `<a href="/${id}" class="nav-item ${id === activeId ? "active" : ""}" title="${v.label}">${ICONS[id] || ""}<span>${v.label}</span><span class="nav-badge" id="badge-${id}"></span></a>`;
    }
    nav.innerHTML = html;
  } else {
    nav.innerHTML = views
      .map(([id, v]) =>
        `<a href="/${id}" class="nav-item ${id === activeId ? "active" : ""}" title="${v.label}">${ICONS[id] || ""}<span>${v.label}</span><span class="nav-badge" id="badge-${id}"></span></a>`
      )
      .join("");
  }
  atualizarBadges();
}

async function contar(tabela, filtro = {}) {
  const col = Object.keys(filtro)[0];
  let q = supabase.from(tabela).select("id", { count: "exact", head: true });
  if (col) q = q.eq(col, filtro[col]);
  const { count, error } = await q;
  return error ? 0 : (count || 0);
}

async function atualizarBadges() {
  const map = {};
  if (profile.role === "lider" || profile.role === "admin") {
    map["req_historico"] = contar("pedidos", { criado_por: profile.id });
    map["req_produtos"] = supabase.from("solicitacoes_produto").select("id", { count: "exact", head: true }).eq("solicitante_id", profile.id).eq("status", "pendente").then(({ count }) => count || 0);
  }
  if (["estoque", "compras", "estoque_compras", "admin"].includes(profile.role)) {
    map["est_produtos"] = contar("produtos");
    map["est_recebimento"] = contar("pedidos", { status: "pago" });
    map["est_ajustes"] = contar("ajustes_estoque", { status: "pendente" });
    map["comp_cotar"] = supabase.from("pedidos").select("id", { count: "exact", head: true }).in("status", ["solicitado", "em_cotacao"]).then(({ count }) => count || 0);
    map["comp_aprovados"] = contar("pedidos", { status: "aprovado" });
    map["comp_conferir"] = contar("pedidos", { status: "recebido" });
    map["comp_solicitacoes"] = contar("solicitacoes_produto", { status: "pendente" });
  }
  if (["diretoria", "admin"].includes(profile.role)) {
    map["dir_cotacoes"] = contar("pedidos", { status: "aguardando_diretoria" });
    map["dir_ajustes"] = contar("ajustes_estoque", { status: "pendente" });
  }
  if (["financeiro", "admin"].includes(profile.role)) {
    map["fin_pagar"] = contar("pedidos", { status: "aguardando_pagamento" });
    map["fin_realizados"] = contar("pedidos", { status: "pago" });
  }

  for (const [id, prom] of Object.entries(map)) {
    const span = document.getElementById(`badge-${id}`);
    if (!span) continue;
    const n = await prom;
    if (n > 0) span.textContent = `(${n})`;
  }
}

async function navigate(id) {
  const views = availableViews();
  // Se o id não existe ou não é permitido, usa a primeira tela disponível
  if (!VIEWS[id] || !VIEWS[id].roles.includes(profile.role)) {
    id = views.length ? views[0][0] : null;
  }
  if (!id) {
    document.getElementById("view").innerHTML = "<p>Nenhuma tela disponível para seu perfil.</p>";
    return;
  }
  renderNav(id);
  const view = document.getElementById("view");
  view.innerHTML = "<p class='muted'>Carregando...</p>";
  try {
    await VIEWS[id].render(view, profile);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<p class="error">Erro ao carregar: ${err.message}</p>`;
  }
}

async function init() {
  profile = await requireAuth();
  if (!profile) return; // já redirecionou

  renderUserChip();
  bindThemeButton(document.getElementById("theme-btn"));
  document.getElementById("logout-btn").addEventListener("click", () => {
    console.log("Sair clicado");
    logout();
  });

  window.addEventListener("popstate", () => navigate(location.pathname.slice(1)));
  navigate(location.pathname.slice(1));
}

init();
