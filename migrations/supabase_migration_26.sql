-- =====================================================================
-- MIGRAÇÃO 26 — Botão "Zerar pedidos" no painel Admin
-- =====================================================================
-- 1) Permite que o admin delete arquivos dos buckets pelo Storage API.
-- 2) Cria função RPC limpar_pedidos() que apaga todos os pedidos e reseta
--    a sequência, mesmo com RLS ativo (security definer).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- =====================================================================

-- ----------------------------------------------------------------------
-- 1) Políticas de DELETE nos buckets (apenas admin)
-- ----------------------------------------------------------------------

drop policy if exists boletos_delete on storage.objects;
create policy boletos_delete on storage.objects
  for delete to authenticated
  using ( bucket_id = 'boletos' and public.my_role()::text = 'admin' );

drop policy if exists comprovantes_delete on storage.objects;
create policy comprovantes_delete on storage.objects
  for delete to authenticated
  using ( bucket_id = 'comprovantes' and public.my_role()::text = 'admin' );

drop policy if exists cotacoes_delete on storage.objects;
-- A migration 21 já pode ter criado esta policy; recria com regra admin.
drop policy if exists cotacoes_delete_old on storage.objects;
create policy cotacoes_delete on storage.objects
  for delete to authenticated
  using ( bucket_id = 'cotacoes' and public.my_role()::text = 'admin' );

-- ----------------------------------------------------------------------
-- 2) Função RPC para zerar pedidos (apenas admin)
-- ----------------------------------------------------------------------

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
  delete from public.pedidos;

  -- Reseta o número do próximo pedido para 1
  alter sequence if exists public.pedido_numero_seq restart with 1;
end;
$$;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
