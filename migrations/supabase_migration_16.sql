-- =====================================================================
-- MIGRAÇÃO 16 — Papel único estoque_compras
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Cria o papel 'estoque_compras' como uma unificação: quem tiver esse
-- papel exerce as funções de estoque e de compras ao mesmo tempo.
-- =====================================================================

-- produtos
drop policy if exists produtos_write on public.produtos;
create policy produtos_write on public.produtos
  for all using ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- pedidos: insert
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos
  for insert with check (
    public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'lider', 'admin') and criado_por = auth.uid()
  );

-- pedidos: update
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'diretoria', 'financeiro', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'diretoria', 'financeiro', 'admin') );

-- pedido_itens
drop policy if exists itens_write on public.pedido_itens;
create policy itens_write on public.pedido_itens
  for all using ( public.my_role()::text in ('lider', 'estoque', 'compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('lider', 'estoque', 'compras', 'estoque_compras', 'admin') );

-- cotacoes
drop policy if exists cotacoes_write on public.cotacoes;
create policy cotacoes_write on public.cotacoes
  for all using ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- cotacao_itens
drop policy if exists cotacao_itens_write on public.cotacao_itens;
create policy cotacao_itens_write on public.cotacao_itens
  for all using ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- fornecedores
drop policy if exists fornecedores_write on public.fornecedores;
create policy fornecedores_write on public.fornecedores
  for all using ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- ajustes_estoque
drop policy if exists ajustes_select on public.ajustes_estoque;
create policy ajustes_select on public.ajustes_estoque
  for select using ( public.my_role()::text in ('estoque', 'estoque_compras', 'diretoria', 'admin') );

drop policy if exists ajustes_insert on public.ajustes_estoque;
create policy ajustes_insert on public.ajustes_estoque
  for insert with check ( public.my_role()::text in ('estoque', 'estoque_compras', 'admin') and solicitante_id = auth.uid() );

drop policy if exists ajustes_update on public.ajustes_estoque;
create policy ajustes_update on public.ajustes_estoque
  for update to authenticated
  using ( public.my_role()::text in ('diretoria', 'admin') )
  with check ( public.my_role()::text in ('diretoria', 'admin') );

-- solicitacoes_produto
drop policy if exists solicitacoes_produto_select on public.solicitacoes_produto;
create policy solicitacoes_produto_select on public.solicitacoes_produto
  for select using ( public.my_role()::text in ('compras', 'estoque_compras', 'estoque', 'lider', 'admin') );

drop policy if exists solicitacoes_produto_update on public.solicitacoes_produto;
create policy solicitacoes_produto_update on public.solicitacoes_produto
  for all using ( public.my_role()::text in ('compras', 'estoque_compras', 'admin') )
  with check ( public.my_role()::text in ('compras', 'estoque_compras', 'admin') );

-- Storage: boletos
drop policy if exists boletos_insert on storage.objects;
create policy boletos_insert on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'boletos' and public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

drop policy if exists boletos_update on storage.objects;
create policy boletos_update on storage.objects
  for update to authenticated
  using ( bucket_id = 'boletos' and public.my_role()::text in ('estoque', 'compras', 'estoque_compras', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
