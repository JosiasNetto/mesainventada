import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_JOGADORES,
  MAX_JOGADORES,
  JOGADORES_PADRAO,
  normalizarJogadores,
  removerMecanicasIncompativeis,
  descreverFaixaJogadores,
} from '../src/jogadores.js';
import { catalogo } from '../src/mecanicas.js';

test('normalizarJogadores mantém inteiros entre 1 e 8', () => {
  assert.equal(MIN_JOGADORES, 1);
  assert.equal(MAX_JOGADORES, 8);
  for (let n = 1; n <= 8; n++) assert.equal(normalizarJogadores(n), n);
  assert.equal(normalizarJogadores('1'), 1);
  assert.equal(normalizarJogadores('8'), 8);
});

test('normalizarJogadores limita 0, negativos, decimais e valores acima de 8', () => {
  assert.equal(normalizarJogadores(0), 1);
  assert.equal(normalizarJogadores('0'), 1);
  assert.equal(normalizarJogadores(-5), 1);
  assert.equal(normalizarJogadores(12), 8);
  assert.equal(normalizarJogadores(3.6), 4);
  assert.equal(normalizarJogadores(2.2), 2);
});

test('normalizarJogadores usa padrão apenas para vazio ou inválido', () => {
  assert.equal(normalizarJogadores(''), JOGADORES_PADRAO);
  assert.equal(normalizarJogadores(null), JOGADORES_PADRAO);
  assert.equal(normalizarJogadores(undefined), JOGADORES_PADRAO);
  assert.equal(normalizarJogadores('abc'), JOGADORES_PADRAO);
});

test('removerMecanicasIncompativeis separa mantidas e removidas', () => {
  const solo = catalogo.find(m => m.id === 'gestao-recursos');
  const papeis = catalogo.find(m => m.id === 'papeis-secretos');
  const { mantidas, removidas } = removerMecanicasIncompativeis([solo, papeis], {
    jogadores: 1,
    materiais: ['papel', 'caneta', 'dado'],
  });
  assert.deepEqual(mantidas.map(m => m.id), ['gestao-recursos']);
  assert.deepEqual(removidas.map(m => m.id), ['papeis-secretos']);
});

test('descreverFaixaJogadores formata singular e intervalo', () => {
  assert.equal(descreverFaixaJogadores(1, 1), '1 pessoa (solo)');
  assert.equal(descreverFaixaJogadores(2, 2), '2 pessoas');
  assert.equal(descreverFaixaJogadores(1, 6), '1 a 6 pessoas');
});
