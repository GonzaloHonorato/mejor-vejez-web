import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { Tareas } from './tareas';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { hoyEnSantiago, sumarDias } from '../../nucleo/fechas';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaTarea } from '../../nucleo/tareas/modelos-tareas';
import { FiltrosTareas, ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ESTADOS_TAREA: RespuestaEstadoCatalogo[] = [
  { idEstado: 10, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1 },
  { idEstado: 11, codigo: 'EN_CURSO', descripcion: 'En curso', orden: 2 },
  { idEstado: 12, codigo: 'COMPLETADA', descripcion: 'Completada', orden: 3 },
  { idEstado: 13, codigo: 'NO_REALIZADA', descripcion: 'No realizada', orden: 4 },
  { idEstado: 14, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 5 },
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

function adulto(datos: Partial<RespuestaAdultoMayor> = {}): RespuestaAdultoMayor {
  return {
    idAdultoMayor: 1,
    idGrupo: 1,
    codigoInterno: null,
    nombreCompleto: 'Rosa González',
    fechaNacimiento: '1950-05-10',
    notasEmergencia: null,
    observacionesGenerales: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    contactoPrincipal: null,
    ...datos,
  };
}

function tarea(datos: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 1,
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

interface Opciones {
  activo?: RespuestaGrupo | null;
  tareasIniciales?: RespuestaTarea[];
  listarImpl?: (idGrupo: number, filtros?: FiltrosTareas) => Observable<RespuestaTarea[]>;
  esAdministrador?: boolean;
  estados?: RespuestaEstadoCatalogo[];
  adultos?: RespuestaAdultoMayor[];
  queryParams?: Record<string, string>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioTareas = {
    listar: vi.fn(opciones.listarImpl ?? (() => of(opciones.tareasIniciales ?? [tarea()]))),
    cambiarEstado: vi.fn(),
  };
  const servicioAdultos = {
    listar: vi.fn(() => of(opciones.adultos ?? [adulto()])),
  };
  TestBed.configureTestingModule({
    imports: [Tareas],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(opciones.queryParams ?? {}) },
        },
      },
      { provide: ServicioTareas, useValue: servicioTareas },
      { provide: ServicioAdultos, useValue: servicioAdultos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({
              idUsuario: 200,
              nombre: 'Ana',
              email: 'ana@correo.cl',
              telefono: null,
              esAdministrador: opciones.esAdministrador ?? false,
            }),
        },
      },
      {
        provide: ServicioCatalogos,
        useValue: { estados: () => of(opciones.estados ?? ESTADOS_TAREA) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Tareas);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioTareas,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

describe('Tareas', () => {
  it('cargaElDiaPorDefectoConLosParametrosCorrectos', async () => {
    const hoy = hoyEnSantiago();
    const { servicioTareas } = await configurar({});

    expect(servicioTareas.listar).toHaveBeenCalledWith(1, {
      desde: hoy,
      hasta: hoy,
      idAdulto: undefined,
      soloMias: false,
    });
  });

  it('siguienteCambiaElQueryParamYRecarga', async () => {
    const hoy = hoyEnSantiago();
    const { fixture, elemento, servicioTareas, router } = await configurar({});
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    servicioTareas.listar.mockClear();
    servicioTareas.listar.mockReturnValue(of([]));

    const boton = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Siguiente',
    )!;
    boton.click();
    await fixture.whenStable();

    const siguienteDia = sumarDias(hoy, 1);
    expect(servicioTareas.listar).toHaveBeenCalledWith(1, {
      desde: siguienteDia,
      hasta: siguienteDia,
      idAdulto: undefined,
      soloMias: false,
    });
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { fecha: siguienteDia },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('unCambioRapidoDeGrupoDescartaLaRespuestaVieja', async () => {
    const sujetoGrupo1 = new Subject<RespuestaTarea[]>();
    const sujetoGrupo2 = new Subject<RespuestaTarea[]>();
    const { fixture, elemento, activo } = await configurar({
      listarImpl: (idGrupo: number) => (idGrupo === 1 ? sujetoGrupo1.asObservable() : sujetoGrupo2.asObservable()),
    });

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    // La respuesta del grupo 2 (el actual) resuelve primero...
    sujetoGrupo2.next([tarea({ idTarea: 2, titulo: 'Tarea del grupo 2' })]);
    sujetoGrupo2.complete();
    await fixture.whenStable();

    // ...y la del grupo 1 (obsoleta) llega después: debe ser ignorada.
    sujetoGrupo1.next([tarea({ idTarea: 1, titulo: 'Tarea del grupo 1' })]);
    sujetoGrupo1.complete();
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Tarea del grupo 2');
    expect(elemento.textContent).not.toContain('Tarea del grupo 1');
  });

  it('alCambiarDeGrupoDeVerdadLimpiaElFiltroDeAdultoYNoLoEnviaEnLaPeticionNueva', async () => {
    const hoy = hoyEnSantiago();
    const { fixture, activo, servicioTareas, router } = await configurar({
      queryParams: { idAdulto: '140' },
    });
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    servicioTareas.listar.mockClear();

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(servicioTareas.listar).toHaveBeenCalledTimes(1);
    expect(servicioTareas.listar).toHaveBeenCalledWith(2, {
      desde: hoy,
      hasta: hoy,
      idAdulto: undefined,
      soloMias: false,
    });
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { idAdulto: null } }),
    );
  });

  it('vacioMuestraElAvisoConRoleStatus', async () => {
    const { elemento } = await configurar({ tareasIniciales: [] });

    const aviso = elemento.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('No hay tareas para este día.');
  });

  it('errorSeMuestraEnRoleAlert', async () => {
    const { elemento } = await configurar({
      listarImpl: () =>
        throwError(
          () => new HttpErrorResponse({ status: 500, error: { detail: 'Error al listar tareas' } }),
        ),
    });

    const aviso = elemento.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('Error al listar tareas');
    expect(elemento.querySelector('[role="status"]')).toBeFalsy();
  });

  it('muestraLaInsigniaAtrasada', async () => {
    const { elemento } = await configurar({
      tareasIniciales: [tarea({ atrasada: true })],
    });

    expect(elemento.textContent).toContain('Atrasada');
  });

  it('elTituloEnlazaAlDetalleConNombreAccesibleUnicoConElTituloYLaHora', async () => {
    const { elemento } = await configurar({
      tareasIniciales: [
        tarea({ idTarea: 1, titulo: 'Comprar Losartán', fechaHorario: '2026-11-02T11:00:00Z' }),
        tarea({ idTarea: 2, titulo: 'Control con geriatra', fechaHorario: '2026-11-02T13:00:00Z' }),
      ],
    });

    const enlaces = Array.from(elemento.querySelectorAll<HTMLAnchorElement>('.lista-tareas a.mv-fila__titulo'));
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].textContent?.trim()).toBe('Comprar Losartán');
    expect(enlaces[0].getAttribute('href')).toBe('/tareas/1');
    expect(enlaces[0].getAttribute('aria-label')).toBe('Comprar Losartán, 08:00');
    expect(enlaces[1].getAttribute('href')).toBe('/tareas/2');
    expect(enlaces[1].getAttribute('aria-label')).toBe('Control con geriatra, 10:00');
    expect(Array.from(elemento.querySelectorAll('a')).some((a) => a.textContent?.includes('Ver detalle'))).toBe(
      false,
    );
  });

  it('nuevaTareaVisibleSoloParaElCoordinador', async () => {
    const coordinador = await configurar({ activo: grupo(1, 'COORDINADOR') });
    const enlaceCoordinador = Array.from(coordinador.elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Nueva tarea'),
    );
    expect(enlaceCoordinador).toBeDefined();
    expect(enlaceCoordinador!.getAttribute('href')).toBe('/tareas/nueva');

    TestBed.resetTestingModule();
    const colaborador = await configurar({ activo: grupo(1, 'COLABORADOR') });
    const enlaceColaborador = Array.from(colaborador.elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Nueva tarea'),
    );
    expect(enlaceColaborador).toBeUndefined();
  });

  it('fechaGrandeLegibleConElDiaYElMes', async () => {
    const { elemento } = await configurar({ queryParams: { fecha: '2026-10-31' } });

    const titulo = elemento.querySelector('.navegador-fecha h2')!;
    expect(titulo.textContent).toContain('Sábado, 31 de octubre');
  });

  it('marcaHoyCuandoLaFechaEsLaDeHoy', async () => {
    const hoy = await configurar({});
    expect(hoy.elemento.querySelector('.navegador-fecha h2')?.textContent).toContain('Hoy');

    TestBed.resetTestingModule();
    const otroDia = await configurar({ queryParams: { fecha: sumarDias(hoyEnSantiago(), 3) } });
    expect(otroDia.elemento.querySelector('.navegador-fecha h2')?.textContent).not.toContain('Hoy');
  });

  it('anteriorYSiguienteLlevanIconoDeFlecha', async () => {
    const { elemento } = await configurar({});
    const botones = Array.from(elemento.querySelectorAll('.navegador-fecha button'));
    const anterior = botones.find((b) => b.textContent?.trim() === 'Anterior')!;
    const siguiente = botones.find((b) => b.textContent?.trim() === 'Siguiente')!;

    expect(anterior.querySelector('app-icono svg')).toBeTruthy();
    expect(siguiente.querySelector('app-icono svg')).toBeTruthy();
  });

  it('indicadoresCuentanPendientesAtrasadasCompletadasYTotalDeLaListaCargada', async () => {
    const { elemento } = await configurar({
      tareasIniciales: [
        tarea({ idTarea: 1, idEstado: 10, atrasada: true }),
        tarea({ idTarea: 2, idEstado: 10 }),
        tarea({ idTarea: 3, idEstado: 11, atrasada: true }),
        tarea({ idTarea: 4, idEstado: 12 }),
        tarea({ idTarea: 5, idEstado: 13 }),
      ],
    });

    const indicadores = Array.from(elemento.querySelectorAll('.mv-indicadores li')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(indicadores).toEqual(['2 pendientes', '2 atrasadas', '1 completada', '5 en total del día']);
  });

  it('filtroDeEstadoEsLocalYUsaLosCodigosDelCatalogo', async () => {
    const { fixture, elemento, servicioTareas } = await configurar({
      tareasIniciales: [
        tarea({ idTarea: 1, idEstado: 10, titulo: 'Tarea pendiente' }),
        tarea({ idTarea: 2, idEstado: 11, titulo: 'Tarea en curso' }),
      ],
    });
    servicioTareas.listar.mockClear();

    const select = elemento.querySelector<HTMLSelectElement>('#tareas-filtro-estado')!;
    const opciones = Array.from(select.options).map((o) => o.value);
    expect(opciones).toEqual(['', 'PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'NO_REALIZADA', 'CANCELADA']);

    select.value = 'EN_CURSO';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const titulos = Array.from(elemento.querySelectorAll('.lista-tareas .mv-fila__titulo')).map((p) =>
      p.textContent?.trim(),
    );
    expect(titulos).toEqual(['Tarea en curso']);
    expect(servicioTareas.listar).not.toHaveBeenCalled();
  });

  it('busquedaLocalPorTituloAdultoOResponsableSinAcentosNiMayusculas', async () => {
    const { fixture, elemento, servicioTareas } = await configurar({
      tareasIniciales: [
        tarea({ idTarea: 1, titulo: 'Comprar Losartán', nombreAdulto: 'Rosa González' }),
        tarea({
          idTarea: 2,
          titulo: 'Control con geriatra',
          nombreAdulto: 'Carlos Muñoz',
          responsable: { idUsuario: 7, nombre: 'Patricia Silva' },
        }),
      ],
    });
    servicioTareas.listar.mockClear();
    const buscar = elemento.querySelector<HTMLInputElement>('#tareas-buscar')!;
    const titulosVisibles = () =>
      Array.from(elemento.querySelectorAll('.lista-tareas .mv-fila__titulo')).map((p) => p.textContent?.trim());

    for (const [texto, esperado] of [
      ['LOSARTAN', ['Comprar Losartán']],
      ['munoz', ['Control con geriatra']],
      ['patricia', ['Control con geriatra']],
      ['gonzalez', ['Comprar Losartán']],
    ] as const) {
      buscar.value = texto;
      buscar.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(titulosVisibles(), texto).toEqual(esperado);
    }
    expect(servicioTareas.listar).not.toHaveBeenCalled();
  });

  it('filtrosSinResultadosOfrecenLimpiarFiltros', async () => {
    const { fixture, elemento } = await configurar({
      tareasIniciales: [tarea({ idTarea: 1, titulo: 'Comprar Losartán' })],
    });
    const buscar = elemento.querySelector<HTMLInputElement>('#tareas-buscar')!;
    buscar.value = 'nada que coincida';
    buscar.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Ninguna tarea coincide con los filtros.');
    expect(elemento.textContent).not.toContain('No hay tareas para este día.');
    const limpiar = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Limpiar filtros',
    )!;
    limpiar.click();
    await fixture.whenStable();

    expect(buscar.value).toBe('');
    expect(elemento.querySelectorAll('.lista-tareas .mv-fila')).toHaveLength(1);
  });

  it('limpiarFiltrosTambienQuitaAdultoYSoloMisTareas', async () => {
    const hoy = hoyEnSantiago();
    const { fixture, elemento, servicioTareas, router } = await configurar({
      tareasIniciales: [],
      queryParams: { idAdulto: '1' },
    });
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    elemento.querySelector<HTMLInputElement>('#tareas-solo-mias')!.click();
    await fixture.whenStable();
    servicioTareas.listar.mockClear();

    const limpiar = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Limpiar filtros',
    )!;
    limpiar.click();
    await fixture.whenStable();

    expect(servicioTareas.listar).toHaveBeenLastCalledWith(1, {
      desde: hoy,
      hasta: hoy,
      idAdulto: undefined,
      soloMias: false,
    });
    expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { idAdulto: null } }));
  });

  it('mientrasCargaMuestraElEsqueleto', async () => {
    const { elemento } = await configurar({ listarImpl: () => new Subject<RespuestaTarea[]>() });

    const estado = elemento.querySelector('[role="status"]')!;
    expect(estado.textContent).toContain('Cargando tareas');
    expect(estado.querySelector('.mv-esqueleto')).toBeTruthy();
  });

  it('cadaTareaMuestraHoraTipoAdultoResponsableYChipAtrasadaEnPeligro', async () => {
    const { elemento } = await configurar({
      tareasIniciales: [
        tarea({
          fechaHorario: '2026-11-02T11:00:00Z',
          tipoTarea: 'CITAS_CONTROLES_MEDICOS',
          responsable: { idUsuario: 7, nombre: 'Patricia Silva' },
          atrasada: true,
        }),
      ],
    });

    const fila = elemento.querySelector('.lista-tareas .mv-fila')!;
    expect(fila.querySelector('.mv-fila__dato')?.textContent?.trim()).toBe('08:00');
    expect(fila.textContent).toContain('Cita o control médico');
    expect(fila.textContent).toContain('Rosa González');
    expect(fila.textContent).toContain('Patricia Silva');
    expect(fila.querySelector('.mv-chip--peligro')?.textContent?.trim()).toBe('Atrasada');
    expect(fila.querySelector('.mv-chip--alerta')?.textContent?.trim()).toBe('Pendiente');
    const detalle = fila.querySelector<HTMLAnchorElement>('a.mv-fila__titulo')!;
    expect(detalle.getAttribute('href')).toBe('/tareas/1');
  });

  it('nuevaTareaEsElBotonPrincipalDelEncabezado', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COORDINADOR') });

    const enlace = elemento.querySelector<HTMLAnchorElement>('.mv-encabezado a.mv-boton--primario');
    expect(enlace?.textContent).toContain('Nueva tarea');
  });

  it('enCelularLosFiltrosSecundariosSeAbrenConElBotonFiltros', async () => {
    const { fixture, elemento } = await configurar({});
    const boton = Array.from(elemento.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Filtros'),
    )!;
    const panel = elemento.querySelector<HTMLElement>(`#${boton.getAttribute('aria-controls')}`)!;

    expect(elemento.querySelector('#tareas-buscar')!.closest('#' + panel.id)).toBeNull();
    expect(panel.querySelector('#tareas-filtro-adulto')).toBeTruthy();
    expect(panel.querySelector('#tareas-filtro-estado')).toBeTruthy();
    expect(panel.querySelector('#tareas-solo-mias')).toBeTruthy();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList).not.toContain('abierto');

    boton.click();
    await fixture.whenStable();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(panel.classList).toContain('abierto');

    boton.click();
    await fixture.whenStable();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
  });

  it('elBotonFiltrosCuentaLosFiltrosActivosQueEsconde', async () => {
    const { fixture, elemento } = await configurar({ queryParams: { idAdulto: '1' } });
    const textoBoton = () =>
      Array.from(elemento.querySelectorAll('button'))
        .find((b) => b.textContent?.trim().startsWith('Filtros'))!
        .textContent?.replace(/\s+/g, ' ')
        .trim();
    expect(textoBoton()).toBe('Filtros (1)');

    const estado = elemento.querySelector<HTMLSelectElement>('#tareas-filtro-estado')!;
    estado.value = 'PENDIENTE';
    estado.dispatchEvent(new Event('change'));
    elemento.querySelector<HTMLInputElement>('#tareas-solo-mias')!.click();
    await fixture.whenStable();
    expect(textoBoton()).toBe('Filtros (3)');

    const buscar = elemento.querySelector<HTMLInputElement>('#tareas-buscar')!;
    buscar.value = 'losartan';
    buscar.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(textoBoton()).toBe('Filtros (3)');
  });

  it('sinFiltrosActivosElBotonDiceSoloFiltros', async () => {
    const { elemento } = await configurar({});
    const boton = Array.from(elemento.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Filtros'),
    )!;
    expect(boton.textContent?.trim()).toBe('Filtros');
  });
});
