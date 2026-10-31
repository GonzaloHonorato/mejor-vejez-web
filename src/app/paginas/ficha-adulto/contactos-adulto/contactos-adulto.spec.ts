import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ContactosAdulto } from './contactos-adulto';
import { RespuestaContacto } from '../../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../../nucleo/adultos/servicio-adultos';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../../nucleo/catalogos/servicio-catalogos';

const ESTADOS_CONTACTO: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

function contacto(datos: Partial<RespuestaContacto> = {}): RespuestaContacto {
  return {
    idContacto: 1,
    idAdultoMayor: 1,
    nombreContacto: 'Juana Pérez',
    parentesco: 'Hija',
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
        useValue: { estados: () => of(opciones.estados ?? ESTADOS_CONTACTO) },
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

function filaDe(elemento: HTMLElement, nombre: string): HTMLElement {
  return Array.from(elemento.querySelectorAll('.contacto')).find((fila) =>
    fila.textContent?.includes(nombre),
  ) as HTMLElement;
}

describe('ContactosAdulto', () => {
  it('cadaContactoTieneEditarYElRestoEnMasAcciones', async () => {
    const { elemento } = await configurar({
      contactosIniciales: [
        contacto({ idContacto: 1, nombreContacto: 'Juana Pérez', esPrincipal: true }),
        contacto({ idContacto: 2, nombreContacto: 'Pedro Pérez', esPrincipal: false }),
      ],
    });

    const fila = filaDe(elemento, 'Pedro Pérez');
    const acciones = fila.querySelector('.contacto__acciones')!;
    expect(acciones.querySelector(':scope > .mv-boton')?.textContent?.trim()).toBe('Editar');
    const mas = acciones.querySelector('details.mv-mas')!;
    expect(mas.querySelector('summary')?.getAttribute('aria-label')).toBe(
      'Más acciones: Pedro Pérez',
    );
    const secundarias = Array.from(mas.querySelectorAll('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(secundarias).toEqual(['Hacer principal', 'Desactivar', 'Eliminar']);
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

  it('telefonoInvalidoMuestraErrorDeCampo', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ contactosIniciales: [] });
    servicioAdultos.crearContacto.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errores: [{ campo: 'telefono', mensaje: 'Ingresa un teléfono válido.' }] },
          }),
      ),
    );

    const nombre = elemento.querySelector<HTMLInputElement>('#contacto-nuevo-nombre')!;
    nombre.value = 'Mario Rojas';
    nombre.dispatchEvent(new Event('input'));
    const telefono = elemento.querySelector<HTMLInputElement>('#contacto-nuevo-telefono')!;
    telefono.value = 'no-es-un-telefono';
    telefono.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#contacto-nuevo-telefono-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Ingresa un teléfono válido.');
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
    telefonoFila.value = 'no-es-un-telefono';
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
