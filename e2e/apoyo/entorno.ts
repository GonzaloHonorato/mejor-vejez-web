import { test } from '@playwright/test';

/** Lee una variable de entorno obligatoria; si falta, omite la prueba con el motivo. */
export function requerida(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  test.skip(!valor, `Falta la variable de entorno ${nombre}.`);
  return valor ?? '';
}

/**
 * Correo único por corrida a partir del buzón de pruebas, con alias "+":
 * `buzon@dominio` → `buzon+cp01-20261120-154512@dominio`. Así cada corrida
 * crea una cuenta nueva en Firebase (no reutiliza un UID) y el correo llega.
 */
export function correoUnico(buzon: string, etiqueta: string, sello: string): string {
  const [usuario, dominio] = buzon.split('@');
  if (!usuario || !dominio) throw new Error('MEJOR_VEJEZ_CORREO_PRUEBAS no es un correo válido.');
  return `${usuario.split('+')[0]}+${etiqueta}-${sello}@${dominio}`;
}

/** Fecha y hora de Santiago para nombres únicos: `20261120-154512`. */
export function selloDeTiempo(fecha = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha);
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${v('year')}${v('month')}${v('day')}-${v('hour')}${v('minute')}${v('second')}`;
}
