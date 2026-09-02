// =====================================================================
// Cache leve em memória para dados consultados em várias telas
// =====================================================================
import { supabase } from "./supabase.js";

const TTL_MS = 30_000;

const cache = {
  produtos: { data: null, promised: null, at: 0 },
  fornecedores: { data: null, promised: null, at: 0 },
};

async function fetchProdutos() {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw error;
  return (data || []).sort((a, b) => String(a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
}

async function fetchFornecedores() {
  try {
    const { data, error } = await supabase.from("fornecedores").select("*").eq("ativo", true).order("nome");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao carregar fornecedores:", err);
    return [];
  }
}

async function get(key, fetcher, force = false) {
  const entry = cache[key];
  const stale = Date.now() - entry.at > TTL_MS;

  if (!force && entry.data && !stale) {
    return entry.data;
  }

  // Reutiliza promise em andamento para evitar requests duplicados
  if (entry.promised && !stale) {
    return entry.promised;
  }

  entry.promised = fetcher().then((data) => {
    entry.data = data;
    entry.at = Date.now();
    entry.promised = null;
    return data;
  });

  return entry.promised;
}

export async function getProdutos(force = false) {
  return get("produtos", fetchProdutos, force);
}

export async function getFornecedores(force = false) {
  return get("fornecedores", fetchFornecedores, force);
}

export function clearCache() {
  cache.produtos = { data: null, promised: null, at: 0 };
  cache.fornecedores = { data: null, promised: null, at: 0 };
}

export function invalidateProdutos() {
  cache.produtos.at = 0;
}

export function invalidateFornecedores() {
  cache.fornecedores.at = 0;
}
