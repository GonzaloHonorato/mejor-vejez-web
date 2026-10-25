import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

/** Contrato de `GET /api/yo`: el usuario de la sesión según la API. */
export interface RespuestaYo {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono: string | null;
  esAdministrador: boolean;
}

/** Cambios aceptados por `PATCH /api/yo`. */
export interface SolicitudActualizarPerfil {
  nombre: string;
  telefono: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServicioYo {
  private readonly http = inject(HttpClient);

  obtener(): Observable<RespuestaYo> {
    return this.http.get<RespuestaYo>(`${configuracionEjecucion.urlApi}/api/yo`);
  }

  actualizar(solicitud: SolicitudActualizarPerfil): Observable<RespuestaYo> {
    return this.http.patch<RespuestaYo>(`${configuracionEjecucion.urlApi}/api/yo`, solicitud);
  }
}
