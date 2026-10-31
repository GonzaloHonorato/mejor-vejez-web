import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FormularioDetalle } from './formulario-detalle';
import { BuscadorMedicamento } from '../buscador-medicamento/buscador-medicamento';
import { RespuestaOpcionCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { RespuestaIntegrante } from '../../../nucleo/grupos/modelos-grupos';
import {
  RespuestaDetallePlan,
  RespuestaMedicamento,
  RespuestaPlan,
} from '../../../nucleo/planificacion/modelos-planificacion';
import { ServicioMedicamentos } from '../../../nucleo/planificacion/servicio-medicamentos';
import { ServicioPlanes } from '../../../nucleo/planificacion/servicio-planes';

const AVISO =
  'Registra la indicación entregada por un profesional o cuidador autorizado. Cuida+ no prescribe ni recomienda dosis.';

const PRESENTACIONES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 211, codigo: 'COMPRIMIDO', descripcion: 'Comprimido', orden: 1 },
  { idOpcion: 212, codigo: 'JARABE', descripcion: 'Jarabe', orden: 2 },
];
const UNIDADES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 221, codigo: 'COMPRIMIDO', descripcion: 'comprimido(s)', orden: 1 },
  { idOpcion: 222, codigo: 'ML', descripcion: 'ml', orden: 2 },
];
const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// Ids > 127 a propósito: la comparación de días y responsable debe ser por valor.
const DIAS: RespuestaOpcionCatalogo[] = NOMBRES_DIAS.map((descripcion, i) => ({
  idOpcion: 231 + i,
  codigo: descripcion.toUpperCase(),
  descripcion,
  orden: i + 1,
}));

function integrante(idUsuario: number, nombre: string): RespuestaIntegrante {
  return {
    idIntegrante: idUsuario + 1000,
    idUsuario,
    nombre,
    email: `${idUsuario}@correo.cl`,
    idRol: 2,
    nombreRol: 'CUIDADOR',
    idEstado: 1,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: null,
  };
}
const INTEGRANTES = [integrante(300, 'Ana Rojas'), integrante(301, 'Luis Rojas')];

function plan(datos: Partial<RespuestaPlan> = {}): RespuestaPlan {
  return {
    idPlan: 7,
    idGrupo: 1,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    nombrePlan: 'Plan mañana',
    vigenteDesde: '2099-01-01',
    vigenteHasta: null,
    idEstado: 1,
    medicamentosActivos: 0,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    ...datos,
  };
}

const PARACETAMOL: RespuestaMedicamento = {
  idMedicamento: 500,
  nombre: 'Paracetamol',
  principioActivo: 'Paracetamol',
  idPresentacion: 211,
  concentracion: '500 mg',
  usadoEnGrupo: true,
};

function detalle(datos: Partial<RespuestaDetallePlan> = {}): RespuestaDetallePlan {
  return {
    idDetallePlan: 55,
    idPlan: 7,
    idMedicamento: 500,
    nombreMedicamento: 'Paracetamol',
    idPresentacion: 212,
    concentracion: '120 mg/5 ml',
    instrucciones: 'Después de comer',
    dosisCantidad: 2.5,
    idUnidadDosis: 222,
    diasSemana: [231, 233],
    horas: ['08:00', '16:00'],
    fechaInicio: '2099-02-01',
    fechaFin: '2099-03-01',
    cantidadInicial: 100,
    cantidadDisponible: 80,
    fechaEstimadaTermino: '2099-02-20',
    modoCalculoTermino: 'MANUAL',
    idResponsablePredeterminado: 301,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    ...datos,
  };
}

interface Opciones {
  plan?: RespuestaPlan;
  detalle?: RespuestaDetallePlan | null;
}

async function configurar(opciones: Opciones = {}) {
  const servicioPlanes = {
    agregarDetalle: vi.fn((_g: number, _p: number, s: unknown) =>
      of(detalle({ idDetallePlan: 99, ...(s as object) })),
    ),
    actualizarDetalle: vi.fn(() => of(detalle())),
  };
  TestBed.configureTestingModule({
    imports: [FormularioDetalle],
    providers: [
      { provide: ServicioPlanes, useValue: servicioPlanes },
      { provide: ServicioMedicamentos, useValue: { buscar: vi.fn(() => of([])), crear: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(FormularioDetalle);
  fixture.componentRef.setInput('idGrupo', 1);
  fixture.componentRef.setInput('plan', opciones.plan ?? plan());
  fixture.componentRef.setInput('detalle', opciones.detalle ?? null);
  fixture.componentRef.setInput('presentaciones', PRESENTACIONES);
  fixture.componentRef.setInput('unidades', UNIDADES);
  fixture.componentRef.setInput('dias', DIAS);
  fixture.componentRef.setInput('integrantes', INTEGRANTES);
  const guardados: RespuestaDetallePlan[] = [];
  let cancelados = 0;
  fixture.componentInstance.guardado.subscribe((d) => guardados.push(d));
  fixture.componentInstance.cancelado.subscribe(() => cancelados++);
  await fixture.whenStable();
  return {
    fixture,
    servicioPlanes,
    guardados,
    cancelados: () => cancelados,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

type Fixture = Awaited<ReturnType<typeof configurar>>['fixture'];

function porId<T extends HTMLElement>(elemento: HTMLElement, id: string): T {
  const encontrado = elemento.querySelector<T>(`#${id}`);
  if (!encontrado) throw new Error(`Sin #${id}`);
  return encontrado;
}

function escribir(input: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function elegirOpcion(select: HTMLSelectElement, texto: string): void {
  const indice = Array.from(select.options).findIndex((o) => o.textContent?.trim() === texto);
  if (indice < 0) throw new Error(`Sin opción "${texto}"`);
  select.selectedIndex = indice;
  select.dispatchEvent(new Event('change'));
}

function casilla(elemento: HTMLElement, texto: string): HTMLInputElement {
  const label = Array.from(elemento.querySelectorAll('label')).find(
    (l) => l.textContent?.trim() === texto,
  );
  if (!label) throw new Error(`Sin casilla "${texto}"`);
  return label.querySelector('input')!;
}

function campoHora(elemento: HTMLElement, etiqueta: string): HTMLInputElement {
  const label = Array.from(elemento.querySelectorAll('label')).find(
    (l) => l.textContent?.trim() === etiqueta,
  )!;
  return elemento.querySelector<HTMLInputElement>(`#${CSS.escape(label.getAttribute('for')!)}`)!;
}

async function elegirMedicamento(fixture: Fixture, medicamento: RespuestaMedicamento) {
  const buscador = fixture.debugElement.query(By.directive(BuscadorMedicamento));
  (buscador.componentInstance as BuscadorMedicamento).elegido.emit(medicamento);
  await fixture.whenStable();
}

async function enviar(fixture: Fixture, elemento: HTMLElement) {
  elemento.querySelector<HTMLFormElement>('form.detalle')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

/** Completa todo salvo los días. */
async function llenarSinDias(fixture: Fixture, elemento: HTMLElement) {
  await elegirMedicamento(fixture, PARACETAMOL);
  escribir(porId(elemento, 'detalle-dosis'), '1.5');
  elegirOpcion(porId(elemento, 'detalle-unidad'), 'comprimido(s)');
  escribir(campoHora(elemento, 'Hora 1'), '08:00');
  await fixture.whenStable();
}

describe('FormularioDetalle', () => {
  it('enviaElDetalleCompleto', async () => {
    const { fixture, elemento, servicioPlanes, guardados } = await configurar();

    expect(elemento.textContent).toContain(AVISO);
    await elegirMedicamento(fixture, PARACETAMOL);
    expect(elemento.textContent).toContain('Paracetamol');
    expect(
      porId<HTMLSelectElement>(
        elemento,
        'detalle-presentacion',
      ).selectedOptions[0].textContent?.trim(),
    ).toBe('Comprimido');
    expect(porId<HTMLInputElement>(elemento, 'detalle-concentracion').value).toBe('500 mg');
    expect(porId<HTMLInputElement>(elemento, 'detalle-dosis').getAttribute('step')).toBe('0.001');

    escribir(porId(elemento, 'detalle-dosis'), '1.5');
    elegirOpcion(porId(elemento, 'detalle-unidad'), 'comprimido(s)');
    casilla(elemento, 'Lunes').click();
    casilla(elemento, 'Viernes').click();
    escribir(campoHora(elemento, 'Hora 1'), '08:00');
    await fixture.whenStable();
    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Agregar hora')!
      .click();
    await fixture.whenStable();
    escribir(campoHora(elemento, 'Hora 2'), '20:00');
    expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2099-01-01');
    escribir(porId(elemento, 'detalle-hasta'), '2099-06-30');
    escribir(porId(elemento, 'detalle-cantidad-inicial'), '30');
    escribir(porId(elemento, 'detalle-cantidad-disponible'), '20');
    elegirOpcion(porId(elemento, 'detalle-responsable'), 'Ana Rojas');
    escribir(porId(elemento, 'detalle-instrucciones'), '  Con comida  ');
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Cantidad inicial (en comprimido(s))');
    expect(elemento.textContent).toContain('Cantidad disponible (en comprimido(s))');

    await enviar(fixture, elemento);

    expect(servicioPlanes.agregarDetalle).toHaveBeenCalledTimes(1);
    expect(servicioPlanes.agregarDetalle).toHaveBeenCalledWith(1, 7, {
      idMedicamento: 500,
      idPresentacion: 211,
      concentracion: '500 mg',
      instrucciones: 'Con comida',
      dosisCantidad: 1.5,
      idUnidadDosis: 221,
      diasSemana: [231, 235],
      horario: { version: 1, tipo: 'HORAS_FIJAS', horas: ['08:00', '20:00'] },
      fechaInicio: '2099-01-01',
      fechaFin: '2099-06-30',
      cantidadInicial: 30,
      cantidadDisponible: 20,
      modoCalculoTermino: 'AUTOMATICO',
      fechaEstimadaTermino: null,
      idResponsablePredeterminado: 300,
    });
    expect(guardados.map((d) => d.idDetallePlan)).toEqual([99]);
  });

  it('sinDiasNoEnvia', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar();
    await llenarSinDias(fixture, elemento);

    await enviar(fixture, elemento);

    expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();
    expect(elemento.querySelector('#detalle-dias-error')?.textContent).toContain(
      'Selecciona al menos un día',
    );

    casilla(elemento, 'Todos los días').click();
    await fixture.whenStable();
    expect(NOMBRES_DIAS.every((dia) => casilla(elemento, dia).checked)).toBe(true);
    await enviar(fixture, elemento);
    expect(servicioPlanes.agregarDetalle).toHaveBeenCalledTimes(1);
    expect(servicioPlanes.agregarDetalle.mock.calls[0][2]).toMatchObject({
      diasSemana: [231, 232, 233, 234, 235, 236, 237],
    });
  });

  it('horarioInvalidoNoEnvia', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar();
    await elegirMedicamento(fixture, PARACETAMOL);
    escribir(porId(elemento, 'detalle-dosis'), '1');
    elegirOpcion(porId(elemento, 'detalle-unidad'), 'comprimido(s)');
    casilla(elemento, 'Todos los días').click();
    await fixture.whenStable();

    await enviar(fixture, elemento);

    expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();
    expect(elemento.querySelector('app-selector-horario [role="alert"]')?.textContent).toContain(
      'Indica al menos una hora',
    );
  });

  it('terminoManualPideFecha', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar();
    await llenarSinDias(fixture, elemento);
    casilla(elemento, 'Todos los días').click();
    expect(elemento.querySelector('#detalle-fecha-termino')).toBeNull();
    casilla(elemento, 'Indicar manualmente').click();
    await fixture.whenStable();

    await enviar(fixture, elemento);

    expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();
    expect(elemento.querySelector('#detalle-fechaEstimadaTermino-error')?.textContent).toContain(
      'Indica la fecha estimada de término',
    );

    escribir(porId(elemento, 'detalle-fecha-termino'), '2099-05-10');
    await fixture.whenStable();
    await enviar(fixture, elemento);
    expect(servicioPlanes.agregarDetalle.mock.calls[0][2]).toMatchObject({
      modoCalculoTermino: 'MANUAL',
      fechaEstimadaTermino: '2099-05-10',
    });
  });

  it('muestraElErrorDeVigenciaDeLaApi', async () => {
    const { fixture, elemento, servicioPlanes, guardados } = await configurar();
    const mensaje = 'La vigencia del medicamento debe estar dentro de la vigencia del plan';
    servicioPlanes.agregarDetalle.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: mensaje } })) as never,
    );
    await llenarSinDias(fixture, elemento);
    casilla(elemento, 'Todos los días').click();
    await fixture.whenStable();

    await enviar(fixture, elemento);

    const alertas = Array.from(elemento.querySelectorAll('[role="alert"]')).map(
      (a) => a.textContent,
    );
    expect(alertas.some((texto) => texto?.includes(mensaje))).toBe(true);
    expect(guardados).toEqual([]);
  });

  it('muestraLosErroresDeCampoDeLaApi', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar();
    servicioPlanes.agregarDetalle.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              detail: 'Datos no válidos',
              errores: [{ campo: 'dosisCantidad', mensaje: 'Máximo 3 decimales' }],
            },
          }),
      ) as never,
    );
    await llenarSinDias(fixture, elemento);
    casilla(elemento, 'Todos los días').click();
    await fixture.whenStable();

    await enviar(fixture, elemento);

    expect(elemento.querySelector('#detalle-dosisCantidad-error')?.textContent).toContain(
      'Máximo 3 decimales',
    );
    expect(porId(elemento, 'detalle-dosis').getAttribute('aria-describedby')).toBe(
      'detalle-dosisCantidad-error',
    );
  });

  it('editarPrecargaLosDatos', async () => {
    const { fixture, elemento, servicioPlanes, cancelados } = await configurar({
      detalle: detalle(),
    });

    expect(elemento.textContent).toContain('Paracetamol');
    expect(
      porId<HTMLSelectElement>(
        elemento,
        'detalle-presentacion',
      ).selectedOptions[0].textContent?.trim(),
    ).toBe('Jarabe');
    expect(porId<HTMLInputElement>(elemento, 'detalle-concentracion').value).toBe('120 mg/5 ml');
    expect(porId<HTMLInputElement>(elemento, 'detalle-dosis').value).toBe('2.5');
    expect(
      porId<HTMLSelectElement>(elemento, 'detalle-unidad').selectedOptions[0].textContent?.trim(),
    ).toBe('ml');
    expect(casilla(elemento, 'Lunes').checked).toBe(true);
    expect(casilla(elemento, 'Martes').checked).toBe(false);
    expect(casilla(elemento, 'Miércoles').checked).toBe(true);
    expect(casilla(elemento, 'Intervalo').checked).toBe(true);
    expect(elemento.textContent).toContain('Se administrará a las: 08:00 · 16:00');
    expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2099-02-01');
    expect(porId<HTMLInputElement>(elemento, 'detalle-hasta').value).toBe('2099-03-01');
    expect(casilla(elemento, 'Indicar manualmente').checked).toBe(true);
    expect(porId<HTMLInputElement>(elemento, 'detalle-fecha-termino').value).toBe('2099-02-20');
    expect(
      porId<HTMLSelectElement>(
        elemento,
        'detalle-responsable',
      ).selectedOptions[0].textContent?.trim(),
    ).toBe('Luis Rojas');
    expect(porId<HTMLTextAreaElement>(elemento, 'detalle-instrucciones').value).toBe(
      'Después de comer',
    );
    expect(elemento.textContent).toContain('Cantidad disponible (en ml)');

    await enviar(fixture, elemento);

    expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();
    expect(servicioPlanes.actualizarDetalle).toHaveBeenCalledWith(1, 7, 55, {
      idMedicamento: 500,
      idPresentacion: 212,
      concentracion: '120 mg/5 ml',
      instrucciones: 'Después de comer',
      dosisCantidad: 2.5,
      idUnidadDosis: 222,
      diasSemana: [231, 233],
      horario: {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '16:00',
        frecuencia_horas: 8,
      },
      fechaInicio: '2099-02-01',
      fechaFin: '2099-03-01',
      cantidadInicial: 100,
      cantidadDisponible: 80,
      modoCalculoTermino: 'MANUAL',
      fechaEstimadaTermino: '2099-02-20',
      idResponsablePredeterminado: 301,
    });

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Cancelar')!
      .click();
    expect(cancelados()).toBe(1);
  });

  describe('Desde por defecto', () => {
    afterEach(() => vi.useRealTimers());

    it('esHoyEnChileCuandoElPlanEmpezoAntes', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      // 02:00 UTC del 1 de marzo = 23:00 del 28 de febrero en Santiago (UTC-3).
      vi.setSystemTime(new Date('2026-03-01T02:00:00Z'));
      const { elemento } = await configurar({ plan: plan({ vigenteDesde: '2026-01-01' }) });

      expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2026-02-28');
    });

    it('hastaPorDefectoEsLaVigenciaHastaDelPlan', async () => {
      const { elemento } = await configurar({
        plan: plan({ vigenteDesde: '2026-01-01', vigenteHasta: '2026-06-30' }),
      });

      expect(porId<HTMLInputElement>(elemento, 'detalle-hasta').value).toBe('2026-06-30');
    });

    it('desdePorDefectoNuncaQuedaDespuesDeLaVigenciaHastaDelPlan', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
      const { elemento } = await configurar({
        plan: plan({ vigenteDesde: '2026-01-01', vigenteHasta: '2026-06-30' }),
      });

      expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2026-06-30');
    });
  });

  describe('Responsable anterior ya no es integrante activo', () => {
    const MENSAJE =
      'El responsable anterior ya no es integrante activo del grupo; elige otro o deja sin responsable.';

    it('limpiaElControlYMuestraElAviso', async () => {
      const { elemento } = await configurar({
        detalle: detalle({ idResponsablePredeterminado: 999 }),
      });

      const aviso = elemento.querySelector('#detalle-responsable-anterior');
      expect(aviso?.getAttribute('role')).toBe('status');
      expect(aviso?.textContent).toContain(MENSAJE);
      expect(
        porId<HTMLSelectElement>(elemento, 'detalle-responsable').selectedOptions[0].textContent?.trim(),
      ).toBe('Sin responsable');
    });

    it('noMuestraElAvisoCuandoElResponsableSigueActivo', async () => {
      const { elemento } = await configurar({ detalle: detalle() });

      expect(elemento.querySelector('#detalle-responsable-anterior')).toBeNull();
      expect(
        porId<HTMLSelectElement>(elemento, 'detalle-responsable').selectedOptions[0].textContent?.trim(),
      ).toBe('Luis Rojas');
    });

    it('noMuestraElAvisoCuandoElDetalleNoTeniaResponsable', async () => {
      const { elemento } = await configurar({
        detalle: detalle({ idResponsablePredeterminado: null }),
      });

      expect(elemento.querySelector('#detalle-responsable-anterior')).toBeNull();
    });
  });
});
