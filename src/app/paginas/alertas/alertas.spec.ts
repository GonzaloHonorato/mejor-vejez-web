import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Alertas } from './alertas';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaAlerta } from '../../nucleo/alertas/modelos-alertas';
import { FiltroAlertas, ServicioAlertas } from '../../nucleo/alertas/servicio-alertas';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaPagina } from '../../nucleo/usuarios/modelos-usuarios';

const ID_ESTADO_ABIERTA = 30;
const ID_ESTADO_CERRADA = 31;

const ESTADOS_ALERTA: RespuestaEstadoCatalogo[] = [
  { idEstado: ID_ESTADO_ABIERTA, codigo: 'ABIERTA', descripcion: 'Abierta', orden: 1 },
  { idEstado: ID_ESTADO_CERRADA, codigo: 'CERRADA', descripcion: 'Cerrada', orden: 2 },
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
    idAlerta: 1,
    tipoAlerta: 'ATRASO_TAREA',
    idTarea: 10,
    tituloTarea: 'Comprar Losartán',
    idEstadoTarea: 10,
    idDetallePlan: null,
    nombreMedicamento: null,
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    fechaProgramada: '2026-11-02T08:00:00-03:00',
    mensajeAlerta: 'Mensaje de la alerta 1',
    idEstado: ID_ESTADO_ABIERTA,
    fechaDeteccion: '2026-11-02T09:00:00-03:00',
    revisor: null,
    fechaRevision: null,
    observacionCierre: null,
    ...datos,
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

const ADULTOS = [adulto(1, 'Rosa González'), adulto(2, 'Pedro Rojas')];

function pagina(
  elementos: RespuestaAlerta[],
  total = elementos.length,
  numeroPagina = 0,
  tamano = 20,
): RespuestaPagina<RespuestaAlerta> {
  return { elementos, pagina: numeroPagina, tamano, total };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  alertasIniciales?: RespuestaAlerta[];
  listar?: ReturnType<typeof vi.fn>;
  estados?: RespuestaEstadoCatalogo[];
  estadosFn?: ReturnType<typeof vi.fn>;
  listarAdultos?: ReturnType<typeof vi.fn>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioAlertas = {
    listar:
      opciones.listar ??
      vi.fn((_idGrupo: number, _filtro?: FiltroAlertas) =>
        of(pagina(opciones.alertasIniciales ?? [alerta()])),
      ),
    obtener: vi.fn(),
    cerrar: vi.fn(),
  };
  const servicioAdultos = {
    listar: opciones.listarAdultos ?? vi.fn(() => of(ADULTOS)),
  };
  const servicioCatalogos = {
    estados: opciones.estadosFn ?? vi.fn(() => of(opciones.estados ?? ESTADOS_ALERTA)),
  };

  TestBed.configureTestingModule({
    imports: [Alertas],
    providers: [
      provideRouter([]),
      { provide: ServicioAlertas, useValue: servicioAlertas },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioAdultos, useValue: servicioAdultos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
    ],
  });
  const fixture = TestBed.createComponent(Alertas);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioAlertas,
    servicioAdultos,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement {
  return Array.from(elemento.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  )!;
}

/** Pestaña de la bandeja por su nombre, sin contar el contador que la acompaña. */
function pestanaCon(elemento: HTMLElement, nombre: string): HTMLButtonElement {
  return Array.from(elemento.querySelectorAll<HTMLButtonElement>('.mv-pestanas__pestana')).find(
    (b) => b.querySelector('.nombre-pestana')?.textContent?.trim() === nombre,
  )!;
}

function contadorDe(elemento: HTMLElement, nombre: string): string | undefined {
  return pestanaCon(elemento, nombre).querySelector('.mv-pestanas__contador')?.textContent?.trim();
}

function textoIndicadores(elemento: HTMLElement): string[] {
  return Array.from(
    elemento.querySelectorAll('ul.mv-indicadores[aria-label="Resumen de alertas"] > li'),
  ).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim());
}

/** Llamadas a `listar` de la lista visible (las de tamaño 1 son solo para contar). */
function llamadasDeLista(listar: ReturnType<typeof vi.fn>): unknown[][] {
  return listar.mock.calls.filter((llamada) => (llamada[1] as FiltroAlertas).tamano !== 1);
}

/** `listar` que responde según el estado y el tamaño pedidos. */
function listarPorEstado(
  abiertas: RespuestaPagina<RespuestaAlerta>,
  cerradas: RespuestaPagina<RespuestaAlerta>,
) {
  return vi.fn((_idGrupo: number, filtro?: FiltroAlertas) => {
    const respuesta = filtro?.idEstado === ID_ESTADO_CERRADA ? cerradas : abiertas;
    return of(
      filtro?.tamano === 1
        ? { ...respuesta, elementos: respuesta.elementos.slice(0, 1), tamano: 1 }
        : respuesta,
    );
  });
}

describe('Alertas', () => {
  it('muestraAbiertasPorDefecto', async () => {
    const { elemento, servicioAlertas } = await configurar({ alertasIniciales: [alerta()] });

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 20,
    });
    expect(pestanaCon(elemento, 'Abiertas').getAttribute('aria-pressed')).toBe('true');
    expect(pestanaCon(elemento, 'Cerradas').getAttribute('aria-pressed')).toBe('false');
    expect(elemento.textContent).toContain('Mensaje de la alerta 1');
  });

  it('cambiarAPestanaCerradasPideOtroEstado', async () => {
    const { fixture, elemento, servicioAlertas } = await configurar({});
    servicioAlertas.listar.mockClear();
    servicioAlertas.listar.mockReturnValue(
      of(
        pagina([
          alerta({
            idEstado: ID_ESTADO_CERRADA,
            mensajeAlerta: 'Alerta ya cerrada',
            revisor: { idUsuario: 200, nombre: 'Carlos Soto' },
            fechaRevision: '2026-11-03T10:00:00-03:00',
          }),
        ]),
      ),
    );

    pestanaCon(elemento, 'Cerradas').click();
    await fixture.whenStable();

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_CERRADA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 20,
    });
    expect(pestanaCon(elemento, 'Cerradas').getAttribute('aria-pressed')).toBe('true');
    expect(elemento.textContent).toContain('Carlos Soto');
  });

  it('filtroTipoSeEnvia', async () => {
    const { fixture, elemento, servicioAlertas } = await configurar({});
    servicioAlertas.listar.mockClear();
    servicioAlertas.listar.mockReturnValue(of(pagina([])));

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-tipo')!;
    select.value = 'CITA_PROXIMA';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: 'CITA_PROXIMA',
      pagina: 0,
      tamano: 20,
    });
  });

  it('cargarMasAgregaPagina', async () => {
    const listar = vi.fn((_idGrupo: number, filtro?: FiltroAlertas) => {
      if (filtro?.tamano === 1) return of(pagina([], 0, 0, 1));
      return filtro?.pagina === 0
        ? of(pagina([alerta({ idAlerta: 1, mensajeAlerta: 'Primera' })], 2, 0))
        : of(pagina([alerta({ idAlerta: 2, mensajeAlerta: 'Segunda' })], 2, 1));
    });
    const { fixture, elemento } = await configurar({ listar });

    expect(elemento.querySelectorAll('.grilla-alertas tbody > tr')).toHaveLength(1);
    const botonCargarMas = botonConTexto(elemento, 'Cargar más');
    expect(botonCargarMas).toBeDefined();

    botonCargarMas.click();
    await fixture.whenStable();

    expect(llamadasDeLista(listar)).toHaveLength(2);
    expect(llamadasDeLista(listar)[1]).toEqual([
      1,
      { idEstado: ID_ESTADO_ABIERTA, tipoAlerta: undefined, pagina: 1, tamano: 20 },
    ]);
    expect(elemento.querySelectorAll('.grilla-alertas tbody > tr')).toHaveLength(2);
    expect(elemento.textContent).toContain('Primera');
    expect(elemento.textContent).toContain('Segunda');
    expect(botonConTexto(elemento, 'Cargar más')).toBeUndefined();
  });

  it('vacioYErrorSeDistinguen', async () => {
    const { elemento } = await configurar({ alertasIniciales: [] });

    const aviso = elemento.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('No hay alertas abiertas.');
    expect(elemento.querySelector('[role="alert"]')).toBeFalsy();

    TestBed.resetTestingModule();
    const { elemento: elementoError } = await configurar({
      listar: vi.fn(
        () =>
          throwError(
            () =>
              new HttpErrorResponse({ status: 500, error: { detail: 'Error al listar alertas' } }),
          ) as Observable<RespuestaPagina<RespuestaAlerta>>,
      ),
    });

    expect(elementoError.querySelector('[role="alert"]')?.textContent).toContain(
      'Error al listar alertas',
    );
    expect(elementoError.querySelector('[role="status"]')).toBeFalsy();
  });

  it('falloDelCatalogoReintentaYCarga', async () => {
    const estadosFn = vi
      .fn()
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({ status: 500, error: { detail: 'Error al listar estados' } }),
        ),
      )
      .mockReturnValueOnce(of(ESTADOS_ALERTA));
    const { fixture, elemento, activo, servicioAlertas } = await configurar({ estadosFn });

    // Falla el catálogo: se ve el error, no se queda "cargando" para siempre.
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Error al listar estados',
    );

    // Cambiar de grupo con el catálogo todavía caído no deja la página en blanco.
    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Error al listar estados',
    );
    expect(elemento.querySelectorAll('.grilla-alertas tbody > tr')).toHaveLength(0);

    // "Reintentar" vuelve a pedir el catálogo y, con él, la lista.
    botonConTexto(elemento, 'Reintentar').click();
    await fixture.whenStable();

    expect(estadosFn).toHaveBeenCalledTimes(2);
    expect(servicioAlertas.listar).toHaveBeenCalledWith(2, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 20,
    });
    expect(elemento.textContent).toContain('Mensaje de la alerta 1');
  });

  it('cambioDeGrupoDescartaRespuestaTardia', async () => {
    const sujetoGrupo1 = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const sujetoGrupo2 = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const listar = vi.fn((idGrupo: number) =>
      idGrupo === 1 ? sujetoGrupo1.asObservable() : sujetoGrupo2.asObservable(),
    );
    const { fixture, elemento, activo } = await configurar({ listar });

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    // La respuesta del grupo 2 (el actual) resuelve primero...
    sujetoGrupo2.next(pagina([alerta({ idAlerta: 2, mensajeAlerta: 'Alerta del grupo 2' })]));
    sujetoGrupo2.complete();
    await fixture.whenStable();

    // ...y la del grupo 1 (obsoleta) llega después: debe ser ignorada.
    sujetoGrupo1.next(pagina([alerta({ idAlerta: 1, mensajeAlerta: 'Alerta del grupo 1' })]));
    sujetoGrupo1.complete();
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Alerta del grupo 2');
    expect(elemento.textContent).not.toContain('Alerta del grupo 1');
  });

  it('encabezadoConRotuloTituloYBajada', async () => {
    const { elemento } = await configurar({});

    const encabezado = elemento.querySelector('header.mv-encabezado')!;
    expect(encabezado.querySelector('.mv-encabezado__rotulo')?.textContent?.trim()).toBe(
      'Coordinación del cuidado',
    );
    expect(encabezado.querySelector('h1.mv-encabezado__titulo')?.textContent?.trim()).toBe(
      'Alertas',
    );
    expect(encabezado.querySelector('.mv-encabezado__bajada')?.textContent).toContain(
      'Revisa situaciones que requieren atención',
    );
  });

  it('contadoresDePestanasEIndicadoresUsanElTotalDeCadaEstado', async () => {
    const listar = listarPorEstado(
      pagina([alerta()], 7),
      pagina([alerta({ idAlerta: 9, idEstado: ID_ESTADO_CERRADA })], 4, 0, 1),
    );
    const { elemento } = await configurar({ listar });

    expect(listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_CERRADA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 1,
    });
    expect(contadorDe(elemento, 'Abiertas')).toBe('7');
    expect(contadorDe(elemento, 'Cerradas')).toBe('4');
    expect(textoIndicadores(elemento)).toEqual(['7 abiertas', '4 cerradas']);
  });

  it('indicadoresEnSingularYConTonoPorEstado', async () => {
    const listar = listarPorEstado(pagina([alerta()], 1), pagina([], 1, 0, 1));
    const { elemento } = await configurar({ listar });

    expect(textoIndicadores(elemento)).toEqual(['1 abierta', '1 cerrada']);
    const tonos = Array.from(
      elemento.querySelectorAll('ul.mv-indicadores[aria-label="Resumen de alertas"] > li'),
    ).map((li) => li.className);
    expect(tonos[0]).toContain('mv-indicador--peligro');
    expect(tonos[1]).toContain('mv-indicador--exito');
  });

  it('enCerradasPideSoloElTotalDeAbiertas', async () => {
    const listar = listarPorEstado(pagina([alerta()], 5), pagina([alerta({ idAlerta: 2 })], 3));
    const { fixture, elemento } = await configurar({ listar });
    listar.mockClear();

    pestanaCon(elemento, 'Cerradas').click();
    await fixture.whenStable();

    expect(listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 1,
    });
    expect(contadorDe(elemento, 'Abiertas')).toBe('5');
    expect(contadorDe(elemento, 'Cerradas')).toBe('3');
  });

  it('elFiltroDeTipoTambienAplicaAlTotalDeLaOtraPestana', async () => {
    const { fixture, elemento, servicioAlertas } = await configurar({});
    servicioAlertas.listar.mockClear();
    servicioAlertas.listar.mockReturnValue(of(pagina([])));

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-tipo')!;
    select.value = 'REPOSICION_MEDICAMENTO';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_CERRADA,
      tipoAlerta: 'REPOSICION_MEDICAMENTO',
      pagina: 0,
      tamano: 1,
    });
    expect(contadorDe(elemento, 'Abiertas')).toBe('0');
    expect(contadorDe(elemento, 'Cerradas')).toBe('0');
  });

  it('elFiltroDeTipoEsUnCampoCompactoConLasEtiquetasCompartidas', async () => {
    const { elemento } = await configurar({});

    expect(elemento.querySelector('.mv-filtros')).toBeNull();
    const select = elemento.querySelector<HTMLSelectElement>(
      '.mv-campo.filtro-tipo #alertas-filtro-tipo',
    )!;
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
      'Todos los tipos',
      'Tarea atrasada',
      'Reposición de medicamento',
      'Cita próxima',
    ]);
  });

  it('cadaAlertaMuestraUnChipDeTipoConSuTono', async () => {
    const { elemento } = await configurar({
      alertasIniciales: [
        alerta({ idAlerta: 1, tipoAlerta: 'ATRASO_TAREA' }),
        alerta({ idAlerta: 2, tipoAlerta: 'REPOSICION_MEDICAMENTO' }),
        alerta({ idAlerta: 3, tipoAlerta: 'CITA_PROXIMA' }),
      ],
    });

    const chips = Array.from(elemento.querySelectorAll('.grilla-alertas td:first-child .mv-chip'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'Tarea atrasada',
      'Reposición de medicamento',
      'Cita próxima',
    ]);
    expect(chips[0].className).toContain('mv-chip--peligro');
    expect(chips[1].className).toContain('mv-chip--alerta');
    expect(chips[2].className).toContain('mv-chip--info');
  });

  it('elTituloCortoEnlazaAlDetalleYElMensajeVaComoTextoSecundario', async () => {
    const { elemento } = await configurar({ alertasIniciales: [alerta({ idAlerta: 42 })] });

    const fila = elemento.querySelector('.grilla-alertas tbody > tr')!;
    const enlace = fila.querySelector<HTMLAnchorElement>('a.mv-grilla__titulo')!;
    const detectada = fechaHoraLegible('2026-11-02T09:00:00-03:00');
    expect(enlace.getAttribute('href')).toBe('/alertas/42');
    expect(enlace.textContent?.trim()).toBe('Comprar Losartán');
    expect(enlace.getAttribute('aria-label')).toBe(
      `Comprar Losartán, Rosa González, detectada ${detectada}`,
    );
    // Un solo enlace accesible por fila: "Ver detalle" repite el destino fuera del foco y del árbol accesible.
    expect(fila.querySelectorAll('a:not([aria-hidden="true"])')).toHaveLength(1);
    const verDetalle = fila.querySelector<HTMLAnchorElement>('td.detalle a')!;
    expect(verDetalle.textContent?.trim()).toBe('Ver detalle');
    expect(verDetalle.getAttribute('href')).toBe('/alertas/42');
    expect(verDetalle.getAttribute('tabindex')).toBe('-1');
    expect(verDetalle.getAttribute('aria-hidden')).toBe('true');
    expect(fila.querySelector('.mensaje')?.textContent?.trim()).toBe('Mensaje de la alerta 1');
    expect(fila.querySelector('td[data-etiqueta="Adulto mayor"]')?.textContent?.trim()).toBe(
      'Rosa González',
    );
    expect(fila.querySelector('td[data-etiqueta="Detectada"]')?.textContent?.trim()).toBe(
      detectada,
    );
    expect(fila.textContent).not.toContain('Revisada por');
  });

  it('sinTareaElTituloEsElMedicamentoOElTipo', async () => {
    const { elemento } = await configurar({
      alertasIniciales: [
        alerta({
          idAlerta: 1,
          tipoAlerta: 'REPOSICION_MEDICAMENTO',
          idTarea: null,
          tituloTarea: null,
          nombreMedicamento: 'Paracetamol',
        }),
        alerta({ idAlerta: 2, tipoAlerta: 'CITA_PROXIMA', idTarea: null, tituloTarea: null }),
      ],
    });

    const titulos = Array.from(
      elemento.querySelectorAll('.grilla-alertas a.mv-grilla__titulo'),
    ).map((a) => a.textContent?.trim());
    expect(titulos).toEqual(['Paracetamol', 'Cita próxima']);
  });

  it('cerradasMuestranRevisorFechaYExtractoDeLaObservacion', async () => {
    const observacion =
      'Se llamó a la cuidadora y confirmó que la tarea se hizo a tiempo, pero no la marcó en la aplicación porque estaba sin conexión durante toda la tarde del lunes.';
    const listar = listarPorEstado(
      pagina([alerta()]),
      pagina([
        alerta({
          idAlerta: 5,
          idEstado: ID_ESTADO_CERRADA,
          revisor: { idUsuario: 200, nombre: 'Carlos Soto' },
          fechaRevision: '2026-11-03T10:00:00-03:00',
          observacionCierre: observacion,
        }),
        alerta({
          idAlerta: 6,
          idEstado: ID_ESTADO_CERRADA,
          revisor: { idUsuario: 201, nombre: 'Ana Pérez' },
          fechaRevision: '2026-11-03T11:00:00-03:00',
          observacionCierre: null,
        }),
      ]),
    );
    const { fixture, elemento } = await configurar({ listar });

    pestanaCon(elemento, 'Cerradas').click();
    await fixture.whenStable();

    const filas = elemento.querySelectorAll('.grilla-alertas tbody > tr');
    expect(filas[0].textContent).toContain(
      `Revisada por Carlos Soto · ${fechaHoraLegible('2026-11-03T10:00:00-03:00')}`,
    );
    const extracto = filas[0].querySelector('.observacion')!.textContent!.trim();
    expect(extracto.endsWith('…')).toBe(true);
    expect(extracto.length).toBeLessThan(observacion.length);
    expect(observacion.startsWith(extracto.slice(0, -1).trimEnd())).toBe(true);

    expect(filas[1].textContent).toContain('Revisada por Ana Pérez');
    expect(filas[1].querySelector('.observacion')).toBeNull();
  });

  it('mientrasCargaMuestraElEsqueleto', async () => {
    const pendiente = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const { elemento } = await configurar({ listar: vi.fn(() => pendiente.asObservable()) });

    const estado = elemento.querySelector('[role="status"][aria-live="polite"]')!;
    expect(estado.textContent).toContain('Cargando alertas…');
    expect(estado.querySelectorAll('.mv-esqueleto').length).toBeGreaterThan(0);
    expect(contadorDe(elemento, 'Abiertas')).toBeUndefined();
  });

  it('elErrorSeMuestraComoAvisoConReintentar', async () => {
    let fallar = true;
    const listar = vi.fn(() =>
      fallar
        ? (throwError(
            () => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la bandeja' } }),
          ) as Observable<RespuestaPagina<RespuestaAlerta>>)
        : of(pagina([alerta({ mensajeAlerta: 'Ya cargó' })], 1)),
    );
    const { fixture, elemento } = await configurar({ listar });

    const aviso = elemento.querySelector('.mv-aviso.mv-aviso--error[role="alert"]')!;
    expect(aviso.textContent).toContain('Falló la bandeja');

    fallar = false;
    botonConTexto(elemento, 'Reintentar').click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')).toBeNull();
    expect(elemento.textContent).toContain('Ya cargó');
    expect(contadorDe(elemento, 'Abiertas')).toBe('1');
    expect(contadorDe(elemento, 'Cerradas')).toBe('1');
  });

  it('vacioPorPestanaUsaElEstadoVacio', async () => {
    const { fixture, elemento } = await configurar({ alertasIniciales: [] });

    expect(elemento.querySelector('.mv-vacio[role="status"]')?.textContent).toContain(
      'No hay alertas abiertas.',
    );

    pestanaCon(elemento, 'Cerradas').click();
    await fixture.whenStable();

    expect(elemento.querySelector('.mv-vacio[role="status"]')?.textContent).toContain(
      'No hay alertas cerradas.',
    );
  });

  it('elTotalDeLaOtraPestanaDescartaUnaRespuestaTardia', async () => {
    const totalGrupo1 = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const totalGrupo2 = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const listar = vi.fn((idGrupo: number, filtro?: FiltroAlertas) => {
      if (filtro?.tamano === 1) {
        return (idGrupo === 1 ? totalGrupo1 : totalGrupo2).asObservable();
      }
      return of(pagina([alerta()], idGrupo === 1 ? 2 : 5));
    });
    const { fixture, elemento, activo } = await configurar({ listar });

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    totalGrupo2.next(pagina([], 8, 0, 1));
    totalGrupo2.complete();
    await fixture.whenStable();
    totalGrupo1.next(pagina([], 99, 0, 1));
    totalGrupo1.complete();
    await fixture.whenStable();

    expect(contadorDe(elemento, 'Abiertas')).toBe('5');
    expect(contadorDe(elemento, 'Cerradas')).toBe('8');
  });

  it('elTotalDeLaOtraPestanaDescartaElDeUnTipoAnterior', async () => {
    const totalTodos = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const totalCitas = new Subject<RespuestaPagina<RespuestaAlerta>>();
    const listar = vi.fn((_idGrupo: number, filtro?: FiltroAlertas) => {
      if (filtro?.tamano === 1) {
        return (filtro.tipoAlerta === 'CITA_PROXIMA' ? totalCitas : totalTodos).asObservable();
      }
      return of(pagina([alerta()], filtro?.tipoAlerta === 'CITA_PROXIMA' ? 1 : 3));
    });
    const { fixture, elemento } = await configurar({ listar });

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-tipo')!;
    select.value = 'CITA_PROXIMA';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    totalCitas.next(pagina([], 2, 0, 1));
    totalCitas.complete();
    await fixture.whenStable();
    totalTodos.next(pagina([], 40, 0, 1));
    totalTodos.complete();
    await fixture.whenStable();

    expect(contadorDe(elemento, 'Abiertas')).toBe('1');
    expect(contadorDe(elemento, 'Cerradas')).toBe('2');
  });
  it('laBandejaEsUnaGrillaConColumnasYRolesExplicitos', async () => {
    const { elemento } = await configurar({ alertasIniciales: [alerta()] });

    const region = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Bandeja de alertas');
    const tabla = region.querySelector('table.mv-grilla__tabla[role="table"]')!;
    expect(tabla.querySelectorAll('[role="rowgroup"]')).toHaveLength(2);
    const encabezados = Array.from(tabla.querySelectorAll('th[role="columnheader"]')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados).toEqual([
      'Tipo',
      'Alerta',
      'Adulto mayor',
      'Detectada',
      'Estado',
      'Detalle',
    ]);
    const fila = tabla.querySelector('tbody > tr[role="row"]')!;
    const celdas = Array.from(fila.querySelectorAll('td'));
    expect(celdas.every((td) => td.getAttribute('role') === 'cell')).toBe(true);
    expect(celdas.map((td) => td.getAttribute('data-etiqueta'))).toEqual([
      null,
      'Alerta',
      'Adulto mayor',
      'Detectada',
      'Estado',
      null,
    ]);
    const estado = fila.querySelector('td[data-etiqueta="Estado"] .mv-chip')!;
    expect(estado.textContent?.trim()).toBe('Abierta');
    expect(estado.className).toContain('mv-chip--peligro');
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('enCerradasLaColumnaEsEstadoYRevision', async () => {
    const listar = listarPorEstado(
      pagina([alerta()]),
      pagina([
        alerta({
          idAlerta: 5,
          idEstado: ID_ESTADO_CERRADA,
          revisor: { idUsuario: 200, nombre: 'Carlos Soto' },
          fechaRevision: '2026-11-03T10:00:00-03:00',
        }),
      ]),
    );
    const { fixture, elemento } = await configurar({ listar });

    pestanaCon(elemento, 'Cerradas').click();
    await fixture.whenStable();

    const encabezados = Array.from(elemento.querySelectorAll('.grilla-alertas th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados[4]).toBe('Estado / revisión');
    const celda = elemento.querySelector('.grilla-alertas td[data-etiqueta="Estado / revisión"]')!;
    expect(celda.querySelector('.mv-chip')?.className).toContain('mv-chip--exito');
    expect(celda.textContent).toContain('Cerrada');
    expect(celda.textContent).toContain('Revisada por Carlos Soto');
  });

  it('losIndicadoresUsanLaGrillaFijaSinEstirarse', async () => {
    const { elemento } = await configurar({});

    const indicadores = elemento.querySelector('ul.mv-indicadores')!;
    expect(indicadores.className.trim()).toBe('mv-indicadores');
  });

  it('elFiltroDeAdultoListaTodosYLosAdultosDelGrupo', async () => {
    const { elemento, servicioAdultos } = await configurar({});

    expect(servicioAdultos.listar).toHaveBeenCalledWith(1, true);
    const select = elemento.querySelector<HTMLSelectElement>(
      '.mv-campo.filtro-adulto #alertas-filtro-adulto',
    )!;
    expect(elemento.querySelector('label[for="alertas-filtro-adulto"]')?.textContent?.trim()).toBe(
      'Adulto mayor',
    );
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
      'Todos',
      'Rosa González',
      'Pedro Rojas',
    ]);
  });

  it('sinAdultoElegidoNoSeEnviaIdAdulto', async () => {
    const { servicioAlertas } = await configurar({});

    for (const llamada of servicioAlertas.listar.mock.calls) {
      expect('idAdulto' in (llamada[1] as FiltroAlertas)).toBe(false);
    }
  });

  it('elFiltroDeAdultoSeEnviaALaListaYAlTotalDeLaOtraPestana', async () => {
    const { fixture, elemento, servicioAlertas } = await configurar({});
    servicioAlertas.listar.mockClear();
    servicioAlertas.listar.mockReturnValue(of(pagina([])));

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-adulto')!;
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: undefined,
      idAdulto: 2,
      pagina: 0,
      tamano: 20,
    });
    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_CERRADA,
      tipoAlerta: undefined,
      idAdulto: 2,
      pagina: 0,
      tamano: 1,
    });
    expect(contadorDe(elemento, 'Abiertas')).toBe('0');
    expect(contadorDe(elemento, 'Cerradas')).toBe('0');
    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain('Prueba con otros filtros.');
  });

  it('cargarMasMantieneElFiltroDeAdulto', async () => {
    const listar = vi.fn((_idGrupo: number, filtro?: FiltroAlertas) => {
      if (filtro?.tamano === 1) return of(pagina([], 0, 0, 1));
      return of(pagina([alerta({ idAlerta: (filtro?.pagina ?? 0) + 1 })], 2, filtro?.pagina ?? 0));
    });
    const { fixture, elemento } = await configurar({ listar });

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-adulto')!;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    botonConTexto(elemento, 'Cargar más').click();
    await fixture.whenStable();

    expect(llamadasDeLista(listar).at(-1)).toEqual([
      1,
      { idEstado: ID_ESTADO_ABIERTA, tipoAlerta: undefined, idAdulto: 1, pagina: 1, tamano: 20 },
    ]);
  });

  it('alCambiarDeGrupoElFiltroDeAdultoVuelveATodos', async () => {
    const { fixture, elemento, activo, servicioAlertas, servicioAdultos } = await configurar({});

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-adulto')!;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    servicioAlertas.listar.mockClear();
    servicioAdultos.listar.mockReturnValue(of([adulto(7, 'Elena Muñoz')]));

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(servicioAdultos.listar).toHaveBeenLastCalledWith(2, true);
    expect(select.selectedIndex).toBe(0);
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
      'Todos',
      'Elena Muñoz',
    ]);
    for (const llamada of servicioAlertas.listar.mock.calls) {
      expect(llamada[0]).toBe(2);
      expect('idAdulto' in (llamada[1] as FiltroAlertas)).toBe(false);
    }
  });

  it('siFallaLaListaDeAdultosElFiltroQuedaConTodosYLaBandejaCarga', async () => {
    const { elemento } = await configurar({
      listarAdultos: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
    });

    const select = elemento.querySelector<HTMLSelectElement>('#alertas-filtro-adulto')!;
    expect(select.options).toHaveLength(1);
    expect(elemento.querySelector('[role="alert"]')).toBeNull();
    expect(elemento.textContent).toContain('Mensaje de la alerta 1');
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('Alertas: desplazamiento y foco', () => {
  let desplazar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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

  it('cargarMasEnfocaLaPrimeraAlertaNueva', async () => {
    const listar = vi.fn((_idGrupo: number, filtro?: FiltroAlertas) => {
      if (filtro?.tamano === 1) return of(pagina([], 0, 0, 1));
      return filtro?.pagina === 0
        ? of(pagina([alerta({ idAlerta: 1, mensajeAlerta: 'Primera' })], 2, 0))
        : of(pagina([alerta({ idAlerta: 2, mensajeAlerta: 'Segunda' })], 2, 1));
    });
    const { fixture, elemento } = await configurar({ listar });

    botonConTexto(elemento, 'Cargar más').click();
    await fixture.whenStable();

    const filas = elemento.querySelectorAll('#alertas-grilla tbody > tr');
    expect(document.activeElement).toBe(filas[1].querySelector('a[href]'));
    expect(bloqueDe(document.activeElement)).toBe('nearest');
  });
});
