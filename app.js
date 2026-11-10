// Cola da tela única: estado, eventos e desenho. A lógica testável mora em src/.
import { escolherMecanicas } from './src/mecanicas.js';
import { MODELO_PADRAO } from './src/ia.js';

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

function lerFormulario() {
  const n = Number($('#jogadores').value) || 4;
  return {
    tema: $('#tema').value.trim(),
    jogadores: Math.min(8, Math.max(2, n)),
    duracao: Number($('#duracao').value) || 20,
    materiais: [...document.querySelectorAll('input[name=material]:checked')].map(i => i.value),
    dificuldade: document.querySelector('input[name=dificuldade]:checked')?.value || 'facil',
  };
}

function renderMecanicas() {
  const oferecidas = escolherMecanicas(lerFormulario(), projeto.sementeMecanicas);
  selecionadas = selecionadas.filter(s => oferecidas.some(o => o.id === s.id));
  $('#mecanicas').replaceChildren(...oferecidas.map(m => {
    const b = el('button', null, 'mecanica');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(selecionadas.some(s => s.id === m.id)));
    b.append(el('strong', m.nome), el('span', m.descricao));
    b.addEventListener('click', () => alternarMecanica(m));
    return b;
  }));
  $('#semente').textContent = projeto.sementeMecanicas;
}

function alternarMecanica(m) {
  const i = selecionadas.findIndex(s => s.id === m.id);
  if (i >= 0) selecionadas.splice(i, 1);
  else if (selecionadas.length < 2) selecionadas.push(m);
  else selecionadas[1] = m;
  renderMecanicas();
}

$('#outras').addEventListener('click', () => {
  projeto.sementeMecanicas++;
  gravar('mi:projeto', projeto);
  renderMecanicas();
});

$('#exemplo').addEventListener('click', () => {
  $('#tema').value = 'jogo cooperativo sobre exploração espacial';
  $('#jogadores').value = 4;
  $('#duracao').value = 20;
  document.querySelectorAll('input[name=material]').forEach(i => { i.checked = true; });
  document.querySelector('input[name=dificuldade][value=facil]').checked = true;
  renderMecanicas();
});

$('#jogadores').addEventListener('change', renderMecanicas);
document.querySelectorAll('input[name=material]').forEach(i => i.addEventListener('change', renderMecanicas));

function abrirConfig() {
  $('#chave').value = ler('mi:chave', '');
  $('#modelo').value = ler('mi:modelo', MODELO_PADRAO);
  $('#config').showModal();
}
$('#abrir-config').addEventListener('click', abrirConfig);
$('#salvar-config').addEventListener('click', () => {
  gravar('mi:chave', $('#chave').value.trim());
  gravar('mi:modelo', $('#modelo').value.trim() || MODELO_PADRAO);
});

renderMecanicas();
