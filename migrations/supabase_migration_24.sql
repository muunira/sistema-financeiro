-- =====================================================================
-- MIGRAÇÃO 24 — Permite Compras/Estoque ver nome e setor dos perfis
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.my_role()::text in ('admin', 'diretoria', 'financeiro', 'estoque', 'compras', 'estoque_compras')
  );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
