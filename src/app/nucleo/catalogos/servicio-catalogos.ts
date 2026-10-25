import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

/** Un valor de un catálogo de estados, tal como lo expone `GET /api/catalogos/estados`. */
export interface RespuestaEstadoCatalogo {
  idEstado: number;
  codigo: string;
  descripcion: string;
  orden: number;
}

/** Acceso a los catálogos de referencia (`/api/catalogos`). */
@Injectable({ providedIn: 'root' })
export class ServicioCatalogos {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/catalogos`;

  /** Estados posibles de una tabla/campo, p.ej. `estados('USUARIO', 'ESTADO')`. */
  estados(tabla: string, campo: string): Observable<RespuestaEstadoCatalogo[]> {
    return this.http.get<RespuestaEstadoCatalogo[]>(`${this.urlBase}/estados`, {
      params: { tabla, campo },
    });
  }
}
