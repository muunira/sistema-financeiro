-- =====================================================================
-- MIGRAÇÃO 22 — Tipo do pedido e prazo por cotação
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

alter table public.pedidos
  add column if not exists tipo text;

-- Garante que não haja valor padrão e limpa entradas 'Compra' fixas anteriores
alter table public.pedidos alter column tipo drop default;
update public.pedidos set tipo = null where tipo = 'Compra';

alter table public.pedidos
  add column if not exists centro_custo text;

alter table public.pedidos
  add column if not exists justificativa_compra text;

alter table public.cotacoes
  add column if not exists dias_pagamento integer;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
