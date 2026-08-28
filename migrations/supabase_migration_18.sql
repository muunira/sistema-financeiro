-- =====================================================================
-- MIGRAÇÃO 18 — Observações por fornecedor (cotação)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Adiciona a coluna observacoes na tabela cotacoes, permitindo que o
-- Compras anexe observações diferentes para cada fornecedor cotado.
-- =====================================================================

alter table public.cotacoes
  add column if not exists observacoes text;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
