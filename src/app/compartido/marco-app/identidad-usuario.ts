/**
 * Iniciales para el avatar: la primera letra de hasta dos palabras del
 * nombre; si es un correo, solo su primera letra.
 */
export function inicialesDe(nombre: string): string {
  const limpio = nombre.trim();
  if (!limpio) return '';
  if (limpio.includes('@')) return limpio.charAt(0).toUpperCase();
  return limpio
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}
