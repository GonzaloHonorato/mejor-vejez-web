import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { guardAdministrador } from './guard-administrador';
import { ServicioYo } from '../usuarios/servicio-yo';

function configurar(esAdministrador: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({
              idUsuario: 1,
              nombre: 'Ana',
              email: 'ana@correo.cl',
              telefono: null,
              esAdministrador,
            }),
        },
      },
    ],
  });
}

function configurarConFalla() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ServicioYo, useValue: { obtener: () => throwError(() => new Error('falló')) } },
    ],
  });
}

function ejecutarGuard() {
  return TestBed.runInInjectionContext(() =>
    guardAdministrador({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Observable<boolean | UrlTree>;
}

describe('guardAdministrador', () => {
  it('redirigeSiNoEsAdministrador', async () => {
    configurar(false);

    const resultado = await firstValueFrom(ejecutarGuard());

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/');
  });

  it('permiteAlAdministrador', async () => {
    configurar(true);

    const resultado = await firstValueFrom(ejecutarGuard());

    expect(resultado).toBe(true);
  });

  it('redirigeSiFallaLaConsultaDelUsuario', async () => {
    configurarConFalla();

    const resultado = await firstValueFrom(ejecutarGuard());

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/');
  });
});
