import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Relevo } from './relevo';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaDetalleRelevo, RespuestaRelevo } from '../../nucleo/relevos/modelos-relevos';
import { ServicioRelevos } from '../../nucleo/relevos/servicio-relevos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ID_ESTADO_COMPLETADA = 160;
const ID_ESTADO_CANCELADA = 161;
const ESTADOS_RELEVO: RespuestaEstadoCatalogo[] = [
  { idEstado: ID_ESTADO_COMPLETADA, codigo: 'COMPLETADA', descripcion: 'Completada', orden: 1 },
  { idEstado: ID_ESTADO_CANCELADA, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 2 },
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

function persona(idUsuario: number, nombre: string) {
  return { idUsuario, nombre };
}

function elementoDetalle(datos: Partial<RespuestaDetalleRelevo> = {}): RespuestaDetalleRelevo {
  return {
    idDetalle: 1,
    tipoElemento: 'TAREA',
    idReferencia: 10,
    resumen: 'Comprar Losartán · 02-11 08:00 · Pendiente · Responsable: Ana Rojas',
    ...datos,
  };
}

function relevo(datos: Partial<RespuestaRelevo> = {}): RespuestaRelevo {
  return {
    idRelevo: 9,
    idGrupo: 1,
    nombreGrupo: 'Familia Rojas',
    idAdulto: 5,
    nombreAdulto: 'Rosa González',
    saliente: persona(300, 'Ana Rojas'),
    entrante: persona(301, 'Beto Díaz'),
    creador: persona(300, 'Ana Rojas'),
    fechaTraspaso: '2026-11-02T08:00:00-03:00',
    notas: null,
    idEstado: ID_ESTADO_COMPLETADA,
    codigoEstado: 'COMPLETADA',
    totalTareas: 1,
    totalAlertas: 1,
    detalles: [
      elementoDetalle({
        idDetalle: 1,
        tipoElemento: 'TAREA',
        idReferencia: 10,
        resumen: 'Resumen tarea',
      }),
      elementoDetalle({
        idDetalle: 2,
        tipoElemento: 'ALERTA',
        idReferencia: 20,
        resumen: 'Resumen alerta',
      }),
    ],
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  obtenerImpl?: () => Observable<RespuestaRelevo>;
  cancelarImpl?: ReturnType<typeof vi.fn>;
  idUsuario?: number;
  esAdministrador?: boolean;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );

  const servicioRelevos = {
    obtener: vi.fn(opciones.obtenerImpl ?? (() => of(relevo()))),
    cancelar: opciones.cancelarImpl ?? vi.fn(() => of(relevo({ idEstado: ID_ESTADO_CANCELADA }))),
    listar: vi.fn(),
    registrar: vi.fn(),
  };
  const servicioCatalogos = { estados: vi.fn(() => of(ESTADOS_RELEVO)) };

  TestBed.configureTestingModule({
    imports: [Relevo],
    providers: [
      provideRouter([]),
      // ServicioTareas real contra HttpTestingController: se verifica el PUT de asignación tal cual.
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ idRelevo: '9' }) } },
      },
      { provide: ServicioRelevos, useValue: servicioRelevos },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({
              idUsuario: opciones.idUsuario ?? 300,
              nombre: 'Ana',
              email: 'ana@correo.cl',
              telefono: null,
              esAdministrador: opciones.esAdministrador ?? false,
            }),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(Relevo);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioRelevos,
    http: TestBed.inject(HttpTestingController),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

function tareaDetalle(idDetalle: number, idReferencia: number, resumen: string) {
  return elementoDetalle({ idDetalle, tipoElemento: 'TAREA', idReferencia, resumen });
}

/** Relevo con 3 tareas pendientes (10, 11, 12) y una alerta. */
function relevoConTresTareas(datos: Partial<RespuestaRelevo> = {}): RespuestaRelevo {
  return relevo({
    totalTareas: 3,
    detalles: [
      tareaDetalle(1, 10, 'Tarea uno'),
      tareaDetalle(2, 11, 'Tarea dos'),
      tareaDetalle(3, 12, 'Tarea tres'),
      elementoDetalle({
        idDetalle: 4,
        tipoElemento: 'ALERTA',
        idReferencia: 20,
        resumen: 'Alerta',
      }),
    ],
    ...datos,
  });
}

function filaDeTarea(elemento: HTMLElement, resumen: string): HTMLElement {
  const fila = Array.from(elemento.querySelectorAll<HTMLElement>('.item-resumen')).find((li) =>
    li.textContent?.includes(resumen),
  );
  if (!fila) throw new Error(`Sin fila "${resumen}"`);
  return fila;
}

function urlAsignacion(idTarea: number): (req: { method: string; url: string }) => boolean {
  return (req) =>
    req.method === 'PUT' && req.url.endsWith(`/api/grupos/1/tareas/${idTarea}/asignacion`);
}

const ERROR_422 = { status: 422, statusText: 'Unprocessable Entity' };

const MOTIVO_ESPERADO = 'Relevo del 02-11-2026 08:00';

describe('Relevo', () => {
  it('detalleMuestraResumenConEnlacesYAvisoDeFoto', async () => {
    const { elemento } = await configurar();

    expect(elemento.textContent).toContain('Resumen tarea');
    expect(elemento.textContent).toContain('Resumen alerta');
    expect(
      elemento.textContent?.includes(
        'Este resumen es una foto del momento del relevo; los estados actuales pueden haber cambiado.',
      ),
    ).toBe(true);

    const enlaceTarea = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Resumen tarea',
    );
    expect(enlaceTarea?.getAttribute('href')).toBe('/tareas/10');

    const enlaceAlerta = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Resumen alerta',
    );
    expect(enlaceAlerta?.getAttribute('href')).toBe('/alertas/20');
  });

  it('estadoConDescripcionDelCatalogo', async () => {
    const { elemento } = await configurar();

    expect(elemento.textContent).toContain('Completada');
    expect(elemento.textContent).not.toContain('COMPLETADA');
  });

  it('chipCanceladaUsaElColorDeAdvertenciaNoElDeExito', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of(relevo({ idEstado: ID_ESTADO_CANCELADA, codigoEstado: 'CANCELADA' })),
    });

    const chip = elemento.querySelector('.mv-encabezado .mv-chip')!;
    expect(chip.textContent?.trim()).toBe('Cancelada');
    expect(chip.classList.contains('mv-chip--alerta')).toBe(true);
    expect(chip.classList.contains('mv-chip--exito')).toBe(false);
  });

  it('chipCompletadaNoUsaElColorDeCancelada', async () => {
    const { elemento } = await configurar();

    const chip = elemento.querySelector('.mv-encabezado .mv-chip')!;
    expect(chip.textContent?.trim()).toBe('Completada');
    expect(chip.classList.contains('mv-chip--alerta')).toBe(false);
    expect(chip.classList.contains('mv-chip--exito')).toBe(true);
  });

  it('cancelarSoloVisibleParaCreadorOCoordinador', async () => {
    // El creador (idUsuario 300), aunque sea colaborador, ve "Cancelar relevo".
    const creador = await configurar({ activo: grupo(1, 'COLABORADOR'), idUsuario: 300 });
    expect(botonConTexto(creador.elemento, 'Cancelar relevo')).toBeTruthy();

    // El coordinador del grupo, aunque no sea el creador, también lo ve.
    TestBed.resetTestingModule();
    const coordinador = await configurar({ activo: grupo(1, 'COORDINADOR'), idUsuario: 999 });
    expect(botonConTexto(coordinador.elemento, 'Cancelar relevo')).toBeTruthy();

    // Ni creador ni coordinador: no lo ve.
    TestBed.resetTestingModule();
    const otro = await configurar({ activo: grupo(1, 'COLABORADOR'), idUsuario: 999 });
    expect(botonConTexto(otro.elemento, 'Cancelar relevo')).toBeFalsy();
  });

  // La API también deja cancelar a un administrador, aunque no sea el
  // creador ni el coordinador del grupo (incluso sin membresía: `miRol` null).
  it('administradorTambienVeCancelarRelevo', async () => {
    const { elemento } = await configurar({
      activo: grupo(1, null),
      idUsuario: 999,
      esAdministrador: true,
    });

    expect(botonConTexto(elemento, 'Cancelar relevo')).toBeTruthy();
  });

  it('vacioYErrorSeDistinguen', async () => {
    const { elemento: elementoVacio } = await configurar({
      obtenerImpl: () => of(relevo({ totalTareas: 0, totalAlertas: 0, detalles: [] })),
    });
    expect(elementoVacio.querySelector('[role="status"].mv-vacio')?.textContent).toContain(
      'Sin tareas ni alertas pendientes en este resumen.',
    );
    expect(elementoVacio.querySelector('[role="alert"]')).toBeNull();

    TestBed.resetTestingModule();
    const { elemento: elementoError } = await configurar({
      obtenerImpl: () =>
        throwError(() => new HttpErrorResponse({ status: 500, error: {} })) as never,
    });
    expect(elementoError.querySelector('[role="alert"]')).toBeTruthy();
    expect(elementoError.textContent).not.toContain(
      'Sin tareas ni alertas pendientes en este resumen.',
    );
  });
  describe('presentación', () => {
    it('encabezadoConVolverTituloYEstado', async () => {
      const { elemento } = await configurar();

      const volver = elemento.querySelector<HTMLAnchorElement>('.volver')!;
      expect(volver.textContent?.trim()).toBe('Volver a relevos');
      expect(volver.getAttribute('href')).toBe('/relevos');
      expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Relevo de Rosa González');
      expect(
        elemento.querySelector('.mv-encabezado__bajada')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe('Ana Rojas entrega a Beto Díaz');
    });

    it('seccionesClarasConNotasSoloSiExisten', async () => {
      const titulos = (elemento: HTMLElement) =>
        Array.from(elemento.querySelectorAll('h2, h3')).map((h) => h.textContent?.trim());

      const conNotas = await configurar({ obtenerImpl: () => of(relevo({ notas: 'Dejé la cena lista.' })) });
      expect(titulos(conNotas.elemento)).toEqual([
        'Datos del relevo',
        'Notas',
        'Resumen al momento del relevo',
        'Tareas pendientes (1)',
        'Alertas abiertas (1)',
        'Cancelar relevo',
      ]);
      expect(conNotas.elemento.textContent).toContain('Dejé la cena lista.');

      TestBed.resetTestingModule();
      const sinNotas = await configurar();
      expect(titulos(sinNotas.elemento)).not.toContain('Notas');
    });

    it('fechaDelRelevoEsLegible', async () => {
      const { elemento } = await configurar();

      const filas = Array.from(elemento.querySelectorAll('dl > div')).map((fila) => [
        fila.querySelector('dt')?.textContent?.trim(),
        fila.querySelector('dd')?.textContent?.trim(),
      ]);
      expect(filas).toContainEqual(['Fecha', fechaHoraLegible('2026-11-02T08:00:00-03:00')]);
      expect(filas).toContainEqual(['Registrado por', 'Ana Rojas']);
    });

    it('cargandoMuestraEsqueleto', async () => {
      const { elemento } = await configurar({ obtenerImpl: () => new Subject() });

      const estado = elemento.querySelector('[role="status"]')!;
      expect(estado.textContent).toContain('Cargando relevo…');
      expect(estado.querySelector('.mv-esqueleto')).toBeTruthy();
    });

    it('errorDeCargaPermiteReintentar', async () => {
      let llamadas = 0;
      const { fixture, elemento, servicioRelevos } = await configurar({
        obtenerImpl: () =>
          ++llamadas === 1
            ? (throwError(() => new HttpErrorResponse({ status: 500, error: {} })) as never)
            : of(relevo()),
      });

      const aviso = elemento.querySelector<HTMLElement>('.mv-aviso--error[role="alert"]')!;
      expect(aviso).toBeTruthy();
      botonConTexto(aviso, 'Reintentar')!.click();
      await fixture.whenStable();

      expect(servicioRelevos.obtener).toHaveBeenCalledTimes(2);
      expect(elemento.querySelector('.mv-aviso--error')).toBeNull();
      expect(elemento.textContent).toContain('Resumen tarea');
    });
  });

  describe('reasignar tareas', () => {
    afterEach(() => TestBed.inject(HttpTestingController).verify());

    it('coordinadorVeReasignarPorTarea', async () => {
      const { elemento } = await configurar({ activo: grupo(1, 'COORDINADOR'), idUsuario: 999 });

      const fila = filaDeTarea(elemento, 'Resumen tarea');
      expect(botonConTexto(fila, 'Reasignar a Beto Díaz')).toBeTruthy();
      // Las alertas no se reasignan.
      expect(botonConTexto(filaDeTarea(elemento, 'Resumen alerta'), 'Reasignar')).toBeFalsy();
      expect(elemento.textContent).toContain(
        'Cada reasignación cambia el responsable de la tarea y queda registrada en la auditoría.',
      );
      // Se mantiene el aviso de foto.
      expect(elemento.textContent).toContain('Este resumen es una foto del momento del relevo');

      // Un administrador sin membresía también lo ve.
      TestBed.resetTestingModule();
      const administrador = await configurar({
        activo: grupo(1, null),
        idUsuario: 999,
        esAdministrador: true,
      });
      expect(botonConTexto(administrador.elemento, 'Reasignar a Beto Díaz')).toBeTruthy();
    });

    it('colaboradorNoVeReasignar', async () => {
      // Aunque sea el creador del relevo (puede cancelarlo), no es coordinador.
      const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR'), idUsuario: 300 });

      expect(botonConTexto(elemento, 'Reasignar')).toBeFalsy();
      expect(elemento.textContent).not.toContain('queda registrada en la auditoría');
      expect(elemento.textContent).toContain('Resumen tarea');
    });

    it('relevoCanceladoNoMuestraReasignar', async () => {
      const { elemento } = await configurar({
        obtenerImpl: () => of(relevo({ idEstado: ID_ESTADO_CANCELADA, codigoEstado: 'CANCELADA' })),
      });

      expect(botonConTexto(elemento, 'Reasignar')).toBeFalsy();
    });

    it('reasignarLlamaAlEndpointDeAsignacionConEntranteYMotivo', async () => {
      const { fixture, elemento, http } = await configurar();

      botonConTexto(filaDeTarea(elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!.click();
      await fixture.whenStable();

      const peticion = http.expectOne(urlAsignacion(10));
      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.body).toEqual({ idUsuario: 301, motivo: MOTIVO_ESPERADO });
      peticion.flush({});
    });

    it('reasignarOkMuestraReasignadaYOcultaBoton', async () => {
      const { fixture, elemento, http } = await configurar();

      botonConTexto(filaDeTarea(elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!.click();
      await fixture.whenStable();
      http.expectOne(urlAsignacion(10)).flush({});
      await fixture.whenStable();

      const fila = filaDeTarea(elemento, 'Resumen tarea');
      expect(fila.querySelector('[role="status"]')?.textContent?.trim()).toBe(
        'Reasignada a Beto Díaz',
      );
      expect(botonConTexto(fila, 'Reasignar')).toBeFalsy();
    });

    it('reasignarErrorMuestraMensajeEnAlert', async () => {
      const { fixture, elemento, http } = await configurar();

      botonConTexto(filaDeTarea(elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!.click();
      await fixture.whenStable();
      http
        .expectOne(urlAsignacion(10))
        .flush({ detail: 'La tarea ya está finalizada; no se puede reasignar' }, ERROR_422);
      await fixture.whenStable();

      const fila = filaDeTarea(elemento, 'Resumen tarea');
      expect(fila.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        'La tarea ya está finalizada; no se puede reasignar',
      );
      // 422 es definitivo: el botón queda, pero deshabilitado.
      expect(botonConTexto(fila, 'Reasignar a Beto Díaz')!.disabled).toBe(true);

      // Un error no definitivo (500) deja el botón disponible para reintentar.
      TestBed.resetTestingModule();
      const otro = await configurar();
      botonConTexto(filaDeTarea(otro.elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!.click();
      await otro.fixture.whenStable();
      otro.http.expectOne(urlAsignacion(10)).flush({}, { status: 500, statusText: 'Server Error' });
      await otro.fixture.whenStable();
      const filaOtro = filaDeTarea(otro.elemento, 'Resumen tarea');
      expect(filaOtro.querySelector('[role="alert"]')).toBeTruthy();
      expect(botonConTexto(filaOtro, 'Reasignar a Beto Díaz')!.disabled).toBe(false);
    });

    it('yaAsignadaSeMuestraComoInformativo', async () => {
      const { fixture, elemento, http } = await configurar();

      botonConTexto(filaDeTarea(elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!.click();
      await fixture.whenStable();
      http
        .expectOne(urlAsignacion(10))
        .flush({ detail: 'La tarea ya está asignada a ese integrante' }, ERROR_422);
      await fixture.whenStable();

      const fila = filaDeTarea(elemento, 'Resumen tarea');
      expect(fila.querySelector('[role="alert"]')).toBeNull();
      expect(fila.querySelector('[role="status"]')?.textContent?.trim()).toBe(
        'Ya estaba asignada a Beto Díaz',
      );
      expect(botonConTexto(fila, 'Reasignar')).toBeFalsy();
    });

    it('reasignarTodasPideConfirmacion', async () => {
      const { fixture, elemento, http } = await configurar({
        obtenerImpl: () => of(relevoConTresTareas()),
      });

      botonConTexto(elemento, 'Reasignar todas a Beto Díaz')!.click();
      await fixture.whenStable();

      expect(elemento.textContent).toContain(
        '¿Reasignar las 3 tareas pendientes a Beto Díaz? Cada reasignación queda registrada.',
      );
      // Todavía no se envió nada.
      http.expectNone(() => true);

      botonConTexto(elemento, 'Volver')!.click();
      await fixture.whenStable();
      expect(elemento.textContent).not.toContain('¿Reasignar las 3 tareas');
      http.expectNone(() => true);
    });

    it('reasignarTodasEsSecuencialYResume', async () => {
      const { fixture, elemento, http } = await configurar({
        obtenerImpl: () => of(relevoConTresTareas()),
      });

      botonConTexto(elemento, 'Reasignar todas a Beto Díaz')!.click();
      await fixture.whenStable();
      botonConTexto(elemento, 'Confirmar')!.click();
      await fixture.whenStable();

      // `expectOne(() => true)` exige UNA sola petición pendiente en total:
      // en secuencia y en el orden de la lista.
      const primera = http.expectOne(() => true);
      expect(urlAsignacion(10)(primera.request)).toBe(true);
      expect(primera.request.body).toEqual({ idUsuario: 301, motivo: MOTIVO_ESPERADO });
      primera.flush({});
      await fixture.whenStable();

      const segunda = http.expectOne(() => true);
      expect(urlAsignacion(11)(segunda.request)).toBe(true);
      segunda.flush({ detail: 'La tarea ya está finalizada; no se puede reasignar' }, ERROR_422);
      await fixture.whenStable();

      // El error de la segunda no detiene la tercera.
      const tercera = http.expectOne(() => true);
      expect(urlAsignacion(12)(tercera.request)).toBe(true);
      tercera.flush({});
      await fixture.whenStable();

      expect(filaDeTarea(elemento, 'Tarea uno').textContent).toContain('Reasignada a Beto Díaz');
      expect(filaDeTarea(elemento, 'Tarea dos').querySelector('[role="alert"]')).toBeTruthy();
      expect(filaDeTarea(elemento, 'Tarea tres').textContent).toContain('Reasignada a Beto Díaz');
      const resumen = Array.from(elemento.querySelectorAll('[role="status"]')).find((e) =>
        e.textContent?.includes('Se reasignaron'),
      );
      expect(resumen?.textContent?.trim()).toBe('Se reasignaron 2 de 3 tareas.');
    });

    it('botonDeshabilitadoDuranteLaPeticion', async () => {
      const { fixture, elemento, http } = await configurar();

      const boton = botonConTexto(filaDeTarea(elemento, 'Resumen tarea'), 'Reasignar a Beto Díaz')!;
      boton.click();
      await fixture.whenStable();

      expect(boton.disabled).toBe(true);
      // Un segundo toque no genera otra petición.
      boton.click();
      await fixture.whenStable();
      const peticiones = http.match(urlAsignacion(10));
      expect(peticiones).toHaveLength(1);
      peticiones[0].flush({});
    });
  });
});
