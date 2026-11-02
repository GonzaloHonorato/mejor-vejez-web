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

function boton(elemento: HTMLElement, texto: string): HTMLButtonElement {
  const encontrado = Array.from(elemento.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  );
  if (!encontrado) throw new Error(`Sin botón "${texto}"`);
  return encontrado;
}

async function pasarAAvanzado(fixture: Fixture, elemento: HTMLElement) {
  boton(elemento, 'Configurar con opciones avanzadas').click();
  await fixture.whenStable();
}

/**
 * Pasa a avanzado y deja días y horas en blanco, como el formulario avanzado
 * antes del modo simple (al pasar se precargan todos los días y las horas
 * calculadas). Las pruebas que llenan el avanzado desde cero parten de aquí.
 */
async function pasarAAvanzadoEnBlanco(fixture: Fixture, elemento: HTMLElement) {
  await pasarAAvanzado(fixture, elemento);
  casilla(elemento, 'Todos los días').click();
  await fixture.whenStable();
  while (elemento.querySelector('[aria-label="Quitar hora 2"]')) {
    elemento.querySelector<HTMLButtonElement>('[aria-label="Quitar hora 2"]')!.click();
    await fixture.whenStable();
  }
  escribir(campoHora(elemento, 'Hora 1'), '');
  await fixture.whenStable();
}

/** Completa todo salvo los días. */
async function llenarSinDias(fixture: Fixture, elemento: HTMLElement) {
  await pasarAAvanzadoEnBlanco(fixture, elemento);
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

    await pasarAAvanzadoEnBlanco(fixture, elemento);
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
    await pasarAAvanzadoEnBlanco(fixture, elemento);
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
      // Al 28 de junio, los 7 días por defecto se recortan a 3 para no pasar
      // del fin del plan: el "Hasta" que se precarga en avanzado es su término.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));
      const { fixture, elemento } = await configurar({
        plan: plan({ vigenteDesde: '2026-01-01', vigenteHasta: '2026-06-30' }),
      });
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('3');
      await pasarAAvanzado(fixture, elemento);

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

  describe('Modo simple', () => {
    afterEach(() => vi.useRealTimers());

    const TODOS = [231, 232, 233, 234, 235, 236, 237];

    async function llenarMedicamento(fixture: Fixture, elemento: HTMLElement) {
      await elegirMedicamento(fixture, PARACETAMOL);
      escribir(porId(elemento, 'detalle-dosis'), '1');
      elegirOpcion(porId(elemento, 'detalle-unidad'), 'comprimido(s)');
      await fixture.whenStable();
    }

    function resumen(elemento: HTMLElement): string {
      return elemento.querySelector('[aria-live="polite"].resumen')?.textContent?.trim() ?? '';
    }

    function textoElegido(select: HTMLSelectElement): string | undefined {
      return select.selectedOptions[0]?.textContent?.trim();
    }

    it('alAgregarAbreEnSimpleConLosValoresPorDefecto', async () => {
      const { elemento } = await configurar();

      expect(porId<HTMLInputElement>(elemento, 'detalle-primera-toma').value).toBe('08:00');
      expect(textoElegido(porId(elemento, 'detalle-cada'))).toBe('8 horas');
      expect(
        Array.from(porId<HTMLSelectElement>(elemento, 'detalle-cada').options).map((o) =>
          o.textContent?.trim(),
        ),
      ).toEqual(['4 horas', '6 horas', '8 horas', '12 horas', '24 horas']);
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('7');
      expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2099-01-01');
      // Los datos del medicamento siguen visibles; lo avanzado, no.
      expect(elemento.querySelector('#detalle-presentacion')).not.toBeNull();
      expect(elemento.querySelector('#detalle-dosis')).not.toBeNull();
      expect(elemento.querySelector('app-selector-horario')).toBeNull();
      expect(elemento.querySelector('#detalle-hasta')).toBeNull();
      expect(elemento.querySelector('#detalle-responsable')).toBeNull();
      expect(boton(elemento, 'Configurar con opciones avanzadas').className).toContain(
        'mv-boton--texto',
      );
    });

    it('muestraElResumenEnVivo', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
      const { fixture, elemento } = await configurar({
        plan: plan({ vigenteDesde: '2026-01-01' }),
      });

      expect(resumen(elemento)).toBe(
        'Se tomará a las 08:00, 16:00 y 00:00, todos los días, del lun 2 nov al dom 8 nov 2026 (7 días).',
      );

      elegirOpcion(porId(elemento, 'detalle-cada'), '12 horas');
      escribir(porId(elemento, 'detalle-primera-toma'), '09:00');
      escribir(porId(elemento, 'detalle-durante'), '3');
      await fixture.whenStable();
      expect(resumen(elemento)).toBe(
        'Se tomará a las 09:00 y 21:00, todos los días, del lun 2 nov al mié 4 nov 2026 (3 días).',
      );

      escribir(porId(elemento, 'detalle-durante'), '');
      await fixture.whenStable();
      expect(resumen(elemento)).toBe('');
    });

    it('enviaHorasFijasTodosLosDiasYLaFechaDeFin', async () => {
      const { fixture, elemento, servicioPlanes, guardados } = await configurar();
      await llenarMedicamento(fixture, elemento);

      await enviar(fixture, elemento);

      expect(servicioPlanes.agregarDetalle).toHaveBeenCalledWith(1, 7, {
        idMedicamento: 500,
        idPresentacion: 211,
        concentracion: '500 mg',
        instrucciones: null,
        dosisCantidad: 1,
        idUnidadDosis: 221,
        diasSemana: TODOS,
        horario: { version: 1, tipo: 'HORAS_FIJAS', horas: ['00:00', '08:00', '16:00'] },
        fechaInicio: '2099-01-01',
        fechaFin: '2099-01-07',
        cantidadInicial: null,
        cantidadDisponible: null,
        modoCalculoTermino: 'AUTOMATICO',
        fechaEstimadaTermino: null,
        idResponsablePredeterminado: null,
      });
      expect(guardados.map((d) => d.idDetallePlan)).toEqual([99]);
    });

    it('validaLosCamposSimples', async () => {
      const { fixture, elemento, servicioPlanes } = await configurar({
        plan: plan({ vigenteDesde: '2099-01-01', vigenteHasta: '2099-01-10' }),
      });
      await llenarMedicamento(fixture, elemento);
      escribir(porId(elemento, 'detalle-primera-toma'), '');
      escribir(porId(elemento, 'detalle-durante'), '0');
      await fixture.whenStable();

      await enviar(fixture, elemento);

      expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();
      expect(porId(elemento, 'detalle-primeraToma-error').textContent).toContain(
        'Indica la hora de la primera toma',
      );
      expect(porId(elemento, 'detalle-primera-toma').getAttribute('aria-describedby')).toBe(
        'detalle-primeraToma-error',
      );
      expect(porId(elemento, 'detalle-durante-error').textContent).toContain(
        'Indica un número entero de días entre 1 y 365',
      );

      escribir(porId(elemento, 'detalle-primera-toma'), '08:00');
      escribir(porId(elemento, 'detalle-durante'), '2.5');
      await fixture.whenStable();
      expect(porId(elemento, 'detalle-durante-error').textContent).toContain('entre 1 y 365');

      // Termina después del fin del plan (10 ene).
      escribir(porId(elemento, 'detalle-durante'), '11');
      await fixture.whenStable();
      expect(porId(elemento, 'detalle-durante-error').textContent).toContain(
        'termina después del fin del plan (10 ene 2099)',
      );

      // "Desde" antes del inicio del plan.
      escribir(porId(elemento, 'detalle-durante'), '5');
      escribir(porId(elemento, 'detalle-desde'), '2098-12-31');
      await fixture.whenStable();
      expect(porId(elemento, 'detalle-fechaInicio-error').textContent).toContain(
        'dentro de la vigencia del plan',
      );
      await enviar(fixture, elemento);
      expect(servicioPlanes.agregarDetalle).not.toHaveBeenCalled();

      escribir(porId(elemento, 'detalle-desde'), '2099-01-02');
      await fixture.whenStable();
      await enviar(fixture, elemento);
      expect(servicioPlanes.agregarDetalle.mock.calls[0][2]).toMatchObject({
        fechaInicio: '2099-01-02',
        fechaFin: '2099-01-06',
      });
    });

    it('muestraLosErroresDeLaApiEnLosCamposSimples', async () => {
      const { fixture, elemento, servicioPlanes } = await configurar();
      servicioPlanes.agregarDetalle.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                detail: 'Datos no válidos',
                errores: [
                  { campo: 'fechaInicio', mensaje: 'Fecha no válida' },
                  { campo: 'fechaFin', mensaje: 'Fin no válido' },
                ],
              },
            }),
        ) as never,
      );
      await llenarMedicamento(fixture, elemento);

      await enviar(fixture, elemento);

      expect(porId(elemento, 'detalle-fechaInicio-error').textContent).toContain('Fecha no válida');
      expect(porId(elemento, 'detalle-durante-error').textContent).toContain('Fin no válido');
    });

    it('idaYVueltaEntreSimpleYAvanzado', async () => {
      const { fixture, elemento, servicioPlanes } = await configurar();
      await llenarMedicamento(fixture, elemento);
      escribir(porId(elemento, 'detalle-primera-toma'), '09:00');
      elegirOpcion(porId(elemento, 'detalle-cada'), '12 horas');
      escribir(porId(elemento, 'detalle-durante'), '10');
      await fixture.whenStable();

      await pasarAAvanzado(fixture, elemento);

      expect(NOMBRES_DIAS.every((dia) => casilla(elemento, dia).checked)).toBe(true);
      expect(casilla(elemento, 'Horas fijas').checked).toBe(true);
      expect(campoHora(elemento, 'Hora 1').value).toBe('09:00');
      expect(campoHora(elemento, 'Hora 2').value).toBe('21:00');
      expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2099-01-01');
      expect(porId<HTMLInputElement>(elemento, 'detalle-hasta').value).toBe('2099-01-10');
      expect(elemento.querySelector('#detalle-primera-toma')).toBeNull();

      boton(elemento, 'Volver a la configuración simple').click();
      await fixture.whenStable();

      expect(porId<HTMLInputElement>(elemento, 'detalle-primera-toma').value).toBe('09:00');
      expect(textoElegido(porId(elemento, 'detalle-cada'))).toBe('12 horas');
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('10');

      // Un cambio en avanzado que se puede expresar en simple vuelve traducido,
      // con la primera toma por la regla (primera hora desde las 06:00).
      await pasarAAvanzado(fixture, elemento);
      escribir(porId(elemento, 'detalle-hasta'), '2099-01-03');
      escribir(campoHora(elemento, 'Hora 1'), '22:00');
      escribir(campoHora(elemento, 'Hora 2'), '10:00');
      await fixture.whenStable();
      boton(elemento, 'Volver a la configuración simple').click();
      await fixture.whenStable();
      expect(porId<HTMLInputElement>(elemento, 'detalle-primera-toma').value).toBe('10:00');
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('3');

      await enviar(fixture, elemento);
      expect(servicioPlanes.agregarDetalle.mock.calls[0][2]).toMatchObject({
        diasSemana: TODOS,
        horario: { version: 1, tipo: 'HORAS_FIJAS', horas: ['10:00', '22:00'] },
        fechaInicio: '2099-01-01',
        fechaFin: '2099-01-03',
      });
    });

    it('noVuelveASimpleSiLaConfiguracionNoSePuedeExpresar', async () => {
      const { fixture, elemento } = await configurar();
      await pasarAAvanzado(fixture, elemento);
      const volver = boton(elemento, 'Volver a la configuración simple');
      expect(volver.disabled).toBe(false);

      casilla(elemento, 'Lunes').click();
      await fixture.whenStable();

      expect(volver.disabled).toBe(true);
      expect(volver.getAttribute('aria-describedby')).toBe('detalle-solo-avanzado');
      expect(porId(elemento, 'detalle-solo-avanzado').textContent).toContain(
        'Esta configuración solo se puede editar en modo avanzado',
      );

      casilla(elemento, 'Lunes').click();
      escribir(porId(elemento, 'detalle-hasta'), '');
      await fixture.whenStable();
      expect(volver.disabled).toBe(true);

      escribir(porId(elemento, 'detalle-hasta'), '2099-01-07');
      escribir(campoHora(elemento, 'Hora 1'), '07:00');
      await fixture.whenStable();
      expect(volver.disabled).toBe(true);
      expect(elemento.querySelector('#detalle-solo-avanzado')).not.toBeNull();
    });

    it('elFocoVaAlPrimerCampoDelModoNuevo', async () => {
      const { fixture, elemento } = await configurar();

      await pasarAAvanzado(fixture, elemento);
      expect(document.activeElement).toBe(porId(elemento, 'detalle-todos-dias'));

      boton(elemento, 'Volver a la configuración simple').click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(porId(elemento, 'detalle-primera-toma'));
    });

    it('editarExpresableAbreEnSimpleYConservaLoAvanzado', async () => {
      const { fixture, elemento, servicioPlanes } = await configurar({
        detalle: detalle({
          diasSemana: TODOS,
          horas: ['00:00', '08:00', '16:00'],
          fechaInicio: '2099-02-01',
          fechaFin: '2099-02-07',
        }),
      });

      // La primera toma no se guarda: es la primera hora desde las 06:00.
      expect(porId<HTMLInputElement>(elemento, 'detalle-primera-toma').value).toBe('08:00');
      expect(textoElegido(porId(elemento, 'detalle-cada'))).toBe('8 horas');
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('7');
      expect(porId<HTMLInputElement>(elemento, 'detalle-desde').value).toBe('2099-02-01');
      expect(resumen(elemento)).toContain('Se tomará a las 08:00, 16:00 y 00:00, todos los días');
      expect(elemento.querySelector('app-selector-horario')).toBeNull();

      await enviar(fixture, elemento);

      expect(servicioPlanes.actualizarDetalle).toHaveBeenCalledWith(1, 7, 55, {
        idMedicamento: 500,
        idPresentacion: 212,
        concentracion: '120 mg/5 ml',
        instrucciones: 'Después de comer',
        dosisCantidad: 2.5,
        idUnidadDosis: 222,
        diasSemana: TODOS,
        horario: { version: 1, tipo: 'HORAS_FIJAS', horas: ['00:00', '08:00', '16:00'] },
        fechaInicio: '2099-02-01',
        fechaFin: '2099-02-07',
        cantidadInicial: 100,
        cantidadDisponible: 80,
        modoCalculoTermino: 'MANUAL',
        fechaEstimadaTermino: '2099-02-20',
        idResponsablePredeterminado: 301,
      });
    });

    it('editarUnaTomaDiariaAbreEnSimple', async () => {
      const { elemento } = await configurar({
        detalle: detalle({ diasSemana: TODOS, horas: ['09:00'] }),
      });

      expect(textoElegido(porId(elemento, 'detalle-cada'))).toBe('24 horas');
      expect(porId<HTMLInputElement>(elemento, 'detalle-primera-toma').value).toBe('09:00');
      expect(porId<HTMLInputElement>(elemento, 'detalle-durante').value).toBe('29');
    });

    it('editarNoExpresableAbreEnAvanzado', async () => {
      // Sin fecha de fin.
      let { elemento } = await configurar({
        detalle: detalle({ diasSemana: TODOS, horas: ['00:00', '12:00'], fechaFin: null }),
      });
      expect(elemento.querySelector('app-selector-horario')).not.toBeNull();
      expect(elemento.querySelector('#detalle-primera-toma')).toBeNull();
      expect(boton(elemento, 'Volver a la configuración simple').disabled).toBe(true);
      TestBed.resetTestingModule();

      // Horas que no cubren el día parejo (08 y 16).
      ({ elemento } = await configurar({ detalle: detalle({ diasSemana: TODOS }) }));
      expect(elemento.querySelector('app-selector-horario')).not.toBeNull();
      TestBed.resetTestingModule();

      // Días sueltos (el detalle por defecto: lunes y miércoles).
      ({ elemento } = await configurar({
        detalle: detalle({ horas: ['00:00', '12:00'] }),
      }));
      expect(elemento.querySelector('app-selector-horario')).not.toBeNull();
    });
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('FormularioDetalle: desplazamiento y foco', () => {
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

  it('enviarVacioTraeElPrimerErrorALaVista', async () => {
    const { fixture, elemento } = await configurar();

    await enviar(fixture, elemento);

    expect(desplazar).toHaveBeenCalled();
    expect(desplazar.mock.calls[0][0]).toMatchObject({ block: 'center' });
    const desplazado = desplazar.mock.contexts[0] as Element;
    expect(
      desplazado.matches('[aria-invalid="true"], .mv-campo__error, .mv-aviso--error'),
    ).toBe(true);
  });

  /**
   * Cada mensaje de error visible queda enlazado (`aria-describedby`) a un
   * campo marcado con `aria-invalid="true"`.
   */
  function expectErroresEnlazados(elemento: HTMLElement): void {
    const errores = Array.from(elemento.querySelectorAll<HTMLElement>('.mv-campo__error[id]'));
    expect(errores.length).toBeGreaterThan(0);
    for (const error of errores) {
      const campos = Array.from(
        elemento.querySelectorAll(`[aria-describedby~="${error.id}"]`),
      ).filter((campo) => campo.matches('input, select, textarea'));
      expect(campos.length, error.id).toBeGreaterThan(0);
      for (const campo of campos) expect(campo.getAttribute('aria-invalid'), error.id).toBe('true');
    }
  }

  it('avanzadoVacioEnfocaElBuscadorDeMedicamentoMarcadoYEnlazado', async () => {
    const { fixture, elemento } = await configurar();
    await pasarAAvanzadoEnBlanco(fixture, elemento);

    await enviar(fixture, elemento);

    const activo = document.activeElement!;
    expect(activo.id).toBe('buscador-medicamento-texto');
    expect(activo.getAttribute('aria-invalid')).toBe('true');
    expect(activo.getAttribute('aria-describedby')).toBe('detalle-idMedicamento-error');
    expect(bloqueDe(activo)).toBe('center');
    expectErroresEnlazados(elemento);
  });

  it('avanzadoSinDosisEnfocaLaDosis', async () => {
    const { fixture, elemento } = await configurar();
    await elegirMedicamento(fixture, PARACETAMOL);
    await pasarAAvanzadoEnBlanco(fixture, elemento);

    await enviar(fixture, elemento);

    expect(document.activeElement?.id).toBe('detalle-dosis');
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
    expectErroresEnlazados(elemento);
  });

  it('avanzadoSinDiasEnfocaLaPrimeraCasillaDeDias', async () => {
    const { fixture, elemento } = await configurar();
    await llenarSinDias(fixture, elemento);

    await enviar(fixture, elemento);

    const activo = document.activeElement!;
    expect(activo.id).toBe('detalle-todos-dias');
    expect(activo.getAttribute('aria-invalid')).toBe('true');
    expect(activo.getAttribute('aria-describedby')).toBe('detalle-dias-error');
    expectErroresEnlazados(elemento);
  });

  it('avanzadoSinHoraEnfocaLaHora', async () => {
    const { fixture, elemento } = await configurar();
    await llenarSinDias(fixture, elemento);
    casilla(elemento, 'Lunes').click();
    escribir(campoHora(elemento, 'Hora 1'), '');
    await fixture.whenStable();

    await enviar(fixture, elemento);

    const hora = campoHora(elemento, 'Hora 1');
    expect(document.activeElement).toBe(hora);
    expect(hora.getAttribute('aria-invalid')).toBe('true');
    expect(hora.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(hora.getAttribute('aria-describedby')!)).toBeTruthy();
  });
});
