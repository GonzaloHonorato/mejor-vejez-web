import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { Relevo } from './relevo';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
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
      elementoDetalle({ idDetalle: 1, tipoElemento: 'TAREA', idReferencia: 10, resumen: 'Resumen tarea' }),
      elementoDetalle({ idDetalle: 2, tipoElemento: 'ALERTA', idReferencia: 20, resumen: 'Resumen alerta' }),
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
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

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

  it('insigniaCanceladaUsaElColorDeAdvertenciaNoElDeExito', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () => of(relevo({ idEstado: ID_ESTADO_CANCELADA, codigoEstado: 'CANCELADA' })),
    });

    const insignia = elemento.querySelector('.insignia')!;
    expect(insignia.textContent?.trim()).toBe('Cancelada');
    expect(insignia.classList.contains('insignia--cancelada')).toBe(true);
  });

  it('insigniaCompletadaNoUsaElColorDeCancelada', async () => {
    const { elemento } = await configurar();

    const insignia = elemento.querySelector('.insignia')!;
    expect(insignia.classList.contains('insignia--cancelada')).toBe(false);
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

  // Corrección ronda 1 (ruling del controlador): la regla 7 de la API
  // también deja cancelar a un administrador, aunque no sea el creador ni
  // el coordinador del grupo (incluso sin membresía: `miRol` null).
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
    expect(elementoVacio.querySelector('[role="status"].vacio')?.textContent).toContain(
      'Sin tareas ni alertas pendientes en este resumen.',
    );
    expect(elementoVacio.querySelector('[role="alert"]')).toBeNull();

    TestBed.resetTestingModule();
    const { elemento: elementoError } = await configurar({
      obtenerImpl: () =>
        throwError(() => new HttpErrorResponse({ status: 500, error: {} })) as never,
    });
    expect(elementoError.querySelector('[role="alert"]')).toBeTruthy();
    expect(elementoError.textContent).not.toContain('Sin tareas ni alertas pendientes en este resumen.');
  });
});
