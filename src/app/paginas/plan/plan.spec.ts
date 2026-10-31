import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnInit, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
@Component({ selector: 'app-formulario-detalle', template: '' })
class FormularioDetalleFalso implements OnInit {
  static instancias: Array<RespuestaDetallePlan | null | undefined> = [];

  @Input() idGrupo?: number;
  @Input() plan?: RespuestaPlan;
  @Input() detalle?: RespuestaDetallePlan | null;
  @Input() presentaciones?: RespuestaOpcionCatalogo[];
  @Input() unidades?: RespuestaOpcionCatalogo[];
  @Input() dias?: RespuestaOpcionCatalogo[];
  @Input() integrantes?: RespuestaIntegrante[];
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
    expect(elemento.textContent).toContain('09:00 · 13:00 · 19:00');
    // Días: 7/7 -> "Todos los días"; 3/7 -> abreviados.
    expect(elemento.textContent).toContain('Todos los días');
    expect(elemento.textContent).toContain('Lun, Mié, Vie');
    // Dosis con la descripción del catálogo de unidades.
    expect(elemento.textContent).toContain('1 Comprimido');
    // Término estimado formateado.
    expect(elemento.textContent).toContain('Término estimado: 1 feb 2026 (automático)');
  });

  it('actualizarCantidadLlamaALaApiYRecarga', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    servicioPlanes.obtener.mockClear();

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

    const campoCantidad = elemento.querySelector<HTMLInputElement>('#detalle-cantidad-100')!;
    expect(campoCantidad.value).toBe('20');

    // El usuario escribe un valor pero otra acción (p. ej. "Desactivar" del propio detalle) dispara la recarga.
    // Se acota al `.medicamento`: "Desactivar plan" (nivel plan) también contiene "Desactivar".
    campoCantidad.value = '15';
    campoCantidad.dispatchEvent(new Event('input'));
    const tarjetaDetalle = elemento.querySelector('.medicamento')!;
    botonConTexto(tarjetaDetalle, 'Desactivar')!.click();
    await fixture.whenStable();

    // Tras recargar, el campo muestra el valor fresco de la API (5), nunca el 15 escrito ni el 20 original.
    expect(campoCantidad.value).toBe('5');
    expect(servicioPlanes.desactivarDetalle).toHaveBeenCalledWith(1, 10, 100);
  });

  it('accionesPorDetalleTienenNombreAccesibleUnico', async () => {
    const { elemento } = await configurar({});

    const botonGuardarCantidad = elemento.querySelector(
      '[aria-label="Guardar cantidad de Paracetamol"]',
    );
    expect(botonGuardarCantidad?.textContent).toContain('Guardar');
    expect(elemento.querySelector('[aria-label="Editar Paracetamol"]')).toBeTruthy();
    expect(elemento.querySelector('[aria-label="Desactivar Paracetamol"]')).toBeTruthy();
    expect(elemento.querySelector('[aria-label="Eliminar Paracetamol"]')).toBeTruthy();
    expect(
      elemento.querySelector('[aria-label="Cantidad disponible de Paracetamol"]'),
    ).toBeTruthy();
  });

  it('cambiarDeDetalleEnEdicionRemontaElFormulario', async () => {
    const detalleA = detalle({ idDetallePlan: 100, nombreMedicamento: 'Paracetamol' });
    const detalleB = detalle({ idDetallePlan: 200, nombreMedicamento: 'Ibuprofeno' });
    const { fixture, elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan(), detalles: [detalleA, detalleB] }),
    });

    elemento.querySelector<HTMLButtonElement>('[aria-label="Editar Paracetamol"]')!.click();
    await fixture.whenStable();

    expect(FormularioDetalleFalso.instancias).toHaveLength(1);
    expect(FormularioDetalleFalso.instancias[0]?.idDetallePlan).toBe(100);

    elemento.querySelector<HTMLButtonElement>('[aria-label="Editar Ibuprofeno"]')!.click();
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
    expect(tarjetaDetalle.querySelector('#detalle-cantidad-100')).toBeFalsy();
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
    // Pero sí Reactivar y Eliminar.
    expect(elemento.querySelector('[aria-label="Reactivar Ibuprofeno"]')).toBeTruthy();
    expect(elemento.querySelector('[aria-label="Eliminar Ibuprofeno"]')).toBeTruthy();

    // El detalle activo conserva sus acciones completas.
    const tarjetaActiva = tarjetas.find((t) => t.textContent?.includes('Paracetamol'))!;
    expect(botonConTexto(tarjetaActiva, 'Editar')).toBeTruthy();
    expect(tarjetaActiva.querySelector('#detalle-cantidad-100')).toBeTruthy();
    expect(elemento.querySelector('[aria-label="Desactivar Paracetamol"]')).toBeTruthy();
  });

  it('colaboradorSoloConsulta', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(botonConTexto(elemento, 'Editar plan')).toBeFalsy();
    expect(botonConTexto(elemento, 'Desactivar plan')).toBeFalsy();
    expect(botonConTexto(elemento, 'Eliminar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Agregar medicamento')).toBeFalsy();
    const tarjetaDetalle = elemento.querySelector('.medicamento')!;
    expect(botonConTexto(tarjetaDetalle, 'Editar')).toBeFalsy();
    expect(tarjetaDetalle.querySelector('#detalle-cantidad-100')).toBeFalsy();
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

  it('accionesDelPlanUnaPrincipalYElRestoEnMasAcciones', async () => {
    const { elemento } = await configurar({});
    const datos = elemento.querySelector('[aria-labelledby="plan-datos-titulo"]')!;

    expect(botonConTexto(datos, 'Editar plan')?.closest('details')).toBeNull();
    const mas = datos.querySelector('details')!;
    expect(mas.querySelector('summary')?.textContent).toContain('Más acciones');
    expect(botonConTexto(mas, 'Desactivar plan')).toBeTruthy();
    expect(botonConTexto(mas, 'Eliminar')).toBeTruthy();
  });

  it('planInactivoTieneReactivarComoAccionPrincipal', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of({ plan: plan({ idEstado: 2 }), detalles: [detalle()] }),
    });
    const datos = elemento.querySelector('[aria-labelledby="plan-datos-titulo"]')!;

    expect(botonConTexto(datos, 'Reactivar plan')?.closest('details')).toBeNull();
    expect(botonConTexto(datos.querySelector('details')!, 'Eliminar')).toBeTruthy();
    expect(elemento.querySelector('.mv-encabezado .mv-chip')?.textContent).toContain('Inactivo');
  });

  it('accionesDelMedicamentoUnaPrincipalYElRestoEnMasAcciones', async () => {
    const { elemento } = await configurar({});
    const tarjeta = elemento.querySelector('.medicamento')!;

    expect(tarjeta.querySelector('[aria-label="Editar Paracetamol"]')?.closest('details')).toBeNull();
    const mas = tarjeta.querySelector('details')!;
    expect(mas.querySelector('summary')?.getAttribute('aria-label')).toBe(
      'Más acciones: Paracetamol',
    );
    expect(mas.querySelector('#detalle-cantidad-100')).toBeTruthy();
    expect(mas.querySelector('[aria-label="Desactivar Paracetamol"]')).toBeTruthy();
    expect(mas.querySelector('[aria-label="Eliminar Paracetamol"]')).toBeTruthy();
  });

  it('medicamentoConDatosLegibles', async () => {
    const { elemento } = await configurar({});
    const tarjeta = elemento.querySelector('.medicamento')!;

    expect(tarjeta.querySelector('h3')?.textContent).toContain('Paracetamol');
    expect(tarjeta.querySelector('.mv-chip--exito')?.textContent).toContain('Activo');
    const datos = Array.from(tarjeta.querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
    expect(datos).toEqual(['Dosis', 'Días', 'Horario', 'Vigencia', 'Cantidad disponible']);
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
