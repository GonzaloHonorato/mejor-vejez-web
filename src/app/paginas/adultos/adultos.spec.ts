import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Adultos } from './adultos';
import { RespuestaAdultoMayor, RespuestaContacto } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ESTADOS_ADULTO: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

const PARENTESCOS: RespuestaOpcionCatalogo[] = [
  { idOpcion: 31, codigo: 'PADRE', descripcion: 'Padre', orden: 1 },
  { idOpcion: 33, codigo: 'HIJO', descripcion: 'Hijo', orden: 3 },
  { idOpcion: 36, codigo: 'TIO', descripcion: 'Tío', orden: 6 },
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
    codigoInterno: null,
    nombreCompleto: 'Rosa González',
    fechaNacimiento: '1950-05-10',
    notasEmergencia: null,
    observacionesGenerales: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: '2026-01-01T00:00:00-03:00',
    contactoPrincipal: contacto(),
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  adultosIniciales?: RespuestaAdultoMayor[];
  listarImpl?: (idGrupo: number, incluirInactivos?: boolean) => Observable<RespuestaAdultoMayor[]>;
  esAdministrador?: boolean;
  estados?: RespuestaEstadoCatalogo[];
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioAdultos = {
    listar: vi.fn(opciones.listarImpl ?? (() => of(opciones.adultosIniciales ?? [adulto()]))),
    crear: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [Adultos],
    providers: [
      provideRouter([]),
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
          estados: () => of(opciones.estados ?? ESTADOS_ADULTO),
          opciones: () => of(PARENTESCOS),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Adultos);
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

function escribir(elemento: HTMLElement, selector: string, valor: string): void {
  const campo = elemento.querySelector<HTMLInputElement>(selector)!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

function elegir(elemento: HTMLElement, selector: string, indice: number): void {
  const select = elemento.querySelector<HTMLSelectElement>(selector)!;
  select.selectedIndex = indice;
  select.dispatchEvent(new Event('change'));
}

function completarAlta(elemento: HTMLElement, telefono = '9 1234 5678'): void {
  escribir(elemento, '#adulto-nombre', 'Rosa González');
  escribir(elemento, '#adulto-fecha-nacimiento', '1944-02-01');
  escribir(elemento, '#adulto-contacto-nombre', 'Pedro González');
  elegir(elemento, '#adulto-contacto-parentesco', 2);
  escribir(elemento, '#adulto-contacto-telefono', telefono);
}

async function abrirFormulario(fixture: { whenStable(): Promise<unknown> }, elemento: HTMLElement) {
  botonConTexto(elemento, 'Agregar adulto mayor')!.click();
  await fixture.whenStable();
}

describe('Adultos', () => {
  it('sinGrupoActivoInvitaAElegirUno', async () => {
    const { elemento } = await configurar({ activo: null });

    expect(elemento.textContent).toContain('Primero crea o elige un grupo.');
    const enlace = Array.from(elemento.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/grupos',
    );
    expect(enlace).toBeDefined();
  });

  it('listaAdultosConSuContactoPrincipal', async () => {
    const inactivo = adulto({
      idAdultoMayor: 2,
      nombreCompleto: 'Pedro Soto',
      idEstado: 2,
      contactoPrincipal: null,
    });
    const { elemento, servicioAdultos } = await configurar({
      adultosIniciales: [adulto(), inactivo],
    });

    expect(servicioAdultos.listar).toHaveBeenCalledWith(1, false);
    const tarjetas = Array.from(elemento.querySelectorAll('.mv-grilla tbody tr'));
    expect(tarjetas).toHaveLength(2);

    expect(tarjetas[0].textContent).toContain('Rosa González');
    expect(tarjetas[0].textContent).toContain('años');
    expect(tarjetas[0].textContent).toContain('Juana Pérez');
    expect(tarjetas[0].textContent).toContain('Hija');
    const telefono = tarjetas[0].querySelector('a[href^="tel:"]');
    expect(telefono?.getAttribute('href')).toBe('tel:+56911111111');
    expect(telefono?.textContent?.trim()).toBe('+56 9 1111 1111');
    expect(tarjetas[0].querySelector('a.mv-grilla__titulo')?.getAttribute('href')).toBe('/adultos/1');
    expect(tarjetas[0].textContent).not.toContain('Inactivo');

    expect(tarjetas[1].textContent).toContain('Pedro Soto');
    expect(tarjetas[1].textContent).toContain('Inactivo');
    expect(tarjetas[1].textContent).toContain('Sin contacto principal');
  });

  it('cadaFilaMuestraInicialesEdadYCodigoYElNombreEnlazaALaFicha', async () => {
    const { elemento } = await configurar({
      adultosIniciales: [adulto({ codigoInterno: 'AM-001', nombreCompleto: 'Rosa Elena Rojas' })],
    });

    const fila = elemento.querySelector('.mv-grilla tbody tr')!;
    const avatar = fila.querySelector('.mv-avatar');
    expect(avatar?.textContent?.trim()).toBe('RE');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
    expect(fila.querySelector('.mv-grilla__secundario')?.textContent).toMatch(/\d+ años · Código AM-001/);
    const titulo = fila.querySelector('a.mv-grilla__titulo');
    expect(titulo?.textContent?.trim()).toBe('Rosa Elena Rojas');
    expect(titulo?.getAttribute('aria-label')).toBe('Rosa Elena Rojas, código AM-001');
    const ver = fila.querySelector('.mv-grilla__celda--acciones a');
    expect(ver?.textContent?.trim()).toBe('Ver ficha');
    expect(ver?.getAttribute('href')).toBe('/adultos/1');
    // Repite el destino del título (que ya cubre la fila): fuera del orden de foco y de los lectores.
    expect(ver?.getAttribute('tabindex')).toBe('-1');
    expect(ver?.getAttribute('aria-hidden')).toBe('true');
    expect(ver?.hasAttribute('aria-label')).toBe(false);
  });

  it('perfilesSonUnaGrillaConColumnasYRoles', async () => {
    const { elemento } = await configurar({
      adultosIniciales: [adulto(), adulto({ idAdultoMayor: 2, nombreCompleto: 'Pedro Soto' })],
    });

    const region = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(region.getAttribute('aria-labelledby')).toBe('adultos-lista-titulo');
    const tabla = region.querySelector('table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    const encabezados = Array.from(tabla.querySelectorAll('th[role="columnheader"]')).map((th) =>
      th.textContent?.trim(),
    );
    expect(encabezados).toEqual(['Adulto', 'Contacto principal', 'Estado', 'Acciones']);
    expect(tabla.querySelectorAll('[role="rowgroup"]')).toHaveLength(2);
    const filas = tabla.querySelectorAll('tbody tr[role="row"]');
    expect(filas).toHaveLength(2);
    const etiquetas = Array.from(filas[0].querySelectorAll('td[role="cell"]')).map((td) =>
      td.getAttribute('data-etiqueta'),
    );
    expect(etiquetas).toEqual([null, 'Contacto principal', 'Estado', null]);
    expect(filas[0].querySelector('.contacto__nombre')?.textContent?.trim()).toBe(
      'Juana Pérez · Hija',
    );
    expect(filas[0].querySelector('.contacto__telefono')?.textContent?.trim()).toBe(
      '+56 9 1111 1111',
    );
    const nombres = Array.from(tabla.querySelectorAll('a[aria-label]')).map((a) =>
      a.getAttribute('aria-label'),
    );
    expect(new Set(nombres).size).toBe(nombres.length);
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('sinFechaNiCodigoNoMuestraEdadNiCodigo', async () => {
    const { elemento } = await configurar({
      adultosIniciales: [adulto({ fechaNacimiento: null, codigoInterno: null })],
    });

    const fila = elemento.querySelector('.mv-grilla tbody tr')!;
    expect(fila.textContent).not.toContain('años');
    expect(fila.textContent).not.toContain('Código');
    expect(fila.querySelector('a.mv-grilla__titulo')?.getAttribute('aria-label')).toBe(
      'Rosa González',
    );
    expect(fila.querySelector('.mv-grilla__celda--acciones a')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('chipDeEstadoActivoOInactivo', async () => {
    const { elemento } = await configurar({
      adultosIniciales: [
        adulto(),
        adulto({ idAdultoMayor: 2, nombreCompleto: 'Pedro Soto', idEstado: 2 }),
      ],
    });

    const chips = Array.from(elemento.querySelectorAll('.mv-grilla .mv-chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Activo', 'Inactivo']);
    expect(chips[0].classList).toContain('mv-chip--exito');
  });

  it('sinCatalogoDeEstadosNoAfirmaNingunEstado', async () => {
    const { elemento } = await configurar({ estados: [] });

    expect(elemento.querySelector('.mv-grilla .mv-chip')).toBeFalsy();
  });

  it('cuentaLosAdultosDeLaLista', async () => {
    const { elemento } = await configurar({
      adultosIniciales: [adulto(), adulto({ idAdultoMayor: 2, nombreCompleto: 'Pedro Soto' })],
    });

    expect(elemento.querySelector('.cuenta')?.textContent?.trim()).toBe('2 adultos mayores');
  });

  it('mientrasCargaMuestraElEsqueleto', async () => {
    const pendiente = new Subject<RespuestaAdultoMayor[]>();
    const { fixture, elemento } = await configurar({ listarImpl: () => pendiente.asObservable() });

    const estado = elemento.querySelector('[role="status"]');
    expect(estado?.textContent).toContain('Cargando adultos mayores');
    expect(elemento.querySelector('.mv-esqueleto')).toBeTruthy();

    pendiente.next([adulto()]);
    await fixture.whenStable();
    expect(elemento.querySelector('.mv-esqueleto')).toBeFalsy();
  });

  it('listaVaciaMuestraElEstadoVacio', async () => {
    const { elemento } = await configurar({ adultosIniciales: [] });

    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain(
      'Aún no hay adultos mayores registrados en este grupo.',
    );
  });

  it('errorAlCargarPermiteReintentar', async () => {
    let intentos = 0;
    const { fixture, elemento, servicioAdultos } = await configurar({
      listarImpl: () =>
        ++intentos === 1
          ? throwError(
              () => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la carga.' } }),
            )
          : of([adulto()]),
    });

    const aviso = elemento.querySelector('.mv-aviso--error');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.textContent).toContain('Falló la carga.');

    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.listar).toHaveBeenCalledTimes(2);
    expect(servicioAdultos.listar).toHaveBeenLastCalledWith(1, false);
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.textContent).toContain('Rosa González');
  });

  it('elFormularioDeAltaEstaPlegadoTrasLaAccionPrincipal', async () => {
    const { fixture, elemento } = await configurar({});

    const accion = botonConTexto(elemento, 'Agregar adulto mayor')!;
    expect(accion.classList).toContain('mv-boton--primario');
    expect(accion.getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector('#adulto-nombre')).toBeFalsy();

    accion.click();
    await fixture.whenStable();

    expect(accion.getAttribute('aria-expanded')).toBe('true');
    const seccion = elemento.querySelector(`#${accion.getAttribute('aria-controls')}`);
    expect(seccion?.querySelector('#adulto-nombre')).toBeTruthy();
    expect(document.activeElement?.id).toBe('adulto-nombre');

    botonConTexto(seccion as HTMLElement, 'Cancelar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('#adulto-nombre')).toBeFalsy();
    expect(accion.getAttribute('aria-expanded')).toBe('false');
    expect(accion.id).toBe('adultos-abrir-alta');
    expect(document.activeElement).toBe(accion);
  });

  it('cancelarVaPrimeroYGuardarAlFinal', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Agregar adulto mayor')!.click();
    await fixture.whenStable();

    const botones = Array.from(
      elemento.querySelectorAll<HTMLButtonElement>('#adultos-alta .botones button'),
    ).map((b) => b.textContent?.trim());
    expect(botones).toEqual(['Cancelar', 'Guardar adulto mayor']);
  });

  it('colaboradorNoVeElFormulario', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(elemento.textContent).not.toContain('Agregar adulto mayor');
    expect(botonConTexto(elemento, 'Agregar adulto mayor')).toBeFalsy();
    expect(elemento.querySelector('#adulto-nombre')).toBeFalsy();
  });

  it('crearNavegaALaFicha', async () => {
    const { fixture, elemento, servicioAdultos, router } = await configurar({
      adultosIniciales: [],
    });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    servicioAdultos.crear.mockReturnValue(of(adulto({ idAdultoMayor: 9 })));
    await abrirFormulario(fixture, elemento);

    completarAlta(elemento, '+56 9 1234-5678');
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAdultos.crear).toHaveBeenCalledWith(1, {
      nombreCompleto: 'Rosa González',
      codigoInterno: null,
      fechaNacimiento: '1944-02-01',
      notasEmergencia: null,
      observacionesGenerales: null,
      contactoPrincipal: { nombre: 'Pedro González', idParentesco: 33, telefono: '+56912345678' },
    });
    expect(navegar).toHaveBeenCalledWith('/adultos/9');
  });

  it('elContactoPrincipalTieneParentescoDelCatalogoYAyudaDeTelefono', async () => {
    const { fixture, elemento } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);

    const seccion = elemento.querySelector('fieldset.contacto-principal')!;
    expect(seccion.querySelector('legend')?.textContent?.trim()).toBe('Contacto principal');
    const opciones = Array.from(
      seccion.querySelectorAll<HTMLOptionElement>('#adulto-contacto-parentesco option'),
    ).map((opcion) => opcion.textContent?.trim());
    expect(opciones).toEqual(['Selecciona…', 'Padre', 'Hijo', 'Tío']);

    const telefono = seccion.querySelector('#adulto-contacto-telefono')!;
    expect(telefono.getAttribute('inputmode')).toBe('tel');
    expect(telefono.getAttribute('aria-describedby')).toBe('adulto-contacto-telefono-ayuda');
    expect(seccion.querySelector('#adulto-contacto-telefono-ayuda')?.textContent).toContain(
      'Ej.: +56 9 1234 5678',
    );
  });

  it('enviarSinFechaNiContactoMuestraCadaErrorEnlazadoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);
    escribir(elemento, '#adulto-nombre', 'Rosa González');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const esperados: [string, string][] = [
      ['adulto-fecha-nacimiento', 'Ingresa la fecha de nacimiento'],
      ['adulto-contacto-nombre', 'Ingresa el nombre del contacto'],
      ['adulto-contacto-parentesco', 'Elige el parentesco'],
      ['adulto-contacto-telefono', 'Ingresa un teléfono'],
    ];
    for (const [id, mensaje] of esperados) {
      const error = elemento.querySelector(`#${id}-error`);
      expect(error?.classList).toContain('mv-campo__error');
      expect(error?.textContent).toContain(mensaje);
      const campo = elemento.querySelector(`#${id}`)!;
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-describedby')).toContain(`${id}-error`);
    }
    expect(servicioAdultos.crear).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('adulto-fecha-nacimiento');
  });

  it('telefonoNoChilenoMuestraLaReglaYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);
    completarAlta(elemento, '12345');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#adulto-contacto-telefono-error')?.textContent).toContain(
      'Ingresa un teléfono chileno: +56 y 9 dígitos.',
    );
    expect(
      elemento.querySelector('#adulto-contacto-telefono')?.getAttribute('aria-describedby'),
    ).toBe('adulto-contacto-telefono-ayuda adulto-contacto-telefono-error');
    expect(document.activeElement?.id).toBe('adulto-contacto-telefono');
    expect(servicioAdultos.crear).not.toHaveBeenCalled();
  });

  it('fechaFuturaSeAvisaSinLlamarALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);
    completarAlta(elemento);
    escribir(elemento, '#adulto-fecha-nacimiento', '2999-01-01');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#adulto-fecha-nacimiento-error')?.textContent).toContain(
      'La fecha de nacimiento no puede ser futura',
    );
    expect(servicioAdultos.crear).not.toHaveBeenCalled();
  });

  it('alSalirDelTelefonoLoFormatea', async () => {
    const { fixture, elemento } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);
    escribir(elemento, '#adulto-contacto-telefono', '912345678');

    const campo = elemento.querySelector<HTMLInputElement>('#adulto-contacto-telefono')!;
    campo.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(campo.value).toBe('+56 9 1234 5678');
  });

  it('erroresDelServidorDelContactoSeMuestranEnSuCampo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    servicioAdultos.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              errores: [
                { campo: 'contactoPrincipal.telefono', mensaje: 'Teléfono rechazado por la API.' },
              ],
            },
          }),
      ),
    );
    await abrirFormulario(fixture, elemento);
    completarAlta(elemento);

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('#adulto-contacto-telefono-error')?.textContent).toContain(
      'Teléfono rechazado por la API.',
    );
    expect(elemento.querySelector('.mv-aviso--error[role="alert"]')).toBeFalsy();
  });

  it('crearConNombreVacioMuestraMensajeRequeridoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    await abrirFormulario(fixture, elemento);

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#adulto-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Ingresa el nombre completo');
    expect(elemento.querySelector('#adulto-nombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(servicioAdultos.crear).not.toHaveBeenCalled();
  });

  it('crearMuestraErrorDeCampo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });
    servicioAdultos.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errores: [{ campo: 'nombreCompleto', mensaje: 'El nombre es obligatorio.' }] },
          }),
      ),
    );
    await abrirFormulario(fixture, elemento);

    completarAlta(elemento);
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#adulto-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('El nombre es obligatorio.');
  });

  it('mostrarInactivosRecargaConElParametro', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({});
    servicioAdultos.listar.mockClear();
    servicioAdultos.listar.mockReturnValue(of([adulto()]));

    const casilla = elemento.querySelector<HTMLInputElement>('#adultos-mostrar-inactivos')!;
    casilla.click();
    await fixture.whenStable();

    expect(servicioAdultos.listar).toHaveBeenCalledWith(1, true);
  });

  it('cambiarDeGrupoRecargaLaLista', async () => {
    const { fixture, elemento, servicioAdultos, activo } = await configurar({
      listarImpl: (idGrupo: number) =>
        of(
          idGrupo === 1
            ? [adulto({ idAdultoMayor: 1, nombreCompleto: 'Rosa González' })]
            : [adulto({ idAdultoMayor: 5, nombreCompleto: 'Pedro Soto', contactoPrincipal: null })],
        ),
    });

    expect(elemento.textContent).toContain('Rosa González');

    activo.set(grupo(2, 'COORDINADOR'));
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Pedro Soto');
    expect(elemento.textContent).not.toContain('Rosa González');
    expect(servicioAdultos.listar).toHaveBeenCalledWith(2, false);
  });
});
