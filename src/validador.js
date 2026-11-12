// Módulo B — travas de equilíbrio (sem IA). Avisa; não bloqueia. Nunca lança: o kit vem do modelo.

const LIMITE_TURNO = { facil: 3, medio: 5 };

const PADROES_DISTRIBUICAO = [
  /(\d+)\s+cartas?\s+(?:para|a)\s+cada\s+(?:jogador|pessoa|participante)/gi,
  /cada\s+(?:jogador|pessoa|participante)\s+(?:recebe|compra|pega|come[çc]a\s+com)\s+(\d+)\s+cartas?/gi,
  /distribua\s+(\d+)\s+cartas?\s+(?:por|para\s+cada|a\s+cada)/gi,
];

function maiorDistribuicaoInicial(preparacao) {
  const texto = preparacao.map(t => String(t ?? '')).join('\n');
  let maxPorJogador = 0;
  for (const padrao of PADROES_DISTRIBUICAO) {
    for (const match of texto.matchAll(padrao)) {
      const qtd = Number(match[1]);
      if (qtd > maxPorJogador) maxPorJogador = qtd;
    }
  }
  return maxPorJogador;
}

export function validarKit(kit, entrada, mecanicas = []) {
  const k = kit && typeof kit === 'object' ? kit : {};
  const avisos = [];
  const falta = campo => avisos.push(`Falta o campo "${campo}".`);

  for (const campo of ['titulo', 'objetivo', 'fim']) if (!String(k[campo] ?? '').trim()) falta(campo);
  for (const campo of ['preparacao', 'turno', 'cartas', 'rodada']) if (!Array.isArray(k[campo]) || !k[campo].length) falta(campo);

  const turno = Array.isArray(k.turno) ? k.turno : [];
  const max = LIMITE_TURNO[entrada.dificuldade] ?? 5;
  if (turno.length > max) avisos.push(`O turno tem ${turno.length} passos; para "${entrada.dificuldade}" o limite é ${max}.`);

  const cartas = Array.isArray(k.cartas) ? k.cartas.filter(c => c && typeof c === 'object') : [];
  if (cartas.length && (cartas.length < 4 || cartas.length > 12))
    avisos.push(`São ${cartas.length} tipos de carta; use entre 4 e 12.`);
  const total = cartas.reduce((s, c) => s + (Number(c.quantidade) || 1), 0);
  if (total > 54) avisos.push(`São ${total} cartas; o limite para imprimir é 54 (6 folhas).`);
  for (const c of cartas) {
    const len = String(c.texto ?? '').length;
    if (len > 120) avisos.push(`A carta "${c.nome}" tem texto longo demais (${len}/120) e não cabe impressa.`);
  }

  const lista = x => (Array.isArray(x) ? x : []);
  const preparacao = lista(k.preparacao);
  const jogadores = Number(entrada.jogadores) || 4;
  const porPessoa = maiorDistribuicaoInicial(preparacao);
  if (porPessoa > 0 && cartas.length > 0 && porPessoa * jogadores > total) {
    avisos.push(
      `A preparação distribui ${porPessoa} cartas por pessoa (${porPessoa * jogadores} para ${jogadores} jogadores), mas o baralho tem só ${total} cartas.`,
    );
  }

  const textosRegras = [k.objetivo, ...preparacao, ...turno, k.fim].map(t => String(t ?? '')).join('\n');
  if (jogadores === 1 && /\b(outro(?:s)? jogador(?:es)?|pr[oó]ximo jogador|cada jogador|entre jogadores|todos os jogadores|sentido hor[aá]rio)\b/i.test(textosRegras)) {
    avisos.push('O jogo é para 1 jogador (solo), mas as regras citam outros jogadores.');
  }
  const citacaoJogadores = textosRegras.match(/\bpara\s+(\d+)\s+jogadores?\b/i);
  if (citacaoJogadores && Number(citacaoJogadores[1]) >= 1 && Number(citacaoJogadores[1]) !== jogadores) {
    avisos.push(`As regras citam ${citacaoJogadores[1]} jogadores, mas o jogo foi configurado para ${jogadores}.`);
  }
  if (Array.isArray(mecanicas)) {
    for (const m of mecanicas) {
      if (m && (jogadores < m.minJogadores || jogadores > m.maxJogadores)) {
        avisos.push(`A mecânica "${m.nome}" funciona para ${m.minJogadores} a ${m.maxJogadores} jogadores, não para ${jogadores}.`);
      }
    }
  }

  const textos = [k.objetivo, ...preparacao, ...turno, k.fim, ...lista(k.rodada), ...cartas.map(c => c.texto)]
    .map(t => String(t ?? '')).join('\n');
  const materiais = entrada.materiais || [];
  if (!materiais.includes('dado') && /\bdados?\b/i.test(textos))
    avisos.push('O jogo usa dado, mas "dado" não está nos materiais.');
  if (!materiais.includes('caneta') && /\b(caneta|l[aá]pis|anot)/i.test(textos))
    avisos.push('O jogo pede para anotar, mas "caneta" não está nos materiais.');

  return avisos;
}
