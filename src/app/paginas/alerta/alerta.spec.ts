import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { Alerta } from './alerta';
import { RespuestaAlerta, RespuestaAlertaDetallada, RespuestaIntento } from '../../nucleo/alertas/modelos-alertas';
import { ServicioAlertas } from '../../nucleo/alertas/servicio-alertas';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';

const ID_ESTADO_ABIERTA = 30;
const ID_ESTADO_CERRADA = 31;

const ESTADOS_ALERTA: RespuestaEstadoCatalogo[] = [
  { idEstado: ID_ESTADO_ABIERTA, codigo: 'ABIERTA', descripcion: 'Abierta', orden: 1 },
  { idEstado: ID_ESTADO_CERRADA, codigo: 'CERRADA', descripcion: 'Cerrada', orden: 2 },
];

const ESTADOS_TAREA: RespuestaEstadoCatalogo[] = [
  { idEstado: 10, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1 },
];

const ID_ESTADO_ENVIADO = 50;
const ID_ESTADO_FALLIDO = 51;
const ESTADOS_ENVIO: RespuestaEstadoCatalogo[] = [
  { idEstado: 49, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1 },
  { idEstado: ID_ESTADO_ENVIADO, codigo: 'ENVIADO', descripcion: 'Enviado', orden: 2 },
  { idEstado: ID_ESTADO_FALLIDO, codigo: 'FALLIDO', descripcion: 'Fallido', orden: 3 },
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

function alerta(datos: Partial<RespuestaAlerta> = {}): RespuestaAlerta {
  return {
    idAlerta: 5,
    tipoAlerta: 'ATRASO_TAREA',
    idTarea: 10,
    tituloTarea: 'Comprar Losartán',
    idEstadoTarea: 10,
    idDetallePlan: null,
    nombreMedicamento: null,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    fechaProgramada: '2026-11-02T08:00:00-03:00',
    mensajeAlerta: 'Mensaje de la alerta',
    idEstado: ID_ESTADO_ABIERTA,
    fechaDeteccion: '2026-11-02T09:00:00-03:00',
    revisor: null,
    fechaRevision: null,
    observacionCierre: null,
    ...datos,
  };
}

function intento(datos: Partial<RespuestaIntento> = {}): RespuestaIntento {
  return {
    idIntento: 1,
    idUsuarioDestinatario: 200,
    nombreDestinatario: 'Carlos Soto',
    canal: 'CORREO',
    numeroIntento: 1,
    idEstadoEnvio: ID_ESTADO_ENVIADO,
    fechaIntento: '2026-11-02T09:05:00-03:00',
    detalleError: null,
    ...datos,
  };
}

function detalle(datos: Partial<RespuestaAlertaDetallada> = {}): RespuestaAlertaDetallada {
  return {
    alerta: alerta(),
    intentos: [intento()],
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  grupos?: RespuestaGrupo[];
  obtenerImpl?: () => Observable<RespuestaAlertaDetallada>;
  cerrarImpl?: ReturnType<typeof vi.fn>;
  esAdministrador?: boolean;
  queryParams?: Record<string, string>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const grupos = signal<RespuestaGrupo[]>(opciones.grupos ?? [grupo(1, 'COORDINADOR')]);
  const seleccionar = vi.fn((idGrupo: number) => {
    const encontrado = grupos().find((candidato) => candidato.idGrupo === idGrupo) ?? null;
    activo.set(encontrado);
  });

  const servicioAlertas = {
    obtener: vi.fn(opciones.obtenerImpl ?? (() => of(detalle()))),
    cerrar: opciones.cerrarImpl ?? vi.fn(() => of(detalle())),
  };
  const servicioCatalogos = {
    estados: vi.fn((tabla: string) => {
      if (tabla === 'ALERTA_CUIDADO') return of(ESTADOS_ALERTA);
      if (tabla === 'TAREA_CUIDADO') return of(ESTADOS_TAREA);
      return of(ESTADOS_ENVIO);
    }),
  };

  TestBed.configureTestingModule({
    imports: [Alerta],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ idAlerta: '5' }),
            queryParamMap: convertToParamMap(opciones.queryParams ?? {}),
          },
        },
      },
      { provide: ServicioAlertas, useValue: servicioAlertas },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo, grupos, seleccionar } },
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
  const fixture = TestBed.createComponent(Alerta);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    seleccionar,
    servicioAlertas,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('Alerta', () => {
  it('muestraIntentosYErrorSoloSiViene', async () => {
    const datos = detalle({
      intentos: [
        intento({
          idIntento: 1,
          nombreDestinatario: 'Carlos Soto',
          canal: 'CORREO',
          numeroIntento: 1,
          idEstadoEnvio: ID_ESTADO_FALLIDO,
          detalleError: 'El envío de correo no está configurado.',
        }),
        intento({ idIntento: 2, nombreDestinatario: 'Ana Pérez', canal: 'CORREO', numeroIntento: 1 }),
      ],
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    const items = Array.from(elemento.querySelectorAll('[data-prueba="intento-item"]'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Carlos Soto');
    expect(items[0].textContent).toContain('CORREO');
    expect(items[0].textContent).toContain('Fallido');
    expect(items[0].textContent).toContain('El envío de correo no está configurado.');
    expect(items[1].textContent).toContain('Ana Pérez');
    expect(items[1].textContent).toContain('Enviado');
    expect(items[1].textContent).not.toContain('El envío de correo no está configurado.');
  });

  it('chipDeIntentoFallidoYDeAlertaAbiertaUsanElTonoDePeligroODeAlerta', async () => {
    const datos = detalle({
      alerta: alerta({ idEstado: ID_ESTADO_ABIERTA, idEstadoTarea: 10 }),
      intentos: [intento({ idEstadoEnvio: ID_ESTADO_FALLIDO })],
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    const chipAlerta = elemento.querySelector('[data-prueba="estado-alerta"]')!;
    const chipTarea = elemento.querySelector('[data-prueba="estado-tarea"]')!;
    const chipIntento = elemento.querySelector('[data-prueba="estado-envio"]')!;

    expect(chipAlerta.textContent).toContain('Abierta');
    expect(chipAlerta.classList.contains('mv-chip--alerta')).toBe(true);
    expect(chipAlerta.classList.contains('mv-chip--exito')).toBe(false);
    expect(chipTarea.textContent).toContain('Pendiente');
    expect(chipTarea.className.trim()).toBe('mv-chip');
    expect(chipIntento.textContent).toContain('Fallido');
    expect(chipIntento.classList.contains('mv-chip--peligro')).toBe(true);
    expect(chipIntento.classList.contains('mv-chip--exito')).toBe(false);
  });

  it('insigniaDeAlertaCerradaYDeIntentoEnviadoNoUsanLosModificadoresDeAvisoNiError', async () => {
    const datos = detalle({
      alerta: alerta({
        idEstado: ID_ESTADO_CERRADA,
        idEstadoTarea: 10,
        revisor: { idUsuario: 1, nombre: 'Ana' },
      }),
      intentos: [intento({ idEstadoEnvio: ID_ESTADO_ENVIADO })],
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    const chipAlerta = elemento.querySelector('[data-prueba="estado-alerta"]')!;
    const chipIntento = elemento.querySelector('[data-prueba="estado-envio"]')!;

    expect(chipAlerta.classList.contains('mv-chip--alerta')).toBe(false);
    expect(chipIntento.classList.contains('mv-chip--peligro')).toBe(false);
  });

  it('encabezadoTieneEnlaceVolverTituloDelTipoYChipDeEstado', async () => {
    const { elemento } = await configurar();

    const volver = elemento.querySelector<HTMLAnchorElement>('a.volver');
    expect(volver?.textContent).toContain('Volver a alertas');
    expect(volver?.getAttribute('href')).toBe('/alertas');
    expect(volver?.querySelector('app-icono')?.getAttribute('aria-hidden')).toBe('true');

    const encabezado = elemento.querySelector('header.mv-encabezado')!;
    expect(encabezado.querySelector('h1')?.textContent).toContain('Tarea atrasada');
    expect(encabezado.querySelector('[data-prueba="estado-alerta"]')?.textContent).toContain(
      'Abierta',
    );
  });

  it('datosEnListaDeDefinicionConEtiquetaDeTipoYFechasLegibles', async () => {
    const datos = detalle({
      alerta: alerta({ tipoAlerta: 'REPOSICION_MEDICAMENTO', nombreMedicamento: 'Losartán' }),
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    const filas = Array.from(elemento.querySelectorAll('dl.datos > div')).map((fila) => [
      fila.querySelector('dt')?.textContent?.trim(),
      fila.querySelector('dd')?.textContent?.trim(),
    ]);
    expect(filas).toContainEqual(['Tipo', 'Reposición de medicamento']);
    expect(filas).toContainEqual(['Adulto mayor', 'Rosa González']);
    expect(filas).toContainEqual([
      'Fecha programada',
      fechaHoraLegible('2026-11-02T08:00:00-03:00'),
    ]);
    expect(filas).toContainEqual(['Medicamento', 'Losartán']);
  });

  it('intentosMuestranLaFechaLegible', async () => {
    const { elemento } = await configurar();

    const fila = elemento.querySelector('[data-prueba="intento-item"]')!;
    expect(fila.textContent).toContain(fechaHoraLegible('2026-11-02T09:05:00-03:00'));
  });

  it('errorDeCargaOfreceReintentarYVuelveAPedirElDetalle', async () => {
    const obtenerImpl = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(detalle()));
    const { fixture, elemento, servicioAlertas } = await configurar({ obtenerImpl });

    expect(elemento.querySelector('.mv-aviso--error[role="alert"]')).not.toBeNull();
    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioAlertas.obtener).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('[data-prueba="intento-item"]')).not.toBeNull();
  });

  it('sinIntentosMuestraElMensajeDeVacio', async () => {
    const { elemento } = await configurar({ obtenerImpl: () => of(detalle({ intentos: [] })) });

    expect(elemento.textContent).toContain('Sin intentos de notificación registrados.');
  });

  it('colaboradorNoVeFormularioDeCierre', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(elemento.querySelector('#alerta-cierre-observacion')).toBeNull();
    expect(botonConTexto(elemento, 'Cerrar alerta')).toBeFalsy();
  });

  it('cierreDeshabilitadoConObservacionEnBlanco', async () => {
    const { elemento } = await configurar();

    const boton = botonConTexto(elemento, 'Cerrar alerta');
    expect(boton).toBeTruthy();
    expect(boton!.disabled).toBe(true);
  });

  it('cierreEnviaObservacionYRecarga', async () => {
    const datosActualizados = detalle({
      alerta: alerta({
        idEstado: ID_ESTADO_CERRADA,
        revisor: { idUsuario: 1, nombre: 'Ana' },
        fechaRevision: '2026-11-02T10:00:00-03:00',
        observacionCierre: 'Se confirmó con la familia.',
      }),
    });
    const obtenerImpl = vi.fn().mockReturnValueOnce(of(detalle())).mockReturnValueOnce(of(datosActualizados));
    const cerrarImpl = vi.fn(() => of(datosActualizados));
    const { fixture, elemento, servicioAlertas } = await configurar({ obtenerImpl, cerrarImpl });

    const textarea = elemento.querySelector<HTMLTextAreaElement>('#alerta-cierre-observacion')!;
    textarea.value = '  Se confirmó con la familia.  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const boton = botonConTexto(elemento, 'Cerrar alerta')!;
    expect(boton.disabled).toBe(false);
    boton.click();
    await fixture.whenStable();

    expect(cerrarImpl).toHaveBeenCalledWith(1, 5, 'Se confirmó con la familia.');
    expect(servicioAlertas.obtener).toHaveBeenCalledTimes(2);
    const confirmacion = elemento.querySelector('[role="status"]');
    expect(confirmacion?.textContent).toContain('Alerta cerrada.');
  });

  it('alertaCerradaMuestraRevision', async () => {
    const datos = detalle({
      alerta: alerta({
        idEstado: ID_ESTADO_CERRADA,
        revisor: { idUsuario: 7, nombre: 'Marta Ríos' },
        fechaRevision: '2026-11-02T10:00:00-03:00',
        observacionCierre: 'Revisado con la familia.',
      }),
    });
    const { elemento } = await configurar({ obtenerImpl: () => of(datos) });

    expect(elemento.textContent).toContain('Marta Ríos');
    expect(elemento.textContent).toContain('Revisado con la familia.');
    expect(elemento.querySelector('#alerta-cierre-observacion')).toBeNull();
  });

  it('parametroGrupoSeleccionaElGrupo', async () => {
    const otroGrupo = grupo(2, 'COORDINADOR');
    const { seleccionar, servicioAlertas } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      grupos: [grupo(1, 'COORDINADOR'), otroGrupo],
      queryParams: { grupo: '2' },
    });

    expect(seleccionar).toHaveBeenCalledWith(2);
    expect(servicioAlertas.obtener).toHaveBeenCalledWith(2, 5);
  });

  it('parametroGrupoFueraDeLosDelUsuarioNoCambiaElGrupoActivo', async () => {
    const { seleccionar, servicioAlertas } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      grupos: [grupo(1, 'COORDINADOR')],
      queryParams: { grupo: '99' },
    });

    expect(seleccionar).not.toHaveBeenCalled();
    expect(servicioAlertas.obtener).toHaveBeenCalledWith(1, 5);
  });

  it('alertaInexistenteMuestraMensaje', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'La alerta no existe' } })),
    });

    expect(elemento.textContent).toContain('La alerta no existe');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/alertas',
    );
    expect(enlace).toBeDefined();
  });
});
