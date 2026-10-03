// Processo principal do PAPTECH Desktop (Electron).
//
// Responsável por: abrir a janela do programa, manter o banco de dados
// local (SQLite, via src/db.js), responder os pedidos de leitura/escrita
// que vêm da tela (preload.js) e, quando configurado como "Servidor",
// ligar o servidor de rede local (src/servidorRede.js) para que outros
// computadores da mesma rede consigam ler/escrever nos mesmos dados.

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');
const { criarRepositorio, caminhoPadrao } = require('./src/db');
const { criarServidor } = require('./src/servidorRede');

const PORTA_REDE_PADRAO = 3344;

let janelaPrincipal = null;
let repositorio = null;
let servidorRede = null;

function caminhoConfigRede() {
  return path.join(app.getPath('userData'), 'config-rede.json');
}

function obterConfigRede() {
  try {
    const bruto = fs.readFileSync(caminhoConfigRede(), 'utf-8');
    const config = JSON.parse(bruto);
    return {
      modo: config.modo || 'sozinho', // 'sozinho' | 'servidor' | 'cliente'
      porta: config.porta || PORTA_REDE_PADRAO,
      servidorIp: config.servidorIp || '',
      servidorPorta: config.servidorPorta || PORTA_REDE_PADRAO,
    };
  } catch (erro) {
    return { modo: 'sozinho', porta: PORTA_REDE_PADRAO, servidorIp: '', servidorPorta: PORTA_REDE_PADRAO };
  }
}

function salvarConfigRede(config) {
  const atual = obterConfigRede();
  const novo = { ...atual, ...config };
  fs.writeFileSync(caminhoConfigRede(), JSON.stringify(novo, null, 2), 'utf-8');
  aplicarModoRede(novo);
  return novo;
}

async function aplicarModoRede(config) {
  if (servidorRede) {
    await servidorRede.parar().catch(() => {});
    servidorRede = null;
  }
  if (config.modo === 'servidor') {
    servidorRede = criarServidor(repositorio);
    try {
      await servidorRede.iniciar(config.porta || PORTA_REDE_PADRAO);
    } catch (erro) {
      console.error('Não foi possível iniciar o servidor de rede:', erro);
      servidorRede = null;
    }
  }
}

function registrarIpc() {
  ipcMain.on('db-load', (event, chave) => {
    event.returnValue = repositorio.loadColecao(chave);
  });

  ipcMain.on('db-save', (event, chave, lista) => {
    event.returnValue = repositorio.saveColecao(chave, lista);
  });

  ipcMain.on('rede-obter-config', event => {
    event.returnValue = obterConfigRede();
  });

  ipcMain.on('rede-salvar-config', (event, config) => {
    event.returnValue = salvarConfigRede(config);
    // aplicarModoRede é assíncrono; não precisamos esperar aqui porque o
    // próprio retorno síncrono já reflete a configuração salva, e o
    // servidor sobe/desce em segundo plano.
  });

  ipcMain.handle('rede-buscar-tudo', async (event, baseUrl) => {
    const resposta = await fetch(`${baseUrl}/registros`);
    if (!resposta.ok) throw new Error(`Servidor respondeu ${resposta.status}`);
    return resposta.json();
  });

  ipcMain.handle('rede-enviar-colecao', async (event, baseUrl, colecao, lista) => {
    const resposta = await fetch(`${baseUrl}/registros/${encodeURIComponent(colecao)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lista),
    });
    if (!resposta.ok) throw new Error(`Servidor respondeu ${resposta.status}`);
    return resposta.json();
  });
}

function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // As telas de impressão do PAPTECH usam window.open(...) para abrir uma
  // janela com o pedido formatado e chamar .print() nela; permitimos que
  // o Electron abra essas janelas normalmente.
  janelaPrincipal.webContents.setWindowOpenHandler(() => ({ action: 'allow' }));

  janelaPrincipal.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  janelaPrincipal.setMenuBarVisibility(false);
}

app.whenReady().then(async () => {
  const caminhoDb = caminhoPadrao(app.getPath('userData'));
  repositorio = criarRepositorio(caminhoDb);
  registrarIpc();

  const configRede = obterConfigRede();
  await aplicarModoRede(configRede);

  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (repositorio) repositorio.fechar();
});
