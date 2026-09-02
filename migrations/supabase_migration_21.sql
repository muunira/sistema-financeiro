-- =====================================================================
-- MIGRAÇÃO 21 — Cotação simplificada: valor final + arquivo anexado
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- A cotação deixa de ter preço por item. O Compras passa a:
--  - anexar o arquivo da cotação enviado pela distribuidora;
--  - digitar apenas: distribuidora, valor final;
--  - e por pedido: nº da solicitação e dias para pagar.
--
-- 1) Campos por pedido: numero_solicitacao e dias_pagamento.
-- 2) Campo por cotação: arquivo_path (arquivo no bucket 'cotacoes').
-- 3) Bucket privado 'cotacoes' + políticas.
-- =====================================================================

-- 1) Campos por pedido
alter table public.pedidos
  add column if not exists numero_solicitacao text,
  add column if not exists dias_pagamento integer;

-- 2) Arquivo da cotação
alter table public.cotacoes
  add column if not exists arquivo_path text;

-- 3) Bucket para os arquivos de cotação (Compras anexa; todos ativos leem)
insert into storage.buckets (id, name, public)
values ('cotacoes', 'cotacoes', false)
on conflict (id) do nothing;

drop policy if exists cotacoes_read on storage.objects;
create policy cotacoes_read on storage.objects
  for select to authenticated
  using ( bucket_id = 'cotacoes' and public.my_role() is not null );

drop policy if exists cotacoes_insert on storage.objects;
create policy cotacoes_insert on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'cotacoes' and public.my_role() in ('estoque', 'compras', 'estoque_compras', 'admin') );

drop policy if exists cotacoes_update on storage.objects;
create policy cotacoes_update on storage.objects
  for update to authenticated
  using ( bucket_id = 'cotacoes' and public.my_role() in ('estoque', 'compras', 'estoque_compras', 'admin') );

drop policy if exists cotacoes_delete on storage.objects;
create policy cotacoes_delete on storage.objects
  for delete to authenticated
  using ( bucket_id = 'cotacoes' and public.my_role() in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
