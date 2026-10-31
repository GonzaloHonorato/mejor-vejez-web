/**
 * Contratos de la consulta de auditoría (`/api/grupos/{idGrupo}/auditoria`,
 * `/api/auditoria`). Interfaces idénticas
 * a los records de la API, con los mismos nombres, sin el prefijo de
 * paquete. Las fechas y los instantes llegan como `string`
 * (`OffsetDateTime` serializado por Jackson, con el offset de Santiago).
 */

/**
 * Referencia liviana a una persona (usuario): solo su id y su nombre, sin
 * el resto de `USUARIO` (correo, teléfono, estado...). Corresponde a
 * `comun/RespuestaPersona` en la API: la introduce la consulta de
 * auditoría y la reutilizan los relevos y la sucesión (`nucleo/relevos`,
 * `nucleo/sucesion`) para identificar al actor, al saliente, al entrante o
 * al candidato.
 */
export interface RespuestaPersona {
  idUsuario: number;
  nombre: string;
}

/**
 * Lista fija de tipos de entidad auditados, para el
 * selector de filtro de la página de auditoría ("Todas" + esta lista).
 * Verificada con `grep -rn 'TIPO_ENTIDAD.*=.*"' mejor-vejez-api/src/main/java`
 * sobre los `EventoARegistrar` reales:
 * incluye `EJECUCION_PROCESO` (`CodigosTareas.TABLA_EJECUCION_PROCESO`),
 * que audita cada corrida automática de generación de tareas/alertas
 * (`ServicioGeneracionTareas`, `CorridaAlertas`) y no tiene grupo
 * (`idGrupo = null`, como un evento de proceso automático).
 */
export const TIPOS_ENTIDAD_AUDITORIA = [
  'USUARIO',
  'GRUPO_FAMILIAR',
  'INTEGRANTE_GRUPO',
  'ADULTO_MAYOR',
  'CONTACTO_EMERGENCIA',
  'MEDICAMENTO',
  'PLAN_MEDICAMENTOS',
  'DETALLE_PLAN',
  'TAREA_CUIDADO',
  'EJECUCION_PROCESO',
  'ALERTA_CUIDADO',
  'TRASPASO_FAMILIAR',
  'PROPUESTA_SUCESION',
] as const;

export type TipoEntidadAuditoria = (typeof TIPOS_ENTIDAD_AUDITORIA)[number];

/** `EVENTO_AUDITORIA.RESULTADO`; cualquier otro valor da 422 en la API. */
export type CodigoResultadoAuditoria = 'EXITO' | 'FALLO' | 'RECHAZADA';

/**
 * Contrato de un evento de `EVENTO_AUDITORIA`. `actor ===
 * null` es un proceso automático. `detalles` ya pasó por el filtro de
 * datos sensibles del backend; si `DETALLES_JSON` no se pudo interpretar
 * como JSON, es `null`.
 */
export interface RespuestaEventoAuditoria {
  idEvento: number;
  fechaEvento: string;
  nombreServicio: string;
  tipoEntidad: string;
  idEntidad: string;
  idGrupo: number | null;
  actor: RespuestaPersona | null;
  codigoAccion: string;
  idResultado: number;
  codigoResultado: string;
  idCorrelacion: string | null;
  detalles: Record<string, unknown> | null;
}
