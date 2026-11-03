// Qué números de página mostrar bajo la carta.

/**
 * Todas las páginas si son pocas; si no, la primera, la última y las vecinas de la actual,
 * con "…" donde se saltan páginas. Las páginas van desde 0.
 * @returns {(number|'…')[]}
 */
export function numerosDePagina(total, actual) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const fijas = new Set([0, total - 1, actual - 1, actual, actual + 1].filter((n) => n >= 0 && n < total));
  const orden = [...fijas].sort((a, b) => a - b);
  return orden.flatMap((n, i) => (i > 0 && n - orden[i - 1] > 1 ? ['…', n] : [n]));
}
