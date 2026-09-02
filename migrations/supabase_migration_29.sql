-- =====================================================================
-- MIGRAÇÃO 29 — Corrige RPC limpar_pedidos para o botão "Zerar pedidos"
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- 1) (Re)cria a função RPC que apaga todos os pedidos e reseta a
--    sequência de numeração, mesmo com RLS ativo (security definer).
-- 2) Concede permissão de execução para usuários autenticados.
-- 3) Recarrega o cache do PostgREST para que a função apareça no RPC.
-- =====================================================================

-- 1) Função RPC para zerar pedidos (apenas admin)
create or replace function public.limpar_pedidos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apenas admin pode executar
  if public.my_role()::text <> 'admin' then
    raise exception 'Apenas administradores podem zerar pedidos.';
  end if;

  -- Apaga todos os pedidos (FKs on delete cascade limpam itens, cotações, histórico)
  delete from public.pedidos where true;

  -- Reseta o número do próximo pedido para 1
  alter sequence if exists public.pedido_numero_seq restart with 1;
end;
$$;

-- 2) Permite que usuários autenticados chamem a função via RPC
grant execute on function public.limpar_pedidos() to authenticated;

-- 3) Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
