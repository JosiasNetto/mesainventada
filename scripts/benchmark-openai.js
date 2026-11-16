// Mede tempo, tokens e custo de modelos de texto e imagem da OpenAI com os prompts reais da MesaInventada.
// Uso: node scripts/benchmark-openai.js [repeticoesTexto]
// A chave vem de OPENAI_API_KEY no ambiente ou num arquivo .env na raiz do projeto (OPENAI_API_KEY=sk-...).
// Saída: tabela no terminal + JSON em scripts/resultados-benchmark-openai.json
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promptKit, promptImagemCarta, extrairJSON } from '../src/ia.js';
import { catalogo } from '../src/mecanicas.js';
import { COTACAO_BRL_PADRAO } from '../src/custos.js';

const ARQUIVO_ENV = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.OPENAI_API_KEY && existsSync(ARQUIVO_ENV)) process.loadEnvFile(ARQUIVO_ENV);
const CHAVE = process.env.OPENAI_API_KEY;
const REPETICOES = Number(process.argv[2]) || 2;
const API = 'https://api.openai.com/v1';

// Preços de tabela da OpenAI em US$ por 1M de tokens (a API não devolve custo; conferir em openai.com/api/pricing).
const PRECO_TEXTO = {
  'gpt-4o-mini': [0.15, 0.60],
  'gpt-4o': [2.50, 10.00],
  'gpt-4.1-nano': [0.10, 0.40],
  'gpt-4.1-mini': [0.40, 1.60],
  'gpt-4.1': [2.00, 8.00],
  'gpt-5-nano': [0.05, 0.40],
  'gpt-5-mini': [0.25, 2.00],
  'gpt-5': [1.25, 10.00],
  'o4-mini': [1.10, 4.40],
};
// gpt-image-*: [entrada de texto, saída de imagem] por 1M de tokens; dall-e-*: preço fixo por imagem.
const PRECO_IMAGEM_TOKENS = {
  'gpt-image-1-mini': [2.00, 8.00],
  'gpt-image-1': [5.00, 40.00],
};
const PRECO_IMAGEM_FIXO = {
  'dall-e-3:standard:1024x1024': 0.040,
  'dall-e-2:standard:512x512': 0.018,
};

const CASOS_IMAGEM = [
  { modelo: 'gpt-image-1-mini', quality: 'low', size: '1024x1024' },
  { modelo: 'gpt-image-1-mini', quality: 'medium', size: '1024x1024' },
  { modelo: 'gpt-image-1', quality: 'low', size: '1024x1024' },
  { modelo: 'gpt-image-1', quality: 'medium', size: '1024x1024' },
  { modelo: 'dall-e-3', quality: 'standard', size: '1024x1024' },
  { modelo: 'dall-e-2', quality: 'standard', size: '512x512' },
];

const entrada = {
  tema: 'Exploradores de um mercado flutuante numa cidade alagada',
  jogadores: 4, duracao: 20, materiais: ['papel', 'caneta', 'dado'],
  dificuldade: 'medio', formato: 'cartas', modoCriacao: 'guiado',
};
const mecanicas = catalogo.filter(m => ['colecao-conjuntos', 'gestao-recursos'].includes(m.id));
const carta = { nome: 'Barqueiro Astuto', texto: 'Troque 1 carta da sua mão com a pilha do mercado.' };
const kitRef = { titulo: 'Mercado das Marés' };

async function post(caminho, corpo) {
  const inicio = performance.now();
  const res = await fetch(`${API}${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(180_000),
  });
  const dados = await res.json().catch(() => ({}));
  const ms = performance.now() - inicio;
  if (!res.ok) throw new Error(`${res.status} ${dados.error?.message ?? ''}`.trim());
  return { dados, ms };
}

async function modelosDisponiveis() {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${CHAVE}` } });
  if (!res.ok) throw new Error(`Falha ao listar modelos: ${res.status}`);
  return new Set((await res.json()).data.map(m => m.id));
}

async function medirTexto(modelo) {
  const execucoes = [];
  for (let i = 0; i < REPETICOES; i++) {
    try {
      const { dados, ms } = await post('/chat/completions', {
        model: modelo, messages: promptKit(entrada, mecanicas), response_format: { type: 'json_object' },
      });
      const u = dados.usage ?? {};
      const [pIn, pOut] = PRECO_TEXTO[modelo];
      const kit = extrairJSON(dados.choices?.[0]?.message?.content);
      execucoes.push({
        ms, prompt: u.prompt_tokens, completion: u.completion_tokens,
        raciocinio: u.completion_tokens_details?.reasoning_tokens ?? 0,
        custoUsd: (u.prompt_tokens * pIn + u.completion_tokens * pOut) / 1e6,
        tiposCarta: Array.isArray(kit.cartas) ? kit.cartas.length : 0,
      });
    } catch (e) {
      execucoes.push({ erro: e.message });
    }
  }
  return { tipo: 'texto', modelo, execucoes };
}

async function medirImagem({ modelo, quality, size }) {
  const ehGptImage = modelo.startsWith('gpt-image');
  const corpo = {
    model: modelo, prompt: promptImagemCarta(carta, kitRef, entrada)[0].content, size, n: 1,
    ...(ehGptImage ? { quality, output_format: 'jpeg' } : { response_format: 'b64_json' }),
    ...(modelo === 'dall-e-3' ? { quality } : {}),
  };
  try {
    const { dados, ms } = await post('/images/generations', corpo);
    const u = dados.usage ?? {};
    const custoUsd = ehGptImage
      ? ((u.input_tokens ?? 0) * PRECO_IMAGEM_TOKENS[modelo][0] + (u.output_tokens ?? 0) * PRECO_IMAGEM_TOKENS[modelo][1]) / 1e6
      : PRECO_IMAGEM_FIXO[`${modelo}:${quality}:${size}`];
    const b64 = dados.data?.[0]?.b64_json ?? '';
    return {
      tipo: 'imagem', modelo, quality, size,
      execucoes: [{ ms, entrada: u.input_tokens ?? null, saida: u.output_tokens ?? null, custoUsd, kb: Math.round(b64.length * 0.75 / 1024) }],
    };
  } catch (e) {
    return { tipo: 'imagem', modelo, quality, size, execucoes: [{ erro: e.message }] };
  }
}

const media = (lista, campo) => lista.reduce((s, x) => s + x[campo], 0) / lista.length;

function resumir(r) {
  const ok = r.execucoes.filter(x => !x.erro);
  if (!ok.length) return { ...r, erro: r.execucoes[0]?.erro };
  const tempos = ok.map(x => x.ms);
  return {
    ...r, ok: ok.length,
    msMedio: media(ok, 'ms'), msMin: Math.min(...tempos), msMax: Math.max(...tempos),
    custoMedioUsd: media(ok, 'custoUsd'),
    custoMedioBrl: media(ok, 'custoUsd') * COTACAO_BRL_PADRAO,
  };
}

if (!CHAVE) {
  console.error('Defina OPENAI_API_KEY no ambiente ou crie um arquivo .env na raiz com OPENAI_API_KEY=sk-...');
  process.exit(1);
}

const disponiveis = await modelosDisponiveis();
const textos = Object.keys(PRECO_TEXTO).filter(m => disponiveis.has(m));
const imagens = CASOS_IMAGEM.filter(c => disponiveis.has(c.modelo));
console.log(`Texto: ${textos.join(', ')}\nImagem: ${[...new Set(imagens.map(c => c.modelo))].join(', ')}\n`);

// Texto em paralelo entre modelos (sequencial dentro de cada um); imagens em sequência para não somar latências de fila.
const resultadosTexto = await Promise.all(textos.map(medirTexto));
const resultadosImagem = [];
for (const caso of imagens) resultadosImagem.push(await medirImagem(caso));

const resumo = [...resultadosTexto, ...resultadosImagem].map(resumir);
for (const r of resumo) {
  const nome = r.tipo === 'imagem' ? `${r.modelo} (${r.quality}, ${r.size})` : r.modelo;
  console.log(r.erro
    ? `${nome}: ERRO ${r.erro}`
    : `${nome}: ${(r.msMedio / 1000).toFixed(2)} s (${(r.msMin / 1000).toFixed(2)}-${(r.msMax / 1000).toFixed(2)}) · US$ ${r.custoMedioUsd.toFixed(5)}`);
}
writeFileSync(new URL('./resultados-benchmark-openai.json', import.meta.url),
  JSON.stringify({ data: new Date().toISOString(), repeticoesTexto: REPETICOES, entrada, resumo }, null, 2));
