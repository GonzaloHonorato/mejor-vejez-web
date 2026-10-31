import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Planes } from './planes';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaPlan } from '../../nucleo/planificacion/modelos-planificacion';
import { FiltrosListarPlanes, ServicioPlanes } from '../../nucleo/planificacion/servicio-planes';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ESTADOS_PLAN: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
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

function plan(datos: Partial<RespuestaPlan> = {}): RespuestaPlan {
  return {
    idPlan: 1,
    idGrupo: 1,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    nombrePlan: 'Plan mañana',
    vigenteDesde: '2026-01-01',
    vigenteHasta: null,
    idEstado: 1,
    medicamentosActivos: 2,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  planesIniciales?: RespuestaPlan[];
  listarImpl?: (idGrupo: number, filtros?: FiltrosListarPlanes) => Observable<RespuestaPlan[]>;
  crearImpl?: ReturnType<typeof vi.fn>;
  esAdministrador?: boolean;
  estados?: RespuestaEstadoCatalogo[];
  adultos?: RespuestaAdultoMayor[];
  adultosListarImpl?: (
    idGrupo: number,
    incluirInactivos?: boolean,
  ) => Observable<RespuestaAdultoMayor[]>;
  queryParams?: Record<string, string>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioPlanes = {
    listar: vi.fn(opciones.listarImpl ?? (() => of(opciones.planesIniciales ?? [plan()]))),
    crear: opciones.crearImpl ?? vi.fn(),
  };
  const servicioAdultos = {
    listar: vi.fn(opciones.adultosListarImpl ?? (() => of(opciones.adultos ?? [adulto()]))),
  };
  TestBed.configureTestingModule({
    imports: [Planes],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(opciones.queryParams ?? {}) },
        },
      },
      { provide: ServicioPlanes, useValue: servicioPlanes },
      { provide: ServicioAdultos, useValue: servicioAdultos },
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
      {
        provide: ServicioCatalogos,
        useValue: { estados: () => of(opciones.estados ?? ESTADOS_PLAN) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Planes);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioPlanes,
    servicioAdultos,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function seleccionarOpcionPorTexto(select: HTMLSelectElement, texto: string): void {
  const opcion = Array.from(select.querySelectorAll('option')).find(
    (o) => o.textContent?.trim() === texto,
  )!;
  select.value = opcion.value;
  select.dispatchEvent(new Event('change'));
}

async function abrirAlta(fixture: { whenStable(): Promise<unknown> }, elemento: HTMLElement): Promise<void> {
  const boton = Array.from(elemento.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Nuevo plan',
  )!;
  boton.click();
  await fixture.whenStable();
}

describe('Planes', () => {
  it('sinGrupoActivoInvitaAElegirUno', async () => {
    const { elemento } = await configurar({ activo: null });

    expect(elemento.textContent).toContain('Primero crea o elige un grupo.');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/grupos',
    );
    expect(enlace).toBeDefined();
  });

  it('muestraElAvisoCuandoNoHayPlanes', async () => {
    const { elemento } = await configurar({ planesIniciales: [] });

    expect(elemento.textContent).toContain('Aún no hay planes de medicamentos en este grupo.');
  });

  it('listaLosPlanesDelGrupo', async () => {
    const inactivo = plan({
      idPlan: 2,
      nombrePlan: 'Plan noche',
      idAdultoMayor: 2,
      nombreAdulto: 'Pedro Soto',
      idEstado: 2,
      medicamentosActivos: 0,
    });
    const { elemento, servicioPlanes } = await configurar({ planesIniciales: [plan(), inactivo] });

    expect(servicioPlanes.listar).toHaveBeenCalledWith(1, { idAdulto: undefined, incluirInactivos: false });

    const tarjetas = Array.from(elemento.querySelectorAll('.lista-planes .mv-fila'));
    expect(tarjetas).toHaveLength(2);

    expect(tarjetas[0].textContent).toContain('Plan mañana');
    expect(tarjetas[0].textContent).toContain('Rosa González');
    expect(tarjetas[0].textContent).toContain('2');
    expect(tarjetas[0].querySelector('a.mv-fila__titulo')?.getAttribute('href')).toBe('/planes/1');
    expect(tarjetas[0].textContent).not.toContain('Inactivo');

    expect(tarjetas[1].textContent).toContain('Plan noche');
    expect(tarjetas[1].textContent).toContain('Inactivo');
  });

  it('filtraPorAdultoDesdeElQueryParam', async () => {
    const { servicioPlanes } = await configurar({ queryParams: { idAdulto: '5' } });

    expect(servicioPlanes.listar).toHaveBeenCalledWith(1, { idAdulto: 5, incluirInactivos: false });
  });

  it('mostrarInactivosRecargaConElParametro', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({});
    servicioPlanes.listar.mockClear();
    servicioPlanes.listar.mockReturnValue(of([plan()]));

    const casilla = elemento.querySelector<HTMLInputElement>('#planes-mostrar-inactivos')!;
    casilla.click();
    await fixture.whenStable();

    expect(servicioPlanes.listar).toHaveBeenCalledWith(1, { idAdulto: undefined, incluirInactivos: true });
  });

  it('colaboradorNoVeNuevoPlan', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(elemento.textContent).not.toContain('Nuevo plan');
    expect(elemento.querySelector('#plan-nombre')).toBeFalsy();
  });

  it('crearNavegaAlPlan', async () => {
    const { fixture, elemento, servicioPlanes, router } = await configurar({ planesIniciales: [] });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    servicioPlanes.crear.mockReturnValue(of(plan({ idPlan: 9 })));

    await abrirAlta(fixture, elemento);
    const selectAdulto = elemento.querySelector<HTMLSelectElement>('#plan-adulto')!;
    seleccionarOpcionPorTexto(selectAdulto, 'Rosa González');

    const campoNombre = elemento.querySelector<HTMLInputElement>('#plan-nombre')!;
    campoNombre.value = 'Plan mañana';
    campoNombre.dispatchEvent(new Event('input'));

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioPlanes.crear).toHaveBeenCalledWith(1, {
      idAdultoMayor: 1,
      nombrePlan: 'Plan mañana',
      vigenteDesde: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      vigenteHasta: null,
    });
    expect(navegar).toHaveBeenCalledWith('/planes/9');
  });

  it('crearSinAdultoMuestraMensajeRequeridoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({ planesIniciales: [] });

    await abrirAlta(fixture, elemento);
    const campoNombre = elemento.querySelector<HTMLInputElement>('#plan-nombre')!;
    campoNombre.value = 'Plan mañana';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#plan-adulto-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(servicioPlanes.crear).not.toHaveBeenCalled();
  });

  it('vigenciaInvertidaMuestraErrorDeLaApi', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({ planesIniciales: [] });
    servicioPlanes.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'La vigencia hasta no puede ser anterior a la vigencia desde' },
          }),
      ),
    );

    await abrirAlta(fixture, elemento);
    const selectAdulto = elemento.querySelector<HTMLSelectElement>('#plan-adulto')!;
    seleccionarOpcionPorTexto(selectAdulto, 'Rosa González');

    const campoNombre = elemento.querySelector<HTMLInputElement>('#plan-nombre')!;
    campoNombre.value = 'Plan mañana';
    campoNombre.dispatchEvent(new Event('input'));

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'La vigencia hasta no puede ser anterior a la vigencia desde',
    );
  });

  it('cambiarDeGrupoRecarga', async () => {
    const { fixture, elemento, servicioPlanes, activo } = await configurar({
      listarImpl: (idGrupo: number) =>
        of(
          idGrupo === 1
            ? [plan({ idPlan: 1, nombrePlan: 'Plan mañana' })]
            : [
                plan({
                  idPlan: 5,
                  nombrePlan: 'Plan noche',
                  idAdultoMayor: 2,
                  nombreAdulto: 'Pedro Soto',
                }),
              ],
        ),
    });

    expect(elemento.textContent).toContain('Plan mañana');

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Plan noche');
    expect(elemento.textContent).not.toContain('Plan mañana');
    expect(servicioPlanes.listar).toHaveBeenCalledWith(2, { idAdulto: undefined, incluirInactivos: false });
  });

  it('cambiarDeGrupoReseteaElFiltroDeAdultoYElAdultoDelAlta', async () => {
    const { fixture, elemento, servicioPlanes, activo, router } = await configurar({
      queryParams: { idAdulto: '5' },
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
    });
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(servicioPlanes.listar).toHaveBeenCalledWith(1, { idAdulto: 5, incluirInactivos: false });

    await abrirAlta(fixture, elemento);
    const selectAdulto = elemento.querySelector<HTMLSelectElement>('#plan-adulto')!;
    seleccionarOpcionPorTexto(selectAdulto, 'Rosa González');
    servicioPlanes.listar.mockClear();

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    // El filtro de adulto (signal + control + query param) y el adulto del alta se resetean.
    expect(servicioPlanes.listar).toHaveBeenCalledWith(2, { idAdulto: undefined, incluirInactivos: false });
    const selectFiltro = elemento.querySelector<HTMLSelectElement>('#planes-filtro-adulto')!;
    expect(selectFiltro.selectedOptions[0].textContent?.trim()).toBe('Todos');
    expect(selectAdulto.selectedOptions[0].textContent?.trim()).toBe('Selecciona un adulto mayor');
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { idAdulto: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('dosCambiosDeGrupoRapidosDejanLosAdultosDelUltimoGrupo', async () => {
    const sujetoGrupo2 = new Subject<RespuestaAdultoMayor[]>();
    const sujetoGrupo3 = new Subject<RespuestaAdultoMayor[]>();
    const { fixture, elemento, activo } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      adultosListarImpl: (idGrupo: number) => {
        if (idGrupo === 2) return sujetoGrupo2.asObservable();
        if (idGrupo === 3) return sujetoGrupo3.asObservable();
        return of([adulto({ idAdultoMayor: 1, nombreCompleto: 'Rosa González' })]);
      },
    });

    // Dos cambios de grupo rápidos: 1 → 2 → 3.
    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();
    activo.set(grupo(3, 'COORDINADOR'));
    await fixture.whenStable();

    // La respuesta del grupo 3 (el actual) resuelve primero...
    sujetoGrupo3.next([adulto({ idAdultoMayor: 3, nombreCompleto: 'Pedro Soto' })]);
    sujetoGrupo3.complete();
    await fixture.whenStable();

    // ...y la del grupo 2 (obsoleta) llega después: debe ser ignorada.
    sujetoGrupo2.next([adulto({ idAdultoMayor: 2, nombreCompleto: 'Beto Díaz' })]);
    sujetoGrupo2.complete();
    await fixture.whenStable();

    const selectFiltro = elemento.querySelector<HTMLSelectElement>('#planes-filtro-adulto')!;
    const opciones = Array.from(selectFiltro.querySelectorAll('option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones).toContain('Pedro Soto');
    expect(opciones).not.toContain('Beto Díaz');
  });

  it('filtroListaAdultosInactivosYElFormularioSoloActivos', async () => {
    const activoAdulto = adulto({ idAdultoMayor: 1, nombreCompleto: 'Rosa González', idEstado: 1 });
    const inactivoAdulto = adulto({ idAdultoMayor: 2, nombreCompleto: 'Pedro Soto', idEstado: 2 });
    const { fixture, elemento, servicioAdultos } = await configurar({
      adultos: [activoAdulto, inactivoAdulto],
    });

    expect(servicioAdultos.listar).toHaveBeenCalledWith(1, true);

    const selectFiltro = elemento.querySelector<HTMLSelectElement>('#planes-filtro-adulto')!;
    const opcionesFiltro = Array.from(selectFiltro.querySelectorAll('option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opcionesFiltro).toContain('Rosa González');
    expect(opcionesFiltro).toContain('Pedro Soto (inactivo)');

    await abrirAlta(fixture, elemento);
    const selectFormulario = elemento.querySelector<HTMLSelectElement>('#plan-adulto')!;
    const opcionesFormulario = Array.from(selectFormulario.querySelectorAll('option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opcionesFormulario).toContain('Rosa González');
    expect(opcionesFormulario).not.toContain('Pedro Soto');
    expect(opcionesFormulario).not.toContain('Pedro Soto (inactivo)');
  });

  it('alReenviarConCamposInvalidosLimpiaElErrorGeneralAnterior', async () => {
    const { fixture, elemento, servicioPlanes } = await configurar({ planesIniciales: [] });
    servicioPlanes.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 422, error: { detail: 'Error previo de la API' } }),
      ),
    );

    await abrirAlta(fixture, elemento);
    const selectAdulto = elemento.querySelector<HTMLSelectElement>('#plan-adulto')!;
    seleccionarOpcionPorTexto(selectAdulto, 'Rosa González');
    const campoNombre = elemento.querySelector<HTMLInputElement>('#plan-nombre')!;
    campoNombre.value = 'Plan mañana';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Error previo de la API',
    );

    // Se vacía el nombre (campo requerido inválido) y se reenvía sin llamar a la API.
    campoNombre.value = '';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.textContent).not.toContain('Error previo de la API');
    expect(servicioPlanes.crear).toHaveBeenCalledTimes(1);
  });

  it('encabezadoConRotuloYAvisoLegal', async () => {
    const { elemento } = await configurar({});

    expect(elemento.querySelector('.mv-encabezado__rotulo')?.textContent).toContain(
      'Planificación del cuidado',
    );
    expect(elemento.querySelector('h1')?.textContent).toContain('Medicamentos');
    expect(elemento.querySelector('.mv-aviso--info')?.textContent).toContain(
      'no diagnostica ni recomienda medicamentos ni dosis',
    );
  });

  it('indicadoresCuentanPlanesYMedicamentosActivosDeLaLista', async () => {
    const otroActivo = plan({ idPlan: 3, nombrePlan: 'Plan tarde', medicamentosActivos: 1 });
    const inactivo = plan({ idPlan: 2, nombrePlan: 'Plan noche', idEstado: 2, medicamentosActivos: 4 });
    const { elemento } = await configurar({ planesIniciales: [plan(), otroActivo, inactivo] });

    const indicadores = Array.from(
      elemento.querySelectorAll('[aria-label="Resumen de planes"] .mv-indicador'),
    ).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(indicadores).toEqual(['2 planes activos', '3 medicamentos activos']);
  });

  it('indicadoresEnSingular', async () => {
    const { elemento } = await configurar({ planesIniciales: [plan({ medicamentosActivos: 1 })] });

    const indicadores = Array.from(
      elemento.querySelectorAll('[aria-label="Resumen de planes"] .mv-indicador'),
    ).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(indicadores).toEqual(['1 plan activo', '1 medicamento activo']);
  });

  it('elTituloEsElEnlaceAlPlanConNombreAccesibleUnico', async () => {
    const otro = plan({ idPlan: 2, nombrePlan: 'Plan mañana', nombreAdulto: 'Pedro Soto' });
    const { elemento } = await configurar({ planesIniciales: [plan(), otro] });

    const enlaces = Array.from(elemento.querySelectorAll<HTMLAnchorElement>('a.mv-fila__titulo'));
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/planes/1', '/planes/2']);
    expect(enlaces.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Plan mañana, Rosa González',
      'Plan mañana, Pedro Soto',
    ]);
    expect(elemento.textContent).not.toContain('Ver plan');
  });

  it('chipDeEstadoPorPlan', async () => {
    const inactivo = plan({ idPlan: 2, nombrePlan: 'Plan noche', idEstado: 2 });
    const { elemento } = await configurar({ planesIniciales: [plan(), inactivo] });

    const chips = Array.from(elemento.querySelectorAll('.lista-planes .mv-chip')).map((c) =>
      c.textContent?.trim(),
    );
    expect(chips).toEqual(['Activo', 'Inactivo']);
    expect(elemento.querySelector('.lista-planes .mv-chip--exito')?.textContent).toContain('Activo');
  });

  it('nuevoPlanDespliegaYPliegaElFormulario', async () => {
    const { fixture, elemento } = await configurar({});
    const boton = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Nuevo plan',
    )!;

    expect(elemento.querySelector('#plan-nombre')).toBeFalsy();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.id).toBe('planes-abrir-alta');
    expect(elemento.querySelector('#planes-alta')).toBeTruthy();

    boton.click();
    await fixture.whenStable();
    expect(elemento.querySelector('#plan-nombre')).toBeTruthy();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe('planes-alta');
    expect(document.activeElement?.id).toBe('plan-adulto');

    const textos = Array.from(elemento.querySelectorAll('#planes-alta .botones button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(textos).toEqual(['Cancelar', 'Crear plan']);

    Array.from(elemento.querySelectorAll('#planes-alta button'))
      .find((b) => b.textContent?.trim() === 'Cancelar')!
      .dispatchEvent(new Event('click'));
    await fixture.whenStable();
    expect(elemento.querySelector('#plan-nombre')).toBeFalsy();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector('#planes-alta')).toBeTruthy();
    expect(document.activeElement).toBe(boton);
  });

  it('mientrasCargaMuestraEsqueletoSinVacio', async () => {
    const pendiente = new Subject<RespuestaPlan[]>();
    const { elemento } = await configurar({ listarImpl: () => pendiente.asObservable() });

    expect(elemento.textContent).toContain('Cargando planes…');
    expect(elemento.querySelector('.mv-esqueleto')).toBeTruthy();
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();
    expect(elemento.querySelector('[aria-label="Resumen de planes"]')).toBeFalsy();
  });

  it('errorDeCargaOfreceReintentar', async () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la carga' } })),
      )
      .mockReturnValue(of([plan()]));
    const { fixture, elemento, servicioPlanes } = await configurar({ listarImpl: listar });

    const aviso = elemento.querySelector('.mv-aviso--error')!;
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('Falló la carga');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();

    Array.from(aviso.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Reintentar')!
      .click();
    await fixture.whenStable();

    expect(servicioPlanes.listar).toHaveBeenCalledTimes(2);
    expect(servicioPlanes.listar).toHaveBeenLastCalledWith(1, {
      idAdulto: undefined,
      incluirInactivos: false,
    });
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.textContent).toContain('Plan mañana');
  });
});
