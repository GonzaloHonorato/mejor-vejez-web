import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { Adultos } from './adultos';
import { RespuestaAdultoMayor, RespuestaContacto } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const ESTADOS_ADULTO: RespuestaEstadoCatalogo[] = [
  { idEstado: 1, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 2, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
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
        useValue: { estados: () => of(opciones.estados ?? ESTADOS_ADULTO) },
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
    const tarjetas = Array.from(elemento.querySelectorAll('.tarjeta-adulto'));
    expect(tarjetas).toHaveLength(2);

    expect(tarjetas[0].textContent).toContain('Rosa González');
    expect(tarjetas[0].textContent).toContain('años');
    expect(tarjetas[0].textContent).toContain('Juana Pérez');
    expect(tarjetas[0].textContent).toContain('Hija');
    expect(tarjetas[0].querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe(
      'tel:+56911111111',
    );
    expect(tarjetas[0].querySelector('a.enlace')?.getAttribute('href')).toBe('/adultos/1');
    expect(tarjetas[0].textContent).not.toContain('Inactivo');

    expect(tarjetas[1].textContent).toContain('Pedro Soto');
    expect(tarjetas[1].textContent).toContain('Inactivo');
  });

  it('colaboradorNoVeElFormulario', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'COLABORADOR') });

    expect(elemento.textContent).not.toContain('Agregar adulto mayor');
    expect(elemento.querySelector('#adulto-nombre')).toBeFalsy();
  });

  it('crearNavegaALaFicha', async () => {
    const { fixture, elemento, servicioAdultos, router } = await configurar({
      adultosIniciales: [],
    });
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    servicioAdultos.crear.mockReturnValue(of(adulto({ idAdultoMayor: 9 })));

    const campoNombre = elemento.querySelector<HTMLInputElement>('#adulto-nombre')!;
    campoNombre.value = 'Rosa González';
    campoNombre.dispatchEvent(new Event('input'));
    elemento.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(servicioAdultos.crear).toHaveBeenCalledWith(1, {
      nombreCompleto: 'Rosa González',
      codigoInterno: null,
      fechaNacimiento: null,
      notasEmergencia: null,
      observacionesGenerales: null,
    });
    expect(navegar).toHaveBeenCalledWith('/adultos/9');
  });

  it('crearConNombreVacioMuestraMensajeRequeridoYNoLlamaALaApi', async () => {
    const { fixture, elemento, servicioAdultos } = await configurar({ adultosIniciales: [] });

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

    const campoNombre = elemento.querySelector<HTMLInputElement>('#adulto-nombre')!;
    campoNombre.value = 'Rosa';
    campoNombre.dispatchEvent(new Event('input'));
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
