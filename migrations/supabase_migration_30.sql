-- =====================================================================
-- MIGRAÇÃO 30 — Padrão de login por setor: setor@empresa.local
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- O que faz:
--  1) Cria a função public.login_slug() que gera o slug do setor
--     (ex.: 'Assistência Técnica' -> 'assistencia.tecnica').
--  2) Renomeia os logins (auth.users.email e public.profiles.email) dos
--     usuários existentes para <slug-do-setor>@empresa.local.
--     Se dois usuários estiverem no mesmo setor, o segundo recebe um
--     sufixo numérico (compras2@empresa.local, compras3@...).
--     Usuários sem setor usam o slug do nome.
--     O usuário com role 'admin' NÃO é alterado.
--  3) Marca os e-mails como confirmados (o domínio é fictício).
--
-- IMPORTANTE: confira o resultado do SELECT no final e avise os usuários
-- dos novos logins. As senhas NÃO são alteradas.
-- =====================================================================

-- 1) Slug do login
create or replace function public.login_slug(txt text)
returns text
language sql
immutable
as $$
  select trim(both '.' from regexp_replace(
    lower(translate(coalesce(txt, ''),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '.', 'g'));
$$;

-- 2) Novos logins
drop table if exists _novos_logins;
create temporary table _novos_logins as
with base as (
  select
    p.id,
    p.nome,
    p.setor,
    public.login_slug(coalesce(nullif(p.setor, ''), p.nome)) as slug,
    p.created_at
  from public.profiles p
  where p.role <> 'admin'
),
numerado as (
  select
    b.*,
    row_number() over (partition by b.slug order by b.created_at, b.id) as n
  from base b
  where b.slug <> ''
)
select
  id,
  nome,
  setor,
  (case when n = 1 then slug else slug || n::text end) || '@empresa.local' as novo_email
from numerado;

-- Aborta se algum login gerado colidir com outro usuário que não será alterado
do $$
declare
  conflitos integer;
begin
  select count(*) into conflitos
  from _novos_logins n
  join auth.users u on lower(u.email) = n.novo_email and u.id <> n.id
  where u.id not in (select id from _novos_logins);
  if conflitos > 0 then
    raise exception 'Existem % logins gerados que colidem com usuários fora do padrão. Ajuste manualmente antes de rodar.', conflitos;
  end if;
end $$;

update auth.users u
set email = n.novo_email,
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    updated_at = now()
from _novos_logins n
where u.id = n.id
  and lower(coalesce(u.email, '')) <> n.novo_email;

update public.profiles p
set email = n.novo_email
from _novos_logins n
where p.id = n.id
  and coalesce(p.email, '') <> n.novo_email;

drop table if exists _novos_logins;

-- 3) Conferência: lista os logins finais
select p.nome, p.setor, p.role, p.email as login, p.ativo
from public.profiles p
order by p.role, p.setor, p.nome;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
