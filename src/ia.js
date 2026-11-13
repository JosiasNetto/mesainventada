// Onde a IA entra: prompts, chamada à OpenRouter (chave da própria pessoa) e avisos de falha.
import { formatarReferenciaParaPrompt } from './referencias.js';
import { extrairMetricas } from './custos.js';

export const MODELO_PADRAO = 'nvidia/nemotron-3.5-super-vl:free';
// Modelos grátis saturam ou somem sem aviso; a OpenRouter tenta estes, em ordem, se o escolhido falhar.
// ponytail: lista fixa de 3 (limite seguro da API); revisar os ":free" disponíveis antes de cada entrega.
const RESERVAS = ['openrouter/free', 'google/gemma-4-31b-it:free'];
export const MODELO_IMAGEM_PADRAO = 'google/gemini-3.1-flash-lite-image';
const RESERVAS_IMAGEM = ['openai/gpt-5-image-mini', 'google/gemini-2.5-flash-image'];
const URL_API = 'https://openrouter.ai/api/v1/chat/completions';
const LIMITE_TURNO = { facil: 3, medio: 5 };

// A OpenRouter só mostra a chave inteira na criação; a lista de chaves mostra um pedaço ("sk-or-v1-a1b...9f2").
export const chaveValida = chave => /^sk-or-v1-[A-Za-z0-9]{32,}$/.test(String(chave ?? ''));
export const AVISO_CHAVE = 'Essa não parece uma chave completa da OpenRouter. Ela começa com "sk-or-v1-" e tem mais de 70 caracteres. '
  + 'O site só mostra a chave inteira uma vez, na hora de criar: se você copiou da lista de chaves, crie uma nova em openrouter.ai/keys e copie pelo botão de copiar.';

export function orientacaoJogadores(jogadores) {
  if (jogadores === 1) {
    return 'Modo solo (1 jogador): defina condição clara de vitória/derrota contra o baralho ou relógio, sem trocas nem ações entre jogadores.';
  }
  if (jogadores === 2) {
    return 'Para 2 jogadores: mantenha ritmo dinâmico em dupla, evitando regras de votação ou maioria que dependam de 3 ou mais pessoas.';
  }
  if (jogadores >= 6) {
    const maxMao = Math.max(2, Math.floor(42 / jogadores));
    return `Para ${jogadores} jogadores (mesa grande): distribua no máximo ${maxMao} cartas iniciais por pessoa para caber no baralho de até 54 cartas e evite turnos com espera longa.`;
  }
  return `Para ${jogadores} jogadores: garanta que a preparação e as cartas distribuídas caibam com folga no baralho de até 54 cartas.`;
}

function sistema(entrada) {
  const limite = LIMITE_TURNO[entrada.dificuldade] ?? 5;
  const jogadores = Number(entrada.jogadores) || 4;
  const regraRodada = jogadores === 1
    ? '- "rodada": 3 a 6 passos simulando uma rodada de teste solo com valores concretos (ex.: "Ana rola o dado: 2").'
    : `- "rodada": 3 a 6 passos simulando uma rodada de teste com jogadores nomeados coerentes com ${jogadores} participantes e valores concretos (ex.: "Ana rola o dado: 2").`;
  return `Você é co-designer de jogos de cartas curtos na ferramenta MesaInventada.
Você propõe um protótipo revisável, não um jogo final equilibrado.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
{"titulo":"","objetivo":"","preparacao":[""],"turno":[""],"fim":"","cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":""}
Regras:
- Português do Brasil, frases curtas e concretas.
- Use só os materiais disponíveis. As cartas são de papel e só têm texto, sem imagens.
- "turno": no máximo ${limite} passos.
- "cartas": de 4 a 12 tipos; "texto" com até 120 caracteres; soma das "quantidade" até 54.
${regraRodada}
- "provocacao": uma pergunta que desafia uma suposição deste jogo (ex.: precisa haver um vencedor?).`;
}

export function promptKit(entrada, mecanicas) {
  const { tema, jogadores, duracao, materiais, dificuldade } = entrada;
  const cabecalho = mecanicas.length > 1
    ? 'Mecânicas escolhidas (combine todas num só jogo):'
    : 'Mecânica escolhida (construa o jogo em torno dela):';
  const rotuloJogadores = `${jogadores} ${jogadores === 1 ? 'jogador' : 'jogadores'}`;
  const user = [
    `Tema: ${tema}`,
    `${rotuloJogadores} · ${duracao} minutos · dificuldade ${dificuldade === 'medio' ? 'médio' : 'fácil'}`,
    orientacaoJogadores(jogadores),
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

function sistemaNovasCartas(entrada, margemCartas) {
  const jogadores = Number(entrada.jogadores) || 4;
  return `Você é co-designer de jogos de cartas na ferramenta MesaInventada.
Sua tarefa é criar CARTAS NOVAS para um jogo existente, mantendo coerência com as regras e o estilo dele.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
{"cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":"","mudancas":[""]}
Regras:
- Português do Brasil, frases curtas e concretas.
- Use só os materiais disponíveis. As cartas são de papel e só têm texto, sem imagens.
- "cartas": de 1 a 6 tipos novos; "texto" com até 120 caracteres; soma das "quantidade" das cartas novas até ${margemCartas}.
- "rodada": 3 a 5 passos simulando uma rodada de teste para ${jogadores} ${jogadores === 1 ? 'jogador' : 'jogadores'} usando pelo menos uma das cartas novas.
- "mudancas": lista explicando o que cada carta nova acrescenta à dinâmica do jogo.
- "provocacao": uma pergunta que desafia uma suposição desta expansão.`;
}

export function promptComReferencias(entrada, mecanicas, { modo = 'novo', referencias = [] } = {}) {
  const refs = (referencias || []).filter(Boolean);
  if (modo === 'novo' || !refs.length) return promptKit(entrada, mecanicas);

  const { tema, jogadores, duracao, materiais, dificuldade } = entrada;
  const rotuloJogadores = `${jogadores} ${jogadores === 1 ? 'jogador' : 'jogadores'}`;
  const listaRefs = refs.map(formatarReferenciaParaPrompt).join('\n\n---\n\n');
  const blocoMecanicas = mecanicas.length
    ? [
        mecanicas.length > 1 ? 'Mecânicas adicionais para incorporar:' : 'Mecânica para incorporar:',
        ...mecanicas.map(m => `- ${m.nome}: ${m.descricao}`),
      ]
    : ['Mantenha ou adapte as mecânicas próprias da referência.'];

  if (modo === 'novas-cartas') {
    const baseCartas = Array.isArray(refs[0].kit?.cartas) ? refs[0].kit.cartas : [];
    const totalBase = baseCartas.reduce((s, c) => s + (Number(c.quantidade) || 1), 0);
    const margemCartas = Math.max(1, 54 - totalBase);
    const user = [
      `Pedido para as novas cartas: ${tema}`,
      `${rotuloJogadores} · ${duracao} minutos · materiais disponíveis: ${materiais.join(', ')}`,
      orientacaoJogadores(jogadores),
      ...blocoMecanicas,
      '',
      listaRefs,
    ].join('\n');
    return [{ role: 'system', content: sistemaNovasCartas(entrada, margemCartas) }, { role: 'user', content: user }];
  }

  const instrucaoModo = modo === 'novas-regras'
    ? 'Crie uma VARIAÇÃO DE REGRAS baseada no jogo de referência acima, mantendo o que o torna reconhecível e aplicando o pedido e as mecânicas escolhidas. Acrescente "mudancas": ["o que mudou em relação à referência e por quê"].'
    : 'Crie um JOGO NOVO (novo título, novo tema e novas cartas) inspirado nas regras passadas e referências acima, reaproveitando ou recombinando suas dinâmicas. Acrescente "mudancas": ["o que foi herdado das referências e o que foi reinventado"].';

  const user = [
    `Tema / objetivo do usuário: ${tema}`,
    `${rotuloJogadores} · ${duracao} minutos · dificuldade ${dificuldade === 'medio' ? 'médio' : 'fácil'}`,
    orientacaoJogadores(jogadores),
    `Materiais disponíveis: ${materiais.join(', ')}`,
    ...blocoMecanicas,
    '',
    listaRefs,
    '',
    instrucaoModo,
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

export function promptImagemCarta(carta, kit, entrada) {
  const nomeCarta = String(carta?.nome ?? 'Carta').trim();
  const efeitoCarta = String(carta?.texto ?? '').trim();
  const tituloJogo = String(kit?.titulo ?? '').trim();
  const temaJogo = String(entrada?.tema ?? '').trim();

  const user = [
    `Crie uma ilustração para a carta "${nomeCarta}" do jogo de cartas "${tituloJogo || 'MesaInventada'}".`,
    temaJogo ? `Tema e atmosfera do jogo: ${temaJogo}.` : '',
    efeitoCarta ? `Ação ou ideia da carta: ${efeitoCarta}.` : '',
    'Estilo visual: ilustração expressiva em traço de caderno/nanquim com cores suaves de marcador, fundo claro e alto contraste para ficar nítida quando impressa em folha A4.',
    'Regra obrigatória: gere apenas a arte visual centralizada; NÃO escreva texto, letras, números ou bordas de carta dentro da imagem (sem texto na imagem).',
  ].filter(Boolean).join('\n');

  return [{ role: 'user', content: user }];
}

export function extrairImagem(dados) {
  const msg = dados?.choices?.[0]?.message;
  const imgItem = Array.isArray(msg?.images) ? msg.images[0] : null;
  const urlDireta = imgItem?.image_url?.url || imgItem?.url || '';
  if (typeof urlDireta === 'string' && urlDireta.startsWith('data:image/')) return urlDireta;
  if (typeof urlDireta === 'string' && /^https?:\/\//i.test(urlDireta)) return urlDireta;

  const texto = String(msg?.content ?? '');
  const matchData = texto.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
  if (matchData) return matchData[0];

  throw new Error('O modelo não gerou uma imagem válida. Tente de novo ou troque o modelo de imagem em ⚙ Configurar.');
}

export async function chamarLLMComMetricas({ chave, modelo, mensagens, semente }) {
  const models = [...new Set([modelo, MODELO_PADRAO, ...RESERVAS])].slice(0, 3);
  const inicio = Date.now();
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
  const duracaoMs = Date.now() - inicio;
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (OpenRouter: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  const kit = extrairJSON(dados.choices?.[0]?.message?.content);
  const metricas = extrairMetricas(dados, duracaoMs, models[0]);
  return { kit, metricas };
}

export async function chamarLLM(opcoes) {
  const { kit } = await chamarLLMComMetricas(opcoes);
  return kit;
}

export async function gerarImagemCarta({ chave, modeloImagem, carta, kit, entrada }) {
  const models = [...new Set([modeloImagem || MODELO_IMAGEM_PADRAO, MODELO_IMAGEM_PADRAO, ...RESERVAS_IMAGEM])].slice(0, 3);
  const mensagens = promptImagemCarta(carta, kit, entrada);
  const inicio = Date.now();
  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ models, modalities: ['image', 'text'], messages: mensagens }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('A geração da imagem demorou mais de 90 segundos. Tente de novo.');
    throw new Error('Sem conexão com a OpenRouter. Verifique a internet e tente de novo.');
  }
  const duracaoMs = Date.now() - inicio;
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (OpenRouter: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  const imagemUrl = extrairImagem(dados);
  const metricas = {
    cartaNome: String(carta?.nome ?? ''),
    ...extrairMetricas(dados, duracaoMs, models[0]),
  };
  return { imagemUrl, metricas };
}
