import { TipoEntidadAuditoria } from './modelos-auditoria';

/**
 * Etiquetas legibles de la auditoría (ajustes post-F7): la página muestra
 * la frase y deja el código crudo como texto secundario.
 *
 * El mapa de acciones cubre TODOS los `codigoAccion` que audita la API.
 * Verificado con grep sobre `mejor-vejez-api/src/main/java`: constantes
 * `ACCION_*`, `AccionesAlertas`, `AccionesTareas`, `AccionesPlanificacion`,
 * `CodigosRelevos`, `CodigosSucesion`, `CodigosPanel`,
 * `CodigosNotificaciones` y los literales pasados a `new
 * EventoARegistrar(...)`. Un código nuevo que todavía no esté aquí no
 * rompe la página: cae al respaldo (`frasePorDefecto`).
 */
const ETIQUETAS_ACCION: Readonly<Record<string, string>> = {
  // Seguridad (ServicioAutorizacion, ServicioUsuarioActual)
  ACCESO_GRUPO: 'Intento de acceso al grupo',
  ACCESO_ADMINISTRADOR: 'Intento de acceso de administrador',
  CREAR_USUARIO_PRIMER_INGRESO: 'Ingresó por primera vez',
  // Usuarios y perfil
  ACTUALIZAR_PERFIL: 'Actualizó su perfil',
  ADMIN_ACTUALIZAR_USUARIO: 'Administración actualizó un usuario',
  ADMIN_CAMBIAR_ESTADO_USUARIO: 'Administración cambió el estado de un usuario',
  ACTUALIZAR_CANALES_NOTIFICACION: 'Actualizó los canales de notificación',
  // Grupos e integrantes
  CREAR_GRUPO: 'Creó un grupo',
  ACTUALIZAR_GRUPO: 'Actualizó el grupo',
  INCORPORAR_INTEGRANTE: 'Incorporó a un integrante',
  REACTIVAR_INTEGRANTE: 'Reactivó a un integrante',
  CAMBIAR_ROL_INTEGRANTE: 'Cambió el rol de un integrante',
  DESACTIVAR_INTEGRANTE: 'Desactivó a un integrante',
  SALIR_GRUPO: 'Salió del grupo',
  ELIMINAR_INTEGRANTE: 'Eliminó a un integrante',
  // Adultos mayores y contactos
  CREAR_ADULTO_MAYOR: 'Registró un adulto mayor',
  ACTUALIZAR_ADULTO_MAYOR: 'Actualizó un adulto mayor',
  DESACTIVAR_ADULTO_MAYOR: 'Desactivó un adulto mayor',
  REACTIVAR_ADULTO_MAYOR: 'Reactivó un adulto mayor',
  ELIMINAR_ADULTO_MAYOR: 'Eliminó un adulto mayor',
  CREAR_CONTACTO: 'Agregó un contacto de emergencia',
  ACTUALIZAR_CONTACTO: 'Actualizó un contacto de emergencia',
  DESIGNAR_CONTACTO_PRINCIPAL: 'Designó el contacto principal',
  DESACTIVAR_CONTACTO: 'Desactivó un contacto de emergencia',
  REACTIVAR_CONTACTO: 'Reactivó un contacto de emergencia',
  ELIMINAR_CONTACTO: 'Eliminó un contacto de emergencia',
  // Medicamentos y planes (AccionesPlanificacion, ServicioMedicamentos)
  CREAR_MEDICAMENTO: 'Creó un medicamento',
  CREAR_PLAN: 'Creó un plan de medicamentos',
  ACTUALIZAR_PLAN: 'Actualizó un plan de medicamentos',
  DESACTIVAR_PLAN: 'Desactivó un plan de medicamentos',
  REACTIVAR_PLAN: 'Reactivó un plan de medicamentos',
  ELIMINAR_PLAN: 'Eliminó un plan de medicamentos',
  AGREGAR_MEDICAMENTO_PLAN: 'Agregó un medicamento al plan',
  ACTUALIZAR_MEDICAMENTO_PLAN: 'Actualizó un medicamento del plan',
  ACTUALIZAR_CANTIDAD_DISPONIBLE: 'Actualizó la cantidad disponible',
  DESACTIVAR_MEDICAMENTO_PLAN: 'Desactivó un medicamento del plan',
  REACTIVAR_MEDICAMENTO_PLAN: 'Reactivó un medicamento del plan',
  ELIMINAR_MEDICAMENTO_PLAN: 'Eliminó un medicamento del plan',
  // Tareas (AccionesTareas)
  CREAR_TAREA_MANUAL: 'Creó una tarea manual',
  ASIGNAR_TAREA: 'Asignó una tarea',
  REASIGNAR_TAREA: 'Reasignó una tarea',
  CAMBIAR_ESTADO_TAREA: 'Cambió el estado de una tarea',
  CANCELAR_TAREA_POR_CAMBIO_PLAN: 'Canceló una tarea por cambio de plan',
  EJECUTAR_GENERACION_TAREAS: 'Ejecutó la generación de tareas',
  // Alertas (AccionesAlertas)
  CERRAR_ALERTA: 'Cerró una alerta',
  EJECUTAR_DETECCION_ATRASOS: 'Ejecutó la detección de atrasos',
  EJECUTAR_ALERTAS_PREVENTIVAS: 'Ejecutó las alertas preventivas',
  // Panel (CodigosPanel)
  CONSULTAR_PANEL: 'Consultó el panel familiar',
  // Relevos (CodigosRelevos)
  REGISTRAR_RELEVO: 'Registró un relevo',
  CANCELAR_RELEVO: 'Canceló un relevo',
  CONSULTAR_RELEVO: 'Consultó un relevo',
  // Sucesión (CodigosSucesion)
  PROPONER_SUCESION: 'Propuso una sucesión',
  ACEPTAR_SUCESION: 'Aceptó la sucesión',
  RECHAZAR_SUCESION: 'Rechazó la sucesión',
  CANCELAR_SUCESION: 'Canceló la sucesión',
  COMPLETAR_SUCESION: 'Completó la sucesión',
  // Auditoría (ServicioConsultaAuditoria)
  CONSULTAR_AUDITORIA: 'Consultó la auditoría',
};

/** Los 13 de `TIPOS_ENTIDAD_AUDITORIA`: el tipo `Record` obliga a no olvidar ninguno. */
const ETIQUETAS_ENTIDAD: Readonly<Record<TipoEntidadAuditoria, string>> = {
  USUARIO: 'Usuario',
  GRUPO_FAMILIAR: 'Grupo familiar',
  INTEGRANTE_GRUPO: 'Integrante del grupo',
  ADULTO_MAYOR: 'Adulto mayor',
  CONTACTO_EMERGENCIA: 'Contacto de emergencia',
  MEDICAMENTO: 'Medicamento',
  PLAN_MEDICAMENTOS: 'Plan de medicamentos',
  DETALLE_PLAN: 'Medicamento del plan',
  TAREA_CUIDADO: 'Tarea de cuidado',
  EJECUCION_PROCESO: 'Proceso automático',
  ALERTA_CUIDADO: 'Alerta de cuidado',
  TRASPASO_FAMILIAR: 'Relevo',
  PROPUESTA_SUCESION: 'Propuesta de sucesión',
};

/** Códigos de acción conocidos (para el selector "Código de acción" de la página). */
export const CODIGOS_ACCION_AUDITORIA: readonly string[] = Object.keys(ETIQUETAS_ACCION);

/** Respaldo para un código desconocido: `"ALGO_NUEVO"` → `"Algo nuevo"`. */
function frasePorDefecto(codigo: string): string {
  const frase = codigo.trim().toLowerCase().replace(/_+/g, ' ').trim();
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

function etiquetaDe(mapa: Readonly<Record<string, string>>, codigo: string): string {
  return Object.prototype.hasOwnProperty.call(mapa, codigo) ? mapa[codigo] : frasePorDefecto(codigo);
}

export function etiquetaAccion(codigo: string): string {
  return etiquetaDe(ETIQUETAS_ACCION, codigo);
}

export function etiquetaEntidad(tipo: string): string {
  return etiquetaDe(ETIQUETAS_ENTIDAD, tipo);
}
