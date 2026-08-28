-- =====================================================================
-- SISTEMA DE CONTROLE DE ESTOQUE E COMPRAS - Schema Supabase
-- =====================================================================
-- Execute este arquivo no Supabase: Dashboard > SQL Editor > New query
-- Ele cria as tabelas, as políticas de segurança (RLS) e dados de exemplo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'estoque', 'compras', 'diretoria', 'financeiro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pedido_status as enum (
    'solicitado',           -- criado pelo estoque
    'em_cotacao',           -- compras está cotando
    'aguardando_diretoria', -- enviado para aprovação
    'aprovado',             -- diretoria aprovou
    'rejeitado',            -- diretoria rejeitou
    'pago'                  -- financeiro pagou
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- TABELA: profiles (perfil de cada usuário, ligado ao auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  email      text not null,
  role       user_role not null default 'estoque',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABELA: produtos (itens do estoque)
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  sku              text unique,
  unidade          text not null default 'UN',
  quantidade_atual numeric not null default 0,
  estoque_minimo   numeric not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABELA: pedidos (o pedido de compra que percorre o fluxo)
-- ---------------------------------------------------------------------
create sequence if not exists pedido_numero_seq;

create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  numero         integer not null default nextval('pedido_numero_seq'),
  status         pedido_status not null default 'solicitado',

  -- Estoque
  criado_por     uuid not null references public.profiles(id),
  justificativa  text,
  created_at     timestamptz not null default now(),

  -- Compras
  comprador_id   uuid references public.profiles(id),
  fornecedor     text,
  valor_estimado numeric,
  obs_compras    text,

  -- Diretoria
  aprovado_por    uuid references public.profiles(id),
  data_decisao    timestamptz,
  motivo_rejeicao text,

  -- Financeiro
  pago_por        uuid references public.profiles(id),
  data_pagamento  timestamptz,
  valor_pago      numeric,
  forma_pagamento text
);

-- ---------------------------------------------------------------------
-- TABELA: pedido_itens (itens de cada pedido)
-- ---------------------------------------------------------------------
create table if not exists public.pedido_itens (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  produto_id  uuid references public.produtos(id),
  descricao   text not null,
  quantidade  numeric not null default 1,
  observacao  text
);

-- ---------------------------------------------------------------------
-- TABELA: historico (auditoria de mudanças de status)
-- ---------------------------------------------------------------------
create table if not exists public.historico (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  de_status   pedido_status,
  para_status pedido_status,
  usuario_id  uuid references public.profiles(id),
  observacao  text,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- FUNÇÃO AUXILIAR: retorna o role do usuário logado
-- (security definer para poder ler profiles sem recursão de RLS)
-- =====================================================================
create or replace function public.my_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and ativo = true;
$$;

-- =====================================================================
-- TRIGGER: cria automaticamente um profile quando um auth.user é criado
-- (usa os metadados nome/role passados pelo admin no momento do convite)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estoque')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles     enable row level security;
alter table public.produtos     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.historico    enable row level security;

-- ---------- PROFILES ----------
-- Cada um lê o próprio perfil; admin lê todos.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using ( id = auth.uid() or public.my_role() = 'admin' );

-- Admin gerencia perfis (criar/editar role, ativar/desativar).
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using ( public.my_role() = 'admin' )
  with check ( public.my_role() = 'admin' );

-- ---------- PRODUTOS ----------
-- Qualquer usuário ativo pode ver os produtos.
drop policy if exists produtos_select on public.produtos;
create policy produtos_select on public.produtos
  for select using ( public.my_role() is not null );

-- Estoque e admin gerenciam produtos.
drop policy if exists produtos_write on public.produtos;
create policy produtos_write on public.produtos
  for all using ( public.my_role() in ('estoque', 'admin') )
  with check ( public.my_role() in ('estoque', 'admin') );

-- ---------- PEDIDOS ----------
-- Todos os setores envolvidos podem ver os pedidos (para acompanhar o fluxo).
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos
  for select using ( public.my_role() is not null );

-- Estoque cria pedidos.
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos
  for insert with check (
    public.my_role() in ('estoque', 'admin') and criado_por = auth.uid()
  );

-- Atualização: cada setor atualiza (a regra de qual status pode ir para
-- qual é reforçada no app; aqui limitamos por role quem pode escrever).
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update using (
    public.my_role() in ('compras', 'diretoria', 'financeiro', 'admin')
  ) with check (
    public.my_role() in ('compras', 'diretoria', 'financeiro', 'admin')
  );

-- ---------- PEDIDO_ITENS ----------
drop policy if exists itens_select on public.pedido_itens;
create policy itens_select on public.pedido_itens
  for select using ( public.my_role() is not null );

drop policy if exists itens_write on public.pedido_itens;
create policy itens_write on public.pedido_itens
  for all using ( public.my_role() in ('estoque', 'admin') )
  with check ( public.my_role() in ('estoque', 'admin') );

-- ---------- HISTORICO ----------
drop policy if exists historico_select on public.historico;
create policy historico_select on public.historico
  for select using ( public.my_role() is not null );

drop policy if exists historico_insert on public.historico;
create policy historico_insert on public.historico
  for insert with check ( public.my_role() is not null and usuario_id = auth.uid() );

-- =====================================================================
-- DADOS DE EXEMPLO (produtos) - opcional
-- =====================================================================
insert into public.produtos (nome, sku, unidade, quantidade_atual, estoque_minimo)
values
  ('Parafuso M6',        'PAR-M6',   'CX', 50,  20),
  ('Chapa de aço 2mm',   'CHP-2MM',  'UN', 8,   10),
  ('Óleo lubrificante',  'OLE-LUB',  'L',  30,  15),
  ('Luva de proteção',   'LUV-PRO',  'PAR',12,  25)
on conflict (sku) do nothing;

-- =====================================================================
-- FIM
-- =====================================================================
