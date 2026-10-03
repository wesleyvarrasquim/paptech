// Atualização da TELA do PAPTECH Desktop (o arquivo renderer/index.html),
// direto do GitHub — sem precisar gerar e instalar um novo .exe a cada
// pequena mudança de tela/regra de negócio.
//
// Como funciona: a tela que o programa realmente abre não é mais o
// renderer/index.html de dentro da pasta de instalação (que fica somente
// leitura depois de empacotado), e sim uma CÓPIA dele guardada na pasta de
// dados do usuário (userData). Essa cópia é criada na primeira vez que o
// programa abre; depois disso, "verificar atualização" compara a versão
// instalada com a versão publicada no repositório (arquivo version.json) e,
// se houver uma mais nova, baixa o renderer/index.html atualizado e
// sobrescreve essa cópia.
//
// Isso precisa de internet só no momento de checar/baixar a atualização —
// o funcionamento normal do dia a dia (banco local + rede local) continua
// sem depender disso.

const fs = require('fs');
const path = require('path');

const URL_VERSION_JSON = 'https://raw.githubusercontent.com/wesleyvarrasquim/paptech/main/desktop/version.json';
const URL_RENDERER_HTML = 'https://raw.githubusercontent.com/wesleyvarrasquim/paptech/main/desktop/renderer/index.html';

function caminhoMeta(userDataDir) {
  return path.join(userDataDir, 'atualizacao-meta.json');
}

function caminhoRendererAtivo(userDataDir) {
  return path.join(userDataDir, 'renderer', 'index.html');
}

function lerMeta(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(caminhoMeta(userDataDir), 'utf-8'));
  } catch (erro) {
    return { versaoInstalada: '0.0.0' };
  }
}

function salvarMeta(userDataDir, meta) {
  fs.writeFileSync(caminhoMeta(userDataDir), JSON.stringify(meta, null, 2), 'utf-8');
}

// Compara duas versões "1.2.3": devolve -1 se a < b, 0 se iguais, 1 se a > b.
function compararVersoes(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const tamanho = Math.max(pa.length, pb.length);
  for (let i = 0; i < tamanho; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

// Roda uma vez, ao abrir o programa: garante que existe uma cópia do
// renderer dentro de userData (na primeira execução, copia a que veio
// junto com o instalador) e que há um registro de qual versão está ativa.
function garantirRendererInicial(userDataDir, rendererOriginalPath, versionJsonOriginalPath) {
  const ativo = caminhoRendererAtivo(userDataDir);
  fs.mkdirSync(path.dirname(ativo), { recursive: true });
  if (!fs.existsSync(ativo)) {
    fs.copyFileSync(rendererOriginalPath, ativo);
  }

  const meta = lerMeta(userDataDir);
  if (!meta.versaoInstalada || meta.versaoInstalada === '0.0.0') {
    try {
      const versaoEmpacotada = JSON.parse(fs.readFileSync(versionJsonOriginalPath, 'utf-8'));
      meta.versaoInstalada = versaoEmpacotada.versao || '1.0.0';
    } catch (erro) {
      meta.versaoInstalada = '1.0.0';
    }
    salvarMeta(userDataDir, meta);
  }
  return meta.versaoInstalada;
}

async function verificarAtualizacao(userDataDir) {
  const meta = lerMeta(userDataDir);
  const resposta = await fetch(URL_VERSION_JSON, { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Não foi possível consultar a versão mais recente (status ${resposta.status}).`);
  const remoto = await resposta.json();

  return {
    versaoInstalada: meta.versaoInstalada || '0.0.0',
    versaoRemota: remoto.versao,
    notas: remoto.notas || '',
    data: remoto.data || '',
    disponivel: compararVersoes(meta.versaoInstalada, remoto.versao) < 0,
  };
}

async function instalarAtualizacao(userDataDir) {
  const resposta = await fetch(URL_RENDERER_HTML, { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Não foi possível baixar a atualização (status ${resposta.status}).`);
  const html = await resposta.text();
  if (!html || html.length < 1000) {
    // Proteção simples: um HTML da tela do PAPTECH tem milhares de linhas;
    // se vier muito pequeno, algo deu errado (página de erro, redirecionamento etc).
    throw new Error('O conteúdo baixado parece inválido/incompleto — atualização cancelada por segurança.');
  }

  const respostaVersao = await fetch(URL_VERSION_JSON, { cache: 'no-store' });
  const remoto = respostaVersao.ok ? await respostaVersao.json() : null;

  fs.writeFileSync(caminhoRendererAtivo(userDataDir), html, 'utf-8');

  const meta = lerMeta(userDataDir);
  meta.versaoInstalada = remoto ? remoto.versao : meta.versaoInstalada;
  meta.atualizadoEm = new Date().toISOString();
  salvarMeta(userDataDir, meta);

  return { ok: true, versao: meta.versaoInstalada };
}

module.exports = {
  caminhoRendererAtivo,
  garantirRendererInicial,
  verificarAtualizacao,
  instalarAtualizacao,
  compararVersoes,
};
