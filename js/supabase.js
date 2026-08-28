// =====================================================================
// Configuração do cliente Supabase
// =====================================================================
// 1. Crie um projeto em https://supabase.com
// 2. Vá em Project Settings > API Keys e copie a URL e a "Publishable key"
//    (sb_publishable_...). Ela é PÚBLICA e pode ficar no frontend.
//    NUNCA coloque aqui a "Secret key" (sb_secret_...).
// =====================================================================

export const SUPABASE_URL = "https://tekrkakctnevkftwpxgn.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_uYI8501EE3E01p4HxK3nsA_h-Cbx3Ra";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Cliente principal (mantém a sessão do usuário logado)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente secundário isolado: usado pelo admin para criar novos usuários
// sem afetar/derrubar a própria sessão (não persiste sessão).
export function createIsolatedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Rótulos amigáveis para os papéis
export const ROLE_LABELS = {
  admin: "Administrador",
  lider: "Líder de setor",
  estoque: "Estoque",
  compras: "Compras",
  estoque_compras: "Estoque / Compras",
  diretoria: "Diretoria",
  financeiro: "Financeiro",
};

// Setores da empresa (usado no cadastro de usuários)
export const SETORES = [
  "Assistência Técnica",
  "Cobrança",
  "Comercial",
  "Compras",
  "Diretoria",
  "Departamento Pessoal",
  "Estofados",
  "Faturamento",
  "Financeiro",
  "Fiscal",
  "Logística",
  "Marketing",
  "Recursos Humanos",
  "Representantes",
  "Televendas",
  "TI",
];

// Rótulos e cores para os status do pedido
export const STATUS_LABELS = {
  solicitado: "Pendente, aguardando Compras",
  em_cotacao: "Pendente, aguardando Compras",
  aguardando_diretoria: "Pendente, aguardando Diretoria",
  aprovado: "Aprovado, aguardando Compras",
  aguardando_pagamento: "Pendente, aguardando Financeiro",
  rejeitado: "Rejeitado",
  pago: "Pago, aguardando Estoque",
  recebido: "Recebido, aguardando Estoque",
  conferido: "Conferido",
};
