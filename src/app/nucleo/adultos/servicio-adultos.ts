import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { RespuestaAdultoMayor, RespuestaContacto } from './modelos-adultos';

/** Datos para `POST`/`PUT` de `/api/grupos/{idGrupo}/adultos`. */
export interface SolicitudGuardarAdultoMayor {
  codigoInterno: string | null;
  nombreCompleto: string;
  fechaNacimiento: string | null;
  notasEmergencia: string | null;
  observacionesGenerales: string | null;
}

/** Datos para `POST /api/grupos/{idGrupo}/adultos/{idAdulto}/contactos`. */
export interface SolicitudCrearContacto {
  nombreContacto: string;
  parentesco: string | null;
  telefono: string;
  esPrincipal: boolean | null;
}

/** Datos para `PUT /api/grupos/{idGrupo}/adultos/{idAdulto}/contactos/{idContacto}`. */
export interface SolicitudActualizarContacto {
  nombreContacto: string;
  parentesco: string | null;
  telefono: string;
}

/** Acceso a los endpoints de perfiles de adultos mayores y sus contactos de emergencia. */
@Injectable({ providedIn: 'root' })
export class ServicioAdultos {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/grupos`;

  listar(idGrupo: number, incluirInactivos = false): Observable<RespuestaAdultoMayor[]> {
    return this.http.get<RespuestaAdultoMayor[]>(`${this.urlBase}/${idGrupo}/adultos`, {
      params: incluirInactivos ? { incluirInactivos: 'true' } : {},
    });
  }

  obtener(idGrupo: number, idAdulto: number): Observable<RespuestaAdultoMayor> {
    return this.http.get<RespuestaAdultoMayor>(`${this.urlBase}/${idGrupo}/adultos/${idAdulto}`);
  }

  crear(idGrupo: number, solicitud: SolicitudGuardarAdultoMayor): Observable<RespuestaAdultoMayor> {
    return this.http.post<RespuestaAdultoMayor>(`${this.urlBase}/${idGrupo}/adultos`, solicitud);
  }

  actualizar(
    idGrupo: number,
    idAdulto: number,
    solicitud: SolicitudGuardarAdultoMayor,
  ): Observable<RespuestaAdultoMayor> {
    return this.http.put<RespuestaAdultoMayor>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}`,
      solicitud,
    );
  }

  desactivar(idGrupo: number, idAdulto: number): Observable<RespuestaAdultoMayor> {
    return this.http.post<RespuestaAdultoMayor>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/desactivar`,
      {},
    );
  }

  reactivar(idGrupo: number, idAdulto: number): Observable<RespuestaAdultoMayor> {
    return this.http.post<RespuestaAdultoMayor>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/reactivar`,
      {},
    );
  }

  eliminar(idGrupo: number, idAdulto: number): Observable<void> {
    return this.http.delete<void>(`${this.urlBase}/${idGrupo}/adultos/${idAdulto}`);
  }

  contactos(idGrupo: number, idAdulto: number): Observable<RespuestaContacto[]> {
    return this.http.get<RespuestaContacto[]>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos`,
    );
  }

  crearContacto(
    idGrupo: number,
    idAdulto: number,
    solicitud: SolicitudCrearContacto,
  ): Observable<RespuestaContacto> {
    return this.http.post<RespuestaContacto>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos`,
      solicitud,
    );
  }

  actualizarContacto(
    idGrupo: number,
    idAdulto: number,
    idContacto: number,
    solicitud: SolicitudActualizarContacto,
  ): Observable<RespuestaContacto> {
    return this.http.put<RespuestaContacto>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos/${idContacto}`,
      solicitud,
    );
  }

  designarPrincipal(
    idGrupo: number,
    idAdulto: number,
    idContacto: number,
  ): Observable<RespuestaContacto> {
    return this.http.post<RespuestaContacto>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos/${idContacto}/principal`,
      {},
    );
  }

  desactivarContacto(
    idGrupo: number,
    idAdulto: number,
    idContacto: number,
    idNuevoPrincipal?: number,
  ): Observable<RespuestaContacto> {
    return this.http.post<RespuestaContacto>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos/${idContacto}/desactivar`,
      idNuevoPrincipal === undefined ? {} : { idNuevoPrincipal },
    );
  }

  reactivarContacto(
    idGrupo: number,
    idAdulto: number,
    idContacto: number,
  ): Observable<RespuestaContacto> {
    return this.http.post<RespuestaContacto>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos/${idContacto}/reactivar`,
      {},
    );
  }

  eliminarContacto(idGrupo: number, idAdulto: number, idContacto: number): Observable<void> {
    return this.http.delete<void>(
      `${this.urlBase}/${idGrupo}/adultos/${idAdulto}/contactos/${idContacto}`,
    );
  }
}
