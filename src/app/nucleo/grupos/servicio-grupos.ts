import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaGrupo,
  RespuestaIntegrante,
  RespuestaIntegranteCreado,
  RespuestaRol,
  SolicitudCrearIntegrante,
} from './modelos-grupos';

/** Cambios aceptados por `PATCH /api/grupos/{idGrupo}`. */
export interface CambiosGrupo {
  nombreGrupo: string;
  notificaCoordinador: boolean;
}

/** Datos para `POST /api/grupos/{idGrupo}/integrantes`. */
export interface DatosIncorporarIntegrante {
  email: string;
  idRol: number;
}

/** Acceso a los endpoints de `/api/grupos` (grupos familiares e integrantes). */
@Injectable({ providedIn: 'root' })
export class ServicioGrupos {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  listar(todos = false): Observable<RespuestaGrupo[]> {
    return this.http.get<RespuestaGrupo[]>(this.urlBase, { params: todos ? { todos: 'true' } : {} });
  }

  obtener(idGrupo: number): Observable<RespuestaGrupo> {
    return this.http.get<RespuestaGrupo>(`${this.urlBase}/${idGrupo}`);
  }

  crear(nombreGrupo: string): Observable<RespuestaGrupo> {
    return this.http.post<RespuestaGrupo>(this.urlBase, { nombreGrupo });
  }

  actualizar(idGrupo: number, cambios: CambiosGrupo): Observable<RespuestaGrupo> {
    return this.http.patch<RespuestaGrupo>(`${this.urlBase}/${idGrupo}`, cambios);
  }

  roles(): Observable<RespuestaRol[]> {
    return this.http.get<RespuestaRol[]>(`${this.urlBase}/roles`);
  }

  integrantes(idGrupo: number): Observable<RespuestaIntegrante[]> {
    return this.http.get<RespuestaIntegrante[]>(`${this.urlBase}/${idGrupo}/integrantes`);
  }

  incorporar(idGrupo: number, datos: DatosIncorporarIntegrante): Observable<RespuestaIntegrante> {
    return this.http.post<RespuestaIntegrante>(`${this.urlBase}/${idGrupo}/integrantes`, datos);
  }

  /** Crea una cuenta nueva y la incorpora al grupo de una vez: la contraseña temporal vuelve una sola vez. */
  crearIntegrante(idGrupo: number, datos: SolicitudCrearIntegrante): Observable<RespuestaIntegranteCreado> {
    return this.http.post<RespuestaIntegranteCreado>(`${this.urlBase}/${idGrupo}/integrantes/nuevo`, datos);
  }

  cambiarRol(idGrupo: number, idIntegrante: number, idRol: number): Observable<RespuestaIntegrante> {
    return this.http.put<RespuestaIntegrante>(
      `${this.urlBase}/${idGrupo}/integrantes/${idIntegrante}/rol`,
      { idRol },
    );
  }

  desactivar(idGrupo: number, idIntegrante: number): Observable<RespuestaIntegrante> {
    return this.http.post<RespuestaIntegrante>(
      `${this.urlBase}/${idGrupo}/integrantes/${idIntegrante}/desactivar`,
      {},
    );
  }

  reactivar(idGrupo: number, idIntegrante: number): Observable<RespuestaIntegrante> {
    return this.http.post<RespuestaIntegrante>(
      `${this.urlBase}/${idGrupo}/integrantes/${idIntegrante}/reactivar`,
      {},
    );
  }

  salir(idGrupo: number): Observable<void> {
    return this.http.post<void>(`${this.urlBase}/${idGrupo}/salir`, {});
  }

  eliminar(idGrupo: number, idIntegrante: number): Observable<void> {
    return this.http.delete<void>(`${this.urlBase}/${idGrupo}/integrantes/${idIntegrante}`);
  }
}
