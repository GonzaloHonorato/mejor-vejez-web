import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EntradaMas, PanelMas, rutaCoincide } from './panel-mas';

const ENTRADAS: EntradaMas[] = [
  { etiqueta: 'Remedios', ruta: '/planes', icono: 'remedios', prefijoActivo: '/planes' },
  { etiqueta: 'Grupos', ruta: '/grupos', icono: 'grupos', prefijoActivo: '/grupos' },
];

@Component({
  imports: [PanelMas],
  template: `
    <app-panel-mas
      [entradas]="entradas"
      [correo]="correo()"
      [urlActual]="urlActual()"
      (cerrar)="cierres = cierres + 1"
      (cerrarSesion)="salidas = salidas + 1"
    />
  `,
})
class Anfitrion {
  readonly entradas = ENTRADAS;
  readonly correo = signal('ana@correo.cl');
  readonly urlActual = signal('/grupos/1/auditoria');
  cierres = 0;
  salidas = 0;
}

async function montar() {
  TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Anfitrion);
  // Adjunto al documento: el foco y la trampa de Tab necesitan elementos conectados.
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const elemento = fixture.nativeElement as HTMLElement;
  const dialogo = elemento.querySelector<HTMLElement>('[role="dialog"]')!;
  const enfocables = Array.from(dialogo.querySelectorAll<HTMLElement>('a[href], button'));
  return { fixture, elemento, dialogo, enfocables, anfitrion: fixture.componentInstance };
}

function pulsarTab(objetivo: HTMLElement, shiftKey = false): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  objetivo.dispatchEvent(evento);
  return evento;
}

describe('PanelMas', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('esDialogoModalYEnfocaElPrimerEnlaceAlMontarse', async () => {
    const { dialogo, enfocables } = await montar();

    expect(dialogo.id).toBe('panel-mas');
    expect(dialogo.getAttribute('aria-label')).toBe('Más opciones');
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialogo.querySelector('a'));
    // Orden: "Cerrar", los enlaces y "Cerrar sesión".
    expect(enfocables[0].textContent?.trim()).toBe('Cerrar');
    expect(enfocables.at(-1)!.textContent?.trim()).toBe('Cerrar sesión');
  });

  it('tabDesdeElUltimoVuelveAlPrimero', async () => {
    const { enfocables } = await montar();
    const ultimo = enfocables.at(-1)!;
    ultimo.focus();

    const evento = pulsarTab(ultimo);

    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(enfocables[0]);
  });

  it('shiftTabDesdeElPrimeroVaAlUltimo', async () => {
    const { enfocables } = await montar();
    enfocables[0].focus();

    const evento = pulsarTab(enfocables[0], true);

    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(enfocables.at(-1));
  });

  it('tabEnMedioNoSeIntercepta', async () => {
    const { enfocables } = await montar();
    enfocables[1].focus();

    expect(pulsarTab(enfocables[1]).defaultPrevented).toBe(false);
    expect(pulsarTab(enfocables[1], true).defaultPrevented).toBe(false);
  });

  it('escapeFondoYCerrarAvisanCerrar', async () => {
    const { fixture, elemento, enfocables, anfitrion } = await montar();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    elemento.querySelector<HTMLElement>('.panel-mas__fondo')!.click();
    enfocables[0].click();
    await fixture.whenStable();

    expect(anfitrion.cierres).toBe(3);
  });

  it('cerrarSesionAvisaYMuestraElCorreo', async () => {
    const { dialogo, enfocables, anfitrion } = await montar();

    expect(dialogo.textContent).toContain('ana@correo.cl');
    enfocables.at(-1)!.click();

    expect(anfitrion.salidas).toBe(1);
  });

  it('marcaAriaCurrentPorPrefijoDeRuta', async () => {
    const { dialogo } = await montar();

    const actuales = dialogo.querySelectorAll('a[aria-current="page"]');
    expect(actuales).toHaveLength(1);
    expect(actuales[0].textContent?.trim()).toBe('Grupos');
  });

  it('rutaCoincidePorSegmentosCompletos', () => {
    expect(rutaCoincide('/grupos', '/grupos')).toBe(true);
    expect(rutaCoincide('/grupos/1/auditoria?pagina=2', '/grupos')).toBe(true);
    expect(rutaCoincide('/gruposx', '/grupos')).toBe(false);
    expect(rutaCoincide('/perfil#datos', '/perfil')).toBe(true);
  });
});
