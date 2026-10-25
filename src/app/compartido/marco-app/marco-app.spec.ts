import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';

import { MarcoApp } from './marco-app';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

async function pulsarCerrarSesion(cerrarSesion: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [MarcoApp],
    providers: [
      provideRouter([]),
      {
        provide: ServicioAutenticacion,
        useValue: { habilitado: true, usuario: signal(null), listo: signal(true), cerrarSesion },
      },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(MarcoApp);
  await fixture.whenStable();
  const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
    (b) => b.textContent?.includes('Cerrar sesión'),
  )!;
  boton.click();
  await fixture.whenStable();
  return navegar;
}

describe('MarcoApp', () => {
  afterEach(() => vi.restoreAllMocks());

  it('navegaAIngresoTrasCerrarSesion', async () => {
    const navegar = await pulsarCerrarSesion(vi.fn().mockResolvedValue(undefined));

    expect(navegar).toHaveBeenCalledWith('/ingreso');
  });

  it('registraElErrorYNoNavegaSiCerrarSesionFalla', async () => {
    const registrarError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const navegar = await pulsarCerrarSesion(vi.fn().mockRejectedValue(new Error('sin red')));

    expect(registrarError).toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });
});
