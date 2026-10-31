/**
 * Contratos de `/api/grupos/{idGrupo}/alertas`.
 * Interfaces idénticas a los records de la API, con los mismos nombres, sin
 * el prefijo de paquete. Las fechas y los instantes llegan como `string`
 * (`OffsetDateTime` serializado por Jackson, con el offset de Santiago).
 */

/** Tipos de alerta (`ATR-`, `CIT-` y `REP-` como prefijo de clave). */
export type TipoAlerta = 'ATRASO_TAREA' | 'REPOSICION_MEDICAMENTO' | 'CITA_PROXIMA';

/** Quién revisó (cerró) la alerta. */
export interface RespuestaRevisor {
  idUsuario: number;
  nombre: string;
}

/** Contrato de `/api/grupos/{idGrupo}/alertas`: una alerta de cuidado. */
export interface RespuestaAlerta {
  idAlerta: number;
  tipoAlerta: TipoAlerta;
  idTarea: number | null;
  tituloTarea: string | null;
  idEstadoTarea: number | null;
  idDetallePlan: number | null;
  nombreMedicamento: string | null;
  idAdultoMayor: number;
  nombreAdulto: string;
  fechaProgramada: string;
  mensajeAlerta: string;
  idEstado: number;
  fechaDeteccion: string;
  revisor: RespuestaRevisor | null;
  fechaRevision: string | null;
  observacionCierre: string | null;
}

/** Un intento de notificación de una alerta. */
export interface RespuestaIntento {
  idIntento: number;
  idUsuarioDestinatario: number;
  nombreDestinatario: string;
  canal: string;
  numeroIntento: number;
  idEstadoEnvio: number;
  fechaIntento: string;
  detalleError: string | null;
}

/** Contrato de `GET /api/grupos/{idGrupo}/alertas/{idAlerta}`: la alerta con sus intentos de envío. */
export interface RespuestaAlertaDetallada {
  alerta: RespuestaAlerta;
  intentos: RespuestaIntento[];
}

/** Datos para `POST /api/grupos/{idGrupo}/alertas/{idAlerta}/cierre`. */
export interface SolicitudCerrarAlerta {
  observacion: string;
}
