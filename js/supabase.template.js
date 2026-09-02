// =====================================================================
// Configuração do cliente Supabase
// =====================================================================
// Este é um template. Na build, o script build.js gera js/supabase.js
// substituindo $SUPABASE_URL e $SUPABASE_ANON_KEY pelas variáveis de ambiente.
// NUNCA coloque a "Secret key" (sb_secret_...) no frontend.
// =====================================================================

export const SUPABASE_URL = "$SUPABASE_URL";
export const SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";

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
  aguardando_recebimento: "Aprovado, aguardando Estoque (pagar depois)",
  rejeitado: "Rejeitado",
  pago: "Pago, aguardando entrega",
  recebido: "Recebido, aguardando Financeiro",
  conferido: "Conferido",
  concluido: "Concluído",
};
