import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaDetallePlan,
  RespuestaPlan,
  RespuestaPlanDetallado,
  SolicitudActualizarPlan,
  SolicitudCrearPlan,
  SolicitudGuardarDetalle,
} from './modelos-planificacion';

/** Filtros opcionales de `GET /api/grupos/{idGrupo}/planes`. */
export interface FiltrosListarPlanes {
  idAdulto?: number;
  incluirInactivos?: boolean;
}

/** Acceso a los endpoints de planes de medicamentos y sus detalles. */
@Injectable({ providedIn: 'root' })
export class ServicioPlanes {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  listar(idGrupo: number, filtros: FiltrosListarPlanes = {}): Observable<RespuestaPlan[]> {
    const params: Record<string, string> = {};
    if (filtros.idAdulto !== undefined) {
      params['idAdulto'] = String(filtros.idAdulto);
    }
    if (filtros.incluirInactivos !== undefined) {
      params['incluirInactivos'] = String(filtros.incluirInactivos);
    }
    return this.http.get<RespuestaPlan[]>(`${this.urlBase}/${idGrupo}/planes`, { params });
  }

  obtener(idGrupo: number, idPlan: number): Observable<RespuestaPlanDetallado> {
    return this.http.get<RespuestaPlanDetallado>(`${this.urlBase}/${idGrupo}/planes/${idPlan}`);
  }

  crear(idGrupo: number, solicitud: SolicitudCrearPlan): Observable<RespuestaPlan> {
    return this.http.post<RespuestaPlan>(`${this.urlBase}/${idGrupo}/planes`, solicitud);
  }

  actualizar(
    idGrupo: number,
    idPlan: number,
    solicitud: SolicitudActualizarPlan,
  ): Observable<RespuestaPlan> {
    return this.http.put<RespuestaPlan>(`${this.urlBase}/${idGrupo}/planes/${idPlan}`, solicitud);
  }

  desactivar(idGrupo: number, idPlan: number): Observable<RespuestaPlan> {
    return this.http.post<RespuestaPlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/desactivar`,
      {},
    );
  }

  reactivar(idGrupo: number, idPlan: number): Observable<RespuestaPlan> {
    return this.http.post<RespuestaPlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/reactivar`,
      {},
    );
  }

  eliminar(idGrupo: number, idPlan: number): Observable<void> {
    return this.http.delete<void>(`${this.urlBase}/${idGrupo}/planes/${idPlan}`);
  }

  agregarDetalle(
    idGrupo: number,
    idPlan: number,
    solicitud: SolicitudGuardarDetalle,
  ): Observable<RespuestaDetallePlan> {
    return this.http.post<RespuestaDetallePlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles`,
      solicitud,
    );
  }

  actualizarDetalle(
    idGrupo: number,
    idPlan: number,
    idDetalle: number,
    solicitud: SolicitudGuardarDetalle,
  ): Observable<RespuestaDetallePlan> {
    return this.http.put<RespuestaDetallePlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles/${idDetalle}`,
      solicitud,
    );
  }

  actualizarCantidad(
    idGrupo: number,
    idPlan: number,
    idDetalle: number,
    cantidadDisponible: number,
  ): Observable<RespuestaDetallePlan> {
    return this.http.put<RespuestaDetallePlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles/${idDetalle}/cantidad`,
      { cantidadDisponible },
    );
  }

  desactivarDetalle(
    idGrupo: number,
    idPlan: number,
    idDetalle: number,
  ): Observable<RespuestaDetallePlan> {
    return this.http.post<RespuestaDetallePlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles/${idDetalle}/desactivar`,
      {},
    );
  }

  reactivarDetalle(
    idGrupo: number,
    idPlan: number,
    idDetalle: number,
  ): Observable<RespuestaDetallePlan> {
    return this.http.post<RespuestaDetallePlan>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles/${idDetalle}/reactivar`,
      {},
    );
  }

  eliminarDetalle(idGrupo: number, idPlan: number, idDetalle: number): Observable<void> {
    return this.http.delete<void>(
      `${this.urlBase}/${idGrupo}/planes/${idPlan}/detalles/${idDetalle}`,
    );
  }
}
