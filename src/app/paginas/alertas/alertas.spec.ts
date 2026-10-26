import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Alertas } from './alertas';
import { RespuestaAlerta } from '../../nucleo/alertas/modelos-alertas';
import { FiltroAlertas, ServicioAlertas } from '../../nucleo/alertas/servicio-alertas';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
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
  const servicioCatalogos = {
    estados: opciones.estadosFn ?? vi.fn(() => of(opciones.estados ?? ESTADOS_ALERTA)),
  };

  TestBed.configureTestingModule({
    imports: [Alertas],
    providers: [
      provideRouter([]),
      { provide: ServicioAlertas, useValue: servicioAlertas },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
    ],
  });
  const fixture = TestBed.createComponent(Alertas);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioAlertas,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement {
  return Array.from(elemento.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  )!;
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
    expect(botonConTexto(elemento, 'Abiertas').getAttribute('aria-pressed')).toBe('true');
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

    botonConTexto(elemento, 'Cerradas').click();
    await fixture.whenStable();

    expect(servicioAlertas.listar).toHaveBeenCalledWith(1, {
      idEstado: ID_ESTADO_CERRADA,
      tipoAlerta: undefined,
      pagina: 0,
      tamano: 20,
    });
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
    const listar = vi
      .fn()
      .mockReturnValueOnce(of(pagina([alerta({ idAlerta: 1, mensajeAlerta: 'Primera' })], 2, 0)))
      .mockReturnValueOnce(
        of(pagina([alerta({ idAlerta: 2, mensajeAlerta: 'Segunda' })], 2, 1)),
      );
    const { fixture, elemento } = await configurar({ listar });

    expect(elemento.querySelectorAll('.tarjeta-alerta')).toHaveLength(1);
    const botonCargarMas = botonConTexto(elemento, 'Cargar más');
    expect(botonCargarMas).toBeDefined();

    botonCargarMas.click();
    await fixture.whenStable();

    expect(listar).toHaveBeenNthCalledWith(2, 1, {
      idEstado: ID_ESTADO_ABIERTA,
      tipoAlerta: undefined,
      pagina: 1,
      tamano: 20,
    });
    expect(elemento.querySelectorAll('.tarjeta-alerta')).toHaveLength(2);
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
    expect(elemento.querySelectorAll('.tarjeta-alerta')).toHaveLength(0);

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
});
