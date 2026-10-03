# PAPTECH Desktop

Versão do PAPTECH **instalada no computador** (não é mais aberta pelo
navegador), com os dados guardados num **banco de dados local de verdade**
(SQLite) e com a opção de **rodar em rede local**, para vários computadores
da loja/escritório verem os mesmos dados — tudo sem precisar de internet.

A versão de navegador (`/index.html`, na raiz do repositório) continua
existindo normalmente; esta pasta `desktop/` é um programa adicional, feito
a partir das mesmas telas e regras de negócio.

## Como está organizado

```
desktop/
  package.json          Scripts (start/dist) e configuração do instalador
  main.js                Processo principal do Electron (janela, banco, rede)
  preload.js              Ponte entre a tela e o processo principal
  src/db.js                Banco de dados local (SQLite)
  src/servidorRede.js       Servidor HTTP para o modo "Servidor" da rede local
  renderer/index.html        A tela do PAPTECH (mesmas telas de sempre)
```

## Como instalar e rodar (passo a passo)

Pré-requisito: ter o **Node.js** instalado no computador (versão 18 ou mais
nova) — baixe em https://nodejs.org se ainda não tiver.

1. Abra um terminal (Prompt de Comando/PowerShell no Windows) dentro desta
   pasta `desktop/`.
2. Instale as dependências:
   ```
   npm install
   ```
3. Para testar o programa sem gerar instalador ainda:
   ```
   npm start
   ```
4. Para gerar o instalador do Windows (arquivo `.exe`):
   ```
   npm run dist:win
   ```
   O instalador pronto aparece dentro da pasta `dist/` que será criada.

> **Importante sobre o passo 2/4:** o banco de dados local usa um módulo
> chamado `better-sqlite3`, que precisa ser baixado/compilado para o sistema
> operacional de quem vai usar o programa. Isso funciona melhor quando
> `npm install` e `npm run dist:win` são executados **no próprio computador
> Windows** onde o PAPTECH vai ser usado (ou instalado) — gerar o instalador
> do Windows a partir de outro sistema (ex: Linux) não é garantido. Se algum
> desses comandos der erro, me avise com a mensagem de erro que apareceu que
> eu ajudo a resolver.

## Configurando o uso em rede (vários computadores)

Por padrão, cada computador roda "Sozinho", só com o banco dele. Para
compartilhar dados entre computadores da mesma rede local (sem internet):

1. Escolha **um** computador para ser o "Servidor" (ex: o do balcão
   principal). Nele, abra o PAPTECH → **Configurações → Rede** → marque
   "Este computador é o Servidor" → Salvar → reabra o programa.
2. Descubra o IP desse computador na rede local (no Windows:
   `ipconfig` no Prompt de Comando, procure "Endereço IPv4", algo como
   `192.168.1.10`).
3. Nos demais computadores, abra o PAPTECH → **Configurações → Rede** →
   marque "Cliente" → informe o IP do computador Servidor (e a porta, se
   tiver mudado) → Salvar → reabra o programa.
4. Pronto: os computadores "Cliente" passam a ler os dados do Servidor ao
   abrir o programa, e cada salvamento é enviado para ele em segundo plano.
   Se a rede cair, cada computador continua funcionando com os últimos
   dados que recebeu, e volta a sincronizar quando a rede voltar.

Isso é sincronização "ao abrir o programa + a cada salvamento", não tempo
real: se dois computadores estiverem com uma mesma tela aberta ao mesmo
tempo, um não vê instantaneamente o que o outro está digitando antes de
salvar.

## Diferenças em relação à versão de navegador

- Os dados ficam num arquivo de banco de dados SQLite de verdade, dentro da
  pasta de dados do programa no computador (não é mais `localStorage` do
  navegador, e não depende de nenhum serviço de nuvem).
- A versão instalada **começa vazia** — ela não importa automaticamente o
  que já estiver cadastrado na versão de navegador. Se quiser levar algum
  dado de lá pra aqui, use **Configurações → Backup/Restauração** em ambas
  as versões (gera/lê um arquivo `.json`).
