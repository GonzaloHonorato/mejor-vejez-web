import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Grupos } from './grupos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

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

async function configurar(gruposIniciales: RespuestaGrupo[], esAdministrador = false) {
  const grupos = signal(gruposIniciales);
  const activo = signal<RespuestaGrupo | null>(gruposIniciales[0] ?? null);
  /** Lo que devolverá la próxima llamada a `cargar()` (simula la recarga desde la API). */
  let siguienteCarga = gruposIniciales;
  const grupoActivo = {
    grupos,
    activo,
    error: signal<string | null>(null),
    cargar: vi.fn(async () => {
      grupos.set(siguienteCarga);
    }),
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

function crearGrupo(elemento: HTMLElement, nombre: string): void {
  const campo = elemento.querySelector<HTMLInputElement>('#grupo-nombre')!;
  campo.value = nombre;
  campo.dispatchEvent(new Event('input'));
  elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
}

describe('Grupos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('listaMisGruposConRol', async () => {
    const { elemento, grupoActivo } = await configurar([
      grupo(1, 'Familia Rojas', 'COORDINADOR'),
      grupo(2, 'Familia Soto', 'COLABORADOR'),
    ]);

    expect(grupoActivo.cargar).toHaveBeenCalled();
    const filas = Array.from(elemento.querySelectorAll('.grupo'));
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Familia Rojas');
    expect(filas[0].textContent).toContain('Coordinador');
    expect(filas[0].textContent).toContain('Grupo activo');
    expect(filas[1].textContent).toContain('Familia Soto');
    expect(filas[1].textContent).toContain('Colaborador');
    expect(filas[1].textContent).not.toContain('Grupo activo');
    expect(filas[1].querySelector('a')?.getAttribute('href')).toBe('/grupos/2');
    expect(elemento.textContent).not.toContain('Ver todos los grupos');

    const usar = Array.from(filas[1].querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Usar este grupo'),
    )!;
    usar.click();
    expect(grupoActivo.seleccionar).toHaveBeenCalledWith(2);
  });

  it('crearGrupoLoDejaActivo', async () => {
    const existente = grupo(1, 'Familia Rojas', 'COORDINADOR');
    const { fixture, elemento, http, grupoActivo, alRecargar } = await configurar([existente]);
    const nuevo = grupo(7, 'Familia Pérez', 'COORDINADOR');
    alRecargar([existente, nuevo]);

    crearGrupo(elemento, 'Familia Pérez');
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

    crearGrupo(elemento, 'Familia Rojas');
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

    crearGrupo(elemento, 'Familia Rojas');
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
    expect(filas[1].textContent).not.toContain('Usar este grupo');
  });
});
