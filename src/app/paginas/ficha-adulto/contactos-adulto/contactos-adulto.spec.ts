import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ContactosAdulto } from './contactos-adulto';
import { RespuestaContacto } from '../../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../../nucleo/catalogos/servicio-catalogos';

const PARENTESCOS: RespuestaOpcionCatalogo[] = [
  { idOpcion: 31, codigo: 'PADRE', descripcion: 'Padre', orden: 1 },
  { idOpcion: 33, codigo: 'HIJO', descripcion: 'Hijo', orden: 3 },
  { idOpcion: 36, codigo: 'TIO', descripcion: 'Tío', orden: 6 },
];

const ESTADOS_CONTACTO: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

function contacto(datos: Partial<RespuestaContacto> = {}): RespuestaContacto {
  return {
    idContacto: 1,
    idAdultoMayor: 1,
    nombreContacto: 'Juana Pérez',
    idParentesco: 33,
    parentesco: 'Hijo',
    telefono: '+56911111111',
    esPrincipal: true,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: '2026-01-01T00:00:00-03:00',
    ...datos,
  };
}

interface Opciones {
  contactosIniciales?: RespuestaContacto[];
  puedeAdministrar?: boolean;
  adultoActivo?: boolean;
  estados?: RespuestaEstadoCatalogo[];
  contactosImpl?: () => Observable<RespuestaContacto[]>;
}

async function configurar(opciones: Opciones = {}) {
  const servicioAdultos = {
    contactos: vi.fn(
      opciones.contactosImpl ?? (() => of(opciones.contactosIniciales ?? [contacto()])),
    ),
    crearContacto: vi.fn(),
    actualizarContacto: vi.fn(),
    designarPrincipal: vi.fn(),
    desactivarContacto: vi.fn(),
    reactivarContacto: vi.fn(),
    eliminarContacto: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [ContactosAdulto],
    providers: [
      provideRouter([]),
      { provide: ServicioAdultos, useValue: servicioAdultos },
      {
        provide: ServicioCatalogos,
        useValue: {
          estados: () => of(opciones.estados ?? ESTADOS_CONTACTO),
          opciones: () => of(PARENTESCOS),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ContactosAdulto);
  fixture.componentRef.setInput('idGrupo', 1);
  fixture.componentRef.setInput('idAdulto', 1);
  fixture.componentRef.setInput('puedeAdministrar', opciones.puedeAdministrar ?? true);
  fixture.componentRef.setInput('adultoActivo', opciones.adultoActivo ?? true);
  await fixture.whenStable();
  return {
    fixture,
    servicioAdultos,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

function escribir(raiz: ParentNode, selector: string, valor: string): void {
  const campo = raiz.querySelector<HTMLInputElement>(selector)!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

function elegir(raiz: ParentNode, selector: string, indice: number): void {
  const select = raiz.querySelector<HTMLSelectElement>(selector)!;
  select.selectedIndex = indice;
  select.dispatchEvent(new Event('change'));
}

function filaDe(elemento: HTMLElement, nombre: string): HTMLElement {
  return Array.from(elemento.querySelectorAll('.contacto')).find((fila) =>
    fila.textContent?.includes(nombre),
  ) as HTMLElement;
}

describe('ContactosAdulto', () => {
  it('cadaContactoTieneEditarYElRestoEnElBotonCombinado', async () => {
    const { elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    const fila = filaDe(elemento, 'Pedro Pérez');
    expect(fila.tagName).toBe('TR');
    const combinado = fila.querySelector('.mv-grilla__celda--acciones app-boton-dividido')!;
    expect(combinado.querySelector('.mv-boton-dividido__principal')?.textContent?.trim()).toBe(
      'Editar',
    );
    expect(combinado.querySelector('[aria-haspopup="menu"]')?.getAttribute('aria-label')).toBe(
      'Más acciones para Pedro Pérez',
    );
    expect(combinado.querySelector('.mv-boton-dividido__principal')?.getAttribute('aria-label')).toBe(
      'Editar a Pedro Pérez',
    );
    const items = Array.from(combinado.querySelectorAll('[role="menuitem"]'));
    expect(items.map((b) => b.textContent?.trim())).toEqual([
      'Hacer principal',
      'Desactivar',
      'Eliminar',
    ]);
    expect(items[2].classList).toContain('mv-menu__item--peligro');
    expect(elemento.querySelector('details.mv-mas')).toBeNull();
  });

  it('grillaConColumnasYRolesExplicitos', async () => {
    const { elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false, idEstado: 2 }),
      ],
    });

    const tabla = elemento.querySelector('.mv-grilla table.mv-grilla__tabla')!;
    expect(tabla.getAttribute('role')).toBe('table');
    const encabezados = Array.from(tabla.querySelectorAll('th')).map((th) => [
      th.textContent?.trim(),
      th.getAttribute('role'),
    ]);
    expect(encabezados).toEqual([
      ['Nombre', 'columnheader'],
      ['Parentesco', 'columnheader'],
      ['Teléfono', 'columnheader'],
      ['Principal', 'columnheader'],
      ['Acciones', 'columnheader'],
    ]);
    const fila = filaDe(elemento, 'Juana Pérez');
    expect(fila.getAttribute('role')).toBe('row');
    const etiquetas = Array.from(fila.querySelectorAll('td')).map((td) => [
      td.getAttribute('role'),
      td.getAttribute('data-etiqueta'),
    ]);
    expect(etiquetas).toEqual([
      ['cell', 'Nombre'],
      ['cell', 'Parentesco'],
      ['cell', 'Teléfono'],
      ['cell', 'Principal'],
      ['cell', null],
    ]);
    expect(fila.querySelector('a.telefono')?.textContent?.trim()).toBe('+56 9 1111 1111');
    // Un solo nombre: el de la región con scroll (la tabla no repite el suyo).
    const regionGrilla = elemento.querySelector('.mv-grilla[role="region"]')!;
    expect(regionGrilla.getAttribute('aria-label') ?? regionGrilla.getAttribute('aria-labelledby')).toBeTruthy();
    const tablaGrilla = regionGrilla.querySelector('table')!;
    expect(['aria-label', 'aria-labelledby'].some((a) => tablaGrilla.hasAttribute(a))).toBe(false);
    expect(tablaGrilla.querySelector('caption')).toBeNull();
  });

  it('sinPermisoLaCeldaDeAccionesQuedaVacia', async () => {
    const { elemento } = await configurar({ puedeAdministrar: false });

    const celda = filaDe(elemento, 'Juana Pérez').querySelector('.mv-grilla__celda--acciones')!;
    expect(celda.children.length).toBe(0);
    expect(celda.textContent?.trim()).toBe('');
  });

  it('cancelarElReemplazoDevuelveElFocoAEditar', async () => {
    const { fixture, elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Desactivar')!.click();
    await fixture.whenStable();
    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Cancelar')!.click();
    await fixture.whenStable();

    expect(document.activeElement?.closest('#contacto-editar-1')).toBeTruthy();
  });

  it('elFormularioDeEdicionOcupaLaFilaCompleta', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();

    const celda = elemento.querySelector('#contacto-nombre-1')!.closest('td')!;
    expect(celda.getAttribute('colspan')).toBe('5');
    expect(celda.closest('tr')?.getAttribute('role')).toBe('row');
  });

  it('marcaPrincipalEInactivoConChips', async () => {
    const { elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false, idEstado: 2 }),
      ],
    });

    expect(
      filaDe(elemento, 'Juana Pérez').querySelector('.mv-chip--info')?.textContent?.trim(),
    ).toBe('Principal');
    expect(filaDe(elemento, 'Pedro Pérez').querySelector('.mv-chip')?.textContent?.trim()).toBe(
      'Inactivo',
    );
  });

  it('mientrasCargaMuestraElEsqueleto', async () => {
    const pendiente = new Subject<RespuestaContacto[]>();
    const { fixture, elemento } = await configurar({
      contactosImpl: () => pendiente.asObservable(),
    });

    expect(elemento.querySelector('[role="status"]')?.textContent).toContain('Cargando contactos');
    expect(elemento.querySelector('.mv-esqueleto')).toBeTruthy();

    pendiente.next([contacto()]);
    await fixture.whenStable();
    expect(elemento.querySelector('.mv-esqueleto')).toBeFalsy();
    expect(elemento.textContent).toContain('Juana Pérez');
  });

  it('sinContactosMuestraElEstadoVacio', async () => {
    const { elemento } = await configurar({ contactosIniciales: [] });

    expect(elemento.querySelector('.mv-vacio')?.textContent).toContain(
      'Aún no hay contactos registrados.',
    );
  });

  it('errorAlCargarPermiteReintentar', async () => {
    let intentos = 0;
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosImpl: () =>
        ++intentos === 1
          ? throwError(
              () => new HttpErrorResponse({ status: 500, error: { detail: 'Falló la carga.' } }),
            )
          : of([contacto()]),
    });

    const aviso = elemento.querySelector('.mv-aviso--error');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.textContent).toContain('Falló la carga.');
    expect(elemento.querySelector('.mv-vacio')).toBeFalsy();

    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.contactos).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('.mv-aviso--error')).toBeFalsy();
    expect(elemento.textContent).toContain('Juana Pérez');
  });

  it('marcaAlPrincipal', async () => {
    const { elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    const filaPrincipal = filaDe(elemento, 'Juana Pérez');
    expect(filaPrincipal.textContent).toContain('Principal');
    const filaSecundaria = filaDe(elemento, 'Pedro Pérez');
    expect(filaSecundaria.textContent).not.toContain('Principal');
    expect(elemento.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe(
      'tel:+56911111111',
    );
  });

  it('desactivarPrincipalPideReemplazo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    servicioAdultos.desactivarContacto.mockReturnValue(
      of(
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: false, idEstado: 2 }),
      ),
    );

    const filaPrincipal = filaDe(elemento, 'Juana Pérez');
    botonConTexto(filaPrincipal, 'Desactivar')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.desactivarContacto).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain('Elige el nuevo contacto principal');

    // Seleccionar sola, sin confirmar, nunca llama a la API (ni con teclado/change).
    const select = filaDe(elemento, 'Juana Pérez').querySelector('select')!;
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Pedro Pérez')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioAdultos.desactivarContacto).not.toHaveBeenCalled();
    const botonConfirmar = botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Confirmar')!;
    expect(botonConfirmar.disabled).toBe(false);

    botonConfirmar.click();
    await fixture.whenStable();

    expect(servicioAdultos.desactivarContacto).toHaveBeenCalledWith(1, 1, 1, 2);
  });

  it('alAbrirElReemplazoElFocoVaAlSelect', async () => {
    const { fixture, elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Desactivar')!.click();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('reemplazo-1');
  });

  it('confirmarQuedaDeshabilitadoSinSeleccionYCancelarCierraElSelect', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Desactivar')!.click();
    await fixture.whenStable();

    const botonConfirmar = botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Confirmar')!;
    expect(botonConfirmar.disabled).toBe(true);
    botonConfirmar.click();
    await fixture.whenStable();
    expect(servicioAdultos.desactivarContacto).not.toHaveBeenCalled();

    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Cancelar')!.click();
    await fixture.whenStable();

    expect(elemento.textContent).not.toContain('Elige el nuevo contacto principal');
    expect(servicioAdultos.desactivarContacto).not.toHaveBeenCalled();
    // "Desactivar" vuelve a estar disponible: no quedó en un callejón sin salida.
    expect(botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Desactivar')).toBeTruthy();
  });

  it('reintentaElReemplazoTrasUnErrorDeLaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });
    servicioAdultos.desactivarContacto.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 500, error: { detail: 'Error del servidor.' } }),
      ),
    );

    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Desactivar')!.click();
    await fixture.whenStable();
    const select = filaDe(elemento, 'Juana Pérez').querySelector('select')!;
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Pedro Pérez')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Confirmar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Error del servidor.');
    // El select sigue abierto con la misma selección: se puede reintentar sin elegir de nuevo.
    expect(elemento.textContent).toContain('Elige el nuevo contacto principal');

    servicioAdultos.desactivarContacto.mockReturnValue(
      of(
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: false, idEstado: 2 }),
      ),
    );
    botonConTexto(filaDe(elemento, 'Juana Pérez'), 'Confirmar')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.desactivarContacto).toHaveBeenCalledTimes(2);
    expect(servicioAdultos.desactivarContacto).toHaveBeenLastCalledWith(1, 1, 1, 2);
  });

  it('hacerPrincipalRecargaYEmiteCambio', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });
    servicioAdultos.designarPrincipal.mockReturnValue(
      of(contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: true })),
    );
    let cambios = 0;
    fixture.componentInstance.cambio.subscribe(() => cambios++);
    servicioAdultos.contactos.mockClear();

    const filaSecundaria = filaDe(elemento, 'Pedro Pérez');
    botonConTexto(filaSecundaria, 'Hacer principal')!.click();
    await fixture.whenStable();

    expect(servicioAdultos.designarPrincipal).toHaveBeenCalledWith(1, 1, 2);
    expect(servicioAdultos.contactos).toHaveBeenCalledWith(1, 1);
    expect(cambios).toBe(1);
  });

  it('agregarConCamposVaciosMuestraMensajesRequeridosYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const errorNombre = elemento.querySelector('#contacto-nuevo-nombre-error');
    expect(errorNombre?.getAttribute('role')).toBe('alert');
    expect(errorNombre?.textContent).toContain('Ingresa el nombre del contacto');

    const errorTelefono = elemento.querySelector('#contacto-nuevo-telefono-error');
    expect(errorTelefono?.getAttribute('role')).toBe('alert');
    expect(errorTelefono?.textContent).toContain('Ingresa un teléfono');

    expect(servicioAdultos.crearContacto).not.toHaveBeenCalled();
  });

  it('agregarSinParentescoLoPide', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });
    escribir(elemento, '#contacto-nuevo-nombre', 'Mario Rojas');
    escribir(elemento, '#contacto-nuevo-telefono', '912345678');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#contacto-nuevo-parentesco-error');
    expect(error?.classList).toContain('mv-campo__error');
    expect(error?.textContent).toContain('Elige el parentesco');
    expect(
      elemento.querySelector('#contacto-nuevo-parentesco')?.getAttribute('aria-describedby'),
    ).toBe('contacto-nuevo-parentesco-error');
    expect(document.activeElement?.id).toBe('contacto-nuevo-parentesco');
    expect(servicioAdultos.crearContacto).not.toHaveBeenCalled();
  });

  it('elParentescoSeEligeDelCatalogo', async () => {
    const { elemento } = await configurar({ contactosIniciales: [] });

    const opciones = Array.from(
      elemento.querySelectorAll<HTMLOptionElement>('#contacto-nuevo-parentesco option'),
    ).map((opcion) => opcion.textContent?.trim());
    expect(opciones).toEqual(['Selecciona…', 'Padre', 'Hijo', 'Tío']);
    expect(elemento.querySelector('input#contacto-nuevo-parentesco')).toBeFalsy();
  });

  it('telefonoNoChilenoMuestraLaReglaSinLlamarALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });
    escribir(elemento, '#contacto-nuevo-nombre', 'Mario Rojas');
    elegir(elemento, '#contacto-nuevo-parentesco', 1);
    escribir(elemento, '#contacto-nuevo-telefono', '+54 9 11 2345 6789');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#contacto-nuevo-telefono-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Ingresa un teléfono chileno: +56 y 9 dígitos.');
    const campo = elemento.querySelector('#contacto-nuevo-telefono')!;
    expect(campo.getAttribute('inputmode')).toBe('tel');
    expect(campo.getAttribute('aria-describedby')).toBe(
      'contacto-nuevo-telefono-ayuda contacto-nuevo-telefono-error',
    );
    expect(elemento.querySelector('#contacto-nuevo-telefono-ayuda')?.textContent).toContain(
      'Ej.: +56 9 1234 5678',
    );
    expect(servicioAdultos.crearContacto).not.toHaveBeenCalled();
  });

  it('agregarEnviaElParentescoYElTelefonoNormalizado', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });
    servicioAdultos.crearContacto.mockReturnValue(of(contacto({ idContacto: 7 })));
    escribir(elemento, '#contacto-nuevo-nombre', ' Mario Rojas ');
    elegir(elemento, '#contacto-nuevo-parentesco', 3);
    escribir(elemento, '#contacto-nuevo-telefono', '9 8765-4321');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAdultos.crearContacto).toHaveBeenCalledWith(1, 1, {
      nombreContacto: 'Mario Rojas',
      idParentesco: 36,
      telefono: '+56987654321',
      esPrincipal: null,
    });
  });

  it('errorDelServidorEnElTelefonoSeMuestraEnSuCampo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });
    servicioAdultos.crearContacto.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errores: [{ campo: 'telefono', mensaje: 'Rechazado por la API.' }] },
          }),
      ),
    );
    escribir(elemento, '#contacto-nuevo-nombre', 'Mario Rojas');
    elegir(elemento, '#contacto-nuevo-parentesco', 1);
    escribir(elemento, '#contacto-nuevo-telefono', '912345678');

    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#contacto-nuevo-telefono-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Rechazado por la API.');
  });

  it('elTelefonoSeMuestraFormateadoYElEnlaceUsaElNormalizado', async () => {
    const { elemento } = await configurar({});

    const enlace = elemento.querySelector<HTMLAnchorElement>('a.telefono')!;
    expect(enlace.textContent?.trim()).toBe('+56 9 1111 1111');
    expect(enlace.getAttribute('href')).toBe('tel:+56911111111');
  });

  it('alSalirDelTelefonoNuevoLoFormatea', async () => {
    const { fixture, elemento } = await configurar({ contactosIniciales: [] });
    escribir(elemento, '#contacto-nuevo-telefono', '+56912345678');

    const campo = elemento.querySelector<HTMLInputElement>('#contacto-nuevo-telefono')!;
    campo.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(campo.value).toBe('+56 9 1234 5678');
  });

  it('contactoAntiguoMuestraSuTextoYAlEditarloHayQueElegirDelCatalogo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [contacto({ idParentesco: null, parentesco: 'Vecina' })],
    });
    servicioAdultos.actualizarContacto.mockReturnValue(of(contacto()));
    expect(filaDe(elemento, 'Juana Pérez').textContent).toContain('Vecina');

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();

    const select = elemento.querySelector<HTMLSelectElement>('#contacto-parentesco-1')!;
    expect(select.selectedIndex).toBe(0);
    expect(elemento.querySelector('#contacto-parentesco-ayuda-1')?.textContent).toContain(
      'Registrado como «Vecina». Elige uno de la lista.',
    );
    select.closest('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(elemento.querySelector('#contacto-parentesco-error-1')?.textContent).toContain(
      'Elige el parentesco',
    );
    expect(select.getAttribute('aria-describedby')).toBe(
      'contacto-parentesco-ayuda-1 contacto-parentesco-error-1',
    );
    expect(document.activeElement).toBe(select);
    expect(servicioAdultos.actualizarContacto).not.toHaveBeenCalled();

    elegir(elemento, '#contacto-parentesco-1', 1);
    select.closest('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(servicioAdultos.actualizarContacto).toHaveBeenCalledWith(1, 1, 1, {
      nombreContacto: 'Juana Pérez',
      idParentesco: 31,
      telefono: '+56911111111',
    });
  });

  it('editarEnfocaElNombreYCancelarDevuelveElFocoAEditar', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('contacto-nombre-1');
    expect(elemento.querySelector<HTMLInputElement>('#contacto-telefono-1')?.value).toBe(
      '+56 9 1111 1111',
    );

    botonConTexto(elemento, 'Cancelar')!.click();
    await fixture.whenStable();
    expect(document.activeElement?.closest('#contacto-editar-1')).toBeTruthy();
    expect(document.activeElement?.textContent?.trim()).toBe('Editar');
  });

  it('errorDeEdicionDeUnaFilaNoApareceEnElFormularioDeAgregar', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', telefono: '+56911111111' }),
      ],
    });
    servicioAdultos.actualizarContacto.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errores: [{ campo: 'telefono', mensaje: 'Ingresa un teléfono válido.' }] },
          }),
      ),
    );

    const fila = filaDe(elemento, 'Juana Pérez');
    botonConTexto(fila, 'Editar')!.click();
    await fixture.whenStable();

    const telefonoFila = elemento.querySelector<HTMLInputElement>('#contacto-telefono-1')!;
    telefonoFila.value = '+56922222222';
    telefonoFila.dispatchEvent(new Event('input'));
    telefonoFila.closest('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const errorFila = elemento.querySelector('#contacto-telefono-error-1');
    expect(errorFila?.getAttribute('role')).toBe('alert');
    expect(errorFila?.textContent).toContain('Ingresa un teléfono válido.');
    // El error de la fila nunca contamina el formulario de alta: ni su mensaje ni su aria-invalid.
    expect(elemento.querySelector('#contacto-nuevo-telefono-error')).toBeFalsy();
    expect(
      elemento.querySelector('#contacto-nuevo-telefono')?.getAttribute('aria-invalid'),
    ).toBeFalsy();
  });

  it('adultoInactivoNoPermiteAcciones', async () => {
    const { elemento } = await configurar({
      adultoActivo: false,
      puedeAdministrar: true,
      contactosIniciales: [contacto({ idContacto: 1, nombreContacto: 'Juana Pérez' })],
    });

    expect(elemento.textContent).not.toContain('Agregar contacto');
    expect(botonConTexto(elemento, 'Editar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Hacer principal')).toBeFalsy();
    expect(botonConTexto(elemento, 'Desactivar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Eliminar')).toBeFalsy();
    // La lista sigue visible: COLABORADOR/consulta siempre puede ver los contactos.
    expect(elemento.textContent).toContain('Juana Pérez');
  });
});

// jsdom no implementa `scrollIntoView`: se instala un espía por prueba.
describe('ContactosAdulto: desplazamiento y foco', () => {
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

  it('editarTraeLaFilaDeEdicionALaVistaDentroDeLaGrilla', async () => {
    const { fixture, elemento } = await configurar({});

    botonConTexto(elemento, 'Editar')!.click();
    await fixture.whenStable();

    const fila = elemento.querySelector('#contacto-nombre-1')!.closest('tr');
    expect(bloqueDe(fila)).toBe('start');
    expect(document.activeElement?.id).toBe('contacto-nombre-1');

    botonConTexto(elemento, 'Cancelar')!.click();
    await fixture.whenStable();
    expect(bloqueDe(document.activeElement)).toBe('nearest');
    expect(document.activeElement?.closest('#contacto-editar-1')).toBeTruthy();
  });

  it('eliminarLlevaElFocoALaFilaSiguienteYSinFilasAlTitulo', async () => {
    let contactos = [
      contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
      contacto({ idContacto: 2, nombreContacto: 'Pedro Soto', esPrincipal: false }),
    ];
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosImpl: () => of(contactos) });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    servicioAdultos.eliminarContacto.mockImplementation(() => {
      contactos = [contactos[1]];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, 'Más acciones para Juana Pérez', 'Eliminar');
    expect(document.activeElement).toBe(
      elemento.querySelector('#contacto-editar-2 .mv-boton-dividido__principal'),
    );

    servicioAdultos.eliminarContacto.mockImplementation(() => {
      contactos = [];
      return of(undefined);
    });
    await elegirEnMenu(fixture, elemento, 'Más acciones para Pedro Soto', 'Eliminar');
    expect(document.activeElement?.id).toBe('contactos-titulo');
    confirmar.mockRestore();
  });

  it('errorDeUnaAccionTraeElAvisoALaVista', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({
      contactosIniciales: [contacto({ esPrincipal: false })],
    });
    servicioAdultos.designarPrincipal.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Conflicto' } })),
    );

    await elegirEnMenu(fixture, elemento, 'Más acciones para Juana Pérez', 'Hacer principal');

    const aviso = elemento.querySelector('#contactos-error');
    expect(aviso?.textContent).toContain('Conflicto');
    expect(bloqueDe(aviso)).toBe('nearest');
  });
});
