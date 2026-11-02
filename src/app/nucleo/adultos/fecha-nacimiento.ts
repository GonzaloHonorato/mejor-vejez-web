import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { hoyEnSantiago } from '../fechas';
import { mensajeDeCampo } from '../http/mensaje-de-error';

/** Mismo texto que el core cuando la fecha es futura. */
export const MENSAJE_FECHA_FUTURA = 'La fecha de nacimiento no puede ser futura';
const MENSAJE_FECHA_REQUERIDA = 'Ingresa la fecha de nacimiento';

/** Error `fechaFutura` si la fecha (`yyyy-mm-dd`) es posterior a hoy en Santiago. Vacío pasa. */
export function validadorFechaNoFutura(hoy: () => string = hoyEnSantiago): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    if (typeof valor !== 'string' || valor === '') return null;
    return valor > hoy() ? { fechaFutura: true } : null;
  };
}

/**
 * Mensaje del campo de fecha de nacimiento (obligatoria al crear y editar
 * un adulto mayor): el de la API, o uno local si está tocado y vacío o es
 * futura.
 */
export function mensajeCampoFechaNacimiento(
  control: AbstractControl,
  erroresServidor: Record<string, string>,
  campo: string,
): string | null {
  const mensaje = mensajeDeCampo(control, erroresServidor, campo, MENSAJE_FECHA_REQUERIDA);
  if (mensaje) return mensaje;
  return control.touched && control.hasError('fechaFutura') ? MENSAJE_FECHA_FUTURA : null;
}
