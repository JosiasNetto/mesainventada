// Onde a IA entra: prompts, chamada à OpenRouter (chave da própria pessoa) e avisos de falha.

export const MODELO_PADRAO = 'nvidia/nemotron-3.5-super-vl:free';
// Modelos grátis saturam ou somem sem aviso; a OpenRouter tenta estes, em ordem, se o escolhido falhar.
// ponytail: lista fixa de 3 (limite seguro da API); revisar os ":free" disponíveis antes de cada entrega.
const RESERVAS = ['openrouter/free', 'google/gemma-4-31b-it:free'];
const URL_API = 'https://openrouter.ai/api/v1/chat/completions';
const LIMITE_TURNO = { facil: 3, medio: 5 };

// A OpenRouter só mostra a chave inteira na criação; a lista de chaves mostra um pedaço ("sk-or-v1-a1b...9f2").
export const chaveValida = chave => /^sk-or-v1-[A-Za-z0-9]{32,}$/.test(String(chave ?? ''));
export const AVISO_CHAVE = 'Essa não parece uma chave completa da OpenRouter. Ela começa com "sk-or-v1-" e tem mais de 70 caracteres. '
  + 'O site só mostra a chave inteira uma vez, na hora de criar: se você copiou da lista de chaves, crie uma nova em openrouter.ai/keys e copie pelo botão de copiar.';

function sistema(entrada) {
  const limite = LIMITE_TURNO[entrada.dificuldade] ?? 5;
  return `Você é co-designer de jogos de cartas curtos na ferramenta MesaInventada.
Você propõe um protótipo revisável, não um jogo final equilibrado.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
{"titulo":"","objetivo":"","preparacao":[""],"turno":[""],"fim":"","cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":""}
Regras:
- Português do Brasil, frases curtas e concretas.
- Use só os materiais disponíveis. As cartas são de papel e só têm texto, sem imagens.
- "turno": no máximo ${limite} passos.
- "cartas": de 4 a 12 tipos; "texto" com até 120 caracteres; soma das "quantidade" até 54.
- "rodada": 3 a 6 passos simulando uma rodada de teste, com jogadores nomeados e valores concretos (ex.: "Ana rola o dado: 2").
- "provocacao": uma pergunta que desafia uma suposição deste jogo (ex.: precisa haver um vencedor?).`;
}

export function promptKit(entrada, mecanicas) {
  const { tema, jogadores, duracao, materiais, dificuldade } = entrada;
  const cabecalho = mecanicas.length > 1
    ? 'Mecânicas escolhidas (combine as duas num só jogo):'
    : 'Mecânica escolhida (construa o jogo em torno dela):';
  const user = [
    `Tema: ${tema}`,
    `${jogadores} jogadores · ${duracao} minutos · dificuldade ${dificuldade === 'medio' ? 'médio' : 'fácil'}`,
    `Materiais disponíveis: ${materiais.join(', ')}`,
    cabecalho,
    ...mecanicas.map(m => `- ${m.nome}: ${m.descricao}`),
  ].join('\n');
  return [{ role: 'system', content: sistema(entrada) }, { role: 'user', content: user }];
}

export function promptRevisao(entrada, kit, relato, avisos) {
  const user = [
    `Kit atual: ${JSON.stringify(kit)}`,
    `O que aconteceu no teste: ${relato}`,
    `Problemas apontados pelas travas: ${avisos.join('; ') || 'nenhum'}`,
    'Revise o kit para resolver isso, mudando o mínimo necessário. Devolva o kit completo no mesmo formato e acrescente "mudancas": ["o que mudou e por quê"].',
  ].join('\n');
  return [{ role: 'system', content: sistema(entrada) }, { role: 'user', content: user }];
}

export function extrairJSON(texto) {
  const s = String(texto ?? '').replace(/```(json)?/g, '');
  try {
    return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  } catch {
    throw new Error('A IA respondeu em um formato inesperado. Clique em CRIAR JOGO de novo ou troque o modelo em ⚙ Configurar.');
  }
}

export function mensagemDeErro(status) {
  if (status === 401) return 'Chave inválida ou ausente. Abra ⚙ Configurar e cole sua chave da OpenRouter (openrouter.ai/keys).';
  if (status === 402) return 'Sua conta OpenRouter está sem créditos para este modelo. Use um modelo terminado em ":free".';
  if (status === 404) return 'Modelo não encontrado. Em ⚙ Configurar, use "openrouter/free" ou outro modelo ":free".';
  if (status === 429) return 'Limite de pedidos atingido (modelos grátis têm limite por minuto e por dia). Espere um minuto e tente de novo.';
  if (status >= 500) return 'O provedor do modelo está fora do ar agora. Tente de novo em instantes ou troque o modelo.';
  return `Erro inesperado (${status}). Tente de novo.`;
}

export async function chamarLLM({ chave, modelo, mensagens, semente }) {
  const models = [...new Set([modelo, MODELO_PADRAO, ...RESERVAS])].slice(0, 3);
  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ models, messages: mensagens, seed: semente, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('A IA demorou mais de 90 segundos. Tente de novo ou troque o modelo em ⚙ Configurar.');
    throw new Error('Sem conexão com a OpenRouter. Verifique a internet e tente de novo.');
  }
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (OpenRouter: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  return extrairJSON(dados.choices?.[0]?.message?.content);
}
