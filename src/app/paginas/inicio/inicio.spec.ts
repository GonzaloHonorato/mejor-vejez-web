import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { Inicio } from './inicio';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

function configurar(cerrarSesion = vi.fn().mockResolvedValue(undefined)) {
  TestBed.configureTestingModule({
    imports: [Inicio],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ServicioAutenticacion,
        useValue: { habilitado: true, usuario: signal(null), listo: signal(true), cerrarSesion },
      },
    ],
  });
  const fixture = TestBed.createComponent(Inicio);
  fixture.detectChanges();
  const peticionYo = TestBed.inject(HttpTestingController).expectOne(
    (req) => req.method === 'GET' && req.url.endsWith('/api/yo'),
  );
  return { fixture, peticionYo, cerrarSesion };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('Inicio', () => {
  it('saludaConElNombreDeYo', async () => {
    const { fixture, peticionYo } = configurar();

    peticionYo.flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hola, Ana');
  });

  it('muestraDetalleDeLaApiYOfreceCerrarSesionAnte409', async () => {
    const { fixture, peticionYo, cerrarSesion } = configurar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    peticionYo.flush(
      { title: 'Conflicto', detail: 'El correo ya está asociado a otra cuenta' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'El correo ya está asociado a otra cuenta',
    );
    expect(botonConTexto(elemento, 'Reintentar')).toBeUndefined();
    const botonCerrar = botonConTexto(elemento, 'Cerrar sesión');
    expect(botonCerrar).toBeDefined();

    botonCerrar!.click();
    await fixture.whenStable();

    expect(cerrarSesion).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/ingreso');
  });

  it('ofreceReintentarAnteErrorDeRed', async () => {
    const { fixture, peticionYo } = configurar();

    peticionYo.error(new ProgressEvent('error'));
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tus datos.');
    expect(botonConTexto(elemento, 'Cerrar sesión')).toBeUndefined();
    const botonReintentar = botonConTexto(elemento, 'Reintentar');
    expect(botonReintentar).toBeDefined();

    botonReintentar!.click();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/yo'))
      .flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Hola, Ana');
  });
});
