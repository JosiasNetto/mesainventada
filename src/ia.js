// Onde a IA entra: prompts, chamadas à OpenAI (chave da própria pessoa) e avisos de falha.
import { formatarReferenciaParaPrompt } from './referencias.js';
import { extrairMetricas } from './custos.js';

export const MODELO_PADRAO = 'gpt-5-mini';
export const MODELO_IMAGEM_PADRAO = 'gpt-image-1-mini';
const URL_API = 'https://api.openai.com/v1/chat/completions';
const URL_API_IMAGENS = 'https://api.openai.com/v1/images/generations';
const PRECO_IMAGEM = { 'gpt-image-1-mini': [2, 8], 'gpt-image-1': [5, 40] };
const LIMITE_TURNO = { facil: 3, leve: 3, medio: 4, dificil: 6, avancado: 6 };

export const ehChaveOpenAI = chave => /^sk-(?!or-)[A-Za-z0-9_-]{20,}$/.test(String(chave ?? ''));

// Aceita apenas chaves completas da OpenAI ("sk-...", "sk-proj-..."), recusando chaves truncadas com "...".
export const chaveValida = ehChaveOpenAI;
export const AVISO_CHAVE = 'Essa não parece uma chave completa da OpenAI. '
  + 'Chaves da OpenAI começam com "sk-" (como "sk-proj-..."). '
  + 'O site só mostra a chave inteira uma vez, na hora de criar: se você copiou da lista de chaves, crie uma nova e copie pelo botão de copiar.';

export function resolverModelo(modelo) {
  return String(modelo ?? '').trim() || MODELO_PADRAO;
}

export function resolverModeloImagem(modeloImagem) {
  return String(modeloImagem ?? '').trim() || MODELO_IMAGEM_PADRAO;
}

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
  const comTabuleiro = entrada.formato === 'tabuleiro';
  const regraRodada = jogadores === 1
    ? '- "rodada": 3 a 6 passos simulando uma rodada de teste solo com valores concretos (ex.: "Ana rola o dado: 2").'
    : `- "rodada": 3 a 6 passos simulando uma rodada de teste com jogadores nomeados coerentes com ${jogadores} participantes e valores concretos (ex.: "Ana rola o dado: 2").`;

  const formatoJSON = comTabuleiro
    ? '{"titulo":"","objetivo":"","preparacao":[""],"turno":[""],"fim":"","tabuleiro":{"titulo":"","tipo":"trilha","casas":[{"numero":1,"nome":"","efeito":""}]},"cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":""}'
    : '{"titulo":"","objetivo":"","preparacao":[""],"turno":[""],"fim":"","cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":""}';

  const regraTabuleiro = comTabuleiro
    ? '- "tabuleiro": 8 a 16 "casas" (com "numero", "nome" e "efeito" com até 80 caracteres) que cabem em 1 folha A4. O jogo usa peões/marcadores sobre as casas.'
    : '';

  const DIRETRIZES_COMPLEXIDADE = {
    facil: 'Leve (Fácil): turnos diretos (até 3 passos), cartas com efeitos imediatos (ex.: "Compre 1 carta", "Ganhe 2 recursos"), sem dependência complexa entre jogadores.',
    leve: 'Leve (Fácil): turnos diretos (até 3 passos), cartas com efeitos imediatos (ex.: "Compre 1 carta", "Ganhe 2 recursos"), sem dependência complexa entre jogadores.',
    medio: 'Médio: turnos encadeados (até 4 passos), cartas com efeitos condicionais simples ("Se tiver X, faça Y").',
    dificil: 'Avançado (Difícil): fases distintas no turno (ex.: Fase de Ação e Fase de Compra, até 6 passos no turno), com combos e sinergias entre cartas.',
    avancado: 'Avançado (Difícil): fases distintas no turno (ex.: Fase de Ação e Fase de Compra, até 6 passos no turno), com combos e sinergias entre cartas.',
  };
  const guiaDificuldade = DIRETRIZES_COMPLEXIDADE[entrada.dificuldade] || DIRETRIZES_COMPLEXIDADE.facil;

  return `Você é co-designer de jogos de cartas e tabuleiro curtos na ferramenta MesaInventada.
Você propõe um protótipo revisável, não um jogo final equilibrado.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
${formatoJSON}
Regras:
- Português do Brasil, frases curtas e concretas.
- Use só os materiais disponíveis. As cartas e tabuleiro são de papel e só têm texto, sem imagens.
- Dificuldade "${entrada.dificuldade || 'facil'}": ${guiaDificuldade}
- "turno": no máximo ${limite} passos.
- "cartas": de 4 a 12 tipos; "texto" com até 120 caracteres; soma das "quantidade" até 54.
${regraTabuleiro ? `${regraTabuleiro}\n` : ''}${regraRodada}
- "provocacao": uma pergunta que desafia uma suposição deste jogo (ex.: precisa haver um vencedor?).`;
}

export function promptKit(entrada, mecanicas = []) {
  const { tema, jogadores, duracao, materiais = ['papel'], dificuldade, modoCriacao, formato } = entrada;
  const rotuloJogadores = `${jogadores} ${jogadores === 1 ? 'jogador' : 'jogadores'}`;
  const rotuloFormato = formato === 'tabuleiro' ? 'Jogo com tabuleiro (A4) e cartas' : 'Jogo de cartas';

  if (modoCriacao === 'livre') {
    const mencaoMecanicas = mecanicas.length
      ? `Mecânicas sugeridas para incorporar se fizerem sentido:\n${mecanicas.map(m => `- ${m.nome}: ${m.descricao}`).join('\n')}`
      : 'Escolha e combine as mecânicas que melhor se adaptem à visão do jogador.';

    const userLivre = [
      '[MODO LIVRE - CO-CRIAÇÃO ABERTA]',
      `Ideia ou visão do jogador:\n"${tema}"`,
      '',
      `Formato: ${rotuloFormato}`,
      `Dificuldade / complexidade desejada: ${dificuldade === 'medio' ? 'médio' : 'fácil'}`,
      `${rotuloJogadores} · ${duracao} minutos`,
      orientacaoJogadores(jogadores),
      `Materiais disponíveis: ${materiais.join(', ')}`,
      '',
      'Diretrizes:',
      '- Dê vida à ideia livre do usuário criando um jogo coeso, intuitivo e jogável com papel e caneta.',
      mencaoMecanicas,
      formato === 'tabuleiro' ? '- Projete um tabuleiro em folha A4 com trilha de casas ou setores onde peões/marcadores se movem conforme as ações.' : '',
    ].filter(Boolean).join('\n');

    return [{ role: 'system', content: sistema(entrada) }, { role: 'user', content: userLivre }];
  }

  const cabecalho = mecanicas.length > 1
    ? 'Mecânicas escolhidas (combine todas num só jogo):'
    : 'Mecânica escolhida (construa o jogo em torno dela):';

  const user = [
    `Tema: ${tema}`,
    `Formato: ${rotuloFormato}`,
    `${rotuloJogadores} · ${duracao} minutos · dificuldade ${dificuldade === 'medio' ? 'médio' : 'fácil'}`,
    orientacaoJogadores(jogadores),
    `Materiais disponíveis: ${materiais.join(', ')}`,
    cabecalho,
    ...mecanicas.map(m => `- ${m.nome}: ${m.descricao}`),
    formato === 'tabuleiro' ? 'Crie um tabuleiro em folha A4 integrado às regras e às cartas.' : '',
  ].filter(Boolean).join('\n');

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
  if (status === 401) return 'Chave inválida ou ausente. Abra ⚙ Configurar e cole sua chave da OpenAI (platform.openai.com/api-keys).';
  if (status === 402) return 'Sua conta OpenAI está sem créditos para este modelo. Adicione créditos em platform.openai.com e tente de novo.';
  if (status === 404) return 'Modelo não encontrado ou não liberado para sua chave. Em ⚙ Configurar, use "gpt-5-mini" ou outro modelo liberado.';
  if (status === 429) return 'Limite de pedidos atingido na OpenAI. Espere um minuto e tente de novo.';
  if (status >= 500) return 'A OpenAI está fora do ar agora. Tente de novo em instantes ou troque o modelo.';
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
  const item = Array.isArray(dados?.data) ? dados.data[0] : null;
  if (typeof item?.b64_json === 'string' && item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  if (typeof item?.url === 'string' && /^https?:\/\//i.test(item.url)) return item.url;
  throw new Error('O modelo não gerou uma imagem válida. Tente de novo ou troque o modelo de imagem em ⚙ Configurar.');
}

function metricasImagem(dados, duracaoMs, modelo) {
  const u = dados?.usage && typeof dados.usage === 'object' ? dados.usage : {};
  const entrada = Number(u.input_tokens) || 0;
  const saida = Number(u.output_tokens) || 0;
  const preco = PRECO_IMAGEM[modelo];
  const custoUsd = preco ? (entrada * preco[0] + saida * preco[1]) / 1e6 : 0;
  const m = extrairMetricas({
    model: modelo,
    usage: { prompt_tokens: entrada, completion_tokens: saida, total_tokens: Number(u.total_tokens) || entrada + saida, cost: custoUsd },
  }, duracaoMs, modelo);
  return { ...m, imageTokens: saida || m.imageTokens };
}

export async function chamarLLMComMetricas({ chave, modelo, mensagens, semente }) {
  const modeloResolvido = resolverModelo(modelo);
  const inicio = Date.now();
  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modeloResolvido, messages: mensagens, seed: semente, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('A IA demorou mais de 90 segundos. Tente de novo ou troque o modelo em ⚙ Configurar.');
    throw new Error('Sem conexão com a OpenAI. Verifique a internet e tente de novo.');
  }
  const duracaoMs = Date.now() - inicio;
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (OpenAI: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  const kit = extrairJSON(dados.choices?.[0]?.message?.content);
  const metricas = extrairMetricas(dados, duracaoMs, modeloResolvido);
  return { kit, metricas };
}

export async function chamarLLM(opcoes) {
  const { kit } = await chamarLLMComMetricas(opcoes);
  return kit;
}

export async function gerarImagemCarta({ chave, modeloImagem, carta, kit, entrada }) {
  const mensagens = promptImagemCarta(carta, kit, entrada);
  const modelo = resolverModeloImagem(modeloImagem);
  const inicio = Date.now();
  let res;
  try {
    res = await fetch(URL_API_IMAGENS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        prompt: mensagens[0].content,
        size: '1024x1024',
        n: 1,
        quality: 'low',
        output_format: 'jpeg',
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('A geração da imagem demorou mais de 90 segundos. Tente de novo.');
    throw new Error('Sem conexão com a OpenAI. Verifique a internet e tente de novo.');
  }
  const duracaoMs = Date.now() - inicio;
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (OpenAI: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  return {
    imagemUrl: extrairImagem(dados),
    metricas: {
      cartaNome: String(carta?.nome ?? ''),
      ...metricasImagem(dados, duracaoMs, modelo),
    },
  };
}
