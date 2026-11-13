import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COTACAO_BRL_PADRAO,
  ORCAMENTO_CHAVE_USD,
  extrairMetricas,
  resumirCustosVersao,
  formatarResumoMetricas,
  formatarUsd,
  formatarBrl,
} from '../src/custos.js';

test('extrairMetricas normaliza usage da OpenRouter para texto e imagem', () => {
  const mTexto = extrairMetricas({
    model: 'nvidia/nemotron-3.5-super-vl:free',
    usage: { prompt_tokens: 480, completion_tokens: 720, total_tokens: 1200, cost: 0 },
  }, 6200, 'openrouter/free');

  assert.equal(mTexto.modelo, 'nvidia/nemotron-3.5-super-vl:free');
  assert.equal(mTexto.duracaoMs, 6200);
  assert.equal(mTexto.promptTokens, 480);
  assert.equal(mTexto.completionTokens, 720);
  assert.equal(mTexto.imageTokens, 0);
  assert.equal(mTexto.totalTokens, 1200);
  assert.equal(mTexto.custoUsd, 0);

  const mImg = extrairMetricas({
    model: 'google/gemini-3.1-flash-lite-image',
    usage: {
      prompt_tokens: 32,
      completion_tokens: 1120,
      total_tokens: 1152,
      cost: 0.033608,
      completion_tokens_details: { image_tokens: 1120 },
    },
  }, 4966);

  assert.equal(mImg.modelo, 'google/gemini-3.1-flash-lite-image');
  assert.equal(mImg.duracaoMs, 4966);
  assert.equal(mImg.imageTokens, 1120);
  assert.equal(mImg.custoUsd, 0.033608);
});

test('extrairMetricas lida com resposta sem usage sem quebrar', () => {
  const m = extrairMetricas({}, 1500, 'modelo-padrao');
  assert.equal(m.modelo, 'modelo-padrao');
  assert.equal(m.duracaoMs, 1500);
  assert.equal(m.totalTokens, 0);
  assert.equal(m.custoUsd, 0);
});

test('resumirCustosVersao soma metricas do kit de texto e das imagens geradas', () => {
  const versao = {
    metricas: {
      modelo: 'nvidia/nemotron-3.5-super-vl:free',
      duracaoMs: 6000,
      promptTokens: 500,
      completionTokens: 800,
      imageTokens: 0,
      totalTokens: 1300,
      custoUsd: 0.0005,
    },
    metricasImagens: [
      {
        cartaNome: 'Tanque de Oxigênio',
        modelo: 'openai/gpt-5-image-mini',
        duracaoMs: 4500,
        promptTokens: 40,
        completionTokens: 1050,
        imageTokens: 1050,
        totalTokens: 1090,
        custoUsd: 0.0085,
      },
      {
        cartaNome: 'Curto-Circuito',
        modelo: 'openai/gpt-5-image-mini',
        duracaoMs: 5000,
        promptTokens: 42,
        completionTokens: 1050,
        imageTokens: 1050,
        totalTokens: 1092,
        custoUsd: 0.0085,
      },
    ],
  };

  const resumo = resumirCustosVersao(versao, 5.80);
  assert.equal(resumo.texto.duracaoMs, 6000);
  assert.equal(resumo.texto.totalTokens, 1300);
  assert.equal(resumo.imagens.quantidade, 2);
  assert.equal(resumo.imagens.duracaoMs, 9500);
  assert.equal(resumo.imagens.totalTokens, 2182);
  assert.ok(Math.abs(resumo.imagens.custoUsd - 0.017) < 1e-6);
  assert.equal(resumo.total.duracaoMs, 15500);
  assert.equal(resumo.total.totalTokens, 3482);
  assert.ok(Math.abs(resumo.total.custoUsd - 0.0175) < 1e-6);
  assert.ok(Math.abs(resumo.total.custoBrl - 0.0175 * 5.80) < 1e-5);
  assert.equal(resumo.estimativaOrcamento.kitsNoOrcamento, Math.floor(ORCAMENTO_CHAVE_USD / 0.0175));
});

test('formatarResumoMetricas gera texto legivel para interface e historico', () => {
  const resumo = resumirCustosVersao({
    metricas: {
      modelo: 'nvidia/nemotron-3.5-super-vl:free',
      duracaoMs: 7400,
      promptTokens: 500,
      completionTokens: 700,
      imageTokens: 0,
      totalTokens: 1200,
      custoUsd: 0,
    },
    metricasImagens: [
      {
        modelo: 'google/gemini-3.1-flash-lite-image',
        duracaoMs: 5100,
        promptTokens: 35,
        completionTokens: 1120,
        imageTokens: 1120,
        totalTokens: 1155,
        custoUsd: 0.0336,
      },
    ],
  });

  const texto = formatarResumoMetricas(resumo);
  assert.match(texto.curto, /12,5 s/);
  assert.match(texto.curto, /US\$ 0,0336/);
  assert.match(texto.detalhado, /Texto: 7,4 s/);
  assert.match(texto.detalhado, /Imagens \(1\): 5,1 s/);
  assert.ok(COTACAO_BRL_PADRAO > 0);
  assert.match(formatarUsd(0), /grátis|US\$ 0,0000/i);
  assert.match(formatarBrl(0.19488), /R\$/);
});
