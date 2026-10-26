import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SelectorHorario } from './selector-horario';
import { HorarioJson, reconstruirHorario } from '../../../nucleo/planificacion/horario';

@Component({
  imports: [ReactiveFormsModule, SelectorHorario],
  template: `<app-selector-horario [formControl]="control" />`,
})
class Anfitrion {
  control = new FormControl<HorarioJson | null>(null);
}

async function configurar(inicial: HorarioJson | null = null) {
  TestBed.configureTestingModule({ imports: [Anfitrion] });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.componentInstance.control.setValue(inicial);
  await fixture.whenStable();
  return {
    fixture,
    control: fixture.componentInstance.control,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function escribir(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function campoConEtiqueta(elemento: HTMLElement, etiqueta: string): HTMLInputElement {
  const label = Array.from(elemento.querySelectorAll('label')).find(
    (l) => l.textContent?.trim() === etiqueta,
  );
  if (!label) throw new Error(`Sin etiqueta "${etiqueta}"`);
  const id = label.getAttribute('for');
  return (
    id ? elemento.querySelector(`#${CSS.escape(id)}`) : label.querySelector('input')
  ) as HTMLInputElement;
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement {
  return Array.from(elemento.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  )!;
}

async function elegirIntervalo(
  fixture: { whenStable: () => Promise<unknown> },
  elemento: HTMLElement,
) {
  campoConEtiqueta(elemento, 'Intervalo').click();
  await fixture.whenStable();
}

describe('SelectorHorario', () => {
  it('horasFijasEmiteElContrato', async () => {
    const { fixture, control, elemento } = await configurar();

    expect(elemento.textContent).toContain('Hora de Chile (America/Santiago)');
    escribir(campoConEtiqueta(elemento, 'Hora 1'), '08:00');
    botonConTexto(elemento, 'Agregar hora').click();
    await fixture.whenStable();
    escribir(campoConEtiqueta(elemento, 'Hora 2'), '20:00');
    await fixture.whenStable();

    expect(control.value).toEqual({ version: 1, tipo: 'HORAS_FIJAS', horas: ['08:00', '20:00'] });
    expect(control.valid).toBe(true);
    expect(elemento.textContent).toContain('Se administrará a las: 08:00 · 20:00');

    botonConTexto(elemento, 'Quitar').click();
    await fixture.whenStable();
    expect(control.value).toEqual({ version: 1, tipo: 'HORAS_FIJAS', horas: ['20:00'] });
  });

  it('elBotonQuitarTieneUnAriaLabelPorFila', async () => {
    const { fixture, elemento } = await configurar();

    botonConTexto(elemento, 'Agregar hora').click();
    await fixture.whenStable();

    const botones = Array.from(elemento.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Quitar',
    );
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Quitar hora 1', 'Quitar hora 2']);
  });

  it('agregarHoraEnfocaElNuevoCampo', async () => {
    const { fixture, elemento } = await configurar();

    botonConTexto(elemento, 'Agregar hora').click();
    await fixture.whenStable();

    expect(elemento.ownerDocument.activeElement).toBe(campoConEtiqueta(elemento, 'Hora 2'));
  });

  it('quitarHoraEnfocaLaFilaEquivalente', async () => {
    const { fixture, elemento } = await configurar();
    botonConTexto(elemento, 'Agregar hora').click();
    await fixture.whenStable();
    botonConTexto(elemento, 'Agregar hora').click();
    await fixture.whenStable();

    // Quita la fila 2 (índice 1): el foco va a la fila que queda en esa posición.
    Array.from(elemento.querySelectorAll('button'))
      .filter((b) => b.textContent?.trim() === 'Quitar')[1]
      .click();
    await fixture.whenStable();

    expect(elemento.ownerDocument.activeElement).toBe(campoConEtiqueta(elemento, 'Hora 2'));
  });

  it('elAvisoDeHorasPrevistasSiempreEstaEnElDomSoloCambiaElTexto', async () => {
    const { fixture, elemento, control } = await configurar();

    let aviso = elemento.querySelector('.previstas');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.textContent?.trim()).toBe('');

    escribir(campoConEtiqueta(elemento, 'Hora 1'), '08:00');
    await fixture.whenStable();

    aviso = elemento.querySelector('.previstas');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain('Se administrará a las: 08:00');
    expect(control.valid).toBe(true);
  });

  it('cambiarDeModoNoMuestraElErrorAntesDeInteractuarConLosCampos', async () => {
    const { fixture, elemento } = await configurar();

    await elegirIntervalo(fixture, elemento);

    // Recién cambiado a "Intervalo", con los campos vacíos: todavía sin error visible.
    expect(elemento.querySelector('[role="alert"]')).toBeNull();

    escribir(campoConEtiqueta(elemento, 'Inicio'), '08:00');
    await fixture.whenStable();

    // Tras escribir en un campo del horario, el error (si lo hay) ya se muestra.
    expect(elemento.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('elFocusoutMuestraElErrorAunqueNoSeHayaCambiadoNingunValor', async () => {
    const { fixture, elemento } = await configurar();

    expect(elemento.querySelector('[role="alert"]')).toBeNull();

    elemento.querySelector('fieldset')!.dispatchEvent(new Event('focusout', { bubbles: true }));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Indica al menos una hora',
    );
  });

  it('intervaloEmiteElContratoYMuestraLasHoras', async () => {
    const { fixture, control, elemento } = await configurar();

    await elegirIntervalo(fixture, elemento);
    escribir(campoConEtiqueta(elemento, 'Inicio'), '08:00');
    escribir(campoConEtiqueta(elemento, 'Fin'), '16:00');
    escribir(campoConEtiqueta(elemento, 'Cada N horas'), '8');
    await fixture.whenStable();

    expect(control.value).toEqual({
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '08:00',
      hora_fin: '16:00',
      frecuencia_horas: 8,
    });
    expect(control.valid).toBe(true);
    expect(elemento.textContent).toContain('Se administrará a las: 08:00 · 16:00');
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
  });

  it('intervaloInvalidoMuestraErrorYNoEsValido', async () => {
    const { fixture, control, elemento } = await configurar();

    await elegirIntervalo(fixture, elemento);
    escribir(campoConEtiqueta(elemento, 'Inicio'), '16:00');
    escribir(campoConEtiqueta(elemento, 'Fin'), '08:00');
    escribir(campoConEtiqueta(elemento, 'Cada N horas'), '8');
    await fixture.whenStable();

    const mensajeFin = 'La hora de fin debe ser posterior a la de inicio (sin cruzar medianoche)';
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(mensajeFin);
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ horario: mensajeFin });
    expect(control.value).toBeNull();
    expect(elemento.textContent).not.toContain('Se administrará a las');

    escribir(campoConEtiqueta(elemento, 'Fin'), '20:00');
    escribir(campoConEtiqueta(elemento, 'Cada N horas'), '1.5');
    await fixture.whenStable();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'La frecuencia debe ser un número entero de horas entre 1 y 24',
    );
    expect(control.valid).toBe(false);
  });

  it('cargaUnDetalleReconstruyendoElIntervalo', async () => {
    const { control, elemento } = await configurar(reconstruirHorario(['14:00', '08:00', '20:00']));

    expect(campoConEtiqueta(elemento, 'Intervalo').checked).toBe(true);
    expect(campoConEtiqueta(elemento, 'Inicio').value).toBe('08:00');
    expect(campoConEtiqueta(elemento, 'Fin').value).toBe('20:00');
    expect(campoConEtiqueta(elemento, 'Cada N horas').value).toBe('6');
    expect(elemento.textContent).toContain('Se administrará a las: 08:00 · 14:00 · 20:00');
    expect(control.valid).toBe(true);
    expect(control.value).toEqual({
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '08:00',
      hora_fin: '20:00',
      frecuencia_horas: 6,
    });
  });

  it('sinInteraccionNoMuestraErrorPeroNoEsValido', async () => {
    const { control, elemento } = await configurar();

    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ horario: 'Indica al menos una hora' });
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
  });
});
