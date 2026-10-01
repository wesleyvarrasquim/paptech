# PAPTECH - Sistema de Gestão Comercial

Sistema de gestão comercial (autopeças) 100% front-end, em um único arquivo HTML.
Não tem servidor/backend: todos os dados ficam salvos no `localStorage` do navegador
de quem está usando.

## Como usar

Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox).

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
