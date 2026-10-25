import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

/** Contrato de `GET /api/yo`: el usuario de la sesión según la API. */
export interface RespuestaYo {
  idUsuario: number;
  nombre: string;
  email: string;
  esAdministrador: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServicioYo {
  private readonly http = inject(HttpClient);

  obtener(): Observable<RespuestaYo> {
    return this.http.get<RespuestaYo>(`${configuracionEjecucion.urlApi}/api/yo`);
  }
}
