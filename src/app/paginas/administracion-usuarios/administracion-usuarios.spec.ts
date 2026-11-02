import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { AdministracionUsuarios } from './administracion-usuarios';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaPagina, RespuestaUsuario } from '../../nucleo/usuarios/modelos-usuarios';
import { ServicioUsuarios } from '../../nucleo/usuarios/servicio-usuarios';

const ESTADOS: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

function usuario(
  idUsuario: number,
  nombre: string,
  esAdministrador = false,
  idEstado = 1,
): RespuestaUsuario {
  return {
    idUsuario,
    nombre,
    email: `${nombre.toLowerCase()}@correo.cl`,
    telefono: null,
    esAdministrador,
    idEstado,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function pagina(elementos: RespuestaUsuario[], total = elementos.length): RespuestaPagina<RespuestaUsuario> {
  return { elementos, pagina: 0, tamano: 10, total };
}

async function configurar(
  usuariosIniciales: RespuestaUsuario[] = [usuario(1, 'Ana')],
  overrides: {
    listar?: ReturnType<typeof vi.fn>;
    estados?: ReturnType<typeof vi.fn>;
    crear?: ReturnType<typeof vi.fn>;
    reenviarAcceso?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const servicioUsuarios = {
    listar: overrides.listar ?? vi.fn(() => of(pagina(usuariosIniciales))),
    obtener: vi.fn(),
    actualizar: vi.fn(),
    cambiarEstado: vi.fn(),
    crear: overrides.crear ?? vi.fn(),
    reenviarAcceso: overrides.reenviarAcceso ?? vi.fn(),
  };
  const servicioCatalogos = { estados: overrides.estados ?? vi.fn(() => of(ESTADOS)) };

  TestBed.configureTestingModule({
    imports: [AdministracionUsuarios],
    providers: [
      provideRouter([]),
      { provide: ServicioUsuarios, useValue: servicioUsuarios },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
    ],
  });
  const fixture = TestBed.createComponent(AdministracionUsuarios);
  // Adjunto al documento: las aserciones de foco necesitan elementos conectados.
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return {
    fixture,
    servicioUsuarios,
    servicioCatalogos,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.trim().includes(texto),
  );
}

describe('AdministracionUsuarios', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('buscaPorTexto', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar();

    const campo = elemento.querySelector<HTMLInputElement>('#usuarios-buscar')!;
    escribir(campo, 'rojas');
    elemento.querySelector<HTMLFormElement>('.buscador')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioUsuarios.listar).toHaveBeenCalledWith({ texto: 'rojas', pagina: 0, tamano: 10 });
  });

  it('cambiaEstadoYRecarga', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', false, 1)]);
    servicioUsuarios.cambiarEstado.mockReturnValue(of(usuario(1, 'Ana', false, 2)));

    botonConTexto(elemento.querySelector('#usuario-acciones-1')!, 'Desactivar')!.click();
    await fixture.whenStable();

    expect(servicioUsuarios.cambiarEstado).toHaveBeenCalledWith(1, 2);
    expect(servicioUsuarios.listar).toHaveBeenCalledTimes(2);
  });

  it('menuOfreceElPasoACadaOtroEstadoConBloquearComoPeligro', async () => {
    const estados = [...ESTADOS, { idEstado: 3, codigo: 'BLOQUEADO', descripcion: 'Bloqueado', orden: 3 }];
    const { elemento } = await configurar([usuario(1, 'Ana', false, 2)], {
      estados: vi.fn(() => of(estados)),
    });

    const items = Array.from(elemento.querySelectorAll<HTMLElement>('#usuario-acciones-1 [role="menuitem"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Activar', 'Bloquear']);
    expect(items[1].classList).toContain('mv-menu__item--peligro');
    expect(items[0].classList).not.toContain('mv-menu__item--peligro');
  });

  it('cambiarEstadoConFallaMuestraElErrorYElEstadoReal', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', false, 1)]);
    servicioUsuarios.cambiarEstado.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'No se puede cambiar el estado' },
          }),
      ),
    );

    botonConTexto(elemento.querySelector('#usuario-acciones-1')!, 'Desactivar')!.click();
    await fixture.whenStable();

    expect(servicioUsuarios.listar).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('.usuario__estado .mv-chip')?.textContent?.trim()).toBe('Activo');
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No se puede cambiar el estado',
    );
  });

  it('muestraReglaDelUltimoAdministrador', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', true, 1)]);
    servicioUsuarios.actualizar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'No puedes quitar al último administrador' },
          }),
      ),
    );

    elemento.querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();

    const checkbox = elemento.querySelector<HTMLInputElement>('#usuario-administrador')!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    elemento.querySelector<HTMLFormElement>('.editar-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No puedes quitar al último administrador',
    );
  });

  it('formularioInvalidoAlGuardarMarcaCamposTocadosYMuestraError', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', true, 1)]);

    elemento.querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();

    escribir(elemento.querySelector<HTMLInputElement>('#usuario-nombre')!, '');
    elemento.querySelector<HTMLFormElement>('.editar-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#usuario-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('obligatorio');
    expect(elemento.querySelector('#usuario-nombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(servicioUsuarios.actualizar).not.toHaveBeenCalled();
  });

  it('editarConTelefonoNoChilenoMuestraLaReglaEnfocaElCampoYNoGuarda', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', true, 1)]);
    elemento.querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();

    const telefono = elemento.querySelector<HTMLInputElement>('#usuario-telefono')!;
    escribir(telefono, '+1 555 123 4567');
    elemento.querySelector<HTMLFormElement>('.editar-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#usuario-telefono-error');
    expect(error?.classList).toContain('mv-campo__error');
    expect(error?.textContent).toContain('Ingresa un teléfono chileno: +56 y 9 dígitos.');
    expect(telefono.getAttribute('aria-describedby')).toBe('usuario-telefono-ayuda usuario-telefono-error');
    expect(document.activeElement).toBe(telefono);
    expect(servicioUsuarios.actualizar).not.toHaveBeenCalled();
  });

  it('editarConTelefonoAntiguoSinCambiosLoEnviaTalCual', async () => {
    const antiguo = { ...usuario(1, 'Ana', true, 1), telefono: '22 345' };
    const { fixture, elemento, servicioUsuarios } = await configurar([antiguo]);
    servicioUsuarios.actualizar.mockReturnValue(of(antiguo));
    elemento.querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();

    escribir(elemento.querySelector<HTMLInputElement>('#usuario-nombre')!, 'Ana María');
    elemento.querySelector<HTMLFormElement>('.editar-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioUsuarios.actualizar).toHaveBeenCalledWith(1, {
      nombre: 'Ana María',
      telefono: '22 345',
      esAdministrador: true,
    });
  });

  it('crearConTelefonoValidoLoEnviaNormalizadoYConInvalidoEnfocaElCampo', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([]);
    servicioUsuarios.crear.mockReturnValue(
      of({ usuario: usuario(2, 'Beto'), claveTemporal: 'Ab3xZ9qLm2Pq', correoEnviado: true }),
    );
    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-nombre')!, 'Beto');
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-email')!, 'beto@correo.cl');
    const telefono = elemento.querySelector<HTMLInputElement>('#usuario-crear-telefono')!;
    expect(telefono.getAttribute('inputmode')).toBe('tel');

    escribir(telefono, '12345');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(elemento.querySelector('#usuario-crear-telefono-error')?.textContent).toContain(
      'Ingresa un teléfono chileno: +56 y 9 dígitos.',
    );
    expect(document.activeElement).toBe(telefono);
    expect(servicioUsuarios.crear).not.toHaveBeenCalled();

    escribir(telefono, '9 1234-5678');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(servicioUsuarios.crear).toHaveBeenCalledWith({
      nombre: 'Beto',
      email: 'beto@correo.cl',
      telefono: '+56912345678',
    });
  });

  it('muestraErrorSiFallaLaCarga', async () => {
    const { elemento } = await configurar(undefined, {
      listar: vi.fn(() => throwError(() => new Error('boom'))),
    });

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Ocurrió un error inesperado.',
    );
  });

  it('muestraAvisoSiFallaLaCargaDeEstados', async () => {
    const { elemento } = await configurar(undefined, {
      estados: vi.fn(() => throwError(() => new Error('boom'))),
    });

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar los estados.',
    );
  });

  it('crearUsuarioMuestraClaveUnaVez', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([]);
    servicioUsuarios.crear.mockReturnValue(
      of({ usuario: usuario(2, 'Beto'), claveTemporal: 'Ab3xZ9qLm2Pq', correoEnviado: true }),
    );

    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();

    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-nombre')!, 'Beto');
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-email')!, 'beto@correo.cl');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioUsuarios.crear).toHaveBeenCalledWith({
      nombre: 'Beto',
      email: 'beto@correo.cl',
      telefono: null,
    });
    const dialogo = elemento.querySelector('[role="dialog"]');
    expect(dialogo?.textContent).toContain('Ab3xZ9qLm2Pq');
    expect(dialogo?.textContent).toContain('Esta contraseña no se volverá a mostrar');
  });

  it('errorYaExisteMuestraMensaje', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([]);
    servicioUsuarios.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'Ya existe una cuenta con ese correo' },
          }),
      ),
    );

    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();

    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-nombre')!, 'Beto');
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-email')!, 'beto@correo.cl');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('.crear-usuario [role="alert"]')?.textContent).toContain(
      'Ya existe una cuenta con ese correo',
    );
    expect(elemento.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('reenviarAccesoPideConfirmacion', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana')]);
    servicioUsuarios.reenviarAcceso.mockReturnValue(of({ claveTemporal: 'Qw7mN4rTy8Hp', correoEnviado: false }));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    botonConTexto(elemento, 'Reenviar accesos')!.click();
    await fixture.whenStable();

    expect(confirmar).toHaveBeenCalled();
    expect(servicioUsuarios.reenviarAcceso).toHaveBeenCalledWith(1);
    const dialogo = elemento.querySelector('[role="dialog"]');
    expect(dialogo?.textContent).toContain('Qw7mN4rTy8Hp');
    expect(dialogo?.querySelector('[role="alert"]')?.textContent).toContain('No pudimos enviar el correo');
  });

  it('noMuestraReenviarAccesosSiElUsuarioNoEstaActivo', async () => {
    const { elemento } = await configurar([usuario(1, 'Ana', false, 2)]);

    expect(botonConTexto(elemento, 'Reenviar accesos')).toBeFalsy();
  });

  it('reenviarAccesoCanceladoNoLlamaAlServicio', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana')]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    botonConTexto(elemento, 'Reenviar accesos')!.click();
    await fixture.whenStable();

    expect(servicioUsuarios.reenviarAcceso).not.toHaveBeenCalled();
  });

  it('alCerrarDialogoLaClaveSeDescarta', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana')]);
    servicioUsuarios.reenviarAcceso.mockReturnValue(of({ claveTemporal: 'Qw7mN4rTy8Hp', correoEnviado: true }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    botonConTexto(elemento, 'Reenviar accesos')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector('[role="dialog"]')?.textContent).toContain('Qw7mN4rTy8Hp');

    botonConTexto(elemento.querySelector('[role="dialog"]')!, 'Cerrar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="dialog"]')).toBeFalsy();
    expect(elemento.textContent).not.toContain('Qw7mN4rTy8Hp');
  });

  it('alCerrarDialogoDevuelveElFocoAlBotonCrearUsuario', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([]);
    servicioUsuarios.crear.mockReturnValue(
      of({ usuario: usuario(2, 'Beto'), claveTemporal: 'Ab3xZ9qLm2Pq', correoEnviado: true }),
    );

    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-nombre')!, 'Beto');
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-email')!, 'beto@correo.cl');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    botonConTexto(elemento.querySelector('[role="dialog"]')!, 'Cerrar')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(botonConTexto(elemento, 'Crear usuario'));
  });

  it('alCerrarDialogoDevuelveElFocoAlMenuDeReenviarAccesos', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana')]);
    servicioUsuarios.reenviarAcceso.mockReturnValue(of({ claveTemporal: 'Qw7mN4rTy8Hp', correoEnviado: true }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const segmento = elemento.querySelector<HTMLButtonElement>('#usuario-acciones-1 [aria-haspopup="menu"]')!;
    segmento.click();
    await fixture.whenStable();

    botonConTexto(elemento, 'Reenviar accesos')!.click();
    await fixture.whenStable();
    botonConTexto(elemento.querySelector('[role="dialog"]')!, 'Cerrar')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(segmento);
  });

  it('nombreDemasiadoLargoMuestraMensajeAlCrear', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([]);

    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-nombre')!, 'A'.repeat(161));
    escribir(elemento.querySelector<HTMLInputElement>('#usuario-crear-email')!, 'beto@correo.cl');
    elemento.querySelector<HTMLFormElement>('.crear-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#usuario-crear-nombre-error')?.textContent).toContain(
      'no puede superar los 160 caracteres',
    );
    expect(servicioUsuarios.crear).not.toHaveBeenCalled();
  });

  it('encabezadoConCrearUsuarioComoAccionPrincipalYEnlaceAAuditoria', async () => {
    const { fixture, elemento } = await configurar();

    expect(elemento.querySelector('.mv-encabezado h1')?.textContent?.trim()).toBe(
      'Administración de usuarios',
    );
    const crear = elemento.querySelector<HTMLButtonElement>(
      '.mv-encabezado__accion button.mv-boton--primario',
    )!;
    expect(crear.textContent?.trim()).toBe('Crear usuario');
    expect(crear.getAttribute('aria-expanded')).toBe('false');
    expect(
      elemento.querySelector('.mv-encabezado__accion a[href="/administracion/auditoria"]')?.textContent,
    ).toContain('Auditoría global');

    crear.click();
    await fixture.whenStable();
    expect(crear.getAttribute('aria-expanded')).toBe('true');
    expect(elemento.querySelector('.crear-usuario')).toBeTruthy();
    expect(document.activeElement?.id).toBe('usuario-crear-nombre');

    crear.click();
    await fixture.whenStable();
    expect(elemento.querySelector('.crear-usuario')).toBeFalsy();
    expect(document.activeElement).toBe(crear);
  });

  it('filaMuestraAvatarNombreCorreoYChips', async () => {
    const { elemento } = await configurar([
      usuario(1, 'Ana Rojas', true, 1),
      usuario(2, 'Beto', false, 2),
    ]);

    const filas = elemento.querySelectorAll('tr.usuario');
    expect(filas).toHaveLength(2);
    expect(filas[0].querySelector('.mv-avatar')?.textContent?.trim()).toBe('AR');
    expect(filas[0].querySelector('.mv-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(filas[0].querySelector('.usuario__nombre')?.textContent?.trim()).toBe('Ana Rojas');
    expect(filas[0].querySelector('.usuario__correo')?.textContent?.trim()).toBe('ana rojas@correo.cl');

    expect(filas[0].querySelector('.usuario__telefono')?.textContent?.trim()).toBe('Sin teléfono');
    const chips = (fila: Element) =>
      Array.from(fila.querySelectorAll('.mv-chip')).map((chip) => chip.textContent?.trim());
    expect(chips(filas[0])).toEqual(['Activo', 'Administrador']);
    expect(filas[0].querySelector('.mv-chip')!.classList).toContain('mv-chip--exito');
    expect(chips(filas[1])).toEqual(['Inactivo', 'Integrante']);
    expect(filas[1].querySelector('.mv-chip')!.classList).not.toContain('mv-chip--exito');
  });

  it('editarEsLaAccionPrincipalYElRestoVaEnElMenu', async () => {
    const { elemento } = await configurar([usuario(1, 'Ana')]);

    const fila = elemento.querySelector('tr.usuario')!;
    expect(fila.querySelector('.mv-boton-dividido__principal')?.textContent?.trim()).toBe('Editar');
    const segmento = fila.querySelector('[aria-haspopup="menu"]')!;
    expect(segmento.getAttribute('aria-label')).toBe('Más acciones para Ana');
    expect(fila.querySelector('.mv-boton-dividido__principal')?.getAttribute('aria-label')).toBe(
      'Editar a Ana',
    );
    expect(segmento.getAttribute('aria-expanded')).toBe('false');
    const items = Array.from(fila.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent?.trim());
    expect(items).toEqual(['Reenviar accesos', 'Desactivar']);
  });

  it('conNombresRepetidosLosBotonesDeLaFilaSumanElCorreo', async () => {
    const { elemento } = await configurar([
      { ...usuario(1, 'Ana'), email: 'ana.uno@correo.cl' },
      { ...usuario(2, 'Ana'), email: 'ana.dos@correo.cl' },
      usuario(3, 'Beto'),
    ]);

    const nombres = (selector: string) =>
      Array.from(elemento.querySelectorAll(`tr.usuario ${selector}`)).map((b) => b.getAttribute('aria-label'));
    expect(nombres('.mv-boton-dividido__principal')).toEqual([
      'Editar a Ana, ana.uno@correo.cl',
      'Editar a Ana, ana.dos@correo.cl',
      'Editar a Beto',
    ]);
    expect(nombres('.mv-boton-dividido__segmento')).toEqual([
      'Más acciones para Ana, ana.uno@correo.cl',
      'Más acciones para Ana, ana.dos@correo.cl',
      'Más acciones para Beto',
    ]);
  });

  it('grillaConColumnasUsuarioTelefonoEstadoAdministradorYAcciones', async () => {
    const { elemento } = await configurar([{ ...usuario(1, 'Ana'), telefono: '+56912345678' }]);

    const tabla = elemento.querySelector('.mv-grilla table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    expect(
      Array.from(tabla.querySelectorAll('th[role="columnheader"]')).map((th) => th.textContent?.trim()),
    ).toEqual(['Usuario', 'Teléfono', 'Estado', 'Administrador', 'Acciones']);
    const celdas = Array.from(tabla.querySelectorAll<HTMLElement>('tr.usuario td[role="cell"]'));
    expect(celdas).toHaveLength(5);
    expect(celdas[1].getAttribute('data-etiqueta')).toBe('Teléfono');
    expect(celdas[1].textContent?.trim()).toBe('+56 9 1234 5678');
    expect(celdas[2].getAttribute('data-etiqueta')).toBe('Estado');
    expect(celdas[3].getAttribute('data-etiqueta')).toBe('Administrador');
    expect(celdas[4].classList).toContain('mv-grilla__celda--acciones');
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('editarAbreElFormularioEnLaFilaYCancelarDevuelveElFoco', async () => {
    const { fixture, elemento } = await configurar([usuario(1, 'Ana'), usuario(2, 'Beto')]);

    const filas = elemento.querySelectorAll('tr.usuario');
    const editar = filas[1].querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!;
    editar.click();
    await fixture.whenStable();

    const edicion = filas[1].nextElementSibling!;
    expect(edicion.classList).toContain('fila-edicion');
    expect(edicion.querySelector('.editar-usuario #usuario-nombre')).toBeTruthy();
    expect(elemento.querySelectorAll('.editar-usuario')).toHaveLength(1);
    expect(document.activeElement?.id).toBe('usuario-nombre');

    botonConTexto(edicion.querySelector<HTMLElement>('.editar-usuario')!, 'Cancelar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('.editar-usuario')).toBeFalsy();
    expect(document.activeElement).toBe(editar);
  });

  it('mientrasSeEditaLaGrillaNoLimitaSuAltoParaQueElFormularioQuepaEntero', async () => {
    const { fixture, elemento } = await configurar([usuario(1, 'Ana')]);
    const grilla = elemento.querySelector<HTMLElement>('.mv-grilla')!;
    expect(grilla.classList).not.toContain('grilla-usuarios--editando');

    elemento.querySelector<HTMLButtonElement>('.usuario .mv-boton-dividido__principal')!.click();
    await fixture.whenStable();
    expect(grilla.classList).toContain('grilla-usuarios--editando');

    botonConTexto(elemento.querySelector<HTMLElement>('.editar-usuario')!, 'Cancelar')!.click();
    await fixture.whenStable();
    expect(grilla.classList).not.toContain('grilla-usuarios--editando');
  });

  it('estadosDeCargaVacioYErrorConReintento', async () => {
    const sujeto = new Subject<RespuestaPagina<RespuestaUsuario>>();
    const { fixture, elemento } = await configurar(undefined, {
      listar: vi.fn(() => sujeto.asObservable()),
    });
    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cargando usuarios');

    sujeto.next(pagina([]));
    sujeto.complete();
    await fixture.whenStable();
    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain('No hay usuarios para mostrar.');

    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    const listar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(pagina([usuario(1, 'Ana')])));
    const { fixture: conError, elemento: elementoError } = await configurar(undefined, { listar });

    botonConTexto(elementoError.querySelector('.mv-aviso--error')!, 'Reintentar')!.click();
    await conError.whenStable();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(elementoError.querySelector('[role="alert"]')).toBeFalsy();
    expect(elementoError.querySelector('.usuario__nombre')?.textContent?.trim()).toBe('Ana');
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('AdministracionUsuarios: desplazamiento y foco', () => {
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

  it('editarTraeLaFilaDeEdicionALaVistaYGuardarDevuelveElFocoALaFila', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana'), usuario(2, 'Beto')]);
    servicioUsuarios.actualizar.mockReturnValue(of(usuario(2, 'Beto')));
    const editar = elemento.querySelector<HTMLButtonElement>(
      '#usuario-acciones-2 .mv-boton-dividido__principal',
    )!;

    editar.click();
    await fixture.whenStable();
    expect(bloqueDe(elemento.querySelector('.editar-usuario'))).toBe('start');
    expect(document.activeElement?.id).toBe('usuario-nombre');

    elemento.querySelector<HTMLFormElement>('.editar-usuario form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(elemento.querySelector('.editar-usuario')).toBeFalsy();
    expect(document.activeElement).toBe(
      elemento.querySelector('#usuario-acciones-2 .mv-boton-dividido__principal'),
    );
  });

  it('crearUsuarioTraeElFormularioALaVistaYAlCancelarVuelveAlBoton', async () => {
    const { fixture, elemento } = await configurar();

    botonConTexto(elemento, 'Crear usuario')!.click();
    await fixture.whenStable();
    expect(bloqueDe(elemento.querySelector('#usuarios-crear'))).toBe('start');
    expect(document.activeElement?.id).toBe('usuario-crear-nombre');

    botonConTexto(elemento.querySelector('#usuarios-crear')!, 'Cancelar')!.click();
    await fixture.whenStable();
    const abrir = elemento.querySelector('#usuarios-abrir-crear');
    expect(document.activeElement).toBe(abrir);
    expect(bloqueDe(abrir)).toBe('nearest');
  });

  it('cambiarDePaginaEnfocaLaPrimeraFila', async () => {
    const primera = Array.from({ length: 10 }, (_, i) => usuario(i + 1, `Persona${i + 1}`));
    const listar = vi.fn((filtro: { pagina: number }) =>
      of(
        filtro.pagina === 0
          ? { ...pagina(primera, 11) }
          : { ...pagina([usuario(11, 'Zoe')], 11), pagina: 1 },
      ),
    );
    const { fixture, elemento } = await configurar(primera, { listar });

    botonConTexto(elemento, 'Siguiente')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      elemento.querySelector('#usuario-acciones-11 .mv-boton-dividido__principal'),
    );
  });
});
