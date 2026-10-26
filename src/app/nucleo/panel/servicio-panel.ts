import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaPanelAlertas,
  RespuestaPanelCitas,
  RespuestaPanelHorarios,
  RespuestaPanelPreventivas,
  RespuestaPanelTareas,
} from './modelos-panel';

/** Acceso a los endpoints de resumen del panel familiar (`/api/grupos/{idGrupo}/panel/*`, regla 1 del plan). */
@Injectable({ providedIn: 'root' })
export class ServicioPanel {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  tareas(idGrupo: number, idAdulto?: number | null): Observable<RespuestaPanelTareas> {
    return this.http.get<RespuestaPanelTareas>(`${this.urlBase}/${idGrupo}/panel/tareas`, {
      params: this.parametroAdulto(idAdulto),
    });
  }

  alertas(idGrupo: number, idAdulto?: number | null): Observable<RespuestaPanelAlertas> {
    return this.http.get<RespuestaPanelAlertas>(`${this.urlBase}/${idGrupo}/panel/alertas`, {
      params: this.parametroAdulto(idAdulto),
    });
  }

  proximosHorarios(idGrupo: number, idAdulto?: number | null): Observable<RespuestaPanelHorarios> {
    return this.http.get<RespuestaPanelHorarios>(
      `${this.urlBase}/${idGrupo}/panel/proximos-horarios`,
      { params: this.parametroAdulto(idAdulto) },
    );
  }

  citas(idGrupo: number, idAdulto?: number | null): Observable<RespuestaPanelCitas> {
    return this.http.get<RespuestaPanelCitas>(`${this.urlBase}/${idGrupo}/panel/citas`, {
      params: this.parametroAdulto(idAdulto),
    });
  }

  alertasPreventivas(
    idGrupo: number,
    idAdulto?: number | null,
  ): Observable<RespuestaPanelPreventivas> {
    return this.http.get<RespuestaPanelPreventivas>(
      `${this.urlBase}/${idGrupo}/panel/alertas-preventivas`,
      { params: this.parametroAdulto(idAdulto) },
    );
  }

  /** `idAdulto` solo se envía cuando viene definido y no nulo. */
  private parametroAdulto(idAdulto?: number | null): Record<string, string> {
    const parametros: Record<string, string> = {};
    if (idAdulto !== undefined && idAdulto !== null) {
      parametros['idAdulto'] = String(idAdulto);
    }
    return parametros;
  }
}
