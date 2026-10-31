import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SeccionPanel } from './seccion-panel';
import { EstadoCarga } from '../../../nucleo/panel/estado-seccion';

@Component({
  selector: 'app-anfitrion-prueba',
  imports: [SeccionPanel],
  template: `
    <app-seccion-panel
      titulo="Tareas de hoy"
      [estado]="estado"
      mensajeVacio="No hay tareas para hoy ni atrasadas."
      [desactualizada]="desactualizada"
      (reintentar)="reintentos = reintentos + 1"
    >
      <p class="contenido-prueba">Contenido de la sección</p>
    </app-seccion-panel>
  `,
})
class AnfitrionPrueba {
  estado: EstadoCarga = 'cargando';
  desactualizada = false;
  reintentos = 0;
}

function crear(estado: EstadoCarga, desactualizada = false) {
  TestBed.configureTestingModule({ imports: [AnfitrionPrueba] });
  const fixture = TestBed.createComponent(AnfitrionPrueba);
  fixture.componentInstance.estado = estado;
  fixture.componentInstance.desactualizada = desactualizada;
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

describe('SeccionPanel', () => {
  it('cargandoMuestraElMensajeConRoleStatus', () => {
    const { elemento } = crear('cargando');

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    expect(elemento.querySelector('.contenido-prueba')).toBeNull();
  });

  it('cargandoMuestraEsqueletoDecorativo', () => {
    const { elemento } = crear('cargando');

    const esqueleto = elemento.querySelector('[role="status"] [aria-hidden="true"]');
    expect(esqueleto?.querySelector('.mv-esqueleto')).toBeTruthy();
  });

  it('errorMuestraElAvisoConRoleAlertYEmiteReintentoAlHacerClick', () => {
    const { fixture, elemento } = crear('error');

    const aviso = elemento.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('No se pudo cargar esta sección.');
    expect(aviso?.classList).toContain('mv-aviso--error');
    expect(elemento.querySelector('.contenido-prueba')).toBeNull();

    aviso!.querySelector('button')!.click();

    expect(fixture.componentInstance.reintentos).toBe(1);
  });

  it('vacioMuestraElMensajeDeVacioConRoleStatus', () => {
    const { elemento } = crear('vacio');

    expect(elemento.querySelector('[role="status"]')?.textContent).toBe(
      'No hay tareas para hoy ni atrasadas.',
    );
    expect(elemento.querySelector('.contenido-prueba')).toBeNull();
  });

  it('datosMuestraElContenidoProyectado', () => {
    const { elemento } = crear('datos');

    expect(elemento.querySelector('.contenido-prueba')?.textContent).toContain(
      'Contenido de la sección',
    );
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
  });

  it('desactualizadaMuestraNoSePudoActualizarJuntoConLosDatosYEmiteReintento', () => {
    const { fixture, elemento } = crear('datos', true);

    // Los datos siguen visibles (`refrescar()` conserva los datos al fallar).
    expect(elemento.querySelector('.contenido-prueba')).toBeTruthy();

    const avisos = elemento.querySelectorAll('[role="alert"]');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].textContent).toContain('No se pudo actualizar.');

    avisos[0].querySelector('button')!.click();

    expect(fixture.componentInstance.reintentos).toBe(1);
  });

  it('noDesactualizadaNoMuestraElAvisoDeActualizacion', () => {
    const { elemento } = crear('datos', false);

    expect(elemento.querySelector('[role="alert"]')).toBeNull();
  });

  it('elTituloEsUnH3PorqueColgaDelH2DelPanel', () => {
    // Las 5 secciones cuelgan del `<h2>` "Tu panel" (`inicio.html`); si
    // también fueran `<h2>` se verían 6 títulos al mismo nivel.
    const { elemento } = crear('datos');

    expect(elemento.querySelector('h2')).toBeNull();
    expect(elemento.querySelector('h3')?.textContent).toBe('Tareas de hoy');
  });

  it('reintentarMueveElFocoAlTituloDeLaSeccion', () => {
    // Con teclado o lector de pantalla, al apretar "Reintentar" el foco
    // no debe caer al <body>; se mueve al título de la sección.
    const { fixture, elemento } = crear('error');

    const aviso = elemento.querySelector('[role="alert"]')!;
    aviso.querySelector('button')!.click();
    fixture.detectChanges();

    const titulo = elemento.querySelector('h3')!;
    expect(document.activeElement).toBe(titulo);
    expect(titulo.getAttribute('tabindex')).toBe('-1');
  });
});
