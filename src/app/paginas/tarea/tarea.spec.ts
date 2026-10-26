import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Tarea } from './tarea';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo, RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import {
  RespuestaAsignacion,
  RespuestaHistorialEstado,
  RespuestaTarea,
  RespuestaTareaDetallada,
  SolicitudAsignarTarea,
} from '../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ESTADOS_TAREA: RespuestaEstadoCatalogo[] = [
  { idEstado: 10, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1 },
  { idEstado: 11, codigo: 'EN_CURSO', descripcion: 'En curso', orden: 2 },
  { idEstado: 12, codigo: 'COMPLETADA', descripcion: 'Completada', orden: 3 },
  { idEstado: 13, codigo: 'NO_REALIZADA', descripcion: 'No realizada', orden: 4 },
  { idEstado: 14, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 5 },
];

const ESTADOS_ASIGNACION: RespuestaEstadoCatalogo[] = [
  { idEstado: 20, codigo: 'ACTIVO', descripcion: 'Activa', orden: 1 },
  { idEstado: 21, codigo: 'REEMPLAZADA', descripcion: 'Reemplazada', orden: 2 },
  { idEstado: 22, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 3 },
];

const ESTADOS_INTEGRANTE: RespuestaEstadoCatalogo[] = [
  { idEstado: 30, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 31, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

const UNIDADES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 40, codigo: 'COMPRIMIDOS', descripcion: 'Comprimidos', orden: 1 },
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

function integrante(datos: Partial<RespuestaIntegrante> = {}): RespuestaIntegrante {
  return {
    idIntegrante: 1,
    idUsuario: 200,
    nombre: 'Carlos Soto',
    email: 'carlos@correo.cl',
    idRol: 1,
    nombreRol: 'Colaborador',
    idEstado: 30,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: null,
    ...datos,
  };
}

function tarea(datos: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 9,
    tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    idDetallePlan: null,
    titulo: 'Comprar Losartán',
    descripcion: null,
    fechaHorario: '2026-11-02T08:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 10,
    atrasada: false,
    responsable: null,
    observacionCierre: null,
    nombreConfirmador: null,
    fechaConfirmacion: null,
    motivoCancelacion: null,
    compra: [],
    cita: null,
    ...datos,
  };
}

function historial(datos: Partial<RespuestaHistorialEstado> = {}): RespuestaHistorialEstado {
  return {
    idEstadoAnterior: null,
    idEstadoNuevo: 10,
    nombreUsuario: 'Ana Pérez',
    fechaCambio: '2026-11-01T08:00:00-03:00',
    observacion: null,
    ...datos,
  };
}

function asignacion(datos: Partial<RespuestaAsignacion> = {}): RespuestaAsignacion {
  return {
    idAsignacion: 1,
    idUsuarioAsignado: 200,
    nombreAsignado: 'Carlos Soto',
    nombreAsignador: 'Ana Pérez',
    fechaAsignacion: '2026-11-01T08:00:00-03:00',
    fechaTermino: null,
    idEstado: 20,
    motivo: null,
    ...datos,
  };
}

function detalle(datos: Partial<RespuestaTareaDetallada> = {}): RespuestaTareaDetallada {
  return {
    tarea: tarea(),
    historial: [historial()],
    asignaciones: [asignacion()],
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  obtenerImpl?: () => Observable<RespuestaTareaDetallada>;
  asignarImpl?: ReturnType<typeof vi.fn>;
  esAdministrador?: boolean;
  integrantes?: RespuestaIntegrante[];
  estadosTareaImpl?: () => Observable<RespuestaEstadoCatalogo[]>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioTareas = {
    obtener: vi.fn(opciones.obtenerImpl ?? (() => of(detalle()))),
    asignar: opciones.asignarImpl ?? vi.fn(() => of(tarea())),
  };
  const servicioGrupos = {
    integrantes: vi.fn(() => of(opciones.integrantes ?? [integrante()])),
  };
  const servicioCatalogos = {
    estados: vi.fn((tabla: string) => {
      if (tabla === 'TAREA_CUIDADO') return (opciones.estadosTareaImpl ?? (() => of(ESTADOS_TAREA)))();
      if (tabla === 'ASIGNACION_TAREA') return of(ESTADOS_ASIGNACION);
      return of(ESTADOS_INTEGRANTE);
    }),
    opciones: vi.fn(() => of(UNIDADES)),
  };

  TestBed.configureTestingModule({
    imports: [Tarea],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ idTarea: '9' }) } },
      },
      { provide: ServicioTareas, useValue: servicioTareas },
      { provide: ServicioGrupos, useValue: servicioGrupos },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
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
    ],
  });
  const fixture = TestBed.createComponent(Tarea);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioTareas,
    servicioGrupos,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('Tarea', () => {
  it('muestraElHistorialYLasAsignacionesEnOrden', async () => {
    const datos = detalle({
      historial: [
        historial({ idEstadoAnterior: null, idEstadoNuevo: 10, nombreUsuario: 'Ana Pérez' }),
        historial({ idEstadoAnterior: 10, idEstadoNuevo: 11, nombreUsuario: 'Carlos Soto' }),
      ],
      asignaciones: [
        asignacion({ idAsignacion: 1, nombreAsignado: 'Carlos Soto' }),
        asignacion({ idAsignacion: 2, nombreAsignado: 'Juana Rojas', idEstado: 21 }),
      ],
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    const itemsHistorial = Array.from(elemento.querySelectorAll('[data-prueba="historial-item"]'));
    expect(itemsHistorial).toHaveLength(2);
    expect(itemsHistorial[0].textContent).toContain('Creada → Pendiente');
    expect(itemsHistorial[0].textContent).toContain('Ana Pérez');
    expect(itemsHistorial[1].textContent).toContain('Pendiente → En curso');
    expect(itemsHistorial[1].textContent).toContain('Carlos Soto');

    const itemsAsignaciones = Array.from(elemento.querySelectorAll('[data-prueba="asignacion-item"]'));
    expect(itemsAsignaciones).toHaveLength(2);
    expect(itemsAsignaciones[0].textContent).toContain('Carlos Soto');
    expect(itemsAsignaciones[0].textContent).toContain('Activa');
    expect(itemsAsignaciones[1].textContent).toContain('Juana Rojas');
    expect(itemsAsignaciones[1].textContent).toContain('Reemplazada');
  });

  it('muestraLaDosisYLasObservacionesDeCadaLineaDeCompraYLasDeLaCita', async () => {
    const datos = detalle({
      tarea: tarea({
        compra: [
          {
            idDetalleCompra: 1,
            idMedicamento: 10,
            nombreMedicamento: 'Losartán',
            idPresentacion: 1,
            dosisIndicada: '1 comprimido cada 12 horas',
            cantidadSolicitada: 30,
            idUnidadCantidad: 40,
            observaciones: 'Retirar en farmacia de turno',
          },
        ],
        cita: {
          nombreMedico: 'Dra. Fernández',
          lugarAtencion: 'Hospital Regional',
          observaciones: 'Llevar exámenes previos',
        },
      }),
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    expect(elemento.textContent).toContain('1 comprimido cada 12 horas');
    expect(elemento.textContent).toContain('Retirar en farmacia de turno');
    expect(elemento.textContent).toContain('Llevar exámenes previos');
  });

  it('reasignarEnviaIdUsuarioYMotivoYRecarga', async () => {
    const datosConResponsable = detalle({
      tarea: tarea({ idEstado: 10, responsable: { idUsuario: 500, nombre: 'Pedro Pérez' } }),
    });
    const datosActualizados = detalle({
      tarea: tarea({ idEstado: 10, responsable: { idUsuario: 200, nombre: 'Carlos Soto' } }),
    });
    const obtenerImpl = vi
      .fn()
      .mockReturnValueOnce(of(datosConResponsable))
      .mockReturnValueOnce(of(datosActualizados));
    const asignarImpl = vi.fn(() => of(tarea({ idEstado: 10 })));

    const { fixture, elemento, servicioTareas } = await configurar({
      obtenerImpl,
      asignarImpl,
      integrantes: [integrante({ idUsuario: 200, nombre: 'Carlos Soto' })],
    });

    const select = elemento.querySelector<HTMLSelectElement>('#tarea-reasignar-integrante')!;
    // Única opción distinta de "Selecciona…" (null): el integrante 200.
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));

    const motivo = elemento.querySelector<HTMLTextAreaElement>('#tarea-reasignar-motivo')!;
    motivo.value = 'Se va de vacaciones';
    motivo.dispatchEvent(new Event('input'));

    botonConTexto(elemento, 'Reasignar')!.click();
    await fixture.whenStable();

    expect(servicioTareas.asignar).toHaveBeenCalledWith(1, 9, {
      idUsuario: 200,
      motivo: 'Se va de vacaciones',
    } as SolicitudAsignarTarea);
    expect(servicioTareas.obtener).toHaveBeenCalledTimes(2);
    const confirmacion = elemento.querySelector('[role="status"]');
    expect(confirmacion?.textContent).toContain('Responsable actualizado.');
  });

  it('noOfreceReasignarHastaQueLlegaElCatalogoDeEstadosAunqueElDetalleYaCargo', async () => {
    const sujetoEstados = new Subject<RespuestaEstadoCatalogo[]>();
    const { fixture, elemento } = await configurar({
      estadosTareaImpl: () => sujetoEstados.asObservable(),
    });

    // El detalle ya cargó (la tarea no es final), pero sin el catálogo de
    // estados no se puede saber si lo es: no debe ofrecerse "Reasignar"
    // todavía (evita el parpadeo del hallazgo T11-1).
    expect(botonConTexto(elemento, 'Reasignar')).toBeFalsy();
    expect(elemento.querySelector('#tarea-reasignar-integrante')).toBeNull();

    sujetoEstados.next(ESTADOS_TAREA);
    sujetoEstados.complete();
    await fixture.whenStable();

    expect(elemento.querySelector('#tarea-reasignar-integrante')).not.toBeNull();
  });

  it('colaboradorNoVeReasignar', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(elemento.querySelector('#tarea-reasignar-integrante')).toBeNull();
    expect(botonConTexto(elemento, 'Reasignar')).toBeFalsy();
  });

  it('tareaFinalNoOfreceReasignar', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of(detalle({ tarea: tarea({ idEstado: 12 }) })), // COMPLETADA
    });

    expect(elemento.querySelector('#tarea-reasignar-integrante')).toBeNull();
    expect(botonConTexto(elemento, 'Reasignar')).toBeFalsy();
  });

  it('fechaHoraUsaElDiaDeSantiagoNoElDeLaParteDeFechaDelIsoUtc', async () => {
    // El coordinador creó la cita el 02-11 a las 22:00 (-03:00); la API la
    // serializó en Z: 2026-11-03T01:00:00Z. El detalle debe seguir
    // mostrando el día en que realmente cae en Santiago (02-11), no el día
    // que trae la parte de fecha del texto ISO (03-11).
    const datos = detalle({ tarea: tarea({ fechaHorario: '2026-11-03T01:00:00Z' }) });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    expect(elemento.textContent).toContain('02-11-2026 22:00');
    expect(elemento.textContent).not.toContain('03-11-2026 22:00');
  });

  it('cuatroCeroCuatroMuestraMensajeYEnlaceATareas', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { detail: 'La tarea no existe' },
            }),
        ),
    });

    expect(elemento.textContent).toContain(
      'La tarea no existe o no pertenece al grupo activo.',
    );
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/tareas',
    );
    expect(enlace).toBeDefined();
  });
});
