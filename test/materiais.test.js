import test from 'node:test';
import assert from 'node:assert/strict';
import { materiaisExtras, combinarMateriais } from '../src/materiais.js';

test('materiaisExtras separa por vírgula, ponto e vírgula e linha', () => {
  assert.deepEqual(materiaisExtras('moedas, barbante; tampinhas\nclipes'), ['moedas', 'barbante', 'tampinhas', 'clipes']);
});

test('materiaisExtras ignora vazios, espaços e normaliza para minúsculas', () => {
  assert.deepEqual(materiaisExtras('  Dado ,, Caneta ;  '), ['dado', 'caneta']);
  assert.deepEqual(materiaisExtras(''), []);
  assert.deepEqual(materiaisExtras(null), []);
});

test('combinarMateriais junta sem repetir', () => {
  assert.deepEqual(combinarMateriais(['papel', 'caneta'], ['caneta', 'moedas']), ['papel', 'caneta', 'moedas']);
  assert.deepEqual(combinarMateriais(['papel'], []), ['papel']);
});
