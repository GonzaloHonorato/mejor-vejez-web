import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { ServicioAutenticacion } from './servicio-autenticacion';

/**
 * Deja pasar sólo con sesión. Espera a que Firebase resuelva la sesión
 * guardada (`listo`) y, si no hay usuario, manda a `/ingreso?volver=<url>`.
 */
export const guardAutenticado: CanActivateFn = (_ruta, estado) => {
  const auth = inject(ServicioAutenticacion);
  const router = inject(Router);

  const decidir = () =>
    auth.usuario() ? true : router.createUrlTree(['/ingreso'], { queryParams: { volver: estado.url } });

  if (auth.listo()) {
    return decidir();
  }
  return toObservable(auth.listo).pipe(filter(Boolean), take(1), map(decidir));
};
