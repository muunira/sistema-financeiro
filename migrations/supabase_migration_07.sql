-- =====================================================================
-- MIGRAÇÃO 07 — Estoque e Compras compartilham as duas funções
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- A partir daqui, os papéis 'estoque' e 'compras' têm acesso total às
-- duas abas (Estoque e Compras): ambos podem cadastrar produtos, abrir
-- pedidos, editar itens, cotar fornecedores, gerenciar fornecedores e
-- anexar boletos. Diretoria e Financeiro permanecem inalterados.
-- =====================================================================

-- 1) Produtos: estoque e compras podem gravar
drop policy if exists produtos_write on public.produtos;
create policy produtos_write on public.produtos
  for all using ( public.my_role() in ('estoque', 'compras', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'admin') );

-- 2) Pedidos: estoque e compras podem criar
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos
  for insert with check (
    public.my_role() in ('estoque', 'compras', 'admin') and criado_por = auth.uid()
  );

-- 3) Pedidos: estoque e compras (além de diretoria/financeiro) atualizam
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ( public.my_role() in ('estoque', 'compras', 'diretoria', 'financeiro', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'diretoria', 'financeiro', 'admin') );

-- 4) Itens do pedido: estoque e compras podem gravar
drop policy if exists itens_write on public.pedido_itens;
create policy itens_write on public.pedido_itens
  for all using ( public.my_role() in ('estoque', 'compras', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'admin') );

-- 5) Cotações: estoque e compras podem gravar
drop policy if exists cotacoes_write on public.cotacoes;
create policy cotacoes_write on public.cotacoes
  for all using ( public.my_role() in ('estoque', 'compras', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'admin') );

-- 6) Itens de cotação: estoque e compras podem gravar
drop policy if exists cotacao_itens_write on public.cotacao_itens;
create policy cotacao_itens_write on public.cotacao_itens
  for all using ( public.my_role() in ('estoque', 'compras', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'admin') );

-- 7) Fornecedores: estoque e compras podem gravar
drop policy if exists fornecedores_write on public.fornecedores;
create policy fornecedores_write on public.fornecedores
  for all using ( public.my_role() in ('estoque', 'compras', 'admin') )
  with check ( public.my_role() in ('estoque', 'compras', 'admin') );

-- 8) Boletos (Storage): estoque e compras podem anexar/substituir
drop policy if exists boletos_insert on storage.objects;
create policy boletos_insert on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'boletos' and public.my_role() in ('estoque', 'compras', 'admin') );

drop policy if exists boletos_update on storage.objects;
create policy boletos_update on storage.objects
  for update to authenticated
  using ( bucket_id = 'boletos' and public.my_role() in ('estoque', 'compras', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
