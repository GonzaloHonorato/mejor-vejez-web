import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MarcoApp } from './marco-app';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

function grupo(
  idGrupo: number,
  nombreGrupo: string,
  miRol: string | null = 'COORDINADOR',
): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo,
    notificaCoordinador: true,
    idEstado: 1,
    miRol,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

interface OpcionesMarco {
  cerrarSesion?: ReturnType<typeof vi.fn>;
  esAdministrador?: boolean;
  grupos?: RespuestaGrupo[];
  activo?: RespuestaGrupo | null;
  falloServicioYo?: boolean;
  usuario?: { displayName: string | null; email: string | null } | null;
  /** `nombre` de `GET /api/yo`; por defecto 'Ana'. */
  nombreYo?: string;
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
              { path: 'grupos/:idGrupo/auditoria', component: PaginaFicticia },
              { path: 'relevos', component: PaginaFicticia },
              { path: 'relevos/:idRelevo', component: PaginaFicticia },
              { path: 'tareas', component: PaginaFicticia },
            ]
          : [],
      ),
      {
        provide: ServicioAutenticacion,
        useValue: {
          habilitado: true,
          usuario: signal(opciones.usuario ?? null),
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
                  nombre: opciones.nombreYo ?? 'Ana',
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

function botonMas(elemento: HTMLElement): HTMLButtonElement {
  const boton = elemento.querySelector<HTMLButtonElement>('.pestanas button.pestana');
  if (!boton) throw new Error('Sin botón "Más"');
  return boton;
}

function panelMas(elemento: HTMLElement): HTMLElement | null {
  return elemento.querySelector<HTMLElement>('[role="dialog"]');
}

async function abrirMas(marco: {
  fixture: { whenStable(): Promise<unknown> };
  elemento: HTMLElement;
}) {
  botonMas(marco.elemento).click();
  await marco.fixture.whenStable();
  const panel = panelMas(marco.elemento);
  if (!panel) throw new Error('El panel "Más" no se abrió');
  return panel;
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

  it('laMarcaVisibleEsCuidaMas', async () => {
    const { elemento } = await crearMarco();

    expect(elemento.querySelector('.lateral')?.textContent).toContain('Cuida+');
    expect(elemento.querySelector('.cabecera')?.textContent).toContain('Cuida+');
    expect(elemento.textContent).not.toContain('Mejor Vejez');
  });

  it('laCabeceraMuestraElRolDelGrupoActivo', async () => {
    const coordinador = await crearMarco({ activo: grupo(1, 'Familia Soto', 'COORDINADOR') });
    expect(coordinador.elemento.querySelector('.cabecera__rol')?.textContent?.trim()).toBe(
      'Coordinador/a',
    );

    TestBed.resetTestingModule();
    const colaborador = await crearMarco({ activo: grupo(1, 'Familia Soto', 'COLABORADOR') });
    expect(colaborador.elemento.querySelector('.cabecera__rol')?.textContent?.trim()).toBe(
      'Colaborador/a',
    );
  });

  it('laCabeceraNoMuestraRolSiMiRolEsNull', async () => {
    const sinRol = await crearMarco({ activo: grupo(1, 'Familia Soto', null) });
    expect(sinRol.elemento.querySelector('.cabecera__rol')).toBeNull();

    TestBed.resetTestingModule();
    const sinGrupo = await crearMarco({ activo: null });
    expect(sinGrupo.elemento.querySelector('.cabecera__rol')).toBeNull();
  });

  it('laCabeceraMuestraAvatarConInicialesYNombre', async () => {
    const conNombre = await crearMarco({
      usuario: { displayName: null, email: 'rosa@correo.cl' },
      nombreYo: 'Rosa Elena Rojas Muñoz',
    });
    const avatar = conNombre.elemento.querySelector('.cabecera .mv-avatar')!;
    expect(avatar.textContent?.trim()).toBe('RE');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(conNombre.elemento.querySelector('.cabecera__nombre-usuario')?.textContent).toContain(
      'Rosa Elena Rojas Muñoz',
    );

    TestBed.resetTestingModule();
    const soloCorreo = await crearMarco({
      usuario: { displayName: null, email: 'ana@correo.cl' },
      nombreYo: '',
    });
    expect(soloCorreo.elemento.querySelector('.cabecera .mv-avatar')?.textContent?.trim()).toBe(
      'A',
    );
  });

  it('elNombreDeLaCabeceraPrefiereElDelNucleo', async () => {
    const marco = await crearMarco({
      usuario: { displayName: 'Firebase Nombre', email: 'gonzalo@correo.cl' },
      nombreYo: 'Gonzalo Honorato',
    });
    const nombre = () =>
      marco.elemento.querySelector('.cabecera__nombre-usuario')?.textContent?.trim();
    expect(nombre()).toBe('Gonzalo Honorato');
    expect(marco.elemento.querySelector('.cabecera .mv-avatar')?.textContent?.trim()).toBe('GH');

    // El correo del panel "Más" no cambia.
    const panel = await abrirMas(marco);
    expect(panel.textContent).toContain('gonzalo@correo.cl');
  });

  it('sinNombreDelNucleoUsaElDeFirebaseYLuegoElCorreo', async () => {
    const conDisplayName = await crearMarco({
      usuario: { displayName: 'Rosa Rojas', email: 'rosa@correo.cl' },
      nombreYo: '',
    });
    expect(
      conDisplayName.elemento.querySelector('.cabecera__nombre-usuario')?.textContent?.trim(),
    ).toBe('Rosa Rojas');

    TestBed.resetTestingModule();
    const fallaYo = await crearMarco({
      usuario: { displayName: null, email: 'rosa@correo.cl' },
      falloServicioYo: true,
    });
    expect(fallaYo.elemento.querySelector('.cabecera__nombre-usuario')?.textContent?.trim()).toBe(
      'rosa@correo.cl',
    );
    expect(fallaYo.elemento.querySelector('.cabecera .mv-avatar')?.textContent?.trim()).toBe('R');
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

  it('tareasEstaHabilitado', async () => {
    const { elemento } = await crearMarco();

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Tareas'),
    );
    expect(enlace).toBeDefined();
    expect(enlace!.getAttribute('href')).toBe('/tareas');
    expect(enlace!.textContent).not.toContain('próximamente');
  });

  it('menuAlertasHabilitado', async () => {
    const { elemento } = await crearMarco();

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Alertas'),
    );
    expect(enlace).toBeDefined();
    expect(enlace!.getAttribute('href')).toBe('/alertas');
    expect(enlace!.textContent).not.toContain('próximamente');
  });

  it('medicamentosEstaHabilitado', async () => {
    const { elemento } = await crearMarco();

    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Medicamentos'),
    );
    expect(enlace).toBeDefined();
    expect(enlace!.getAttribute('href')).toBe('/planes');
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
  it('barraInferiorTieneCuatroPestanasYMas', async () => {
    const { elemento } = await crearMarco({ esAdministrador: true });

    const items = Array.from(elemento.querySelectorAll('.pestanas__lista > li'));
    expect(items).toHaveLength(5);
    const enlaces = Array.from(elemento.querySelectorAll<HTMLAnchorElement>('.pestanas__lista a'));
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual([
      'Panel',
      'Tareas',
      'Alertas',
      'Personas',
    ]);
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/tareas',
      '/alertas',
      '/adultos',
    ]);
    // Íconos reales (SVG), no los cuadros vacíos de antes.
    expect(elemento.querySelector('.pestana__icono')).toBeNull();
    expect(enlaces.every((a) => a.querySelector('app-icono svg'))).toBe(true);

    const boton = botonMas(elemento);
    expect(boton.textContent?.trim()).toBe('Más');
    expect(boton.querySelector('app-icono svg')).toBeTruthy();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-haspopup')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe('panel-mas');
    expect(panelMas(elemento)).toBeNull();
  });

  it('masMuestraRemediosRelevosGruposPerfil', async () => {
    const marco = await crearMarco({ esAdministrador: false });

    const panel = await abrirMas(marco);

    expect(botonMas(marco.elemento).getAttribute('aria-expanded')).toBe('true');
    expect(panel.id).toBe('panel-mas');
    expect(panel.getAttribute('aria-label')).toBe('Más opciones');
    const enlaces = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a'));
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual([
      'Remedios',
      'Relevos',
      'Grupos',
      'Perfil',
    ]);
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/planes',
      '/relevos',
      '/grupos',
      '/perfil',
    ]);
    expect(enlaces.every((a) => a.querySelector('app-icono svg'))).toBe(true);
  });

  it('masMuestraAdministracionSoloParaAdministrador', async () => {
    const colaborador = await crearMarco({ esAdministrador: false });
    const panelColaborador = await abrirMas(colaborador);
    expect(panelColaborador.textContent).not.toContain('Administración');

    TestBed.resetTestingModule();
    const administrador = await crearMarco({ esAdministrador: true });
    const panel = await abrirMas(administrador);
    const enlace = Array.from(panel.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Administración'),
    );
    expect(enlace?.getAttribute('href')).toBe('/administracion/usuarios');
  });

  it('abrirMasEnfocaPrimerEnlaceYCerrarConEscapeDevuelveFoco', async () => {
    const marco = await crearMarco();

    const panel = await abrirMas(marco);
    expect(document.activeElement).toBe(panel.querySelector('a'));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await marco.fixture.whenStable();

    expect(panelMas(marco.elemento)).toBeNull();
    expect(document.activeElement).toBe(botonMas(marco.elemento));
    expect(botonMas(marco.elemento).getAttribute('aria-expanded')).toBe('false');

    // El botón "Cerrar" del panel también lo cierra y devuelve el foco.
    const panelOtraVez = await abrirMas(marco);
    const cerrar = Array.from(panelOtraVez.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cerrar',
    )!;
    cerrar.click();
    await marco.fixture.whenStable();
    expect(panelMas(marco.elemento)).toBeNull();
    expect(document.activeElement).toBe(botonMas(marco.elemento));
  });

  it('clicFueraCierraMas', async () => {
    const marco = await crearMarco();
    await abrirMas(marco);

    marco.elemento.querySelector<HTMLElement>('.panel-mas__fondo')!.click();
    await marco.fixture.whenStable();

    expect(panelMas(marco.elemento)).toBeNull();
    expect(document.activeElement).toBe(botonMas(marco.elemento));
  });

  it('navegarCierraMas', async () => {
    const marco = await crearMarco({ navegacionReal: true });
    const panel = await abrirMas(marco);

    const relevos = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a')).find(
      (a) => a.textContent?.trim() === 'Relevos',
    )!;
    relevos.click();
    await marco.fixture.whenStable();

    expect(marco.router.url).toBe('/relevos');
    expect(panelMas(marco.elemento)).toBeNull();
  });

  it('masActivoEnRutaDeRelevos', async () => {
    const marco = await crearMarco({ navegacionReal: true });
    expect(botonMas(marco.elemento).classList.contains('pestana--activa')).toBe(false);

    await marco.router.navigateByUrl('/relevos/7');
    await marco.fixture.whenStable();
    expect(botonMas(marco.elemento).classList.contains('pestana--activa')).toBe(true);
    const panel = await abrirMas(marco);
    const actual = panel.querySelector('a[aria-current="page"]');
    expect(actual?.textContent?.trim()).toBe('Relevos');
    expect(panel.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await marco.fixture.whenStable();

    await marco.router.navigateByUrl('/grupos/1/auditoria');
    await marco.fixture.whenStable();
    expect(botonMas(marco.elemento).classList.contains('pestana--activa')).toBe(true);
    const panelGrupos = await abrirMas(marco);
    expect(panelGrupos.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Grupos');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await marco.fixture.whenStable();

    await marco.router.navigateByUrl('/tareas');
    await marco.fixture.whenStable();
    expect(botonMas(marco.elemento).classList.contains('pestana--activa')).toBe(false);
  });

  it('cerrarSesionDesdeMas', async () => {
    const cerrarSesion = vi.fn().mockResolvedValue(undefined);
    const marco = await crearMarco({ cerrarSesion });
    const panel = await abrirMas(marco);

    expect(panel.textContent).toContain('ana@correo.cl');
    const boton = Array.from(panel.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cerrar sesión'),
    )!;
    boton.click();
    await marco.fixture.whenStable();

    expect(cerrarSesion).toHaveBeenCalled();
    expect(marco.grupoActivo.limpiar).toHaveBeenCalled();
    expect(marco.navegar).toHaveBeenCalledWith('/ingreso');
  });

  it('lateralIncluyeRelevos', async () => {
    const { elemento } = await crearMarco();

    const textos = Array.from(elemento.querySelectorAll('.lateral__enlace')).map((a) =>
      a.textContent?.trim(),
    );
    expect(textos).toEqual([
      'Panel familiar',
      'Tareas',
      'Alertas',
      'Medicamentos',
      'Relevos',
      'Adultos mayores',
      'Grupos',
      'Mi perfil',
    ]);
    const relevos = Array.from(elemento.querySelectorAll('.lateral__enlace')).find(
      (a) => a.textContent?.trim() === 'Relevos',
    );
    expect(relevos?.getAttribute('href')).toBe('/relevos');
  });
  it('masAbiertoDejaInerteElContenidoDetras', async () => {
    const marco = await crearMarco();
    const detras = ['.mv-saltar', '.lateral', '.cabecera', 'main', '.pie'].map((selector) =>
      marco.elemento.querySelector(selector)!,
    );
    expect(detras.every((e) => !e.hasAttribute('inert'))).toBe(true);

    await abrirMas(marco);
    expect(detras.every((e) => e.hasAttribute('inert'))).toBe(true);
    expect(marco.elemento.querySelector('.pestanas')!.hasAttribute('inert')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await marco.fixture.whenStable();
    expect(detras.every((e) => !e.hasAttribute('inert'))).toBe(true);
    expect(document.activeElement).toBe(botonMas(marco.elemento));
  });
  // Si `signOut` falla, el panel no debe quedar abierto
  // ni el contenido de fondo `inert`.
  it('cerrarSesionFallidaDesdeMasCierraElPanelYQuitaInert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const marco = await crearMarco({
      cerrarSesion: vi.fn().mockRejectedValue(new Error('sin red')),
    });
    const panel = await abrirMas(marco);

    Array.from(panel.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Cerrar sesión'))!
      .click();
    await marco.fixture.whenStable();

    expect(panelMas(marco.elemento)).toBeNull();
    expect(marco.elemento.querySelector('main')!.hasAttribute('inert')).toBe(false);
    expect(marco.elemento.querySelector('.cabecera')!.hasAttribute('inert')).toBe(false);
    expect(marco.navegar).not.toHaveBeenCalled();
  });
});
