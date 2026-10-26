import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { RespuestaMedicamento, SolicitudCrearMedicamento } from './modelos-planificacion';

/** Acceso al catálogo global de medicamentos (`/api/grupos/{idGrupo}/medicamentos`). */
@Injectable({ providedIn: 'root' })
export class ServicioMedicamentos {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  buscar(idGrupo: number, texto?: string): Observable<RespuestaMedicamento[]> {
    return this.http.get<RespuestaMedicamento[]>(`${this.urlBase}/${idGrupo}/medicamentos`, {
      params: texto ? { texto } : {},
    });
  }

  crear(idGrupo: number, solicitud: SolicitudCrearMedicamento): Observable<RespuestaMedicamento> {
    return this.http.post<RespuestaMedicamento>(
      `${this.urlBase}/${idGrupo}/medicamentos`,
      solicitud,
    );
  }
}
