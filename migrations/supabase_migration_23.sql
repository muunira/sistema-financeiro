-- =====================================================================
-- MIGRAÇÃO 23 — Rastrear quantidade retirada do estoque por item
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

alter table public.pedido_itens
  add column if not exists quantidade_retirada numeric default 0;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
