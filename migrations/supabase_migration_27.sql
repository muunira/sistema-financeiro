-- =====================================================================
-- MIGRAÇÃO 27 — Suporte a múltiplos boletos por pedido
-- =====================================================================
-- Converte a coluna boleto_path (text) em boletos (text[]) e ajusta
-- as policies de storage se necessário.
-- =====================================================================

-- 1) Adiciona a nova coluna array se ainda não existir
alter table public.pedidos add column if not exists boletos text[];

-- 2) Migra valores antigos de boleto_path (text) para boletos (text[])
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'boleto_path'
  ) then
    update public.pedidos
    set boletos = array[boleto_path]
    where boleto_path is not null and boletos is null;

    alter table public.pedidos drop column if exists boleto_path;
  end if;
end $$;

-- 3) Garante que a coluna boletos tenha um default array vazio
alter table public.pedidos alter column boletos set default '{}';

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
