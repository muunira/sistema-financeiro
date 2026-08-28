# Sistema de Controle de Estoque e Compras

Sistema web com login obrigatório para controlar o fluxo de compras de uma fábrica:

```
REQUISIÇÃO  →  COMPRAS  →  DIRETORIA  →  FINANCEIRO  →  ESTOQUE
(líder pede) (cota/envia) (aprova/rejeita) (paga)     (recebe/soma)
```

Feito com **HTML/JS puro + Supabase** (banco de dados + autenticação). Não precisa de build.

## Papéis (roles)

| Papel        | O que faz | Abas que enxerga |
|--------------|-----------|------------------|
| `admin`      | Cria e gerencia usuários; enxerga todas as telas | Todas |
| `lider`      | Líder de setor: faz requisições de itens | Requisições, Minha conta |
| `estoque`    | Controla quantidades e confirma o recebimento dos itens (soma no estoque) | Estoque, Compras, Minha conta |
| `compras`    | Cota fornecedores e envia para a diretoria | Estoque, Compras, Minha conta |
| `diretoria`  | Escolhe a melhor cotação e aprova, ou rejeita com motivo | Diretoria, Minha conta |
| `financeiro` | Registra o pagamento e anexa o comprovante | Financeiro, Minha conta |

Quem abre os pedidos agora são os **líderes** (aba Requisições) — o **Estoque** não cria mais pedidos, apenas controla as quantidades e confirma o recebimento. Os setores de **Estoque** e **Compras** compartilham as duas abas (Estoque e Compras). A **Diretoria** enxerga apenas a aba Diretoria e o **Financeiro** apenas a aba Financeiro (ambos mantêm a aba Minha conta). Dashboard e Relatório são exclusivos do **admin**.

Somente o **admin** cria contas — não há auto-cadastro.

---

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com e crie um projeto (grátis).
2. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public** key (é pública, pode ficar no frontend)
3. Abra `js/supabase.js` e cole os dois valores em `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

## 2. Criar as tabelas e a segurança

1. No Supabase, abra **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase_schema.sql` e clique em **Run**.
   - Isso cria as tabelas, as políticas de segurança (RLS), os gatilhos e alguns produtos de exemplo.

## 2.1 Criar cotações e comprovantes (migração 02)

Execute também `migrations/supabase_migration_02.sql` no SQL Editor. Ele adiciona:

- A tabela `cotacoes`: vários fornecedores por pedido.
- As colunas `cotacao_escolhida` e `comprovante_path` em `pedidos`.
- O bucket privado `comprovantes` no Storage.
- As permissões (RLS) para que **financeiro** anexe comprovantes e **estoque/compras** os visualizem.

## 2.2 Cadastro de fornecedores (migração 03)

Execute também `migrations/supabase_migration_03.sql` no SQL Editor. Ele cria:

- A tabela `fornecedores` (nome, CNPJ, contato, telefone, e-mail, endereço).
- As permissões (RLS) para que **compras** e **admin** gerenciem e todos vejam.

## 2.3 Cotação unitária por item (migração 04)

Execute também `migrations/supabase_migration_04.sql` no SQL Editor. Ele adiciona:

- A coluna `valor_unitario` em `pedido_itens`.
- A permissão para **compras** atualizar o valor unitário dos itens.

A partir daqui o fluxo é: um fornecedor por pedido, com valores unitários para cada item e total automático.

## 2.4 Várias cotações por pedido (migração 05)

Execute também `migrations/supabase_migration_05.sql` no SQL Editor. Ele adiciona:

- A tabela `cotacao_itens`: valores unitários de cada fornecedor por item.
- As permissões (RLS) para **compras** e **admin** gerenciarem as cotações.

A partir daqui o fluxo é: **compras** adiciona várias cotações de fornecedores para o mesmo pedido; a **diretoria** escolhe a melhor e aprova.

## 2.5 Pagamento e boleto após aprovação (migração 06)

Execute também `migrations/supabase_migration_06.sql` no SQL Editor. Ele adiciona:

- O status `aguardando_pagamento`.
- Os campos de pagamento em `pedidos`: `boleto_path`, `banco`, `agencia`, `conta`, `razao_social`, `cpf_cnpj`, `pix`, `forma_pagamento`.
- O bucket privado `boletos` no Storage.

Fluxo: após a Diretoria aprovar, o pedido volta para **Compras** preencher a forma de pagamento. Se for **Boleto**, anexa o arquivo; se for **Transferência**, preenche os dados bancários obrigatórios. Depois envia para o **Financeiro**, que paga e anexa o comprovante.

## 2.6 Estoque e Compras compartilham as duas funções (migração 07)

Execute também `migrations/supabase_migration_07.sql` no SQL Editor. Ele ajusta as políticas (RLS) para que os papéis **estoque** e **compras** possam gravar nas duas funções: produtos, pedidos, itens, cotações, fornecedores e boletos. Assim ambos usam as abas Estoque e Compras por completo.

## 2.7 Requisições por líderes e recebimento no estoque (migração 08)

Execute também `migrations/supabase_migration_08.sql` no SQL Editor. Ele adiciona:

- O papel **lider** (`user_role`): faz requisições de itens e enxerga só a aba Requisições.
- O status **recebido** (`pedido_status`) e os campos `recebido_por` e `data_recebimento` em `pedidos`.
- Ajuste de RLS: agora **quem cria pedidos é o líder** (o Estoque não cria mais) e o **Estoque** passa a confirmar o recebimento (pago → recebido).

Fluxo novo: o **líder** abre uma requisição → **Compras** cota → **Diretoria** aprova → **Compras** preenche o pagamento → **Financeiro** paga → quando os itens chegam, o **Estoque** dá "OK" no recebimento e as quantidades vinculadas a produtos entram automaticamente no estoque.

## 2.17 Observações por fornecedor nas cotações (migração 18)

Execute também `migrations/supabase_migration_18.sql` no SQL Editor. Ele:

- Adiciona a coluna `observacoes` em `cotacoes`.
- No formulário de cotação da aba **Compras**, o setor pode preencher observações diferentes para cada fornecedor.
- As observações aparecem na aba **Compras** e na **Diretoria** ao escolher a melhor cotação.

## 2.16 Corrige criação de usuário com novo papel (migração 17)

Execute também `migrations/supabase_migration_17.sql` no SQL Editor. Ele:

- Adiciona `estoque_compras` ao enum de papéis no banco.
- Corrige o trigger `handle_new_user` para gravar `setor` e `ativo` corretamente.
- Resolve o erro 500 que ocorria ao criar novos usuários.

## 2.15 Papel único Estoque/Compras (migração 16)

Execute também `migrations/supabase_migration_16.sql` no SQL Editor. Ele cria:

- O novo papel `estoque_compras`, que unifica as permissões dos papéis `estoque` e `compras`.
- Quem tiver esse papel acessa as abas **Estoque** e **Compras** e realiza as funções de ambos.
- O cadastro no select de papéis mostra "Estoque / Compras".

## 2.14 Cadastro de produtos somente pelo Compras (migração 15)

Execute também `migrations/supabase_migration_15.sql` no SQL Editor. Ele cria:

- A tabela `solicitacoes_produto` para líderes solicitarem cadastro de novos produtos.
- **Aba Requisições**: o botão virou **"Solicitar cadastro de produto"** e envia a solicitação para o Compras.
- **Aba Compras**: o setor de Compras vê as solicitações pendentes e um botão **"+ Novo produto"** para cadastrar produtos novos. Só o setor de Compras cadastra produtos.
- **Aba Estoque**: removida a opção de cadastrar produtos.

## 2.13 Conferência/baixa de estoque pelo Compras (migração 14)

Execute também `migrations/supabase_migration_14.sql` no SQL Editor. Ele adiciona:

- O status `conferido` para pedidos.
- Na aba **Compras**, uma nova aba interna **"A conferir"** lista os pedidos com status `recebido`.
- O setor de **Compras** confere o pedido e clica em **"Conferir e baixar do estoque"**. O sistema remove automaticamente do estoque as quantidades dos itens vinculados a produtos e marca o pedido como `conferido`.

## 2.12 Ajustes manuais de estoque com aprovação da Diretoria (migração 13)

Execute também `migrations/supabase_migration_13.sql` no SQL Editor. Ele cria:

- A tabela `ajustes_estoque` para solicitar adições/remoções manuais no estoque.
- A aba **Ajustes manuais de estoque** na **Diretoria** para aprovar ou rejeitar.

O setor de **Estoque** clica em **"+ Adicionar"** ou **"- Remover"**, informa a quantidade e justificativa, e a Diretoria aprova antes da quantidade entrar ou sair do estoque.

## 2.11 Gestão de usuários por Diretoria e Financeiro (migração 12)

Execute também `migrations/supabase_migration_12.sql` no SQL Editor. Ele libera para os papéis **diretoria** e **financeiro** visualizar e gerenciar os usuários da aba **Usuários**. Assim, além do **admin**, eles também podem criar, alterar o papel/setor e ativar/desativar contas.

## 2.10 Log de auditoria (migração 11)

Execute também `migrations/supabase_migration_11.sql` no SQL Editor. Ele cria:

- A tabela `auditoria`, que registra automaticamente toda inserção, alteração e exclusão nas tabelas principais (`produtos`, `pedidos`, `pedido_itens`, `cotacoes`, `cotacao_itens`, `fornecedores`, `profiles`).
- A aba **Auditoria** no menu lateral, acessível apenas pelos papéis **diretoria** e **admin**.
- Filtros por tabela, ação (INSERT/UPDATE/DELETE) e usuário.

## 2.9 Compras pode retirar item já em estoque (migração 10)

Execute também `migrations/supabase_migration_10.sql` no SQL Editor. Ele dá permissão para o setor de **Compras** alterar/excluir itens de pedidos, permitindo retirar um item que já exista em estoque antes de cotar. Na tela de Compras, cada item de um pedido a cotar exibe o estoque atual (quando vinculado a um produto) e um botão **"Retirar do pedido"**. Ao retirar, as cotações já existentes são recalculadas automaticamente.

## 2.8 Setor do usuário (migração 09)

Execute também `migrations/supabase_migration_09.sql` no SQL Editor. Ele adiciona o campo `setor` ao perfil e faz o gatilho de criação gravar o setor escolhido pelo admin. No cadastro de usuários passa a existir um campo **Setor** com a lista fixa da empresa (Assistência Técnica, Cobrança, Comercial, Compras, Diretoria, Departamento Pessoal, Estofados, Faturamento, Financeiro, Fiscal, Logística, Marketing, Recursos Humanos, Representantes, Televendas).

## 3. Ajustar a autenticação

Em **Authentication → Providers → Email**:

- Deixe **Email** habilitado.
- **Desligue** a opção *"Confirm email"* (Confirmar e-mail). Assim os usuários criados pelo admin já entram direto com a senha inicial.
  - Se preferir manter a confirmação ligada, cada usuário precisará confirmar o e-mail antes do primeiro login.

## 4. Criar o primeiro administrador

Como o admin é quem cria os demais, o primeiro usuário precisa ser criado manualmente:

1. Em **Authentication → Users → Add user**, crie um usuário com e-mail e senha.
2. O gatilho cria automaticamente um registro em `profiles` com papel `estoque`.
3. Vá em **Table Editor → profiles**, encontre esse usuário e mude o campo `role` para `admin`.

Pronto: faça login com esse usuário e use a tela **Usuários** para criar todos os outros.

## 5. Rodar o site

É um site estático. Como usa módulos ES (`type="module"`), sirva por HTTP (abrir o arquivo direto com `file://` não funciona).

Opções:

```powershell
# Com Python instalado
python -m http.server 5500

# Ou com Node
npx serve
```

Depois abra `http://localhost:5500` (ou a porta indicada) e faça login.

---

## Estrutura de arquivos

```
index.html            Tela de login
app.html              Shell do app (menu lateral por papel)
supabase_schema.sql       Tabelas + RLS + dados de exemplo
migrations/supabase_migration_02.sql Cotações + comprovante de pagamento
migrations/supabase_migration_03.sql Cadastro de fornecedores
migrations/supabase_migration_04.sql Valor unitário por item (etapa anterior)
migrations/supabase_migration_05.sql Várias cotações por pedido
migrations/supabase_migration_06.sql Pagamento e boleto após aprovação
migrations/supabase_migration_07.sql Estoque e Compras compartilham as duas funções
migrations/supabase_migration_08.sql Requisições por líderes + recebimento no estoque
migrations/supabase_migration_09.sql Setor do usuário
migrations/supabase_migration_10.sql Compras pode retirar itens já em estoque
migrations/supabase_migration_11.sql Log de auditoria automático
migrations/supabase_migration_12.sql Gestão de usuários por Diretoria e Financeiro
migrations/supabase_migration_13.sql Ajustes manuais de estoque com aprovação
migrations/supabase_migration_14.sql Conferência/baixa de estoque pelo líder
migrations/supabase_migration_15.sql Cadastro de produtos somente pelo Compras
migrations/supabase_migration_16.sql Papel único Estoque/Compras
migrations/supabase_migration_17.sql Corrige criação de usuário com novo papel
migrations/supabase_migration_18.sql Observações por fornecedor nas cotações
css/styles.css        Estilos
js/
  supabase.js         Configuração do cliente Supabase
  auth.js             Login/logout e guarda de sessão
  ui.js               Helpers de interface (badges, datas, toast)
  pedidos.js          Acesso compartilhado aos pedidos
  app.js              Navegação e roteamento por papel
  requisicoes.js      Módulo Requisições (líderes)
  estoque.js          Módulo Estoque
  compras.js          Módulo Compras
  diretoria.js        Módulo Diretoria
  financeiro.js       Módulo Financeiro
  admin.js            Módulo de gestão de usuários
  auditoria.js        Módulo Auditoria
```

## Fluxo de status de um pedido

`solicitado` → `em_cotacao` → `aguardando_diretoria` → `aprovado` → `aguardando_pagamento` → `pago` → `recebido`

- Um **líder** abre a requisição (status `solicitado`) na aba Requisições.
- **Compras** adiciona várias cotações (fornecedores e valores unitários por item) para o mesmo pedido.
- **Diretoria** vê todas as cotações, escolhe a melhor e aprova.
- **Compras** volta a preencher a forma de pagamento: anexa boleto ou preenche os dados bancários obrigatórios.
- **Financeiro** efetua o pagamento e anexa o comprovante.
- **Estoque** confirma o recebimento (status `recebido`): as quantidades vinculadas a produtos entram automaticamente no estoque.

Cada mudança fica registrada na tabela `historico` para auditoria.

## Segurança

- Toda a autenticação é feita pelo Supabase Auth.
- As tabelas usam **Row Level Security (RLS)**: cada papel só consegue executar as ações que lhe cabem, mesmo que alguém tente burlar pela API.
- Nunca coloque a chave `service_role` no frontend — use apenas a `anon`.
- O controle de quantidade em estoque é feito pelo setor de estoque: as entradas por recebimento de pedidos são somadas automaticamente (itens vinculados a produtos) e o restante pode ser ajustado manualmente.
