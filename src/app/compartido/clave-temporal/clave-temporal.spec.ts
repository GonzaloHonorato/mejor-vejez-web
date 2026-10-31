import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ClaveTemporal } from './clave-temporal';

@Component({
  imports: [ClaveTemporal],
  template: `
    <app-clave-temporal
      [clave]="clave()"
      [correoEnviado]="correoEnviado()"
      (cerrar)="cierres = cierres + 1"
    />
  `,
})
class Anfitrion {
  readonly clave = signal('Ab3xZ9qLm2Pq');
  readonly correoEnviado = signal(true);
  cierres = 0;
}

async function montar(correoEnviado = true) {
  TestBed.configureTestingModule({ imports: [Anfitrion] });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.componentInstance.correoEnviado.set(correoEnviado);
  // Adjunto al documento: el foco y la trampa de Tab necesitan elementos conectados.
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const elemento = fixture.nativeElement as HTMLElement;
  const dialogo = elemento.querySelector<HTMLElement>('[role="dialog"]')!;
  return { fixture, elemento, dialogo, anfitrion: fixture.componentInstance };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.trim().includes(texto),
  );
}

describe('ClaveTemporal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('esDialogoModalYMuestraLaClaveConElAvisoDeQueNoSeVuelveAMostrar', async () => {
    const { dialogo } = await montar();

    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.textContent).toContain('Ab3xZ9qLm2Pq');
    expect(dialogo.textContent).toContain('Esta contraseña no se volverá a mostrar');
  });

  it('copiarClaveUsaPortapapeles', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escribir } });
    const { elemento, fixture } = await montar();

    botonConTexto(elemento, 'Copiar')!.click();
    await fixture.whenStable();

    expect(escribir).toHaveBeenCalledWith('Ab3xZ9qLm2Pq');
    expect(botonConTexto(elemento, 'Copiada')).toBeTruthy();
  });

  it('copiarConFallaMuestraMensaje', async () => {
    const escribir = vi.fn().mockRejectedValue(new Error('denegado'));
    Object.assign(navigator, { clipboard: { writeText: escribir } });
    const { elemento, fixture } = await montar();

    botonConTexto(elemento, 'Copiar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'No se pudo copiar; selecciónala y cópiala a mano.',
    );
  });

  it('sinPortapapelesMuestraMensajeAlIntentarCopiar', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const { elemento, fixture } = await montar();

    botonConTexto(elemento, 'Copiar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'No se pudo copiar; selecciónala y cópiala a mano.',
    );
  });

  it('correoNoEnviadoMuestraAviso', async () => {
    const { elemento } = await montar(false);

    const aviso = elemento.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('No pudimos enviar el correo');
  });

  it('correoEnviadoNoMuestraAviso', async () => {
    const { elemento } = await montar(true);

    expect(elemento.querySelector('[role="alert"]')).toBeFalsy();
  });

  it('cerrarEmiteCerrar', async () => {
    const { elemento, anfitrion } = await montar();

    botonConTexto(elemento, 'Cerrar')!.click();

    expect(anfitrion.cierres).toBe(1);
  });

  it('escapeEmiteCerrar', async () => {
    const { anfitrion } = await montar();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(anfitrion.cierres).toBe(1);
  });

  it('tabDesdeElUltimoVuelveAlPrimero', async () => {
    const { dialogo } = await montar();
    const enfocables = Array.from(dialogo.querySelectorAll<HTMLElement>('button'));
    const ultimo = enfocables.at(-1)!;
    ultimo.focus();

    const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    ultimo.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(enfocables[0]);
  });
});
