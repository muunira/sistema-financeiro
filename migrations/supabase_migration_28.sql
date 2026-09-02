-- =====================================================================
-- MIGRAÇÃO 28 — Habilita Supabase Realtime para notificações em tempo real
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- O Realtime envia mudanças das tabelas para os navegadores conectados,
-- permitindo que os contadores (badges) e notificações sejam atualizados
-- instantaneamente sem precisar recarregar a página.
-- =====================================================================

-- 1) Garante a publicação usada pelo Realtime.
-- O Supabase já cria 'supabase_realtime' em projetos novos; recriamos
-- de forma segura caso ainda não exista.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2) Adiciona as tabelas relevantes à publicação, de forma idempotente.
do $$
declare
  t text;
  tables text[] := array['pedidos', 'solicitacoes_produto', 'ajustes_estoque', 'produtos'];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 3) Replica identity full permite que o Realtime envie o registro
-- antigo junto com o novo nos eventos de UPDATE/DELETE.
alter table public.pedidos              replica identity full;
alter table public.solicitacoes_produto replica identity full;
alter table public.ajustes_estoque      replica identity full;
alter table public.produtos             replica identity full;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
