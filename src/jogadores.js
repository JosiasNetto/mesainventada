// Regras puras para quantidade de jogadores (1 a 8) e compatibilidade com mecânicas.
import { mecanicaCompativel } from './mecanicas.js';

export const MIN_JOGADORES = 1;
export const MAX_JOGADORES = 8;
export const JOGADORES_PADRAO = 4;

export function normalizarJogadores(valor) {
  if (valor === '' || valor === null || valor === undefined) return JOGADORES_PADRAO;
  const n = Number(valor);
  if (!Number.isFinite(n)) return JOGADORES_PADRAO;
  return Math.min(MAX_JOGADORES, Math.max(MIN_JOGADORES, Math.round(n)));
}

export function removerMecanicasIncompativeis(selecionadas, entrada, compatFn = mecanicaCompativel) {
  const mantidas = [];
  const removidas = [];
  for (const m of selecionadas) {
    if (compatFn(m, entrada)) mantidas.push(m);
    else removidas.push(m);
  }
  return { mantidas, removidas };
}

export function descreverFaixaJogadores(min, max) {
  if (min === max) return min === 1 ? '1 pessoa (solo)' : `${min} pessoas`;
  return `${min} a ${max} pessoas`;
}
