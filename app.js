// Cola da tela única: estado, eventos e desenho. A lógica testável mora em src/.
import { catalogo, mecanicaCompativel } from './src/mecanicas.js';
import { materiaisExtras, combinarMateriais } from './src/materiais.js';
import { normalizarJogadores, removerMecanicasIncompativeis, descreverFaixaJogadores } from './src/jogadores.js';
import { buscarReferencias, referenciaDeVersao, referenciaDeTexto, mesclarCartasNoKit } from './src/referencias.js';
import { MODELO_PADRAO, promptKit, promptComReferencias, promptRevisao, chamarLLM, chaveValida, AVISO_CHAVE } from './src/ia.js';
import { validarKit } from './src/validador.js';

const $ = sel => document.querySelector(sel);
const el = (tag, texto, classe) => {
  const e = document.createElement(tag);
  if (texto != null) e.textContent = texto;
  if (classe) e.className = classe;
  return e;
};

// localStorage pode estar bloqueado (aba anônima, navegador do laboratório): a tela segue funcionando, só não lembra.
function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem persistência */ }
}

const projeto = ler('mi:projeto', { sementeMecanicas: 1, atual: -1, versoes: [] });
let selecionadas = [];
let modoAtual = 'novo';
let refsSelecionadas = [];
const MAX_MECANICAS = 5;

const MODOS_INFO = {
  novo: {
    rotuloTema: '1. Qual o tema?',
    placeholder: 'jogo cooperativo sobre espaço... conte o clima, os personagens, o que você quer que aconteça na mesa. Quanto mais detalhes, melhor.',
    botao: 'CRIAR JOGO',
    dica: '',
  },
  'novas-cartas': {
    rotuloTema: '1. Que cartas novas você quer criar?',
    placeholder: 'ex.: 4 cartas de sabotagem para deixar o final mais tenso, ou cartas especiais temáticas...',
    botao: 'GERAR NOVAS CARTAS',
    dica: 'Escolha 1 jogo existente, versão anterior ou cole regras abaixo. As novas cartas serão somadas ao jogo.',
  },
  'novas-regras': {
    rotuloTema: '1. O que mudar ou reinventar nas regras?',
    placeholder: 'ex.: transformar em modo cooperativo contra o relógio, ou adaptar para 2 pessoas...',
    botao: 'CRIAR VARIAÇÃO',
    dica: 'Escolha 1 jogo existente, versão anterior ou cole regras abaixo para adaptar suas regras.',
  },
  inspirado: {
    rotuloTema: '1. Qual o tema do novo jogo?',
    placeholder: 'ex.: entrega espacial caótica reaproveitando a aposta do Truco ou regras de uma versão anterior...',
    botao: 'CRIAR JOGO INSPIRADO',
    dica: 'Escolha até 2 jogos existentes, versões passadas ou cole regras para servir de inspiração estrutural.',
  },
};

const maxReferencias = () => (modoAtual === 'inspirado' ? 2 : 1);

const FAMILIAS = {
  'cooperativo': 'Cooperativo',
  'competitivo': 'Competitivo',
  'informacao-oculta': 'Informação oculta',
  'negociacao': 'Negociação',
  'sorte': 'Sorte',
};

function lerFormulario() {
  const fixos = [...document.querySelectorAll('input[name=material]:checked')].map(i => i.value);
  const extras = materiaisExtras($('#outro-material').value);
  return {
    tema: $('#tema').value.trim(),
    jogadores: normalizarJogadores($('#jogadores').value),
    duracao: Number($('#duracao').value) || 20,
    materiais: combinarMateriais(fixos, extras),
    dificuldade: document.querySelector('input[name=dificuldade]:checked')?.value || 'facil',
  };
}

function ajustarTema() {
  const t = $('#tema');
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight, 420)}px`;
}

function motivoIncompativel(m) {
  const { jogadores, materiais } = lerFormulario();
  const faltam = m.precisa.filter(p => !materiais.includes(p));
  if (faltam.length) return `precisa de ${faltam.join(' e ')}`;
  if (jogadores < m.minJogadores || jogadores > m.maxJogadores)
    return `para ${descreverFaixaJogadores(m.minJogadores, m.maxJogadores)}`;
  return '';
}

function renderMecanicas() {
  const contador = selecionadas.length ? `${selecionadas.length} de ${MAX_MECANICAS} selecionadas` : 'nenhuma selecionada';
  $('#contador-mecanicas').textContent = contador;
  if (!selecionadas.length) {
    $('#mecanicas').replaceChildren(el('p', 'Nenhuma mecânica escolhida ainda. Abra o catálogo completo para ver todas as opções.', 'vazio-mecanicas'));
    return;
  }
  $('#mecanicas').replaceChildren(...selecionadas.map(m => {
    const d = el('div', null, 'mecanica mecanica-selecionada');
    d.append(el('strong', m.nome), el('span', m.descricao));
    const x = el('button', '✕', 'mecanica-remover-x');
    x.type = 'button';
    x.setAttribute('aria-label', `Remover a mecânica ${m.nome}`);
    x.title = 'Remover';
    x.addEventListener('click', () => removerMecanica(m));
    d.append(x);
    return d;
  }));
}

function mostrarAvisoCatalogo(msg) {
  $('#catalogo-aviso').textContent = msg;
  $('#catalogo-aviso').hidden = !msg;
}

function renderCatalogo() {
  const entrada = lerFormulario();
  const familias = [...new Set(catalogo.map(m => m.familia))];
  const blocos = familias.map(fam => {
    const secao = el('section', null, 'catalogo-familia');
    secao.append(el('h3', FAMILIAS[fam] || fam));
    const grade = el('div', null, 'mecanicas');
    catalogo.filter(m => m.familia === fam).forEach(m => {
      const compativel = mecanicaCompativel(m, entrada);
      const escolhida = selecionadas.some(s => s.id === m.id);
      const slot = el('div', null, 'mecanica-slot');
      const b = el('button', null, 'mecanica');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(escolhida));
      b.disabled = !compativel && !escolhida;
      b.append(el('strong', m.nome), el('span', m.descricao));
      if (!compativel) b.append(el('span', `indisponível: ${motivoIncompativel(m)}`, 'mecanica-motivo'));
      if (!escolhida) b.addEventListener('click', () => alternarMecanica(m));
      slot.append(b);
      if (escolhida) {
        const x = el('button', '✕', 'mecanica-remover-x');
        x.type = 'button';
        x.setAttribute('aria-label', `Remover a mecânica ${m.nome}`);
        x.title = 'Remover';
        x.addEventListener('click', () => removerMecanica(m));
        slot.append(x);
      }
      grade.append(slot);
    });
    secao.append(grade);
    return secao;
  });
  $('#catalogo-lista').replaceChildren(...blocos);
  const contador = selecionadas.length ? `${selecionadas.length} de ${MAX_MECANICAS} selecionadas` : 'nenhuma selecionada';
  $('#catalogo-contador').textContent = contador;
}

function removerMecanica(m) {
  selecionadas = selecionadas.filter(s => s.id !== m.id);
  mostrarAvisoCatalogo('');
  renderMecanicas();
  if ($('#catalogo').open) renderCatalogo();
}

function alternarMecanica(m) {
  if (selecionadas.some(s => s.id === m.id)) return;
  if (selecionadas.length < MAX_MECANICAS) selecionadas.push(m);
  else {
    mostrarAvisoCatalogo(`Você já escolheu ${MAX_MECANICAS} mecânicas. Remova uma pelo X para escolher outra.`);
    return;
  }
  mostrarAvisoCatalogo('');
  renderMecanicas();
  if ($('#catalogo').open) renderCatalogo();
}

function podarSelecionadas() {
  const entrada = lerFormulario();
  const { mantidas, removidas } = removerMecanicasIncompativeis(selecionadas, entrada);
  selecionadas = mantidas;
  return removidas;
}

function atualizarEntradaMecanicas() {
  const removidas = podarSelecionadas();
  renderMecanicas();
  if ($('#catalogo').open) renderCatalogo();
  if (removidas.length) {
    const nomes = removidas.map(m => m.nome).join(', ');
    const pessoas = lerFormulario().jogadores;
    const msg = `Mecânica(s) removida(s) porque não combinam com ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'} ou os materiais atuais: ${nomes}.`;
    mostrarAviso(msg);
    if ($('#catalogo').open) mostrarAvisoCatalogo(msg);
  }
}

function sincronizarJogadores() {
  const campo = $('#jogadores');
  const normalizado = normalizarJogadores(campo.value);
  if (String(normalizado) !== campo.value.trim()) campo.value = String(normalizado);
  atualizarEntradaMecanicas();
}

function abrirCatalogo() {
  mostrarAvisoCatalogo('');
  renderCatalogo();
  $('#catalogo').showModal();
}

$('#abrir-catalogo').addEventListener('click', abrirCatalogo);
$('#fechar-catalogo').addEventListener('click', () => $('#catalogo').close());
$('#catalogo-pronto').addEventListener('click', () => $('#catalogo').close());
$('#catalogo').addEventListener('click', e => {
  if (e.target === $('#catalogo')) $('#catalogo').close();
});

$('#exemplo').addEventListener('click', () => {
  $('#tema').value = 'jogo cooperativo sobre exploração espacial';
  $('#jogadores').value = 4;
  $('#duracao').value = 20;
  $('#outro-material').value = '';
  document.querySelectorAll('input[name=material]').forEach(i => { i.checked = true; });
  document.querySelector('input[name=dificuldade][value=facil]').checked = true;
  ajustarTema();
  atualizarEntradaMecanicas();
});

$('#tema').addEventListener('input', ajustarTema);
$('#jogadores').addEventListener('input', () => {
  if ($('#jogadores').value.trim() !== '') atualizarEntradaMecanicas();
});
$('#jogadores').addEventListener('change', sincronizarJogadores);
$('#jogadores').addEventListener('blur', sincronizarJogadores);
document.querySelectorAll('input[name=material]').forEach(i => i.addEventListener('change', atualizarEntradaMecanicas));
$('#outro-material').addEventListener('change', atualizarEntradaMecanicas);

// ---- modo de criação e referências -------------------------------------------

function mostrarAvisoReferencias(msg) {
  $('#referencias-aviso').textContent = msg;
  $('#referencias-aviso').hidden = !msg;
}

function sugerirMecanicasDaReferencia(ref) {
  if (selecionadas.length || !ref?.mecanicasIds?.length) return;
  const entrada = lerFormulario();
  for (const id of ref.mecanicasIds) {
    const mec = catalogo.find(m => m.id === id);
    if (mec && mecanicaCompativel(mec, entrada) && selecionadas.length < MAX_MECANICAS) {
      selecionadas.push(mec);
    }
  }
  renderMecanicas();
}

function removerReferencia(id) {
  refsSelecionadas = refsSelecionadas.filter(r => r.id !== id);
  mostrarAvisoReferencias('');
  renderReferenciasSelecionadas();
  if ($('#dialog-referencias').open) renderModalReferencias();
}

function alternarReferencia(ref) {
  if (refsSelecionadas.some(r => r.id === ref.id)) return;
  const max = maxReferencias();
  if (max === 1) {
    refsSelecionadas = [ref];
  } else if (refsSelecionadas.length < max) {
    refsSelecionadas.push(ref);
  } else {
    mostrarAvisoReferencias(`Neste modo você pode escolher até ${max} referências. Remova uma pelo X para trocar.`);
    return;
  }
  mostrarAvisoReferencias('');
  sugerirMecanicasDaReferencia(ref);
  renderReferenciasSelecionadas();
  if ($('#dialog-referencias').open) renderModalReferencias();
}

function renderReferenciasSelecionadas() {
  const max = maxReferencias();
  const txtContador = refsSelecionadas.length
    ? `${refsSelecionadas.length} de ${max} selecionada(s)`
    : 'nenhuma base selecionada';
  $('#contador-referencias').textContent = txtContador;
  $('#referencias-contador').textContent = txtContador;

  if (!refsSelecionadas.length) {
    $('#referencias-selecionadas').replaceChildren();
    return;
  }
  $('#referencias-selecionadas').replaceChildren(...refsSelecionadas.map(ref => {
    const d = el('div', null, 'mecanica mecanica-selecionada');
    const info = ref.origem === 'versao'
      ? 'Versão desta sessão'
      : `${descreverFaixaJogadores(ref.minJogadores, ref.maxJogadores)} · ${(ref.kit?.cartas || []).length} tipos de carta`;
    d.append(el('strong', ref.nome), el('span', info));
    const x = el('button', '✕', 'mecanica-remover-x');
    x.type = 'button';
    x.setAttribute('aria-label', `Remover a referência ${ref.nome}`);
    x.title = 'Remover';
    x.addEventListener('click', () => removerReferencia(ref.id));
    d.append(x);
    return d;
  }));
}

function criarCardReferencia(ref) {
  const escolhida = refsSelecionadas.some(r => r.id === ref.id);
  const card = el('div', null, 'referencia-card');
  const slot = el('div', null, 'mecanica-slot');
  const b = el('button', null, 'mecanica');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(escolhida));
  const nomesMecs = (ref.mecanicasIds || [])
    .map(id => catalogo.find(m => m.id === id)?.nome || id)
    .join(' + ');
  const meta = `${descreverFaixaJogadores(ref.minJogadores, ref.maxJogadores)}${nomesMecs ? ` · ${nomesMecs}` : ''}`;
  b.append(el('strong', ref.nome), el('span', ref.resumo), el('span', meta, 'semente'));
  if (!escolhida) b.addEventListener('click', () => alternarReferencia(ref));
  slot.append(b);
  if (escolhida) {
    const x = el('button', '✕', 'mecanica-remover-x');
    x.type = 'button';
    x.setAttribute('aria-label', `Remover a referência ${ref.nome}`);
    x.title = 'Remover';
    x.addEventListener('click', () => removerReferencia(ref.id));
    slot.append(x);
  }
  card.append(slot);

  if (ref.kit) {
    const detalhes = el('details', null, 'referencia-detalhes');
    detalhes.append(el('summary', `Ver regras e ${(ref.kit.cartas || []).length} tipos de carta`));
    const prev = el('div', null, 'referencia-preview');
    prev.append(el('p', `Objetivo: ${ref.kit.objetivo || ''}`));
    if (Array.isArray(ref.kit.turno) && ref.kit.turno.length) {
      prev.append(el('p', `Turno: ${ref.kit.turno.join(' → ')}`));
    }
    const ul = el('ul');
    (ref.kit.cartas || []).forEach(c => {
      ul.append(el('li', `${c.nome} (×${c.quantidade || 1}): ${c.texto}`));
    });
    prev.append(ul);
    detalhes.append(prev);
    card.append(detalhes);
  }
  return card;
}

function renderModalReferencias() {
  const termo = ($('#busca-referencias').value || '').trim().toLowerCase();
  const secoes = [];

  const versoesRefs = projeto.versoes
    .map(referenciaDeVersao)
    .filter(Boolean)
    .reverse()
    .filter(r => !termo || r.nome.toLowerCase().includes(termo) || r.resumo.toLowerCase().includes(termo));

  if (versoesRefs.length) {
    const sec = el('section', null, 'catalogo-familia');
    sec.append(el('h3', 'Versões criadas nesta sessão'));
    const grade = el('div', null, 'mecanicas');
    versoesRefs.forEach(r => grade.append(criarCardReferencia(r)));
    sec.append(grade);
    secoes.push(sec);
  }

  const jogos = buscarReferencias(termo);
  const secJogos = el('section', null, 'catalogo-familia');
  secJogos.append(el('h3', 'Jogos existentes mapeados'));
  const gradeJogos = el('div', null, 'mecanicas');
  if (jogos.length) jogos.forEach(r => gradeJogos.append(criarCardReferencia(r)));
  else gradeJogos.append(el('p', 'Nenhum jogo encontrado para essa busca.', 'vazio-mecanicas'));
  secJogos.append(gradeJogos);
  secoes.push(secJogos);

  $('#referencias-lista').replaceChildren(...secoes);
  renderReferenciasSelecionadas();
}

function atualizarModo() {
  modoAtual = document.querySelector('input[name=modo]:checked')?.value || 'novo';
  const info = MODOS_INFO[modoAtual] || MODOS_INFO.novo;
  if (refsSelecionadas.length > maxReferencias()) {
    refsSelecionadas = refsSelecionadas.slice(0, maxReferencias());
  }
  $('#painel-referencias').hidden = modoAtual === 'novo';
  $('#label-tema').textContent = info.rotuloTema;
  $('#tema').placeholder = info.placeholder;
  $('#dica-modo').textContent = info.dica;
  if (!carregando) $('#criar').textContent = info.botao;
  renderReferenciasSelecionadas();
}

document.querySelectorAll('input[name=modo]').forEach(r => r.addEventListener('change', atualizarModo));
$('#abrir-referencias').addEventListener('click', () => {
  mostrarAvisoReferencias('');
  renderModalReferencias();
  $('#dialog-referencias').showModal();
});
$('#busca-referencias').addEventListener('input', renderModalReferencias);
$('#fechar-referencias').addEventListener('click', () => $('#dialog-referencias').close());
$('#referencias-pronto').addEventListener('click', () => $('#dialog-referencias').close());
$('#dialog-referencias').addEventListener('click', e => {
  if (e.target === $('#dialog-referencias')) $('#dialog-referencias').close();
});

function mostrarErroChave(msg) {
  $('#erro-chave').textContent = msg;
  $('#erro-chave').hidden = !msg;
}

function abrirConfig(erro = '') {
  $('#chave').value = ler('mi:chave', '');
  $('#modelo').value = ler('mi:modelo', MODELO_PADRAO);
  mostrarErroChave(erro);
  $('#config').showModal();
}
$('#abrir-config').addEventListener('click', () => abrirConfig());
$('#salvar-config').addEventListener('click', e => {
  const chave = $('#chave').value.trim();
  if (chave && !chaveValida(chave)) { e.preventDefault(); mostrarErroChave(AVISO_CHAVE); return; }
  gravar('mi:chave', chave);
  gravar('mi:modelo', $('#modelo').value.trim() || MODELO_PADRAO);
});

// Sem chave: abre a configuração. Chave salva fora do formato (ex.: copiada da lista do site): abre com a explicação.
function chaveOuConfig() {
  const chave = ler('mi:chave', '');
  if (chaveValida(chave)) return true;
  abrirConfig(chave ? AVISO_CHAVE : '');
  return false;
}

// ---- versões e geração -------------------------------------------------------

const versaoAtual = () => projeto.versoes[projeto.atual];

function adicionarVersao(v) {
  projeto.versoes.push({ n: projeto.versoes.length + 1, criadaEm: new Date().toISOString(), ...v });
  projeto.atual = projeto.versoes.length - 1;
  gravar('mi:projeto', projeto);
}

function mostrarAviso(msg) {
  $('#aviso').textContent = msg;
  $('#aviso').hidden = !msg;
}

let carregando = false;
async function gerar(mensagens, extras, botao = $('#criar')) {
  if (carregando) return;
  carregando = true;
  const rotulo = botao.textContent;
  const inicio = Date.now();
  const tique = () => { botao.textContent = `Criando… ${Math.round((Date.now() - inicio) / 1000)} s`; };
  botao.disabled = true;
  tique();
  const relogio = setInterval(tique, 1000);
  try {
    const semente = Math.floor(Math.random() * 1e6);
    let kit = await chamarLLM({ chave: ler('mi:chave', ''), modelo: ler('mi:modelo', MODELO_PADRAO), mensagens, semente });
    const metaExtras = { ...extras };
    if (metaExtras.modo === 'novas-cartas') {
      if (metaExtras.kitBase) {
        kit = mesclarCartasNoKit(metaExtras.kitBase, kit);
      } else {
        kit = {
          titulo: kit.titulo || `${metaExtras.referenciasNomes?.[0] || 'Jogo'} — Novas cartas`,
          ...kit,
        };
        metaExtras.apenasCartasNovas = !(kit.objetivo && Array.isArray(kit.preparacao) && kit.preparacao.length && Array.isArray(kit.turno) && kit.turno.length);
      }
    }
    delete metaExtras.kitBase;
    adicionarVersao({ ...metaExtras, semente, kit });
    mostrarAviso('');
    render();
  } catch (e) {
    mostrarAviso(e.message);
  } finally {
    clearInterval(relogio);
    botao.disabled = false;
    botao.textContent = rotulo;
    carregando = false;
  }
}

$('#formulario').addEventListener('submit', e => {
  e.preventDefault();
  const entrada = lerFormulario();
  if (!entrada.tema) { mostrarAviso('Escreva um tema ou pedido para a IA (ou clique no exemplo).'); $('#tema').focus(); return; }
  if (modoAtual === 'novo') {
    if (!selecionadas.length) { mostrarAviso('Escolha uma mecânica (ou até cinco para combinar).'); return; }
    if (!chaveOuConfig()) return;
    gerar(promptKit(entrada, selecionadas), { origem: 'gerado', modo: 'novo', entrada, mecanicas: [...selecionadas] });
    return;
  }

  const colada = referenciaDeTexto($('#ref-titulo-livre').value, $('#ref-texto-livre').value);
  const refsParaEnvio = [...refsSelecionadas, ...(colada ? [colada] : [])];
  if (!refsParaEnvio.length) {
    mostrarAviso('Escolha um jogo existente/versão passada ou cole regras no campo de referência.');
    return;
  }
  if (!chaveOuConfig()) return;
  gerar(
    promptComReferencias(entrada, selecionadas, { modo: modoAtual, referencias: refsParaEnvio }),
    {
      origem: 'gerado',
      modo: modoAtual,
      entrada,
      mecanicas: [...selecionadas],
      referenciasNomes: refsParaEnvio.map(r => r.nome),
      kitBase: modoAtual === 'novas-cartas' ? (refsParaEnvio[0].kit || null) : null,
    },
  );
});

// ---- desenho do kit -----------------------------------------------------------

const lista = x => (Array.isArray(x) ? x : []);
const texto = x => String(x ?? '');

function renderKit(kit, alvo, editavel) {
  const k = kit && typeof kit === 'object' ? kit : {};
  const c = (tag, valor, caminho, classe) => {
    const e = el(tag, texto(valor), classe);
    if (editavel) { e.contentEditable = 'plaintext-only'; e.dataset.caminho = caminho; }
    return e;
  };
  const parte = (titulo, ...filhos) => {
    const d = el('div', null, 'parte');
    d.append(el('h4', titulo), ...filhos);
    return d;
  };
  const ol = nome => {
    const o = el('ol');
    lista(k[nome]).forEach((x, i) => o.append(c('li', x, `${nome}.${i}`)));
    return o;
  };

  const regras = el('div', null, 'regras');
  if (lista(k.mudancas).length) {
    const ul = el('ul');
    k.mudancas.forEach(m => ul.append(el('li', texto(m))));
    regras.append(parte('O que mudou', ul));
    regras.lastChild.classList.add('mudancas');
  }
  regras.append(
    c('h3', k.titulo, 'titulo', 'titulo-kit'),
    parte('Objetivo', c('p', k.objetivo, 'objetivo')),
    parte('Preparação', ol('preparacao')),
    parte('Turno', ol('turno')),
    parte('Fim', c('p', k.fim, 'fim')),
  );

  const grade = el('div', null, 'cartas');
  lista(k.cartas).forEach((carta, i) => {
    const cc = carta && typeof carta === 'object' ? carta : { nome: carta };
    const d = el('div', null, 'carta');
    const qtd = el('span', '×', 'carta-qtd');
    qtd.append(c('span', Number(cc.quantidade) || 1, `cartas.${i}.quantidade`));
    d.append(c('strong', cc.nome, `cartas.${i}.nome`, 'carta-nome'), c('p', cc.texto, `cartas.${i}.texto`, 'carta-texto'), qtd);
    if (editavel) {
      const x = el('button', '✕', 'carta-remover');
      x.type = 'button';
      x.dataset.remover = i;
      x.setAttribute('aria-label', `Remover a carta ${texto(cc.nome)}`);
      d.append(x);
    }
    grade.append(d);
  });
  if (editavel) {
    const mais = el('button', '+ carta', 'carta carta-nova');
    mais.type = 'button';
    mais.dataset.acao = 'nova-carta';
    grade.append(mais);
  }

  const rodada = el('div', null, 'nota-amarela rodada');
  rodada.append(el('h4', 'rodada teste'), ol('rodada'));
  const provocacao = el('p', null, 'provocacao');
  provocacao.append(el('span', '❓ ', 'provocacao-icone'), c('span', k.provocacao, 'provocacao'));

  alvo.replaceChildren(regras, parte('Cartas', grade), rodada, provocacao);
}

function renderTravas() {
  const v = versaoAtual();
  const avisos = v ? validarKit(v.kit, v.entrada, v.mecanicas, { apenasCartasNovas: Boolean(v.apenasCartasNovas) }) : [];
  const ul = el('ul');
  avisos.forEach(a => ul.append(el('li', a)));
  const corrigir = el('button', 'Pedir à IA para corrigir', 'botao-secundario');
  corrigir.type = 'button';
  corrigir.id = 'corrigir';
  corrigir.addEventListener('click', () => revisar('Corrija os problemas apontados pelas travas.', corrigir));
  $('#travas').replaceChildren(el('h4', 'Travas: o que conferir antes de imprimir'), ul, corrigir);
  $('#travas').hidden = !avisos.length;
}

// ---- revisão, histórico e comparação ------------------------------------------

async function revisar(relato, botao) {
  const v = versaoAtual();
  if (!v || !chaveOuConfig()) return;
  const avisos = validarKit(v.kit, v.entrada, v.mecanicas, { apenasCartasNovas: Boolean(v.apenasCartasNovas) });
  await gerar(promptRevisao(v.entrada, v.kit, relato, avisos),
    { origem: 'revisado', modo: 'novo', entrada: v.entrada, mecanicas: v.mecanicas, relato }, botao);
  if (versaoAtual() !== v) { $('#relato').value = ''; $('#relato-box').hidden = true; }
}

$('#relatar').addEventListener('click', () => {
  $('#relato-box').hidden = false;
  $('#relato').focus();
});

$('#revisar').addEventListener('click', () => {
  const relato = $('#relato').value.trim();
  if (!relato) { mostrarAviso('Conte o que aconteceu no teste para a IA saber o que revisar.'); $('#relato').focus(); return; }
  revisar(relato, $('#revisar'));
});

function renderHistorico() {
  const ol = el('ol', null, 'versoes');
  projeto.versoes.forEach((v, i) => {
    const li = el('li', null, i === projeto.atual ? 'atual' : '');
    const hora = new Date(v.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tagModo = v.modo && v.modo !== 'novo' ? ` · ${v.modo}` : '';
    const rotulo = el('span', `v${v.n} · ${v.origem}${tagModo} · ${hora}`, 'rotulo-versao');
    rotulo.title = `semente ${v.semente}${v.referenciasNomes?.length ? ` · base: ${v.referenciasNomes.join(', ')}` : ''}${v.relato ? ` · relato: ${v.relato}` : ''}`;
    li.append(rotulo);
    if (i === projeto.atual) li.append(el('span', 'aberta', 'marca-atual'));
    else {
      const abrir = el('button', 'abrir', 'botao-texto');
      abrir.type = 'button';
      abrir.addEventListener('click', () => { projeto.atual = i; gravar('mi:projeto', projeto); render(); });
      const comparar = el('button', 'comparar', 'botao-texto');
      comparar.type = 'button';
      comparar.addEventListener('click', () => compararCom(i));
      li.append(abrir, comparar);
    }
    ol.prepend(li);
  });
  $('#historico').replaceChildren(el('h2', 'Versões'), ol);
  $('#historico').hidden = !projeto.versoes.length;
}

function compararCom(i) {
  const coluna = (v, titulo) => {
    const d = el('div', null, 'coluna-comparacao');
    const kit = el('div', null, 'kit');
    renderKit(v.kit, kit, false);
    d.append(el('h3', titulo, 'rotulo-versao'), kit);
    return d;
  };
  const outra = projeto.versoes[i];
  const atual = versaoAtual();
  const fechar = el('button', 'fechar comparação', 'botao-secundario');
  fechar.type = 'button';
  fechar.addEventListener('click', () => { $('#comparacao').hidden = true; });
  const grade = el('div', null, 'grade-comparacao');
  grade.append(coluna(outra, `v${outra.n} · ${outra.origem}`), coluna(atual, `v${atual.n} · ${atual.origem} (aberta)`));
  const topo = el('div', null, 'topo-comparacao');
  topo.append(el('h2', 'Comparação lado a lado'), fechar);
  $('#comparacao').replaceChildren(topo, grade);
  $('#comparacao').hidden = false;
  $('#comparacao').scrollIntoView({ block: 'start' });
}

// Módulo C — Print & Play: regras numa folha, cartas 63×88 mm em grades 3×3 por folha A4.
function renderImpressao(kit) {
  const k = kit && typeof kit === 'object' ? kit : {};
  const regras = el('div', null, 'pagina pagina-regras');
  const secao = (titulo, ...filhos) => { regras.append(el('h2', titulo), ...filhos); };
  const ol = arr => { const o = el('ol'); lista(arr).forEach(x => o.append(el('li', texto(x)))); return o; };
  regras.append(el('h1', texto(k.titulo)));
  secao('Objetivo', el('p', texto(k.objetivo)));
  secao('Preparação', ol(k.preparacao));
  secao('Turno', ol(k.turno));
  secao('Fim', el('p', texto(k.fim)));
  secao('Exemplo de rodada', ol(k.rodada));
  regras.append(el('p', 'Protótipo feito com MesaInventada. Teste, anote o que deu errado e revise.', 'rodape-impressao'));

  const fisicas = lista(k.cartas).flatMap(c => {
    const cc = c && typeof c === 'object' ? c : { nome: c };
    return Array(Math.min(Number(cc.quantidade) || 1, 20)).fill(cc);
  });
  const paginas = [];
  for (let i = 0; i < fisicas.length; i += 9) {
    const grade = el('div', null, 'grade-cartas');
    fisicas.slice(i, i + 9).forEach(cc => {
      const d = el('div', null, 'carta-impressa');
      d.append(el('strong', texto(cc.nome)), el('p', texto(cc.texto)), el('small', texto(k.titulo)));
      grade.append(d);
    });
    const pagina = el('div', null, 'pagina');
    pagina.append(grade);
    paginas.push(pagina);
  }
  $('#impressao').replaceChildren(regras, ...paginas);
}

$('#baixar-pdf').addEventListener('click', () => window.print());

function render() {
  const v = versaoAtual();
  $('#vazio').hidden = Boolean(v);
  $('#saida').hidden = !v;
  if (v) {
    renderKit(v.kit, $('#kit'), true);
    renderImpressao(v.kit);
  }
  renderTravas();
  renderHistorico();
  $('#comparacao').hidden = true;
}

// ---- edição no lugar ------------------------------------------------------------

function definir(obj, caminho, valor) {
  const partes = caminho.split('.');
  const chave = partes.pop();
  const alvo = partes.reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), obj);
  if (alvo && typeof alvo === 'object') alvo[chave] = chave === 'quantidade' ? Number(valor) || 1 : valor;
}

$('#kit').addEventListener('input', e => {
  const v = versaoAtual();
  const caminho = e.target.dataset?.caminho;
  if (!v || !caminho) return;
  definir(v.kit, caminho, e.target.textContent);
  gravar('mi:projeto', projeto);
  renderTravas();
  renderImpressao(v.kit);
});

$('#kit').addEventListener('click', e => {
  const v = versaoAtual();
  const b = e.target.closest('button');
  if (!v || !b) return;
  if (!Array.isArray(v.kit.cartas)) v.kit.cartas = [];
  if (b.dataset.remover != null) v.kit.cartas.splice(Number(b.dataset.remover), 1);
  else if (b.dataset.acao === 'nova-carta') v.kit.cartas.push({ nome: 'Nova carta', texto: 'Escreva o efeito', quantidade: 1 });
  else return;
  gravar('mi:projeto', projeto);
  render();
});

ajustarTema();
atualizarModo();
renderMecanicas();
render();
