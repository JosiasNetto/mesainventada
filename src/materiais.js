// Materiais: além das opções fixas, a pessoa pode escrever outros itens que vão direto para o prompt.

export function materiaisExtras(texto) {
  return String(texto ?? '')
    .split(/[,;\n]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export function combinarMateriais(base, extras) {
  return [...new Set([...base, ...extras])];
}
