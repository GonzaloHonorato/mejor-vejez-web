import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { RestablecerClave } from './restablecer-clave';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

function configurar(
  snapshot: { fragment?: string | null; codigo?: string | null },
  auth: Record<string, unknown> = {},
) {
  TestBed.configureTestingModule({
    imports: [RestablecerClave],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            fragment: snapshot.fragment ?? null,
            queryParamMap: convertToParamMap(snapshot.codigo ? { codigo: snapshot.codigo } : {}),
          },
        },
      },
      {
        provide: ServicioAutenticacion,
        useValue: {
          verificarCodigoRecuperarClave: vi.fn().mockResolvedValue('ana@correo.cl'),
          confirmarRecuperarClave: vi.fn().mockResolvedValue(undefined),
          ...auth,
        },
      },
    ],
  });
}

async function crear() {
  const fixture = TestBed.createComponent(RestablecerClave);
  await fixture.whenStable();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

async function escribirYEnviar(elemento: HTMLElement, clave: string, confirmacion: string) {
  const campoClave = elemento.querySelector<HTMLInputElement>('#restablecer-clave')!;
  const campoConfirmacion = elemento.querySelector<HTMLInputElement>('#restablecer-confirmacion')!;
  campoClave.value = clave;
  campoClave.dispatchEvent(new Event('input'));
  campoConfirmacion.value = confirmacion;
  campoConfirmacion.dispatchEvent(new Event('input'));
  elemento.querySelector('form')!.dispatchEvent(new Event('submit'));
}

describe('RestablecerClave', () => {
  it('restablecerSinCodigoMuestraError', async () => {
    configurar({});

    const { elemento } = await crear();

    const alerta = elemento.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Este enlace no es válido.');
  });

  it('restablecerCodigoVencidoMuestraPedirOtro', async () => {
    configurar(
      { codigo: 'codigo-123' },
      {
        verificarCodigoRecuperarClave: vi
          .fn()
          .mockRejectedValue({ code: 'auth/expired-action-code' }),
      },
    );

    const { elemento } = await crear();

    const alerta = elemento.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Este enlace ya venció.');
    const enlace = elemento.querySelector('a');
    expect(enlace?.textContent).toContain('Pedir otro enlace');
    expect(enlace?.getAttribute('href')).toBe('/ingreso?recuperar=1');
  });

  it('restablecerLeeElCodigoDelFragmento', async () => {
    const verificarCodigoRecuperarClave = vi.fn().mockResolvedValue('ana@correo.cl');
    configurar({ fragment: 'codigo=del-fragmento' }, { verificarCodigoRecuperarClave });

    await crear();

    expect(verificarCodigoRecuperarClave).toHaveBeenCalledWith('del-fragmento');
  });

  it('restablecerUsaElQueryParamSiNoHayFragmento', async () => {
    const verificarCodigoRecuperarClave = vi.fn().mockResolvedValue('ana@correo.cl');
    configurar({ codigo: 'de-la-query' }, { verificarCodigoRecuperarClave });

    await crear();

    expect(verificarCodigoRecuperarClave).toHaveBeenCalledWith('de-la-query');
  });

  it('restablecerLimpiaLaUrlApenasLeeElCodigo', async () => {
    configurar({ fragment: 'codigo=del-fragmento' });
    const reemplazarHistoria = vi.spyOn(history, 'replaceState');

    await crear();

    expect(reemplazarHistoria).toHaveBeenCalledWith(null, '', '/restablecer-clave');
  });

  it('restablecerClavesDistintasNoEnvia', async () => {
    const confirmarRecuperarClave = vi.fn().mockResolvedValue(undefined);
    configurar({ codigo: 'codigo-123' }, { confirmarRecuperarClave });

    const { fixture, elemento } = await crear();
    await escribirYEnviar(elemento, 'clave-nueva1', 'clave-nueva2');
    await fixture.whenStable();

    expect(confirmarRecuperarClave).not.toHaveBeenCalled();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Las contraseñas no coinciden.',
    );
  });

  it('restablecerExitoLlevaAIngreso', async () => {
    const confirmarRecuperarClave = vi.fn().mockResolvedValue(undefined);
    configurar({ codigo: 'codigo-123' }, { confirmarRecuperarClave });

    const { fixture, elemento } = await crear();
    await escribirYEnviar(elemento, 'clave-nueva1', 'clave-nueva1');
    await fixture.whenStable();

    expect(confirmarRecuperarClave).toHaveBeenCalledWith('codigo-123', 'clave-nueva1');
    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'Tu contraseña se actualizó correctamente.',
    );
    const enlace = elemento.querySelector('a');
    expect(enlace?.textContent).toContain('Ir a iniciar sesión');
    expect(enlace?.getAttribute('href')).toBe('/ingreso');
  });

  it('restablecerUsaCamposMvYElBotonPrincipalAlAnchoCompleto', async () => {
    configurar({ codigo: 'codigo-123' });

    const { elemento } = await crear();

    for (const id of ['restablecer-clave', 'restablecer-confirmacion']) {
      const control = elemento.querySelector(`#${id}`)!;
      expect(control.classList.contains('mv-campo__control')).toBe(true);
      expect(control.closest('.mv-campo')?.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    const boton = elemento.querySelector('button[type="submit"]')!;
    expect(boton.classList.contains('mv-boton--primario')).toBe(true);
    expect(boton.classList.contains('mv-boton--bloque')).toBe(true);
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('RestablecerClave: desplazamiento y foco', () => {
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

  async function listo() {
    configurar({ codigo: 'codigo-123' });
    const creado = await crear();
    document.body.appendChild(creado.elemento);
    return creado;
  }

  it('enviarVacioMarcaYEnlazaAmbosCamposYEnfocaElPrimero', async () => {
    const { fixture, elemento } = await listo();

    await escribirYEnviar(elemento, '', '');
    await fixture.whenStable();

    const clave = elemento.querySelector('#restablecer-clave')!;
    const confirmacion = elemento.querySelector('#restablecer-confirmacion')!;
    expect(document.activeElement).toBe(clave);
    expect(bloqueDe(clave)).toBe('center');
    expect(clave.getAttribute('aria-invalid')).toBe('true');
    expect(clave.getAttribute('aria-describedby')).toBe('restablecer-clave-error');
    expect(elemento.querySelector('#restablecer-clave-error')?.textContent).toContain(
      'Ingresa la contraseña nueva',
    );
    expect(confirmacion.getAttribute('aria-invalid')).toBe('true');
    expect(confirmacion.getAttribute('aria-describedby')).toBe('restablecer-confirmacion-error');
    expect(elemento.querySelector('#restablecer-confirmacion-error')).toBeTruthy();
  });

  it('claveCortaMarcaLaClaveConSuMensaje', async () => {
    const { fixture, elemento } = await listo();

    await escribirYEnviar(elemento, 'abc', 'abc');
    await fixture.whenStable();

    const clave = elemento.querySelector('#restablecer-clave')!;
    expect(document.activeElement).toBe(clave);
    expect(clave.getAttribute('aria-invalid')).toBe('true');
    expect(elemento.querySelector('#restablecer-clave-error')?.textContent).toContain('al menos 8');
    expect(elemento.querySelector('#restablecer-confirmacion')!.getAttribute('aria-invalid')).toBeNull();
  });

  it('clavesDistintasMarcanYEnfocanLaConfirmacion', async () => {
    const { fixture, elemento } = await listo();

    await escribirYEnviar(elemento, 'clave-nueva1', 'clave-nueva2');
    await fixture.whenStable();

    const confirmacion = elemento.querySelector('#restablecer-confirmacion')!;
    expect(document.activeElement).toBe(confirmacion);
    expect(confirmacion.getAttribute('aria-invalid')).toBe('true');
    expect(confirmacion.getAttribute('aria-describedby')).toBe('restablecer-error');
    expect(elemento.querySelector('#restablecer-error')?.textContent).toContain('no coinciden');
  });
});
