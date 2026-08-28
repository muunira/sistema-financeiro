-- =====================================================================
-- MIGRAÇÃO 15 — Solicitação de cadastro de novos produtos
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- A partir daqui, somente o setor de Compras cadastra novos produtos.
-- Líderes e Estoque podem SOLICITAR o cadastro. A tabela
-- solicitacoes_produto registra esses pedidos de cadastro.
-- =====================================================================

-- Status das solicitações
do $$
begin
  create type solicitacao_produto_status as enum ('pendente', 'cadastrado');
exception when duplicate_object then null;
end $$;

-- Tabela de solicitações de cadastro de produto
create table if not exists public.solicitacoes_produto (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  unidade        text not null default 'UN',
  sku            text,
  justificativa  text,
  status         solicitacao_produto_status not null default 'pendente',
  solicitante_id uuid not null references public.profiles(id),
  setor          text,
  created_at     timestamptz not null default now()
);

-- RLS
drop policy if exists solicitacoes_produto_select on public.solicitacoes_produto;
create policy solicitacoes_produto_select on public.solicitacoes_produto
  for select using ( public.my_role()::text in ('compras', 'estoque', 'lider', 'admin') );

drop policy if exists solicitacoes_produto_insert on public.solicitacoes_produto;
create policy solicitacoes_produto_insert on public.solicitacoes_produto
  for insert with check ( public.my_role()::text in ('lider', 'estoque', 'admin') and solicitante_id = auth.uid() );

drop policy if exists solicitacoes_produto_update on public.solicitacoes_produto;
create policy solicitacoes_produto_update on public.solicitacoes_produto
  for all using ( public.my_role()::text in ('compras', 'admin') )
  with check ( public.my_role()::text in ('compras', 'admin') );

alter table public.solicitacoes_produto enable row level security;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
