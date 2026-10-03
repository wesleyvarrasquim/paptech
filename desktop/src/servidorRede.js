// Servidor HTTP bem pequeno para uso em rede local (sem internet/nuvem).
//
// Quando um computador está no modo "Servidor" (ver Configurações > Rede
// no renderer), ele liga este servidor, que expõe o banco local (db.js)
// pela rede. Os outros computadores, no modo "Cliente", apontam para o
// IP desse computador e usam estas duas rotas para ler/escrever:
//
//   GET  /registros              -> [{ colecao, dados }, ...]  (tudo)
//   POST /registros/:colecao     -> body = array da coleção inteira
//                                    (mesmo formato de loadList/saveList)
//
// Sem dependências externas (só o módulo "http" do Node) para não
// complicar o empacotamento do instalador.

const http = require('http');
const { URL } = require('url');

function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', trecho => { corpo += trecho; });
    req.on('end', () => {
      if (!corpo) return resolve(null);
      try {
        resolve(JSON.parse(corpo));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on('error', reject);
  });
}

function responderJson(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(corpo);
}

// `repositorio` é o objeto devolvido por db.js (criarRepositorio), já
// aberto contra o arquivo SQLite deste computador.
function criarServidor(repositorio) {
  const servidor = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        responderJson(res, 204, null);
        return;
      }

      const url = new URL(req.url, 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/registros') {
        const porColecao = repositorio.loadTudo();
        const linhas = [];
        Object.keys(porColecao).forEach(colecao => {
          porColecao[colecao].forEach(dados => linhas.push({ colecao, dados }));
        });
        responderJson(res, 200, linhas);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/status') {
        responderJson(res, 200, { ok: true });
        return;
      }

      const correspondePost = req.method === 'POST' && url.pathname.match(/^\/registros\/([^/]+)$/);
      if (correspondePost) {
        const colecao = decodeURIComponent(correspondePost[1]);
        const lista = await lerCorpoJson(req);
        if (!Array.isArray(lista)) {
          responderJson(res, 400, { erro: 'Corpo deve ser um array com a coleção inteira.' });
          return;
        }
        repositorio.saveColecao(colecao, lista);
        responderJson(res, 200, { ok: true });
        return;
      }

      responderJson(res, 404, { erro: 'Rota não encontrada.' });
    } catch (erro) {
      responderJson(res, 500, { erro: String(erro && erro.message || erro) });
    }
  });

  return {
    iniciar(porta, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        servidor.once('error', reject);
        servidor.listen(porta, host, () => resolve(servidor));
      });
    },
    parar() {
      return new Promise(resolve => servidor.close(resolve));
    },
    _servidor: servidor,
  };
}

module.exports = { criarServidor };
