import { RespuestaPersona } from '../auditoria/modelos-auditoria';

/**
 * Contratos de `/api/grupos/{idGrupo}/relevos`. Interfaces idénticas a
 * los records de la API, con los mismos nombres, sin el prefijo de paquete. Las fechas y los instantes llegan
 * como `string` (`OffsetDateTime` serializado por Jackson, con el offset
 * de Santiago). `RespuestaPersona` (`comun/RespuestaPersona` en la API) se
 * define en `nucleo/auditoria`, que es donde la introduce la API, y se
 * reutiliza aquí.
 */

/** `DETALLE_TRASPASO.TIPO_ELEMENTO`: una tarea o una alerta pendiente al momento de registrar el relevo. */
export type TipoElementoRelevo = 'TAREA' | 'ALERTA';

/**
 * Un elemento de la foto de un relevo. `resumen` es el
 * texto que armó el backend al registrar el relevo: una foto, no se
 * vuelve a calcular, así que el estado actual de la tarea o la alerta
 * puede haber cambiado desde entonces.
 */
export interface RespuestaDetalleRelevo {
  idDetalle: number;
  tipoElemento: TipoElementoRelevo;
  idReferencia: number;
  resumen: string;
}

/**
 * Contrato de `POST .../relevos` y `GET .../relevos/{id}`: el relevo
 * completo, con su foto de tareas y alertas pendientes. El grupo y el
 * adulto se identifican con su id y su nombre.
 */
export interface RespuestaRelevo {
  idRelevo: number;
  idGrupo: number;
  nombreGrupo: string;
  idAdulto: number;
  nombreAdulto: string;
  saliente: RespuestaPersona;
  entrante: RespuestaPersona;
  creador: RespuestaPersona;
  fechaTraspaso: string;
  notas: string | null;
  idEstado: number;
  codigoEstado: string;
  totalTareas: number;
  totalAlertas: number;
  detalles: RespuestaDetalleRelevo[];
}

/** Fila de `GET .../relevos` (listado paginado): igual a `RespuestaRelevo`, sin `notas` ni `detalles`. */
export interface RespuestaRelevoResumen {
  idRelevo: number;
  idGrupo: number;
  nombreGrupo: string;
  idAdulto: number;
  nombreAdulto: string;
  saliente: RespuestaPersona;
  entrante: RespuestaPersona;
  creador: RespuestaPersona;
  fechaTraspaso: string;
  idEstado: number;
  codigoEstado: string;
  totalTareas: number;
  totalAlertas: number;
}

/** Datos para `POST /api/grupos/{idGrupo}/relevos`. */
export interface SolicitudRegistrarRelevo {
  idAdulto: number;
  idUsuarioSaliente: number;
  idUsuarioEntrante: number;
  notas: string | null;
}
