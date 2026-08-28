-- =====================================================================
-- MIGRAÇÃO 08 — Requisições por líderes + recebimento no estoque
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Mudanças de fluxo:
--   * Novo papel 'lider': faz REQUISIÇÕES de itens (enxerga só a aba Requisições).
--   * O Estoque NÃO cria mais pedidos — quem abre é o líder (requisição).
--   * Novo status 'recebido': após o pagamento, quando os itens chegam, o
--     Estoque dá "OK" no pedido e as quantidades entram automaticamente no estoque.
-- =====================================================================

-- 1) Novo papel: lider
do $$
begin
  alter type public.user_role add value 'lider';
exception
  when duplicate_object then null;
end $$;

-- 2) Novo status: recebido (itens chegaram e foram lançados no estoque)
do $$
begin
  alter type public.pedido_status add value 'recebido';
exception
  when duplicate_object then null;
end $$;

-- 3) Campos de recebimento em pedidos
alter table public.pedidos
  add column if not exists recebido_por uuid references public.profiles(id),
  add column if not exists data_recebimento timestamptz;

-- 4) Quem cria pedidos passa a ser o líder (requisição). Estoque não cria mais.
--    Usamos ::text para evitar o erro "unsafe use of new enum value".
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos
  for insert with check (
    public.my_role()::text in ('lider', 'admin') and criado_por = auth.uid()
  );

-- 5) Atualização de pedidos: compras/diretoria/financeiro seguem o fluxo e o
--    estoque agora confirma o recebimento (pago -> recebido).
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ( public.my_role()::text in ('estoque', 'compras', 'diretoria', 'financeiro', 'admin') )
  with check ( public.my_role()::text in ('estoque', 'compras', 'diretoria', 'financeiro', 'admin') );

-- 6) Itens do pedido: o líder cadastra os itens da requisição.
drop policy if exists itens_write on public.pedido_itens;
create policy itens_write on public.pedido_itens
  for all using ( public.my_role()::text in ('lider', 'admin') )
  with check ( public.my_role()::text in ('lider', 'admin') );

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
