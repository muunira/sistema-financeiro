-- =====================================================================
-- MIGRAÇÃO 14 — Líderes conferem pedido e dão baixa no estoque
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Adiciona o status 'conferido' e as colunas de conferência no pedido.
-- Quando o líder confere, as quantidades dos produtos vinculados são
-- removidas automaticamente do estoque.
-- =====================================================================

-- 1) Novo status: conferido
do $$
begin
  alter type public.pedido_status add value 'conferido';
exception
  when duplicate_object then null;
end $$;

-- 2) Campos de conferência em pedidos
alter table public.pedidos
  add column if not exists conferido_por uuid references public.profiles(id),
  add column if not exists data_conferencia timestamptz;

-- 3) Atualização de pedidos: líder pode marcar como conferido
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ( public.my_role()::text in ('lider', 'estoque', 'compras', 'diretoria', 'financeiro', 'admin') )
  with check ( public.my_role()::text in ('lider', 'estoque', 'compras', 'diretoria', 'financeiro', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
