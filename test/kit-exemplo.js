export const entradaExemplo = { tema: 'jogo cooperativo sobre exploração espacial', jogadores: 4, duracao: 20,
  materiais: ['papel', 'caneta', 'dado'], dificuldade: 'facil' };

export const kitExemplo = {
  titulo: 'Oxigênio Zero',
  objetivo: 'Consertar a nave juntos antes que o oxigênio acabe.',
  preparacao: ['Embaralhe as cartas.', 'Anote 10 de oxigênio no papel.'],
  turno: ['Role o dado: com 1 ou 2, perca essa quantidade de oxigênio.', 'Compre uma carta.', 'Use uma Ferramenta para consertar uma Falha.'],
  fim: 'Vencem ao consertar 6 falhas; perdem se o oxigênio chegar a 0.',
  cartas: [
    { nome: 'Vazamento', texto: 'Falha. Perca 1 de oxigênio por turno até consertar.', quantidade: 4 },
    { nome: 'Curto-circuito', texto: 'Falha. O próximo jogador não pode usar Ferramentas.', quantidade: 3 },
    { nome: 'Chave inglesa', texto: 'Ferramenta. Conserte 1 falha.', quantidade: 5 },
    { nome: 'Fita isolante', texto: 'Ferramenta. Conserte um Vazamento ou ganhe 1 de oxigênio.', quantidade: 4 },
    { nome: 'Tanque reserva', texto: 'Ganhe 3 de oxigênio.', quantidade: 2 },
    { nome: 'Pane geral', texto: 'Todos descartam 1 carta.', quantidade: 2 },
  ],
  rodada: ['Ana rola o dado: 2. O oxigênio cai de 10 para 8.', 'Ana compra Vazamento.', 'Ana usa Fita isolante e conserta o Vazamento.'],
  provocacao: 'E se um dos tripulantes pudesse sabotar a nave em segredo?',
};
