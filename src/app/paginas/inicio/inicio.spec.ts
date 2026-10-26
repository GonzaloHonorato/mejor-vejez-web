import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { Inicio } from './inicio';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { RespuestaAlerta } from '../../nucleo/alertas/modelos-alertas';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { INTERVALO_REFRESCO_MS } from '../../nucleo/panel/estado-seccion';
import {
  RespuestaPanelAlertas,
  RespuestaPanelCitas,
  RespuestaPanelHorarios,
  RespuestaPanelPreventivas,
  RespuestaPanelTareas,
} from '../../nucleo/panel/modelos-panel';
import { RespuestaTarea } from '../../nucleo/tareas/modelos-tareas';

function grupo(idGrupo: number, nombreGrupo: string): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo,
    notificaCoordinador: true,
    idEstado: 1,
    miRol: 'COORDINADOR',
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function adulto(idAdultoMayor: number, nombreCompleto: string): RespuestaAdultoMayor {
  return {
    idAdultoMayor,
    idGrupo: 1,
    codigoInterno: null,
    nombreCompleto,
    fechaNacimiento: null,
    notasEmergencia: null,
    observacionesGenerales: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    contactoPrincipal: null,
  };
}

function tarea(datos: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 1,
    tipoTarea: 'MEDICAMENTOS',
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa Pérez',
    idDetallePlan: null,
    titulo: 'Tarea',
    descripcion: null,
    fechaHorario: '2026-11-02T10:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 1,
    atrasada: true,
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

function alerta(datos: Partial<RespuestaAlerta> = {}): RespuestaAlerta {
  return {
    idAlerta: 1,
    tipoAlerta: 'ATRASO_TAREA',
    idTarea: 1,
    tituloTarea: 'Tarea',
    idEstadoTarea: 1,
    idDetallePlan: null,
    nombreMedicamento: null,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa Pérez',
    fechaProgramada: '2026-11-02T10:00:00-03:00',
    mensajeAlerta: 'Mensaje',
    idEstado: 1,
    fechaDeteccion: '2026-11-02T10:30:00-03:00',
    revisor: null,
    fechaRevision: null,
    observacionCierre: null,
    ...datos,
  };
}

function panelTareasVacio(): RespuestaPanelTareas {
  return {
    fecha: '2026-11-02',
    pendientes: 0,
    enCurso: 0,
    completadas: 0,
    noRealizadas: 0,
    canceladas: 0,
    atrasadas: 0,
    tareasAtrasadas: [],
  };
}

function panelAlertasVacio(): RespuestaPanelAlertas {
  return { abiertas: 0, cerradasUltimos7Dias: 0, recientes: [] };
}

function panelHorariosVacio(): RespuestaPanelHorarios {
  return { tareas: [] };
}

function panelCitasVacio(): RespuestaPanelCitas {
  return { citas: [] };
}

function panelPreventivasVacio(): RespuestaPanelPreventivas {
  return { alertas: [] };
}

const SUFIJOS_SECCIONES = [
  'panel/tareas',
  'panel/alertas',
  'panel/proximos-horarios',
  'panel/citas',
  'panel/alertas-preventivas',
] as const;

function datosVaciosPara(
  sufijo: string,
):
  | RespuestaPanelTareas
  | RespuestaPanelAlertas
  | RespuestaPanelHorarios
  | RespuestaPanelCitas
  | RespuestaPanelPreventivas {
  switch (sufijo) {
    case 'panel/tareas':
      return panelTareasVacio();
    case 'panel/alertas':
      return panelAlertasVacio();
    case 'panel/proximos-horarios':
      return panelHorariosVacio();
    case 'panel/citas':
      return panelCitasVacio();
    case 'panel/alertas-preventivas':
      return panelPreventivasVacio();
    default:
      throw new Error(`Sufijo desconocido: ${sufijo}`);
  }
}

function peticionSeccion(http: HttpTestingController, idGrupo: number, sufijo: string) {
  return http.expectOne(
    (req) => req.method === 'GET' && req.url.endsWith(`/api/grupos/${idGrupo}/${sufijo}`),
  );
}

function flushTodasLasSecciones(http: HttpTestingController, idGrupo: number): void {
  for (const sufijo of SUFIJOS_SECCIONES) {
    peticionSeccion(http, idGrupo, sufijo).flush(datosVaciosPara(sufijo));
  }
}

function peticionAdultos(http: HttpTestingController, idGrupo: number) {
  return http.expectOne(
    (req) => req.method === 'GET' && req.url.endsWith(`/api/grupos/${idGrupo}/adultos`),
  );
}

/** Drena (y descarta) las peticiones del panel y del selector de adultos: no le importan a las pruebas "legado" de saludo/fallo. */
function agotarPeticionesDelPanel(http: HttpTestingController): void {
  for (const peticion of http.match((req) => !req.url.endsWith('/api/yo'))) {
    const url = peticion.request.url;
    if (url.endsWith('/panel/tareas')) {
      peticion.flush(panelTareasVacio());
    } else if (url.endsWith('/panel/alertas')) {
      peticion.flush(panelAlertasVacio());
    } else if (url.endsWith('/panel/proximos-horarios')) {
      peticion.flush(panelHorariosVacio());
    } else if (url.endsWith('/panel/citas')) {
      peticion.flush(panelCitasVacio());
    } else if (url.endsWith('/panel/alertas-preventivas')) {
      peticion.flush(panelPreventivasVacio());
    } else if (url.endsWith('/adultos')) {
      peticion.flush([]);
    }
  }
}

function configurar(
  cerrarSesion = vi.fn().mockResolvedValue(undefined),
  grupos: RespuestaGrupo[] = [grupo(1, 'Familia Soto')],
) {
  TestBed.configureTestingModule({
    imports: [Inicio],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ServicioAutenticacion,
        useValue: { habilitado: true, usuario: signal(null), listo: signal(true), cerrarSesion },
      },
      {
        provide: ServicioGrupoActivo,
        useValue: { grupos: signal(grupos), activo: signal(grupos[0] ?? null) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Inicio);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const peticionYo = http.expectOne(
    (req) => req.method === 'GET' && req.url.endsWith('/api/yo'),
  );
  agotarPeticionesDelPanel(http);
  return { fixture, peticionYo, cerrarSesion };
}

function configurarPanel(opciones?: {
  grupos?: RespuestaGrupo[];
  activoInicial?: RespuestaGrupo | null;
}) {
  const grupos = opciones?.grupos ?? [grupo(1, 'Familia Soto')];
  // `??` trataría un `activoInicial: null` explícito como "usa el valor por defecto": se
  // distingue con `in` para que ese caso (sin grupo activo) no caiga a `grupos[0]`.
  const activoInicial =
    opciones && 'activoInicial' in opciones ? opciones.activoInicial : grupos[0] ?? null;
  const activo = signal<RespuestaGrupo | null>(activoInicial ?? null);
  TestBed.configureTestingModule({
    imports: [Inicio],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ServicioAutenticacion,
        useValue: {
          habilitado: true,
          usuario: signal(null),
          listo: signal(true),
          cerrarSesion: vi.fn().mockResolvedValue(undefined),
        },
      },
      { provide: ServicioGrupoActivo, useValue: { grupos: signal(grupos), activo } },
    ],
  });
  const fixture = TestBed.createComponent(Inicio);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  http
    .expectOne((req) => req.method === 'GET' && req.url.endsWith('/api/yo'))
    .flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });

  return { fixture, http, activo, elemento: fixture.nativeElement as HTMLElement };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('Inicio', () => {
  it('saludaConElNombreDeYo', async () => {
    const { fixture, peticionYo } = configurar();

    peticionYo.flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hola, Ana');
  });

  it('muestraDetalleDeLaApiYOfreceCerrarSesionAnte409', async () => {
    const { fixture, peticionYo, cerrarSesion } = configurar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    peticionYo.flush(
      { title: 'Conflicto', detail: 'El correo ya está asociado a otra cuenta' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'El correo ya está asociado a otra cuenta',
    );
    expect(botonConTexto(elemento, 'Reintentar')).toBeUndefined();
    const botonCerrar = botonConTexto(elemento, 'Cerrar sesión');
    expect(botonCerrar).toBeDefined();

    botonCerrar!.click();
    await fixture.whenStable();

    expect(cerrarSesion).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/ingreso');
  });

  it('ofreceReintentarAnteErrorDeRed', async () => {
    const { fixture, peticionYo } = configurar();

    peticionYo.error(new ProgressEvent('error'));
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tus datos.');
    expect(botonConTexto(elemento, 'Cerrar sesión')).toBeUndefined();
    const botonReintentar = botonConTexto(elemento, 'Reintentar');
    expect(botonReintentar).toBeDefined();

    botonReintentar!.click();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/yo'))
      .flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Hola, Ana');
  });

  it('invitaACrearGrupoSinGrupos', async () => {
    const { fixture, peticionYo } = configurar(undefined, []);

    peticionYo.flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });
    await fixture.whenStable();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Crea tu primer grupo familiar');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/grupos',
    );
    expect(enlace).toBeDefined();
  });
});

describe('Inicio — panel familiar', () => {
  it('sinGrupoActivoNoMuestraPanel', async () => {
    const { fixture, http, elemento } = configurarPanel({
      grupos: [grupo(1, 'Familia Soto')],
      activoInicial: null,
    });
    await fixture.whenStable();

    expect(elemento.textContent).not.toContain('Tareas de hoy');
    expect(elemento.textContent).not.toContain('Alertas de atraso');
    // Sin grupo activo no se pide nada del panel ni la lista de adultos.
    expect(http.match(() => true)).toHaveLength(0);
  });

  it('cargaLasCincoSeccionesEnParalelo', async () => {
    const { http } = configurarPanel();

    peticionAdultos(http, 1).flush([]);
    const pendientes = SUFIJOS_SECCIONES.map((sufijo) => peticionSeccion(http, 1, sufijo));
    expect(pendientes).toHaveLength(5);

    pendientes.forEach((peticion, indice) => peticion.flush(datosVaciosPara(SUFIJOS_SECCIONES[indice])));
    http.verify();
  });

  it('falloDeUnaSeccionNoBloqueaLasDemas', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);

    peticionSeccion(http, 1, 'panel/tareas').flush(
      { title: 'Error', detail: 'Error interno' },
      { status: 500, statusText: 'Error' },
    );
    peticionSeccion(http, 1, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    expect(elemento.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar esta sección.',
    );
    expect(elemento.textContent).toContain('No hay alertas de atraso.');
    expect(elemento.textContent).toContain('No hay horarios en las próximas 24 horas.');
    expect(elemento.textContent).toContain('No hay citas en los próximos 14 días.');
    expect(elemento.textContent).toContain('No hay alertas preventivas abiertas.');
    http.verify();
  });

  it('vacioYErrorSeDistinguen', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);

    peticionSeccion(http, 1, 'panel/tareas').flush(panelTareasVacio());
    peticionSeccion(http, 1, 'panel/alertas').flush(
      { title: 'Error' },
      { status: 500, statusText: 'Error' },
    );
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    expect(elemento.querySelectorAll('[role="status"]').length).toBeGreaterThanOrEqual(4);
    expect(elemento.querySelectorAll('[role="alert"]')).toHaveLength(1);
    http.verify();
  });

  it('reintentoSoloRepiteLaSeccionFallida', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);

    peticionSeccion(http, 1, 'panel/tareas').flush(
      { title: 'Error' },
      { status: 500, statusText: 'Error' },
    );
    peticionSeccion(http, 1, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();

    // Solo 1 petición nueva, y es la de la sección que falló.
    peticionSeccion(http, 1, 'panel/tareas').flush(panelTareasVacio());
    await fixture.whenStable();
    http.verify();
  });

  it('cambioDeAdultoRecargaConIdAdulto', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([adulto(201, 'Rosa Pérez')]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    const select = elemento.querySelector<HTMLSelectElement>('#panel-filtro-adulto')!;
    const opcion = Array.from(select.options).find((o) => o.textContent?.includes('Rosa Pérez'))!;
    select.value = opcion.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    for (const sufijo of SUFIJOS_SECCIONES) {
      const peticion = peticionSeccion(http, 1, sufijo);
      expect(peticion.request.params.get('idAdulto')).toBe('201');
      peticion.flush(datosVaciosPara(sufijo));
    }
    await fixture.whenStable();

    // El selector no se vuelve a pedir al cambiar de adulto (solo al cambiar de grupo, regla 11).
    expect(http.match(() => true)).toHaveLength(0);
  });

  it('respuestaTardiaDeAdultosDelGrupoAnteriorSeDescarta', async () => {
    const grupo1 = grupo(1, 'Familia Soto');
    const grupo2 = grupo(2, 'Familia Pérez');
    const { fixture, http, activo, elemento } = configurarPanel({
      grupos: [grupo1, grupo2],
      activoInicial: grupo1,
    });
    await fixture.whenStable();

    // La lista de adultos del grupo 1 queda pendiente (no se flushea todavía).
    const adultosGrupo1 = peticionAdultos(http, 1);
    flushTodasLasSecciones(http, 1);

    activo.set(grupo2);
    await fixture.whenStable();

    const adultosGrupo2 = peticionAdultos(http, 2);
    flushTodasLasSecciones(http, 2);
    adultosGrupo2.flush([adulto(301, 'Pedro Soto')]);
    await fixture.whenStable();

    // La petición del grupo 1 se cancela al cambiar de grupo (M-1: la misma
    // suscripción se cancela antes de pedir la lista del grupo vigente), así
    // que ya no puede "llegar tarde" y pisar la lista del grupo 2.
    expect(adultosGrupo1.cancelled).toBe(true);

    expect(elemento.textContent).toContain('Pedro Soto');
    expect(elemento.textContent).not.toContain('Rosa Pérez');
    http.verify();
  });

  it('seleccionarAdultoYCambiarDeGrupoVuelveATodos', async () => {
    const grupo1 = grupo(1, 'Familia Soto');
    const grupo2 = grupo(2, 'Familia Pérez');
    const { fixture, http, activo, elemento } = configurarPanel({
      grupos: [grupo1, grupo2],
      activoInicial: grupo1,
    });
    await fixture.whenStable();

    peticionAdultos(http, 1).flush([adulto(201, 'Rosa Pérez')]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    const select = elemento.querySelector<HTMLSelectElement>('#panel-filtro-adulto')!;
    const opcionRosa = Array.from(select.options).find((o) => o.textContent?.includes('Rosa Pérez'))!;
    select.value = opcionRosa.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    for (const sufijo of SUFIJOS_SECCIONES) {
      const peticion = peticionSeccion(http, 1, sufijo);
      expect(peticion.request.params.get('idAdulto')).toBe('201');
      peticion.flush(datosVaciosPara(sufijo));
    }
    await fixture.whenStable();

    expect(select.value).toBe(opcionRosa.value);

    activo.set(grupo2);
    await fixture.whenStable();

    // El selector vuelve a "Todos" en el DOM (regla 11), no solo en el signal interno.
    const opcionTodos = Array.from(select.options).find((o) => o.textContent?.trim() === 'Todos')!;
    expect(select.value).toBe(opcionTodos.value);

    peticionAdultos(http, 2).flush([]);
    for (const sufijo of SUFIJOS_SECCIONES) {
      const peticion = peticionSeccion(http, 2, sufijo);
      // Sin `idAdulto`: el cambio de grupo recargó con el selector en "Todos".
      expect(peticion.request.params.has('idAdulto')).toBe(false);
      peticion.flush(datosVaciosPara(sufijo));
    }
    await fixture.whenStable();

    http.verify();
  });

  it('cambioDeGrupoDescartaRespuestasTardias', async () => {
    const grupo1 = grupo(1, 'Familia Soto');
    const grupo2 = grupo(2, 'Familia Pérez');
    const { fixture, http, activo, elemento } = configurarPanel({
      grupos: [grupo1, grupo2],
      activoInicial: grupo1,
    });
    await fixture.whenStable();

    peticionAdultos(http, 1).flush([]);
    const tareasGrupo1 = peticionSeccion(http, 1, 'panel/tareas');
    peticionSeccion(http, 1, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());

    activo.set(grupo2);
    await fixture.whenStable();

    // `limpiar()` cancela la suscripción en vuelo del grupo anterior (regla 11): una
    // respuesta tardía de esa petición ya no podría aplicarse nunca.
    expect(tareasGrupo1.cancelled).toBe(true);

    // Cambio de grupo: el selector de adulto se recarga desde cero.
    peticionAdultos(http, 2).flush([]);

    peticionSeccion(http, 2, 'panel/tareas').flush({ ...panelTareasVacio(), pendientes: 3 });
    peticionSeccion(http, 2, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 2, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 2, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 2, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Pendientes: 3');
    http.verify();
  });

  it('alDestruirSeCancelanLasPeticionesDeLasSeccionesYDelSelectorDeAdultos', async () => {
    const { fixture, http } = configurarPanel();

    // Deja las 5 peticiones del panel y la del selector de adultos en vuelo (M-1).
    const peticionesSecciones = SUFIJOS_SECCIONES.map((sufijo) => peticionSeccion(http, 1, sufijo));
    const adultos = peticionAdultos(http, 1);

    fixture.destroy();

    expect(adultos.cancelled).toBe(true);
    for (const peticion of peticionesSecciones) {
      expect(peticion.cancelled).toBe(true);
    }
  });

  it('atrasadaEnlazaALaTareaYAlertaALaAlerta', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);

    peticionSeccion(http, 1, 'panel/tareas').flush({
      ...panelTareasVacio(),
      pendientes: 1,
      atrasadas: 1,
      tareasAtrasadas: [tarea({ idTarea: 501, titulo: 'Retirar medicamento' })],
    });
    peticionSeccion(http, 1, 'panel/alertas').flush({
      abiertas: 1,
      cerradasUltimos7Dias: 0,
      recientes: [alerta({ idAlerta: 701 })],
    });
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    const enlaceTarea = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/tareas/501',
    );
    expect(enlaceTarea).toBeDefined();

    const enlaceAlerta = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/alertas/701',
    );
    expect(enlaceAlerta).toBeDefined();
    http.verify();
  });
});

describe('Inicio — refresco del panel', () => {
  beforeEach(() => {
    // Solo el reloj del intervalo de refresco (setInterval + Date): el resto sigue con timers reales.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refrescaCadaDosMinutosSoloVisible', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { fixture, http } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    await fixture.whenStable();

    // El refresco silencioso vuelve a pedir las 5 secciones (no la lista de adultos).
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();
    http.verify();
  });

  it('noRefrescaOcultaYRefrescaAlVolver', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const { fixture, http } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    await fixture.whenStable();

    // Oculta: el intervalo no dispara ninguna petición nueva.
    expect(http.match(() => true)).toHaveLength(0);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    // Al volver a visible, refresca de inmediato.
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();
  });

  it('refrescoFallidoMuestraNoSePudoActualizarConDatos', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    await fixture.whenStable();

    peticionSeccion(http, 1, 'panel/tareas').flush(
      { title: 'Error' },
      { status: 500, statusText: 'Error' },
    );
    peticionSeccion(http, 1, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();

    expect(elemento.textContent).toContain('No se pudo actualizar.');
    // Conserva los datos (vacío) de la carga anterior: no vuelve a "Cargando…" ni a un error duro.
    expect(elemento.textContent).toContain('No hay tareas para hoy ni atrasadas.');
    http.verify();
  });

  it('reintentarEnSeccionDesactualizadaNoBorraLosDatosSiVuelveAFallar', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    // El refresco de las 2 minutos falla: la sección queda "desactualizada" pero conserva los datos.
    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    await fixture.whenStable();
    peticionSeccion(http, 1, 'panel/tareas').flush(
      { title: 'Error' },
      { status: 500, statusText: 'Error' },
    );
    peticionSeccion(http, 1, 'panel/alertas').flush(panelAlertasVacio());
    peticionSeccion(http, 1, 'panel/proximos-horarios').flush(panelHorariosVacio());
    peticionSeccion(http, 1, 'panel/citas').flush(panelCitasVacio());
    peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(panelPreventivasVacio());
    await fixture.whenStable();
    expect(elemento.textContent).toContain('No se pudo actualizar.');

    // La persona aprieta "Reintentar" en el aviso de desactualizada (I-1): mientras espera,
    // los datos nunca desaparecen (no pasa por "Cargando…").
    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();
    expect(elemento.textContent).toContain('No hay tareas para hoy ni atrasadas.');
    expect(elemento.textContent).not.toContain('Cargando…');

    // Si la red sigue caída, la sección sigue mostrando los datos y el aviso, no un error duro.
    peticionSeccion(http, 1, 'panel/tareas').flush(
      { title: 'Error' },
      { status: 500, statusText: 'Error' },
    );
    await fixture.whenStable();

    expect(elemento.textContent).toContain('No se pudo actualizar.');
    expect(elemento.textContent).toContain('No hay tareas para hoy ni atrasadas.');
    expect(elemento.textContent).not.toContain('No se pudo cargar esta sección.');
    http.verify();
  });

  it('cambiosRapidosDePestanaNoGeneranRafagas', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { fixture, http } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    // 3 regresos a "visible" en menos de 30 s desde la carga inicial: ninguno debe
    // generar una petición nueva (antirrebote de M-5).
    for (let vez = 0; vez < 3; vez++) {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }
    await fixture.whenStable();
    expect(http.match(() => true)).toHaveLength(0);

    // Pasados los 30 s desde la carga inicial, un nuevo regreso a "visible" sí refresca
    // (y reinicia el intervalo de 2 minutos desde ese momento).
    vi.advanceTimersByTime(30_000);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();
    http.verify();
  });

  it('alDestruirSeCancelaElIntervalo', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { fixture, http } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    fixture.destroy();

    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS * 3);
    expect(http.match(() => true)).toHaveLength(0);

    // M-6: también se quitó el listener de `visibilitychange` (no solo el intervalo).
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(http.match(() => true)).toHaveLength(0);
  });
});
