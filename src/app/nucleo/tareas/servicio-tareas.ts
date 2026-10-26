import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaTarea,
  RespuestaTareaDetallada,
  SolicitudAsignarTarea,
  SolicitudCambiarEstadoTarea,
  SolicitudCrearTareaManual,
} from './modelos-tareas';

/** Filtros opcionales de `GET /api/grupos/{idGrupo}/tareas`. */
export interface FiltrosTareas {
  desde?: string;
  hasta?: string;
  idAdulto?: number;
  idEstado?: number;
  soloMias?: boolean;
}

/** Acceso a los endpoints de tareas de cuidado (agenda, estado, asignación y altas manuales). */
@Injectable({ providedIn: 'root' })
export class ServicioTareas {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  listar(idGrupo: number, filtros: FiltrosTareas = {}): Observable<RespuestaTarea[]> {
    const params: Record<string, string> = {};
    if (filtros.desde !== undefined) {
      params['desde'] = filtros.desde;
    }
    if (filtros.hasta !== undefined) {
      params['hasta'] = filtros.hasta;
    }
    if (filtros.idAdulto !== undefined) {
      params['idAdulto'] = String(filtros.idAdulto);
    }
    if (filtros.idEstado !== undefined) {
      params['idEstado'] = String(filtros.idEstado);
    }
    if (filtros.soloMias !== undefined) {
      params['soloMias'] = String(filtros.soloMias);
    }
    return this.http.get<RespuestaTarea[]>(`${this.urlBase}/${idGrupo}/tareas`, { params });
  }

  obtener(idGrupo: number, idTarea: number): Observable<RespuestaTareaDetallada> {
    return this.http.get<RespuestaTareaDetallada>(`${this.urlBase}/${idGrupo}/tareas/${idTarea}`);
  }

  cambiarEstado(
    idGrupo: number,
    idTarea: number,
    solicitud: SolicitudCambiarEstadoTarea,
  ): Observable<RespuestaTarea> {
    return this.http.post<RespuestaTarea>(
      `${this.urlBase}/${idGrupo}/tareas/${idTarea}/estado`,
      solicitud,
    );
  }

  asignar(
    idGrupo: number,
    idTarea: number,
    solicitud: SolicitudAsignarTarea,
  ): Observable<RespuestaTarea> {
    return this.http.put<RespuestaTarea>(
      `${this.urlBase}/${idGrupo}/tareas/${idTarea}/asignacion`,
      solicitud,
    );
  }

  crearManual(idGrupo: number, solicitud: SolicitudCrearTareaManual): Observable<RespuestaTarea> {
    return this.http.post<RespuestaTarea>(`${this.urlBase}/${idGrupo}/tareas`, solicitud);
  }
}
