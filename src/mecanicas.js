// Módulo A — motor de mecânicas: catálogo fixo (sem IA) e escolha de 3 alternativas distintas.

const m = (id, nome, familia, precisa, minJogadores, maxJogadores, descricao) =>
  ({ id, nome, descricao, familia, precisa, minJogadores, maxJogadores });

export const catalogo = [
  m('gestao-recursos', 'Gestão de recursos escassos', 'cooperativo', [], 1, 6,
    'Todos dividem um estoque que acaba; cada escolha gasta algo que faz falta depois.'),
  m('contra-relogio', 'Contra o relógio', 'cooperativo', [], 2, 6,
    'O baralho é o cronômetro: o grupo precisa cumprir a missão antes que ele acabe.'),
  m('comunicacao-limitada', 'Comunicação limitada', 'cooperativo', [], 2, 6,
    'Jogadores cooperam sem poder falar tudo o que sabem; vale só dica curta ou gesto.'),
  m('colecao-conjuntos', 'Coleção de conjuntos', 'competitivo', [], 2, 6,
    'Junte cartas que combinam entre si; conjuntos maiores ou raros valem mais pontos.'),
  m('vazas', 'Vazas', 'competitivo', [], 3, 6,
    'Cada um joga uma carta por rodada e a mais forte leva a vaza.'),
  m('controle-setores', 'Controle de setores', 'competitivo', [], 2, 5,
    'Cartas viram setores na mesa; quem tem mais presença em cada um o controla.'),
  m('draft', 'Draft de cartas', 'competitivo', [], 2, 6,
    'Pegue uma carta da mão e passe o resto adiante; monte seu jogo com o que sobra.'),
  m('blefe', 'Blefe e dedução', 'informacao-oculta', [], 3, 8,
    'Jogue cartas viradas e declare o que são; os outros decidem se acreditam.'),
  m('papeis-secretos', 'Papéis secretos', 'informacao-oculta', [], 4, 8,
    'Cada um recebe um papel escondido com objetivo próprio; descubra quem é quem.'),
  m('negociacao', 'Negociação e troca', 'negociacao', [], 3, 6,
    'Ninguém tem tudo o que precisa: troque, prometa e feche acordos para avançar.'),
  m('leilao', 'Leilão', 'negociacao', ['caneta'], 3, 6,
    'Cartas valiosas vão a leilão; anote seus lances e gaste com cuidado.'),
  m('forcar-sorte', 'Forçar a sorte', 'sorte', ['dado'], 2, 6,
    'Role o dado quantas vezes quiser para ganhar mais, mas um resultado ruim perde tudo.'),
  m('rolar-escrever', 'Rolar e escrever', 'sorte', ['dado', 'caneta'], 1, 8,
    'Todos usam a mesma rolagem de dado e anotam escolhas numa folha própria.'),
];

// PRNG pequeno e determinístico: mesma semente → mesmas mecânicas.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function escolherMecanicas(entrada, semente) {
  const { jogadores, materiais } = entrada;
  const possiveis = catalogo.filter(x =>
    x.precisa.every(p => materiais.includes(p)) && x.minJogadores <= jogadores && jogadores <= x.maxJogadores);
  const rnd = mulberry32(semente);
  for (let i = possiveis.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [possiveis[i], possiveis[j]] = [possiveis[j], possiveis[i]];
  }
  const escolhidas = [];
  for (const x of possiveis) {
    if (escolhidas.length < 3 && !escolhidas.some(e => e.familia === x.familia)) escolhidas.push(x);
  }
  for (const x of possiveis) {
    if (escolhidas.length < 3 && !escolhidas.includes(x)) escolhidas.push(x);
  }
  return escolhidas;
}
