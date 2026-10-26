/**
 * Formatea una fecha calendario (`LocalDate` ISO `YYYY-MM-DD`, como llega
 * desde la API; también acepta un datetime ISO completo y usa solo su
 * parte de fecha) al formato de lectura `DD-MM-AAAA`. Sin fecha, cadena
 * vacía.
 *
 * Se parsean los componentes a mano (como en `edadEnAnios`) en vez de
 * `new Date(iso)` para no depender de la zona horaria del navegador.
 *
 * Compartido entre páginas (Tarea 7 lo crea para "Medicamentos"; la Tarea 8
 * lo reutiliza en la página del plan y el formulario de detalle).
 */
export function formatearFecha(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
}

/**
 * "Hoy" en America/Santiago como `yyyy-mm-dd` (no en UTC: de noche en Chile
 * UTC ya es mañana). Compartido entre `Planes` (valor por defecto de
 * "Vigente desde" del alta) y `FormularioDetalle` (valor por defecto de
 * "Desde" del detalle).
 */
export function hoyEnSantiago(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}
