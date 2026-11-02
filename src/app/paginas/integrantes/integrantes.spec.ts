import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
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
  integrantes?: () => Observable<RespuestaIntegrante[]>;
}) {
  const servicioGrupos = {
    obtener: vi.fn(() => of(grupo(opciones.miRol, opciones.notificaCoordinador ?? true))),
    roles: vi.fn(() => of(ROLES)),
    integrantes: vi.fn(opciones.integrantes ?? (() => of(opciones.integrantesIniciales ?? []))),
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
  // La sección de sucesión carga su propio estado: sin propuesta activa ni historial.
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

async function abrirAgregar(fixture: ComponentFixture<Integrantes>): Promise<void> {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>('#integrantes-abrir-agregar')!
    .click();
  await fixture.whenStable();
}

/** Pulsa "Editar" (la acción principal del botón combinado) de la fila. */
async function editarRol(fixture: ComponentFixture<Integrantes>, fila: HTMLElement): Promise<HTMLSelectElement> {
  fila.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal')!.click();
  await fixture.whenStable();
  return fila.querySelector<HTMLSelectElement>('.rol select')!;
}

function enviarAgregar(elemento: HTMLElement): void {
  elemento.querySelector<HTMLFormElement>('#integrantes-agregar form')!.dispatchEvent(new Event('submit'));
}

describe('Integrantes', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('coordinadorVeFormularioYAcciones', async () => {
    const { fixture, elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana', 1, 'COORDINADOR'),
        integrante(2, 'Beto', 2, 'COLABORADOR'),
      ],
    });

    expect(elemento.textContent).toContain('Agregar integrante');
    await abrirAgregar(fixture);
    expect(elemento.querySelector('#integrante-email')).toBeTruthy();

    const filas = Array.from(elemento.querySelectorAll('.integrante'));
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector('app-boton-dividido')).toBeTruthy();
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
    expect(elemento.querySelector('#integrantes-abrir-agregar')).toBeFalsy();
    const fila = elemento.querySelector('.integrante') as HTMLElement;
    expect(fila.querySelector('select')).toBeFalsy();
    expect(fila.querySelector('app-boton-dividido')).toBeFalsy();
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

    await abrirAgregar(fixture);
    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = 'nadie@correo.cl';
    campo.dispatchEvent(new Event('input'));
    enviarAgregar(elemento);
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No existe una cuenta con ese correo',
    );
  });

  it('correoConEspaciosAlInicioYFinSeEnviaRecortado', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });
    servicioGrupos.incorporar.mockReturnValue(of(integrante(3, 'Carla', 1, 'COORDINADOR')));

    await abrirAgregar(fixture);
    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = '  carla@correo.cl  ';
    campo.dispatchEvent(new Event('input'));
    enviarAgregar(elemento);
    await fixture.whenStable();

    expect(servicioGrupos.incorporar).toHaveBeenCalledWith(5, { email: 'carla@correo.cl', idRol: 1 });
    expect(elemento.querySelector('#integrante-email-error')).toBeFalsy();
  });

  it('correoInvalidoMuestraMensajeAlEnviar', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({ miRol: 'COORDINADOR' });

    await abrirAgregar(fixture);
    const campo = elemento.querySelector<HTMLInputElement>('#integrante-email')!;
    campo.value = 'no-es-un-correo';
    campo.dispatchEvent(new Event('input'));
    enviarAgregar(elemento);
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
    const { fixture, elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });

    const select = await editarRol(fixture, elemento.querySelector<HTMLElement>('.integrante')!);
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Colaborador/a');
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

    const select = await editarRol(fixture, elemento.querySelector<HTMLElement>('.integrante')!);
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Colaborador/a')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(select.isConnected).toBe(true);
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Coordinador/a');
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
    expect(elemento.querySelector('#integrantes-abrir-agregar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Crear integrante nuevo')).toBeFalsy();
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
    expect(elemento.querySelector('#integrantes-abrir-agregar')?.getAttribute('aria-expanded')).toBe(
      'true',
    );
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
    expect(elemento.querySelector('#integrantes-crear-error')).toBeFalsy();
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
  it('agregarIntegranteQuedaPlegadoTrasSuAccion', async () => {
    const { fixture, elemento } = await configurar({ miRol: 'COORDINADOR' });

    const abrir = elemento.querySelector<HTMLButtonElement>('#integrantes-abrir-agregar')!;
    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector('#integrante-email')).toBeFalsy();

    await abrirAgregar(fixture);
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('integrante-email');

    botonConTexto(elemento.querySelector('#integrantes-agregar')!, 'Cancelar')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector('#integrante-email')).toBeFalsy();
    expect(document.activeElement).toBe(abrir);
  });

  it('filaMuestraAvatarRolEstadoYMasAcciones', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana Rojas', 1, 'COORDINADOR'),
        integrante(2, 'Beto', 2, 'COLABORADOR', '2026-02-01T00:00:00-03:00'),
      ],
    });

    const [ana, beto] = Array.from(elemento.querySelectorAll<HTMLElement>('.integrante'));
    expect(ana.querySelector('.mv-avatar')?.textContent?.trim()).toBe('AR');
    expect(ana.querySelector('.mv-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(ana.textContent).toContain('ana rojas@correo.cl');
    expect(ana.textContent).toContain('Tú');
    expect(ana.querySelector('.rol .mv-chip')?.textContent?.trim()).toBe('Coordinador/a');
    expect(ana.querySelector('.estado .mv-chip--exito')?.textContent).toContain('Activo');
    expect(beto.textContent).not.toContain('Tú');
    expect(beto.querySelector('.estado .mv-chip')?.textContent).toContain('Inactivo');

    const combinado = beto.querySelector<HTMLElement>('app-boton-dividido')!;
    expect(combinado.querySelector('.mv-boton-dividido__principal')?.textContent?.trim()).toBe('Editar');
    expect(combinado.querySelector('[aria-haspopup="menu"]')?.getAttribute('aria-label')).toBe(
      'Más acciones para Beto',
    );
    expect(combinado.querySelector('.mv-boton-dividido__principal')?.getAttribute('aria-label')).toBe(
      'Editar a Beto',
    );
    const items = Array.from(combinado.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Reactivar', 'Eliminar']);
    expect(items[1].classList).toContain('mv-menu__item--peligro');
    expect(beto.querySelector('select')).toBeFalsy();
  });

  it('conNombresRepetidosLosBotonesDeLaFilaSumanElCorreo', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana Rojas', 1, 'COORDINADOR'),
        { ...integrante(2, 'Beto', 2, 'COLABORADOR'), email: 'beto.uno@correo.cl' },
        { ...integrante(3, 'Beto', 2, 'COLABORADOR'), email: 'beto.dos@correo.cl' },
      ],
    });

    const nombres = (selector: string) =>
      Array.from(elemento.querySelectorAll(`.integrante ${selector}`)).map((b) => b.getAttribute('aria-label'));
    expect(nombres('.mv-boton-dividido__principal')).toEqual([
      'Editar a Ana Rojas',
      'Editar a Beto, beto.uno@correo.cl',
      'Editar a Beto, beto.dos@correo.cl',
    ]);
    expect(nombres('.mv-boton-dividido__segmento')).toEqual([
      'Más acciones para Ana Rojas',
      'Más acciones para Beto, beto.uno@correo.cl',
      'Más acciones para Beto, beto.dos@correo.cl',
    ]);
  });

  it('grillaConColumnasIntegranteRolEstadoYAcciones', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(1, 'Ana Rojas', 1, 'COORDINADOR')],
    });

    const tabla = elemento.querySelector('.mv-grilla table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    expect(
      Array.from(tabla.querySelectorAll('th[role="columnheader"]')).map((th) => th.textContent?.trim()),
    ).toEqual(['Integrante', 'Rol', 'Estado', 'Acciones']);
    const celdas = Array.from(tabla.querySelectorAll<HTMLElement>('tbody tr[role="row"] td[role="cell"]'));
    expect(celdas).toHaveLength(4);
    expect(celdas[1].getAttribute('data-etiqueta')).toBe('Rol');
    expect(celdas[2].getAttribute('data-etiqueta')).toBe('Estado');
    expect(celdas[3].classList).toContain('mv-grilla__celda--acciones');
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('editarMuestraElSelectorDeRolYAlCambiarDevuelveElFoco', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });
    servicioGrupos.cambiarRol.mockReturnValue(of(undefined));
    const fila = elemento.querySelector<HTMLElement>('.integrante')!;
    const editar = fila.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal')!;

    const select = await editarRol(fixture, fila);
    expect(document.activeElement).toBe(select);
    expect(select.getAttribute('aria-label')).toBe('Rol de Beto');
    expect(editar.textContent?.trim()).toBe('Listo');
    expect(editar.getAttribute('aria-label')).toBe('Listo, rol de Beto');

    select.value = Array.from(select.options).find((o) => o.textContent?.trim() === 'Coordinador/a')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioGrupos.cambiarRol).toHaveBeenCalledWith(5, 2, 1);
    expect(fila.querySelector('select')).toBeFalsy();
    expect(document.activeElement).toBe(editar);
    expect(editar.textContent?.trim()).toBe('Editar');
  });

  it('escapeEnElSelectorDeRolLoCierraSinCambiarYDevuelveElFoco', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });
    const fila = elemento.querySelector<HTMLElement>('.integrante')!;

    const select = await editarRol(fixture, fila);
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fila.querySelector('select')).toBeFalsy();
    expect(fila.querySelector('.rol .mv-chip')?.textContent?.trim()).toBe('Colaborador/a');
    expect(document.activeElement).toBe(fila.querySelector('.mv-boton-dividido__principal'));
    expect(servicioGrupos.cambiarRol).not.toHaveBeenCalled();
  });

  it('menuDesactivaYEliminaConConfirmacion', async () => {
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });
    servicioGrupos.desactivar.mockReturnValue(of(undefined));
    servicioGrupos.eliminar.mockReturnValue(of(undefined));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fila = elemento.querySelector<HTMLElement>('.integrante')!;

    botonConTexto(fila, 'Desactivar')!.click();
    await fixture.whenStable();
    expect(servicioGrupos.desactivar).toHaveBeenCalledWith(5, 2);

    botonConTexto(fila, 'Eliminar')!.click();
    expect(confirmar).toHaveBeenCalled();
    expect(servicioGrupos.eliminar).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    botonConTexto(fila, 'Eliminar')!.click();
    expect(servicioGrupos.eliminar).toHaveBeenCalledWith(5, 2);
  });

  it('colaboradorVeElRolComoChipSinMasAcciones', async () => {
    const { elemento } = await configurar({
      miRol: 'COLABORADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });

    const fila = elemento.querySelector<HTMLElement>('.integrante')!;
    expect(fila.querySelector('.rol .mv-chip')?.textContent?.trim()).toBe('Colaborador/a');
    expect(fila.querySelector('app-boton-dividido')).toBeFalsy();
    expect(fila.querySelector('.mv-grilla__celda--acciones')?.children).toHaveLength(0);
  });

  it('encabezadoCuentaLosIntegrantesActivos', async () => {
    const { elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [
        integrante(1, 'Ana', 1, 'COORDINADOR'),
        integrante(2, 'Beto', 2, 'COLABORADOR'),
        integrante(3, 'Carla', 2, 'COLABORADOR', '2026-02-01T00:00:00-03:00'),
      ],
    });

    expect(elemento.querySelector('h1')?.textContent).toContain('Familia Rojas');
    expect(elemento.querySelector('.mv-encabezado__bajada')?.textContent).toContain(
      '2 integrantes activos',
    );
    expect(elemento.querySelector('.mv-encabezado__bajada')?.textContent).toContain(
      'Tu rol: Coordinador/a',
    );
  });

  it('muestraCargandoMientrasLleganLosIntegrantes', async () => {
    const { elemento } = await configurar({ miRol: 'COORDINADOR', integrantes: () => NEVER });

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cargando integrantes');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();
  });

  it('sinIntegrantesMuestraEstadoVacio', async () => {
    const { elemento } = await configurar({ miRol: 'COORDINADOR' });

    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain(
      'Este grupo todavía no tiene integrantes.',
    );
  });

  it('errorAlCargarIntegrantesPermiteReintentar', async () => {
    let fallar = true;
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantes: () =>
        fallar
          ? throwError(
              () =>
                new HttpErrorResponse({
                  status: 500,
                  error: { detail: 'No pudimos cargar los integrantes.' },
                }),
            )
          : of([integrante(2, 'Beto', 2, 'COLABORADOR')]),
    });

    const aviso = elemento.querySelector('.mv-aviso--error')!;
    expect(aviso.textContent).toContain('No pudimos cargar los integrantes.');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();

    fallar = false;
    botonConTexto(aviso as HTMLElement, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioGrupos.integrantes).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.querySelectorAll('.integrante')).toHaveLength(1);
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('Integrantes: desplazamiento y foco', () => {
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

  /** Abre el menú del botón dividido con ese nombre accesible y elige el ítem con ese texto. */
  async function elegirEnMenu(
    fixture: { whenStable(): Promise<unknown> },
    elemento: HTMLElement,
    etiquetaMenu: string,
    item: string,
  ): Promise<void> {
    const segmento = elemento.querySelector<HTMLButtonElement>(`[aria-label="${etiquetaMenu}"]`)!;
    segmento.click();
    await fixture.whenStable();
    const menu = document.getElementById(segmento.getAttribute('aria-controls')!)!;
    Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((b) => b.textContent?.trim() === item)!
      .click();
    await fixture.whenStable();
  }

  it('agregarIntegranteTraeElFormularioALaVistaYAlCancelarVuelveAlBoton', async () => {
    const { fixture, elemento } = await configurar({ miRol: 'COORDINADOR' });

    await abrirAgregar(fixture);
    expect(bloqueDe(elemento.querySelector('#integrantes-agregar'))).toBe('start');
    expect(document.activeElement?.id).toBe('integrante-email');

    botonConTexto(elemento.querySelector('#integrantes-agregar')!, 'Cancelar')!.click();
    await fixture.whenStable();
    const abrir = elemento.querySelector('#integrantes-abrir-agregar');
    expect(document.activeElement).toBe(abrir);
    expect(bloqueDe(abrir)).toBe('nearest');
  });

  it('crearIntegranteNuevoTraeElFormularioALaVista', async () => {
    const { fixture, elemento } = await configurar({ miRol: 'COORDINADOR' });

    botonConTexto(elemento, 'Crear integrante nuevo')!.click();
    await fixture.whenStable();

    expect(bloqueDe(elemento.querySelector('#integrantes-crear'))).toBe('start');
    expect(document.activeElement?.id).toBe('integrante-crear-nombre');
  });

  it('editarRolTraeLaFilaALaVista', async () => {
    const { fixture, elemento } = await configurar({
      miRol: 'COORDINADOR',
      integrantesIniciales: [integrante(2, 'Beto', 2, 'COLABORADOR')],
    });
    const fila = elemento.querySelector<HTMLElement>('.integrante')!;

    const select = await editarRol(fixture, fila);

    expect(bloqueDe(fila)).toBe('start');
    expect(document.activeElement).toBe(select);
  });

  it('eliminarLlevaElFocoALaFilaSiguienteYSinFilasAlTitulo', async () => {
    let integrantes = [integrante(2, 'Beto', 2, 'COLABORADOR'), integrante(3, 'Carla', 2, 'COLABORADOR')];
    const { fixture, elemento, servicioGrupos } = await configurar({
      miRol: 'COORDINADOR',
      integrantes: () => of(integrantes),
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    servicioGrupos.eliminar.mockImplementation(() => {
      integrantes = [integrantes[1]];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, 'Más acciones para Beto', 'Eliminar');
    expect(document.activeElement).toBe(
      elemento.querySelector('#integrante-acciones-3 .mv-boton-dividido__principal'),
    );

    servicioGrupos.eliminar.mockImplementation(() => {
      integrantes = [];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, 'Más acciones para Carla', 'Eliminar');
    expect(document.activeElement?.id).toBe('integrantes-lista-titulo');
    confirmar.mockRestore();
  });
});
