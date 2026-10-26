/**
 * Contratos de `/api/grupos/{idGrupo}/panel/*` (Tareas 1 y 2 de la API,
 * Fase 6). Interfaces idénticas a los records de la API, con los mismos
 * nombres, sin el prefijo de paquete. Reutilizan `RespuestaTarea` y
 * `RespuestaAlerta` ya definidas para la agenda y la bandeja de alertas
 * (reglas 2–6 del plan).
 */
import { RespuestaAlerta } from '../alertas/modelos-alertas';
import { RespuestaTarea } from '../tareas/modelos-tareas';

/**
 * Contrato de `/api/grupos/{idGrupo}/panel/tareas`: resumen de tareas de hoy
 * (en Santiago) más las atrasadas (regla 2 del plan). "Vacío" (regla 13):
 * los 6 conteos en 0.
 */
export interface RespuestaPanelTareas {
  fecha: string;
  pendientes: number;
  enCurso: number;
  completadas: number;
  noRealizadas: number;
  canceladas: number;
  atrasadas: number;
  tareasAtrasadas: RespuestaTarea[];
}

/**
 * Contrato de `/api/grupos/{idGrupo}/panel/alertas`: resumen de alertas de
 * atraso (`ATRASO_TAREA`, regla 3 del plan). "Vacío" (regla 13):
 * `abiertas == 0 && cerradasUltimos7Dias == 0`.
 */
export interface RespuestaPanelAlertas {
  abiertas: number;
  cerradasUltimos7Dias: number;
  recientes: RespuestaAlerta[];
}

/**
 * Contrato de `/api/grupos/{idGrupo}/panel/proximos-horarios`: tareas de
 * medicamentos/retiro en las próximas 24 h (regla 4 del plan).
 */
export interface RespuestaPanelHorarios {
  tareas: RespuestaTarea[];
}

/**
 * Contrato de `/api/grupos/{idGrupo}/panel/citas`: citas y controles médicos
 * en los próximos 14 días (regla 5 del plan).
 */
export interface RespuestaPanelCitas {
  citas: RespuestaTarea[];
}

/**
 * Contrato de `/api/grupos/{idGrupo}/panel/alertas-preventivas`: alertas
 * ABIERTA de reposición de medicamento o cita próxima (regla 6 del plan).
 */
export interface RespuestaPanelPreventivas {
  alertas: RespuestaAlerta[];
}
