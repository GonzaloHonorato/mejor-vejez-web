import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MarcoApp } from './marco-app';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

function grupo(idGrupo: number, nombreGrupo: string): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo,
    notificaCoordinador: true,
    idEstado: 1,
    miRol: 'COORDINADOR',
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

interface OpcionesMarco {
  cerrarSesion?: ReturnType<typeof vi.fn>;
  esAdministrador?: boolean;
  grupos?: RespuestaGrupo[];
  activo?: RespuestaGrupo | null;
  falloServicioYo?: boolean;
  /** Navegación real del router (sin mockear `navigateByUrl`): necesario para probar routerLinkActive. */
  navegacionReal?: boolean;
}

@Component({ template: '' })
class PaginaFicticia {}

async function crearMarco(opciones: OpcionesMarco = {}) {
  const grupoActivo = {
    grupos: signal(opciones.grupos ?? []),
    activo: signal(opciones.activo ?? null),
    cargar: vi.fn().mockResolvedValue(undefined),
    seleccionar: vi.fn(),
    limpiar: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [MarcoApp],
    providers: [
      provideRouter(
        opciones.navegacionReal
          ? [
              { path: '', component: PaginaFicticia, data: { tituloPagina: 'Panel familiar' } },
              { path: 'grupos', component: PaginaFicticia, data: { tituloPagina: 'Grupos' } },
              {
                path: 'grupos/:idGrupo',
                component: PaginaFicticia,
                data: { tituloPagina: 'Integrantes' },
              },
            ]
          : [],
      ),
      {
        provide: ServicioAutenticacion,
        useValue: {
          habilitado: true,
          usuario: signal(null),
          listo: signal(true),
          cerrarSesion: opciones.cerrarSesion ?? vi.fn().mockResolvedValue(undefined),
        },
      },
      { provide: ServicioGrupoActivo, useValue: grupoActivo },
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            opciones.falloServicioYo
              ? throwError(() => new Error('boom'))
              : of({
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
  const router = TestBed.inject(Router);
  const navegar = opciones.navegacionReal
    ? vi.spyOn(router, 'navigateByUrl')
    : vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(MarcoApp);
  await fixture.whenStable();
  return { fixture, elemento: fixture.nativeElement as HTMLElement, navegar, grupoActivo, router };
}

async function pulsarCerrarSesion(cerrarSesion: ReturnType<typeof vi.fn>) {
  const marco = await crearMarco({ cerrarSesion });
  const boton = Array.from(marco.elemento.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Cerrar sesión'),
  )!;
  boton.click();
  await marco.fixture.whenStable();
  return marco;
}

function textosDeEnlaces(elemento: HTMLElement): string[] {
  return Array.from(elemento.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '');
}

describe('MarcoApp', () => {
  afterEach(() => vi.restoreAllMocks());

  it('navegaAIngresoTrasCerrarSesion', async () => {
    const { navegar, grupoActivo } = await pulsarCerrarSesion(vi.fn().mockResolvedValue(undefined));

    expect(grupoActivo.limpiar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith('/ingreso');
  });

  it('registraElErrorYNoNavegaSiCerrarSesionFalla', async () => {
    const registrarError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { navegar, grupoActivo } = await pulsarCerrarSesion(
      vi.fn().mockRejectedValue(new Error('sin red')),
    );

    expect(registrarError).toHaveBeenCalled();
    expect(grupoActivo.limpiar).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('muestraElGrupoActivo', async () => {
    const familiaRojas = grupo(2, 'Familia Rojas');
    const { fixture, elemento, grupoActivo } = await crearMarco({
      grupos: [grupo(1, 'Familia Soto'), familiaRojas],
      activo: familiaRojas,
    });

    expect(grupoActivo.cargar).toHaveBeenCalled();
    const bloque = elemento.querySelector('.lateral app-selector-grupo')!;
    expect(bloque.textContent).toContain('Grupo');
    expect(bloque.textContent).toContain('Familia Rojas');
    expect(elemento.querySelector('.cabecera')?.textContent).toContain('Familia Rojas');

    const botonCambiar = Array.from(bloque.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cambiar'),
    )!;
    botonCambiar.click();
    await fixture.whenStable();

    const opcion = Array.from(bloque.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Familia Soto'),
    )!;
    opcion.click();
    await fixture.whenStable();

    expect(grupoActivo.seleccionar).toHaveBeenCalledWith(1);
  });

  it('elEnlaceDeCrearGrupoEnLaCabeceraNoDuplicaElTexto', async () => {
    const { elemento } = await crearMarco({ grupos: [], activo: null });

    const enlace = elemento.querySelector('.cabecera__cambiar')!;
    // Antes de la corrección el texto accesible quedaba "Crear grupo de
    // grupo" (el sufijo oculto " de grupo" se agregaba también cuando no
    // había grupo activo).
    expect(enlace.textContent?.replace(/\s+/g, ' ').trim()).toBe('Crear grupo');
  });

  it('muestraAvisoSiFallaLaVerificacionDePermisos', async () => {
    const { elemento } = await crearMarco({ falloServicioYo: true });

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos verificar tus permisos',
    );
  });

  it('elTituloDelEncabezadoSigueALaRutaActiva', async () => {
    const { fixture, elemento, router } = await crearMarco({ navegacionReal: true });

    expect(elemento.querySelector('.cabecera__ruta')?.textContent).toContain('Panel familiar');

    await router.navigateByUrl('/grupos/5');
    await fixture.whenStable();

    expect(elemento.querySelector('.cabecera__ruta')?.textContent).toContain('Integrantes');
  });

  it('elEnlaceDeGruposSigueActivoEnUnaSubRuta', async () => {
    const { fixture, elemento, router } = await crearMarco({ navegacionReal: true });

    await router.navigateByUrl('/grupos/5');
    await fixture.whenStable();

    const enlaceGrupos = Array.from(elemento.querySelectorAll('.lateral__enlace')).find((a) =>
      a.textContent?.includes('Grupos'),
    )!;
    const enlacePanel = Array.from(elemento.querySelectorAll('.lateral__enlace')).find(
      (a) => a.textContent?.trim() === 'Panel familiar',
    )!;
    expect(enlaceGrupos.classList.contains('lateral__enlace--activo')).toBe(true);
    expect(enlacePanel.classList.contains('lateral__enlace--activo')).toBe(false);
  });

  it('adultosMayoresEstaHabilitado', async () => {
    const { elemento } = await crearMarco();

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Adultos mayores'),
    );
    expect(enlace).toBeDefined();
    expect(enlace!.getAttribute('href')).toBe('/adultos');
    expect(enlace!.textContent).not.toContain('próximamente');
  });

  it('muestraAdministracionSoloAAdministradores', async () => {
    const colaborador = await crearMarco({ esAdministrador: false });
    expect(textosDeEnlaces(colaborador.elemento)).toContain('Grupos');
    expect(textosDeEnlaces(colaborador.elemento)).toContain('Mi perfil');
    expect(textosDeEnlaces(colaborador.elemento)).not.toContain('Administración');

    TestBed.resetTestingModule();
    const administrador = await crearMarco({ esAdministrador: true });
    expect(textosDeEnlaces(administrador.elemento)).toContain('Administración');
  });
});
