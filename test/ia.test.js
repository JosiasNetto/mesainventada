import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELO_PADRAO,
  MODELO_IMAGEM_PADRAO,
  orientacaoJogadores,
  promptKit,
  promptComReferencias,
  promptRevisao,
  promptImagemCarta,
  extrairJSON,
  extrairImagem,
  mensagemDeErro,
  chamarLLM,
  chamarLLMComMetricas,
  gerarImagemCarta,
  chaveValida,
  resolverModelo,
  resolverModeloImagem,
} from '../src/ia.js';

import { catalogo } from '../src/mecanicas.js';
import { obterReferencia, referenciaDeTexto } from '../src/referencias.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

const CHAVE = 'sk-proj-' + 'a1'.repeat(24);
const texto = msgs => msgs.map(m => m.content).join('\n');
const resposta = (corpo, ok = true, status = 200) => async () => ({ ok, status, json: async () => corpo });

test('extrairJSON aceita cerca de markdown e texto em volta', () => {
  assert.deepEqual(extrairJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJSON('Aqui está: {"a":{"b":2}} espero que ajude'), { a: { b: 2 } });
});

test('extrairJSON falha com aviso em resposta cortada', () => {
  assert.throws(() => extrairJSON('{"a": [1, 2'), /formato inesperado/);
});

test('mensagemDeErro aponta a configuração da OpenAI', () => {
  assert.match(mensagemDeErro(401), /platform\.openai\.com\/api-keys/);
  assert.match(mensagemDeErro(402), /créditos/i);
  assert.match(mensagemDeErro(404), /gpt-5-mini/);
  assert.match(mensagemDeErro(429), /espere/i);
  assert.match(mensagemDeErro(503), /tente de novo/i);
});

test('promptKit leva tema, jogadores, duração, materiais, mecânicas e o formato', () => {
  const t = texto(promptKit(entradaExemplo, [catalogo[0], catalogo[3]]));
  for (const s of ['exploração espacial', '4 jogadores', '20 minutos', 'papel, caneta, dado',
                   catalogo[0].nome, catalogo[3].nome, 'combine', '"provocacao"', 'no máximo 3 passos'])
    assert.ok(t.includes(s), s);
});

test('promptRevisao leva o kit atual, o relato e as travas', () => {
  const t = texto(promptRevisao(entradaExemplo, kitExemplo, 'ficou fácil demais', ['aviso X']));
  for (const s of ['Oxigênio Zero', 'ficou fácil demais', 'aviso X', '"mudancas"']) assert.ok(t.includes(s), s);
});

test('chamarLLM envia chave, modelo e semente para a OpenAI e devolve o kit', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => { pedido = { url, ...opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(kitExemplo) } }] }) }; };
  const kit = await chamarLLM({ chave: CHAVE, modelo: MODELO_PADRAO, mensagens: [], semente: 42 });
  assert.equal(kit.titulo, 'Oxigênio Zero');
  assert.equal(pedido.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(pedido.headers.Authorization, `Bearer ${CHAVE}`);
  const corpo = JSON.parse(pedido.body);
  assert.equal(corpo.model, MODELO_PADRAO);
  assert.equal(corpo.models, undefined);
  assert.equal(corpo.seed, 42);
  assert.deepEqual(corpo.response_format, { type: 'json_object' });
});

test('resolverModelo usa gpt-5-mini quando vazio e preserva o modelo informado', () => {
  assert.equal(resolverModelo(''), MODELO_PADRAO);
  assert.equal(resolverModelo('gpt-5-nano'), 'gpt-5-nano');
  assert.equal(MODELO_PADRAO, 'gpt-5-mini');
});

test('aviso de erro traz o motivo dado pela OpenAI', async () => {
  globalThis.fetch = resposta({ error: { message: 'Rate limit reached' } }, false, 429);
  await assert.rejects(chamarLLM({ chave: CHAVE, modelo: MODELO_PADRAO, mensagens: [], semente: 1 }), /Espere.*Rate limit reached/s);
});

test('chamarLLM transforma falhas em avisos legíveis', async () => {
  const args = { chave: CHAVE, modelo: MODELO_PADRAO, mensagens: [], semente: 1 };
  globalThis.fetch = resposta({}, false, 401);
  await assert.rejects(chamarLLM(args), /platform\.openai\.com\/api-keys/);
  globalThis.fetch = resposta({ error: { message: 'Provider returned error', code: 502 } });
  await assert.rejects(chamarLLM(args), /tente de novo/i);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(chamarLLM(args), /conexão/);
  globalThis.fetch = async () => { throw new DOMException('t', 'TimeoutError'); };
  await assert.rejects(chamarLLM(args), /90 segundos/);
});

test('chaveValida aceita só chaves completas da OpenAI', () => {
  assert.ok(chaveValida('sk-proj-' + 'a1'.repeat(32)));
  assert.ok(chaveValida('sk-proj-abc_123-XYZ' + 'a1'.repeat(16)));
  assert.ok(chaveValida('sk-' + 'a1'.repeat(24)));
  for (const ruim of ['', 'sk-or-v1-' + 'a1'.repeat(32), 'sk-or-v1-a1b...9f2', 'sk-proj-a1b...9f2', 'sk-abc',
                      '"sk-proj-' + 'a1'.repeat(32) + '"', 'sk-proj-' + 'a1'.repeat(16) + ' ' + 'a1'.repeat(16), 'minha chave'])
    assert.equal(chaveValida(ruim), false, ruim);
});

test('promptKit aceita até cinco mecânicas e pede para combinar todas', () => {
  const cinco = catalogo.slice(0, 5);
  const t = texto(promptKit(entradaExemplo, cinco));
  assert.ok(t.includes('combine todas'));
  for (const m of cinco) assert.ok(t.includes(m.nome), m.nome);
});

test('orientacaoJogadores e promptKit adaptam instruções para solo, dupla e mesa grande', () => {
  assert.match(orientacaoJogadores(1), /solo/i);
  assert.match(orientacaoJogadores(2), /2 jogadores/);
  assert.match(orientacaoJogadores(8), /mesa grande|54 cartas/);

  const soloPrompt = texto(promptKit({ ...entradaExemplo, jogadores: 1 }, [catalogo[0]]));
  assert.ok(soloPrompt.includes('1 jogador'));
  assert.ok(soloPrompt.includes('rodada de teste solo'));
});

test('promptComReferencias monta prompts para novas cartas, novas regras e jogo inspirado', () => {
  const uno = obterReferencia('uno');
  const truco = obterReferencia('truco');
  const colada = referenciaDeTexto('Regra da turma', 'Quem errar o palpite compra 2 cartas.');

  const pCartas = texto(promptComReferencias(
    { ...entradaExemplo, tema: 'cartas de sabotagem cooperativa' },
    [catalogo[0]],
    { modo: 'novas-cartas', referencias: [uno] },
  ));
  assert.ok(pCartas.includes('CARTAS NOVAS'));
  assert.ok(pCartas.includes('Uno'));
  assert.ok(pCartas.includes('sabotagem cooperativa'));

  const pRegras = texto(promptComReferencias(
    { ...entradaExemplo, tema: 'versão cooperativa sem eliminação' },
    [catalogo[0]],
    { modo: 'novas-regras', referencias: [uno] },
  ));
  assert.ok(pRegras.includes('VARIAÇÃO DE REGRAS'));
  assert.ok(pRegras.includes('"mudancas"'));

  const pInspirado = texto(promptComReferencias(
    { ...entradaExemplo, tema: 'entrega espacial caótica' },
    [catalogo[3]],
    { modo: 'inspirado', referencias: [truco, colada] },
  ));
  assert.ok(pInspirado.includes('JOGO NOVO'));
  assert.ok(pInspirado.includes('Truco'));
  assert.ok(pInspirado.includes('Regra da turma'));
});

test('promptImagemCarta descreve a carta, o tema do jogo e proíbe texto na imagem', () => {
  const msgs = promptImagemCarta(
    { nome: 'Tanque de Oxigênio', texto: 'Ganhe 2 de fôlego para a equipe.' },
    kitExemplo,
    entradaExemplo,
  );
  const t = texto(msgs);
  assert.ok(t.includes('Tanque de Oxigênio'));
  assert.ok(t.includes('Oxigênio Zero'));
  assert.ok(t.includes('exploração espacial'));
  assert.match(t, /sem texto|não escreva/i);
});

test('extrairImagem aceita b64_json e URL da OpenAI e falha com aviso legível se ausente', () => {
  const url = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  assert.equal(extrairImagem({ data: [{ b64_json: '/9j/4AAQSkZJRg==' }] }), url);
  assert.equal(extrairImagem({ data: [{ url: 'https://exemplo.com/img.png' }] }), 'https://exemplo.com/img.png');
  assert.throws(() => extrairImagem({ data: [] }), /não gerou uma imagem/i);
});

test('chamarLLMComMetricas devolve kit e métricas de tempo, tokens e custo', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model: MODELO_PADRAO,
      usage: { prompt_tokens: 420, completion_tokens: 680, total_tokens: 1100, cost: 0.0004 },
      choices: [{ message: { content: JSON.stringify(kitExemplo) } }],
    }),
  });
  const res = await chamarLLMComMetricas({ chave: CHAVE, modelo: MODELO_PADRAO, mensagens: [], semente: 7 });
  assert.equal(res.kit.titulo, 'Oxigênio Zero');
  assert.equal(res.metricas.promptTokens, 420);
  assert.equal(res.metricas.completionTokens, 680);
  assert.equal(res.metricas.totalTokens, 1100);
  assert.equal(res.metricas.custoUsd, 0.0004);
  assert.ok(res.metricas.duracaoMs >= 0);
});

test('resolverModeloImagem usa gpt-image-1-mini quando vazio', () => {
  assert.equal(resolverModeloImagem(''), MODELO_IMAGEM_PADRAO);
  assert.equal(resolverModeloImagem('gpt-image-1'), 'gpt-image-1');
  assert.equal(MODELO_IMAGEM_PADRAO, 'gpt-image-1-mini');
});

test('gerarImagemCarta usa /images/generations da OpenAI com a mesma chave', async () => {
  let url;
  let corpo;
  globalThis.fetch = async (destino, opts) => {
    url = destino;
    corpo = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ b64_json: 'abc123' }],
        usage: { input_tokens: 152, output_tokens: 272, total_tokens: 424 },
      }),
    };
  };
  const res = await gerarImagemCarta({
    chave: CHAVE,
    modeloImagem: MODELO_IMAGEM_PADRAO,
    carta: { nome: 'Escudo Solar', texto: 'Bloqueia 1 dano.' },
    kit: kitExemplo,
    entrada: entradaExemplo,
  });
  assert.equal(url, 'https://api.openai.com/v1/images/generations');
  assert.equal(corpo.model, MODELO_IMAGEM_PADRAO);
  assert.equal(corpo.output_format, 'jpeg');
  assert.match(corpo.prompt, /Escudo Solar/);
  assert.equal(res.imagemUrl, 'data:image/jpeg;base64,abc123');
  assert.equal(res.metricas.promptTokens, 152);
  assert.equal(res.metricas.imageTokens, 272);
  assert.ok(res.metricas.custoUsd > 0);
});
