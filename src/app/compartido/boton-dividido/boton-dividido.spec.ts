import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccionMenu, AccionPrincipal, BotonDividido } from './boton-dividido';

const ACCIONES: AccionMenu[] = [
  { id: 'completar', etiqueta: 'Completar' },
  { id: 'no-realizada', etiqueta: 'No realizada', deshabilitada: true },
  { id: 'cancelar', etiqueta: 'Cancelar', peligro: true },
];

@Component({
  imports: [BotonDividido],
  template: `
    <app-boton-dividido
      [principal]="principal()"
      [acciones]="acciones"
      [etiquetaMenu]="'Más acciones para Paracetamol 500 mg, 08:00'"
      [etiquetaPrincipal]="'Iniciar: Paracetamol 500 mg, 08:00'"
      [deshabilitado]="deshabilitado()"
      (principal)="principales.push(true)"
      (accion)="elegidas.push($event)"
    />
    <app-boton-dividido
      [principal]="{ etiqueta: 'Iniciar' }"
      [acciones]="acciones"
      [etiquetaMenu]="'Más acciones para Control de presión, 16:00'"
    />
    <input id="otro-campo" />
  `,
})
class Anfitrion {
  readonly principal = signal<AccionPrincipal>({ etiqueta: 'Iniciar' });
  readonly deshabilitado = signal(false);
  readonly acciones = ACCIONES;
  readonly principales: boolean[] = [];
  readonly elegidas: string[] = [];
}

describe('BotonDividido', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let raiz: HTMLElement;

  const botones = () => raiz.querySelectorAll('app-boton-dividido');
  const segmento = (n = 0) =>
    botones()[n].querySelector<HTMLButtonElement>('.mv-boton-dividido__segmento')!;
  const menu = (n = 0) => botones()[n].querySelector<HTMLElement>('[role="menu"]')!;
  const items = () => Array.from(menu().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const tecla = (elemento: Element, key: string) => {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    elemento.dispatchEvent(evento);
    return evento;
  };
  const estable = () => fixture.whenStable();

  beforeEach(async () => {
    fixture = TestBed.createComponent(Anfitrion);
    raiz = fixture.nativeElement as HTMLElement;
    document.body.appendChild(raiz);
    await estable();
  });

  afterEach(() => raiz.remove());

  it('segmentoTieneAtributosDeBotonDeMenu', () => {
    const boton = segmento();
    expect(boton.getAttribute('aria-haspopup')).toBe('menu');
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe(menu().id);
    expect(menu().getAttribute('aria-labelledby')).toBe(boton.id);
    expect(menu().hidden).toBe(true);
    expect(items().map((i) => i.textContent?.trim())).toEqual([
      'Completar',
      'No realizada',
      'Cancelar',
    ]);
  });

  it('nombreAccesibleUnicoDesdeEtiquetaMenu', () => {
    expect(segmento(0).getAttribute('aria-label')).toBe(
      'Más acciones para Paracetamol 500 mg, 08:00',
    );
    expect(segmento(1).getAttribute('aria-label')).toBe(
      'Más acciones para Control de presión, 16:00',
    );
    expect(segmento(0).id).not.toBe(segmento(1).id);
    expect(menu(0).id).not.toBe(menu(1).id);
  });

  it('clicAbreEnfocaElPrimerItemYOtroClicCierra', async () => {
    segmento().click();
    await estable();

    expect(segmento().getAttribute('aria-expanded')).toBe('true');
    expect(menu().hidden).toBe(false);
    expect(document.activeElement).toBe(items()[0]);

    segmento().click();
    await estable();

    expect(segmento().getAttribute('aria-expanded')).toBe('false');
    expect(menu().hidden).toBe(true);
  });

  it('flechasInicioYFinRecorrenLosItems', async () => {
    segmento().click();
    await estable();

    expect(tecla(items()[0], 'ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items()[1]);
    tecla(items()[1], 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    tecla(items()[2], 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    tecla(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    tecla(items()[2], 'Home');
    expect(document.activeElement).toBe(items()[0]);
    tecla(items()[0], 'End');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('flechaAbajoYArribaDesdeElSegmentoAbren', async () => {
    tecla(segmento(), 'ArrowDown');
    await estable();
    expect(menu().hidden).toBe(false);
    expect(document.activeElement).toBe(items()[0]);

    tecla(items()[0], 'Escape');
    await estable();

    tecla(segmento(), 'ArrowUp');
    await estable();
    expect(document.activeElement).toBe(items()[2]);
  });

  it('escapeCierraYDevuelveElFocoAlSegmento', async () => {
    segmento().click();
    await estable();

    tecla(items()[1], 'Escape');
    await estable();

    expect(menu().hidden).toBe(true);
    expect(segmento().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(segmento());
  });

  it('tabCierraSinRetenerElFoco', async () => {
    segmento().click();
    await estable();

    const evento = tecla(items()[0], 'Tab');
    await estable();

    expect(evento.defaultPrevented).toBe(false);
    expect(menu().hidden).toBe(true);
  });

  it('clicAfueraCierraYDevuelveElFocoAlSegmento', async () => {
    segmento().click();
    await estable();

    document.body.click();
    await estable();

    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(segmento());
  });

  it('clicAfueraEnOtroControlNoLeQuitaElFoco', async () => {
    segmento().click();
    await estable();

    const campo = raiz.querySelector<HTMLInputElement>('#otro-campo')!;
    campo.focus();
    campo.click();
    await estable();

    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(campo);
  });

  it('emitePrincipalYAccionConSuId', async () => {
    raiz.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal')!.click();
    expect(fixture.componentInstance.principales).toEqual([true]);

    segmento().click();
    await estable();
    items()[2].click();
    await estable();

    expect(fixture.componentInstance.elegidas).toEqual(['cancelar']);
    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(segmento());
  });

  it('itemDeshabilitadoLlevaAriaDisabledYNoSeElige', async () => {
    segmento().click();
    await estable();

    expect(items()[1].getAttribute('aria-disabled')).toBe('true');
    expect(items()[0].hasAttribute('aria-disabled')).toBe(false);

    items()[1].click();
    await estable();

    expect(fixture.componentInstance.elegidas).toEqual([]);
    expect(menu().hidden).toBe(false);
  });

  it('itemDePeligroLlevaElTonoDePeligro', () => {
    expect(items()[2].classList).toContain('mv-menu__item--peligro');
    expect(items()[0].classList).not.toContain('mv-menu__item--peligro');
  });

  it('principalDePeligroYDeshabilitado', async () => {
    fixture.componentInstance.principal.set({ etiqueta: 'Eliminar', peligro: true });
    fixture.componentInstance.deshabilitado.set(true);
    await estable();

    const principal = raiz.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal')!;
    expect(principal.classList).toContain('mv-boton--peligro');
    expect(principal.disabled).toBe(true);
    expect(segmento().disabled).toBe(true);

    tecla(segmento(), 'ArrowDown');
    await estable();
    expect(menu().hidden).toBe(true);
  });

  it('etiquetaPrincipalDaNombreAccesibleSinCambiarElTextoVisible', () => {
    const principales = raiz.querySelectorAll<HTMLButtonElement>('.mv-boton-dividido__principal');
    expect(principales[0].textContent?.trim()).toBe('Iniciar');
    expect(principales[0].getAttribute('aria-label')).toBe('Iniciar: Paracetamol 500 mg, 08:00');
    expect(principales[1].textContent?.trim()).toBe('Iniciar');
    expect(principales[1].hasAttribute('aria-label')).toBe(false);
  });

  it('pulsarPrincipalConElMenuAbiertoLoCierraAntesDeEmitir', async () => {
    segmento().click();
    await estable();
    expect(menu().hidden).toBe(false);

    let menuOcultoAlEmitir: boolean | null = null;
    const instancia = fixture.debugElement.children[0].componentInstance as BotonDividido;
    instancia.pulsarPrincipal.subscribe(() => {
      menuOcultoAlEmitir = !instancia['abierto']();
    });
    raiz.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal')!.click();
    await estable();

    expect(menuOcultoAlEmitir).toBe(true);
    expect(menu().hidden).toBe(true);
    expect(segmento().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.principales).toEqual([true]);
  });

  it('elScrollRecalculaLaPosicion', async () => {
    let top = 100;
    segmento().getBoundingClientRect = () =>
      ({ top, bottom: top + 48, left: 800, right: 844 }) as DOMRect;
    segmento().click();
    await estable();
    expect(menu().style.top).toBe('156px');

    top = 200;
    window.dispatchEvent(new Event('scroll'));
    expect(menu().style.top).toBe('256px');
  });

  it('siElSegmentoSaleDeLaVentanaAlDesplazarCierraYDevuelveElFocoSinDesplazar', async () => {
    let top = 100;
    segmento().getBoundingClientRect = () =>
      ({ top, bottom: top + 48, left: 800, right: 844 }) as DOMRect;
    segmento().click();
    await estable();
    expect(document.activeElement).toBe(items()[0]);
    const enfocar = vi.spyOn(segmento(), 'focus');

    top = -200;
    window.dispatchEvent(new Event('scroll'));
    await estable();

    expect(menu().hidden).toBe(true);
    expect(segmento().getAttribute('aria-expanded')).toBe('false');
    expect(enfocar).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(segmento());
  });

  it('siElSegmentoSaleDeLaVentanaConElFocoFueraDelMenuNoLoMueve', async () => {
    let top = 100;
    segmento().getBoundingClientRect = () =>
      ({ top, bottom: top + 48, left: 800, right: 844 }) as DOMRect;
    segmento().click();
    await estable();
    const campo = raiz.querySelector<HTMLInputElement>('#otro-campo')!;
    campo.focus();

    top = 2000;
    window.dispatchEvent(new Event('scroll'));
    await estable();

    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(campo);
  });

  it('quitaLosEscuchadoresDeScrollYResizeAlCerrar', async () => {
    const agregar = vi.spyOn(window, 'addEventListener');
    const quitar = vi.spyOn(window, 'removeEventListener');
    segmento().click();
    await estable();

    const scroll = agregar.mock.calls.find(([tipo]) => tipo === 'scroll')!;
    const resize = agregar.mock.calls.find(([tipo]) => tipo === 'resize')!;
    expect(scroll[2]).toBe(true);

    tecla(items()[0], 'Escape');
    await estable();

    expect(quitar).toHaveBeenCalledWith('scroll', scroll[1], true);
    expect(quitar).toHaveBeenCalledWith('resize', resize[1]);
    agregar.mockRestore();
    quitar.mockRestore();
  });

  it('quitaLosEscuchadoresAlDestruirseAbierto', async () => {
    const agregar = vi.spyOn(window, 'addEventListener');
    const quitar = vi.spyOn(window, 'removeEventListener');
    segmento().click();
    await estable();
    const scroll = agregar.mock.calls.find(([tipo]) => tipo === 'scroll')!;
    const resize = agregar.mock.calls.find(([tipo]) => tipo === 'resize')!;

    fixture.destroy();

    expect(quitar).toHaveBeenCalledWith('scroll', scroll[1], true);
    expect(quitar).toHaveBeenCalledWith('resize', resize[1]);
    agregar.mockRestore();
    quitar.mockRestore();
  });

  it('elMenuSePosicionaFijoBajoElSegmento', async () => {
    segmento().getBoundingClientRect = () =>
      ({ top: 100, bottom: 148, left: 800, right: 844 }) as DOMRect;
    segmento().click();
    await estable();

    // jsdom no mide el menú (ancho 0): queda alineado al borde derecho del segmento.
    expect(menu().style.top).toBe('156px');
    expect(menu().style.left).toBe('844px');
    expect(menu().classList).not.toContain('mv-menu--arriba');
  });
});

@Component({
  imports: [BotonDividido],
  template: `
    <div class="mv-grilla" role="region" aria-label="Agenda del día" tabindex="0">
      <table class="mv-grilla__tabla">
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Tarea</th>
            <th scope="col" class="mv-grilla__celda--estado">Estado</th>
            <th scope="col" class="mv-grilla__celda--acciones">Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (fila of filas; track fila.hora) {
            <tr>
              <td class="mv-grilla__celda--dato" data-etiqueta="Hora">{{ fila.hora }}</td>
              <td data-etiqueta="Tarea">
                <span class="mv-grilla__titulo">{{ fila.titulo }}</span>
                <span class="mv-grilla__secundario">Medicamento</span>
              </td>
              <td class="mv-grilla__celda--estado" data-etiqueta="Estado">
                <span class="mv-chip mv-chip--alerta">Pendiente</span>
              </td>
              <td class="mv-grilla__celda--acciones">
                <app-boton-dividido
                  [principal]="{ etiqueta: 'Iniciar' }"
                  [acciones]="[{ id: 'cancelar', etiqueta: 'Cancelar', peligro: true }]"
                  [etiquetaMenu]="'Más acciones para ' + fila.titulo + ', ' + fila.hora"
                />
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
class GrillaDePrueba {
  readonly filas = [
    { hora: '08:00', titulo: 'Paracetamol 500 mg' },
    { hora: '20:30', titulo: 'Ibuprofeno 500 mg' },
  ];
}

describe('Grilla con botón dividido', () => {
  /** Grilla con scroll propio de 100 a 400 px y encabezado fijo de 48 px. */
  async function abrirEnGrillaConScroll(topSegmento: () => number) {
    const fixture = TestBed.createComponent(GrillaDePrueba);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const grilla = raiz.querySelector<HTMLElement>('.mv-grilla')!;
    grilla.style.overflowY = 'auto';
    grilla.getBoundingClientRect = () => ({ top: 100, bottom: 400, left: 0, right: 1000 }) as DOMRect;
    raiz.querySelector('thead')!.getBoundingClientRect = () =>
      ({ top: 100, bottom: 148, height: 48 }) as DOMRect;
    const segmento = raiz.querySelector<HTMLButtonElement>('.mv-boton-dividido__segmento')!;
    segmento.getBoundingClientRect = () =>
      ({ top: topSegmento(), bottom: topSegmento() + 48, left: 900, right: 944 }) as DOMRect;
    segmento.click();
    await fixture.whenStable();
    const menu = document.getElementById(segmento.getAttribute('aria-controls')!)!;
    return { fixture, segmento, menu, grilla };
  }

  it('cierraElMenuSiElSegmentoQuedaBajoElEncabezadoFijo', async () => {
    let top = 200;
    const { fixture, segmento, menu, grilla } = await abrirEnGrillaConScroll(() => top);
    expect(menu.hidden).toBe(false);

    top = 110;
    grilla.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(segmento);
  });

  it('cierraElMenuSiElSegmentoQuedaBajoElAreaVisibleDeLaGrilla', async () => {
    let top = 200;
    const { fixture, menu, grilla } = await abrirEnGrillaConScroll(() => top);

    top = 390;
    grilla.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(menu.hidden).toBe(true);
  });

  it('dentroDelAreaVisibleDeLaGrillaElMenuSigueAbierto', async () => {
    let top = 200;
    const { fixture, menu, grilla } = await abrirEnGrillaConScroll(() => top);

    top = 300;
    grilla.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(menu.hidden).toBe(false);
  });

  it('seRenderizaComoTablaConRotulosPorCeldaYMenusUnicos', async () => {
    const fixture = TestBed.createComponent(GrillaDePrueba);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;

    const encabezados = Array.from(raiz.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados).toEqual(['Hora', 'Tarea', 'Estado', 'Acciones']);

    // Cada celda de datos lleva el rótulo de su columna para la vista de tarjeta.
    for (const fila of Array.from(raiz.querySelectorAll('tbody tr'))) {
      const celdas = Array.from(fila.querySelectorAll('td'));
      const rotulos = celdas.map((td) => td.getAttribute('data-etiqueta'));
      expect(rotulos).toEqual(['Hora', 'Tarea', 'Estado', null]);
      expect(celdas[3].querySelector('app-boton-dividido')).toBeTruthy();
    }

    const nombres = Array.from(raiz.querySelectorAll('.mv-boton-dividido__segmento')).map((s) =>
      s.getAttribute('aria-label'),
    );
    expect(nombres).toEqual([
      'Más acciones para Paracetamol 500 mg, 08:00',
      'Más acciones para Ibuprofeno 500 mg, 20:30',
    ]);
  });
});
