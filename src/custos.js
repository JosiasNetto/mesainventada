// Avaliacao de tempo, tokens e custo (US$ e R$) da geracao de um artefato na MesaInventada.

export const COTACAO_BRL_PADRAO = 5.80;
export const ORCAMENTO_CHAVE_USD = 4.00;

export function extrairMetricas(dadosApi, duracaoMs = 0, modeloPadrao = '') {
  const d = dadosApi && typeof dadosApi === 'object' ? dadosApi : {};
  const u = d.usage && typeof d.usage === 'object' ? d.usage : {};
  const promptTokens = Number(u.prompt_tokens) || 0;
  const completionTokens = Number(u.completion_tokens) || 0;
  const imageTokens = Number(u.completion_tokens_details?.image_tokens) || 0;
  const totalTokens = Number(u.total_tokens) || (promptTokens + completionTokens);
  const custoUsd = Number(u.cost ?? u.cost_details?.upstream_inference_cost) || 0;

  return {
    modelo: String(d.model || modeloPadrao || ''),
    duracaoMs: Math.max(0, Math.round(Number(duracaoMs) || 0)),
    promptTokens,
    completionTokens,
    imageTokens,
    totalTokens,
    custoUsd,
  };
}

export function resumirCustosVersao(versao, cotacaoBrl = COTACAO_BRL_PADRAO) {
  const v = versao && typeof versao === 'object' ? versao : {};
  const mTexto = v.metricas && typeof v.metricas === 'object' ? v.metricas : {};
  const listaImgs = Array.isArray(v.metricasImagens) ? v.metricasImagens : [];

  const texto = {
    modelo: String(mTexto.modelo || ''),
    duracaoMs: Number(mTexto.duracaoMs) || 0,
    promptTokens: Number(mTexto.promptTokens) || 0,
    completionTokens: Number(mTexto.completionTokens) || 0,
    totalTokens: Number(mTexto.totalTokens) || 0,
    custoUsd: Number(mTexto.custoUsd) || 0,
  };

  const imagens = listaImgs.reduce((acc, item) => {
    const m = item && typeof item === 'object' ? item : {};
    acc.quantidade += 1;
    acc.duracaoMs += Number(m.duracaoMs) || 0;
    acc.promptTokens += Number(m.promptTokens) || 0;
    acc.completionTokens += Number(m.completionTokens) || 0;
    acc.imageTokens += Number(m.imageTokens) || 0;
    acc.totalTokens += Number(m.totalTokens) || 0;
    acc.custoUsd += Number(m.custoUsd) || 0;
    if (m.modelo && !acc.modelos.includes(m.modelo)) acc.modelos.push(m.modelo);
    return acc;
  }, {
    quantidade: 0,
    duracaoMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    imageTokens: 0,
    totalTokens: 0,
    custoUsd: 0,
    modelos: [],
  });

  const duracaoTotalMs = texto.duracaoMs + imagens.duracaoMs;
  const tokensTotais = texto.totalTokens + imagens.totalTokens;
  const custoTotalUsd = texto.custoUsd + imagens.custoUsd;
  const taxaBrl = Number(cotacaoBrl) > 0 ? Number(cotacaoBrl) : COTACAO_BRL_PADRAO;
  const custoTotalBrl = custoTotalUsd * taxaBrl;

  const kitsNoOrcamento = custoTotalUsd > 0
    ? Math.floor(ORCAMENTO_CHAVE_USD / custoTotalUsd)
    : null;

  return {
    texto,
    imagens,
    total: {
      duracaoMs: duracaoTotalMs,
      totalTokens: tokensTotais,
      custoUsd: custoTotalUsd,
      custoBrl: custoTotalBrl,
    },
    estimativaOrcamento: {
      orcamentoUsd: ORCAMENTO_CHAVE_USD,
      kitsNoOrcamento,
    },
  };
}

export function formatarSegundos(ms) {
  const s = (Number(ms) || 0) / 1000;
  return `${s.toFixed(1).replace('.', ',')} s`;
}

export function formatarUsd(valorUsd) {
  const v = Number(valorUsd) || 0;
  if (v === 0) return 'US$ 0,0000 (grátis)';
  return `US$ ${v.toFixed(4).replace('.', ',')}`;
}

export function formatarBrl(valorBrl) {
  const v = Number(valorBrl) || 0;
  if (v === 0) return 'R$ 0,00';
  if (v < 0.01) return `R$ ${v.toFixed(4).replace('.', ',')}`;
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export function formatarResumoMetricas(resumo) {
  const r = resumo && typeof resumo === 'object' ? resumo : resumirCustosVersao({});
  const tSeg = formatarSegundos(r.total.duracaoMs);
  const usd = formatarUsd(r.total.custoUsd);
  const brl = formatarBrl(r.total.custoBrl);

  const curto = `${tSeg} · ${r.total.totalTokens} tokens · ${usd}`;

  const partes = [
    `Texto: ${formatarSegundos(r.texto.duracaoMs)} (${r.texto.totalTokens} tokens · ${formatarUsd(r.texto.custoUsd)})`,
  ];
  if (r.imagens.quantidade > 0) {
    partes.push(
      `Imagens (${r.imagens.quantidade}): ${formatarSegundos(r.imagens.duracaoMs)} (${r.imagens.totalTokens} tokens · ${formatarUsd(r.imagens.custoUsd)})`,
    );
  }
  partes.push(`Total do artefato: ${tSeg} · ${usd} (${brl})`);
  if (r.estimativaOrcamento.kitsNoOrcamento != null) {
    partes.push(
      `Com o orçamento de US$ ${r.estimativaOrcamento.orcamentoUsd.toFixed(2).replace('.', ',')} da chave, cabem ~${r.estimativaOrcamento.kitsNoOrcamento} artefatos deste porte.`,
    );
  }

  return {
    curto,
    detalhado: partes.join(' | '),
  };
}
