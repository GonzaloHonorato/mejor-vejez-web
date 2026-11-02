import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { mensajeDeCampo } from './http/mensaje-de-error';

/** Mismo texto que el core (`TelefonoChileno.MENSAJE`). */
export const MENSAJE_TELEFONO_CHILENO = 'Ingresa un teléfono chileno: +56 y 9 dígitos.';

/** Ayuda bajo los campos de teléfono. */
export const AYUDA_TELEFONO = 'Ej.: +56 9 1234 5678';

const SEPARADORES = /[\s-]/g;
const FORMATO = /^(?:\+?56)?(\d{9})$/;

/**
 * Regla del teléfono chileno, igual que en el core: `+56` y 9 dígitos, con
 * o sin el prefijo (`+56` o `56`) y con espacios o guiones. Devuelve el
 * número normalizado `+56XXXXXXXXX`, o `null` si no cumple.
 */
export function normalizarTelefono(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  const coincidencia = FORMATO.exec(texto.trim().replace(SEPARADORES, ''));
  return coincidencia ? `+56${coincidencia[1]}` : null;
}

export function esTelefonoChileno(texto: string | null | undefined): boolean {
  return normalizarTelefono(texto) !== null;
}

/**
 * Para mostrar: `+56 9 1234 5678`. Un teléfono guardado antes de la regla
 * que no la cumple se muestra tal cual.
 */
export function formatearTelefono(texto: string | null | undefined): string {
  const normalizado = normalizarTelefono(texto);
  if (!normalizado) return texto ?? '';
  const digitos = normalizado.slice(3);
  return `+56 ${digitos.slice(0, 1)} ${digitos.slice(1, 5)} ${digitos.slice(5)}`;
}

/** Al salir de un campo de teléfono: si el valor cumple la regla, lo deja formateado (`+56 9 1234 5678`). */
export function formatearControlTelefono(control: AbstractControl): void {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || !esTelefonoChileno(valor)) return;
  const formateado = formatearTelefono(valor);
  if (formateado !== valor) control.setValue(formateado);
}

/** `href` de un enlace `tel:`, siempre con el número normalizado (o sin espacios, si es antiguo). */
export function enlaceTelefono(texto: string): string {
  return `tel:${normalizarTelefono(texto) ?? texto.replace(/\s/g, '')}`;
}

/**
 * Mismo criterio que el core (`TelefonoChileno.mismoTelefono`): igual en
 * crudo (recortado) o, si ambos cumplen la regla, igual normalizado.
 */
export function mismoTelefono(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  if (a.trim() === b.trim()) return true;
  const normalizado = normalizarTelefono(a);
  return normalizado !== null && normalizado === normalizarTelefono(b);
}

/**
 * Como `validadorTelefonoChileno`, pero deja pasar el teléfono ya guardado
 * (`guardado()`) sin cambios: un número antiguo que no cumple la regla no
 * impide guardar los demás campos. Uno nuevo o cambiado se valida.
 */
export function validadorTelefonoChilenoSalvo(
  guardado: () => string | null | undefined,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    if (typeof valor === 'string' && mismoTelefono(valor, guardado())) return null;
    return validadorTelefonoChileno(control);
  };
}

/** Error `telefonoChileno` si el valor no cumple la regla. Vacío pasa: para exigirlo, se suma `Validators.required`. */
export const validadorTelefonoChileno: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  return esTelefonoChileno(valor) ? null : { telefonoChileno: true };
};

/**
 * Mensaje de un campo de teléfono: el de la API, el de "requerido" (si se
 * indica) o el de la regla cuando el control está tocado y no la cumple.
 */
export function mensajeCampoTelefono(
  control: AbstractControl,
  erroresServidor: Record<string, string>,
  campo: string,
  mensajeRequerido = '',
): string | null {
  const mensaje = mensajeDeCampo(control, erroresServidor, campo, mensajeRequerido);
  if (mensaje) return mensaje;
  return control.touched && control.hasError('telefonoChileno') ? MENSAJE_TELEFONO_CHILENO : null;
}
