// Onde a IA entra: prompts, chamada à OpenRouter (chave da própria pessoa) e avisos de falha.
import { formatarReferenciaParaPrompt } from './referencias.js';
import { extrairMetricas } from './custos.js';

export const MODELO_PADRAO = 'nvidia/nemotron-3.5-super-vl:free';
export const MODELO_PADRAO_OPENAI = 'gpt-5-mini';
// Modelos grátis saturam ou somem sem aviso; a OpenRouter tenta estes, em ordem, se o escolhido falhar.
// ponytail: lista fixa de 3 (limite seguro da API); revisar os ":free" disponíveis antes de cada entrega.
const RESERVAS = ['openrouter/free', 'google/gemma-4-31b-it:free'];
export const MODELO_IMAGEM_PADRAO = 'google/gemini-3.1-flash-lite-image';
const RESERVAS_IMAGEM = ['openai/gpt-5-image-mini', 'google/gemini-2.5-flash-image'];
// Com chave da OpenAI, as cartas usam a API de imagens dela; "low" foi o mais barato medido (docs/avaliacao-tempo-custo.md, seção 5).
export const MODELO_IMAGEM_PADRAO_OPENAI = 'gpt-image-1-mini';
// A API de imagens da OpenAI não devolve custo: US$ por 1M de tokens [entrada de texto, saída de imagem].
const PRECO_IMAGEM_OPENAI = { 'gpt-image-1-mini': [2.00, 8.00], 'gpt-image-1': [5.00, 40.00] };
// A API de texto da OpenAI também não devolve custo: US$ por 1M de tokens [entrada, saída] (tabela oficial, Standard tier).
const PRECO_TEXTO_OPENAI = { 'gpt-5-nano': [0.05, 0.40], 'gpt-5-mini': [0.25, 2.00], 'gpt-5': [1.25, 10.00] };
// Avaliador da rubrica: o modelo de texto mais barato da OpenAI, com raciocínio mínimo para responder em poucos segundos.
export const MODELO_AVALIADOR_OPENAI = 'gpt-5-nano';
const MODELO_AVALIADOR_OPENROUTER = 'openai/gpt-5-nano';
// Limite de espera do texto: modelos grátis da OpenRouter às vezes travam sem responder; os GPT-5 da OpenAI raciocinam
// antes de responder (gpt-5-mini ~63 s, gpt-5 95-112 s por kit, docs/avaliacao-tempo-custo.md, seção 5).
const LIMITE_TEXTO_MS_OPENROUTER = 90_000;
const LIMITE_TEXTO_MS_OPENAI = 150_000;
const URL_API = 'https://openrouter.ai/api/v1/chat/completions';
const URL_API_OPENAI = 'https://api.openai.com/v1/chat/completions';
const URL_API_IMAGENS_OPENAI = 'https://api.openai.com/v1/images/generations';
const LIMITE_TURNO = { facil: 3, leve: 3, medio: 4, dificil: 6, avancado: 6 };

export const ehChaveOpenRouter = chave => /^sk-or-v1-[A-Za-z0-9_-]{32,}$/.test(String(chave ?? ''));
export const ehChaveOpenAI = chave => /^sk-(?!or-)[A-Za-z0-9_-]{20,}$/.test(String(chave ?? ''));

// Aceita chaves completas da OpenRouter ("sk-or-v1-...") e da OpenAI ("sk-...", "sk-proj-..."), recusando chaves truncadas com "...".
export const chaveValida = chave => ehChaveOpenRouter(chave) || ehChaveOpenAI(chave);
export const AVISO_CHAVE = 'Essa não parece uma chave completa da OpenRouter ou da OpenAI. '
  + 'Chaves da OpenRouter começam com "sk-or-v1-" e chaves da OpenAI começam com "sk-" (como "sk-proj-..."). '
  + 'Os sites só mostram a chave inteira uma vez, na hora de criar: se você copiou da lista de chaves, crie uma nova e copie pelo botão de copiar.';

export function resolverModelo(modelo, chave) {
  const m = String(modelo ?? '').trim();
  if (ehChaveOpenAI(chave)) {
    if (!m || m === MODELO_PADRAO || m.includes('/') || m.endsWith(':free')) {
      return MODELO_PADRAO_OPENAI;
    }
    return m;
  }
  if (!m || (ehChaveOpenRouter(chave) && m === MODELO_PADRAO_OPENAI)) {
    return MODELO_PADRAO;
  }
  return m;
}

export function resolverModeloImagem(modelo, chave) {
  const m = String(modelo ?? '').trim();
  if (ehChaveOpenAI(chave)) return !m || m.includes('/') ? MODELO_IMAGEM_PADRAO_OPENAI : m;
  if (!m || (ehChaveOpenRouter(chave) && m === MODELO_IMAGEM_PADRAO_OPENAI)) return MODELO_IMAGEM_PADRAO;
  return m;
}

// Campo vazio em ⚙ Configurar = modelo padrão do provedor. 'gpt-4o-mini' era o padrão antigo da OpenAI e ficou salvo para quem já configurou.
const PADROES_TEXTO = [MODELO_PADRAO, MODELO_PADRAO_OPENAI, 'gpt-4o-mini'];
const PADROES_IMAGEM = [MODELO_IMAGEM_PADRAO, MODELO_IMAGEM_PADRAO_OPENAI];

export function modeloEscolhido(modelo, chave) {
  const m = resolverModelo(modelo, chave);
  return PADROES_TEXTO.includes(m) ? '' : m;
}

export function modeloImagemEscolhido(modelo, chave) {
  const m = resolverModeloImagem(modelo, chave);
  return PADROES_IMAGEM.includes(m) ? '' : m;
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

// As ilustrações ficam em base64 dentro das cartas: mandar isso para a IA estoura o limite de tokens.
export function kitSemImagens(kit) {
  if (!kit || typeof kit !== 'object' || !Array.isArray(kit.cartas)) return kit;
  return {
    ...kit,
    cartas: kit.cartas.map(c => {
      if (!c || typeof c !== 'object') return c;
      const { imagem, ...resto } = c;
      return resto;
    }),
  };
}

export function promptRevisao(entrada, kit, relato, avisos) {
  const user = [
    `Kit atual: ${JSON.stringify(kitSemImagens(kit))}`,
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

// Modelos fracos às vezes escrevem texto depois do JSON ("Invalid JSON... I'll re-output") ou repetem o objeto corrigido.
// Por isso cada objeto { ... } completo da resposta vira um candidato separado, respeitando chaves dentro de strings.
export function extrairObjetosJSON(texto) {
  const s = String(texto ?? '').replace(/```(json)?/g, '');
  const objetos = [];
  let inicio = -1;
  let profundidade = 0;
  let emString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (emString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') emString = false;
    } else if (ch === '"' && profundidade > 0) emString = true;
    else if (ch === '{') {
      if (profundidade === 0) inicio = i;
      profundidade++;
    } else if (ch === '}' && profundidade > 0 && --profundidade === 0) {
      try { objetos.push(JSON.parse(s.slice(inicio, i + 1))); } catch { /* candidato quebrado: ignora */ }
    }
  }
  if (!objetos.length) {
    try { objetos.push(JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))); } catch { /* sem JSON */ }
  }
  return objetos.filter(o => o && typeof o === 'object' && !Array.isArray(o));
}

export function extrairJSON(texto) {
  const [primeiro] = extrairObjetosJSON(texto);
  if (!primeiro) throw new Error('A IA respondeu em um formato inesperado. Clique em CRIAR JOGO de novo ou troque o modelo em ⚙ Configurar.');
  return primeiro;
}

// Aspas seguidas de dois-pontos (fim':'... ou tabuleiro":{) dentro de um texto do kit são restos de JSON que o modelo quebrou.
const RESTO_DE_JSON = /["']\s*:\s*["'[{]|\{\s*"[a-z_]+"\s*:/i;

// Devolve o primeiro problema estrutural do kit (texto curto) ou '' se ele pode virar uma versão.
export function problemaNoFormatoKit(kit) {
  if (!kit || typeof kit !== 'object') return 'a resposta não é um kit';
  for (const campo of ['titulo', 'objetivo', 'fim']) {
    if (typeof kit[campo] !== 'string' || !kit[campo].trim()) return `falta o campo "${campo}"`;
  }
  for (const campo of ['preparacao', 'turno', 'rodada']) {
    if (!Array.isArray(kit[campo]) || !kit[campo].length || kit[campo].some(p => typeof p !== 'string')) return `o campo "${campo}" não é uma lista de passos`;
  }
  if (!Array.isArray(kit.cartas) || !kit.cartas.length || kit.cartas.some(c => !c || typeof c !== 'object' || !String(c.nome ?? '').trim())) {
    return 'faltam as cartas';
  }
  const textos = [
    ['titulo', kit.titulo], ['objetivo', kit.objetivo], ['fim', kit.fim], ['provocacao', kit.provocacao],
    ...['preparacao', 'turno', 'rodada'].flatMap(campo => kit[campo].map(t => [campo, t])),
    ...kit.cartas.flatMap(c => [['cartas', c.nome], ['cartas', c.texto]]),
  ];
  const quebrado = textos.find(([, t]) => typeof t === 'string' && RESTO_DE_JSON.test(t));
  return quebrado ? `o campo "${quebrado[0]}" tem pedaços de JSON misturados ao texto` : '';
}

// Escolhe o último candidato bem formado (o "corrigido", quando o modelo repete o objeto) ou explica o problema do primeiro.
export function extrairKit(texto) {
  const candidatos = extrairObjetosJSON(texto);
  const validos = candidatos.filter(k => !problemaNoFormatoKit(k));
  if (validos.length) return validos[validos.length - 1];
  const motivo = candidatos.length ? problemaNoFormatoKit(candidatos[0]) : 'a resposta não tem JSON';
  const erro = new Error(`A IA devolveu um kit com o formato quebrado (${motivo}).`);
  erro.formatoQuebrado = true;
  throw erro;
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

// Envia um pedido de texto (chat/completions) e devolve o JSON da resposta com as métricas de tempo, tokens e custo.
async function enviarTexto({ chave, corpo, modeloMetricas }) {
  const usarOpenAI = ehChaveOpenAI(chave);
  const nomeProvedor = usarOpenAI ? 'OpenAI' : 'OpenRouter';
  const limiteMs = usarOpenAI ? LIMITE_TEXTO_MS_OPENAI : LIMITE_TEXTO_MS_OPENROUTER;
  const inicio = Date.now();
  let res;
  try {
    res = await fetch(usarOpenAI ? URL_API_OPENAI : URL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(limiteMs),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error(`A IA demorou mais de ${limiteMs / 1000} segundos. Tente de novo ou troque o modelo em ⚙ Configurar.`);
    throw new Error(`Sem conexão com a ${nomeProvedor}. Verifique a internet e tente de novo.`);
  }
  const duracaoMs = Date.now() - inicio;
  const dados = await res.json().catch(() => ({}));
  const motivo = dados.error?.message ? ` (${nomeProvedor}: ${dados.error.message})` : '';
  if (!res.ok) throw new Error(mensagemDeErro(res.status) + motivo);
  if (dados.error) throw new Error(mensagemDeErro(Number(dados.error.code) || 500) + motivo);
  const conteudo = String(dados.choices?.[0]?.message?.content ?? '');
  const metricas = extrairMetricas(dados, duracaoMs, modeloMetricas);
  const preco = usarOpenAI && PRECO_TEXTO_OPENAI[metricas.modelo.replace(/-\d{4}-\d{2}-\d{2}$/, '')];
  if (preco && !metricas.custoUsd) {
    metricas.custoUsd = (metricas.promptTokens * preco[0] + metricas.completionTokens * preco[1]) / 1e6;
  }
  return { conteudo, metricas };
}

const somarMetricas = (a, b) => ({
  ...b,
  duracaoMs: a.duracaoMs + b.duracaoMs,
  promptTokens: a.promptTokens + b.promptTokens,
  completionTokens: a.completionTokens + b.completionTokens,
  imageTokens: a.imageTokens + b.imageTokens,
  totalTokens: a.totalTokens + b.totalTokens,
  custoUsd: a.custoUsd + b.custoUsd,
});

// GPT-5 com raciocínio "low" gerou kits ~3,5x mais rápido (16 s contra 56 s) e ~4x mais barato, sem perder nota na rubrica.
// Os "-chat" e os modelos fora da família GPT-5 não aceitam reasoning_effort.
const raciocinaPouco = modelo => /^gpt-5/.test(modelo) && !modelo.includes('-chat');

export async function chamarLLMComMetricas({ chave, modelo, mensagens, semente }) {
  const usarOpenAI = ehChaveOpenAI(chave);
  const modeloResolvido = resolverModelo(modelo, chave);
  const models = [...new Set([modeloResolvido, MODELO_PADRAO, ...RESERVAS])].slice(0, 3);
  const corpo = usarOpenAI
    ? {
      model: modeloResolvido, messages: mensagens, seed: semente, response_format: { type: 'json_object' },
      ...(raciocinaPouco(modeloResolvido) ? { reasoning_effort: 'low' } : {}),
    }
    : { models, messages: mensagens, seed: semente, response_format: { type: 'json_object' } };
  // Um kit com formato quebrado nunca vira versão: pede de novo uma vez e, se falhar, mantém a versão atual.
  let gasto = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const { conteudo, metricas } = await enviarTexto({ chave, corpo, modeloMetricas: usarOpenAI ? modeloResolvido : models[0] });
    gasto = gasto ? somarMetricas(gasto, metricas) : metricas;
    try {
      return { kit: extrairKit(conteudo), metricas: gasto };
    } catch (e) {
      if (tentativa === 2) {
        throw new Error(`${e.message} Tentamos duas vezes e a versão atual foi mantida. Tente de novo ou troque o modelo de texto em ⚙ Configurar.`);
      }
    }
  }
}

// Rubrica de qualidade do artefato: 5 critérios de 0 a 2; um kit bom soma 8 ou mais em 10.
export const CRITERIOS_RUBRICA = [
  { id: 'jogavel', nome: 'Jogável', avalia: 'Dá para jogar do início ao fim só lendo as regras, sem a mesa inventar nada', verificacao: 'Ler preparação, turno e fim em sequência e procurar lacunas' },
  { id: 'fiel', nome: 'Fiel ao pedido', avalia: 'Tema, mecânicas, número de jogadores e materiais escolhidos aparecem no jogo', verificacao: 'Comparar o kit com o que foi preenchido no formulário' },
  { id: 'rodada', nome: 'Rodada coerente', avalia: 'A rodada de teste simulada respeita as regras do próprio kit', verificacao: 'Refazer a rodada passo a passo com as regras ao lado' },
  { id: 'clareza', nome: 'Clareza das cartas', avalia: 'Textos curtos, sem ambiguidade, em português e com efeito entendível', verificacao: 'Ler cada carta isolada e checar se o efeito é único' },
  { id: 'provocacao', nome: 'Provocação útil', avalia: 'A pergunta da IA questiona uma suposição real deste jogo', verificacao: 'Ver se a pergunta leva a uma mudança possível nas regras' },
];
export const NOTA_MAXIMA_RUBRICA = CRITERIOS_RUBRICA.length * 2;
export const NOTA_BOA_RUBRICA = 8;

export function promptAvaliacao(entrada, mecanicas, kit) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const { mudancas, ...kitAvaliado } = kitSemImagens(kit) ?? {};
  const sistemaAvaliador = `Você é o avaliador de qualidade da ferramenta MesaInventada. Você NÃO reescreve o jogo: só dá notas.
Avalie o kit com esta rubrica. Cada critério vale 0, 1 ou 2 (0 = não cumpre, 1 = cumpre em parte, 2 = cumpre).
${CRITERIOS_RUBRICA.map(c => `- "${c.id}" (${c.nome}): ${c.avalia}. Como verificar: ${c.verificacao}.`).join('\n')}
Seja rigoroso: dê 2 só quando não houver problema concreto. Ao tirar ponto, a justificativa diz o problema exato.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
{"criterios":[${CRITERIOS_RUBRICA.map(c => `{"id":"${c.id}","nota":0,"justificativa":""}`).join(',')}]}
"justificativa": português do Brasil, uma frase com até 140 caracteres.`;
  const lista = Array.isArray(mecanicas) ? mecanicas : [];
  const user = [
    'Pedido feito no formulário:',
    `- Tema: ${e.tema ?? ''}`,
    `- Formato: ${e.formato === 'tabuleiro' ? 'tabuleiro (A4) e cartas' : 'cartas'}`,
    `- Jogadores: ${e.jogadores ?? ''} · Duração: ${e.duracao ?? ''} minutos · Dificuldade: ${e.dificuldade ?? ''}`,
    `- Materiais disponíveis: ${(e.materiais ?? []).join(', ')}`,
    `- Mecânicas escolhidas: ${lista.length ? lista.map(m => m.nome).join('; ') : 'livre (a IA escolheu)'}`,
    '',
    `Kit gerado: ${JSON.stringify(kitAvaliado)}`,
  ].join('\n');
  return [{ role: 'system', content: sistemaAvaliador }, { role: 'user', content: user }];
}

export function normalizarAvaliacao(resposta) {
  const recebidos = Array.isArray(resposta?.criterios) ? resposta.criterios : [];
  if (!recebidos.length) throw new Error('O avaliador respondeu em um formato inesperado. Clique em ↻ reavaliar.');
  const criterios = CRITERIOS_RUBRICA.map(c => {
    const r = recebidos.find(x => x?.id === c.id) ?? {};
    const nota = Math.min(2, Math.max(0, Math.round(Number(r.nota) || 0)));
    return { id: c.id, nome: c.nome, nota, justificativa: String(r.justificativa ?? '').trim() || 'O avaliador não justificou esta nota.' };
  });
  const total = criterios.reduce((s, c) => s + c.nota, 0);
  return { criterios, total, maximo: NOTA_MAXIMA_RUBRICA, bom: total >= NOTA_BOA_RUBRICA };
}

export async function avaliarKit({ chave, kit, entrada, mecanicas }) {
  const messages = promptAvaliacao(entrada, mecanicas, kit);
  const corpo = ehChaveOpenAI(chave)
    ? { model: MODELO_AVALIADOR_OPENAI, messages, response_format: { type: 'json_object' }, reasoning_effort: 'minimal' }
    : { model: MODELO_AVALIADOR_OPENROUTER, messages, response_format: { type: 'json_object' }, reasoning: { effort: 'minimal' } };
  const { conteudo, metricas } = await enviarTexto({ chave, corpo, modeloMetricas: corpo.model });
  return { avaliacao: normalizarAvaliacao(extrairJSON(conteudo)), metricas };
}

export async function chamarLLM(opcoes) {
  const { kit } = await chamarLLMComMetricas(opcoes);
  return kit;
}

async function gerarImagemOpenAI({ chave, modelo, mensagens, carta }) {
  const inicio = Date.now();
  let res;
  try {
    res = await fetch(URL_API_IMAGENS_OPENAI, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo, prompt: mensagens[0].content, n: 1, size: '1024x1024', quality: 'low', output_format: 'jpeg',
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
  const b64 = dados.data?.[0]?.b64_json;
  if (!b64) throw new Error('O modelo não gerou uma imagem válida. Tente de novo ou troque o modelo de imagem em ⚙ Configurar.');
  const u = dados.usage ?? {};
  const promptTokens = Number(u.input_tokens) || 0;
  const imageTokens = Number(u.output_tokens) || 0;
  const [precoEntrada, precoSaida] = PRECO_IMAGEM_OPENAI[modelo] ?? [0, 0];
  return {
    imagemUrl: `data:image/jpeg;base64,${b64}`,
    metricas: {
      cartaNome: String(carta?.nome ?? ''),
      modelo,
      duracaoMs: Math.max(0, duracaoMs),
      promptTokens,
      completionTokens: imageTokens,
      imageTokens,
      totalTokens: Number(u.total_tokens) || promptTokens + imageTokens,
      custoUsd: (promptTokens * precoEntrada + imageTokens * precoSaida) / 1e6,
    },
  };
}

export async function gerarImagemCarta({ chave, modeloImagem, carta, kit, entrada }) {
  if (ehChaveOpenAI(chave)) {
    const modelo = resolverModeloImagem(modeloImagem, chave);
    return gerarImagemOpenAI({ chave, modelo, mensagens: promptImagemCarta(carta, kit, entrada), carta });
  }
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
