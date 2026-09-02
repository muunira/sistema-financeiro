// =====================================================================
// Notificações em tempo real (Supabase Realtime + polling fallback)
// =====================================================================
import { supabase } from "./supabase.js";
import { toast } from "./ui.js";

let badgeCallback = null;
let changeCallback = null;
let intervalId = null;
let recent = new Map();
const COOLDOWN_MS = 3000;

function cooldown(table, id) {
  if (!id) return false;
  const key = `${table}:${id}`;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < COOLDOWN_MS) return true;
  recent.set(key, now);
  return false;
}

function notify(role, table, payload) {
  const row = payload.new || payload.old;
  const id = row?.id;
  if (cooldown(table, id)) return;

  let msg = null;

  if (table === "pedidos") {
    const status = row?.status;
    const numero = row?.numero || "#";
    if (payload.eventType === "INSERT" && status === "solicitado" && ["compras", "estoque_compras", "admin"].includes(role)) {
      msg = `Novo pedido #${numero} aguarda cotação`;
    } else if (status === "aguardando_diretoria" && ["diretoria", "admin"].includes(role)) {
      msg = `Pedido #${numero} aguarda aprovação`;
    } else if (["aguardando_pagamento", "recebido"].includes(status) && ["financeiro", "admin"].includes(role)) {
      msg = `Pedido #${numero} aguarda pagamento`;
    } else if (["pago", "aguardando_recebimento"].includes(status) && ["estoque", "estoque_compras", "admin"].includes(role)) {
      msg = `Pedido #${numero} aguarda recebimento`;
    } else if (status === "conferido" && ["lider", "admin"].includes(role)) {
      msg = `Pedido #${numero} foi conferido`;
    }
  } else if (table === "solicitacoes_produto" && ["compras", "estoque", "estoque_compras", "admin"].includes(role)) {
    msg = "Nova solicitação de cadastro de produto";
  } else if (table === "ajustes_estoque" && ["diretoria", "admin"].includes(role)) {
    msg = "Novo ajuste de estoque pendente";
  }

  if (msg) toast(msg);
}

export function startRealtime(profile, callbacks = {}) {
  badgeCallback = callbacks.onBadgeUpdate || null;
  changeCallback = callbacks.onChange || null;
  const role = profile?.role;

  const channel = supabase
    .channel("notificacoes-tempo-real")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, (payload) => {
      notify(role, "pedidos", payload);
      if (changeCallback) changeCallback("pedidos", payload);
      if (badgeCallback) badgeCallback();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_produto" }, (payload) => {
      notify(role, "solicitacoes_produto", payload);
      if (changeCallback) changeCallback("solicitacoes_produto", payload);
      if (badgeCallback) badgeCallback();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "ajustes_estoque" }, (payload) => {
      notify(role, "ajustes_estoque", payload);
      if (changeCallback) changeCallback("ajustes_estoque", payload);
      if (badgeCallback) badgeCallback();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, (payload) => {
      if (changeCallback) changeCallback("produtos", payload);
      if (badgeCallback) badgeCallback();
    })
    .subscribe((status) => {
      console.log("[realtime] status:", status);
    });

  // Fallback via polling: mantém os contadores atualizados mesmo que o
  // Realtime ainda não esteja habilitado no banco.
  intervalId = setInterval(() => {
    if (badgeCallback) badgeCallback();
  }, 15000);

  return () => {
    channel.unsubscribe();
    clearInterval(intervalId);
  };
}
