import { fechaEnSantiago, formatearHora, hoyEnSantiago, nombreDia, sumarDias } from './fechas';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Día calendario en Santiago: una fecha `yyyy-mm-dd` tal cual, o el día de un instante ISO. */
function diaEnSantiago(iso: string): string {
  return iso.length === 10 ? iso : fechaEnSantiago(iso);
}

/** "Hoy", "Mañana" o "Lun 26 oct" para un día `yyyy-mm-dd`, respecto de `hoy`. */
function diaLegible(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  const [, mes, numero] = dia.split('-').map(Number);
  const nombre = nombreDia(dia).slice(0, 3);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${numero} ${MESES[mes - 1]}`;
}

/**
 * Fecha y hora de un instante ISO para leer de un vistazo, en hora de
 * Santiago: "Hoy 20:30", "Mañana 08:00" o "Lun 26 oct · 20:30".
 */
export function fechaHoraLegible(iso: string, hoy: string = hoyEnSantiago()): string {
  const dia = diaLegible(diaEnSantiago(iso), hoy);
  const hora = formatearHora(iso);
  return dia === 'Hoy' || dia === 'Mañana' ? `${dia} ${hora}` : `${dia} · ${hora}`;
}

/** Solo el día (de una fecha `yyyy-mm-dd` o de un instante ISO): "Hoy", "Mañana" o "Lun 26 oct". */
export function fechaLegible(iso: string, hoy: string = hoyEnSantiago()): string {
  return diaLegible(diaEnSantiago(iso), hoy);
}

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Fecha calendario `yyyy-mm-dd` en palabras, para titular un día: "Sábado, 31 de octubre". */
export function fechaLarga(fecha: string): string {
  const [, mes, numero] = fecha.split('-').map(Number);
  const nombre = nombreDia(fecha);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}, ${numero} de ${MESES_LARGOS[mes - 1]}`;
}

/**
 * Fecha con año, para cuando el año importa (vigencias, creación, historial):
 * "26 oct 2026". Acepta `yyyy-mm-dd` o un instante ISO (usa su día en
 * Santiago). Sin fecha, cadena vacía.
 */
export function fechaConAnio(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, numero] = diaEnSantiago(iso).split('-').map(Number);
  return `${numero} ${MESES[mes - 1]} ${anio}`;
}

/** Fecha con año y hora de Santiago de un instante ISO: "3 nov 2026 · 10:00". */
export function fechaHoraConAnio(iso: string): string {
  return `${fechaConAnio(iso)} · ${formatearHora(iso)}`;
}

/**
 * Fecha calendario `yyyy-mm-dd` corta con el día de la semana, en minúscula,
 * para ir dentro de una frase: "lun 2 nov", o "dom 8 nov 2026" con año.
 */
export function fechaCortaConDia(fecha: string, conAnio = false): string {
  const [anio, mes, numero] = fecha.split('-').map(Number);
  const corta = `${nombreDia(fecha).slice(0, 3)} ${numero} ${MESES[mes - 1]}`;
  return conAnio ? `${corta} ${anio}` : corta;
}
