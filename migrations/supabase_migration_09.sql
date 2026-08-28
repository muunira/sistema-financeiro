-- =====================================================================
-- MIGRAÇÃO 09 — Setor do usuário
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Adiciona o campo "setor" ao perfil do usuário e faz o gatilho de criação
-- gravar o setor informado pelo admin no momento do cadastro.
-- =====================================================================

-- 1) Coluna setor em profiles
alter table public.profiles
  add column if not exists setor text;

-- 2) Gatilho de criação: passa a gravar também nome, role e setor
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role, setor)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estoque'),
    new.raw_user_meta_data->>'setor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
