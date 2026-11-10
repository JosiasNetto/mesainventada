import test from 'node:test';
import assert from 'node:assert/strict';
import { validarKit } from '../src/validador.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

test('kit de exemplo passa sem avisos', () => {
  assert.deepEqual(validarKit(kitExemplo, entradaExemplo), []);
});

test('kit vazio ou malformado não quebra', () => {
  const avisos = validarKit({ cartas: 'abc' }, entradaExemplo);
  assert.ok(avisos.some(a => a.includes('"titulo"')));
  assert.ok(avisos.some(a => a.includes('"cartas"')));
  assert.doesNotThrow(() => validarKit(null, entradaExemplo));
});

test('turno longo demais para a dificuldade', () => {
  const k = { ...kitExemplo, turno: ['a', 'b', 'c', 'd'] };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('o limite é 3')));
  assert.deepEqual(validarKit(k, { ...entradaExemplo, dificuldade: 'medio' }), []);
});

test('número de tipos de carta fora de 4 a 12', () => {
  const k = { ...kitExemplo, cartas: kitExemplo.cartas.slice(0, 2) };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('entre 4 e 12')));
});

test('mais de 54 cartas físicas, contando quantidade em texto', () => {
  const k = { ...kitExemplo, cartas: kitExemplo.cartas.map(c => ({ ...c, quantidade: '10' })) };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('limite para imprimir é 54')));
});

test('texto de carta acima de 120 caracteres', () => {
  const k = { ...kitExemplo, cartas: [...kitExemplo.cartas, { nome: 'Longa', texto: 'x'.repeat(121), quantidade: 1 }] };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('"Longa"') && a.includes('121/120')));
});

test('usa material que a pessoa não tem', () => {
  const semDado = validarKit(kitExemplo, { ...entradaExemplo, materiais: ['papel', 'caneta'] });
  assert.ok(semDado.some(a => a.includes('"dado" não está nos materiais')));
  const semCaneta = validarKit(kitExemplo, { ...entradaExemplo, materiais: ['papel', 'dado'] });
  assert.ok(semCaneta.some(a => a.includes('"caneta" não está nos materiais')));
});
