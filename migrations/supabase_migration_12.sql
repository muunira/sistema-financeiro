-- =====================================================================
-- MIGRAÇÃO 12 — Diretoria e Financeiro podem gerenciar usuários
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Além do admin, os papéis 'diretoria' e 'financeiro' passam a visualizar
-- todos os perfis e gerenciá-los (criar, editar role, ativar/desativar).
-- =====================================================================

-- 1) Select: diretoria e financeiro também enxergam todos os usuários
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using ( id = auth.uid() or public.my_role()::text in ('admin', 'diretoria', 'financeiro') );

-- 2) Write: diretoria e financeiro também gerenciam perfis
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using ( public.my_role()::text in ('admin', 'diretoria', 'financeiro') )
  with check ( public.my_role()::text in ('admin', 'diretoria', 'financeiro') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
