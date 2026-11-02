import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Ingreso } from './ingreso';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { ServicioRecuperarClave } from '../../nucleo/autenticacion/servicio-recuperar-clave';

function configurar(
  ingresarConCorreo: ReturnType<typeof vi.fn>,
  volver: string | null = null,
  solicitarRecuperarClave: ReturnType<typeof vi.fn> = vi.fn(),
  queryParams: Record<string, string> = {},
) {
  TestBed.configureTestingModule({
    imports: [Ingreso],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap({ ...(volver ? { volver } : {}), ...queryParams }),
          },
        },
      },
      {
        provide: ServicioAutenticacion,
        useValue: {
          habilitado: true,
          usuario: signal(null),
          listo: signal(true),
          ingresarConCorreo,
          ingresarConGoogle: vi.fn(),
        },
      },
      { provide: ServicioRecuperarClave, useValue: { solicitar: solicitarRecuperarClave } },
    ],
  });
}

async function enviarFormulario(correo: string, clave: string) {
  const fixture = TestBed.createComponent(Ingreso);
  await fixture.whenStable();
  const elemento = fixture.nativeElement as HTMLElement;
  const campoCorreo = elemento.querySelector<HTMLInputElement>('input[type="email"]')!;
  const campoClave = elemento.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')!;
  campoCorreo.value = correo;
  campoCorreo.dispatchEvent(new Event('input'));
  campoClave.value = clave;
  campoClave.dispatchEvent(new Event('input'));
  elemento.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
  return fixture;
}

describe('Ingreso', () => {
  it('muestraMensajeConCredencialesInvalidas', async () => {
    configurar(vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' }));

    const fixture = await enviarFormulario('ana@correo.cl', 'clave-mala');

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Correo o contraseña incorrectos.');
  });

  it('redirigeAlVolverTrasIngresar', async () => {
    const ingresar = vi.fn().mockResolvedValue(undefined);
    configurar(ingresar, '/estado');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await enviarFormulario('ana@correo.cl', 'clave-buena');

    expect(ingresar).toHaveBeenCalledWith('ana@correo.cl', 'clave-buena');
    expect(navegar).toHaveBeenCalledWith('/estado');
  });

  it('olvideMuestraMismoMensajeSiempre', async () => {
    const MENSAJE = 'Si el correo tiene una cuenta, te enviamos un enlace.';

    async function recuperarYLeerMensaje(
      solicitar: ReturnType<typeof vi.fn>,
    ): Promise<string | null | undefined> {
      TestBed.resetTestingModule();
      configurar(vi.fn(), null, solicitar);
      const fixture = TestBed.createComponent(Ingreso);
      await fixture.whenStable();
      const elemento = fixture.nativeElement as HTMLElement;
      elemento.querySelector<HTMLButtonElement>('#ingreso-olvide')!.click();
      await fixture.whenStable();
      const campoCorreo = elemento.querySelector<HTMLInputElement>('#recuperar-correo')!;
      campoCorreo.value = 'ana@correo.cl';
      campoCorreo.dispatchEvent(new Event('input'));
      elemento.querySelectorAll('form')[1].dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      return elemento.querySelector('[role="status"]')?.textContent;
    }

    expect(await recuperarYLeerMensaje(vi.fn().mockReturnValue(of(undefined)))).toContain(MENSAJE);
    expect(
      await recuperarYLeerMensaje(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })))),
    ).toContain(MENSAJE);
  });

  it('abreElFormularioDeRecuperarSiVieneRecuperarEnLaUrl', async () => {
    configurar(vi.fn(), null, vi.fn(), { recuperar: '1' });

    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('#ingreso-olvide')).toBeFalsy();
    expect(elemento.querySelector('#recuperar-correo')).toBeTruthy();
  });

  it('olvideMuestraElDetalleSiHayDemasiadosIntentos', async () => {
    const error = new HttpErrorResponse({
      status: 429,
      error: { detail: 'Demasiados intentos. Prueba más tarde.' },
    });
    configurar(vi.fn(), null, vi.fn().mockReturnValue(throwError(() => error)));

    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    elemento.querySelector<HTMLButtonElement>('#ingreso-olvide')!.click();
    await fixture.whenStable();
    elemento.querySelector<HTMLInputElement>('#recuperar-correo')!.value = 'ana@correo.cl';
    elemento
      .querySelector<HTMLInputElement>('#recuperar-correo')!
      .dispatchEvent(new Event('input'));
    elemento.querySelectorAll('form')[1].dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'Demasiados intentos. Prueba más tarde.',
    );
  });

  it('continuarConGoogleMuestraElLogotipoGDecorativoConColoresDeTokens', async () => {
    configurar(vi.fn());
    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    const boton = Array.from(elemento.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuar con Google'),
    )!;
    const logo = boton.querySelector('svg.logo-google')!;
    expect(logo).not.toBeNull();
    expect(logo.getAttribute('aria-hidden')).toBe('true');
    expect(logo.getAttribute('focusable')).toBe('false');
    const partes = Array.from(logo.querySelectorAll('path')).map((path) => path.getAttribute('class'));
    expect(partes.sort()).toEqual([
      'logo-google__amarillo',
      'logo-google__azul',
      'logo-google__rojo',
      'logo-google__verde',
    ]);
    expect(logo.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(boton.textContent?.trim()).toBe('Continuar con Google');
  });

  it('mostrarYOcultarLaContrasenaCambiaElTipoDelCampo', async () => {
    configurar(vi.fn());
    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    const clave = elemento.querySelector<HTMLInputElement>('#ingreso-clave')!;
    const alternar = elemento.querySelector<HTMLButtonElement>('button[aria-controls="ingreso-clave"]')!;
    expect(clave.type).toBe('password');
    expect(alternar.getAttribute('aria-pressed')).toBe('false');

    alternar.click();
    await fixture.whenStable();

    expect(clave.type).toBe('text');
    expect(alternar.getAttribute('aria-pressed')).toBe('true');
    expect(alternar.textContent?.trim()).toBe('Ocultar');
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('Ingreso: desplazamiento y foco', () => {
  let desplazar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar as unknown as Element['scrollIntoView'];
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  /** El `block` con que se desplazó `elemento`, o `undefined` si no se desplazó. */
  function bloqueDe(elemento: Element | null): ScrollLogicalPosition | undefined {
    const i = desplazar.mock.contexts.indexOf(elemento);
    return i < 0 ? undefined : (desplazar.mock.calls[i][0] as ScrollIntoViewOptions).block;
  }

  it('olvideTraeElFormularioALaVistaYEnfocaElCorreo', async () => {
    configurar(vi.fn());
    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    document.body.appendChild(elemento);

    elemento.querySelector<HTMLButtonElement>('#ingreso-olvide')!.click();
    await fixture.whenStable();

    expect(bloqueDe(elemento.querySelector('form.recuperar'))).toBe('start');
    expect(document.activeElement?.id).toBe('recuperar-correo');
  });

  it('llegarConRecuperarNoMueveElFoco', async () => {
    configurar(vi.fn(), null, vi.fn(), { recuperar: '1' });
    const fixture = TestBed.createComponent(Ingreso);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('form.recuperar')).toBeTruthy();
    expect(desplazar).not.toHaveBeenCalled();
  });
});
