// Preload do Electron: a única ponte entre a tela (renderer/index.html,
// que é basicamente o PAPTECH que já existe) e o processo principal
// (main.js), que é quem fala com o SQLite de verdade.
//
// Expõe duas APIs globais na tela:
//   window.dbAPI   -> banco de dados local (síncrono, substitui localStorage)
//   window.redeAPI -> configuração e status do modo de rede (Servidor/Cliente)

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dbAPI', {
  // Síncrono de propósito: o PAPTECH chama loadList/saveList em ~100
  // lugares esperando um valor imediato (como localStorage sempre foi),
  // então usamos ipcRenderer.sendSync em vez de invoke/promises, pra não
  // precisar reescrever cada chamada existente para async/await.
  loadList(chave) {
    return ipcRenderer.sendSync('db-load', chave);
  },
  saveList(chave, lista) {
    return ipcRenderer.sendSync('db-save', chave, lista);
  },
});

contextBridge.exposeInMainWorld('updateAPI', {
  // Busca/aplica atualizações da TELA do sistema direto do GitHub (ver
  // src/atualizador.js) — usa internet só nesse momento, não no dia a dia.
  verificar() {
    return ipcRenderer.invoke('update-verificar');
  },
  instalar() {
    return ipcRenderer.invoke('update-instalar');
  },
  reiniciar() {
    ipcRenderer.send('update-reiniciar');
  },
});

contextBridge.exposeInMainWorld('redeAPI', {
  obterConfig() {
    return ipcRenderer.sendSync('rede-obter-config');
  },
  salvarConfig(config) {
    return ipcRenderer.sendSync('rede-salvar-config', config);
  },
  // Essas duas são de rede real (outro computador), então ficam async.
  buscarTudoDoServidor(baseUrl) {
    return ipcRenderer.invoke('rede-buscar-tudo', baseUrl);
  },
  enviarColecaoParaServidor(baseUrl, colecao, lista) {
    return ipcRenderer.invoke('rede-enviar-colecao', baseUrl, colecao, lista);
  },
});
