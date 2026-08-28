-- =====================================================================
-- MIGRAÇÃO 04 — Cotação unitária por item (opção B)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

-- 1) Valor unitário de cada item no pedido
alter table public.pedido_itens add column if not exists valor_unitario numeric;

-- 2) Permite que Compras atualize o valor unitário dos itens
--    (Estoque e admin continuam podendo tudo via itens_write.)
drop policy if exists itens_update on public.pedido_itens;
create policy itens_update on public.pedido_itens
  for update to authenticated
  using ( public.my_role() in ('compras', 'estoque', 'admin') )
  with check ( public.my_role() in ('compras', 'estoque', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
