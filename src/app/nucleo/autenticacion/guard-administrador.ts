import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ServicioYo } from '../usuarios/servicio-yo';

/**
 * Deja pasar sólo a quienes son administradores según `GET /api/yo`. Si no
 * lo son, o si la consulta falla, manda a `/`.
 */
export const guardAdministrador: CanActivateFn = () => {
  const servicioYo = inject(ServicioYo);
  const router = inject(Router);

  return servicioYo.obtener().pipe(
    map((yo) => (yo.esAdministrador ? true : router.createUrlTree(['/']))),
    catchError(() => of(router.createUrlTree(['/']))),
  );
};
