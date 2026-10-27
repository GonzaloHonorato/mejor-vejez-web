import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { Auditoria } from './auditoria';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaEventoAuditoria } from '../../nucleo/auditoria/modelos-auditoria';
import { FiltroAuditoria, ServicioAuditoria } from '../../nucleo/auditoria/servicio-auditoria';
import { RespuestaPagina } from '../../nucleo/usuarios/modelos-usuarios';

// idResultado > 127 a propósito: la comparación de estado debe ser por valor.
const RESULTADOS: RespuestaEstadoCatalogo[] = [
  { idEstado: 200, codigo: 'EXITO', descripcion: 'Éxito', orden: 1 },
  { idEstado: 201, codigo: 'FALLO', descripcion: 'Fallo', orden: 2 },
  { idEstado: 202, codigo: 'RECHAZADA', descripcion: 'Rechazada', orden: 3 },
];

function evento(
  idEvento: number,
  datos: Partial<RespuestaEventoAuditoria> = {},
): RespuestaEventoAuditoria {
  return {
    idEvento,
    fechaEvento: '2026-11-02T08:00:00-03:00',
    nombreServicio: 'mejor-vejez-api',
    tipoEntidad: 'TAREA_CUIDADO',
    idEntidad: '10',
    idGrupo: 1,
    actor: { idUsuario: 300, nombre: 'Ana Rojas' },
    codigoAccion: 'COMPLETAR_TAREA',
    idResultado: 200,
    codigoResultado: 'EXITO',
    idCorrelacion: null,
    detalles: null,
    ...datos,
  };
}

function pagina(
  elementos: RespuestaEventoAuditoria[],
  total = elementos.length,
): RespuestaPagina<RespuestaEventoAuditoria> {
  return { elementos, pagina: 0, tamano: 20, total };
}

const FILTRO_VACIO: FiltroAuditoria = {
  idGrupo: undefined,
  tipoEntidad: undefined,
  idEntidad: undefined,
  codigoAccion: undefined,
  codigoResultado: undefined,
  desde: undefined,
  hasta: undefined,
};

interface Opciones {
  modo?: 'grupo' | 'global';
  idGrupo?: string;
  consultarGrupoImpl?: (...args: unknown[]) => ReturnType<ServicioAuditoria['consultarGrupo']>;
  consultarGlobalImpl?: (...args: unknown[]) => ReturnType<ServicioAuditoria['consultarGlobal']>;
}

async function configurar(opciones: Opciones = {}) {
  const servicioAuditoria = {
    consultarGrupo: vi.fn(opciones.consultarGrupoImpl ?? (() => of(pagina([evento(1)])))),
    consultarGlobal: vi.fn(opciones.consultarGlobalImpl ?? (() => of(pagina([evento(1)])))),
  };
  const servicioCatalogos = { estados: vi.fn(() => of(RESULTADOS)) };

  TestBed.configureTestingModule({
    imports: [Auditoria],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            data: { modo: opciones.modo ?? 'grupo' },
            paramMap: convertToParamMap(
              opciones.modo === 'global' ? {} : { idGrupo: opciones.idGrupo ?? '5' },
            ),
          },
        },
      },
      { provide: ServicioAuditoria, useValue: servicioAuditoria },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
    ],
  });

  const fixture = TestBed.createComponent(Auditoria);
  await fixture.whenStable();
  return { fixture, servicioAuditoria, elemento: fixture.nativeElement as HTMLElement };
}

function porId<T extends HTMLElement>(elemento: HTMLElement, id: string): T {
  const encontrado = elemento.querySelector<T>(`#${id}`);
  if (!encontrado) throw new Error(`Sin #${id}`);
  return encontrado;
}

function elegirOpcion(select: HTMLSelectElement, texto: string): void {
  const indice = Array.from(select.options).findIndex((o) => o.textContent?.trim() === texto);
  if (indice < 0) throw new Error(`Sin opción "${texto}"`);
  select.selectedIndex = indice;
  select.dispatchEvent(new Event('change'));
}

function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('Auditoria', () => {
  it('cargaPrimeraPaginaDelGrupo', async () => {
    const { elemento, servicioAuditoria } = await configurar({ idGrupo: '5' });

    expect(servicioAuditoria.consultarGrupo).toHaveBeenCalledWith(5, FILTRO_VACIO, 0, 20);
    expect(elemento.querySelector('.tarjeta-evento')).toBeTruthy();
  });

  // Corrección ronda 1: EJECUCION_PROCESO (CorridaAlertas/ServicioGeneracionTareas)
  // también se audita en la API y debe poder filtrarse en la página.
  it('listaDeTiposDeEntidadIncluyeEjecucionProceso', async () => {
    const { elemento } = await configurar();

    const select = porId<HTMLSelectElement>(elemento, 'auditoria-tipo-entidad');
    const opciones = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(opciones).toContain('Proceso automático');
  });

  it('aplicarFiltrosEnviaSoloLosUsadosYVuelveAPagina0', async () => {
    const { fixture, elemento, servicioAuditoria } = await configurar({
      consultarGrupoImpl: () => of(pagina([evento(1)], 50)),
    });

    // Avanza a la página 1 antes de aplicar el filtro.
    elemento.querySelector<HTMLButtonElement>('.paginacion button:last-of-type')!.click();
    await fixture.whenStable();
    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(5, FILTRO_VACIO, 1, 20);

    elegirOpcion(porId(elemento, 'auditoria-tipo-entidad'), 'Tarea de cuidado');
    elemento.querySelector<HTMLFormElement>('.filtros form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(
      5,
      { ...FILTRO_VACIO, tipoEntidad: 'TAREA_CUIDADO' },
      0,
      20,
    );
  });

  it('paginacionAnteriorSiguienteConLimites', async () => {
    const { fixture, elemento, servicioAuditoria } = await configurar({
      consultarGrupoImpl: () => of(pagina([evento(1)], 45)),
    });

    const anterior = elemento.querySelector<HTMLButtonElement>('.paginacion button:first-of-type')!;
    const siguiente = elemento.querySelector<HTMLButtonElement>('.paginacion button:last-of-type')!;

    expect(anterior.disabled).toBe(true);
    expect(siguiente.disabled).toBe(false);
    expect(elemento.querySelector('.paginacion span')?.textContent).toContain('Página 1 de 3');

    siguiente.click();
    await fixture.whenStable();
    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(5, FILTRO_VACIO, 1, 20);
    expect(anterior.disabled).toBe(false);
    expect(siguiente.disabled).toBe(false);

    siguiente.click();
    await fixture.whenStable();
    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(5, FILTRO_VACIO, 2, 20);
    expect(siguiente.disabled).toBe(true);

    anterior.click();
    await fixture.whenStable();
    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(5, FILTRO_VACIO, 1, 20);
  });

  it('actorNuloMuestraProcesoAutomatico', async () => {
    const { elemento } = await configurar({
      consultarGrupoImpl: () => of(pagina([evento(1, { actor: null })])),
    });

    expect(elemento.querySelector('.tarjeta-evento__actor')?.textContent?.trim()).toBe(
      'Proceso automático',
    );
  });

  it('detallesSeMuestranEnDetails', async () => {
    const detalles = { motivo: 'cambio de estado', ids: [1, 2] };
    const { elemento } = await configurar({
      consultarGrupoImpl: () => of(pagina([evento(1, { detalles })])),
    });

    const detallesEl = elemento.querySelector('details.detalles');
    expect(detallesEl).toBeTruthy();
    expect(detallesEl!.querySelector('pre')!.textContent).toBe(JSON.stringify(detalles, null, 2));
  });

  it('modoGlobalMuestraFiltroIdGrupoYUsaConsultarGlobal', async () => {
    const { elemento, servicioAuditoria } = await configurar({ modo: 'global' });

    expect(servicioAuditoria.consultarGlobal).toHaveBeenCalledWith(FILTRO_VACIO, 0, 20);
    expect(servicioAuditoria.consultarGrupo).not.toHaveBeenCalled();
    expect(porId(elemento, 'auditoria-id-grupo')).toBeTruthy();
  });

  it('vacioYErrorConReintento', async () => {
    const { elemento } = await configurar({ consultarGrupoImpl: () => of(pagina([])) });
    expect(elemento.querySelector('.vacio')?.textContent).toContain(
      'No hay eventos para estos filtros.',
    );

    TestBed.resetTestingModule();
    const { fixture, elemento: elementoError, servicioAuditoria } = await configurar({
      consultarGrupoImpl: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('boom')))
        .mockReturnValueOnce(of(pagina([evento(1)]))),
    });

    expect(elementoError.querySelector('[role="alert"]')?.textContent).toContain(
      'Ocurrió un error inesperado.',
    );

    elementoError.querySelector<HTMLButtonElement>('.error button')!.click();
    await fixture.whenStable();

    expect(servicioAuditoria.consultarGrupo).toHaveBeenCalledTimes(2);
    expect(elementoError.querySelector('[role="alert"]')).toBeFalsy();
    expect(elementoError.querySelector('.tarjeta-evento')).toBeTruthy();
  });

  it('paginarSinAplicarUsaElFiltroYaAplicadoNoElFormularioEnVivo', async () => {
    const { fixture, elemento, servicioAuditoria } = await configurar({
      consultarGrupoImpl: () => of(pagina([evento(1)], 50)),
    });

    // Cambia el filtro en el formulario pero NO pulsa "Aplicar filtros".
    elegirOpcion(porId(elemento, 'auditoria-tipo-entidad'), 'Tarea de cuidado');
    elemento.querySelector<HTMLButtonElement>('.paginacion button:last-of-type')!.click();
    await fixture.whenStable();

    // La página siguiente se pide con el filtro vacío (el último aplicado), no con el del formulario.
    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(5, FILTRO_VACIO, 1, 20);
  });

  it('paginacionSeDeshabilitaMientrasCarga', async () => {
    const sujeto = new Subject<RespuestaPagina<RespuestaEventoAuditoria>>();
    const { fixture, elemento } = await configurar({
      consultarGrupoImpl: vi
        .fn()
        .mockReturnValueOnce(of(pagina([evento(1)], 50)))
        .mockReturnValueOnce(sujeto.asObservable()),
    });

    const anterior = elemento.querySelector<HTMLButtonElement>('.paginacion button:first-of-type')!;
    const siguiente = elemento.querySelector<HTMLButtonElement>('.paginacion button:last-of-type')!;

    siguiente.click();
    await fixture.whenStable();

    // Mientras la página 1 está cargando, ambos botones quedan deshabilitados.
    expect(anterior.disabled).toBe(true);
    expect(siguiente.disabled).toBe(true);

    sujeto.next(pagina([evento(2)], 50));
    sujeto.complete();
    await fixture.whenStable();

    expect(anterior.disabled).toBe(false);
    expect(siguiente.disabled).toBe(false);
  });

  it('dosEnviosRapidosDeFiltrosDescartanLaRespuestaMasVieja', async () => {
    const sujetoViejo = new Subject<RespuestaPagina<RespuestaEventoAuditoria>>();
    const sujetoNuevo = new Subject<RespuestaPagina<RespuestaEventoAuditoria>>();
    const { fixture, elemento } = await configurar({
      consultarGrupoImpl: vi
        .fn()
        .mockReturnValueOnce(of(pagina([evento(1)])))
        .mockReturnValueOnce(sujetoViejo.asObservable())
        .mockReturnValueOnce(sujetoNuevo.asObservable()),
    });

    const formulario = elemento.querySelector<HTMLFormElement>('.filtros form')!;
    // Dos envíos seguidos (doble toque en "Aplicar filtros") antes de que respondan.
    formulario.dispatchEvent(new Event('submit'));
    formulario.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    sujetoNuevo.next(pagina([evento(20, { idEntidad: 'NUEVO' })]));
    sujetoNuevo.complete();
    await fixture.whenStable();

    // La respuesta del primer envío (más vieja) llega después: se descarta.
    sujetoViejo.next(pagina([evento(10, { idEntidad: 'VIEJO' })]));
    sujetoViejo.complete();
    await fixture.whenStable();

    const entidades = Array.from(elemento.querySelectorAll('.tarjeta-evento__entidad')).map(
      (e) => e.textContent,
    );
    expect(entidades.some((t) => t?.includes('NUEVO'))).toBe(true);
    expect(entidades.some((t) => t?.includes('VIEJO'))).toBe(false);
  });

  it('fechaDesdePosteriorAHastaMuestraErrorDelServidor', async () => {
    const mensaje = 'La fecha desde no puede ser posterior a la fecha hasta';
    const { fixture, elemento, servicioAuditoria } = await configurar({
      consultarGrupoImpl: vi
        .fn()
        .mockReturnValueOnce(of(pagina([evento(1)])))
        .mockReturnValueOnce(
          throwError(() => new HttpErrorResponse({ status: 422, error: { detail: mensaje } })),
        ),
    });

    escribir(porId(elemento, 'auditoria-desde'), '2026-11-10');
    escribir(porId(elemento, 'auditoria-hasta'), '2026-11-01');
    elemento.querySelector<HTMLFormElement>('.filtros form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(
      5,
      { ...FILTRO_VACIO, desde: '2026-11-10', hasta: '2026-11-01' },
      0,
      20,
    );
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(mensaje);
  });
  it('eventoMuestraEtiquetaYCodigo', async () => {
    const { elemento } = await configurar({
      consultarGrupoImpl: () =>
        of(
          pagina([
            evento(1, {
              codigoAccion: 'REGISTRAR_RELEVO',
              tipoEntidad: 'TRASPASO_FAMILIAR',
              idEntidad: '42',
            }),
            evento(2, { codigoAccion: 'ALGO_NUEVO' }),
          ]),
        ),
    });

    const tarjetas = elemento.querySelectorAll('.tarjeta-evento');
    expect(tarjetas[0].querySelector('.tarjeta-evento__accion')?.textContent?.trim()).toBe(
      'Registró un relevo',
    );
    expect(tarjetas[0].querySelector('.tarjeta-evento__codigo')?.textContent?.trim()).toBe(
      'REGISTRAR_RELEVO',
    );
    expect(tarjetas[0].querySelector('.tarjeta-evento__entidad')?.textContent?.trim()).toBe(
      'Relevo · 42',
    );
    // Código desconocido: frase de respaldo, y el código crudo igual queda visible.
    expect(tarjetas[1].querySelector('.tarjeta-evento__accion')?.textContent?.trim()).toBe(
      'Algo nuevo',
    );
    expect(tarjetas[1].querySelector('.tarjeta-evento__codigo')?.textContent?.trim()).toBe(
      'ALGO_NUEVO',
    );
  });

  it('selectAccionEnviaCodigo', async () => {
    const { fixture, elemento, servicioAuditoria } = await configurar();

    const select = porId<HTMLSelectElement>(elemento, 'auditoria-accion');
    expect(select.tagName).toBe('SELECT');
    const textos = Array.from(select.options).map((o) => o.textContent?.trim() ?? '');
    expect(textos[0]).toBe('Todas');
    const resto = textos.slice(1);
    expect(resto).toContain('Registró un relevo');
    expect(resto).toEqual([...resto].sort((a, b) => a.localeCompare(b, 'es')));

    elegirOpcion(select, 'Registró un relevo');
    elegirOpcion(porId(elemento, 'auditoria-tipo-entidad'), 'Relevo');
    elemento.querySelector<HTMLFormElement>('.filtros form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAuditoria.consultarGrupo).toHaveBeenLastCalledWith(
      5,
      { ...FILTRO_VACIO, codigoAccion: 'REGISTRAR_RELEVO', tipoEntidad: 'TRASPASO_FAMILIAR' },
      0,
      20,
    );
  });

  it('summaryCuentaFiltrosAplicados', async () => {
    const { fixture, elemento } = await configurar();

    const filtros = elemento.querySelector<HTMLDetailsElement>('details.filtros')!;
    const summary = filtros.querySelector('summary')!;
    expect(summary.textContent?.trim()).toBe('Filtros');
    // jsdom no tiene matchMedia: se comporta como móvil y empieza cerrado.
    expect(filtros.open).toBe(false);

    filtros.open = true;
    elegirOpcion(porId(elemento, 'auditoria-accion'), 'Registró un relevo');
    escribir(porId(elemento, 'auditoria-desde'), '2026-11-01');
    // Sin aplicar todavía: el contador sigue al filtro aplicado, no al formulario.
    await fixture.whenStable();
    expect(summary.textContent?.trim()).toBe('Filtros');

    elemento.querySelector<HTMLFormElement>('.filtros form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(summary.textContent?.trim()).toBe('Filtros (2 activos)');
    // "Aplicar filtros" no cierra el panel.
    expect(filtros.open).toBe(true);

    elegirOpcion(porId(elemento, 'auditoria-accion'), 'Todas');
    elemento.querySelector<HTMLFormElement>('.filtros form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(summary.textContent?.trim()).toBe('Filtros (1 activo)');
  });

  it('filtrosEmpiezanAbiertosEnEscritorio', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((consulta: string) => ({
      matches: consulta.includes('min-width: 768px'),
      media: consulta,
    })) as unknown as typeof window.matchMedia;
    try {
      const { elemento } = await configurar();
      expect(elemento.querySelector<HTMLDetailsElement>('details.filtros')!.open).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});
