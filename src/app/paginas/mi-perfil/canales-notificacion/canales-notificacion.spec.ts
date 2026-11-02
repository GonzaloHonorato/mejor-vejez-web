import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { CanalesNotificacion } from './canales-notificacion';
import { RespuestaCanales, ServicioCanales } from '../../../nucleo/usuarios/servicio-canales';

function respuesta(opciones: Partial<RespuestaCanales> = {}): RespuestaCanales {
  return {
    canales: [
      { canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true, predeterminado: true },
    ],
    whatsappDisponible: false,
    ...opciones,
  };
}

async function configurar(respuestaInicial: RespuestaCanales = respuesta()) {
  const servicioCanales = {
    obtener: vi.fn(() => of(respuestaInicial)),
    actualizar: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [CanalesNotificacion],
    providers: [{ provide: ServicioCanales, useValue: servicioCanales }],
  });
  const fixture = TestBed.createComponent(CanalesNotificacion);
  await fixture.whenStable();
  return { fixture, servicioCanales, elemento: fixture.nativeElement as HTMLElement };
}

function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('CanalesNotificacion', () => {
  it('cargaCorreoPredeterminado', async () => {
    const { elemento } = await configurar();

    const correo = elemento.querySelector<HTMLInputElement>('#canales-correo')!;
    expect(correo.value).toBe('ana@correo.cl');
    const habilitado = elemento.querySelector<HTMLInputElement>('#canales-correo-habilitado')!;
    expect(habilitado.checked).toBe(true);
  });

  it('guardaConjuntoCompleto', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();
    servicioCanales.actualizar.mockReturnValue(
      of(
        respuesta({
          canales: [
            { canal: 'CORREO', destino: 'otra@correo.cl', habilitado: true, predeterminado: false },
            { canal: 'WHATSAPP', destino: '+56912345678', habilitado: true, predeterminado: false },
          ],
        }),
      ),
    );

    escribir(elemento.querySelector('#canales-correo')!, 'otra@correo.cl');
    escribir(elemento.querySelector('#canales-whatsapp')!, '+56912345678');
    elemento.querySelector<HTMLInputElement>('#canales-whatsapp-habilitado')!.click();
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioCanales.actualizar).toHaveBeenCalledWith([
      { canal: 'CORREO', destino: 'otra@correo.cl', habilitado: true },
      { canal: 'WHATSAPP', destino: '+56912345678', habilitado: true },
    ]);
    expect(elemento.querySelector('.confirmacion')?.textContent).toContain('Cambios guardados.');
  });

  it('whatsappNoChilenoMuestraLaReglaYNoGuarda', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();
    const campo = elemento.querySelector<HTMLInputElement>('#canales-whatsapp')!;

    escribir(campo, '+5491123456789');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#canales-whatsapp-error');
    expect(error?.classList).toContain('mv-campo__error');
    expect(error?.textContent).toContain('Ingresa un teléfono chileno: +56 y 9 dígitos.');
    expect(campo.getAttribute('aria-describedby')).toBe(
      'canales-whatsapp-ayuda canales-whatsapp-error',
    );
    expect(campo.getAttribute('inputmode')).toBe('tel');
    expect(document.activeElement).toBe(campo);
    expect(servicioCanales.actualizar).not.toHaveBeenCalled();
  });

  it('whatsappAntiguoSinCambiosSeEnviaTalCual', async () => {
    const { fixture, elemento, servicioCanales } = await configurar(
      respuesta({
        canales: [
          { canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true, predeterminado: true },
          {
            canal: 'WHATSAPP',
            destino: '+5491123456789',
            habilitado: false,
            predeterminado: false,
          },
        ],
      }),
    );
    servicioCanales.actualizar.mockReturnValue(of(respuesta()));

    escribir(elemento.querySelector('#canales-correo')!, 'otra@correo.cl');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#canales-whatsapp-error')).toBeFalsy();
    expect(servicioCanales.actualizar).toHaveBeenCalledWith([
      { canal: 'CORREO', destino: 'otra@correo.cl', habilitado: true },
      { canal: 'WHATSAPP', destino: '+5491123456789', habilitado: false },
    ]);
  });

  it('whatsappSeEnviaNormalizadoYSeMuestraFormateado', async () => {
    const { fixture, elemento, servicioCanales } = await configurar(
      respuesta({
        canales: [
          { canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true, predeterminado: true },
          { canal: 'WHATSAPP', destino: '+56912345678', habilitado: false, predeterminado: false },
        ],
      }),
    );
    servicioCanales.actualizar.mockReturnValue(of(respuesta()));
    const campo = elemento.querySelector<HTMLInputElement>('#canales-whatsapp')!;
    expect(campo.value).toBe('+56 9 1234 5678');

    escribir(campo, '9 8765 4321');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioCanales.actualizar).toHaveBeenCalledWith([
      { canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true },
      { canal: 'WHATSAPP', destino: '+56987654321', habilitado: false },
    ]);
  });

  it('whatsappVacioNoSeEnvia', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();
    servicioCanales.actualizar.mockReturnValue(of(respuesta()));

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioCanales.actualizar).toHaveBeenCalledWith([
      { canal: 'CORREO', destino: 'ana@correo.cl', habilitado: true },
    ]);
  });

  it('avisoWhatsappNoDisponible', async () => {
    const { elemento } = await configurar(respuesta({ whatsappDisponible: false }));

    const aviso = elemento.querySelector('.mv-aviso--info');
    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.textContent).toContain(
      'WhatsApp aún no envía mensajes: por ahora las alertas llegan por correo.',
    );
  });

  it('correoInvalidoMuestraMensajeYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();

    const correo = elemento.querySelector<HTMLInputElement>('#canales-correo')!;
    escribir(correo, 'juan@');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const mensaje = elemento.querySelector('[role="alert"]');
    expect(mensaje?.textContent).toContain('El correo de notificación no es válido.');
    expect(correo.getAttribute('aria-invalid')).toBe('true');
    expect(correo.getAttribute('aria-describedby')).toBe('canales-correo-error');
    expect(servicioCanales.actualizar).not.toHaveBeenCalled();
  });

  it('correoVacioMuestraMensajeRequeridoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();

    escribir(elemento.querySelector('#canales-correo')!, '');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Ingresa tu correo de notificación.',
    );
    expect(servicioCanales.actualizar).not.toHaveBeenCalled();
  });

  it('losDosInterruptoresTienenNombresAccesiblesDistintos', async () => {
    const { elemento } = await configurar();

    const correoHabilitado = elemento.querySelector('#canales-correo-habilitado')!;
    const whatsappHabilitado = elemento.querySelector('#canales-whatsapp-habilitado')!;

    expect(correoHabilitado.getAttribute('aria-label')).toBe('Correo habilitado');
    expect(whatsappHabilitado.getAttribute('aria-label')).toBe('WhatsApp habilitado');
  });

  it('cargaFallidaOcultaElFormularioYReintentarVuelveAPedir', async () => {
    const servicioCanales = {
      obtener: vi
        .fn()
        .mockReturnValueOnce(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 500,
                error: { detail: 'No pudimos cargar tus canales de notificación.' },
              }),
          ),
        )
        .mockReturnValueOnce(of(respuesta())),
      actualizar: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [CanalesNotificacion],
      providers: [{ provide: ServicioCanales, useValue: servicioCanales }],
    });
    const fixture = TestBed.createComponent(CanalesNotificacion);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('form')).toBeNull();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar tus canales de notificación.',
    );
    const boton = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reintentar',
    )!;
    expect(boton).toBeTruthy();

    boton.click();
    await fixture.whenStable();

    expect(servicioCanales.obtener).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('form')).toBeTruthy();
    expect(elemento.querySelector<HTMLInputElement>('#canales-correo')!.value).toBe(
      'ana@correo.cl',
    );
  });

  it('errorDeLaApiSeMuestra', async () => {
    const { fixture, elemento, servicioCanales } = await configurar();
    servicioCanales.actualizar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'El correo de notificación no es válido.' },
          }),
      ),
    );

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'El correo de notificación no es válido.',
    );
  });

  it('mientrasCargaMuestraEstadoDeCargaDentroDeLaTarjeta', async () => {
    const sujeto = new Subject<RespuestaCanales>();
    TestBed.configureTestingModule({
      imports: [CanalesNotificacion],
      providers: [
        {
          provide: ServicioCanales,
          useValue: { obtener: () => sujeto.asObservable(), actualizar: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(CanalesNotificacion);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    const estado = elemento.querySelector('.mv-tarjeta [role="status"]');
    expect(estado?.textContent).toContain('Cargando tus canales');
    expect(elemento.querySelector('form')).toBeNull();

    sujeto.next(respuesta());
    sujeto.complete();
    await fixture.whenStable();
    expect(elemento.textContent).not.toContain('Cargando tus canales');
    expect(elemento.querySelector('form')).toBeTruthy();
  });
});
