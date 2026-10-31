import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { Integrantes } from './integrantes';
import { RespuestaGrupo, RespuestaIntegrante, RespuestaRol } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { ServicioSucesion } from '../../nucleo/sucesion/servicio-sucesion';

const ROLES: RespuestaRol[] = [
  { idRol: 1, nombreRol: 'COORDINADOR', descripcion: 'Coordina el grupo' },
  { idRol: 2, nombreRol: 'COLABORADOR', descripcion: 'Colabora con el grupo' },
];

function grupo(miRol: string | null, notificaCoordinador = true): RespuestaGrupo {
  return {
    idGrupo: 5,
    nombreGrupo: 'Familia Rojas',
    notificaCoordinador,
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
  notificaCoordinador?: boolean;
}) {
  const servicioGrupos = {
    obtener: vi.fn(() => of(grupo(opciones.miRol, opciones.notificaCoordinador ?? true))),
    roles: vi.fn(() => of(ROLES)),
    integrantes: vi.fn(() => of(opciones.integrantesIniciales ?? [])),
    incorporar: vi.fn(),
    crearIntegrante: vi.fn(),
    cambiarRol: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
    salir: vi.fn(),
    eliminar: vi.fn(),
    actualizar: vi.fn(),
  };
  const grupoActivo = { cargar: vi.fn(async () => {}) };
  // La sección de sucesión (Tarea 8) carga su propio estado: sin propuesta activa ni historial.
  const servicioSucesion = {
    activa: vi.fn(() => of(null)),
    historial: vi.fn(() => of([])),
    proponer: vi.fn(),
    aceptar: vi.fn(),
    rechazar: vi.fn(),
    cancelar: vi.fn(),
    completar: vi.fn(),
  };
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
      { provide: ServicioSucesion, useValue: servicioSucesion },
      { provide: ServicioCatalogos, useValue: { estados: vi.fn(() => of([])) } },
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
  // Adjunto al documento: el foco (ej. al volver al flujo de agregar por correo) necesita elementos conectados.
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return {
    fixture,
    servicioGrupos,
    grupoActivo,
    servicioSucesion,
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
  afterEach(() => {
    document.body.innerHTML = '';
  });

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

  it('coordinadorCambiaNotificarCoordinador', async () => {
    const { fixture, elemento, servicioGrupos, grupoActivo } = await configurar({
      miRol: 'COORDINADOR',
      notificaCoordinador: false,
    });
    servicioGrupos.actualizar.mockReturnValue(
      of({ ...grupo('COORDINADOR', true) }),
    );

    const interruptor = elemento.querySelector<HTMLInputElement>('#integrantes-notifica-coordinador')!;
    expect(interruptor.checked).toBe(false);

    interruptor.click();
    await fixture.whenStable();

    expect(servicioGrupos.actualizar).toHaveBeenCalledWith(5, {
      nombreGrupo: 'Familia Rojas',
      notificaCoordinador: true,
    });
    expect(grupoActivo.cargar).toHaveBeenCalled();
  });

  it('cambiarNotificarCoordinadorConFallaRevierteElInterruptor', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      notificaCoordinador: false,
    });
    servicioGrupos.actualizar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { detail: 'No pudimos guardar el cambio.' },
          }),
      ),
    );

    const interruptor = elemento.querySelector<HTMLInputElement>('#integrantes-notifica-coordinador')!;
    expect(interruptor.checked).toBe(false);

    interruptor.click();
    await fixture.whenStable();

    expect(interruptor.checked).toBe(false);
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos guardar el cambio.',
    );
  });

  it('colaboradorVeSoloLectura', async () => {
    const { elemento } = await configurar({ miRol: 'COLABORADOR', notificaCoordinador: true });

    expect(elemento.querySelector('#integrantes-notifica-coordinador')).toBeFalsy();
    const lectura = Array.from(elemento.querySelectorAll('p')).find((parrafo) =>
      parrafo.textContent?.includes('Notificar las alertas al coordinador'),
    );
    expect(lectura?.textContent).toContain('Sí');
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

  it('enlaceSoloParaCoordinadorEnIntegrantes', async () => {
    const { elemento: elementoCoordinador } = await configurar({ miRol: 'COORDINADOR' });
    expect(elementoCoordinador.querySelector('#integrantes-enlace-auditoria')).toBeTruthy();

    TestBed.resetTestingModule();
    const { elemento: elementoAdmin } = await configurar({
      miRol: 'COLABORADOR',
      esAdministrador: true,
    });
    expect(elementoAdmin.querySelector('#integrantes-enlace-auditoria')).toBeTruthy();

    TestBed.resetTestingModule();
    const { elemento: elementoColaborador } = await configurar({ miRol: 'COLABORADOR' });
    expect(elementoColaborador.querySelector('#integrantes-enlace-auditoria')).toBeFalsy();
  });

  it('crearIntegranteSoloVisibleParaCoordinador', async () => {
    const { elemento: elementoCoordinador } = await configurar({ miRol: 'COORDINADOR' });
    expect(botonConTexto(elementoCoordinador, 'Crear integrante nuevo')).toBeTruthy();

    TestBed.resetTestingModule();
    const { elemento: elementoColaborador } = await configurar({ miRol: 'COLABORADOR' });
    expect(botonConTexto(elementoColaborador, 'Crear integrante nuevo')).toBeFalsy();
  });

  it('crearIntegranteMuestraClaveUnaVez', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.crearIntegrante.mockReturnValue(
      of({
        integrante: integrante(3, 'Carla', 1, 'COORDINADOR'),
        claveTemporal: 'Ab3xZ9qLm2Pq',
        correoEnviado: true,
      }),
    );

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();

    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'Carla';
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioGrupos.crearIntegrante).toHaveBeenCalledWith(5, {
      nombre: 'Carla',
      email: 'carla@correo.cl',
      idRol: 1,
    });
    const dialogo = elemento.querySelector('[role="dialog"]');
    expect(dialogo?.textContent).toContain('Ab3xZ9qLm2Pq');
  });

  it('errorYaExisteAlCrearIntegranteSugiereAgregarPorCorreo', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.crearIntegrante.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'Ya existe una cuenta con ese correo' },
          }),
      ),
    );

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();

    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'Carla';
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('.crear-integrante [role="alert"]')?.textContent).toContain(
      'Ya existe una cuenta con ese correo',
    );
    const sugerencia = botonConTexto(elemento, 'Si la persona ya tiene cuenta, agrégala por correo');
    expect(sugerencia).toBeTruthy();

    sugerencia!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('.crear-integrante')).toBeFalsy();
    expect(document.activeElement?.id).toBe('integrante-email');
  });

  it('demasiadosIntentosAlCrearIntegranteMuestraElDetalle', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.crearIntegrante.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            error: { detail: 'Demasiados intentos. Prueba más tarde.' },
          }),
      ),
    );

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();

    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'Carla';
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('.crear-integrante [role="alert"]')?.textContent).toContain(
      'Demasiados intentos. Prueba más tarde.',
    );
  });

  it('alCerrarDialogoDevuelveElFocoAlBotonCrearIntegranteNuevo', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.crearIntegrante.mockReturnValue(
      of({
        integrante: integrante(3, 'Carla', 1, 'COORDINADOR'),
        claveTemporal: 'Ab3xZ9qLm2Pq',
        correoEnviado: true,
      }),
    );

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();
    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'Carla';
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    botonConTexto(elemento.querySelector('[role="dialog"]')!, 'Cerrar')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(botonConTexto(elemento, 'Crear integrante nuevo'));
  });

  it('nombreDemasiadoLargoMuestraMensajeAlCrearIntegrante', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();
    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'A'.repeat(161);
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#integrante-crear-nombre-error')?.textContent).toContain(
      'no puede superar los 160 caracteres',
    );
    expect(servicioGrupos.crearIntegrante).not.toHaveBeenCalled();
  });

  it('erroresDeCamposAlCrearIntegranteSeMuestranPorCampo', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.crearIntegrante.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errores: [{ campo: 'nombre', mensaje: 'El nombre es obligatorio.' }] },
          }),
      ),
    );

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();
    const campoNombre = elemento.querySelector<HTMLInputElement>('#integrante-crear-nombre')!;
    campoNombre.value = 'Carla';
    campoNombre.dispatchEvent(new Event('input'));
    const campoEmail = elemento.querySelector<HTMLInputElement>('#integrante-crear-email')!;
    campoEmail.value = 'carla@correo.cl';
    campoEmail.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('.crear-integrante form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#integrante-crear-nombre-error')?.textContent).toContain(
      'El nombre es obligatorio.',
    );
    // El mensaje genérico no se muestra: hay un error de campo específico.
    expect(elemento.querySelector('.crear-integrante > p.error')).toBeFalsy();
  });

  it('seccionSucesionRecibeElContextoYSuCambioRecargaGrupoEIntegrantes', async () => {
    const { fixture, elemento, servicioGrupos, servicioSucesion, grupoActivo } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana', 1, 'COORDINADOR'),
        integrante(2, 'Beto', 2, 'COLABORADOR'),
      ],
    });

    expect(servicioSucesion.activa).toHaveBeenCalledWith(5);
    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-candidato')!;
    expect(Array.from(selector.options).map((opcion) => opcion.textContent?.trim())).toEqual([
      'Selecciona…',
      'Beto',
    ]);

    servicioSucesion.proponer.mockReturnValue(of({}));
    selector.value = selector.options[1].value;
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    botonConTexto(elemento, 'Proponer sucesor')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.proponer).toHaveBeenCalledWith(5, 2);
    expect(servicioGrupos.obtener).toHaveBeenCalledTimes(2);
    expect(servicioGrupos.integrantes).toHaveBeenCalledTimes(2);
    expect(grupoActivo.cargar).toHaveBeenCalled();
  });

  it('colaboradorVeLaSeccionSinSelectorDeCandidato', async () => {
    const { elemento } = await configurar({ miRol: 'COLABORADOR' });

    expect(elemento.textContent).toContain('Sucesión de la coordinación');
    expect(elemento.querySelector('#sucesion-candidato')).toBeFalsy();
  });
});
