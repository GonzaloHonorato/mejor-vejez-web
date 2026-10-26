import type { HorarioJson } from './horario';

/** Contrato de `/api/grupos/{idGrupo}/medicamentos`: un medicamento del catálogo global. */
export interface RespuestaMedicamento {
  idMedicamento: number;
  nombre: string;
  principioActivo: string | null;
  idPresentacion: number | null;
  concentracion: string | null;
  usadoEnGrupo: boolean;
}

/** Datos para `POST /api/grupos/{idGrupo}/medicamentos`. */
export interface SolicitudCrearMedicamento {
  nombre: string;
  principioActivo: string | null;
  idPresentacion: number;
  concentracion: string | null;
}

/** Contrato de `/api/grupos/{idGrupo}/planes`: un plan de medicamentos. */
export interface RespuestaPlan {
  idPlan: number;
  idGrupo: number;
  idAdultoMayor: number;
  nombreAdulto: string;
  nombrePlan: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  idEstado: number;
  medicamentosActivos: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

/** Contrato de `/api/grupos/{idGrupo}/planes/{idPlan}/detalles`: un medicamento del plan. */
export interface RespuestaDetallePlan {
  idDetallePlan: number;
  idPlan: number;
  idMedicamento: number;
  nombreMedicamento: string;
  idPresentacion: number;
  concentracion: string | null;
  instrucciones: string | null;
  dosisCantidad: number;
  idUnidadDosis: number;
  /** Ids de `DIA_SEMANA`, ordenados por `ORDEN`. */
  diasSemana: number[];
  /** Horas "HH:mm", ordenadas. */
  horas: string[];
  fechaInicio: string;
  fechaFin: string | null;
  cantidadInicial: number | null;
  cantidadDisponible: number | null;
  fechaEstimadaTermino: string | null;
  modoCalculoTermino: 'AUTOMATICO' | 'MANUAL';
  idResponsablePredeterminado: number | null;
  idEstado: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

/** Contrato de `GET /api/grupos/{idGrupo}/planes/{idPlan}`: el plan con todos sus detalles. */
export interface RespuestaPlanDetallado {
  plan: RespuestaPlan;
  detalles: RespuestaDetallePlan[];
}

/** Datos para `POST /api/grupos/{idGrupo}/planes`. */
export interface SolicitudCrearPlan {
  idAdultoMayor: number;
  nombrePlan: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

/** Datos para `PUT /api/grupos/{idGrupo}/planes/{idPlan}`. */
export interface SolicitudActualizarPlan {
  nombrePlan: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

/** Datos para `POST`/`PUT` de `/api/grupos/{idGrupo}/planes/{idPlan}/detalles`. */
export interface SolicitudGuardarDetalle {
  idMedicamento: number;
  idPresentacion: number;
  concentracion: string | null;
  instrucciones: string | null;
  dosisCantidad: number;
  idUnidadDosis: number;
  diasSemana: number[];
  horario: HorarioJson;
  fechaInicio: string;
  fechaFin: string | null;
  cantidadInicial: number | null;
  cantidadDisponible: number | null;
  modoCalculoTermino: 'AUTOMATICO' | 'MANUAL';
  fechaEstimadaTermino: string | null;
  idResponsablePredeterminado: number | null;
}
