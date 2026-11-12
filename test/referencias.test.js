import test from 'node:test';
import assert from 'node:assert/strict';
import {
  jogosReferencia,
  obterReferencia,
  buscarReferencias,
  referenciaDeVersao,
  referenciaDeTexto,
  mesclarCartasNoKit,
  formatarReferenciaParaPrompt,
} from '../src/referencias.js';
import { catalogo } from '../src/mecanicas.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

test('jogosReferencia tem catálogo válido conectado às mecânicas existentes', () => {
  const idsMecanicas = new Set(catalogo.map(m => m.id));
  const idsJogos = new Set();
  assert.ok(jogosReferencia.length >= 8);
  for (const jogo of jogosReferencia) {
    assert.ok(jogo.id && jogo.nome && jogo.resumo);
    assert.equal(idsJogos.has(jogo.id), false, `id duplicado: ${jogo.id}`);
    idsJogos.add(jogo.id);
    assert.equal(jogo.origem, 'catalogo');
    assert.ok(jogo.minJogadores >= 1 && jogo.maxJogadores <= 8 && jogo.minJogadores <= jogo.maxJogadores);
    assert.ok(jogo.mecanicasIds.length >= 1);
    for (const id of jogo.mecanicasIds) assert.ok(idsMecanicas.has(id), `mecânica desconhecida: ${id}`);
    assert.ok(jogo.kit.titulo && jogo.kit.objetivo && jogo.kit.fim);
    assert.ok(jogo.kit.cartas.length >= 4);
    const totalCartas = jogo.kit.cartas.reduce((s, c) => s + (Number(c.quantidade) || 1), 0);
    assert.ok(totalCartas <= 45, `muitas cartas base em ${jogo.id} (${totalCartas}): deixe folga abaixo de 54`);
    for (const c of jogo.kit.cartas) {
      assert.ok(c.texto.length <= 120, `carta longa em ${jogo.id}: ${c.nome}`);
    }
  }
});

test('obterReferencia e buscarReferencias encontram jogos por nome, resumo ou mecânica', () => {
  assert.equal(obterReferencia('uno')?.nome.includes('Uno'), true);
  assert.equal(obterReferencia('inexistente'), null);
  assert.ok(buscarReferencias('blefe').some(j => j.id === 'coup'));
  assert.ok(buscarReferencias('solo').some(j => j.id === 'expedicao-solo'));
  assert.equal(buscarReferencias('').length, jogosReferencia.length);
});

test('referenciaDeVersao e referenciaDeTexto criam referências válidas', () => {
  const refV = referenciaDeVersao({
    n: 2,
    entrada: entradaExemplo,
    mecanicas: [catalogo[0]],
    kit: kitExemplo,
  });
  assert.equal(refV.origem, 'versao');
  assert.ok(refV.nome.includes('Oxigênio Zero') && refV.nome.includes('v2'));
  assert.deepEqual(refV.mecanicasIds, [catalogo[0].id]);

  assert.equal(referenciaDeTexto('Meu jogo', '   '), null);
  const refT = referenciaDeTexto('Jogo da turma', 'Cada pessoa compra 2 cartas e troca com o vizinho.');
  assert.equal(refT.origem, 'texto');
  assert.match(formatarReferenciaParaPrompt(refT), /Jogo da turma/);
});

test('mesclarCartasNoKit preserva regras base e acrescenta cartas novas com mudanças', () => {
  const base = obterReferencia('uno').kit;
  const mesclado = mesclarCartasNoKit(base, {
    cartas: [{ nome: 'Troca de Mãos', texto: 'Todos passam as cartas para a esquerda.', quantidade: 2 }],
    rodada: ['Ana joga Troca de Mãos.'],
    provocacao: 'E se a troca fosse opcional?',
    mudancas: ['Adicionada carta Troca de Mãos para acelerar viradas.'],
  });
  assert.equal(mesclado.cartas.length, base.cartas.length + 1);
  assert.equal(mesclado.cartas.at(-1).nome, 'Troca de Mãos');
  assert.equal(mesclado.objetivo, base.objetivo);
  assert.deepEqual(mesclado.mudancas, ['Adicionada carta Troca de Mãos para acelerar viradas.']);
});
