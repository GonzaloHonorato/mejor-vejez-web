import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Relevos } from './relevos';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo, RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import {
  RespuestaRelevo,
  RespuestaRelevoResumen,
  SolicitudRegistrarRelevo,
} from '../../nucleo/relevos/modelos-relevos';
import { FiltroRelevos, ServicioRelevos } from '../../nucleo/relevos/servicio-relevos';
import { RespuestaPagina } from '../../nucleo/usuarios/modelos-usuarios';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

// idEstado > 127 a propósito: la comparación de estado debe ser por valor.
const ESTADOS_INTEGRANTE: RespuestaEstadoCatalogo[] = [
  { idEstado: 140, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 141, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];
const ESTADOS_RELEVO: RespuestaEstadoCatalogo[] = [
  { idEstado: 160, codigo: 'COMPLETADA', descripcion: 'Completada', orden: 1 },
  { idEstado: 161, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 2 },
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

function integrante(idUsuario: number, nombre: string, idEstado = 140): RespuestaIntegrante {
  return {
    idIntegrante: idUsuario + 1000,
    idUsuario,
    nombre,
    email: `${idUsuario}@correo.cl`,
    idRol: 2,
    nombreRol: 'COLABORADOR',
    idEstado,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: null,
  };
}

function persona(idUsuario: number, nombre: string) {
  return { idUsuario, nombre };
}

function resumen(idRelevo: number, datos: Partial<RespuestaRelevoResumen> = {}): RespuestaRelevoResumen {
  return {
    idRelevo,
    idGrupo: 1,
    nombreGrupo: 'Familia Rojas',
    idAdulto: 5,
    nombreAdulto: 'Rosa González',
    saliente: persona(300, 'Ana Rojas'),
    entrante: persona(301, 'Beto Díaz'),
    creador: persona(300, 'Ana Rojas'),
    fechaTraspaso: '2026-11-02T08:00:00-03:00',
    idEstado: 160,
    codigoEstado: 'COMPLETADA',
    totalTareas: 0,
    totalAlertas: 0,
    ...datos,
  };
}

function relevo(idRelevo: number, datos: Partial<RespuestaRelevo> = {}): RespuestaRelevo {
  return { ...resumen(idRelevo), notas: null, detalles: [], ...datos };
}

function pagina(elementos: RespuestaRelevoResumen[]): RespuestaPagina<RespuestaRelevoResumen> {
  return { elementos, pagina: 0, tamano: 20, total: elementos.length };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  adultos?: RespuestaAdultoMayor[];
  integrantes?: RespuestaIntegrante[];
  idUsuario?: number;
  esAdministrador?: boolean;
  queryParams?: Record<string, string>;
  listarImpl?: (idGrupo: number, filtro?: FiltroRelevos) => Observable<RespuestaPagina<RespuestaRelevoResumen>>;
  registrarImpl?: (idGrupo: number, s: SolicitudRegistrarRelevo) => Observable<RespuestaRelevo>;
  adultosImpl?: (idGrupo: number) => Observable<RespuestaAdultoMayor[]>;
  integrantesImpl?: (idGrupo: number) => Observable<RespuestaIntegrante[]>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioRelevos = {
    listar: vi.fn(opciones.listarImpl ?? (() => of(pagina([])))),
    registrar: vi.fn(opciones.registrarImpl ?? (() => of(relevo(900)))),
    obtener: vi.fn(),
    cancelar: vi.fn(),
  };
  const servicioAdultos = {
    listar: vi.fn(opciones.adultosImpl ?? (() => of(opciones.adultos ?? [adulto()]))),
  };
  const servicioGrupos = {
    integrantes: vi.fn(
      opciones.integrantesImpl ?? (() => of(opciones.integrantes ?? [integrante(300, 'Ana Rojas')])),
    ),
  };
  const servicioCatalogos = {
    estados: vi.fn((tabla: string) =>
      of(tabla === 'TRASPASO_FAMILIAR' ? ESTADOS_RELEVO : ESTADOS_INTEGRANTE),
    ),
  };
  const servicioYo = {
    obtener: vi.fn(() =>
      of({
        idUsuario: opciones.idUsuario ?? 200,
        nombre: 'Ana',
        email: 'ana@correo.cl',
        telefono: null,
        esAdministrador: opciones.esAdministrador ?? false,
      }),
    ),
  };

  TestBed.configureTestingModule({
    imports: [Relevos],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(opciones.queryParams ?? {}) } },
      },
      { provide: ServicioRelevos, useValue: servicioRelevos },
      { provide: ServicioAdultos, useValue: servicioAdultos },
      { provide: ServicioGrupos, useValue: servicioGrupos },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      { provide: ServicioYo, useValue: servicioYo },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(Relevos);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioRelevos,
    router,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

type Fixture = Awaited<ReturnType<typeof configurar>>['fixture'];

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

function accionPrincipal(elemento: HTMLElement): HTMLButtonElement {
  const boton = elemento.querySelector<HTMLButtonElement>('.mv-encabezado__accion button');
  if (!boton) throw new Error('Sin acción principal');
  return boton;
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find(
    (boton) => boton.textContent?.trim() === texto,
  );
}

async function abrirFormulario(fixture: Fixture, elemento: HTMLElement) {
  accionPrincipal(elemento).click();
  await fixture.whenStable();
}

async function enviar(fixture: Fixture, elemento: HTMLElement) {
  elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

describe('Relevos', () => {
  it('listaRelevosDelGrupoActivoYFiltraPorAdulto', async () => {
    const { fixture, elemento, servicioRelevos } = await configurar({
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
    });

    expect(servicioRelevos.listar).toHaveBeenCalledWith(1, {
      idAdulto: undefined,
      pagina: 0,
      tamano: 20,
    });

    servicioRelevos.listar.mockClear();
    elegirOpcion(porId(elemento, 'relevos-filtro-adulto'), 'Rosa González');
    await fixture.whenStable();

    expect(servicioRelevos.listar).toHaveBeenCalledWith(1, { idAdulto: 5, pagina: 0, tamano: 20 });
  });

  it('chipCanceladaUsaElColorDeAdvertenciaNoElDeExito', async () => {
    const { elemento } = await configurar({
      listarImpl: () =>
        of(pagina([resumen(1, { idEstado: 161, codigoEstado: 'CANCELADA' })])),
    });

    const chip = elemento.querySelector('.mv-fila .mv-chip')!;
    expect(chip.textContent?.trim()).toBe('Cancelada');
    expect(chip.classList.contains('mv-chip--alerta')).toBe(true);
    expect(chip.classList.contains('mv-chip--exito')).toBe(false);
  });

  it('chipCompletadaNoUsaElColorDeCancelada', async () => {
    const { elemento } = await configurar({
      listarImpl: () => of(pagina([resumen(1)])),
    });

    const chip = elemento.querySelector('.mv-fila .mv-chip')!;
    expect(chip.textContent?.trim()).toBe('Completada');
    expect(chip.classList.contains('mv-chip--alerta')).toBe(false);
    expect(chip.classList.contains('mv-chip--exito')).toBe(true);
  });

  it('queryParamIdAdultoPreseleccionaAdulto', async () => {
    const { elemento } = await configurar({
      queryParams: { idAdulto: '5' },
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
    });

    expect(accionPrincipal(elemento).getAttribute('aria-expanded')).toBe('true');
    const select = porId<HTMLSelectElement>(elemento, 'relevos-adulto');
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('Rosa González');
  });

  it('colaboradorTieneQuienEntregaFijoEnSiMismo', async () => {
    const { fixture, elemento } = await configurar({
      activo: grupo(1, 'COLABORADOR'),
      idUsuario: 300,
      integrantes: [integrante(300, 'Ana Rojas'), integrante(301, 'Beto Díaz')],
    });
    await abrirFormulario(fixture, elemento);

    const select = porId<HTMLSelectElement>(elemento, 'relevos-saliente');
    expect(select.disabled).toBe(true);
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('Ana Rojas');
  });

  it('entranteExcluyeAQuienEntrega', async () => {
    const { fixture, elemento } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      integrantes: [integrante(300, 'Ana Rojas'), integrante(301, 'Beto Díaz')],
    });
    await abrirFormulario(fixture, elemento);

    elegirOpcion(porId(elemento, 'relevos-saliente'), 'Ana Rojas');
    await fixture.whenStable();

    const entrante = porId<HTMLSelectElement>(elemento, 'relevos-entrante');
    const opciones = Array.from(entrante.options).map((o) => o.textContent?.trim());
    expect(opciones).not.toContain('Ana Rojas');
    expect(opciones).toContain('Beto Díaz');
  });

  it('registrarNavegaAlDetalle', async () => {
    const { fixture, elemento, servicioRelevos, router } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
      integrantes: [integrante(300, 'Ana Rojas'), integrante(301, 'Beto Díaz')],
      registrarImpl: () => of(relevo(55)),
    });
    await abrirFormulario(fixture, elemento);

    elegirOpcion(porId(elemento, 'relevos-adulto'), 'Rosa González');
    elegirOpcion(porId(elemento, 'relevos-saliente'), 'Ana Rojas');
    elegirOpcion(porId(elemento, 'relevos-entrante'), 'Beto Díaz');
    await enviar(fixture, elemento);

    expect(servicioRelevos.registrar).toHaveBeenCalledWith(1, {
      idAdulto: 5,
      idUsuarioSaliente: 300,
      idUsuarioEntrante: 301,
      notas: null,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/relevos', 55]);
  });

  it('errorDeValidacionSeMuestraEnRoleAlert', async () => {
    const mensaje = 'Quien entrega y quien recibe deben ser personas distintas';
    const { fixture, elemento } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
      integrantes: [integrante(300, 'Ana Rojas'), integrante(301, 'Beto Díaz')],
      registrarImpl: () =>
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: mensaje } })) as never,
    });
    await abrirFormulario(fixture, elemento);

    elegirOpcion(porId(elemento, 'relevos-adulto'), 'Rosa González');
    elegirOpcion(porId(elemento, 'relevos-saliente'), 'Ana Rojas');
    elegirOpcion(porId(elemento, 'relevos-entrante'), 'Beto Díaz');
    await enviar(fixture, elemento);

    const alertas = Array.from(elemento.querySelectorAll('[role="alert"]')).map((a) => a.textContent);
    expect(alertas.some((texto) => texto?.includes(mensaje))).toBe(true);
  });

  it('cambioDeGrupoDescartaRespuestasTardias', async () => {
    const sujetoGrupo1 = new Subject<RespuestaPagina<RespuestaRelevoResumen>>();
    const sujetoGrupo2 = new Subject<RespuestaPagina<RespuestaRelevoResumen>>();
    const { fixture, elemento, activo } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      listarImpl: (idGrupo) =>
        idGrupo === 1 ? sujetoGrupo1.asObservable() : sujetoGrupo2.asObservable(),
    });

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    sujetoGrupo2.next(pagina([resumen(20, { nombreAdulto: 'Pedro Soto' })]));
    sujetoGrupo2.complete();
    await fixture.whenStable();

    // La respuesta del grupo 1 (obsoleta) llega después: debe ser ignorada.
    sujetoGrupo1.next(pagina([resumen(10, { nombreAdulto: 'Beto Díaz' })]));
    sujetoGrupo1.complete();
    await fixture.whenStable();

    const nombres = Array.from(elemento.querySelectorAll('.mv-fila__titulo')).map((e) =>
      e.textContent?.trim(),
    );
    expect(nombres).toEqual(['Pedro Soto']);
  });

  it('cambioDeGrupoDescartaRespuestasTardiasDeAdultosEIntegrantes', async () => {
    const adultosGrupo1 = new Subject<RespuestaAdultoMayor[]>();
    const adultosGrupo2 = new Subject<RespuestaAdultoMayor[]>();
    const integrantesGrupo1 = new Subject<RespuestaIntegrante[]>();
    const integrantesGrupo2 = new Subject<RespuestaIntegrante[]>();
    const { fixture, elemento, activo } = await configurar({
      activo: grupo(1, 'COORDINADOR'),
      adultosImpl: (idGrupo) =>
        idGrupo === 1 ? adultosGrupo1.asObservable() : adultosGrupo2.asObservable(),
      integrantesImpl: (idGrupo) =>
        idGrupo === 1 ? integrantesGrupo1.asObservable() : integrantesGrupo2.asObservable(),
    });
    await abrirFormulario(fixture, elemento);

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    adultosGrupo2.next([adulto({ idAdultoMayor: 9, nombreCompleto: 'Pedro Soto' })]);
    adultosGrupo2.complete();
    integrantesGrupo2.next([integrante(400, 'Carla Pérez')]);
    integrantesGrupo2.complete();
    await fixture.whenStable();

    // Respuestas tardías del grupo 1 (ya reemplazado): deben ser ignoradas.
    adultosGrupo1.next([adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })]);
    adultosGrupo1.complete();
    integrantesGrupo1.next([integrante(300, 'Ana Rojas')]);
    integrantesGrupo1.complete();
    await fixture.whenStable();

    const opcionesAdulto = Array.from(
      porId<HTMLSelectElement>(elemento, 'relevos-adulto').options,
    ).map((o) => o.textContent?.trim());
    expect(opcionesAdulto).toEqual(['Selecciona…', 'Pedro Soto']);

    const opcionesSaliente = Array.from(
      porId<HTMLSelectElement>(elemento, 'relevos-saliente').options,
    ).map((o) => o.textContent?.trim());
    expect(opcionesSaliente).toEqual(['Selecciona…', 'Carla Pérez']);
  });

  it('cambioDeGrupoReiniciaFiltroYFormularioYQuitaIdAdultoDeLaUrl', async () => {
    const { fixture, elemento, activo, router } = await configurar({
      queryParams: { idAdulto: '5' },
      activo: grupo(1, 'COORDINADOR'),
      adultos: [adulto({ idAdultoMayor: 5, nombreCompleto: 'Rosa González' })],
      integrantes: [integrante(300, 'Ana Rojas'), integrante(301, 'Beto Díaz')],
    });

    const filtro = porId<HTMLSelectElement>(elemento, 'relevos-filtro-adulto');
    const adultoForm = porId<HTMLSelectElement>(elemento, 'relevos-adulto');
    expect(filtro.options[filtro.selectedIndex].textContent?.trim()).toBe('Rosa González');
    expect(adultoForm.options[adultoForm.selectedIndex].textContent?.trim()).toBe('Rosa González');

    elegirOpcion(porId(elemento, 'relevos-saliente'), 'Ana Rojas');
    elegirOpcion(porId(elemento, 'relevos-entrante'), 'Beto Díaz');
    await fixture.whenStable();

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(filtro.options[filtro.selectedIndex].textContent?.trim()).toBe('Todos');
    expect(adultoForm.options[adultoForm.selectedIndex].textContent?.trim()).toBe('Selecciona…');
    const saliente = porId<HTMLSelectElement>(elemento, 'relevos-saliente');
    const entrante = porId<HTMLSelectElement>(elemento, 'relevos-entrante');
    expect(saliente.options[saliente.selectedIndex].textContent?.trim()).toBe('Selecciona…');
    expect(entrante.options[entrante.selectedIndex].textContent?.trim()).toBe('Selecciona…');

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { idAdulto: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  describe('presentación', () => {
    it('formularioPlegadoTrasLaAccionPrincipal', async () => {
      const { fixture, elemento } = await configurar();

      const accion = accionPrincipal(elemento);
      expect(accion.textContent?.trim()).toBe('Registrar relevo');
      expect(accion.getAttribute('aria-expanded')).toBe('false');
      expect(accion.getAttribute('aria-controls')).toBe('relevos-registrar');
      expect(elemento.querySelector('form')).toBeNull();

      accion.click();
      await fixture.whenStable();

      expect(accion.getAttribute('aria-expanded')).toBe('true');
      expect(elemento.querySelector('#relevos-registrar form')).toBeTruthy();
      expect(document.activeElement).toBe(porId(elemento, 'relevos-adulto'));

      botonConTexto(elemento, 'Cancelar')!.click();
      await fixture.whenStable();

      expect(elemento.querySelector('form')).toBeNull();
      expect(accion.getAttribute('aria-expanded')).toBe('false');
    });

    it('sinGrupoNoMuestraLaAccionPrincipalNiLaLista', async () => {
      const { elemento } = await configurar({ activo: null });

      expect(elemento.querySelector('.mv-encabezado__accion')).toBeNull();
      expect(elemento.querySelector('.mv-lista')).toBeNull();
      expect(elemento.textContent).toContain('Primero crea o elige un grupo.');
    });

    it('indicadoresMuestranTotalYUltimoRelevo', async () => {
      const fecha = '2026-11-02T08:00:00-03:00';
      const { elemento } = await configurar({
        listarImpl: () =>
          of({
            ...pagina([resumen(1, { fechaTraspaso: fecha }), resumen(2, { fechaTraspaso: '2026-10-01T08:00:00-03:00' })]),
            total: 7,
          }),
      });

      const indicadores = Array.from(elemento.querySelectorAll('.mv-indicador')).map((i) =>
        i.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(indicadores).toEqual([
        '7 relevos registrados',
        `${fechaHoraLegible(fecha)} último relevo`,
      ]);
    });

    it('indicadorEnSingularYSinUltimoRelevoCuandoNoHay', async () => {
      const uno = await configurar({ listarImpl: () => of(pagina([resumen(1)])) });
      expect(uno.elemento.querySelector('.mv-indicador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        '1 relevo registrado',
      );

      TestBed.resetTestingModule();
      const ninguno = await configurar();
      expect(ninguno.elemento.querySelectorAll('.mv-indicador')).toHaveLength(1);
      expect(ninguno.elemento.querySelector('.mv-vacio')?.textContent).toContain(
        'No hay relevos registrados.',
      );
    });

    it('filaTieneElTituloComoEnlaceAlDetalle', async () => {
      const fecha = '2026-11-02T08:00:00-03:00';
      const { elemento } = await configurar({
        listarImpl: () => of(pagina([resumen(1, { fechaTraspaso: fecha })])),
      });

      const fila = elemento.querySelector<HTMLElement>('.mv-fila')!;
      const enlace = fila.querySelector<HTMLAnchorElement>('a.mv-fila__titulo')!;
      expect(enlace.textContent?.trim()).toBe('Rosa González');
      expect(enlace.getAttribute('href')).toBe('/relevos/1');
      expect(enlace.getAttribute('aria-label')).toBe(
        `Relevo de Rosa González: Ana Rojas entrega a Beto Díaz, ${fechaHoraLegible(fecha)}`,
      );
      expect(fila.querySelector('.personas')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Ana Rojas entrega a Beto Díaz',
      );
      expect(fila.textContent).toContain(fechaHoraLegible(fecha));
      expect(fila.querySelectorAll('a')).toHaveLength(1);
      expect(elemento.textContent).not.toContain('Ver detalle');
    });

    it('cargandoMuestraEsqueleto', async () => {
      const { elemento } = await configurar({ listarImpl: () => new Subject() });

      const estado = elemento.querySelector('[role="status"]')!;
      expect(estado.textContent).toContain('Cargando relevos…');
      expect(estado.querySelector('.mv-esqueleto')).toBeTruthy();
      expect(elemento.querySelector('.mv-indicador')).toBeNull();
    });

    it('errorDeCargaPermiteReintentar', async () => {
      let llamadas = 0;
      const { fixture, elemento, servicioRelevos } = await configurar({
        listarImpl: () =>
          ++llamadas === 1
            ? (throwError(() => new HttpErrorResponse({ status: 500, error: {} })) as never)
            : of(pagina([resumen(1)])),
      });

      const aviso = elemento.querySelector('.mv-aviso--error[role="alert"]')!;
      expect(aviso).toBeTruthy();
      expect(elemento.querySelector('.mv-indicador')).toBeNull();

      botonConTexto(aviso as HTMLElement, 'Reintentar')!.click();
      await fixture.whenStable();

      expect(servicioRelevos.listar).toHaveBeenCalledTimes(2);
      expect(elemento.querySelector('.mv-aviso--error')).toBeNull();
      expect(elemento.querySelectorAll('.mv-fila')).toHaveLength(1);
    });
  });
});
