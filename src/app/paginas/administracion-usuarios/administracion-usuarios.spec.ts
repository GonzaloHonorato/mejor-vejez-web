import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

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
  overrides: { listar?: ReturnType<typeof vi.fn>; estados?: ReturnType<typeof vi.fn> } = {},
) {
  const servicioUsuarios = {
    listar: overrides.listar ?? vi.fn(() => of(pagina(usuariosIniciales))),
    obtener: vi.fn(),
    actualizar: vi.fn(),
    cambiarEstado: vi.fn(),
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

describe('AdministracionUsuarios', () => {
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

    const select = elemento.querySelector<HTMLSelectElement>('#usuario-estado-1')!;
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Inactivo')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(servicioUsuarios.cambiarEstado).toHaveBeenCalledWith(1, 2);
    expect(servicioUsuarios.listar).toHaveBeenCalledTimes(2);
  });

  it('selectDeEstadoMuestraElEstadoReal', async () => {
    const { elemento } = await configurar([usuario(1, 'Ana', false, 2)]);

    const select = elemento.querySelector<HTMLSelectElement>('#usuario-estado-1')!;
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Inactivo');
  });

  it('cambiarEstadoConFallaRevierteElSelectAlValorReal', async () => {
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

    const select = elemento.querySelector<HTMLSelectElement>('#usuario-estado-1')!;
    const opciones = Array.from(select.querySelectorAll('option'));
    select.value = opciones.find((o) => o.textContent?.trim() === 'Inactivo')!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Activo');
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

    elemento.querySelector<HTMLButtonElement>('.usuario__editar')!.click();
    await fixture.whenStable();

    const checkbox = elemento.querySelector<HTMLInputElement>('#usuario-administrador')!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    elemento.querySelector<HTMLFormElement>('.tarjeta form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No puedes quitar al último administrador',
    );
  });

  it('formularioInvalidoAlGuardarMarcaCamposTocadosYMuestraError', async () => {
    const { fixture, elemento, servicioUsuarios } = await configurar([usuario(1, 'Ana', true, 1)]);

    elemento.querySelector<HTMLButtonElement>('.usuario__editar')!.click();
    await fixture.whenStable();

    escribir(elemento.querySelector<HTMLInputElement>('#usuario-nombre')!, '');
    elemento.querySelector<HTMLFormElement>('.tarjeta form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const error = elemento.querySelector('#usuario-nombre-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('obligatorio');
    expect(elemento.querySelector('#usuario-nombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(servicioUsuarios.actualizar).not.toHaveBeenCalled();
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
});
