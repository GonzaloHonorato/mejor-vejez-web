import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MiPerfil } from './mi-perfil';

const CANALES = {
  canales: [{ canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true, predeterminado: true }],
  whatsappDisponible: false,
};

function flushCanales(http: HttpTestingController): void {
  http
    .expectOne((req) => req.method === 'GET' && req.url.endsWith('/api/yo/canales'))
    .flush(CANALES);
}

async function configurarConFalloDeCarga() {
  TestBed.configureTestingModule({
    imports: [MiPerfil],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(MiPerfil);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http
    .expectOne((req) => req.method === 'GET' && req.url.endsWith('/api/yo'))
    .flush({ title: 'Error', detail: 'No pudimos cargar tu perfil' }, { status: 500, statusText: 'Error' });
  flushCanales(http);
  await fixture.whenStable();
  return { fixture, http, elemento: fixture.nativeElement as HTMLElement };
}

const YO = {
  idUsuario: 1,
  nombre: 'Ana Rojas',
  email: 'ana@correo.cl',
  telefono: '+56911112222',
  esAdministrador: false,
};

async function configurar() {
  TestBed.configureTestingModule({
    imports: [MiPerfil],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(MiPerfil);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne((req) => req.method === 'GET' && req.url.endsWith('/api/yo')).flush(YO);
  flushCanales(http);
  await fixture.whenStable();
  return { fixture, http, elemento: fixture.nativeElement as HTMLElement };
}

function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('MiPerfil', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestraAvisoSiFallaLaCargaDelPerfil', async () => {
    const { elemento } = await configurarConFalloDeCarga();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar tu perfil',
    );
  });

  it('guardaYMuestraConfirmacion', async () => {
    const { fixture, http, elemento } = await configurar();

    expect(elemento.textContent).toContain('ana@correo.cl');
    const nombre = elemento.querySelector<HTMLInputElement>('#perfil-nombre')!;
    const telefono = elemento.querySelector<HTMLInputElement>('#perfil-telefono')!;
    expect(nombre.value).toBe('Ana Rojas');
    expect(telefono.value).toBe('+56911112222');

    escribir(nombre, 'Ana María Rojas');
    escribir(telefono, '');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    const peticion = http.expectOne((req) => req.method === 'PATCH' && req.url.endsWith('/api/yo'));
    expect(peticion.request.body).toEqual({ nombre: 'Ana María Rojas', telefono: null });
    peticion.flush({ ...YO, nombre: 'Ana María Rojas', telefono: null });
    await fixture.whenStable();

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cambios guardados.');
  });

  it('formularioInvalidoAlEnviarMarcaCamposTocadosYMuestraError', async () => {
    const { fixture, elemento } = await configurar();

    escribir(elemento.querySelector<HTMLInputElement>('#perfil-nombre')!, '');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#perfil-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('obligatorio');
    expect(elemento.querySelector('#perfil-nombre')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('muestraErrorDeCampoDeLaApi', async () => {
    const { fixture, http, elemento } = await configurar();

    escribir(elemento.querySelector<HTMLInputElement>('#perfil-nombre')!, 'A');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    http
      .expectOne((req) => req.method === 'PATCH' && req.url.endsWith('/api/yo'))
      .flush(
        {
          title: 'Datos inválidos',
          detail: 'Revisa los datos ingresados',
          errores: [{ campo: 'nombre', mensaje: 'El nombre debe tener al menos 2 caracteres' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    const error = elemento.querySelector('#perfil-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('El nombre debe tener al menos 2 caracteres');
    expect(elemento.querySelector('#perfil-nombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(elemento.querySelector('[role="status"]')?.textContent ?? '').not.toContain(
      'Cambios guardados.',
    );
  });
});
