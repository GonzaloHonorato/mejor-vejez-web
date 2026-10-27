import { RespuestaPersona } from '../auditoria/modelos-auditoria';
import { RespuestaTarea } from '../tareas/modelos-tareas';

/**
 * Contratos de `/api/grupos/{idGrupo}/sucesion` (Fase 7, Tarea 3 de la
 * API, HU-13). Interfaces idénticas a los records de la API, con los
 * mismos nombres, sin el prefijo de paquete. Las fechas y los instantes
 * llegan como `string` (`OffsetDateTime` serializado por Jackson, con el
 * offset de Santiago). `RespuestaPersona` se define en `nucleo/auditoria`
 * (donde la introduce la API) y se reutiliza aquí.
 */

/**
 * Propuesta de sucesión de la coordinación (regla 24 del plan).
 * `condicionesPendientes` son las tareas abiertas del saliente (regla 19,
 * con el mismo `RespuestaTarea` de `nucleo/tareas`), calculadas en vivo
 * solo si la propuesta está `PENDIENTE` o `ACEPTADA`; en cualquier otro
 * estado, y en el historial, va vacía.
 */
export interface RespuestaPropuesta {
  idPropuesta: number;
  idGrupo: number;
  saliente: RespuestaPersona;
  candidato: RespuestaPersona;
  idEstado: number;
  codigoEstado: string;
  fechaCreacion: string;
  fechaRespuesta: string | null;
  fechaCancelacion: string | null;
  fechaCompletado: string | null;
  motivoCancelacion: string | null;
  condicionesPendientes: RespuestaTarea[];
}

/** Datos para `POST /api/grupos/{idGrupo}/sucesion`. */
export interface SolicitudProponerSucesion {
  idUsuarioCandidato: number;
}

/** Datos opcionales para `POST .../sucesion/{idPropuesta}/cancelar`; el cuerpo completo es opcional. */
export interface SolicitudCancelarSucesion {
  motivo: string | null;
}

/**
 * Una reasignación pedida al completar la sucesión (regla 15 del plan): la
 * tarea `idTarea` (condición pendiente) pasa a `idUsuario`.
 */
export interface SolicitudReasignacion {
  idTarea: number;
  idUsuario: number;
}

/**
 * Datos para `POST .../sucesion/{idPropuesta}/completar`; el cuerpo
 * completo es opcional y `reasignaciones` puede ir vacía.
 */
export interface SolicitudCompletarSucesion {
  reasignaciones: SolicitudReasignacion[];
}
