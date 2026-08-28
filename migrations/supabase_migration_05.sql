-- =====================================================================
-- MIGRAÇÃO 05 — Cotação por item: vários fornecedores por pedido
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

-- 1) Tabela com os valores unitários de cada cotação por item
create table if not exists public.cotacao_itens (
  id             uuid primary key default gen_random_uuid(),
  cotacao_id     uuid not null references public.cotacoes(id) on delete cascade,
  pedido_item_id uuid not null references public.pedido_itens(id) on delete cascade,
  valor_unitario numeric not null default 0,
  created_at     timestamptz not null default now()
);

-- 2) RLS
drop policy if exists cotacao_itens_select on public.cotacao_itens;
create policy cotacao_itens_select on public.cotacao_itens
  for select using ( public.my_role() is not null );

drop policy if exists cotacao_itens_write on public.cotacao_itens;
create policy cotacao_itens_write on public.cotacao_itens
  for all using ( public.my_role() in ('compras', 'admin') )
  with check ( public.my_role() in ('compras', 'admin') );

-- 3) A coluna cotacao_escolhida já existe em pedidos (migração 02).
-- Recarrega o cache para reconhecer a nova tabela
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
