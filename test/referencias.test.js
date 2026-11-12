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
import { validarKit } from '../src/validador.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

const MATERIAIS_VALIDOS = new Set([
  'papel',
  'caneta,papel',
  'dado,papel',
  'caneta,dado,papel',
]);

test('jogosReferencia tem catálogo válido conectado às mecânicas existentes', () => {
  const porId = new Map(catalogo.map(m => [m.id, m]));
  const idsJogos = new Set();
  const mecanicasUsadas = new Set();

  assert.ok(jogosReferencia.length >= 20 && jogosReferencia.length <= 30, `total inesperado: ${jogosReferencia.length}`);

  for (const jogo of jogosReferencia) {
    assert.ok(jogo.id && jogo.nome && jogo.resumo);
    assert.match(jogo.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `id fora de kebab-case: ${jogo.id}`);
    assert.equal(idsJogos.has(jogo.id), false, `id duplicado: ${jogo.id}`);
    idsJogos.add(jogo.id);
    assert.equal(jogo.origem, 'catalogo');
    assert.ok(jogo.minJogadores >= 1 && jogo.maxJogadores <= 8 && jogo.minJogadores <= jogo.maxJogadores);

    assert.ok(Array.isArray(jogo.materiais) && jogo.materiais.includes('papel'), `materiais inválidos em ${jogo.id}`);
    const chaveMateriais = [...new Set(jogo.materiais)].sort().join(',');
    assert.ok(MATERIAIS_VALIDOS.has(chaveMateriais), `combinação de materiais inválida em ${jogo.id}: ${chaveMateriais}`);

    assert.ok(jogo.mecanicasIds.length >= 1);
    for (const id of jogo.mecanicasIds) {
      const mec = porId.get(id);
      assert.ok(mec, `mecânica desconhecida: ${id}`);
      for (const req of mec.precisa) {
        assert.ok(jogo.materiais.includes(req), `${jogo.id} usa "${id}" mas falta material "${req}"`);
      }
      mecanicasUsadas.add(id);
    }

    assert.ok(jogo.kit.titulo && jogo.kit.objetivo && jogo.kit.fim && jogo.kit.provocacao);
    assert.ok(Array.isArray(jogo.kit.preparacao) && jogo.kit.preparacao.length >= 1);
    assert.ok(Array.isArray(jogo.kit.turno) && jogo.kit.turno.length >= 3 && jogo.kit.turno.length <= 5, `turno inválido em ${jogo.id}`);
    assert.ok(Array.isArray(jogo.kit.rodada) && jogo.kit.rodada.length >= 3, `rodada curta em ${jogo.id}`);
    assert.ok(jogo.kit.cartas.length >= 4 && jogo.kit.cartas.length <= 12, `tipos de carta fora de 4..12 em ${jogo.id}: ${jogo.kit.cartas.length}`);

    const totalCartas = jogo.kit.cartas.reduce((s, c) => s + (Number(c.quantidade) || 1), 0);
    assert.ok(totalCartas <= 45, `muitas cartas base em ${jogo.id} (${totalCartas}): deixe folga abaixo de 54`);
    for (const c of jogo.kit.cartas) {
      assert.ok(c.nome && c.papel && c.texto && Number(c.quantidade) >= 1, `carta incompleta em ${jogo.id}`);
      assert.ok(c.texto.length <= 120, `carta longa em ${jogo.id}: ${c.nome} (${c.texto.length})`);
    }

    for (const qtdJogadores of new Set([jogo.minJogadores, jogo.maxJogadores])) {
      const avisos = validarKit(jogo.kit, {
        tema: jogo.nome,
        jogadores: qtdJogadores,
        materiais: jogo.materiais,
        dificuldade: 'medio',
      });
      assert.deepEqual(avisos, [], `avisos de validação em ${jogo.id} (${qtdJogadores} jog.): ${avisos.join('; ')}`);
    }
  }

  for (const m of catalogo) {
    assert.ok(mecanicasUsadas.has(m.id), `mecânica sem jogo de referência: ${m.id}`);
  }
  for (let n = 1; n <= 8; n++) {
    assert.ok(
      jogosReferencia.some(j => j.minJogadores <= n && n <= j.maxJogadores),
      `nenhum jogo cobre exatamente ${n} jogador(es)`,
    );
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
