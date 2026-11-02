import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Grupos } from './grupos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const catalogos = {
  provide: ServicioCatalogos,
  useValue: {
    estados: () =>
      of([
        { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
        { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
      ]),
  },
};

function grupo(idGrupo: number, nombreGrupo: string, miRol: string | null): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo,
    notificaCoordinador: true,
    idEstado: 1,
    miRol,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

async function configurar(
  gruposIniciales: RespuestaGrupo[],
  esAdministrador = false,
  opciones: { cargar?: () => Promise<void>; error?: string } = {},
) {
  const grupos = signal(gruposIniciales);
  const activo = signal<RespuestaGrupo | null>(gruposIniciales[0] ?? null);
  /** Lo que devolverá la próxima llamada a `cargar()` (simula la recarga desde la API). */
  let siguienteCarga = gruposIniciales;
  const grupoActivo = {
    grupos,
    activo,
    error: signal<string | null>(opciones.error ?? null),
    cargar: vi.fn(
      opciones.cargar ??
        (async () => {
          grupos.set(siguienteCarga);
        }),
    ),
    seleccionar: vi.fn((idGrupo: number) => {
      activo.set(grupos().find((g) => g.idGrupo === idGrupo) ?? null);
    }),
    limpiar: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [Grupos],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ServicioGrupoActivo, useValue: grupoActivo },
      catalogos,
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({ idUsuario: 1, nombre: 'Ana', email: 'ana@correo.cl', telefono: null, esAdministrador }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Grupos);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return {
    fixture,
    grupoActivo,
    http: TestBed.inject(HttpTestingController),
    elemento: fixture.nativeElement as HTMLElement,
    alRecargar: (lista: RespuestaGrupo[]) => {
      siguienteCarga = lista;
    },
  };
}

async function abrirCrear(fixture: ComponentFixture<Grupos>): Promise<void> {
  const elemento = fixture.nativeElement as HTMLElement;
  elemento.querySelector<HTMLButtonElement>('#grupos-abrir-crear')!.click();
  await fixture.whenStable();
}

async function crearGrupo(fixture: ComponentFixture<Grupos>, nombre: string): Promise<void> {
  const elemento = fixture.nativeElement as HTMLElement;
  await abrirCrear(fixture);
  const campo = elemento.querySelector<HTMLInputElement>('#grupo-nombre')!;
  campo.value = nombre;
  campo.dispatchEvent(new Event('input'));
  elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
}

describe('Grupos', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('listaMisGruposConRol', async () => {
    const { elemento, grupoActivo } = await configurar([
      grupo(1, 'Familia Rojas', 'COORDINADOR'),
      grupo(2, 'Familia Soto', 'COLABORADOR'),
    ]);

    expect(grupoActivo.cargar).toHaveBeenCalled();
    const filas = Array.from(elemento.querySelectorAll('.grupo'));
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Familia Rojas');
    expect(filas[0].textContent).toContain('Coordinador/a');
    expect(filas[0].textContent).toContain('Grupo activo');
    expect(filas[1].textContent).toContain('Familia Soto');
    expect(filas[1].textContent).toContain('Colaborador/a');
    expect(filas[1].textContent).not.toContain('Grupo activo');
    expect(filas[1].querySelector('a')?.getAttribute('href')).toBe('/grupos/2');
    expect(elemento.textContent).not.toContain('Ver todos los grupos');

    const usar = Array.from(filas[1].querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Usar grupo'),
    )!;
    usar.click();
    expect(grupoActivo.seleccionar).toHaveBeenCalledWith(2);
  });

  it('crearGrupoLoDejaActivo', async () => {
    const existente = grupo(1, 'Familia Rojas', 'COORDINADOR');
    const { fixture, elemento, http, grupoActivo, alRecargar } = await configurar([existente]);
    const nuevo = grupo(7, 'Familia Pérez', 'COORDINADOR');
    alRecargar([existente, nuevo]);

    await crearGrupo(fixture, 'Familia Pérez');
    const peticion = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/api/grupos'));
    expect(peticion.request.body).toEqual({ nombreGrupo: 'Familia Pérez' });
    peticion.flush(nuevo);
    await fixture.whenStable();

    expect(grupoActivo.cargar).toHaveBeenCalledTimes(2);
    expect(grupoActivo.seleccionar).toHaveBeenCalledWith(7);
    expect(grupoActivo.activo()?.idGrupo).toBe(7);
    expect(elemento.textContent).toContain('Familia Pérez');
  });

  it('muestraErrorDeLaApiAlCrear', async () => {
    const { fixture, elemento, http, grupoActivo } = await configurar([]);

    await crearGrupo(fixture, 'Familia Rojas');
    http
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/api/grupos'))
      .flush(
        { title: 'Conflicto', detail: 'Ya tienes un grupo con ese nombre' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya tienes un grupo con ese nombre',
    );
    expect(grupoActivo.seleccionar).not.toHaveBeenCalled();
  });

  it('crearGrupoConFallaAlRecargarLiberaElBoton', async () => {
    const { fixture, elemento, http, grupoActivo } = await configurar([]);
    grupoActivo.cargar.mockRejectedValueOnce(new Error('boom'));

    await crearGrupo(fixture, 'Familia Rojas');
    const peticion = http.expectOne((req) => req.method === 'POST' && req.url.endsWith('/api/grupos'));
    peticion.flush(grupo(5, 'Familia Rojas', 'COORDINADOR'));
    await fixture.whenStable();

    const boton = elemento.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(false);
    expect(boton.textContent).toContain('Crear grupo');
    expect(grupoActivo.seleccionar).not.toHaveBeenCalled();
  });

  it('muestraAvisoSiFallaLaVerificacionDePermisos', async () => {
    const grupos = signal<RespuestaGrupo[]>([]);
    const activo = signal<RespuestaGrupo | null>(null);
    TestBed.configureTestingModule({
      imports: [Grupos],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ServicioGrupoActivo,
          useValue: {
            grupos,
            activo,
            error: signal<string | null>(null),
            cargar: vi.fn(async () => {}),
            seleccionar: vi.fn(),
            limpiar: vi.fn(),
          },
        },
        { provide: ServicioYo, useValue: { obtener: () => throwError(() => new Error('boom')) } },
        catalogos,
      ],
    });
    const fixture = TestBed.createComponent(Grupos);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos verificar tus permisos',
    );
  });

  it('administradorPuedeVerTodosLosGrupos', async () => {
    const { fixture, elemento, http } = await configurar(
      [grupo(1, 'Familia Rojas', 'COORDINADOR')],
      true,
    );

    const interruptor = elemento.querySelector<HTMLInputElement>('#grupos-ver-todos')!;
    interruptor.click();
    http
      .expectOne((req) => req.method === 'GET' && req.params.get('todos') === 'true')
      .flush([grupo(1, 'Familia Rojas', 'COORDINADOR'), grupo(9, 'Familia Ajena', null)]);
    await fixture.whenStable();

    const filas = Array.from(elemento.querySelectorAll('.grupo'));
    expect(filas).toHaveLength(2);
    expect(filas[1].textContent).toContain('Familia Ajena');
    expect(filas[1].textContent).toContain('Sin membresía');
    // No es miembro: no puede dejarlo como activo, solo ver sus integrantes.
    expect(filas[1].textContent).not.toContain('Usar grupo');
  });
  it('crearGrupoQuedaPlegadoTrasLaAccionPrincipal', async () => {
    const { fixture, elemento } = await configurar([grupo(1, 'Familia Rojas', 'COORDINADOR')]);

    const abrir = elemento.querySelector<HTMLButtonElement>('#grupos-abrir-crear')!;
    expect(abrir.textContent).toContain('Crear grupo');
    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector('#grupo-nombre')).toBeFalsy();

    await abrirCrear(fixture);
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('grupo-nombre');

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Cancelar')!
      .click();
    await fixture.whenStable();
    expect(elemento.querySelector('#grupo-nombre')).toBeFalsy();
    expect(document.activeElement).toBe(abrir);
  });

  it('crearGrupoConExitoPliegaElFormulario', async () => {
    const existente = grupo(1, 'Familia Rojas', 'COORDINADOR');
    const { fixture, elemento, http, alRecargar } = await configurar([existente]);
    const nuevo = grupo(7, 'Familia Pérez', 'COORDINADOR');
    alRecargar([existente, nuevo]);

    await crearGrupo(fixture, 'Familia Pérez');
    http.expectOne((req) => req.method === 'POST').flush(nuevo);
    await fixture.whenStable();

    expect(elemento.querySelector('#grupo-nombre')).toBeFalsy();
    expect(document.activeElement?.id).toBe('grupos-abrir-crear');
  });

  it('filaMuestraFechaDeCreacionRolEIntegrantes', async () => {
    const { elemento } = await configurar([
      grupo(1, 'Familia Rojas', 'COORDINADOR'),
      grupo(2, 'Familia Soto', 'COLABORADOR'),
    ]);

    const filas = Array.from(elemento.querySelectorAll<HTMLElement>('.grupo'));
    expect(filas[0].textContent).toContain('Creado el 1 ene 2026');
    expect(filas[0].querySelector('.mv-chip')?.textContent?.trim()).toBe('Coordinador/a');
    expect(filas[0].querySelector('.mv-chip--info')?.textContent).toContain('Grupo activo');

    const enlace = filas[1].querySelector('a')!;
    expect(enlace.textContent).toContain('Integrantes');
    expect(enlace.getAttribute('aria-label')).toBe('Integrantes de Familia Soto');
    expect(enlace.querySelector('app-icono')).toBeTruthy();
    const usar = filas[1].querySelector('button')!;
    expect(usar.getAttribute('aria-label')).toBe('Usar el grupo Familia Soto');
  });

  it('grillaConColumnasGrupoMiRolEstadoYAcciones', async () => {
    const inactivo = { ...grupo(2, 'Familia Soto', 'COLABORADOR'), idEstado: 2 };
    const { elemento } = await configurar([grupo(1, 'Familia Rojas', 'COORDINADOR'), inactivo]);

    const tabla = elemento.querySelector('.mv-grilla table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    const encabezados = Array.from(tabla.querySelectorAll('th[role="columnheader"]')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados).toEqual(['Grupo', 'Mi rol', 'Estado', 'Acciones']);

    const filas = Array.from(tabla.querySelectorAll<HTMLElement>('tbody tr[role="row"]'));
    const celdas = Array.from(filas[0].querySelectorAll<HTMLElement>('td[role="cell"]'));
    expect(celdas).toHaveLength(4);
    expect(celdas[0].textContent).toContain('Familia Rojas');
    expect(celdas[0].textContent).toContain('Creado el 1 ene 2026');
    expect(celdas[1].getAttribute('data-etiqueta')).toBe('Mi rol');
    expect(celdas[2].getAttribute('data-etiqueta')).toBe('Estado');
    expect(celdas[2].querySelector('.mv-chip--exito')?.textContent?.trim()).toBe('Activo');
    expect(filas[1].querySelector('.estado .mv-chip')?.textContent?.trim()).toBe('Inactivo');
    expect(filas[1].querySelector('.estado .mv-chip--exito')).toBeFalsy();
    expect(celdas[3].classList).toContain('mv-grilla__celda--acciones');
    expect(celdas[3].textContent).toContain('Grupo activo');
    expect(celdas[3].querySelector('a')?.getAttribute('href')).toBe('/grupos/1');
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('muestraCargandoMientrasLlegaLaLista', async () => {
    let terminar!: () => void;
    const pendiente = new Promise<void>((resolver) => (terminar = resolver));
    const { fixture, elemento } = await configurar([], false, { cargar: () => pendiente });

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cargando grupos');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();

    terminar();
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    expect(elemento.textContent).not.toContain('Cargando grupos');
  });

  it('sinGruposMuestraEstadoVacio', async () => {
    const { elemento } = await configurar([]);

    const vacio = elemento.querySelector('.mv-vacio');
    expect(vacio?.textContent).toContain('Todavía no perteneces a ningún grupo.');
  });

  it('errorAlCargarPermiteReintentar', async () => {
    const { fixture, elemento, grupoActivo } = await configurar([], false, {
      error: 'No pudimos cargar tus grupos.',
    });

    const aviso = elemento.querySelector('.mv-aviso--error')!;
    expect(aviso.textContent).toContain('No pudimos cargar tus grupos.');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();
    Array.from(aviso.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    await fixture.whenStable();
    expect(grupoActivo.cargar).toHaveBeenCalledTimes(2);
  });
});
