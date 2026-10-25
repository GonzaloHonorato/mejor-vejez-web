import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { guardAutenticado } from './guard-autenticado';
import { ServicioAutenticacion } from './servicio-autenticacion';

function configurar(usuario: unknown) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ServicioAutenticacion,
        useValue: { habilitado: true, usuario: signal(usuario), listo: signal(true) },
      },
    ],
  });
}

function ejecutarGuard(url: string) {
  return TestBed.runInInjectionContext(() =>
    guardAutenticado({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('guardAutenticado', () => {
  it('redirigeAIngresoSinSesion', () => {
    configurar(null);

    const resultado = ejecutarGuard('/');

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/ingreso?volver=%2F');
  });

  it('permiteConSesion', () => {
    configurar({ uid: 'abc' });

    expect(ejecutarGuard('/')).toBe(true);
  });
});
