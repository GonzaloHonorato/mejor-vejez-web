import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { runtimeConfig } from '../config/runtime-config';
import { AuthService } from './auth.service';

/** Adjunta el ID token de Firebase sólo a las llamadas a NUESTRA API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!runtimeConfig.apiUrl || !req.url.startsWith(runtimeConfig.apiUrl)) {
    return next(req);
  }
  const auth = inject(AuthService);
  return from(auth.idToken()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
