import { Component, ElementRef, Injector, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  dentroDe,
  devolverFoco,
  enfocarPrimerCampoInvalido,
  enfocarPrimeraNueva,
  mostrarAviso,
  mostrarSeccion,
  porId,
  porSelector,
  primeroQueExista,
  rescatarFoco,
  traerALaVista,
} from './foco';

@Component({
  template: `
    <form id="otro"><input id="fuera" aria-invalid="true" /></form>
    <form id="principal">
      <input id="valido" />
      <input id="primero" [attr.aria-invalid]="invalido() ? true : null" />
      <input id="segundo" aria-invalid="true" />
    </form>
  `,
})
class Prueba {
  readonly invalido = signal(false);
  readonly host = inject(ElementRef<HTMLElement>);
  readonly injector = inject(Injector);

  enviar(): void {
    this.invalido.set(true);
    enfocarPrimerCampoInvalido(dentroDe(this.host, '#principal'), this.injector);
  }
}

describe('enfocarPrimerCampoInvalido', () => {
  it('enfocaElPrimerCampoInvalidoDelContenedorTrasElRender', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();

    fixture.componentInstance.enviar();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('primero');
  });

  it('sinCamposInvalidosNoMueveElFoco', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();
    const valido = fixture.nativeElement.querySelector('#valido') as HTMLInputElement;
    valido.focus();

    enfocarPrimerCampoInvalido(
      dentroDe(fixture.componentInstance.host, '#nada'),
      fixture.componentInstance.injector,
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(valido);
  });
});

// jsdom no implementa `scrollIntoView` ni `matchMedia`: se instalan espías
// por prueba y se quitan al terminar.
describe('desplazamiento y foco', () => {
  let desplazar: ReturnType<typeof vi.fn>;
  let enfocar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar as unknown as Element['scrollIntoView'];
    enfocar = vi.spyOn(HTMLElement.prototype, 'focus');
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    enfocar.mockRestore();
    vi.unstubAllGlobals();
  });

  function simularMovimientoReducido(reducir: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((consulta: string) => ({
        matches: reducir && consulta === '(prefers-reduced-motion: reduce)',
      })),
    );
  }

  /** Elementos desplazados (el `this` de cada llamada) y sus opciones. */
  function desplazados(): { elemento: Element; opciones: ScrollIntoViewOptions }[] {
    return desplazar.mock.contexts.map((elemento, i) => ({
      elemento: elemento as Element,
      opciones: desplazar.mock.calls[i][0] as ScrollIntoViewOptions,
    }));
  }

  @Component({
    template: `
      <button id="abrir" type="button">Abrir</button>
      @if (abierto()) {
        <section id="seccion">
          <h2>Formulario</h2>
          <input id="deshabilitado" disabled />
          <input id="primero" />
          <input id="segundo" />
        </section>
      }
      <div id="sin-campos" tabindex="-1"><p>Sin campos</p></div>
      <p id="aviso" role="alert">Error</p>
      <form id="con-error"><p class="mv-campo__error">Elige un día</p></form>
      <ul id="lista">
        <li><a href="/1">Uno</a></li>
        <li><a href="/2">Dos</a></li>
        <li><button type="button" disabled>Nada</button><button type="button" id="accion-3">Tres</button></li>
      </ul>
    `,
  })
  class Pagina {
    readonly abierto = signal(false);
    readonly injector = inject(Injector);
  }

  async function crear(): Promise<{ pagina: Pagina; render: () => Promise<void> }> {
    const fixture = TestBed.createComponent(Pagina);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    return {
      pagina: fixture.componentInstance,
      render: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  it('mostrarSeccionEsperaElRenderDesplazaAlInicioYEnfocaElPrimerCampoSinVolverADesplazar', async () => {
    simularMovimientoReducido(false);
    const { pagina, render } = await crear();

    pagina.abierto.set(true);
    mostrarSeccion(porId('seccion'), pagina.injector);
    await render();

    expect(desplazados()).toEqual([
      { elemento: document.getElementById('seccion'), opciones: { block: 'start', behavior: 'smooth' } },
    ]);
    expect(document.activeElement?.id).toBe('primero');
    expect(enfocar).toHaveBeenCalledWith({ preventScroll: true });
    // Primero se desplaza y después se enfoca.
    expect(desplazar.mock.invocationCallOrder[0]).toBeLessThan(enfocar.mock.invocationCallOrder[0]);
  });

  it('mostrarSeccionConMovimientoReducidoSaltaSinAnimacion', async () => {
    simularMovimientoReducido(true);
    const { pagina, render } = await crear();

    pagina.abierto.set(true);
    mostrarSeccion(porId('seccion'), pagina.injector);
    await render();

    expect(desplazados()[0].opciones).toEqual({ block: 'start', behavior: 'auto' });
  });

  it('mostrarSeccionEnfocaElCampoIndicado', async () => {
    const { pagina, render } = await crear();

    pagina.abierto.set(true);
    mostrarSeccion(porId('seccion'), pagina.injector, porId('segundo'));
    await render();

    expect(document.activeElement?.id).toBe('segundo');
  });

  it('mostrarSeccionSinCamposEnfocaLaSeccionSiEsEnfocable', async () => {
    const { pagina, render } = await crear();

    mostrarSeccion(porId('sin-campos'), pagina.injector);
    await render();

    expect(desplazados()[0].elemento.id).toBe('sin-campos');
    expect(document.activeElement?.id).toBe('sin-campos');
  });

  it('mostrarSeccionSinSeccionNoHaceNada', async () => {
    const { pagina, render } = await crear();

    mostrarSeccion(porId('no-existe'), pagina.injector);
    await render();

    expect(desplazar).not.toHaveBeenCalled();
  });

  it('devolverFocoDesplazaSoloLoNecesarioYEnfocaSinVolverADesplazar', async () => {
    simularMovimientoReducido(false);
    const { pagina, render } = await crear();

    devolverFoco(porId('abrir'), pagina.injector);
    await render();

    expect(desplazados()).toEqual([
      { elemento: document.getElementById('abrir'), opciones: { block: 'nearest', behavior: 'smooth' } },
    ]);
    expect(document.activeElement?.id).toBe('abrir');
    expect(enfocar).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('mostrarAvisoLoTraeALaVistaSinMoverElFoco', async () => {
    const { pagina, render } = await crear();
    document.getElementById('abrir')!.focus();
    enfocar.mockClear();

    mostrarAviso(porId('aviso'), pagina.injector);
    await render();

    expect(desplazados()[0].elemento.id).toBe('aviso');
    expect(desplazados()[0].opciones.block).toBe('nearest');
    expect(enfocar).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('abrir');
  });

  it('traerALaVistaUsaBloqueNearest', async () => {
    const { pagina, render } = await crear();

    traerALaVista(porId('sin-campos'), pagina.injector);
    await render();

    expect(desplazados()[0]).toEqual({
      elemento: document.getElementById('sin-campos'),
      opciones: { block: 'nearest', behavior: 'smooth' },
    });
  });

  it('enfocarPrimerCampoInvalidoCentraElCampoYLoEnfocaConPreventScroll', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();

    fixture.componentInstance.enviar();
    await fixture.whenStable();

    expect(desplazados()[0].elemento.id).toBe('primero');
    expect(desplazados()[0].opciones.block).toBe('center');
    expect(enfocar).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('enfocarPrimerCampoInvalidoSinCampoMarcadoTraeElMensajeALaVistaSinEnfocar', async () => {
    const { pagina, render } = await crear();

    enfocarPrimerCampoInvalido(porId('con-error'), pagina.injector);
    await render();

    expect(desplazados()[0].elemento.className).toBe('mv-campo__error');
    expect(enfocar).not.toHaveBeenCalled();
  });

  it('enfocarPrimeraNuevaEnfocaLaAccionDeLaFilaIndicada', async () => {
    const { pagina, render } = await crear();

    enfocarPrimeraNueva(porId('lista'), 'li', 1, pagina.injector);
    await render();
    expect(document.activeElement?.textContent).toBe('Dos');
    expect(desplazados()[0].opciones.block).toBe('nearest');

    enfocarPrimeraNueva(porId('lista'), 'li', 2, pagina.injector);
    await render();
    expect(document.activeElement?.id).toBe('accion-3');
  });

  it('rescatarFocoSoloActuaSiElFocoQuedoEnBody', async () => {
    const { pagina, render } = await crear();
    const abrir = document.getElementById('abrir')!;
    abrir.focus();

    rescatarFoco(porId('sin-campos'), pagina.injector);
    await render();
    expect(document.activeElement).toBe(abrir);

    abrir.blur();
    rescatarFoco(porId('sin-campos'), pagina.injector);
    await render();
    expect(document.activeElement?.id).toBe('sin-campos');
  });

  it('primeroQueExistaDevuelveElPrimeroPresente', async () => {
    await crear();
    expect(primeroQueExista(porId('no-existe'), porSelector('#aviso'), porId('abrir'))()?.id).toBe('aviso');
    expect(primeroQueExista(porId('no-existe'))()).toBeNull();
  });
});
