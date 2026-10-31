import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { ServicioAutenticacion } from './servicio-autenticacion';

/**
 * true si `url` apunta exactamente al mismo origen (esquema + host + puerto)
 * que la API. Comparar con `startsWith` dejaría pasar `https://api.x.cl.otro.com`.
 */
function esOrigenDeLaApi(url: string): boolean {
  const urlApi = configuracionEjecucion.urlApi;
  if (!urlApi) {
    return false;
  }
  try {
    return new URL(url, location.href).origin === new URL(urlApi).origin;
  } catch {
    return false;
  }
}

/** true si la ruta es pública (`/api/publico/**`): nunca lleva Bearer, ni vencido ni vigente. */
function esRutaPublica(url: string): boolean {
  try {
    return new URL(url, location.href).pathname.includes('/api/publico/');
  } catch {
    return false;
  }
}

/** Adjunta el ID token de Firebase sólo a las llamadas al origen de NUESTRA API, salvo `/api/publico/**`. */
export const interceptorAutenticacion: HttpInterceptorFn = (req, next) => {
  if (!esOrigenDeLaApi(req.url) || esRutaPublica(req.url)) {
    return next(req);
  }
  const auth = inject(ServicioAutenticacion);
  return from(auth.tokenId()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
