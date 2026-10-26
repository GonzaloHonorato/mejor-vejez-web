import { RespuestaAlerta, TipoAlerta } from './modelos-alertas';

/** Etiquetas de `TipoAlerta` para mostrar en la bandeja y en el asunto del correo (regla 6/16 del plan). */
export const ETIQUETA_TIPO_ALERTA: Record<TipoAlerta, string> = {
  ATRASO_TAREA: 'Tarea sin confirmar',
  REPOSICION_MEDICAMENTO: 'Reposición de medicamento',
  CITA_PROXIMA: 'Cita médica próxima',
};

/** Quién pide cerrar la alerta: el usuario autenticado y su rol en el grupo activo. */
export interface QuienCierra {
  miRol: string | null;
  esAdministrador: boolean;
}

/**
 * Si `quien` puede cerrar `alerta` (regla 13 del plan): el coordinador del
 * grupo o el administrador, y solo mientras la alerta está ABIERTA
 * (`idEstadoAbierta`). Una alerta ya cerrada nunca se puede volver a cerrar.
 */
export function puedeCerrarAlerta(
  alerta: RespuestaAlerta,
  quien: QuienCierra,
  idEstadoAbierta: number,
): boolean {
  const esCoordinadorOAdministrador = quien.miRol === 'COORDINADOR' || quien.esAdministrador;
  return esCoordinadorOAdministrador && alerta.idEstado === idEstadoAbierta;
}

/** Máximo de caracteres de la observación de cierre (regla 13 del plan). */
export const MAXIMO_CARACTERES_OBSERVACION = 500;

/**
 * Si `texto` es una observación de cierre válida (regla 13 del plan): no
 * está en blanco después de `trim` y tiene a lo sumo
 * `MAXIMO_CARACTERES_OBSERVACION` caracteres.
 */
export function observacionValida(texto: string): boolean {
  const recortado = texto.trim();
  return recortado.length > 0 && recortado.length <= MAXIMO_CARACTERES_OBSERVACION;
}
