import { RespuestaTarea } from './modelos-tareas';

/** Códigos de `TAREA_CUIDADO.ESTADO` (catálogo de negocio, resuelto a `idEstado` por la API). */
export type CodigoEstadoTarea = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'NO_REALIZADA' | 'CANCELADA';

/**
 * Transiciones válidas (regla 10 del plan, idéntica a la que valida la API):
 * `PENDIENTE` va a cualquier otro estado; `EN_CURSO` solo se completa o
 * queda no realizada (TSA-40: una tarea en curso no se cancela);
 * `COMPLETADA`, `NO_REALIZADA` y `CANCELADA` son finales.
 */
export const TRANSICIONES: Record<CodigoEstadoTarea, CodigoEstadoTarea[]> = {
  PENDIENTE: ['EN_CURSO', 'COMPLETADA', 'NO_REALIZADA', 'CANCELADA'],
  EN_CURSO: ['COMPLETADA', 'NO_REALIZADA'],
  COMPLETADA: [],
  NO_REALIZADA: [],
  CANCELADA: [],
};

/** `NO_REALIZADA` y `CANCELADA` siempre exigen una observación (regla 10). */
export function requiereObservacion(codigo: CodigoEstadoTarea): boolean {
  return codigo === 'NO_REALIZADA' || codigo === 'CANCELADA';
}

/** Etiqueta del botón de acción para pasar a ese estado. */
export const ETIQUETA_ACCION: Record<CodigoEstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'Iniciar',
  COMPLETADA: 'Completar',
  NO_REALIZADA: 'No realizada',
  CANCELADA: 'Cancelar',
};

/** Quién pide las acciones disponibles: el usuario autenticado y su rol en el grupo activo. */
export interface QuienConfirma {
  idUsuario: number;
  miRol: string | null;
  esAdministrador: boolean;
}

/**
 * Acciones (estados destino) que `quien` puede ejecutar sobre una tarea que
 * hoy está en `codigoActual` (regla 11 del plan):
 * - el coordinador o el administrador pueden confirmar siempre;
 * - el responsable de la asignación ACTIVA puede confirmar su propia tarea;
 * - sin asignación activa, cualquier integrante puede confirmarla;
 * - cancelar es solo del coordinador o el administrador, y nunca en
 *   tareas `MEDICAMENTOS` (solo se cancelan por un cambio de plan).
 *
 * Nunca ofrece una transición que no exista en `TRANSICIONES`.
 */
export function accionesDisponibles(
  codigoActual: CodigoEstadoTarea,
  tarea: RespuestaTarea,
  quien: QuienConfirma,
): CodigoEstadoTarea[] {
  const esCoordinadorOAdministrador = quien.miRol === 'COORDINADOR' || quien.esAdministrador;
  const esResponsableAsignado = tarea.responsable?.idUsuario === quien.idUsuario;
  const sinAsignacionActiva = tarea.responsable === null;

  const puedeConfirmar = esCoordinadorOAdministrador || esResponsableAsignado || sinAsignacionActiva;
  const puedeCancelar = esCoordinadorOAdministrador && tarea.tipoTarea !== 'MEDICAMENTOS';

  return TRANSICIONES[codigoActual].filter((destino) =>
    destino === 'CANCELADA' ? puedeCancelar : puedeConfirmar,
  );
}
