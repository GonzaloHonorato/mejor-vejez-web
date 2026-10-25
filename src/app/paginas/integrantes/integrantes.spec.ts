import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { Integrantes } from './integrantes';
import { RespuestaGrupo, RespuestaIntegrante, RespuestaRol } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ROLES: RespuestaRol[] = [
  { idRol: 1, nombreRol: 'COORDINADOR', descripcion: 'Coordina el grupo' },
  { idRol: 2, nombreRol: 'COLABORADOR', descripcion: 'Colabora con el grupo' },
];

function grupo(miRol: string | null): RespuestaGrupo {
  return {
    idGrupo: 5,
    nombreGrupo: 'Familia Rojas',
    notificaCoordinador: true,
    idEstado: 1,
    miRol,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function integrante(
  idIntegrante: number,
  nombre: string,
  idRol: number,
  nombreRol: string,
  fechaDesactivacion: string | null = null,
): RespuestaIntegrante {
  return {
    idIntegrante,
    idUsuario: idIntegrante,
    nombre,
    email: `${nombre.toLowerCase()}@correo.cl`,
    idRol,
    nombreRol,
    idEstado: fechaDesactivacion === null ? 1 : 2,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion,
  };
}

async function configurar(opciones: {
  miRol: string | null;
  esAdministrador?: boolean;
  integrantesIniciales?: RespuestaIntegrante[];
}) {
  const servicioGrupos = {
    obtener: vi.fn(() => of(grupo(opciones.miRol))),
    roles: vi.fn(() => of(ROLES)),
    integrantes: vi.fn(() => of(opciones.integrantesIniciales ?? [])),
    incorporar: vi.fn(),
    cambiarRol: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
    salir: vi.fn(),
    eliminar: vi.fn(),
  };
  const grupoActivo = { cargar: vi.fn(async () => {}) };
  TestBed.configureTestingModule({
    imports: [Integrantes],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ idGrupo: '5' }) } },
      },
      { provide: ServicioGrupos, useValue: servicioGrupos },
      { provide: ServicioGrupoActivo, useValue: grupoActivo },
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
  const fixture = TestBed.createComponent(Integrantes);
  await fixture.whenStable();
  return {
    fixture,
    servicioGrupos,
    grupoActivo,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('Integrantes', () => {
  it('coordinadorVeFormularioYAcciones', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana', 1, 'COORDINADOR'),
        integrante(2, 'Beto', 2, 'COLABORADOR'),
      ],
    });

    expect(elemento.querySelector('#integrante-email')).toBeTruthy();
    expect(elemento.textContent).toContain('Agregar integrante');

    const filas = Array.from(elemento.querySelectorAll('.integrante'));
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector('select')).toBeTruthy();
    expect(botonConTexto(filas[0] as HTMLElement, 'Desactivar')).toBeTruthy();
    expect(botonConTexto(filas[0] as HTMLElement, 'Eliminar')).toBeTruthy();
    expect(botonConTexto(elemento, 'Salir del grupo')).toBeTruthy();
  });

  it('colaboradorSoloVeLaLista', async () => {
    const { elemento } = await configurar({
      miRol: 'COLABORADOR',
      integrantesIniciales: [integrante(1, 'Ana', 1, 'COORDINADOR')],
    });

    expect(elemento.querySelector('#integrante-email')).toBeFalsy();
    const fila = elemento.querySelector('.integrante') as HTMLElement;
    expect(fila.querySelector('select')).toBeFalsy();
    expect(botonConTexto(fila, 'Desactivar')).toBeFalsy();
    expect(botonConTexto(fila, 'Eliminar')).toBeFalsy();
    // Puede dejar el grupo aunque no administre: no es una acción de administración.
    expect(botonConTexto(elemento, 'Salir del grupo')).toBeTruthy();
  });

  it('agregarMuestraErrorDeLaApi', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.incorporar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'No existe una cuenta con ese correo' },
          }),
      ),
    );

    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = 'nadie@correo.cl';
    campo.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No existe una cuenta con ese correo',
    );
  });

  it('correoConEspaciosAlInicioYFinSeEnviaRecortado', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.incorporar.mockReturnValue(of(integrante(3, 'Carla', 1, 'COORDINADOR')));

    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = '  carla@correo.cl  ';
    campo.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioGrupos.incorporar).toHaveBeenCalledWith(5, { email: 'carla@correo.cl', idRol: 1 });
    expect(elemento.querySelector('#integrante-email-error')).toBeFalsy();
  });

  it('correoInvalidoMuestraMensajeAlEnviar', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });

    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = 'no-es-un-correo';
    campo.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#integrante-email-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(servicioGrupos.incorporar).not.toHaveBeenCalled();
  });

  it('salirRecargaGruposYNavega', async () => {
    const { fixture, elemento, servicioGrupos, grupoActivo, router } = await configurar({
      miRol: 'COLABORADOR',
    });
    servicioGrupos.salir.mockReturnValue(of(undefined));
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    botonConTexto(elemento, 'Salir del grupo')!.click();
    await fixture.whenStable();

    expect(servicioGrupos.salir).toHaveBeenCalledWith(5);
    expect(grupoActivo.cargar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/grupos');
  });

  it('selectDeRolMuestraElRolReal', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });

    const select = elemento.querySelector<HTMLSelectElement>('.integrante select')!;
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Colaborador');
  });

  it('cambiarRolConFallaRevierteElSelectAlValorReal', async () => {
    const integranteOriginal = integrante(2, 'Beto', 1, 'COORDINADOR');
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integranteOriginal],
    });
    servicioGrupos.cambiarRol.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'No se puede cambiar el rol' },
          }),
      ),
    );

    const select = elemento.querySelector<HTMLSelectElement>('.integrante select')!;
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Colaborador')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Coordinador');
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No se puede cambiar el rol',
    );
  });

  it('muestraErrorSiNoPuedeCargarElGrupo', async () => {
    const servicioGrupos = {
      obtener: vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { detail: 'No tienes acceso a este grupo' },
            }),
        ),
      ),
      roles: vi.fn(() => of(ROLES)),
      integrantes: vi.fn(() => of([])),
      incorporar: vi.fn(),
      cambiarRol: vi.fn(),
      desactivar: vi.fn(),
      reactivar: vi.fn(),
      salir: vi.fn(),
      eliminar: vi.fn(),
    };
    const grupoActivo = { cargar: vi.fn(async () => {}) };
    TestBed.configureTestingModule({
      imports: [Integrantes],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ idGrupo: '5' }) } },
        },
        { provide: ServicioGrupos, useValue: servicioGrupos },
        { provide: ServicioGrupoActivo, useValue: grupoActivo },
        {
          provide: ServicioYo,
          // esAdministrador: true a propósito — ni siquiera un admin ve acciones
          // si la carga del grupo falló.
          useValue: {
            obtener: () =>
              of({
                idUsuario: 1,
                nombre: 'Ana',
                email: 'ana@correo.cl',
                telefono: null,
                esAdministrador: true,
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Integrantes);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No tienes acceso a este grupo',
    );
    expect(elemento.querySelector('#integrante-email')).toBeFalsy();
    expect(botonConTexto(elemento, 'Salir del grupo')).toBeFalsy();
  });
});
