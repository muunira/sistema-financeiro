-- =====================================================================
-- MIGRAÇÃO 03 — Cadastro de fornecedores (para aba Compras)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores (schema principal e migração 02).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela de fornecedores
-- ---------------------------------------------------------------------
create table if not exists public.fornecedores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cnpj       text unique,
  contato    text,
  telefone   text,
  email      text,
  endereco   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) RLS da tabela fornecedores
-- ---------------------------------------------------------------------
alter table public.fornecedores enable row level security;

drop policy if exists fornecedores_select on public.fornecedores;
create policy fornecedores_select on public.fornecedores
  for select using ( public.my_role() is not null );

drop policy if exists fornecedores_write on public.fornecedores;
create policy fornecedores_write on public.fornecedores
  for all using ( public.my_role() in ('compras', 'admin') )
  with check ( public.my_role() in ('compras', 'admin') );

-- Recarrega o cache do PostgREST para que a nova tabela seja reconhecida
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
