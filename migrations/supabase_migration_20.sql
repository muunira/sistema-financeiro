-- =====================================================================
-- MIGRAÇÃO 20 — Fluxo "receber primeiro, pagar depois"
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Alguns pedidos são recebidos antes de serem pagos. Este fluxo faz o
-- pedido ser recebido e conferido no estoque ANTES de ir ao Financeiro.
--
-- Fluxo padrão (pagar antes):
--   aprovado -> aguardando_pagamento -> pago -> recebido -> conferido
-- Fluxo "pagar depois" (marcado na cotação):
--   aprovado -> aguardando_recebimento -> recebido -> aguardando_pagamento -> concluido
--
-- 1) Novos status no enum pedido_status.
-- 2) Coluna pagar_apos no pedido (escolhida pelo Compras na cotação).
-- =====================================================================

do $$
begin
  alter type public.pedido_status add value 'aguardando_recebimento';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.pedido_status add value 'concluido';
exception when duplicate_object then null;
end $$;

alter table public.pedidos
  add column if not exists pagar_apos boolean not null default false;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
