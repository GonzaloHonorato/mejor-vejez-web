import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

export type EstadoComponente = 'DISPONIBLE' | 'NO_DISPONIBLE';

export interface RespuestaSalud {
  estado: 'DISPONIBLE' | 'DEGRADADO';
  servicio: string;
  version: string;
  fechaHora: string;
  baseDatos: { estado: EstadoComponente; latenciaMs: number | null };
}

/** `SaludApi` es el mismo contrato que expone `GET /api/salud`. */
export type SaludApi = RespuestaSalud;

@Injectable({ providedIn: 'root' })
export class ServicioSalud {
  private readonly http = inject(HttpClient);

  consultar(): Observable<SaludApi> {
    return this.http.get<SaludApi>(`${configuracionEjecucion.urlApi}/api/salud`);
  }
}
