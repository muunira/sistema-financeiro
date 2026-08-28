// =====================================================================
// Utilitários de autenticação e sessão
// =====================================================================
import { supabase, SUPABASE_URL } from "./supabase.js";

// Verifica se o Supabase foi configurado
export function isConfigured() {
  return SUPABASE_URL && !SUPABASE_URL.startsWith("COLE_AQUI");
}

// Retorna a sessão atual (ou null)
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Faz login com email e senha
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Desloga e volta para a tela de login
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Erro signOut:", error);
  } catch (e) {
    console.error("Exceção logout:", e);
  } finally {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("index.html?logout=" + Date.now());
  }
}

// Carrega o perfil (nome, role, ativo) do usuário logado
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) return null;
  return data;
}

// Guarda de rota: garante que há sessão + perfil ativo.
// Redireciona para o login se não houver. Retorna o perfil.
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  const profile = await getProfile();
  if (!profile || !profile.ativo) {
    await supabase.auth.signOut();
    window.location.href = "index.html?erro=inativo";
    return null;
  }
  return profile;
}
