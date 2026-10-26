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

/**
 * Hora local de Santiago de un instante ISO (`OffsetDateTime`/`Instant`
 * serializado por la API), en formato 24 h `"HH:mm"`. Se usa `Intl` con
 * `timeZone: 'America/Santiago'` (nunca la zona del navegador/proceso):
 * compartida por las páginas de tareas/agenda (Tarea 9 y siguientes).
 */
export function formatearHora(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/**
 * Día calendario (`yyyy-mm-dd`) en America/Santiago de un instante ISO.
 * Análogo a `hoyEnSantiago()` pero para un instante arbitrario (p.ej. el
 * `fechaHorario` de una tarea), para agrupar/mostrar tareas por el día en
 * que realmente caen en Chile, sin importar la zona del navegador.
 */
export function fechaEnSantiago(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(iso));
}

/**
 * Suma (o resta, con `dias` negativo) días calendario a una fecha
 * `yyyy-mm-dd`. Aritmética pura en UTC sobre los componentes de la fecha
 * (como `edadEnAnios`/`formatearFecha`): nunca depende de la zona horaria
 * del proceso ni de horario de verano, porque no hay hora de por medio.
 */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  fechaUtc.setUTCDate(fechaUtc.getUTCDate() + dias);
  return fechaUtc.toISOString().slice(0, 10);
}

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Nombre del día de la semana ("lunes"…"domingo") de una fecha `yyyy-mm-dd`.
 * Se calcula con los componentes en UTC (como `sumarDias`), no con la zona
 * del navegador/proceso: una fecha calendario es un día fijo, no un instante.
 */
export function nombreDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  return NOMBRES_DIA[fechaUtc.getUTCDay()];
}

/** Offset de America/Santiago (en minutos, negativo) vigente en un instante UTC dado. */
function offsetSantiagoEnMinutos(instanteUtcMs: number): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(instanteUtcMs));
  const nombreZona = partes.find((parte) => parte.type === 'timeZoneName')?.value ?? 'GMT-03:00';
  const coincidencia = /GMT([+-]\d{2}):(\d{2})/.exec(nombreZona);
  if (!coincidencia) {
    return -180;
  }
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  const signo = horas < 0 ? -1 : 1;
  return horas * 60 + signo * minutos;
}

/** Formatea un offset en minutos (p.ej. -180) como `"±hh:mm"` (p.ej. `"-03:00"`). */
function formatearOffset(offsetMinutos: number): string {
  const signo = offsetMinutos < 0 ? '-' : '+';
  const absolutos = Math.abs(offsetMinutos);
  const horas = Math.floor(absolutos / 60);
  const minutos = absolutos % 60;
  return `${signo}${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Instante ISO (`yyyy-mm-ddTHH:mm:00±hh:mm`) de una fecha y hora LOCAL de
 * Santiago, con el offset que corresponde a Chile en ese momento (nunca el
 * del navegador/proceso). Se usa al dar de alta una cita o tarea manual
 * (restricción global, foco de revisión 5): el 2026-04-04 a las 10:00
 * todavía es `-03:00`, pero el 2026-04-05 a las 10:00 ya es `-04:00`
 * (retroceso de otoño). El 2026-04-04 a las 23:30 (hora que se repite en el
 * retroceso) usa el PRIMER offset, `-03:00` (regla 2 del plan).
 *
 * El 2026-09-06 a las 00:30 (salto de primavera) NO EXISTE: ese día el reloj
 * de Chile salta de las 00:00 a la 01:00, así que el tramo 00:00-00:59 no
 * tiene instante. Igual que `ZonedDateTime.of` en la API, se AVANZA lo que
 * dura el salto (acá, 1 hora) y se devuelve `2026-09-06T01:30:00-03:00`, con
 * el offset vigente después del cambio. Nunca se retrocede al día anterior.
 *
 * El offset se calcula con `Intl.DateTimeFormat(... { timeZoneName:
 * 'longOffset' })` sobre un instante candidato (la fecha/hora local
 * interpretada como si fuera UTC, que cae a lo sumo a pocas horas del
 * instante real). Se prueba una segunda vez con el offset resultante; si esa
 * segunda prueba no es estable tampoco, la hora local no existe (salto) y se
 * avanza por la duración del salto antes de formatear.
 */
export function instanteSantiago(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const nominalMs = Date.UTC(anio, mes - 1, dia, horas, minutos, 0);

  const offsetA = offsetSantiagoEnMinutos(nominalMs);
  const offsetB = offsetSantiagoEnMinutos(nominalMs - offsetA * 60_000);

  if (offsetB === offsetA) {
    // Sin ambigüedad: la hora local pedida existe con ese offset.
    return `${fecha}T${hora}:00${formatearOffset(offsetA)}`;
  }

  const offsetC = offsetSantiagoEnMinutos(nominalMs - offsetB * 60_000);
  if (offsetC === offsetB) {
    // Retroceso (la hora local se repite, p.ej. las 23:30 del 2026-04-04):
    // se usa el primer offset encontrado, antes del cambio.
    return `${fecha}T${hora}:00${formatearOffset(offsetA)}`;
  }

  // Salto: ninguno de los dos offsets reproduce la hora pedida, así que no
  // existe (p.ej. las 00:30 del 2026-09-06). Se avanza lo que dura el salto
  // y se usa el offset vigente después, igual que la API.
  const minutosDeSalto = offsetB - offsetA;
  const instanteAvanzadoMs = nominalMs + minutosDeSalto * 60_000 - offsetB * 60_000;
  const isoAvanzado = new Date(instanteAvanzadoMs).toISOString();
  const fechaAvanzada = fechaEnSantiago(isoAvanzado);
  const horaAvanzada = formatearHora(isoAvanzado);
  return `${fechaAvanzada}T${horaAvanzada}:00${formatearOffset(offsetB)}`;
}
