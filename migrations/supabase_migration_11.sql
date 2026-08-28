-- =====================================================================
-- MIGRAÇÃO 11 — Log de auditoria automático, visível apenas pela Diretoria
-- =====================================================================
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Requer as migrações anteriores.
--
-- Registra automaticamente INSERT, UPDATE e DELETE nas tabelas principais.
-- A tela de Auditoria no frontend só é acessível para os papéis
-- 'diretoria' e 'admin'.
-- =====================================================================

-- 1) Tabela de auditoria
create table if not exists public.auditoria (
  id          uuid primary key default gen_random_uuid(),
  tabela      text not null,
  registro_id uuid,
  acao        text not null,   -- INSERT, UPDATE, DELETE
  usuario_id  uuid,
  detalhes    jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.auditoria is 'Log automático de alterações no sistema';

-- 2) Função trigger genérica que grava na auditoria
create or replace function public.auditoria_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE') then
    insert into public.auditoria (tabela, registro_id, acao, usuario_id, detalhes)
    values (TG_TABLE_NAME, OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
    return OLD;
  elsif (TG_OP = 'INSERT') then
    insert into public.auditoria (tabela, registro_id, acao, usuario_id, detalhes)
    values (TG_TABLE_NAME, NEW.id, 'INSERT', auth.uid(), to_jsonb(NEW));
    return NEW;
  else
    -- UPDATE: salva os dados novos
    insert into public.auditoria (tabela, registro_id, acao, usuario_id, detalhes)
    values (TG_TABLE_NAME, NEW.id, 'UPDATE', auth.uid(), to_jsonb(NEW));
    return NEW;
  end if;
end;
$$;

-- 3) Remove triggers antigos caso a migração seja re-executada

drop trigger if exists auditoria_produtos on public.produtos;
drop trigger if exists auditoria_pedidos on public.pedidos;
drop trigger if exists auditoria_pedido_itens on public.pedido_itens;
drop trigger if exists auditoria_cotacoes on public.cotacoes;
drop trigger if exists auditoria_cotacao_itens on public.cotacao_itens;
drop trigger if exists auditoria_fornecedores on public.fornecedores;
drop trigger if exists auditoria_profiles on public.profiles;

-- 4) Cria os triggers nas tabelas principais
--    A tabela 'auditoria' não tem trigger (evita loop infinito)
create trigger auditoria_produtos
  after insert or update or delete on public.produtos
  for each row execute function public.auditoria_trigger();

create trigger auditoria_pedidos
  after insert or update or delete on public.pedidos
  for each row execute function public.auditoria_trigger();

create trigger auditoria_pedido_itens
  after insert or update or delete on public.pedido_itens
  for each row execute function public.auditoria_trigger();

create trigger auditoria_cotacoes
  after insert or update or delete on public.cotacoes
  for each row execute function public.auditoria_trigger();

create trigger auditoria_cotacao_itens
  after insert or update or delete on public.cotacao_itens
  for each row execute function public.auditoria_trigger();

create trigger auditoria_fornecedores
  after insert or update or delete on public.fornecedores
  for each row execute function public.auditoria_trigger();

create trigger auditoria_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.auditoria_trigger();

-- 5) Segurança (RLS): só diretoria e admin consultam
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select using ( public.my_role()::text in ('diretoria', 'admin') );

alter table public.auditoria enable row level security;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM
-- =====================================================================
