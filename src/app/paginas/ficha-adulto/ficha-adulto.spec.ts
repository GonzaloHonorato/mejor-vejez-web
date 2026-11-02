import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { FichaAdulto } from './ficha-adulto';
import { RespuestaAdultoMayor, RespuestaContacto } from '../../nucleo/adultos/modelos-adultos';
import {
  ServicioAdultos,
  SolicitudGuardarAdultoMayor,
} from '../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { ContactosAdulto } from './contactos-adulto/contactos-adulto';

const ESTADOS_ADULTO: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

/** Reemplaza al `ContactosAdulto` real: esta ficha no prueba sus contactos. */
@Component({ selector: 'app-contactos-adulto', template: '' })
class ContactosAdultoFalso {
  @Input() idGrupo?: number;
  @Input() idAdulto?: number;
  @Input() puedeAdministrar?: boolean;
  @Input() adultoActivo?: boolean;
  readonly cambio = output<void>();
}

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

function contacto(datos: Partial<RespuestaContacto> = {}): RespuestaContacto {
  return {
    idContacto: 1,
    idAdultoMayor: 1,
    nombreContacto: 'Juana Pérez',
    idParentesco: null,
    parentesco: 'Hija',
    telefono: '+56911111111',
    esPrincipal: true,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: '2026-01-01T00:00:00-03:00',
    ...datos,
  };
}

function adulto(datos: Partial<RespuestaAdultoMayor> = {}): RespuestaAdultoMayor {
  return {
    idAdultoMayor: 1,
    idGrupo: 1,
    codigoInterno: 'AM-001',
    nombreCompleto: 'Rosa González',
    fechaNacimiento: '1950-05-10',
    notasEmergencia: 'Alergia a la penicilina.',
    observacionesGenerales: 'Vive sola.',
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: '2026-01-01T00:00:00-03:00',
    contactoPrincipal: contacto(),
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  obtenerImpl?: (idGrupo: number, idAdulto: number) => Observable<RespuestaAdultoMayor>;
  esAdministrador?: boolean;
  estados?: RespuestaEstadoCatalogo[];
  estadosImpl?: () => Observable<RespuestaEstadoCatalogo[]>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioAdultos = {
    obtener: vi.fn(opciones.obtenerImpl ?? (() => of(adulto()))),
    actualizar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
    eliminar: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [FichaAdulto],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ idAdulto: '1' }) } },
      },
      { provide: ServicioAdultos, useValue: servicioAdultos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
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
      {
        provide: ServicioCatalogos,
        useValue: {
          estados: opciones.estadosImpl ?? (() => of(opciones.estados ?? ESTADOS_ADULTO)),
        },
      },
    ],
  })
    .overrideComponent(FichaAdulto, {
      remove: { imports: [ContactosAdulto] },
      add: { imports: [ContactosAdultoFalso] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(FichaAdulto);
  await fixture.whenStable();
  return {
    fixture,
    activo,
    servicioAdultos,
    router: TestBed.inject(Router),
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

describe('FichaAdulto', () => {
  it('encabezadoMuestraInicialesDetalleYEstado', async () => {
    const { elemento } = await configurar({});

    const encabezado = elemento.querySelector('.mv-encabezado')!;
    expect(encabezado.querySelector('h1')?.textContent).toContain('Rosa González');
    expect(encabezado.querySelector('.mv-avatar')?.textContent?.trim()).toBe('RG');
    expect(encabezado.querySelector('.mv-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(encabezado.querySelector('.mv-encabezado__bajada')?.textContent).toMatch(
      /\d+ años · Código AM-001/,
    );
    const chip = encabezado.querySelector('.mv-chip');
    expect(chip?.textContent?.trim()).toBe('Activo');
    expect(chip?.classList).toContain('mv-chip--exito');
  });

  it('seccionesEnTarjetas', async () => {
    const { elemento } = await configurar({});

    const titulos = Array.from(elemento.querySelectorAll('.mv-tarjeta .mv-tarjeta__titulo')).map(
      (titulo) => titulo.textContent?.trim(),
    );
    expect(titulos).toEqual(['Datos', 'Notas de emergencia', 'Observaciones generales']);
  });

  it('administradorTieneEditarPerfilYElRestoEnElBotonCombinado', async () => {
    const { elemento } = await configurar({});

    const combinado = elemento.querySelector('.mv-encabezado app-boton-dividido')!;
    expect(combinado.id).toBe('ficha-editar');
    expect(botonConTexto(elemento, 'Editar perfil')?.classList).toContain('mv-boton--primario');
    const segmento = combinado.querySelector('[aria-haspopup="menu"]')!;
    expect(segmento.getAttribute('aria-label')).toBe('Más acciones para Rosa González');
    expect(botonConTexto(elemento, 'Editar perfil')?.getAttribute('aria-label')).toBe(
      'Editar perfil de Rosa González',
    );
    const items = Array.from(combinado.querySelectorAll('[role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Desactivar perfil',
      'Eliminar',
    ]);
    expect(items[1].classList).toContain('mv-menu__item--peligro');
    expect(elemento.querySelector('details.mv-mas')).toBeNull();
  });

  it('perfilInactivoOfreceReactivarComoAccionPrincipal', async () => {
    const { elemento } = await configurar({ obtenerImpl: () => of(adulto({ idEstado: 2 })) });

    expect(botonConTexto(elemento, 'Reactivar perfil')?.classList).toContain('mv-boton--primario');
    expect(botonConTexto(elemento, 'Editar perfil')).toBeFalsy();
    expect(botonConTexto(elemento, 'Reactivar perfil')?.getAttribute('aria-label')).toBe(
      'Reactivar perfil de Rosa González',
    );
    const items = Array.from(elemento.querySelectorAll('.mv-encabezado [role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Eliminar']);
    expect(elemento.querySelector('.mv-encabezado .mv-chip')?.textContent?.trim()).toBe('Inactivo');
  });

  it('reactivarPerfilEsLaAccionPrincipalDelInactivo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      obtenerImpl: () => of(adulto({ idEstado: 2 })),
    });
    servicioAdultos.reactivar.mockReturnValue(of(adulto()));

    botonConTexto(elemento, 'Reactivar perfil')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.reactivar).toHaveBeenCalledWith(1, 1);
    expect(botonConTexto(elemento, 'Editar perfil')).toBeTruthy();
    expect(elemento.textContent).toContain('Perfil reactivado.');
  });

  it('mientrasCargaMuestraElEsqueleto', async () => {
    const pendiente = new Subject<RespuestaAdultoMayor>();
    const { fixture, elemento } = await configurar({ obtenerImpl: () => pendiente.asObservable() });

    const estado = Array.from(elemento.querySelectorAll('[role="status"]')).find((nodo) =>
      nodo.textContent?.includes('Cargando la ficha'),
    );
    expect(estado).toBeTruthy();
    expect(elemento.querySelector('.mv-esqueleto')).toBeTruthy();

    pendiente.next(adulto());
    await fixture.whenStable();
    expect(elemento.querySelector('.mv-esqueleto')).toBeFalsy();
  });

  it('errorAlCargarPermiteReintentar', async () => {
    let intentos = 0;
    const { fixture, elemento, servicioAdultos } = await configurar({
      obtenerImpl: () =>
        ++intentos === 1
          ? throwError(
              () => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la carga.' } }),
            )
          : of(adulto()),
    });

    const aviso = elemento.querySelector('.mv-aviso--error');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.textContent).toContain('Falló la carga.');

    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.obtener).toHaveBeenCalledTimes(2);
    expect(servicioAdultos.obtener).toHaveBeenLastCalledWith(1, 1);
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.textContent).toContain('Alergia a la penicilina.');
  });

  it('muestraLosDatosDelPerfil', async () => {
    const { elemento, servicioAdultos } = await configurar({});

    expect(servicioAdultos.obtener).toHaveBeenCalledWith(1, 1);
    expect(elemento.textContent).toContain('Rosa González');
    expect(elemento.textContent).toContain('AM-001');
    expect(elemento.textContent).toContain('10 may 1950');
    expect(elemento.textContent).toContain('años');
    expect(elemento.textContent).toContain('Activo');
    expect(elemento.textContent).toContain('Alergia a la penicilina.');
    expect(elemento.textContent).toContain('Vive sola.');
  });

  it('enlazaALosPlanesDeMedicamentosDelAdulto', async () => {
    const { elemento } = await configurar({});

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Ver planes de medicamentos'),
    );
    expect(enlace?.getAttribute('href')).toBe('/planes?idAdulto=1');
  });

  it('registrarRelevoSoloApareceSiElAdultoEstaActivo', async () => {
    const { elemento } = await configurar({});

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Registrar relevo'),
    );
    expect(enlace?.getAttribute('href')).toBe('/relevos?idAdulto=1');
  });

  it('registrarRelevoNoApareceSiElAdultoEstaInactivo', async () => {
    const { elemento } = await configurar({ obtenerImpl: () => of(adulto({ idEstado: 2 })) });

    expect(elemento.textContent).toContain('Inactivo');
    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Registrar relevo'),
    );
    expect(enlace).toBeFalsy();
  });

  it('colaboradorNoVeAccionesDeAdministracion', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(botonConTexto(elemento, 'Editar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Desactivar perfil')).toBeFalsy();
    expect(botonConTexto(elemento, 'Eliminar')).toBeFalsy();
  });

  it('editarGuardaYMuestraConfirmacion', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({});
    servicioAdultos.actualizar.mockReturnValue(
      of(adulto({ nombreCompleto: 'Rosa González Pérez' })),
    );

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();

    const campoNombre = elemento.querySelector<HTMLInputElement>('#ficha-nombre')!;
    campoNombre.value = 'Rosa González Pérez';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const solicitud = servicioAdultos.actualizar.mock.calls[0][2] as SolicitudGuardarAdultoMayor;
    expect(servicioAdultos.actualizar.mock.calls[0][0]).toBe(1);
    expect(servicioAdultos.actualizar.mock.calls[0][1]).toBe(1);
    expect(solicitud.nombreCompleto).toBe('Rosa González Pérez');
    const confirmacion = elemento.querySelector('[role="status"]');
    expect(confirmacion?.textContent).toContain('Cambios guardados.');
    expect(elemento.textContent).toContain('Rosa González Pérez');
  });

  it('editarEnfocaElPrimerCampoYCancelarDevuelveElFocoAEditarPerfil', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Editar perfil')!.click();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('ficha-nombre');

    botonConTexto(elemento, 'Cancelar')!.click();
    await fixture.whenStable();
    const editar = botonConTexto(elemento, 'Editar perfil')!;
    expect(editar.closest('#ficha-editar')).toBeTruthy();
    expect(document.activeElement).toBe(editar);
  });

  it('guardarDevuelveElFocoAEditarPerfil', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({});
    servicioAdultos.actualizar.mockReturnValue(of(adulto()));

    botonConTexto(elemento, 'Editar perfil')!.click();
    await fixture.whenStable();
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAdultos.actualizar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(botonConTexto(elemento, 'Editar perfil'));
  });

  it('guardarConNombreVacioMuestraMensajeRequeridoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({});

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();

    const campoNombre = elemento.querySelector<HTMLInputElement>('#ficha-nombre')!;
    campoNombre.value = '';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#ficha-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Ingresa el nombre completo');
    expect(servicioAdultos.actualizar).not.toHaveBeenCalled();
  });

  it('editarSinFechaDeNacimientoLaPideYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      obtenerImpl: () => of(adulto({ fechaNacimiento: null })),
    });

    botonConTexto(elemento, 'Editar perfil')!.click();
    await fixture.whenStable();
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#ficha-fecha-nacimiento-error');
    expect(error?.classList).toContain('mv-campo__error');
    expect(error?.textContent).toContain('Ingresa la fecha de nacimiento');
    const campo = elemento.querySelector('#ficha-fecha-nacimiento')!;
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('ficha-fecha-nacimiento-error');
    expect(document.activeElement).toBe(campo);
    expect(servicioAdultos.actualizar).not.toHaveBeenCalled();
  });

  it('elTelefonoDelContactoPrincipalSeMuestraFormateado', async () => {
    const { elemento } = await configurar({});

    const enlace = elemento.querySelector<HTMLAnchorElement>('a.telefono')!;
    expect(enlace.getAttribute('href')).toBe('tel:+56911111111');
    expect(enlace.textContent?.trim()).toBe('+56 9 1111 1111');
  });

  it('desactivarEvitaElDobleTapYMuestraConfirmacion', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({});
    const sujeto = new Subject<RespuestaAdultoMayor>();
    servicioAdultos.desactivar.mockReturnValue(sujeto.asObservable());

    const boton = botonConTexto(elemento, 'Desactivar perfil')!;
    boton.click();
    boton.click();
    await fixture.whenStable();

    // El doble tap antes de que responda la API solo dispara una llamada, y el botón queda deshabilitado mientras está en vuelo.
    expect(servicioAdultos.desactivar).toHaveBeenCalledTimes(1);
    const segmento = elemento.querySelector<HTMLButtonElement>(
      '.mv-encabezado [aria-haspopup="menu"]',
    )!;
    expect(boton.getAttribute('aria-disabled')).toBe('true');
    expect(segmento.disabled).toBe(true);

    sujeto.next(adulto());
    sujeto.complete();
    await fixture.whenStable();

    expect(boton.getAttribute('aria-disabled')).toBeNull();
    expect(segmento.disabled).toBe(false);
    const confirmaciones = Array.from(elemento.querySelectorAll('[role="status"]'));
    expect(confirmaciones.some((p) => p.textContent?.includes('Perfil desactivado.'))).toBe(true);
  });

  it('perfilNoEncontradoMuestraMensaje', async () => {
    const { elemento } = await configurar({
      obtenerImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { detail: 'El adulto mayor no existe' },
            }),
        ),
    });

    expect(elemento.textContent).toContain('No encontramos este perfil en el grupo activo.');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/adultos',
    );
    expect(enlace).toBeDefined();
  });

  it('cambiarDeGrupoVuelveALaLista', async () => {
    const { fixture, activo, router, servicioAdultos } = await configurar({});
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/adultos');
    // Nunca se pide el perfil bajo el grupo nuevo: no hay flash de datos ajenos.
    expect(servicioAdultos.obtener).not.toHaveBeenCalledWith(2, 1);
    expect(servicioAdultos.obtener).toHaveBeenCalledTimes(1);
  });

  it('cargaCuandoElGrupoActivoLlegaDespuesDeUnaRecargaODeepLink', async () => {
    // Al recargar la página (o entrar por enlace directo), `ServicioGrupoActivo`
    // todavía no resolvió `listar()`: `activo()` arranca en null. Ese null
    // inicial NO debe tratarse como "el grupo cambió".
    const { fixture, activo, router, servicioAdultos, elemento } = await configurar({
      activo: null,
    });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    expect(servicioAdultos.obtener).not.toHaveBeenCalled();

    activo.set(grupo(1, 'COORDINADOR'));
    await fixture.whenStable();

    expect(servicioAdultos.obtener).toHaveBeenCalledWith(1, 1);
    expect(navegar).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain('Rosa González');
  });

  it('grupoActivoReemplazadoPorUnoEquivalenteNoNavega', async () => {
    // `ServicioGrupoActivo.cargar()` puede reemplazar `activo()` por un
    // objeto NUEVO para el MISMO idGrupo (como hacen `grupos.ts`/
    // `integrantes.ts` tras cada recarga): no es un cambio de grupo real.
    const { fixture, activo, router, servicioAdultos } = await configurar({});
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    servicioAdultos.obtener.mockClear();

    activo.set(grupo(1, 'COORDINADOR')); // mismo idGrupo, objeto distinto
    await fixture.whenStable();

    expect(navegar).not.toHaveBeenCalled();
    expect(servicioAdultos.obtener).not.toHaveBeenCalled();
  });

  it('catalogoDeEstadosFallaTrataAlAdultoComoNoModificable', async () => {
    const { elemento } = await configurar({
      estadosImpl: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    // Lado seguro: sin saber cuál es el idEstado de INACTIVO, nunca se
    // asume que el adulto está activo, aunque la API sí lo haya devuelto
    // como activo (idEstado: 1 en el fixture `adulto()`).
    expect(botonConTexto(elemento, 'Editar')).toBeFalsy();
    expect(elemento.textContent).toContain('Inactivo');
  });

  it('eliminarConReferenciasMuestraElError422', async () => {
    const { fixture, elemento, servicioAdultos, router } = await configurar({});
    servicioAdultos.eliminar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'No puedes eliminar: tiene historial asociado.' },
          }),
      ),
    );
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    botonConTexto(elemento, 'Eliminar')!.click();
    await fixture.whenStable();

    expect(window.confirm).toHaveBeenCalledWith(
      'Solo si fue creado por error. Si tiene historial, desactívalo.',
    );
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No puedes eliminar: tiene historial asociado.',
    );
    expect(navegar).not.toHaveBeenCalledWith('/adultos');
  });
});
