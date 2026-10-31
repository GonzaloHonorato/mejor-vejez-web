import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';
import {
  RespuestaRelevo,
  RespuestaRelevoResumen,
  SolicitudRegistrarRelevo,
} from './modelos-relevos';

/** Filtros opcionales de `GET /api/grupos/{idGrupo}/relevos`. */
export interface FiltroRelevos {
  idAdulto?: number;
  pagina?: number;
  tamano?: number;
}

/** Acceso a los endpoints de relevos del turno de cuidado (`/api/grupos/{idGrupo}/relevos`). */
@Injectable({ providedIn: 'root' })
export class ServicioRelevos {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  registrar(idGrupo: number, datos: SolicitudRegistrarRelevo): Observable<RespuestaRelevo> {
    return this.http.post<RespuestaRelevo>(`${this.urlBase}/${idGrupo}/relevos`, datos);
  }

  listar(
    idGrupo: number,
    filtro: FiltroRelevos = {},
  ): Observable<RespuestaPagina<RespuestaRelevoResumen>> {
    const parametros: Record<string, string> = {};
    if (filtro.idAdulto !== undefined) {
      parametros['idAdulto'] = String(filtro.idAdulto);
    }
    if (filtro.pagina !== undefined) {
      parametros['pagina'] = String(filtro.pagina);
    }
    if (filtro.tamano !== undefined) {
      parametros['tamano'] = String(filtro.tamano);
    }
    return this.http.get<RespuestaPagina<RespuestaRelevoResumen>>(
      `${this.urlBase}/${idGrupo}/relevos`,
      {
        params: parametros,
      },
    );
  }

  obtener(idGrupo: number, idRelevo: number): Observable<RespuestaRelevo> {
    return this.http.get<RespuestaRelevo>(`${this.urlBase}/${idGrupo}/relevos/${idRelevo}`);
  }

  cancelar(idGrupo: number, idRelevo: number): Observable<RespuestaRelevo> {
    return this.http.post<RespuestaRelevo>(
      `${this.urlBase}/${idGrupo}/relevos/${idRelevo}/cancelar`,
      {},
    );
  }
}
