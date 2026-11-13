import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnInit, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Plan } from './plan';
import { FormularioDetalle } from './formulario-detalle/formulario-detalle';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
  TipoCatalogo,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo, RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import {
  RespuestaDetallePlan,
  RespuestaPlan,
  RespuestaPlanDetallado,
} from '../../nucleo/planificacion/modelos-planificacion';
import { ServicioPlanes } from '../../nucleo/planificacion/servicio-planes';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Reemplaza al `FormularioDetalle` real: esta página no prueba su
 * formulario interno. `instancias` registra, en orden, el `detalle` recibido
 * en CADA montaje (cada `ngOnInit`): permite comprobar que cambiar de
 * detalle en edición remonta el componente.
 */
@Component({
  selector: 'app-formulario-detalle',
  template: '<form><select id="detalle-presentacion"></select><input id="detalle-dosis" /></form>',
})
class FormularioDetalleFalso implements OnInit {
  static instancias: Array<RespuestaDetallePlan | null | undefined> = [];

  @Input() idGrupo?: number;
  @Input() plan?: RespuestaPlan;
  @Input() detalle?: RespuestaDetallePlan | null;
  @Input() presentaciones?: RespuestaOpcionCatalogo[];
  @Input() unidades?: RespuestaOpcionCatalogo[];
  @Input() dias?: RespuestaOpcionCatalogo[];
  @Input() integrantes?: RespuestaIntegrante[];
  @Input() idUsuarioActual?: number | null;
  readonly guardado = output<RespuestaDetallePlan>();
  readonly cancelado = output<void>();

  ngOnInit(): void {
    FormularioDetalleFalso.instancias.push(this.detalle);
  }
}

const ESTADOS_PLAN: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

const ESTADOS_DETALLE: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

const ESTADOS_INTEGRANTE: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

const PRESENTACIONES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 1, codigo: 'COMPRIMIDO', descripcion: 'Comprimidos', orden: 1 },
];

const UNIDADES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 1, codigo: 'COMPRIMIDO', descripcion: 'Comprimido', orden: 1 },
];

const DIAS: RespuestaOpcionCatalogo[] = [
  { idOpcion: 1, codigo: 'LUNES', descripcion: 'Lunes', orden: 1 },
  { idOpcion: 2, codigo: 'MARTES', descripcion: 'Martes', orden: 2 },
  { idOpcion: 3, codigo: 'MIERCOLES', descripcion: 'Miércoles', orden: 3 },
  { idOpcion: 4, codigo: 'JUEVES', descripcion: 'Jueves', orden: 4 },
  { idOpcion: 5, codigo: 'VIERNES', descripcion: 'Viernes', orden: 5 },
  { idOpcion: 6, codigo: 'SABADO', descripcion: 'Sábado', orden: 6 },
  { idOpcion: 7, codigo: 'DOMINGO', descripcion: 'Domingo', orden: 7 },
];

function grupo(idGrupo: number, miRol: string | null): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo: 'Familia Rojas',
    notificaCoordinador: true,
    idEstado: 1,
    miRol,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function plan(datos: Partial<RespuestaPlan> = {}): RespuestaPlan {
  return {
    idPlan: 10,
    idGrupo: 1,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    nombrePlan: 'Plan diario',
    vigenteDesde: '2026-01-01',
    vigenteHasta: null,
    idEstado: 1,
    medicamentosActivos: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    ...datos,
  };
}

function detalle(datos: Partial<RespuestaDetallePlan> = {}): RespuestaDetallePlan {
  return {
    idDetallePlan: 100,
    idPlan: 10,
    idMedicamento: 5,
    nombreMedicamento: 'Paracetamol',
    idPresentacion: 1,
    concentracion: '500 mg',
    instrucciones: null,
    dosisCantidad: 1,
    idUnidadDosis: 1,
    diasSemana: [1, 2, 3, 4, 5, 6, 7],
    horas: ['08:00', '16:00'],
    fechaInicio: '2026-01-01',
    fechaFin: null,
    cantidadInicial: 30,
    cantidadDisponible: 20,
    fechaEstimadaTermino: '2026-02-01',
    modoCalculoTermino: 'AUTOMATICO',
    idResponsablePredeterminado: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    ...datos,
  };
}

function integrante(datos: Partial<RespuestaIntegrante> = {}): RespuestaIntegrante {
  return {
    idIntegrante: 1,
    idUsuario: 1,
    nombre: 'Ana',
    email: 'ana@correo.cl',
    idRol: 1,
    nombreRol: 'COORDINADOR',
    idEstado: 1,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: null,
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  obtenerImpl?: (idGrupo: number, idPlan: number) => Observable<RespuestaPlanDetallado>;
  esAdministrador?: boolean;
  integrantes?: RespuestaIntegrante[];
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioPlanes = {
    obtener: vi.fn(
      opciones.obtenerImpl ?? (() => of({ plan: plan(), detalles: [detalle()] })),
    ),
    actualizar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
    eliminar: vi.fn(),
    agregarDetalle: vi.fn(),
    actualizarDetalle: vi.fn(),
    actualizarCantidad: vi.fn(() => of(detalle())),
    desactivarDetalle: vi.fn(() => of(detalle())),
    reactivarDetalle: vi.fn(() => of(detalle())),
    eliminarDetalle: vi.fn(() => of(undefined)),
  };
  const servicioCatalogos = {
    estados: vi.fn((tabla: string) => {
      if (tabla === 'PLAN_MEDICAMENTOS') return of(ESTADOS_PLAN);
      if (tabla === 'DETALLE_PLAN') return of(ESTADOS_DETALLE);
      if (tabla === 'INTEGRANTE_GRUPO') return of(ESTADOS_INTEGRANTE);
      return of([]);
    }),
    opciones: vi.fn((tipo: TipoCatalogo) => {
      if (tipo === 'PRESENTACION_MEDICAMENTO') return of(PRESENTACIONES);
      if (tipo === 'UNIDAD_DOSIS') return of(UNIDADES);
      if (tipo === 'DIA_SEMANA') return of(DIAS);
      return of([]);
    }),
  };
  const servicioGrupos = {
    integrantes: vi.fn(() => of(opciones.integrantes ?? [integrante()])),
  };

  TestBed.configureTestingModule({
    imports: [Plan],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ idPlan: '10' }) } },
      },
      { provide: ServicioPlanes, useValue: servicioPlanes },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      { provide: ServicioGrupos, useValue: servicioGrupos },
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({
              idUsuario: 1,
              nombre: 'Ana',
              email: 'ana@correo.cl',
              telefono: null,
              esAdministrador: opciones.esAdministrador ?? false,
            }),
        },
      },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
    ],
  })
    .overrideComponent(Plan, {
      remove: { imports: [FormularioDetalle] },
      add: { imports: [FormularioDetalleFalso] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(Plan);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioPlanes,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: ParentNode, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

/** Abre el menú del botón dividido con ese nombre accesible y elige el ítem con ese texto. */
async function elegirEnMenu(
  fixture: { whenStable(): Promise<unknown> },
  elemento: HTMLElement,
  etiquetaMenu: string,
  item: string,
): Promise<void> {
  const segmento = elemento.querySelector<HTMLButtonElement>(`[aria-label="${etiquetaMenu}"]`)!;
  segmento.click();
  await fixture.whenStable();
  const menu = document.getElementById(segmento.getAttribute('aria-controls')!)!;
  Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    .find((b) => b.textContent?.trim() === item)!
    .click();
  await fixture.whenStable();
}

/** Ítems del menú de un botón dividido, por el nombre accesible de su segmento. */
function itemsDelMenu(elemento: HTMLElement, etiquetaMenu: string): string[] {
  const segmento = elemento.querySelector(`[aria-label="${etiquetaMenu}"]`);
  if (!segmento) return [];
  const menu = elemento.querySelector(`#${segmento.getAttribute('aria-controls')}`)!;
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent!.trim());
}

const MENU_PARACETAMOL = 'Más acciones para Paracetamol 500 mg';
const MENU_PLAN = 'Más acciones para el plan Plan diario';

describe('Plan', () => {
  beforeEach(() => {
    FormularioDetalleFalso.instancias = [];
  });

  it('muestraMedicamentosConHorarioReconstruido', async () => {
    const detalleIntervalo = detalle({
      idDetallePlan: 100,
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      horas: ['08:00', '16:00'],
    });
    const detalleFijas = detalle({
      idDetallePlan: 200,
      diasSemana: [1, 3, 5],
      horas: ['09:00', '13:00', '19:00'],
    });
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleIntervalo, detalleFijas] }),
    });

    // Horario reconstruido como INTERVALO (equiespaciado) y como HORAS_FIJAS (no equiespaciado).
    expect(elemento.textContent).toContain('Cada 8 h de 08:00 a 16:00');
    expect(elemento.textContent).toContain('09:00, 13:00 y 19:00');
    // Días: 7/7 -> "Todos los días"; 3/7 -> abreviados.
    expect(elemento.textContent).toContain('Todos los días');
    expect(elemento.textContent).toContain('Lun, Mié, Vie');
    // Dosis con la descripción del catálogo de unidades.
    expect(elemento.textContent).toContain('1 Comprimido');
    // Término estimado formateado.
    expect(elemento.textContent).toContain('Término estimado: 1 feb 2026 (automático)');
  });

  it('horarioQueCubreElDiaSeMuestraDesdeLaPrimeraToma', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        of({
          plan: plan(),
          detalles: [
            detalle({ idDetallePlan: 100, horas: ['00:00', '08:00', '16:00'] }),
            detalle({ idDetallePlan: 200, horas: ['00:00', '08:00', '16:00'], concentracion: null }),
            detalle({ idDetallePlan: 300, horas: ['00:00', '12:00'], concentracion: null }),
          ],
        }),
    });

    expect(elemento.textContent).toContain('Cada 8 h: 08:00, 16:00 y 00:00');
    expect(elemento.textContent).not.toContain('de 00:00 a 16:00');
    // El mismo texto en el nombre accesible cuando el medicamento se repite.
    expect(elemento.querySelector('[aria-label="Editar Paracetamol, Cada 12 h: 12:00 y 00:00"]')).not.toBeNull();
  });

  it('actualizarCantidadLlamaALaApiYRecarga', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    servicioPlanes.obtener.mockClear();
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');

    const campoCantidad = elemento.querySelector<HTMLInputElement>('#detalle-cantidad-100')!;
    campoCantidad.value = '15';
    campoCantidad.dispatchEvent(new Event('input'));
    botonConTexto(elemento, 'Guardar')!.click();
    await fixture.whenStable();

    expect(servicioPlanes.actualizarCantidad).toHaveBeenCalledWith(1, 10, 100, 15);
    // "Recarga": vuelve a pedir el plan tras guardar.
    expect(servicioPlanes.obtener).toHaveBeenCalledWith(1, 10);
  });

  it('cantidadInvalidaNoLlamaALaApiYMuestraMensaje', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');

    const campoCantidad = elemento.querySelector<HTMLInputElement>('#detalle-cantidad-100')!;
    campoCantidad.value = '-5';
    campoCantidad.dispatchEvent(new Event('input'));
    botonConTexto(elemento, 'Guardar')!.click();
    await fixture.whenStable();

    expect(servicioPlanes.actualizarCantidad).not.toHaveBeenCalled();
    const error = elemento.querySelector('#detalle-cantidad-100-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('La cantidad debe ser 0 o mayor');
    expect(campoCantidad.getAttribute('aria-invalid')).toBe('true');
    expect(campoCantidad.getAttribute('aria-describedby')).toBe('detalle-cantidad-100-error');

    // Vaciar el campo (sin valor) también es inválido (Validators.required) y tampoco llama a la API.
    campoCantidad.value = '';
    campoCantidad.dispatchEvent(new Event('input'));
    botonConTexto(elemento, 'Guardar')!.click();
    await fixture.whenStable();
    expect(servicioPlanes.actualizarCantidad).not.toHaveBeenCalled();
  });

  it('recargarResincronizaElCampoDeCantidadConElValorNuevo', async () => {
    const obtener = vi
      .fn()
      .mockReturnValueOnce(of({ plan: plan(), detalles: [detalle({ cantidadDisponible: 20 })] }))
      .mockReturnValue(of({ plan: plan(), detalles: [detalle({ cantidadDisponible: 5 })] }));
    const { fixture, elemento, servicioPlanes } = await configurar({ obtenerImpl: obtener });
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');

    const campoCantidad = elemento.querySelector<HTMLInputElement>('#detalle-cantidad-100')!;
    expect(campoCantidad.value).toBe('20');

    // El usuario escribe un valor pero otra acción (p. ej. "Desactivar" del propio detalle) dispara la recarga.
    campoCantidad.value = '15';
    campoCantidad.dispatchEvent(new Event('input'));
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Desactivar');

    // Tras recargar, el campo muestra el valor fresco de la API (5), nunca el 15 escrito ni el 20 original.
    expect(campoCantidad.value).toBe('5');
    expect(servicioPlanes.desactivarDetalle).toHaveBeenCalledWith(1, 10, 100);
  });

  it('accionesPorDetalleTienenNombreAccesibleUnico', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Paracetamol', concentracion: '1 g' });
    const { fixture, elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleA, detalleB] }),
    });

    const segmentos = Array.from(elemento.querySelectorAll('.medicamento [aria-haspopup="menu"]')).map(
      (b) => b.getAttribute('aria-label'),
    );
    expect(segmentos).toEqual([MENU_PARACETAMOL, 'Más acciones para Paracetamol 1 g']);

    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');
    const botonGuardarCantidad = elemento.querySelector(
      '[aria-label="Guardar cantidad de Paracetamol 500 mg"]',
    );
    expect(botonGuardarCantidad?.textContent).toContain('Guardar');
    expect(
      elemento.querySelector('[aria-label="Cantidad disponible de Paracetamol 500 mg"]'),
    ).toBeTruthy();
  });

  it('medicamentoRepetidoSeDistinguePorHorarioYEstadoEnTodosLosNombres', async () => {
    const activo = detalle({ idDetallePlan: 100, horas: ['08:00'] });
    const inactivo = detalle({ idDetallePlan: 200, horas: ['20:00'], idEstado: 2 });
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [activo, inactivo] }),
    });

    const nombres = (selector: string) =>
      Array.from(elemento.querySelectorAll(`.medicamento ${selector}`)).map((b) => b.getAttribute('aria-label'));
    const segmentos = nombres('.mv-boton-dividido__segmento');
    const principales = nombres('.mv-boton-dividido__principal');

    expect(segmentos).toEqual([
      'Más acciones para Paracetamol 500 mg, 08:00',
      'Más acciones para Paracetamol 500 mg, 20:00 (inactivo)',
    ]);
    expect(principales).toEqual(['Editar Paracetamol 500 mg, 08:00', 'Reactivar Paracetamol 500 mg, 20:00 (inactivo)']);
    const todos = [...segmentos, ...principales];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('mismoMedicamentoYHorarioActivosSeDistinguePorFechaDeInicio', async () => {
    const primero = detalle({ idDetallePlan: 100, horas: ['08:00'], fechaInicio: '2026-01-01' });
    const segundo = detalle({ idDetallePlan: 200, horas: ['08:00'], fechaInicio: '2026-03-15' });
    const { fixture, elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [primero, segundo] }),
    });

    const segmentos = Array.from(elemento.querySelectorAll('.medicamento .mv-boton-dividido__segmento')).map(
      (b) => b.getAttribute('aria-label'),
    );
    expect(segmentos).toEqual([
      'Más acciones para Paracetamol 500 mg, 08:00, desde 1 ene 2026',
      'Más acciones para Paracetamol 500 mg, 08:00, desde 15 mar 2026',
    ]);

    await elegirEnMenu(fixture, elemento, segmentos[1]!, 'Registrar cantidad disponible');
    expect(
      elemento.querySelector('[aria-label="Guardar cantidad de Paracetamol 500 mg, 08:00, desde 15 mar 2026"]'),
    ).toBeTruthy();
  });

  it('medicamentosEnGrillaConColumnasYRolesExplicitos', async () => {
    const { elemento } = await configurar({});

    const tabla = elemento.querySelector('.mv-grilla table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    expect(Array.from(tabla.querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual([
      'Medicamento',
      'Dosis',
      'Días',
      'Horario',
      'Vigencia',
      'Disponible',
      'Estado',
      'Acciones',
    ]);
    expect(tabla.querySelector('thead')?.getAttribute('role')).toBe('rowgroup');
    expect(tabla.querySelector('tbody')?.getAttribute('role')).toBe('rowgroup');
    const fila = tabla.querySelector('tbody tr')!;
    expect(fila.getAttribute('role')).toBe('row');
    const celdas = Array.from(fila.querySelectorAll('td'));
    expect(celdas.every((td) => td.getAttribute('role') === 'cell')).toBe(true);
    expect(celdas.map((td) => td.getAttribute('data-etiqueta'))).toEqual([
      null,
      'Dosis',
      'Días',
      'Horario',
      'Vigencia',
      'Disponible',
      'Estado',
      null,
    ]);
    expect(celdas[0].textContent).toContain('Comprimidos');
    expect(celdas[0].textContent).toContain('500 mg');
    expect(celdas[5].textContent).toContain('20 Comprimido');
    expect(celdas[5].textContent).toContain('Término estimado: 1 feb 2026 (automático)');
    expect(elemento.querySelector('details, .mv-mas')).toBeFalsy();
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('colaboradorNoVeLaColumnaDeAcciones', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    const encabezados = Array.from(elemento.querySelectorAll('.mv-grilla th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados).not.toContain('Acciones');
    expect(elemento.querySelector('.mv-grilla app-boton-dividido')).toBeFalsy();
  });

  it('cantidadSeAbreDesdeElMenuSeEnfocaYSeCierra', async () => {
    const { fixture, elemento } = await configurar({});

    expect(elemento.querySelector('#detalle-cantidad-100')).toBeFalsy();
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');

    const campo = elemento.querySelector<HTMLInputElement>('#detalle-cantidad-100')!;
    expect(campo).toBeTruthy();
    expect(campo.closest('tr')?.previousElementSibling?.getAttribute('data-id-detalle')).toBe('100');
    expect(document.activeElement).toBe(campo);

    botonConTexto(elemento, 'Cerrar')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector('#detalle-cantidad-100')).toBeFalsy();
  });

  it('editarMedicamentoEnfocaElPrimerCampoYAlCerrarVuelveAlBotonDeLaFila', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno' });
    const { fixture, elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleA, detalleB] }),
    });
    const filaB = elemento.querySelector('[data-id-detalle="200"]')!;

    botonConTexto(filaB, 'Editar')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(elemento.querySelector('app-formulario-detalle #detalle-presentacion'));

    const formulario = fixture.debugElement.query(By.directive(FormularioDetalleFalso))
      .componentInstance as FormularioDetalleFalso;
    formulario.cancelado.emit();
    await fixture.whenStable();

    expect(elemento.querySelector('app-formulario-detalle')).toBeFalsy();
    expect(document.activeElement).toBe(
      elemento.querySelector('[data-id-detalle="200"] .mv-boton-dividido__principal'),
    );
  });

  it('elBotonPrincipalDeCadaMedicamentoTieneNombreUnico', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        of({
          plan: plan(),
          detalles: [
            detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' }),
            detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno', concentracion: null }),
          ],
        }),
    });
    const principales = Array.from(
      elemento.querySelectorAll<HTMLButtonElement>('.medicamento .mv-boton-dividido__principal'),
    );

    expect(principales.map((b) => b.textContent?.trim())).toEqual(['Editar', 'Editar']);
    expect(principales.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar Paracetamol 500 mg',
      'Editar Ibuprofeno',
    ]);
    const principalPlan = elemento.querySelector('[aria-labelledby="plan-datos-titulo"] .mv-boton-dividido__principal');
    expect(principalPlan?.getAttribute('aria-label')).toBe('Editar plan Plan diario');
  });

  it('elegirEliminarDetalleConfirmaYLlamaALaApi', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Eliminar');

    expect(confirmar).toHaveBeenCalledWith('Solo si fue creado por error. Si tiene historial, desactívalo.');
    expect(servicioPlanes.eliminarDetalle).toHaveBeenCalledWith(1, 10, 100);
    confirmar.mockRestore();
  });

  it('datosDelPlanMuestranMedicamentosActivos', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        of({ plan: plan(), detalles: [detalle(), detalle({ idDetallePlan: 200, idEstado: 2 })] }),
    });
    const datos = elemento.querySelector('[aria-labelledby="plan-datos-titulo"]')!;

    expect(datos.textContent).toContain('Medicamentos activos');
    expect(datos.textContent).toContain('1 de 2');
  });

  it('cambiarDeDetalleEnEdicionRemontaElFormulario', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno' });
    const { fixture, elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleA, detalleB] }),
    });
    const [filaA, filaB] = Array.from(elemento.querySelectorAll('.medicamento'));

    botonConTexto(filaA, 'Editar')!.click();
    await fixture.whenStable();

    expect(FormularioDetalleFalso.instancias).toHaveLength(1);
    expect(FormularioDetalleFalso.instancias[0]?.idDetallePlan).toBe(100);

    botonConTexto(filaB, 'Editar')!.click();
    await fixture.whenStable();

    // Cambiar de detalle en edición remonta el formulario: segundo ngOnInit, con el detalle B.
    expect(FormularioDetalleFalso.instancias).toHaveLength(2);
    expect(FormularioDetalleFalso.instancias[1]?.idDetallePlan).toBe(200);
  });

  it('planInactivoNoPermiteEditarMedicamentos', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan({ idEstado: 2 }), detalles: [detalle()] }),
    });

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'Este plan está inactivo.',
    );
    // Sin acciones de edición sobre los medicamentos.
    expect(botonConTexto(elemento, 'Agregar medicamento')).toBeFalsy();
    const tarjetaDetalle = elemento.querySelector('.medicamento')!;
    expect(botonConTexto(tarjetaDetalle, 'Editar')).toBeFalsy();
    expect(botonConTexto(tarjetaDetalle, 'Desactivar')).toBeFalsy();
    expect(botonConTexto(tarjetaDetalle, 'Eliminar')).toBeFalsy();
    expect(tarjetaDetalle.querySelector('app-boton-dividido')).toBeFalsy();
    expect(elemento.querySelector('#detalle-cantidad-100')).toBeFalsy();
    // Las acciones del plan en sí (coordinador) siguen disponibles.
    expect(botonConTexto(elemento, 'Reactivar plan')).toBeTruthy();
  });

  it('detalleInactivoSoloOfreceReactivarYEliminar', async () => {
    const detalleActivo = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol', idEstado: 1 });
    const detalleInactivo = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno', idEstado: 2 });
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleActivo, detalleInactivo] }),
    });

    const tarjetas = Array.from(elemento.querySelectorAll('.medicamento'));
    const tarjetaInactiva = tarjetas.find((t) => t.textContent?.includes('Ibuprofeno'))!;

    // Sin Editar ni la cantidad disponible en línea para el detalle inactivo.
    expect(botonConTexto(tarjetaInactiva, 'Editar')).toBeFalsy();
    expect(tarjetaInactiva.querySelector('#detalle-cantidad-200')).toBeFalsy();
    expect(botonConTexto(tarjetaInactiva, 'Guardar')).toBeFalsy();
    // Pero sí Reactivar (principal) y Eliminar (menú).
    expect(botonConTexto(tarjetaInactiva, 'Reactivar')).toBeTruthy();
    expect(itemsDelMenu(elemento, 'Más acciones para Ibuprofeno 500 mg')).toEqual(['Eliminar']);

    // El detalle activo conserva sus acciones completas.
    const tarjetaActiva = tarjetas.find((t) => t.textContent?.includes('Paracetamol'))!;
    expect(botonConTexto(tarjetaActiva, 'Editar')).toBeTruthy();
    expect(itemsDelMenu(elemento, MENU_PARACETAMOL)).toEqual([
      'Registrar cantidad disponible',
      'Desactivar',
      'Eliminar',
    ]);
  });

  it('colaboradorSoloConsulta', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(botonConTexto(elemento, 'Editar plan')).toBeFalsy();
    expect(botonConTexto(elemento, 'Desactivar plan')).toBeFalsy();
    expect(botonConTexto(elemento, 'Eliminar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Agregar medicamento')).toBeFalsy();
    const tarjetaDetalle = elemento.querySelector('.medicamento')!;
    expect(botonConTexto(tarjetaDetalle, 'Editar')).toBeFalsy();
    expect(elemento.querySelector('[aria-haspopup="menu"]')).toBeFalsy();
    expect(elemento.querySelector('#detalle-cantidad-100')).toBeFalsy();
    // Pero sí ve los datos del medicamento.
    expect(elemento.textContent).toContain('Paracetamol');
  });

  it('planNoEncontradoMuestraMensaje', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({ status: 404, error: { detail: 'El plan no existe' } }),
        ),
    });

    expect(elemento.textContent).toContain('No encontramos este plan en el grupo activo.');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/planes',
    );
    expect(enlace).toBeDefined();
  });

  it('cambiarDeGrupoVuelveALaLista', async () => {
    const { fixture, activo, router, servicioPlanes } = await configurar({});
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/planes');
    // Nunca se pide el plan bajo el grupo nuevo: no hay flash de datos ajenos.
    expect(servicioPlanes.obtener).not.toHaveBeenCalledWith(2, 10);
    expect(servicioPlanes.obtener).toHaveBeenCalledTimes(1);
  });

  it('encabezadoConVolverTituloAdultoYEstado', async () => {
    const { elemento } = await configurar({});

    const volver = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/planes',
    );
    expect(volver?.textContent).toContain('Volver a medicamentos');
    expect(elemento.querySelector('h1')?.textContent).toContain('Plan diario');
    const encabezado = elemento.querySelector('.mv-encabezado')!;
    expect(encabezado.textContent).toContain('Rosa González');
    expect(encabezado.querySelector('.mv-chip--exito')?.textContent).toContain('Activo');
  });

  it('accionesDelPlanUnaPrincipalYElRestoEnElMenu', async () => {
    const { elemento } = await configurar({});
    const datos = elemento.querySelector('[aria-labelledby="plan-datos-titulo"]')!;

    const principal = botonConTexto(datos, 'Editar plan')!;
    expect(principal.closest('[role="menu"]')).toBeNull();
    expect(principal.classList).not.toContain('mv-boton--primario');
    expect(datos.querySelector('app-boton-dividido')?.classList).toContain('mv-boton-dividido--secundario');
    expect(itemsDelMenu(elemento, MENU_PLAN)).toEqual(['Desactivar plan', 'Eliminar']);
    expect(datos.querySelector('details')).toBeNull();
  });

  it('elegirDesactivarPlanLlamaALaApi', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    servicioPlanes.desactivar.mockReturnValue(of(plan({ idEstado: 2 })));

    await elegirEnMenu(fixture, elemento, MENU_PLAN, 'Desactivar plan');

    expect(servicioPlanes.desactivar).toHaveBeenCalledWith(1, 10);
    expect(elemento.textContent).toContain('Plan desactivado.');
    expect(botonConTexto(elemento, 'Reactivar plan')).toBeTruthy();
  });

  it('principalEditarPlanAbreElFormulario', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Editar plan')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector<HTMLInputElement>('#plan-editar-nombre')?.value).toBe('Plan diario');
  });

  it('planInactivoTieneReactivarComoAccionPrincipal', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan({ idEstado: 2 }), detalles: [detalle()] }),
    });
    const datos = elemento.querySelector('[aria-labelledby="plan-datos-titulo"]')!;

    expect(botonConTexto(datos, 'Reactivar plan')?.closest('[role="menu"]')).toBeNull();
    expect(itemsDelMenu(elemento, MENU_PLAN)).toEqual(['Eliminar']);
    expect(elemento.querySelector('.mv-encabezado .mv-chip')?.textContent).toContain('Inactivo');
  });

  it('accionesDelMedicamentoUnaPrincipalYElRestoEnElMenu', async () => {
    const { elemento } = await configurar({});
    const fila = elemento.querySelector('.medicamento')!;

    const principal = botonConTexto(fila, 'Editar')!;
    expect(principal.closest('[role="menu"]')).toBeNull();
    expect(fila.querySelector('app-boton-dividido')?.classList).toContain('mv-boton-dividido--secundario');
    expect(itemsDelMenu(elemento, MENU_PARACETAMOL)).toEqual([
      'Registrar cantidad disponible',
      'Desactivar',
      'Eliminar',
    ]);
    const eliminar = Array.from(fila.querySelectorAll('[role="menuitem"]')).find(
      (b) => b.textContent?.trim() === 'Eliminar',
    );
    expect(eliminar?.classList).toContain('mv-menu__item--peligro');
  });

  it('medicamentoConDatosLegibles', async () => {
    const { elemento } = await configurar({});
    const tarjeta = elemento.querySelector('.medicamento')!;

    expect(tarjeta.querySelector('.mv-grilla__titulo')?.textContent).toContain('Paracetamol');
    expect(tarjeta.querySelector('.mv-chip--exito')?.textContent).toContain('Activo');
    const datos = Array.from(tarjeta.querySelectorAll('td[data-etiqueta]')).map((td) =>
      td.getAttribute('data-etiqueta'),
    );
    expect(datos).toEqual(['Dosis', 'Días', 'Horario', 'Vigencia', 'Disponible', 'Estado']);
    expect(tarjeta.textContent).toContain('Término estimado: 1 feb 2026 (automático)');
  });

  it('sinMedicamentosMuestraEstadoVacio', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [] }),
    });

    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain(
      'Aún no hay medicamentos en este plan.',
    );
  });

  it('mientrasCargaMuestraEsqueleto', async () => {
    const pendiente = new Subject<RespuestaPlanDetallado>();
    const { elemento } = await configurar({ obtenerImpl: () => pendiente.asObservable() });

    expect(elemento.textContent).toContain('Cargando plan…');
    expect(elemento.querySelector('.mv-esqueleto')).toBeTruthy();
  });

  it('errorDeCargaOfreceReintentar', async () => {
    const obtener = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la carga' } })),
      )
      .mockReturnValue(of({ plan: plan(), detalles: [detalle()] }));
    const { fixture, elemento, servicioPlanes } = await configurar({ obtenerImpl: obtener });

    const aviso = elemento.querySelector('.mv-aviso--error')!;
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('Falló la carga');

    botonConTexto(aviso, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioPlanes.obtener).toHaveBeenCalledTimes(2);
    expect(servicioPlanes.obtener).toHaveBeenLastCalledWith(1, 10);
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.textContent).toContain('Paracetamol');
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('Plan: desplazamiento y foco', () => {
  let desplazar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FormularioDetalleFalso.instancias = [];
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

  it('pasaAlFormularioElUsuarioDeLaSesionComoResponsablePorDefecto', async () => {
    const { fixture, elemento } = await configurar({});

    elemento.querySelector<HTMLButtonElement>('#plan-agregar-medicamento')!.click();
    await fixture.whenStable();

    const formulario = fixture.debugElement.query(By.directive(FormularioDetalleFalso))
      .componentInstance as FormularioDetalleFalso;
    expect(formulario.idUsuarioActual).toBe(1);
  });

  it('agregarMedicamentoTraeElFormularioALaVistaEnfocaSuPrimerCampoYAlCerrarVuelveAlBoton', async () => {
    const { fixture, elemento } = await configurar({});

    elemento.querySelector<HTMLButtonElement>('#plan-agregar-medicamento')!.click();
    await fixture.whenStable();

    const formulario = elemento.querySelector('app-formulario-detalle');
    expect(bloqueDe(formulario)).toBe('start');
    expect(document.activeElement).toBe(elemento.querySelector('#detalle-presentacion'));

    (fixture.debugElement.query(By.directive(FormularioDetalleFalso)).componentInstance as FormularioDetalleFalso)
      .cancelado.emit();
    await fixture.whenStable();

    const boton = elemento.querySelector('#plan-agregar-medicamento');
    expect(document.activeElement).toBe(boton);
    expect(bloqueDe(boton)).toBe('nearest');
  });

  it('editarDesdeLaGrillaTraeElFormularioALaVista', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento.querySelector('[data-id-detalle="100"]')!, 'Editar')!.click();
    await fixture.whenStable();

    expect(bloqueDe(elemento.querySelector('app-formulario-detalle'))).toBe('start');
    expect(document.activeElement).toBe(elemento.querySelector('#detalle-presentacion'));
  });

  it('editarCantidadTraeSuFilaALaVista', async () => {
    const { fixture, elemento } = await configurar({});

    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Registrar cantidad disponible');

    expect(bloqueDe(elemento.querySelector('[data-id-cantidad="100"]'))).toBe('start');
    expect(document.activeElement).toBe(elemento.querySelector('#detalle-cantidad-100'));
  });

  it('editarPlanTraeElFormularioALaVistaYAlCancelarVuelveAlBoton', async () => {
    const { fixture, elemento } = await configurar({});

    elemento.querySelector<HTMLButtonElement>('#plan-acciones .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();

    expect(bloqueDe(elemento.querySelector('#plan-editar'))).toBe('start');
    expect(document.activeElement?.id).toBe('plan-editar-nombre');

    botonConTexto(elemento.querySelector('#plan-editar')!, 'Cancelar')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      elemento.querySelector('#plan-acciones .mv-boton-dividido__principal'),
    );
  });

  it('eliminarUnMedicamentoLlevaElFocoALaFilaSiguienteYSinFilasAlTitulo', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno', concentracion: null });
    let detalles = [detalleA, detalleB];
    const { fixture, elemento, servicioPlanes } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles }),
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    servicioPlanes.eliminarDetalle.mockImplementation(() => {
      detalles = [detalleB];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Eliminar');
    expect(document.activeElement).toBe(
      elemento.querySelector('[data-id-detalle="200"] .mv-boton-dividido__principal'),
    );

    servicioPlanes.eliminarDetalle.mockImplementation(() => {
      detalles = [];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, 'Más acciones para Ibuprofeno', 'Eliminar');
    expect(document.activeElement?.id).toBe('plan-medicamentos-titulo');
    confirmar.mockRestore();
  });

  it('desactivarUnMedicamentoMantieneElFocoEnSuFilaAunqueCambieDeLugar', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno', concentracion: null });
    let detalles = [detalleA, detalleB];
    const { fixture, elemento, servicioPlanes } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles }),
    });
    servicioPlanes.desactivarDetalle.mockImplementation(() => {
      // La inactiva pasa al final de la lista.
      detalles = [detalleB, { ...detalleA, idEstado: 2 }];
      return of(detalleA);
    });

    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Desactivar');

    const principal = elemento.querySelector('[data-id-detalle="100"] .mv-boton-dividido__principal');
    expect(principal?.textContent?.trim()).toBe('Reactivar');
    expect(document.activeElement).toBe(principal);
  });

  it('errorDeUnaAccionDeFilaTraeElAvisoALaVista', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    servicioPlanes.desactivarDetalle.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Conflicto' } })),
    );

    await elegirEnMenu(fixture, elemento, MENU_PARACETAMOL, 'Desactivar');

    const aviso = elemento.querySelector('#plan-error-detalle');
    expect(aviso?.textContent).toContain('Conflicto');
    expect(bloqueDe(aviso)).toBe('nearest');
  });
});
