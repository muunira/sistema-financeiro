-- =====================================================================
-- MIGRAÇÃO 13 — Ajustes manuais de estoque com aprovação da Diretoria
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Cria a tabela ajustes_estoque para solicitar entradas/saídas manuais no
-- estoque. O setor de Estoque abre a solicitação; a Diretoria aprova ou
-- rejeita. Ao aprovar, a quantidade do produto é alterada.
-- =====================================================================

do $$
begin
  create type ajuste_tipo as enum ('adicionar', 'remover');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type ajuste_status as enum ('pendente', 'aprovado', 'rejeitado');
exception when duplicate_object then null;
end $$;

-- Tabela de ajustes manuais de estoque
create table if not exists public.ajustes_estoque (
  id             uuid primary key default gen_random_uuid(),
  produto_id     uuid not null references public.produtos(id),
  tipo           ajuste_tipo not null,
  quantidade     numeric not null default 0,
  justificativa  text,
  status         ajuste_status not null default 'pendente',
  solicitante_id uuid not null references public.profiles(id),
  aprovador_id   uuid references public.profiles(id),
  data_decisao   timestamptz,
  created_at     timestamptz not null default now()
);

-- Permite estoque visualizar e criar ajustes
drop policy if exists ajustes_select on public.ajustes_estoque;
create policy ajustes_select on public.ajustes_estoque
  for select using ( public.my_role()::text in ('estoque', 'diretoria', 'admin') );

drop policy if exists ajustes_insert on public.ajustes_estoque;
create policy ajustes_insert on public.ajustes_estoque
  for insert with check ( public.my_role()::text in ('estoque', 'admin') and solicitante_id = auth.uid() );

-- Permite diretoria e admin aprovar/rejeitar (atualiza o status e o aprovador)
drop policy if exists ajustes_update on public.ajustes_estoque;
create policy ajustes_update on public.ajustes_estoque
  for update to authenticated
  using ( public.my_role()::text in ('diretoria', 'admin') )
  with check ( public.my_role()::text in ('diretoria', 'admin') );

alter table public.ajustes_estoque enable row level security;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
