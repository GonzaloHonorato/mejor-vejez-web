import { fechaCortaConDia } from '../fecha-legible';
import { sumarDias } from '../fechas';
import { HorarioJson, reconstruirHorario } from './horario';

/**
 * Configuración simple de un medicamento ("empieza a las 08:00, cada 8
 * horas, durante 7 días") y su traducción al contrato HORARIO_JSON, sin
 * cambiar la API: se guarda como `HORAS_FIJAS` con las horas que resultan de
 * sumar el intervalo desde la primera toma, dando la vuelta a las 24 h
 * (el `INTERVALO` del core no cruza medianoche), todos los días, y con
 * `fechaFin` = "Desde" + días − 1.
 */

/** Intervalos que ofrece el modo simple: todos dividen el día en partes iguales. */
export const INTERVALOS_SIMPLES: readonly number[] = [4, 6, 8, 12, 24];

const MINUTOS_DIA = 24 * 60;
const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function esHoraSimpleValida(hora: string): boolean {
  return PATRON_HORA.test(hora);
}

function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

function aTexto(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Horas del día en el orden en que se toman, desde la primera: 08:00 cada 8 → 08:00, 16:00, 00:00. */
export function horasDesdePrimeraToma(primeraToma: string, cada: number): string[] {
  const inicio = aMinutos(primeraToma);
  const tomas = MINUTOS_DIA / (cada * 60);
  return Array.from({ length: tomas }, (_, i) => aTexto((inicio + i * cada * 60) % MINUTOS_DIA));
}

/** El horario que se envía en modo simple: `HORAS_FIJAS` con las horas ordenadas. */
export function horarioSimple(primeraToma: string, cada: number): HorarioJson {
  return {
    version: 1,
    tipo: 'HORAS_FIJAS',
    horas: horasDesdePrimeraToma(primeraToma, cada).sort(),
  };
}

/** Último día de una duración de `dias` días que empieza en `desde` (ambos incluidos). */
export function fechaFinSimple(desde: string, dias: number): string {
  return sumarDias(desde, dias - 1);
}

/** Días de `desde` a `hasta`, ambos incluidos (fechas `yyyy-mm-dd`). */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000) + 1;
}

/** Desde esta hora se busca la primera toma de unas horas guardadas. */
const INICIO_DEL_DIA = '06:00';

/**
 * Primera toma de unas horas guardadas (la API no guarda con cuál empezó la
 * persona): la primera hora desde las 06:00, o la más temprana si no hay
 * ninguna desde esa hora. 00:00/08:00/16:00 → 08:00.
 */
export function primeraTomaPorRegla(horas: readonly string[]): string {
  const ordenadas = [...horas].sort();
  return ordenadas.find((hora) => hora >= INICIO_DEL_DIA) ?? ordenadas[0];
}

/** Las horas en el orden en que se toman, desde `primeraTomaPorRegla`: 08:00, 16:00 y 00:00. */
export function horasEnOrdenDeToma(horas: readonly string[]): string[] {
  const ordenadas = [...horas].sort();
  const inicio = ordenadas.indexOf(primeraTomaPorRegla(ordenadas));
  return [...ordenadas.slice(inicio), ...ordenadas.slice(0, inicio)];
}

/**
 * Horas cada cuántas horas (enteras) si son equiespaciadas y cubren el día
 * completo (dando la vuelta a medianoche); si no, `null`. Con una sola hora,
 * 24.
 */
function intervaloQueCubreElDia(horas: readonly string[]): number | null {
  if (horas.length === 0 || MINUTOS_DIA % horas.length !== 0) return null;
  const paso = MINUTOS_DIA / horas.length;
  if (paso % 60 !== 0) return null;
  const minutos = [...horas].sort().map(aMinutos);
  const parejas = minutos.every((valor, i) => i === 0 || valor - minutos[i - 1] === paso);
  return parejas ? paso / 60 : null;
}

/**
 * Primera toma e intervalo de unas horas del día, si son equiespaciadas,
 * cubren el día completo y el intervalo está en `INTERVALOS_SIMPLES`; si no,
 * `null`. La primera toma sale de `primeraTomaPorRegla`.
 */
export function configuracionSimpleDeHoras(
  horas: readonly string[],
): { primeraToma: string; cada: number } | null {
  const cada = intervaloQueCubreElDia(horas);
  if (cada === null || !INTERVALOS_SIMPLES.includes(cada)) return null;
  return { primeraToma: primeraTomaPorRegla(horas), cada };
}

/**
 * Texto de lectura de un horario guardado (las `horas` expandidas que
 * devuelve la API), para la grilla del plan y los nombres accesibles:
 * - Una hora: "08:00".
 * - Equiespaciadas y cubren el día: "Cada 8 h: 08:00, 16:00 y 00:00".
 * - Equiespaciadas sin cruzar medianoche: "Cada 8 h de 08:00 a 16:00".
 * - Otras: "09:00, 13:00 y 19:00".
 * Las horas se listan en orden de toma (`horasEnOrdenDeToma`).
 */
export function textoHorarioGuardado(horas: readonly string[]): string {
  const enOrden = horasEnOrdenDeToma(horas);
  if (enOrden.length === 1) return enOrden[0];
  const cada = intervaloQueCubreElDia(horas);
  if (cada !== null) return `Cada ${cada} h: ${enumerar(enOrden)}`;
  const horario = reconstruirHorario([...horas]);
  if (horario.tipo === 'INTERVALO') {
    return `Cada ${horario.frecuencia_horas} h de ${horario.hora_inicio} a ${horario.hora_fin}`;
  }
  return enumerar(enOrden);
}

function enumerar(elementos: string[]): string {
  return elementos.length === 1
    ? elementos[0]
    : `${elementos.slice(0, -1).join(', ')} y ${elementos[elementos.length - 1]}`;
}

/**
 * Resumen en palabras de la configuración simple: "Se tomará a las 08:00,
 * 16:00 y 00:00, todos los días, del lun 2 nov al dom 8 nov 2026 (7 días)."
 */
export function resumenSimple(
  primeraToma: string,
  cada: number,
  desde: string,
  dias: number,
): string {
  const horas = horasDesdePrimeraToma(primeraToma, cada);
  const articulo = horas.length === 1 && horas[0].startsWith('01:') ? 'a la' : 'a las';
  const hasta = fechaFinSimple(desde, dias);
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  const periodo =
    dias === 1
      ? `solo el ${fechaCortaConDia(desde, true)}`
      : `del ${fechaCortaConDia(desde, !mismoAnio)} al ${fechaCortaConDia(hasta, true)}`;
  const duracion = dias === 1 ? '1 día' : `${dias} días`;
  return `Se tomará ${articulo} ${enumerar(horas)}, todos los días, ${periodo} (${duracion}).`;
}
