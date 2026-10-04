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

## Emissão de NF-e (Nota Fiscal Eletrônica, modelo 55)

O PAPTECH transmite a NF-e da venda para a SEFAZ através da **[Focus NFe](https://focusnfe.com.br)**
(serviço pago por nota/mês). Fluxo: **Vendas → 🧾 Emitir NFe → Transmitir para a SEFAZ**.
Quando a nota é autorizada, o sistema guarda número, série, chave e protocolo, dá baixa no estoque
e lança as parcelas em Contas a Receber. Depois dá para abrir o **DANFE (PDF)** e o **XML**,
**consultar** a situação, emitir **Carta de Correção** e **cancelar** a nota.

Antes de transmitir, o sistema confere os dados obrigatórios (CNPJ/IE da empresa, endereço completo
do cliente, NCM de 8 dígitos, CST/CSOSN, CFOP) e mostra o que falta corrigir.

### Por que existe um "intermediário"

O navegador não consegue chamar a Focus NFe diretamente (bloqueio de CORS) e o token da Focus não
pode ficar visível no código da página. Por isso o PAPTECH conversa com um pequeno intermediário,
que guarda o token e só aceita pedidos de quem tiver a **chave do intermediário**. Há duas opções:

**Opção A — Supabase (recomendada, já que o sistema usa Supabase):**

1. No painel do Supabase: **Edge Functions → Deploy a new function → Via Editor**, nome `focus-nfe`.
2. Cole o conteúdo de `supabase/functions/focus-nfe/index.ts` e publique.
3. Em **Edge Functions → Secrets**, crie:
   - `PAPTECH_CHAVE_NFE` — uma senha forte que você inventa;
   - `FOCUS_TOKEN_HOMOLOGACAO` — token de homologação do painel da Focus NFe;
   - `FOCUS_TOKEN_PRODUCAO` — token de produção do painel da Focus NFe.

**Opção B — um computador da loja (Node.js 18+):**

1. Na pasta `intermediario-nfe`, copie `config-exemplo.json` para `config.json` e preencha.
2. Rode `node servidor.js` (fica escutando na porta 8787 da rede local).
3. Nas Configurações do PAPTECH escolha "URL própria" e informe `http://IP-DO-COMPUTADOR:8787`.

### Configurando

1. Contrate a Focus NFe, cadastre a empresa e envie o **certificado digital A1** (.pfx) no painel dela.
2. No PAPTECH, preencha **Configurações → Dados da Empresa** (CNPJ, IE, endereço completo).
3. Em **Configurações → Nota Fiscal Eletrônica**: ambiente, intermediário, a chave do intermediário
   (fica salva só no computador, digite em cada um), regime tributário e padrões fiscais. Clique em
   **Testar conexão**.
4. Nos produtos, preencha **NCM**, **CFOP**, **CST/CSOSN** e **Origem** (aba Impostos). Quando
   vazios, CFOP e CST/CSOSN usam os padrões das Configurações. Para vendas a outro estado, o CFOP
   5xxx vira 6xxx automaticamente.
5. Emita algumas notas em **Homologação** (sem valor fiscal) e só então mude para **Produção**.

> Confirme CST/CSOSN, CFOP e PIS/COFINS com o seu contador. O PAPTECH envia ICMS destacado para
> CST 00 (Regime Normal) e os casos sem destaque (Simples 102/103/300/400/500; Normal 40/41/50/60).
> Situações com ICMS-ST calculado na própria nota ou redução de base ainda não são montadas
> automaticamente.

## Acesso inicial

- **Usuário:** `admin`
- **Senha:** `admin`

Troque a senha e cadastre os demais usuários em **Configurações → Usuários e Permissões**
depois do primeiro login.

## Principais módulos

- Clientes, Fornecedores, Transportadoras
- Produtos (com código interno, código original, códigos similares, controle de estoque)
- Compras (pedido de compra, importação de XML de NF-e, entrada em estoque, contas a pagar)
- Vendas (pedido de venda, emissão de NF-e pela Focus NFe, baixa de estoque, contas a receber)
- Contas a Pagar / Contas a Receber / Cobrança
- Calendário Financeiro, Calculadora
- Relatórios de Compras e Vendas (por comprador/vendedor, com impressão)
- Backup/Restauração dos dados (exporta e importa um .json)
- Login e controle de acesso por usuário (Administrador / Operador)

## Importante

Como é um sistema que roda só no navegador, os dados ficam salvos **somente neste
computador/navegador**. Use o Backup (em Configurações) regularmente para não perder
informações.
