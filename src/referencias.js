// Catálogo de jogos de referência (sem IA) carregado de JSON e adaptadores para versões passadas / regras coladas.
import dadosJogos from './jogos-referencia.json' with { type: 'json' };

export const jogosReferencia = dadosJogos.map(jogo => ({
  origem: 'catalogo',
  ...jogo,
}));

export function obterReferencia(id) {
  return jogosReferencia.find(item => item.id === id) || null;
}

export function buscarReferencias(termo = '') {
  const q = String(termo ?? '').trim().toLowerCase();
  if (!q) return [...jogosReferencia];
  return jogosReferencia.filter(item =>
    item.nome.toLowerCase().includes(q)
    || item.resumo.toLowerCase().includes(q)
    || item.mecanicasIds.some(id => id.toLowerCase().includes(q)),
  );
}

export function referenciaDeVersao(versao) {
  if (!versao || !versao.kit) return null;
  const jogadores = versao.entrada?.jogadores || 4;
  return {
    id: `versao-${versao.n}`,
    nome: `${versao.kit.titulo || 'Versão'} (v${versao.n})`,
    resumo: versao.kit.objetivo || 'Versão criada anteriormente nesta sessão.',
    origem: 'versao',
    minJogadores: jogadores,
    maxJogadores: jogadores,
    materiais: Array.isArray(versao.entrada?.materiais) ? versao.entrada.materiais : ['papel'],
    mecanicasIds: Array.isArray(versao.mecanicas) ? versao.mecanicas.map(m => m.id).filter(Boolean) : [],
    kit: versao.kit,
  };
}

export function referenciaDeTexto(titulo, textoLivre) {
  const limpo = String(textoLivre ?? '').trim();
  if (!limpo) return null;
  const nome = String(titulo ?? '').trim() || 'Regras passadas pelo usuário';
  return {
    id: 'regras-coladas',
    nome,
    resumo: limpo.slice(0, 140),
    origem: 'texto',
    textoLivre: limpo,
    mecanicasIds: [],
  };
}

export function mesclarCartasNoKit(kitBase, respostaIA) {
  const base = kitBase && typeof kitBase === 'object' ? kitBase : {};
  const extras = Array.isArray(respostaIA?.cartas) ? respostaIA.cartas : [];
  const cartasBase = Array.isArray(base.cartas) ? base.cartas : [];
  const cartas = [...cartasBase, ...extras].map(c => ({
    nome: String(c?.nome ?? '').trim(),
    texto: String(c?.texto ?? '').trim(),
    quantidade: Number(c?.quantidade) || 1,
  }));

  const mudancasBase = Array.isArray(respostaIA?.mudancas) && respostaIA.mudancas.length
    ? respostaIA.mudancas
    : extras.map(c => `Nova carta "${c.nome}" (×${Number(c.quantidade) || 1}): ${c.texto}`);

  return {
    titulo: String(respostaIA?.titulo ?? '').trim() || String(base.titulo ?? 'Jogo expandido'),
    objetivo: String(base.objetivo ?? ''),
    preparacao: Array.isArray(base.preparacao) ? [...base.preparacao] : [],
    turno: Array.isArray(base.turno) ? [...base.turno] : [],
    fim: String(base.fim ?? ''),
    cartas,
    rodada: Array.isArray(respostaIA?.rodada) && respostaIA.rodada.length
      ? respostaIA.rodada
      : (Array.isArray(base.rodada) ? [...base.rodada] : []),
    provocacao: String(respostaIA?.provocacao ?? '').trim() || String(base.provocacao ?? ''),
    mudancas: mudancasBase,
  };
}

export function formatarReferenciaParaPrompt(ref) {
  if (!ref) return '';
  if (ref.origem === 'texto') {
    return [
      `Referência (${ref.nome}):`,
      ref.textoLivre,
    ].join('\n');
  }
  const k = ref.kit || {};
  const cartasTexto = (k.cartas || [])
    .map(c => `- ${c.nome}${c.papel ? ` [${c.papel}]` : ''} (×${c.quantidade || 1}): ${c.texto}`)
    .join('\n');
  return [
    `Jogo de referência: ${ref.nome}`,
    `Resumo: ${ref.resumo || k.objetivo || ''}`,
    `Objetivo: ${k.objetivo || ''}`,
    `Preparação: ${(k.preparacao || []).join(' | ')}`,
    `Turno: ${(k.turno || []).join(' | ')}`,
    `Fim: ${k.fim || ''}`,
    `Cartas existentes:\n${cartasTexto}`,
  ].join('\n');
}
