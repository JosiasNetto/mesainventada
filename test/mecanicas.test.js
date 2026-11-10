import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogo, escolherMecanicas } from '../src/mecanicas.js';

const entrada = { tema: 'espaço', jogadores: 4, duracao: 20, materiais: ['papel', 'caneta', 'dado'], dificuldade: 'facil' };

test('catálogo tem 12+ mecânicas em 5 famílias', () => {
  assert.ok(catalogo.length >= 12);
  assert.equal(new Set(catalogo.map(m => m.familia)).size, 5);
});

test('devolve 3 mecânicas de famílias diferentes', () => {
  const r = escolherMecanicas(entrada, 1);
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map(m => m.familia)).size, 3);
});

test('mesma semente, mesmo resultado; sementes diferentes variam', () => {
  assert.deepEqual(escolherMecanicas(entrada, 7), escolherMecanicas(entrada, 7));
  const vistos = new Set();
  for (let s = 1; s <= 10; s++) vistos.add(escolherMecanicas(entrada, s).map(m => m.id).join());
  assert.ok(vistos.size > 1);
});

test('respeita materiais e número de jogadores', () => {
  const r = escolherMecanicas({ ...entrada, jogadores: 2, materiais: ['papel'] }, 3);
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map(m => m.id)).size, 3);
  for (const m of r) {
    assert.deepEqual(m.precisa, []);
    assert.ok(m.minJogadores <= 2 && 2 <= m.maxJogadores);
  }
});
