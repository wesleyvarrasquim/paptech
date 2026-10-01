# PAPTECH - Sistema de Gestão Comercial

Sistema de gestão comercial (autopeças) 100% front-end, em um único arquivo HTML.
Não tem servidor/backend próprio: todos os dados podem ficar só no `localStorage`
do navegador (modo padrão), ou ser compartilhados entre vários computadores através
de um banco de dados online grátis (Supabase) — veja abaixo.

## Como usar

Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox).

## Banco de dados compartilhado (opcional, recomendado)

Sem configurar nada, o sistema funciona 100% local: cada computador só vê os
próprios dados. Para que **todos os computadores vejam os mesmos dados**
(clientes, produtos, vendas, usuários, etc.), configure um banco gratuito no
Supabase:

1. Crie uma conta grátis em **https://supabase.com** e um novo projeto.
2. No projeto, abra **SQL Editor** e rode este script (cria a tabela e libera o
   acesso pela chave pública do projeto):

   ```sql
   create table registros (
     id bigint generated always as identity primary key,
     colecao text not null,
     registro_id integer not null,
     dados jsonb not null,
     atualizado_em timestamptz not null default now(),
     unique (colecao, registro_id)
   );
   alter table registros enable row level security;
   create policy "acesso total via anon key" on registros
     for all using (true) with check (true);
   ```

3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon
   public**.
4. Abra o `index.html` em um editor de texto, procure por `SUPABASE_URL` e
   `SUPABASE_ANON_KEY` (perto do topo do `<script>`) e cole os dois valores:

   ```js
   const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```

5. Salve e reabra o sistema. Ele vai mostrar "Sincronizando..." ao abrir, e a
   partir daí todos os computadores que usarem esse mesmo arquivo (com as
   mesmas duas linhas preenchidas) vão compartilhar os dados.

**Aviso de segurança:** como é uma página estática (sem servidor), a chave
`anon public` fica visível para quem abrir o código-fonte da página. A
política acima libera leitura/escrita para quem tiver essa chave — ou seja, o
mesmo nível de proteção que o login do próprio sistema já tem hoje (usuário e
senha ficam só no navegador de quem está usando, sem verificação de um
servidor). Não é um banco "de banco", é um banco de uso interno/confiança
entre quem usa o sistema.

**Sincronização não é em tempo real**: os dados são buscados da nuvem quando
o sistema é aberto/recarregado, e enviados para a nuvem a cada salvamento.
Se dois computadores estiverem com a tela aberta ao mesmo tempo, um não vê
instantaneamente o que o outro está digitando antes de salvar — é preciso
salvar (ou recarregar a página) para ver as mudanças do outro computador.

## Acesso inicial

- **Usuário:** `admin`
- **Senha:** `admin`

Troque a senha e cadastre os demais usuários em **Configurações → Usuários e Permissões**
depois do primeiro login.

## Principais módulos

- Clientes, Fornecedores, Transportadoras
- Produtos (com código interno, código original, códigos similares, controle de estoque)
- Compras (pedido de compra, importação de XML de NF-e, entrada em estoque, contas a pagar)
- Vendas (pedido de venda, nota fiscal de saída, baixa de estoque, contas a receber)
- Contas a Pagar / Contas a Receber / Cobrança
- Calendário Financeiro, Calculadora
- Relatórios de Compras e Vendas (por comprador/vendedor, com impressão)
- Backup/Restauração dos dados (exporta e importa um .json)
- Login e controle de acesso por usuário (Administrador / Operador)

## Importante

Como é um sistema que roda só no navegador, os dados ficam salvos **somente neste
computador/navegador**. Use o Backup (em Configurações) regularmente para não perder
informações.
