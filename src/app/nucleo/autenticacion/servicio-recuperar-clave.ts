import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';

/**
 * Pide el enlace de restablecimiento (`POST /api/publico/recuperar-clave`,
 * ruta pública: ver `interceptor-autenticacion`). Responde 202 sin cuerpo
 * siempre, exista o no la cuenta con ese correo.
 */
@Injectable({ providedIn: 'root' })
export class ServicioRecuperarClave {
  private readonly http = inject(HttpClient);

  solicitar(email: string): Observable<void> {
    return this.http.post<void>(`${configuracionEjecucion.urlApi}/api/publico/recuperar-clave`, {
      email,
    });
  }
}
