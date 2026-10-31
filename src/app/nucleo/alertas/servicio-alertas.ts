import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';
import {
  RespuestaAlerta,
  RespuestaAlertaDetallada,
  SolicitudCerrarAlerta,
  TipoAlerta,
} from './modelos-alertas';

/** Filtros opcionales de `GET /api/grupos/{idGrupo}/alertas`. */
export interface FiltroAlertas {
  idEstado?: number;
  tipoAlerta?: TipoAlerta;
  idAdulto?: number;
  pagina?: number;
  tamano?: number;
}

/** Acceso a los endpoints de la bandeja de alertas de cuidado (`/api/grupos/{idGrupo}/alertas`). */
@Injectable({ providedIn: 'root' })
export class ServicioAlertas {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  listar(
    idGrupo: number,
    filtro: FiltroAlertas = {},
  ): Observable<RespuestaPagina<RespuestaAlerta>> {
    const parametros: Record<string, string> = {};
    if (filtro.idEstado !== undefined) {
      parametros['idEstado'] = String(filtro.idEstado);
    }
    if (filtro.tipoAlerta !== undefined) {
      parametros['tipoAlerta'] = filtro.tipoAlerta;
    }
    if (filtro.idAdulto !== undefined) {
      parametros['idAdulto'] = String(filtro.idAdulto);
    }
    if (filtro.pagina !== undefined) {
      parametros['pagina'] = String(filtro.pagina);
    }
    if (filtro.tamano !== undefined) {
      parametros['tamano'] = String(filtro.tamano);
    }
    return this.http.get<RespuestaPagina<RespuestaAlerta>>(`${this.urlBase}/${idGrupo}/alertas`, {
      params: parametros,
    });
  }

  obtener(idGrupo: number, idAlerta: number): Observable<RespuestaAlertaDetallada> {
    return this.http.get<RespuestaAlertaDetallada>(
      `${this.urlBase}/${idGrupo}/alertas/${idAlerta}`,
    );
  }

  cerrar(
    idGrupo: number,
    idAlerta: number,
    observacion: string,
  ): Observable<RespuestaAlertaDetallada> {
    const solicitud: SolicitudCerrarAlerta = { observacion };
    return this.http.post<RespuestaAlertaDetallada>(
      `${this.urlBase}/${idGrupo}/alertas/${idAlerta}/cierre`,
      solicitud,
    );
  }
}
