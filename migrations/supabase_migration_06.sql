-- =====================================================================
-- MIGRAÇÃO 06 — Pagamento: detalhes e boleto após aprovação da Diretoria
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
-- =====================================================================

-- 1) Novo status: aguardando_pagamento
--    (Compras preenche a forma de pagamento e envia para o Financeiro)
do $$
begin
  alter type public.pedido_status add value 'aguardando_pagamento';
exception
  when duplicate_object then null;
end $$;

-- 2) Campos de pagamento em pedidos
alter table public.pedidos
  add column if not exists boleto_path text,
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text,
  add column if not exists razao_social text,
  add column if not exists cpf_cnpj text,
  add column if not exists pix text;

-- 3) Bucket para boletos (Compras anexa, Financeiro lê)
insert into storage.buckets (id, name, public)
values ('boletos', 'boletos', false)
on conflict (id) do nothing;

-- Leitura: qualquer usuário ativo
drop policy if exists boletos_read on storage.objects;
create policy boletos_read on storage.objects
  for select to authenticated
  using ( bucket_id = 'boletos' and public.my_role() is not null );

-- Upload: compras e admin
drop policy if exists boletos_insert on storage.objects;
create policy boletos_insert on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'boletos' and public.my_role() in ('compras', 'admin') );

-- Atualizar/substituir: compras e admin
drop policy if exists boletos_update on storage.objects;
create policy boletos_update on storage.objects
  for update to authenticated
  using ( bucket_id = 'boletos' and public.my_role() in ('compras', 'admin') );

-- 4) Permite que Compras atualize os pedidos aprovados
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ( public.my_role() in ('compras', 'diretoria', 'financeiro', 'admin') )
  with check ( public.my_role() in ('compras', 'diretoria', 'financeiro', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
