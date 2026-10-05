// PAPTECH — intermediário de NF-e (Supabase Edge Function "focus-nfe")
//
// O navegador não pode chamar a API da Focus NFe direto (bloqueio de CORS) e o
// token da Focus não deve ficar no código da página. Esta função recebe os
// pedidos do PAPTECH, confere a chave do intermediário e repassa para a Focus
// NFe usando o token guardado nos "Secrets" do Supabase.
//
// Secrets necessários (Supabase → Edge Functions → Secrets):
//   PAPTECH_CHAVE_NFE        senha que você inventa; a mesma é digitada em
//                            Configurações → Nota Fiscal Eletrônica em cada computador
//   FOCUS_TOKEN_HOMOLOGACAO  token de homologação (testes) do painel da Focus NFe
//   FOCUS_TOKEN_PRODUCAO     token de produção do painel da Focus NFe

const BASES: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-ambiente, x-paptech-chave",
};

// Só libera as rotas de NF-e e NFC-e (emitir, consultar, cancelar, carta de correção).
const ROTA_PERMITIDA = /^\/v2\/nfce?(\/[A-Za-z0-9_.-]+(\/carta_correcao)?)?$/;
// Cadastro de empresa na Focus (usado só para enviar o certificado digital; nada fica guardado no PAPTECH).
const ROTA_EMPRESAS = /^\/v2\/empresas(\/[A-Za-z0-9_.-]+)?$/;

function json(status: number, dados: unknown) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const inicio = url.pathname.indexOf("/v2/");
  const caminho = inicio >= 0 ? url.pathname.slice(inicio) : "";
  const ehEmpresas = ROTA_EMPRESAS.test(caminho);
  if (!ROTA_PERMITIDA.test(caminho) && !(ehEmpresas && ["GET", "PUT"].includes(req.method))) {
    return json(400, { erro: "rota_invalida", mensagem: "Rota não permitida pelo intermediário." });
  }
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) {
    return json(405, { erro: "metodo_invalido", mensagem: "Método não permitido." });
  }

  const chaveEsperada = Deno.env.get("PAPTECH_CHAVE_NFE") || "";
  const chaveRecebida = req.headers.get("x-paptech-chave") || "";
  if (!chaveEsperada || !iguais(chaveRecebida, chaveEsperada)) {
    return json(401, {
      erro: "chave_intermediario_invalida",
      mensagem: "Chave do intermediário inválida (confira PAPTECH_CHAVE_NFE no Supabase e a chave digitada nas Configurações).",
    });
  }

  const ambiente = req.headers.get("x-ambiente") === "producao" ? "producao" : "homologacao";
  // O cadastro de empresas costuma exigir o "token principal" da conta (opcional: FOCUS_TOKEN_PRINCIPAL_*).
  const nomeToken = ehEmpresas && Deno.env.get(ambiente === "producao" ? "FOCUS_TOKEN_PRINCIPAL_PRODUCAO" : "FOCUS_TOKEN_PRINCIPAL_HOMOLOGACAO")
    ? (ambiente === "producao" ? "FOCUS_TOKEN_PRINCIPAL_PRODUCAO" : "FOCUS_TOKEN_PRINCIPAL_HOMOLOGACAO")
    : (ambiente === "producao" ? "FOCUS_TOKEN_PRODUCAO" : "FOCUS_TOKEN_HOMOLOGACAO");
  const token = Deno.env.get(nomeToken);
  if (!token) {
    return json(500, {
      erro: "token_ausente",
      mensagem: `Token da Focus NFe de ${ambiente} não configurado nos Secrets do Supabase.`,
    });
  }

  const corpo = req.method === "GET" ? undefined : await req.text();
  try {
    const resposta = await fetch(BASES[ambiente] + caminho + url.search, {
      method: req.method,
      headers: {
        Authorization: "Basic " + btoa(token + ":"),
        "Content-Type": "application/json",
      },
      body: corpo || undefined,
    });
    const texto = await resposta.text();
    return new Response(texto, {
      status: resposta.status,
      headers: { ...CORS, "Content-Type": resposta.headers.get("content-type") || "application/json" },
    });
  } catch (erro) {
    return json(502, { erro: "focus_indisponivel", mensagem: "Não foi possível falar com a Focus NFe: " + String(erro) });
  }
});
