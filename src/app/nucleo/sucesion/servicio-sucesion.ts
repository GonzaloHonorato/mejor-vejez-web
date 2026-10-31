import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaPropuesta,
  SolicitudCancelarSucesion,
  SolicitudCompletarSucesion,
  SolicitudProponerSucesion,
  SolicitudReasignacion,
} from './modelos-sucesion';

/** Acceso a los endpoints de sucesión de la coordinación (`/api/grupos/{idGrupo}/sucesion`). */
@Injectable({ providedIn: 'root' })
export class ServicioSucesion {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  proponer(idGrupo: number, idUsuarioCandidato: number): Observable<RespuestaPropuesta> {
    const solicitud: SolicitudProponerSucesion = { idUsuarioCandidato };
    return this.http.post<RespuestaPropuesta>(`${this.urlBase}/${idGrupo}/sucesion`, solicitud);
  }

  /** La propuesta `PENDIENTE` o `ACEPTADA` del grupo, o `null` si la API responde 204 (sin propuesta activa). */
  activa(idGrupo: number): Observable<RespuestaPropuesta | null> {
    return this.http
      .get<RespuestaPropuesta>(`${this.urlBase}/${idGrupo}/sucesion/activa`, {
        observe: 'response',
      })
      .pipe(map((respuesta) => respuesta.body));
  }

  /** Historial del grupo, de la más reciente a la más antigua, sin condiciones (ver API). */
  historial(idGrupo: number): Observable<RespuestaPropuesta[]> {
    return this.http.get<RespuestaPropuesta[]>(`${this.urlBase}/${idGrupo}/sucesion`);
  }

  obtener(idGrupo: number, idPropuesta: number): Observable<RespuestaPropuesta> {
    return this.http.get<RespuestaPropuesta>(`${this.urlBase}/${idGrupo}/sucesion/${idPropuesta}`);
  }

  aceptar(idGrupo: number, idPropuesta: number): Observable<RespuestaPropuesta> {
    return this.http.post<RespuestaPropuesta>(
      `${this.urlBase}/${idGrupo}/sucesion/${idPropuesta}/aceptar`,
      {},
    );
  }

  rechazar(idGrupo: number, idPropuesta: number): Observable<RespuestaPropuesta> {
    return this.http.post<RespuestaPropuesta>(
      `${this.urlBase}/${idGrupo}/sucesion/${idPropuesta}/rechazar`,
      {},
    );
  }

  /** El motivo es opcional (texto libre, nunca va a la auditoría). */
  cancelar(
    idGrupo: number,
    idPropuesta: number,
    motivo?: string | null,
  ): Observable<RespuestaPropuesta> {
    const solicitud: SolicitudCancelarSucesion = { motivo: motivo ?? null };
    return this.http.post<RespuestaPropuesta>(
      `${this.urlBase}/${idGrupo}/sucesion/${idPropuesta}/cancelar`,
      solicitud,
    );
  }

  /** Sin reasignaciones, completa con la lista vacía (lo que vale no tener condiciones pendientes). */
  completar(
    idGrupo: number,
    idPropuesta: number,
    reasignaciones: SolicitudReasignacion[] = [],
  ): Observable<RespuestaPropuesta> {
    const solicitud: SolicitudCompletarSucesion = { reasignaciones };
    return this.http.post<RespuestaPropuesta>(
      `${this.urlBase}/${idGrupo}/sucesion/${idPropuesta}/completar`,
      solicitud,
    );
  }
}
