-- =====================================================================
-- MIGRAÇÃO 17 — Corrige criação de usuário (erro 500)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- 1) Adiciona 'estoque_compras' ao enum user_role (usado no trigger).
-- 2) Atualiza o trigger handle_new_user para incluir setor e ativo.
-- =====================================================================

-- 1) Estende o enum de papéis
do $$
begin
  alter type public.user_role add value 'estoque_compras';
exception
  when duplicate_object then null;
end $$;

-- 2) Recria a função de novo usuário incluindo setor e ativo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role, setor, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estoque'),
    new.raw_user_meta_data->>'setor',
    true
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
