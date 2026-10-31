import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { Inicio } from './inicio';
import { AvisoSucesion } from './aviso-sucesion/aviso-sucesion';
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
import { fechaHoraLegible, fechaLegible } from '../../nucleo/fecha-legible';

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

/**
 * `AvisoSucesion` es autónomo y hace sus propias peticiones
 * (`/api/yo`, `/sucesion/activa`): tiene su propio spec. Aquí se sustituye
 * por un doble sin dependencias para que el `HttpTestingController` de
 * estas pruebas siga viendo solo las peticiones de `Inicio`.
 */
@Component({ selector: 'app-aviso-sucesion', template: '<p class="aviso-sucesion-doble"></p>' })
class AvisoSucesionDoble {}

function sustituirAvisoSucesion(): void {
  TestBed.overrideComponent(Inicio, {
    remove: { imports: [AvisoSucesion] },
    add: { imports: [AvisoSucesionDoble] },
  });
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
  sustituirAvisoSucesion();
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
  sustituirAvisoSucesion();
  const fixture = TestBed.createComponent(Inicio);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();

  http
    .expectOne((req) => req.method === 'GET' && req.url.endsWith('/api/yo'))
    .flush({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', esAdministrador: false });

  return { fixture, http, activo, elemento: fixture.nativeElement as HTMLElement };
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

function textoIndicadores(elemento: HTMLElement, etiqueta: string): string[] {
  return Array.from(
    elemento.querySelectorAll(`ul.mv-indicadores[aria-label="${etiqueta}"] > li.mv-indicador`),
  ).map((li) => normalizar(li.textContent));
}

function responderPanel(
  http: HttpTestingController,
  datos: {
    tareas?: RespuestaPanelTareas;
    alertas?: RespuestaPanelAlertas;
    horarios?: RespuestaPanelHorarios;
    citas?: RespuestaPanelCitas;
    preventivas?: RespuestaPanelPreventivas;
  },
): void {
  peticionSeccion(http, 1, 'panel/tareas').flush(datos.tareas ?? panelTareasVacio());
  peticionSeccion(http, 1, 'panel/alertas').flush(datos.alertas ?? panelAlertasVacio());
  peticionSeccion(http, 1, 'panel/proximos-horarios').flush(datos.horarios ?? panelHorariosVacio());
  peticionSeccion(http, 1, 'panel/citas').flush(datos.citas ?? panelCitasVacio());
  peticionSeccion(http, 1, 'panel/alertas-preventivas').flush(
    datos.preventivas ?? panelPreventivasVacio(),
  );
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

  it('avisoSucesionSoloSeColocaConGrupoActivo', async () => {
    const conGrupo = configurarPanel();
    await conGrupo.fixture.whenStable();
    expect(conGrupo.elemento.querySelector('app-aviso-sucesion')).toBeTruthy();

    TestBed.resetTestingModule();
    const sinGrupo = configurarPanel({ activoInicial: null });
    await sinGrupo.fixture.whenStable();
    expect(sinGrupo.elemento.querySelector('app-aviso-sucesion')).toBeFalsy();
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

    // El selector no se vuelve a pedir al cambiar de adulto (solo al cambiar de grupo).
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

    // La petición del grupo 1 se cancela al cambiar de grupo (la misma
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

    // El selector vuelve a "Todos" en el DOM, no solo en el signal interno.
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

    // `limpiar()` cancela la suscripción en vuelo del grupo anterior: una
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

    expect(textoIndicadores(elemento, 'Tareas de hoy')).toContain('3 pendientes');
    http.verify();
  });

  it('alDestruirSeCancelanLasPeticionesDeLasSeccionesYDelSelectorDeAdultos', async () => {
    const { fixture, http } = configurarPanel();

    // Deja las 5 peticiones del panel y la del selector de adultos en vuelo.
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

    // La persona aprieta "Reintentar" en el aviso de desactualizada: mientras espera,
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
    // generar una petición nueva (antirrebote).
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

    // También se quitó el listener de `visibilitychange` (no solo el intervalo).
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(http.match(() => true)).toHaveLength(0);
  });
});

describe('Inicio — presentación del panel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('encabezadoConRotuloSaludoYGrupoActivo', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    const encabezado = elemento.querySelector('header.mv-encabezado')!;
    expect(encabezado.querySelector('.mv-encabezado__rotulo')?.textContent).toContain('Panel familiar');
    expect(encabezado.querySelector('h1.mv-encabezado__titulo')?.textContent).toContain('Hola, Ana');
    expect(encabezado.querySelector('.mv-encabezado__bajada')?.textContent).toContain('Familia Soto');
  });

  it('conteosDeTareasSeLeenCompletosEnIndicadores', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    responderPanel(http, {
      tareas: {
        ...panelTareasVacio(),
        pendientes: 2,
        enCurso: 1,
        completadas: 5,
        atrasadas: 1,
        noRealizadas: 1,
        canceladas: 3,
      },
    });
    await fixture.whenStable();

    expect(textoIndicadores(elemento, 'Tareas de hoy')).toEqual([
      '2 pendientes',
      '1 en curso',
      '5 completadas',
      '1 atrasada',
    ]);
    const secundarios = Array.from(
      elemento.querySelectorAll('ul[aria-label="Otras tareas de hoy"] > li'),
    ).map((li) => normalizar(li.textContent));
    expect(secundarios).toEqual(['1 no realizada', '3 canceladas']);

    const tonos = Array.from(
      elemento.querySelectorAll('ul.mv-indicadores[aria-label="Tareas de hoy"] > li'),
    ).map((li) => li.className);
    expect(tonos[0]).toContain('mv-indicador--alerta');
    expect(tonos[2]).toContain('mv-indicador--exito');
    expect(tonos[3]).toContain('mv-indicador--peligro');
  });

  it('conteosDeAlertasSeLeenCompletosEnIndicadores', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    responderPanel(http, { alertas: { abiertas: 4, cerradasUltimos7Dias: 1, recientes: [] } });
    await fixture.whenStable();

    expect(textoIndicadores(elemento, 'Resumen de alertas de atraso')).toEqual([
      '4 abiertas',
      '1 cerrada (7 días)',
    ]);
  });

  it('listasSonFilasConFechaDestacadaTituloYAdulto', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    responderPanel(http, {
      tareas: {
        ...panelTareasVacio(),
        atrasadas: 1,
        tareasAtrasadas: [
          tarea({
            idTarea: 501,
            titulo: 'Ibuprofeno 500 mg',
            nombreAdulto: 'Rosa Elena Rojas Muñoz',
            fechaHorario: '2026-10-26T20:30:00-03:00',
          }),
        ],
      },
      citas: {
        citas: [
          tarea({
            idTarea: 601,
            titulo: 'Control cardiología',
            fechaHorario: '2026-11-03T10:00:00-03:00',
            cita: { nombreMedico: 'Dra. Paz', lugarAtencion: 'Clínica Norte', observaciones: null },
          }),
        ],
      },
      preventivas: {
        alertas: [alerta({ idAlerta: 801, tipoAlerta: 'REPOSICION_MEDICAMENTO', fechaProgramada: '2026-11-04' })],
      },
    });
    await fixture.whenStable();

    const fila = elemento.querySelector<HTMLElement>('a[href="/tareas/501"]')!.closest('li.mv-fila')!;
    expect(fila.closest('ul.mv-lista')).toBeTruthy();
    expect(normalizar(fila.querySelector('.mv-fila__dato')?.textContent)).toBe('Lun 26 oct · 20:30');
    expect(normalizar(fila.querySelector('.mv-fila__titulo')?.textContent)).toBe('Ibuprofeno 500 mg');
    expect(fila.querySelector('.mv-fila__meta')?.textContent).toContain('Rosa Elena Rojas Muñoz');
    expect(fila.querySelector('.mv-chip')?.textContent).toContain('Atrasada');

    const filaCita = elemento.querySelector<HTMLElement>('a[href="/tareas/601"]')!.closest('li.mv-fila')!;
    expect(filaCita.querySelector('.mv-fila__meta')?.textContent).toContain('Dra. Paz');
    expect(filaCita.querySelector('.mv-fila__meta')?.textContent).toContain('Clínica Norte');

    const filaPreventiva = elemento.querySelector<HTMLElement>('a[href="/alertas/801"]')!.closest('li.mv-fila')!;
    expect(normalizar(filaPreventiva.querySelector('.mv-fila__dato')?.textContent)).toBe('Mié 4 nov');
    expect(filaPreventiva.querySelector('.mv-fila__titulo')?.textContent).toContain(
      'Reposición de medicamento',
    );
    http.verify();
  });

  it('alertasRecientesSonFilasConChipDeEstado', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    responderPanel(http, {
      alertas: {
        abiertas: 1,
        cerradasUltimos7Dias: 1,
        recientes: [
          alerta({ idAlerta: 701 }),
          alerta({ idAlerta: 702, fechaRevision: '2026-11-02T12:00:00-03:00' }),
        ],
      },
    });
    await fixture.whenStable();

    const abierta = elemento.querySelector('a[href="/alertas/701"]')!.closest('li.mv-fila')!;
    expect(abierta.querySelector('.mv-chip')?.textContent).toContain('Abierta');
    const cerrada = elemento.querySelector('a[href="/alertas/702"]')!.closest('li.mv-fila')!;
    expect(cerrada.querySelector('.mv-chip')?.textContent).toContain('Cerrada');
  });

  it('relevosYEstadoDelServicioSonAccesosCompactosAlFinal', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    const accesos = elemento.querySelector('nav[aria-label="Accesos"]')!;
    expect(accesos.querySelector('a[href="/relevos"]')).toBeTruthy();
    expect(accesos.querySelector('a[href="/estado"]')).toBeTruthy();
    // Van después del panel: no ocupan la primera pantalla.
    const panel = elemento.querySelector('#panel-titulo')!;
    expect(panel.compareDocumentPosition(accesos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('estadoDelServicioSigueVisibleSinGrupoActivo', async () => {
    const { fixture, elemento } = configurarPanel({ activoInicial: null });
    await fixture.whenStable();

    expect(elemento.querySelector('a[href="/estado"]')).toBeTruthy();
    expect(elemento.querySelector('a[href="/relevos"]')).toBeFalsy();
  });

  it('listasLargasSeAcortanYEnlazanAVerTodas', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    const tareas = (n: number, base: number) =>
      Array.from({ length: n }, (_, i) => tarea({ idTarea: base + i, titulo: `Tarea ${base + i}` }));
    responderPanel(http, {
      tareas: { ...panelTareasVacio(), atrasadas: 16, tareasAtrasadas: tareas(5, 500) },
      alertas: {
        abiertas: 4,
        cerradasUltimos7Dias: 0,
        recientes: Array.from({ length: 4 }, (_, i) => alerta({ idAlerta: 700 + i })),
      },
      horarios: { tareas: tareas(6, 900) },
    });
    await fixture.whenStable();

    const filas = (etiqueta: string) =>
      elemento.querySelectorAll(`ul.mv-lista[aria-label="${etiqueta}"] > li.mv-fila`).length;
    expect(filas('Tareas atrasadas')).toBe(3);
    expect(filas('Alertas recientes')).toBe(3);
    expect(filas('Próximos horarios')).toBe(5);

    const enlaces = Array.from(elemento.querySelectorAll<HTMLAnchorElement>('a.mv-boton--texto')).map(
      (a) => [normalizar(a.textContent), a.getAttribute('href')],
    );
    expect(enlaces).toContainEqual(['Ver las 16 tareas atrasadas', '/tareas']);
    expect(enlaces).toContainEqual(['Ver todas las alertas', '/alertas']);
    expect(enlaces).toContainEqual(['Ver tareas', '/tareas']);
  });

  it('listasCortasNoMuestranVerTodas', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    const tareas = (n: number, base: number) =>
      Array.from({ length: n }, (_, i) => tarea({ idTarea: base + i }));
    responderPanel(http, {
      tareas: { ...panelTareasVacio(), atrasadas: 3, tareasAtrasadas: tareas(3, 500) },
      alertas: {
        abiertas: 3,
        cerradasUltimos7Dias: 0,
        recientes: Array.from({ length: 3 }, (_, i) => alerta({ idAlerta: 700 + i })),
      },
      horarios: { tareas: tareas(5, 900) },
    });
    await fixture.whenStable();

    const textos = Array.from(elemento.querySelectorAll('a.mv-boton--texto')).map((a) =>
      normalizar(a.textContent),
    );
    expect(textos.some((t) => t.startsWith('Ver '))).toBe(false);
  });

  it('filtroDeAdultoEsUnaFilaCompactaSinTarjeta', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    flushTodasLasSecciones(http, 1);
    await fixture.whenStable();

    const select = elemento.querySelector('#panel-filtro-adulto')!;
    expect(select.closest('.mv-filtros, .mv-tarjeta')).toBeNull();
    expect(select.closest('.mv-campo')?.querySelector('label[for="panel-filtro-adulto"]')).toBeTruthy();
  });

  it('seccionesCargandoMuestranEsqueleto', async () => {
    const { fixture, elemento } = configurarPanel();
    await fixture.whenStable();

    expect(elemento.querySelectorAll('app-seccion-panel .mv-esqueleto').length).toBeGreaterThanOrEqual(5);
  });

  it('enlacesDeFilaTienenNombreAccesibleUnicoConAdultoYFecha', async () => {
    const { fixture, http, elemento } = configurarPanel();
    peticionAdultos(http, 1).flush([]);
    const repetida = (idTarea: number, nombreAdulto: string, fechaHorario: string) =>
      tarea({ idTarea, titulo: 'Paracetamol', nombreAdulto, fechaHorario });
    responderPanel(http, {
      tareas: {
        ...panelTareasVacio(),
        atrasadas: 2,
        tareasAtrasadas: [
          repetida(501, 'Rosa Pérez', '2026-10-26T08:00:00-03:00'),
          repetida(502, 'Juan Soto', '2026-10-26T08:00:00-03:00'),
        ],
      },
      alertas: {
        abiertas: 2,
        cerradasUltimos7Dias: 0,
        recientes: [
          alerta({ idAlerta: 701, tituloTarea: 'Paracetamol', fechaDeteccion: '2026-10-26T08:30:00-03:00' }),
          alerta({ idAlerta: 702, tituloTarea: 'Paracetamol', fechaDeteccion: '2026-10-26T20:30:00-03:00' }),
        ],
      },
      horarios: {
        tareas: [
          repetida(901, 'Rosa Pérez', '2026-11-02T08:00:00-03:00'),
          repetida(902, 'Rosa Pérez', '2026-11-02T20:00:00-03:00'),
        ],
      },
      citas: {
        citas: [tarea({ idTarea: 601, titulo: 'Control', fechaHorario: '2026-11-03T10:00:00-03:00' })],
      },
      preventivas: {
        alertas: [
          alerta({
            idAlerta: 801,
            tipoAlerta: 'REPOSICION_MEDICAMENTO',
            nombreMedicamento: 'Losartán',
            fechaProgramada: '2026-11-04',
          }),
        ],
      },
    });
    await fixture.whenStable();

    const etiqueta = (href: string) =>
      elemento.querySelector(`a.mv-fila__enlace[href="${href}"]`)?.getAttribute('aria-label');
    expect(etiqueta('/tareas/501')).toBe(
      `Paracetamol, Rosa Pérez, ${fechaHoraLegible('2026-10-26T08:00:00-03:00')}`,
    );
    expect(etiqueta('/tareas/502')).toBe(
      `Paracetamol, Juan Soto, ${fechaHoraLegible('2026-10-26T08:00:00-03:00')}`,
    );
    expect(etiqueta('/alertas/701')).toBe(
      `Paracetamol, Rosa Pérez, ${fechaHoraLegible('2026-10-26T08:30:00-03:00')}`,
    );
    expect(etiqueta('/alertas/702')).toBe(
      `Paracetamol, Rosa Pérez, ${fechaHoraLegible('2026-10-26T20:30:00-03:00')}`,
    );
    expect(etiqueta('/tareas/901')).toBe(
      `Paracetamol, Rosa Pérez, ${fechaHoraLegible('2026-11-02T08:00:00-03:00')}`,
    );
    expect(etiqueta('/tareas/902')).toBe(
      `Paracetamol, Rosa Pérez, ${fechaHoraLegible('2026-11-02T20:00:00-03:00')}`,
    );
    expect(etiqueta('/tareas/601')).toBe(
      `Control, Rosa Pérez, ${fechaHoraLegible('2026-11-03T10:00:00-03:00')}`,
    );
    expect(etiqueta('/alertas/801')).toBe(
      `Reposición de medicamento, Rosa Pérez, Losartán, ${fechaLegible('2026-11-04')}`,
    );

    const enlaces = Array.from(elemento.querySelectorAll('a.mv-fila__enlace'));
    const nombres = enlaces.map((a) => a.getAttribute('aria-label'));
    expect(nombres.every((n) => !!n)).toBe(true);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
