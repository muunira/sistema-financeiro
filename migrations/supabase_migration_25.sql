-- =====================================================================
-- MIGRAÇÃO 25 — Zerar números de pedido (limpar dados de teste)
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- ATENÇÃO: esta migration APAGA todos os pedidos, itens, cotações,
-- histórico de status e arquivos relacionados. Não é reversível.
-- Faça backup antes de executar em produção.
-- =====================================================================

-- 1) Remove todos os pedidos. Por conta das FKs on delete cascade,
--    pedido_itens, cotacoes, cotacao_itens e historico são apagados juntos.
delete from public.pedidos;

-- 2) Reseta a sequência do número do pedido para começar do 1 novamente.
alter sequence if exists public.pedido_numero_seq restart with 1;

-- 3) Os arquivos no Storage (boletos, comprovantes, cotacoes) NÃO podem ser
--    apagados por SQL por segurança. Para removê-los, use a interface do
--    Supabase: Storage > selecione o bucket > selecione todos > Delete.
--    Ou faça via Storage API / SDK do Supabase.
-- delete from storage.objects where bucket_id = 'boletos';   -- NÃO USE
-- delete from storage.objects where bucket_id = 'comprovantes'; -- NÃO USE
-- delete from storage.objects where bucket_id = 'cotacoes'; -- NÃO USE

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
