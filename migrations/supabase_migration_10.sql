-- =====================================================================
-- MIGRAÇÃO 10 — Compras pode retirar itens já em estoque do pedido
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Quando um item solicitado já existe em estoque, o setor de Compras pode
-- retirá-lo do pedido. Para isso precisa poder alterar/excluir itens do pedido.
-- =====================================================================

drop policy if exists itens_write on public.pedido_itens;
create policy itens_write on public.pedido_itens
  for all using ( public.my_role()::text in ('lider', 'compras', 'admin') )
  with check ( public.my_role()::text in ('lider', 'compras', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
