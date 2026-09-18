-- =====================================================================
-- MIGRAÇÃO 31 — Usuário altera o próprio nome (Minha conta)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- A política de escrita em profiles só permite admin, então o UPDATE
-- direto feito pelo "Minha conta" era bloqueado silenciosamente pelo
-- RLS (0 linhas afetadas, sem erro). Em vez de liberar UPDATE na linha
-- inteira — o que permitiria o usuário mudar o próprio role/ativo/setor —
-- criamos uma função security definer que altera APENAS a coluna nome
-- do usuário logado.
-- =====================================================================

create or replace function public.update_own_name(nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  novo text := trim(coalesce(nome, ''));
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if novo = '' then
    raise exception 'O nome não pode ficar vazio';
  end if;
  update public.profiles set nome = novo where id = auth.uid();
end;
$$;

revoke all on function public.update_own_name(text) from public;
grant execute on function public.update_own_name(text) to authenticated;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
