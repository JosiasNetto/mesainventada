// Cola da tela única: estado, eventos e desenho. A lógica testável mora em src/.
import { catalogo, mecanicaCompativel } from './src/mecanicas.js';
import { materiaisExtras, combinarMateriais } from './src/materiais.js';
import { normalizarJogadores, removerMecanicasIncompativeis, descreverFaixaJogadores } from './src/jogadores.js';
import {
  MODELO_PADRAO,
  MODELO_IMAGEM_PADRAO,
  promptKit,
  promptRevisao,
  chamarLLMComMetricas,
  gerarImagemCarta,
  chaveValida,
  AVISO_CHAVE,
} from './src/ia.js';
import {
  resumirCustosVersao,
  formatarResumoMetricas,
  formatarSegundos,
  formatarUsd,
  formatarBrl,
} from './src/custos.js';
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
const MAX_MECANICAS = 5;

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

function mostrarErroChave(msg) {
  $('#erro-chave').textContent = msg;
  $('#erro-chave').hidden = !msg;
}

function abrirConfig(erro = '') {
  $('#chave').value = ler('mi:chave', '');
  $('#modelo').value = ler('mi:modelo', MODELO_PADRAO);
  if ($('#modelo-imagem')) $('#modelo-imagem').value = ler('mi:modelo-imagem', MODELO_IMAGEM_PADRAO);
  mostrarErroChave(erro);
  $('#config').showModal();
}
$('#abrir-config').addEventListener('click', () => abrirConfig());
$('#salvar-config').addEventListener('click', e => {
  const chave = $('#chave').value.trim();
  if (chave && !chaveValida(chave)) { e.preventDefault(); mostrarErroChave(AVISO_CHAVE); return; }
  gravar('mi:chave', chave);
  gravar('mi:modelo', $('#modelo').value.trim() || MODELO_PADRAO);
  if ($('#modelo-imagem')) gravar('mi:modelo-imagem', $('#modelo-imagem').value.trim() || MODELO_IMAGEM_PADRAO);
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
let progressoIlustracao = '';
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
    const anterior = versaoAtual();
    const { kit, metricas } = await chamarLLMComMetricas({
      chave: ler('mi:chave', ''),
      modelo: ler('mi:modelo', MODELO_PADRAO),
      mensagens,
      semente,
    });
    if (extras.origem === 'revisado' && Array.isArray(anterior?.kit?.cartas) && Array.isArray(kit?.cartas)) {
      const artesPorNome = new Map(
        anterior.kit.cartas
          .filter(c => c && typeof c === 'object' && c.nome && c.imagem)
          .map(c => [String(c.nome).trim().toLowerCase(), c.imagem]),
      );
      kit.cartas.forEach(c => {
        if (c && typeof c === 'object' && !c.imagem) {
          const arte = artesPorNome.get(String(c.nome ?? '').trim().toLowerCase());
          if (arte) c.imagem = arte;
        }
      });
    }
    adicionarVersao({ ...extras, semente, kit, metricas, metricasImagens: [] });
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

async function compactarImagem(dataUrl, maxLado = 360, qualidade = 0.76) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const maior = Math.max(img.width || 1, img.height || 1);
        const escala = maior > maxLado ? maxLado / maior : 1;
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function ilustrarUmaCarta(indice, botao) {
  const v = versaoAtual();
  if (!v || carregando || !chaveOuConfig()) return;
  const carta = v.kit?.cartas?.[indice];
  if (!carta || typeof carta !== 'object') return;
  carregando = true;
  const rotulo = botao ? botao.textContent : '';
  const inicio = Date.now();
  const tique = () => {
    if (botao) botao.textContent = `🎨 ${Math.round((Date.now() - inicio) / 1000)} s`;
  };
  if (botao) botao.disabled = true;
  tique();
  const relogio = setInterval(tique, 1000);
  try {
    const { imagemUrl, metricas } = await gerarImagemCarta({
      chave: ler('mi:chave', ''),
      modeloImagem: ler('mi:modelo-imagem', MODELO_IMAGEM_PADRAO),
      carta,
      kit: v.kit,
      entrada: v.entrada,
    });
    carta.imagem = await compactarImagem(imagemUrl);
    if (!Array.isArray(v.metricasImagens)) v.metricasImagens = [];
    v.metricasImagens.push(metricas);
    gravar('mi:projeto', projeto);
    mostrarAviso('');
    render();
  } catch (e) {
    mostrarAviso(e.message);
  } finally {
    clearInterval(relogio);
    if (botao) {
      botao.disabled = false;
      botao.textContent = rotulo;
    }
    carregando = false;
  }
}

async function ilustrarTodasAsCartas() {
  const v = versaoAtual();
  if (!v || carregando || !chaveOuConfig()) return;
  const cartas = Array.isArray(v.kit?.cartas) ? v.kit.cartas.filter(c => c && typeof c === 'object') : [];
  if (!cartas.length) return;
  const pendentes = cartas.some(c => !c.imagem) ? cartas.filter(c => !c.imagem) : cartas;
  carregando = true;
  const atualizarBotao = texto => {
    progressoIlustracao = texto;
    const b = $('#kit button[data-acao="ilustrar-todas"]');
    if (b) {
      b.disabled = true;
      b.textContent = texto;
    }
  };
  try {
    for (let idx = 0; idx < pendentes.length; idx++) {
      const carta = pendentes[idx];
      atualizarBotao(`🎨 Ilustrando ${idx + 1}/${pendentes.length}…`);
      const { imagemUrl, metricas } = await gerarImagemCarta({
        chave: ler('mi:chave', ''),
        modeloImagem: ler('mi:modelo-imagem', MODELO_IMAGEM_PADRAO),
        carta,
        kit: v.kit,
        entrada: v.entrada,
      });
      carta.imagem = await compactarImagem(imagemUrl);
      if (!Array.isArray(v.metricasImagens)) v.metricasImagens = [];
      v.metricasImagens.push(metricas);
      gravar('mi:projeto', projeto);
      render();
    }
    mostrarAviso('');
  } catch (e) {
    mostrarAviso(e.message);
  } finally {
    progressoIlustracao = '';
    carregando = false;
    render();
  }
}

$('#formulario').addEventListener('submit', e => {
  e.preventDefault();
  const entrada = lerFormulario();
  if (!entrada.tema) { mostrarAviso('Escreva um tema para o jogo (ou clique no exemplo).'); $('#tema').focus(); return; }
  if (!selecionadas.length) { mostrarAviso('Escolha uma mecânica (ou até cinco para combinar).'); return; }
  if (!chaveOuConfig()) return;
  gerar(promptKit(entrada, selecionadas), { origem: 'gerado', entrada, mecanicas: [...selecionadas] });
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
  const listaCartas = lista(k.cartas);
  listaCartas.forEach((carta, i) => {
    const cc = carta && typeof carta === 'object' ? carta : { nome: carta };
    const temArte = Boolean(cc.imagem);
    const d = el('div', null, temArte ? 'carta carta-com-arte' : 'carta');
    d.append(c('strong', cc.nome, `cartas.${i}.nome`, 'carta-nome'));
    if (temArte) {
      const moldura = el('div', null, 'carta-arte');
      const img = el('img');
      img.src = String(cc.imagem);
      img.alt = `Ilustração da carta ${texto(cc.nome)}`;
      img.loading = 'lazy';
      moldura.append(img);
      d.append(moldura);
    }
    d.append(c('p', cc.texto, `cartas.${i}.texto`, 'carta-texto'));
    const rodape = el('div', null, 'carta-rodape');
    if (editavel) {
      const acoesArte = el('div', null, 'carta-acoes-arte');
      const btnArte = el('button', temArte ? '↻ arte' : '🎨 ilustrar', 'botao-arte-carta');
      btnArte.type = 'button';
      btnArte.dataset.ilustrar = i;
      btnArte.disabled = carregando;
      btnArte.title = temArte ? 'Gerar outra ilustração para esta carta' : 'Gerar ilustração com IA para esta carta';
      acoesArte.append(btnArte);
      if (temArte) {
        const btnSemArte = el('button', '✕', 'botao-remover-arte');
        btnSemArte.type = 'button';
        btnSemArte.dataset.removerArte = i;
        btnSemArte.title = 'Remover ilustração desta carta';
        btnSemArte.setAttribute('aria-label', `Remover ilustração da carta ${texto(cc.nome)}`);
        acoesArte.append(btnSemArte);
      }
      rodape.append(acoesArte);
    } else {
      rodape.append(el('span'));
    }
    const qtd = el('span', '×', 'carta-qtd');
    qtd.append(c('span', Number(cc.quantidade) || 1, `cartas.${i}.quantidade`));
    rodape.append(qtd);
    d.append(rodape);
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

  const secaoCartas = el('div', null, 'parte');
  if (editavel && listaCartas.length) {
    const ilustradas = listaCartas.filter(cc => cc && typeof cc === 'object' && cc.imagem).length;
    const topoCartas = el('div', null, 'topo-cartas');
    topoCartas.append(el('h4', `Cartas (${ilustradas}/${listaCartas.length} ilustradas)`));
    const acoesTopo = el('div', null, 'acoes-topo-cartas');
    const btnTodas = el(
      'button',
      progressoIlustracao || (ilustradas === listaCartas.length ? '↻ Reilustrar todas as cartas' : '🎨 Ilustrar todas as cartas'),
      'botao-ilustrar-todas',
    );
    btnTodas.type = 'button';
    btnTodas.dataset.acao = 'ilustrar-todas';
    btnTodas.disabled = carregando;
    acoesTopo.append(btnTodas);
    topoCartas.append(acoesTopo);
    secaoCartas.append(topoCartas, grade);
  } else {
    secaoCartas.append(el('h4', 'Cartas'), grade);
  }

  const rodada = el('div', null, 'nota-amarela rodada');
  rodada.append(el('h4', 'rodada teste'), ol('rodada'));
  const provocacao = el('p', null, 'provocacao');
  provocacao.append(el('span', '❓ ', 'provocacao-icone'), c('span', k.provocacao, 'provocacao'));

  alvo.replaceChildren(regras, secaoCartas, rodada, provocacao);
}

function renderTravas() {
  const v = versaoAtual();
  const avisos = v ? validarKit(v.kit, v.entrada, v.mecanicas) : [];
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
  await gerar(promptRevisao(v.entrada, v.kit, relato, validarKit(v.kit, v.entrada, v.mecanicas)),
    { origem: 'revisado', entrada: v.entrada, mecanicas: v.mecanicas, relato }, botao);
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

function renderMetricas() {
  const caixa = $('#metricas');
  if (!caixa) return;
  const v = versaoAtual();
  if (!v) {
    caixa.hidden = true;
    return;
  }
  const r = resumirCustosVersao(v);
  const temDados = r.total.duracaoMs > 0 || r.total.totalTokens > 0 || r.imagens.quantidade > 0;
  if (!temDados) {
    caixa.hidden = true;
    return;
  }

  const criarBloco = (titulo, valor, detalhe) => {
    const b = el('div', null, 'metrica-bloco');
    b.append(el('strong', titulo), el('span', valor, 'metrica-valor'), el('span', detalhe, 'metrica-detalhe'));
    return b;
  };

  const grade = el('div', null, 'metricas-grade');
  grade.append(
    criarBloco(
      'Texto (regras e cartas)',
      `${formatarSegundos(r.texto.duracaoMs)} · ${formatarUsd(r.texto.custoUsd)}`,
      `${r.texto.totalTokens} tokens (${r.texto.promptTokens} entrada + ${r.texto.completionTokens} saída)${r.texto.modelo ? ` · ${r.texto.modelo}` : ''}`,
    ),
    criarBloco(
      `Imagens geradas (${r.imagens.quantidade})`,
      `${formatarSegundos(r.imagens.duracaoMs)} · ${formatarUsd(r.imagens.custoUsd)}`,
      r.imagens.quantidade
        ? `${r.imagens.totalTokens} tokens (${r.imagens.imageTokens} de imagem)${r.imagens.modelos.length ? ` · ${r.imagens.modelos.join(', ')}` : ''}`
        : 'Nenhuma carta ilustrada ainda nesta versão.',
    ),
    criarBloco(
      'Total do artefato',
      `${formatarSegundos(r.total.duracaoMs)} · ${formatarUsd(r.total.custoUsd)}`,
      `Equivalente a ${formatarBrl(r.total.custoBrl)} · ${r.total.totalTokens} tokens totais`,
    ),
  );

  const orcamento = el(
    'p',
    r.estimativaOrcamento.kitsNoOrcamento != null
      ? `No orçamento de US$ ${r.estimativaOrcamento.orcamentoUsd.toFixed(2).replace('.', ',')} da chave da turma, cabem cerca de ${r.estimativaOrcamento.kitsNoOrcamento} artefatos com este perfil de custo.`
      : 'Geração com custo zero na API (modelo gratuito sem imagens pagas).',
    'metricas-orcamento',
  );

  caixa.replaceChildren(
    el('h4', `⏱ Avaliação de tempo e custo deste artefato (v${v.n})`),
    grade,
    orcamento,
  );
  caixa.hidden = false;
}

function renderHistorico() {
  const ol = el('ol', null, 'versoes');
  projeto.versoes.forEach((v, i) => {
    const li = el('li', null, i === projeto.atual ? 'atual' : '');
    const hora = new Date(v.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const rotulo = el('span', `v${v.n} · ${v.origem} · ${hora}`, 'rotulo-versao');
    rotulo.title = `semente ${v.semente}${v.relato ? ` · relato: ${v.relato}` : ''}`;
    li.append(rotulo);
    const resumo = resumirCustosVersao(v);
    if (resumo.total.duracaoMs > 0 || resumo.total.totalTokens > 0 || resumo.imagens.quantidade > 0) {
      li.append(el('span', formatarResumoMetricas(resumo).curto, 'metricas-versao'));
    }
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
      d.append(el('strong', texto(cc.nome)));
      if (cc.imagem) {
        const img = el('img', null, 'carta-impressa-arte');
        img.src = String(cc.imagem);
        img.alt = '';
        d.append(img);
      }
      d.append(el('p', texto(cc.texto)), el('small', texto(k.titulo)));
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
  renderMetricas();
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
  if (b.dataset.ilustrar != null) { ilustrarUmaCarta(Number(b.dataset.ilustrar), b); return; }
  if (b.dataset.acao === 'ilustrar-todas') { ilustrarTodasAsCartas(b); return; }
  if (b.dataset.removerArte != null) {
    const carta = v.kit.cartas[Number(b.dataset.removerArte)];
    if (carta && typeof carta === 'object') delete carta.imagem;
  } else if (b.dataset.remover != null) v.kit.cartas.splice(Number(b.dataset.remover), 1);
  else if (b.dataset.acao === 'nova-carta') v.kit.cartas.push({ nome: 'Nova carta', texto: 'Escreva o efeito', quantidade: 1 });
  else return;
  gravar('mi:projeto', projeto);
  render();
});

ajustarTema();
renderMecanicas();
render();
