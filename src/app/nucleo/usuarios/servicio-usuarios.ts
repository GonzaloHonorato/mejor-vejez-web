import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import {
  RespuestaAccesoReenviado,
  RespuestaCuentaCreada,
  RespuestaPagina,
  RespuestaUsuario,
  SolicitudCrearUsuario,
} from './modelos-usuarios';

/** Filtros aceptados por `GET /api/usuarios`. */
export interface FiltroUsuarios {
  texto?: string;
  pagina?: number;
  tamano?: number;
}

/** Cambios aceptados por `PATCH /api/usuarios/{idUsuario}`. */
export interface CambiosUsuario {
  nombre: string;
  telefono: string | null;
  esAdministrador: boolean;
}

/** Acceso a los endpoints de administración global de cuentas (`/api/usuarios`). */
@Injectable({ providedIn: 'root' })
export class ServicioUsuarios {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/usuarios`;

  /** Crea una cuenta nueva (Firebase + `USUARIO`): la contraseña temporal vuelve una sola vez. */
  crear(datos: SolicitudCrearUsuario): Observable<RespuestaCuentaCreada> {
    return this.http.post<RespuestaCuentaCreada>(this.urlBase, datos);
  }

  /** Fija una contraseña temporal nueva y pide a Alertas que la reenvíe por correo. */
  reenviarAcceso(idUsuario: number): Observable<RespuestaAccesoReenviado> {
    return this.http.post<RespuestaAccesoReenviado>(`${this.urlBase}/${idUsuario}/reenviar-acceso`, {});
  }

  listar(filtro: FiltroUsuarios = {}): Observable<RespuestaPagina<RespuestaUsuario>> {
    const parametros: Record<string, string> = {};
    if (filtro.texto) {
      parametros['texto'] = filtro.texto;
    }
    if (filtro.pagina !== undefined) {
      parametros['pagina'] = String(filtro.pagina);
    }
    if (filtro.tamano !== undefined) {
      parametros['tamano'] = String(filtro.tamano);
    }
    return this.http.get<RespuestaPagina<RespuestaUsuario>>(this.urlBase, { params: parametros });
  }

  obtener(idUsuario: number): Observable<RespuestaUsuario> {
    return this.http.get<RespuestaUsuario>(`${this.urlBase}/${idUsuario}`);
  }

  actualizar(idUsuario: number, cambios: CambiosUsuario): Observable<RespuestaUsuario> {
    return this.http.patch<RespuestaUsuario>(`${this.urlBase}/${idUsuario}`, cambios);
  }

  cambiarEstado(idUsuario: number, idEstado: number): Observable<RespuestaUsuario> {
    return this.http.put<RespuestaUsuario>(`${this.urlBase}/${idUsuario}/estado`, { idEstado });
  }
}
