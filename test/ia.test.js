import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELO_PADRAO,
  MODELO_PADRAO_OPENAI,
  MODELO_IMAGEM_PADRAO,
  MODELO_IMAGEM_PADRAO_OPENAI,
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
  modeloEscolhido,
  modeloImagemEscolhido,
  kitSemImagens,
  promptAvaliacao,
  normalizarAvaliacao,
  avaliarKit,
  CRITERIOS_RUBRICA,
  MODELO_AVALIADOR_OPENAI,
} from '../src/ia.js';

import { catalogo } from '../src/mecanicas.js';
import { obterReferencia, referenciaDeTexto } from '../src/referencias.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

const texto = msgs => msgs.map(m => m.content).join('\n');
const resposta = (corpo, ok = true, status = 200) => async () => ({ ok, status, json: async () => corpo });

test('extrairJSON aceita cerca de markdown e texto em volta', () => {
  assert.deepEqual(extrairJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJSON('Aqui está: {"a":{"b":2}} espero que ajude'), { a: { b: 2 } });
});

test('extrairJSON falha com aviso em resposta cortada', () => {
  assert.throws(() => extrairJSON('{"a": [1, 2'), /formato inesperado/);
});

test('mensagemDeErro diz o que fazer', () => {
  assert.match(mensagemDeErro(401), /openrouter\.ai\/keys/);
  assert.match(mensagemDeErro(402), /:free/);
  assert.match(mensagemDeErro(404), /openrouter\/free/);
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

test('chamarLLM envia chave, modelo e semente e devolve o kit', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => { pedido = { url, ...opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(kitExemplo) } }] }) }; };
  const kit = await chamarLLM({ chave: 'sk-or-x', modelo: MODELO_PADRAO, mensagens: [], semente: 42 });
  assert.equal(kit.titulo, 'Oxigênio Zero');
  assert.equal(pedido.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(pedido.headers.Authorization, 'Bearer sk-or-x');
  const corpo = JSON.parse(pedido.body);
  assert.equal(corpo.models[0], MODELO_PADRAO);
  assert.equal(corpo.seed, 42);
  assert.deepEqual(corpo.response_format, { type: 'json_object' });
});

test('chamarLLM manda modelos grátis de reserva para quando o escolhido estiver saturado', async () => {
  let corpo;
  globalThis.fetch = async (url, opts) => { corpo = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(kitExemplo) } }] }) }; };
  await chamarLLM({ chave: 'x', modelo: 'google/gemma-4-31b-it:free', mensagens: [], semente: 1 });
  assert.equal(corpo.models[0], 'google/gemma-4-31b-it:free');
  assert.ok(corpo.models.includes('openrouter/free'));
  assert.ok(corpo.models.length <= 3);
  assert.equal(new Set(corpo.models).size, corpo.models.length);
  assert.ok(corpo.models.every(m => m.endsWith(':free') || m === 'openrouter/free'));
});

test('aviso de erro traz o motivo dado pela OpenRouter', async () => {
  globalThis.fetch = resposta({ error: { message: 'Model is temporarily rate-limited upstream' } }, false, 429);
  await assert.rejects(chamarLLM({ chave: 'x', modelo: 'm', mensagens: [], semente: 1 }), /Espere.*rate-limited upstream/s);
});

test('chamarLLM transforma falhas em avisos legíveis', async () => {
  const args = { chave: 'x', modelo: 'm', mensagens: [], semente: 1 };
  globalThis.fetch = resposta({}, false, 401);
  await assert.rejects(chamarLLM(args), /openrouter\.ai\/keys/);
  globalThis.fetch = resposta({ error: { message: 'Provider returned error', code: 502 } });
  await assert.rejects(chamarLLM(args), /tente de novo/i);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(chamarLLM(args), /conexão/);
  globalThis.fetch = async () => { throw new DOMException('t', 'TimeoutError'); };
  await assert.rejects(chamarLLM(args), /90 segundos/);
});

test('chaveValida aceita chaves completas da OpenRouter e da OpenAI e recusa chaves truncadas', () => {
  assert.ok(chaveValida('sk-or-v1-' + 'a1'.repeat(32)));
  assert.ok(chaveValida('sk-proj-' + 'a1'.repeat(32)));
  assert.ok(chaveValida('sk-proj-abc_123-XYZ' + 'a1'.repeat(16)));
  assert.ok(chaveValida('sk-' + 'a1'.repeat(24)));
  for (const ruim of ['', 'sk-or-v1-a1b...9f2', 'sk-or-v1-a1b…9f2', 'sk-proj-a1b...9f2', 'sk-or-v1-abc', 'sk-abc',
                      '"sk-or-v1-' + 'a1'.repeat(32) + '"', 'sk-or-v1-' + 'a1'.repeat(16) + ' ' + 'a1'.repeat(16), 'minha chave'])
    assert.equal(chaveValida(ruim), false, ruim);
});

test('chamarLLM com chave da OpenAI usa endpoint e formato da OpenAI', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => {
    pedido = { url, ...opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(kitExemplo) } }] }) };
  };
  const chaveOpenAI = 'sk-proj-' + 'a1'.repeat(24);
  const kit = await chamarLLM({ chave: chaveOpenAI, modelo: MODELO_PADRAO, mensagens: [], semente: 7 });
  assert.equal(kit.titulo, 'Oxigênio Zero');
  assert.equal(pedido.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(pedido.headers.Authorization, `Bearer ${chaveOpenAI}`);
  const corpo = JSON.parse(pedido.body);
  assert.equal(corpo.model, MODELO_PADRAO_OPENAI);
  assert.equal(corpo.models, undefined);
  assert.equal(corpo.seed, 7);
  assert.deepEqual(corpo.response_format, { type: 'json_object' });
  assert.equal(resolverModelo('gpt-4o', chaveOpenAI), 'gpt-4o');
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

test('extrairImagem aceita formato images da OpenRouter e falha com aviso legível se ausente', () => {
  const url = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  assert.equal(
    extrairImagem({ choices: [{ message: { images: [{ type: 'image_url', image_url: { url } }] } }] }),
    url,
  );
  assert.throws(() => extrairImagem({ choices: [{ message: { content: 'sem imagem' } }] }), /não gerou uma imagem/i);
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
  const res = await chamarLLMComMetricas({ chave: 'sk-or-x', modelo: MODELO_PADRAO, mensagens: [], semente: 7 });
  assert.equal(res.kit.titulo, 'Oxigênio Zero');
  assert.equal(res.metricas.promptTokens, 420);
  assert.equal(res.metricas.completionTokens, 680);
  assert.equal(res.metricas.totalTokens, 1100);
  assert.equal(res.metricas.custoUsd, 0.0004);
  assert.ok(res.metricas.duracaoMs >= 0);
});

test('gerarImagemCarta envia modalities com image e devolve imagemUrl e métricas', async () => {
  let corpo;
  const imgFake = 'data:image/jpeg;base64,abc123';
  globalThis.fetch = async (url, opts) => {
    corpo = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: MODELO_IMAGEM_PADRAO,
        usage: {
          prompt_tokens: 34,
          completion_tokens: 1120,
          total_tokens: 1154,
          cost: 0.0336,
          completion_tokens_details: { image_tokens: 1120 },
        },
        choices: [{ message: { images: [{ type: 'image_url', image_url: { url: imgFake } }] } }],
      }),
    };
  };
  const res = await gerarImagemCarta({
    chave: 'sk-or-x',
    modeloImagem: MODELO_IMAGEM_PADRAO,
    carta: { nome: 'Escudo Solar', texto: 'Bloqueia 1 dano.' },
    kit: kitExemplo,
    entrada: entradaExemplo,
  });
  assert.deepEqual(corpo.modalities, ['image', 'text']);
  assert.equal(corpo.models[0], MODELO_IMAGEM_PADRAO);
  assert.equal(res.imagemUrl, imgFake);
  assert.equal(res.metricas.imageTokens, 1120);
  assert.equal(res.metricas.custoUsd, 0.0336);

});

test('gerarImagemCarta com chave da OpenAI usa a API de imagens da OpenAI e calcula o custo', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => {
    pedido = { url, ...opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: 'abc123' }], usage: { input_tokens: 150, output_tokens: 272, total_tokens: 422 } }),
    };
  };
  const chaveOpenAI = 'sk-proj-' + 'a1'.repeat(24);
  const res = await gerarImagemCarta({
    chave: chaveOpenAI,
    modeloImagem: MODELO_IMAGEM_PADRAO,
    carta: { nome: 'Escudo Solar', texto: 'Bloqueia 1 dano.' },
    kit: kitExemplo,
    entrada: entradaExemplo,
  });
  assert.equal(pedido.url, 'https://api.openai.com/v1/images/generations');
  assert.equal(pedido.headers.Authorization, `Bearer ${chaveOpenAI}`);
  const corpo = JSON.parse(pedido.body);
  assert.equal(corpo.model, MODELO_IMAGEM_PADRAO_OPENAI);
  assert.ok(corpo.prompt.includes('Escudo Solar'));
  assert.equal(res.imagemUrl, 'data:image/jpeg;base64,abc123');
  assert.equal(res.metricas.cartaNome, 'Escudo Solar');
  assert.equal(res.metricas.imageTokens, 272);
  assert.equal(res.metricas.totalTokens, 422);
  assert.equal(res.metricas.custoUsd, (150 * 2 + 272 * 8) / 1e6);
});

test('gerarImagemCarta com chave da OpenAI devolve aviso legível quando a API recusa', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Incorrect API key' } }) });
  await assert.rejects(
    gerarImagemCarta({ chave: 'sk-proj-' + 'a1'.repeat(24), carta: { nome: 'X' }, kit: kitExemplo, entrada: entradaExemplo }),
    /OpenAI: Incorrect API key/,
  );
});

test('resolverModeloImagem troca o modelo conforme o provedor da chave', () => {
  const chaveOpenAI = 'sk-proj-' + 'a1'.repeat(24);
  const chaveOpenRouter = 'sk-or-v1-' + 'a1'.repeat(32);
  assert.equal(resolverModeloImagem(MODELO_IMAGEM_PADRAO, chaveOpenAI), MODELO_IMAGEM_PADRAO_OPENAI);
  assert.equal(resolverModeloImagem('', chaveOpenAI), MODELO_IMAGEM_PADRAO_OPENAI);
  assert.equal(resolverModeloImagem('gpt-image-1', chaveOpenAI), 'gpt-image-1');
  assert.equal(resolverModeloImagem(MODELO_IMAGEM_PADRAO_OPENAI, chaveOpenRouter), MODELO_IMAGEM_PADRAO);
  assert.equal(resolverModeloImagem('google/gemini-2.5-flash-image', chaveOpenRouter), 'google/gemini-2.5-flash-image');
});

test('modeloEscolhido devolve vazio para modelos padrão e mantém os personalizados', () => {
  const chaveOpenAI = 'sk-proj-' + 'a1'.repeat(24);
  const chaveOpenRouter = 'sk-or-v1-' + 'a1'.repeat(32);
  assert.equal(MODELO_PADRAO_OPENAI, 'gpt-5-mini');
  for (const padrao of ['', MODELO_PADRAO, MODELO_PADRAO_OPENAI, 'gpt-4o-mini']) {
    assert.equal(modeloEscolhido(padrao, chaveOpenAI), '', padrao);
  }
  assert.equal(modeloEscolhido('gpt-5-nano', chaveOpenAI), 'gpt-5-nano');
  assert.equal(modeloEscolhido(MODELO_PADRAO, chaveOpenRouter), '');
  assert.equal(modeloEscolhido('openrouter/free', chaveOpenRouter), 'openrouter/free');
  assert.equal(modeloImagemEscolhido(MODELO_IMAGEM_PADRAO, chaveOpenAI), '');
  assert.equal(modeloImagemEscolhido(MODELO_IMAGEM_PADRAO_OPENAI, chaveOpenRouter), '');
  assert.equal(modeloImagemEscolhido('gpt-image-1', chaveOpenAI), 'gpt-image-1');
});

const kitIlustrado = () => ({
  ...kitExemplo,
  cartas: kitExemplo.cartas.map(c => ({ ...c, imagem: 'data:image/jpeg;base64,' + 'A'.repeat(50_000) })),
});

test('promptRevisao não envia as ilustrações em base64 e não altera o kit original', () => {
  const kit = kitIlustrado();
  const t = texto(promptRevisao(entradaExemplo, kit, 'acabou rápido', []));
  assert.ok(!t.includes('base64'));
  assert.ok(t.includes(kitExemplo.cartas[0].nome));
  assert.ok(t.length < 10_000, `prompt com ${t.length} caracteres`);
  assert.ok(kit.cartas.every(c => c.imagem), 'o kit da tela continua com as imagens');
  assert.deepEqual(kitSemImagens({ titulo: 'Sem cartas' }), { titulo: 'Sem cartas' });
});

test('promptAvaliacao traz os 5 critérios, o pedido do formulário e o kit sem imagens', () => {
  const t = texto(promptAvaliacao(entradaExemplo, catalogo.slice(0, 2), kitIlustrado()));
  for (const c of CRITERIOS_RUBRICA) assert.ok(t.includes(`"${c.id}"`) && t.includes(c.nome), c.id);
  assert.ok(t.includes(entradaExemplo.tema));
  assert.ok(t.includes(catalogo[0].nome));
  assert.ok(!t.includes('base64'));
});

test('normalizarAvaliacao limita notas a 0..2, completa critérios ausentes e soma o total', () => {
  const a = normalizarAvaliacao({ criterios: [
    { id: 'jogavel', nota: 2, justificativa: 'ok' },
    { id: 'fiel', nota: 5, justificativa: 'exagero' },
    { id: 'rodada', nota: -1 },
    { id: 'clareza', nota: '1' },
  ] });
  assert.deepEqual(a.criterios.map(c => c.nota), [2, 2, 0, 1, 0]);
  assert.equal(a.total, 5);
  assert.equal(a.maximo, 10);
  assert.equal(a.bom, false);
  assert.match(a.criterios[4].justificativa, /não justificou/);
  assert.equal(normalizarAvaliacao({ criterios: CRITERIOS_RUBRICA.map(c => ({ id: c.id, nota: c.id === 'fiel' ? 0 : 2 })) }).bom, true);
  assert.throws(() => normalizarAvaliacao({}), /formato inesperado/);
});

test('avaliarKit com chave da OpenAI usa o gpt-5-nano com raciocínio mínimo e calcula o custo', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => {
    pedido = { url, corpo: JSON.parse(opts.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-5-nano-2025-08-07',
        usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
        choices: [{ message: { content: JSON.stringify({ criterios: CRITERIOS_RUBRICA.map(c => ({ id: c.id, nota: 2, justificativa: 'cumpre' })) }) } }],
      }),
    };
  };
  const { avaliacao, metricas } = await avaliarKit({ chave: 'sk-proj-' + 'a1'.repeat(24), kit: kitIlustrado(), entrada: entradaExemplo, mecanicas: [] });
  assert.equal(pedido.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(pedido.corpo.model, MODELO_AVALIADOR_OPENAI);
  assert.equal(pedido.corpo.reasoning_effort, 'minimal');
  assert.ok(!JSON.stringify(pedido.corpo).includes('base64'));
  assert.equal(avaliacao.total, 10);
  assert.equal(avaliacao.bom, true);
  assert.equal(metricas.custoUsd, (1000 * 0.05 + 200 * 0.40) / 1e6);
});
