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

/** Un valor de un catálogo de opciones de negocio, tal como lo expone `GET /api/catalogos/opciones`. */
export interface RespuestaOpcionCatalogo {
  idOpcion: number;
  codigo: string;
  descripcion: string;
  orden: number;
}

/** Tipos de catálogo de negocio soportados por `GET /api/catalogos/opciones`. */
export type TipoCatalogo =
  'PRESENTACION_MEDICAMENTO' | 'UNIDAD_DOSIS' | 'DIA_SEMANA' | 'PARENTESCO';

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

  /** Opciones activas de un catálogo de negocio, p.ej. `opciones('DIA_SEMANA')`. */
  opciones(tipo: TipoCatalogo): Observable<RespuestaOpcionCatalogo[]> {
    return this.http.get<RespuestaOpcionCatalogo[]>(`${this.urlBase}/opciones`, {
      params: { tipo },
    });
  }
}
