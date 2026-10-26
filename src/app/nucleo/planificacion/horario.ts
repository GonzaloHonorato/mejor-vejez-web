/**
 * Contrato compartido con `ValidadorHorario` (API): mismas reglas y mismos
 * mensajes de error. En camelCase español excepto dentro de este objeto, que
 * respeta el contrato literal (`version`, `tipo`, `horas`, `hora_inicio`,
 * `hora_fin`, `frecuencia_horas`).
 */
export type HorarioJson =
  | { version: 1; tipo: 'HORAS_FIJAS'; horas: string[] }
  | { version: 1; tipo: 'INTERVALO'; hora_inicio: string; hora_fin: string; frecuencia_horas: number };

const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const CLAVES_PERMITIDAS: Record<'HORAS_FIJAS' | 'INTERVALO', readonly string[]> = {
  HORAS_FIJAS: ['version', 'tipo', 'horas'],
  INTERVALO: ['version', 'tipo', 'hora_inicio', 'hora_fin', 'frecuencia_horas'],
};

function esHoraValida(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_HORA.test(valor);
}

/**
 * Representación de un valor para el mensaje "Hora no válida": ausente, o
 * texto vacío/solo espacios → "(vacía)" (adenda del contrato); texto no
 * vacío → tal cual; cualquier otro valor → su JSON (también dentro de
 * `horas`, HORAS_FIJAS).
 */
function representarHora(valor: unknown): string {
  if (valor === undefined) {
    return '(vacía)';
  }
  if (typeof valor === 'string') {
    return valor.trim() === '' ? '(vacía)' : valor;
  }
  return JSON.stringify(valor);
}

/** Valida `h` contra el contrato HORARIO_JSON. Devuelve el mensaje de error exacto, o `null` si es válido. */
export function validarHorario(h: unknown): string | null {
  if (h === null || typeof h !== 'object' || Array.isArray(h)) {
    return 'El horario es obligatorio';
  }

  const objeto = h as Record<string, unknown>;

  if (objeto['version'] !== 1) {
    return 'Versión de horario no soportada (se espera 1)';
  }

  const tipo = objeto['tipo'];
  if (tipo !== 'HORAS_FIJAS' && tipo !== 'INTERVALO') {
    return 'Tipo de horario no válido';
  }

  const permitidas = CLAVES_PERMITIDAS[tipo];
  const noPermitidas = Object.keys(objeto)
    .filter((clave) => !permitidas.includes(clave))
    .sort();
  if (noPermitidas.length > 0) {
    return `El horario tiene atributos no permitidos: ${noPermitidas.join(', ')}`;
  }

  if (tipo === 'HORAS_FIJAS') {
    const horas = objeto['horas'];
    if (!Array.isArray(horas) || horas.length === 0) {
      return 'Indica al menos una hora';
    }
    for (const hora of horas) {
      if (!esHoraValida(hora)) {
        return `Hora no válida: ${representarHora(hora)} (usa HH:mm)`;
      }
    }
    if (new Set(horas).size !== horas.length) {
      return 'Hay horas repetidas';
    }
    return null;
  }

  const horaInicio = objeto['hora_inicio'];
  if (!esHoraValida(horaInicio)) {
    return `Hora no válida: ${representarHora(horaInicio)} (usa HH:mm)`;
  }
  const horaFin = objeto['hora_fin'];
  if (!esHoraValida(horaFin)) {
    return `Hora no válida: ${representarHora(horaFin)} (usa HH:mm)`;
  }

  const frecuencia = objeto['frecuencia_horas'];
  if (
    typeof frecuencia !== 'number' ||
    !Number.isInteger(frecuencia) ||
    frecuencia < 1 ||
    frecuencia > 24
  ) {
    return 'La frecuencia debe ser un número entero de horas entre 1 y 24';
  }

  if (horaFin <= horaInicio) {
    return 'La hora de fin debe ser posterior a la de inicio (sin cruzar medianoche)';
  }

  return null;
}

function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

function aTexto(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutosRestantes).padStart(2, '0')}`;
}

/** Expande un horario válido a la lista de horas que representa, ordenadas y sin duplicados. */
export function expandirHorario(h: HorarioJson): string[] {
  if (h.tipo === 'HORAS_FIJAS') {
    return [...new Set(h.horas)].sort();
  }

  const horas: string[] = [];
  const fin = aMinutos(h.hora_fin);
  const paso = h.frecuencia_horas * 60;
  for (let actual = aMinutos(h.hora_inicio); actual <= fin; actual += paso) {
    horas.push(aTexto(actual));
  }
  return horas;
}

/**
 * Reconstruye el `HorarioJson` a partir de las horas guardadas (expandidas).
 * Con 2 o más horas igualmente espaciadas por un número entero de horas →
 * `INTERVALO`. En otro caso → `HORAS_FIJAS`.
 */
export function reconstruirHorario(horas: string[]): HorarioJson {
  const ordenadas = [...horas].sort();

  if (ordenadas.length >= 2) {
    const minutos = ordenadas.map(aMinutos);
    const paso = minutos[1] - minutos[0];
    const equiespaciadas =
      paso > 0 &&
      paso % 60 === 0 &&
      minutos.every((valor, indice) => indice === 0 || valor - minutos[indice - 1] === paso);

    if (equiespaciadas) {
      return {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: ordenadas[0],
        hora_fin: ordenadas[ordenadas.length - 1],
        frecuencia_horas: paso / 60,
      };
    }
  }

  return { version: 1, tipo: 'HORAS_FIJAS', horas: ordenadas };
}
