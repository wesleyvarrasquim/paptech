// Camada de banco de dados local (SQLite) do PAPTECH Desktop.
//
// Guarda tudo numa única tabela genérica "registros" (colecao + registro_id
// + dados em JSON), igual ao desenho já usado na versão web com Supabase —
// evita redesenhar esquema de tabela toda vez que um cadastro ganha um
// campo novo. Cada coleção (produtos, clientes, vendas, etc.) é só um
// filtro por "colecao" dentro dessa mesma tabela.
//
// Pensado para ser usado tanto pelo processo principal do Electron (via
// IPC síncrono, ver main.js/preload.js) quanto pelo servidor de rede
// (servidorRede.js) e por testes isolados em Node puro (sem Electron).

const path = require('path');
const Database = require('better-sqlite3');

function abrirBanco(caminhoArquivo) {
  const db = new Database(caminhoArquivo);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS registros (
      colecao TEXT NOT NULL,
      registro_id INTEGER NOT NULL,
      dados TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (colecao, registro_id)
    );
  `);
  return db;
}

function criarRepositorio(caminhoArquivo) {
  const db = abrirBanco(caminhoArquivo);

  const stmtSelecionar = db.prepare('SELECT dados FROM registros WHERE colecao = ? ORDER BY registro_id');
  const stmtSelecionarTudo = db.prepare('SELECT colecao, dados FROM registros');
  const stmtUpsert = db.prepare(`
    INSERT INTO registros (colecao, registro_id, dados, atualizado_em)
    VALUES (@colecao, @registro_id, @dados, @atualizado_em)
    ON CONFLICT(colecao, registro_id) DO UPDATE SET
      dados = excluded.dados,
      atualizado_em = excluded.atualizado_em
  `);
  const stmtIdsExistentes = db.prepare('SELECT registro_id FROM registros WHERE colecao = ?');
  const stmtApagarUm = db.prepare('DELETE FROM registros WHERE colecao = ? AND registro_id = ?');

  function loadColecao(colecao) {
    const linhas = stmtSelecionar.all(colecao);
    return linhas.map(linha => JSON.parse(linha.dados));
  }

  function loadTudo() {
    const linhas = stmtSelecionarTudo.all();
    const porColecao = {};
    linhas.forEach(linha => {
      if (!porColecao[linha.colecao]) porColecao[linha.colecao] = [];
      porColecao[linha.colecao].push(JSON.parse(linha.dados));
    });
    return porColecao;
  }

  // Substitui o conteúdo inteiro de uma coleção pela lista recebida:
  // grava/atualiza cada item presente e apaga quem não está mais na lista
  // — o mesmo padrão de "substituir o array inteiro" usado no resto do app.
  const salvarColecaoTransacao = db.transaction((colecao, lista) => {
    const idsAtuais = new Set(
      lista.filter(item => item && item.id != null).map(item => item.id)
    );
    const idsExistentes = stmtIdsExistentes.all(colecao).map(linha => linha.registro_id);
    idsExistentes.forEach(id => {
      if (!idsAtuais.has(id)) stmtApagarUm.run(colecao, id);
    });

    const agora = new Date().toISOString();
    lista.forEach(item => {
      if (!item || item.id == null) return;
      stmtUpsert.run({
        colecao,
        registro_id: item.id,
        dados: JSON.stringify(item),
        atualizado_em: agora,
      });
    });
  });

  function saveColecao(colecao, lista) {
    salvarColecaoTransacao(colecao, lista || []);
    return true;
  }

  function fechar() {
    db.close();
  }

  return { loadColecao, saveColecao, loadTudo, fechar, _db: db };
}

function caminhoPadrao(diretorioDados) {
  return path.join(diretorioDados, 'paptech.sqlite3');
}

module.exports = { criarRepositorio, caminhoPadrao };
