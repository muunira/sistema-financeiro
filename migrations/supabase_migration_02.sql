-- =====================================================================
-- MIGRAÇÃO 02 — Cotações (múltiplos fornecedores) + Comprovante de pagamento
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer que o schema principal (supabase_schema.sql) já tenha sido executado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela de cotações: vários fornecedores por pedido
-- ---------------------------------------------------------------------
create table if not exists public.cotacoes (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos(id) on delete cascade,
  fornecedor text not null,
  valor      numeric not null,
  obs        text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Novas colunas em pedidos
-- ---------------------------------------------------------------------
alter table public.pedidos
  add column if not exists cotacao_escolhida uuid references public.cotacoes(id) on delete set null;
alter table public.pedidos
  add column if not exists comprovante_path text;

-- ---------------------------------------------------------------------
-- 3) RLS da tabela cotacoes
-- ---------------------------------------------------------------------
alter table public.cotacoes enable row level security;

drop policy if exists cotacoes_select on public.cotacoes;
create policy cotacoes_select on public.cotacoes
  for select using ( public.my_role() is not null );

drop policy if exists cotacoes_write on public.cotacoes;
create policy cotacoes_write on public.cotacoes
  for all using ( public.my_role() in ('compras', 'admin') )
  with check ( public.my_role() in ('compras', 'admin') );

-- ---------------------------------------------------------------------
-- 4) Supabase Storage: bucket privado para os comprovantes de pagamento
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- Leitura: qualquer usuário com perfil ativo (estoque, compras, diretoria, financeiro, admin)
drop policy if exists comprovantes_read on storage.objects;
create policy comprovantes_read on storage.objects
  for select to authenticated
  using ( bucket_id = 'comprovantes' and public.my_role() is not null );

-- Upload: apenas financeiro e admin
drop policy if exists comprovantes_insert on storage.objects;
create policy comprovantes_insert on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'comprovantes' and public.my_role() in ('financeiro', 'admin') );

-- Atualizar/substituir: apenas financeiro e admin
drop policy if exists comprovantes_update on storage.objects;
create policy comprovantes_update on storage.objects
  for update to authenticated
  using ( bucket_id = 'comprovantes' and public.my_role() in ('financeiro', 'admin') );

-- Recarrega o cache do PostgREST para que a relação pedidos x cotações seja reconhecida
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
