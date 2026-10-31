/**
 * Contratos de `/api/grupos/{idGrupo}/tareas`.
 * Interfaces idénticas a los records de la API, con los mismos nombres, sin
 * el prefijo de paquete. Las fechas y los instantes llegan como `string`
 * (`LocalDate`/`OffsetDateTime` serializados por Jackson).
 */

/** Tipos de tarea de cuidado (MEDICAMENTOS solo se cancela por el plan). */
export type TipoTarea = 'MEDICAMENTOS' | 'COMPRA_RETIRO_MEDICAMENTOS' | 'CITAS_CONTROLES_MEDICOS';

/**
 * Tipos de tarea que se pueden crear a mano desde `NuevaTarea`: MEDICAMENTOS
 * queda fuera porque solo la genera el planificador; crearla a
 * mano la rechazaría la API con 422.
 */
export type TipoTareaManual = Extract<
  TipoTarea,
  'COMPRA_RETIRO_MEDICAMENTOS' | 'CITAS_CONTROLES_MEDICOS'
>;

/** Responsable asignado de una tarea (asignación ACTIVO). */
export interface RespuestaResponsable {
  idUsuario: number;
  nombre: string;
}

/** Una línea de compra/retiro de medicamentos de una tarea manual. */
export interface RespuestaLineaCompra {
  idDetalleCompra: number;
  idMedicamento: number;
  nombreMedicamento: string;
  idPresentacion: number;
  dosisIndicada: string | null;
  cantidadSolicitada: number;
  idUnidadCantidad: number;
  observaciones: string | null;
}

/** Datos de la cita o control médico de una tarea manual. */
export interface RespuestaCita {
  nombreMedico: string;
  lugarAtencion: string;
  observaciones: string | null;
}

/** Contrato de `/api/grupos/{idGrupo}/tareas`: una tarea de cuidado. */
export interface RespuestaTarea {
  idTarea: number;
  tipoTarea: TipoTarea;
  idAdultoMayor: number;
  nombreAdulto: string;
  idDetallePlan: number | null;
  titulo: string;
  descripcion: string | null;
  fechaHorario: string;
  minutosTolerancia: number;
  idEstado: number;
  atrasada: boolean;
  responsable: RespuestaResponsable | null;
  observacionCierre: string | null;
  nombreConfirmador: string | null;
  fechaConfirmacion: string | null;
  motivoCancelacion: string | null;
  compra: RespuestaLineaCompra[];
  cita: RespuestaCita | null;
}

/** Una fila del historial de cambios de estado de una tarea (solo inserción). */
export interface RespuestaHistorialEstado {
  idEstadoAnterior: number | null;
  idEstadoNuevo: number;
  nombreUsuario: string;
  fechaCambio: string;
  observacion: string | null;
}

/** Una asignación (activa, reemplazada o cancelada) de una tarea. */
export interface RespuestaAsignacion {
  idAsignacion: number;
  idUsuarioAsignado: number;
  nombreAsignado: string;
  nombreAsignador: string;
  fechaAsignacion: string;
  fechaTermino: string | null;
  idEstado: number;
  motivo: string | null;
}

/** Contrato de `GET /api/grupos/{idGrupo}/tareas/{idTarea}`: la tarea con su historial y asignaciones. */
export interface RespuestaTareaDetallada {
  tarea: RespuestaTarea;
  historial: RespuestaHistorialEstado[];
  asignaciones: RespuestaAsignacion[];
}

/** Datos para `POST /api/grupos/{idGrupo}/tareas/{idTarea}/estado`. */
export interface SolicitudCambiarEstadoTarea {
  idEstado: number;
  observacion: string | null;
}

/** Datos para `PUT /api/grupos/{idGrupo}/tareas/{idTarea}/asignacion`. */
export interface SolicitudAsignarTarea {
  idUsuario: number;
  motivo: string | null;
}

/** Una línea de compra/retiro de medicamentos para crear una tarea manual. */
export interface SolicitudLineaCompra {
  idMedicamento: number;
  idPresentacion: number;
  dosisIndicada: string | null;
  cantidadSolicitada: number;
  idUnidadCantidad: number;
  observaciones: string | null;
}

/** Datos de la cita o control médico para crear una tarea manual. */
export interface SolicitudCita {
  nombreMedico: string;
  lugarAtencion: string;
  observaciones: string | null;
}

/** Datos para `POST /api/grupos/{idGrupo}/tareas` (tarea manual de compra o cita). */
export interface SolicitudCrearTareaManual {
  tipoTarea: TipoTareaManual;
  idAdultoMayor: number;
  titulo: string;
  descripcion: string | null;
  fechaHorario: string;
  idResponsable: number | null;
  compra: SolicitudLineaCompra[] | null;
  cita: SolicitudCita | null;
}
