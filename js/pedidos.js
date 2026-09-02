// =====================================================================
// Helpers compartilhados de acesso aos pedidos
// =====================================================================
import { supabase } from "./supabase.js";

// Carrega pedidos (opcionalmente filtrando por lista de status), com itens e cotações.
export async function fetchPedidos(statuses = null) {
  let q = supabase
    .from("pedidos")
    .select("*, pedido_itens(*), criador:criado_por(nome, setor), comprador:comprador_id(nome), aprovador:aprovado_por(nome)")
    .order("numero", { ascending: false });
  if (statuses) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw error;
  const pedidos = data || [];

  if (pedidos.length) {
    const pedidoIds = pedidos.map((p) => p.id);
    const { data: cotacoes, error: c1 } = await supabase
      .from("cotacoes")
      .select("*")
      .in("pedido_id", pedidoIds)
      .order("created_at");
    if (c1) throw c1;

    const cotPorPed = {};
    (cotacoes || []).forEach((c) => {
      if (!cotPorPed[c.pedido_id]) cotPorPed[c.pedido_id] = [];
      cotPorPed[c.pedido_id].push(c);
    });

    pedidos.forEach((p) => (p.cotacoes = cotPorPed[p.id] || []));
  }

  return pedidos;
}

// Atualiza um pedido e registra no histórico a transição de status
export async function updatePedido(pedido, patch, novoStatus, usuarioId, observacao = null) {
  const payload = { ...patch };
  if (novoStatus) payload.status = novoStatus;
  const { error } = await supabase.from("pedidos").update(payload).eq("id", pedido.id);
  if (error) throw error;

  if (novoStatus && novoStatus !== pedido.status) {
    await supabase.from("historico").insert({
      pedido_id: pedido.id,
      de_status: pedido.status,
      para_status: novoStatus,
      usuario_id: usuarioId,
      observacao,
    });
  }
}

// Renderiza os itens de um pedido como texto
export function itensTexto(pedido) {
  return (pedido.pedido_itens || [])
    .map((i) => `${i.descricao} (${i.quantidade})`)
    .join(", ");
}

// Gera uma URL temporária (assinada) para visualizar/baixar um comprovante
export async function comprovanteUrl(path) {
  const { data, error } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}

// Abre o comprovante em uma nova aba
export async function abrirComprovante(path) {
  try {
    const url = await comprovanteUrl(path);
    window.open(url, "_blank");
  } catch (err) {
    alert("Não foi possível abrir o comprovante: " + err.message);
  }
}
