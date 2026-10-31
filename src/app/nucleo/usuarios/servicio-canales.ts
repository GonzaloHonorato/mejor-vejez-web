import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

/** Canales de notificación soportados: CORREO siempre, WHATSAPP solo si tiene fila. */
export type CanalNotificacion = 'CORREO' | 'WHATSAPP';

/** Un canal operativo de `GET /api/yo/canales`. */
export interface RespuestaCanal {
  canal: CanalNotificacion;
  destino: string;
  habilitado: boolean;
  /** `true` cuando el valor sale de la cuenta (`USUARIO.EMAIL`) y no de una fila propia. */
  predeterminado: boolean;
}

/** Contrato de `GET /api/yo/canales`. */
export interface RespuestaCanales {
  canales: RespuestaCanal[];
  whatsappDisponible: boolean;
}

/** Un canal a guardar con `PUT /api/yo/canales`. */
export interface SolicitudCanal {
  canal: CanalNotificacion;
  destino: string;
  habilitado: boolean;
}

/** Cuerpo de `PUT /api/yo/canales`: reemplaza el conjunto completo de canales del usuario. */
export interface SolicitudActualizarCanales {
  canales: SolicitudCanal[];
}

/** Acceso a los canales de notificación del usuario autenticado (`/api/yo/canales`). */
@Injectable({ providedIn: 'root' })
export class ServicioCanales {
  private readonly http = inject(HttpClient);
  private readonly urlBase = `${configuracionEjecucion.urlApi}/api/yo/canales`;

  obtener(): Observable<RespuestaCanales> {
    return this.http.get<RespuestaCanales>(this.urlBase);
  }

  actualizar(canales: SolicitudCanal[]): Observable<RespuestaCanales> {
    const solicitud: SolicitudActualizarCanales = { canales };
    return this.http.put<RespuestaCanales>(this.urlBase, solicitud);
  }
}
