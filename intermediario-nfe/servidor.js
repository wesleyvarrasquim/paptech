#!/usr/bin/env node
/*
 * PAPTECH — intermediário de NF-e para rodar num computador da loja
 * (alternativa à Edge Function do Supabase). Não precisa instalar nada além
 * do Node.js 18 ou mais novo.
 *
 * Como usar (no computador que vai ficar ligado):
 *   1. Copie o arquivo "config-exemplo.json" para "config.json" (nesta mesma pasta)
 *      e preencha a chave do intermediário e os tokens da Focus NFe.
 *   2. Rode:  node servidor.js
 *   3. No PAPTECH, em Configurações → Nota Fiscal Eletrônica, escolha
 *      "URL própria" e informe  http://IP-DESTE-COMPUTADOR:8787
 *
 * As mesmas opções também podem vir de variáveis de ambiente:
 *   PAPTECH_CHAVE_NFE, FOCUS_TOKEN_HOMOLOGACAO, FOCUS_TOKEN_PRODUCAO, PORTA
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

let arquivoConfig = {};
const caminhoConfig = path.join(__dirname, 'config.json');
if (fs.existsSync(caminhoConfig)) {
  arquivoConfig = JSON.parse(fs.readFileSync(caminhoConfig, 'utf8'));
}
const opcao = (nome, padrao = '') => process.env[nome] || arquivoConfig[nome] || padrao;

const PORTA = Number(opcao('PORTA', '8787'));
const CHAVE = opcao('PAPTECH_CHAVE_NFE');
const TOKENS = {
  homologacao: opcao('FOCUS_TOKEN_HOMOLOGACAO'),
  producao: opcao('FOCUS_TOKEN_PRODUCAO'),
};
const BASES = {
  homologacao: opcao('FOCUS_BASE_HOMOLOGACAO', 'https://homologacao.focusnfe.com.br'),
  producao: opcao('FOCUS_BASE_PRODUCAO', 'https://api.focusnfe.com.br'),
};

const ROTA_PERMITIDA = /^\/v2\/nfce?(\/[A-Za-z0-9_.-]+(\/carta_correcao)?)?$/;
// Cadastro de empresa na Focus (só para enviar o certificado digital; nada fica guardado no PAPTECH).
const ROTA_EMPRESAS = /^\/v2\/empresas(\/[A-Za-z0-9_.-]+)?$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-ambiente, x-paptech-chave',
};

function responderJson(res, status, dados) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on('data', p => partes.push(p));
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

if (!CHAVE) {
  console.error('Defina PAPTECH_CHAVE_NFE (em config.json ou variável de ambiente) antes de iniciar.');
  process.exit(1);
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');
  const inicio = url.pathname.indexOf('/v2/');
  const caminho = inicio >= 0 ? url.pathname.slice(inicio) : '';
  const ehEmpresas = ROTA_EMPRESAS.test(caminho);
  if (!ROTA_PERMITIDA.test(caminho) && !(ehEmpresas && ['GET', 'PUT'].includes(req.method))) return responderJson(res, 400, { erro: 'rota_invalida', mensagem: 'Rota não permitida pelo intermediário.' });
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return responderJson(res, 405, { erro: 'metodo_invalido', mensagem: 'Método não permitido.' });
  if (req.headers['x-paptech-chave'] !== CHAVE) {
    return responderJson(res, 401, { erro: 'chave_intermediario_invalida', mensagem: 'Chave do intermediário inválida.' });
  }

  const ambiente = req.headers['x-ambiente'] === 'producao' ? 'producao' : 'homologacao';
  // O cadastro de empresas costuma exigir o "token principal" da conta (opcional: FOCUS_TOKEN_PRINCIPAL_*).
  const tokenPrincipal = opcao(ambiente === 'producao' ? 'FOCUS_TOKEN_PRINCIPAL_PRODUCAO' : 'FOCUS_TOKEN_PRINCIPAL_HOMOLOGACAO');
  const token = ehEmpresas && tokenPrincipal ? tokenPrincipal : TOKENS[ambiente];
  if (!token) return responderJson(res, 500, { erro: 'token_ausente', mensagem: `Token da Focus NFe de ${ambiente} não configurado no intermediário.` });

  try {
    const corpo = req.method === 'GET' ? undefined : await lerCorpo(req);
    const resposta = await fetch(BASES[ambiente] + caminho + url.search, {
      method: req.method,
      headers: { Authorization: 'Basic ' + Buffer.from(token + ':').toString('base64'), 'Content-Type': 'application/json' },
      body: corpo || undefined,
    });
    const texto = await resposta.text();
    res.writeHead(resposta.status, { ...CORS, 'Content-Type': resposta.headers.get('content-type') || 'application/json' });
    res.end(texto);
    console.log(new Date().toLocaleString('pt-BR'), req.method, caminho, ambiente, '→', resposta.status);
  } catch (erro) {
    responderJson(res, 502, { erro: 'focus_indisponivel', mensagem: 'Não foi possível falar com a Focus NFe: ' + erro.message });
  }
}).listen(PORTA, '0.0.0.0', () => {
  console.log(`Intermediário de NF-e do PAPTECH rodando na porta ${PORTA}.`);
});
