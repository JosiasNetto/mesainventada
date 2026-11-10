// Módulo B — travas de equilíbrio (sem IA). Avisa; não bloqueia. Nunca lança: o kit vem do modelo.

const LIMITE_TURNO = { facil: 3, medio: 5 };

export function validarKit(kit, entrada) {
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
  const textos = [k.objetivo, ...lista(k.preparacao), ...turno, k.fim, ...lista(k.rodada), ...cartas.map(c => c.texto)]
    .map(t => String(t ?? '')).join('\n');
  const materiais = entrada.materiais || [];
  if (!materiais.includes('dado') && /\bdados?\b/i.test(textos))
    avisos.push('O jogo usa dado, mas "dado" não está nos materiais.');
  if (!materiais.includes('caneta') && /\b(caneta|l[aá]pis|anot)/i.test(textos))
    avisos.push('O jogo pede para anotar, mas "caneta" não está nos materiais.');

  return avisos;
}
