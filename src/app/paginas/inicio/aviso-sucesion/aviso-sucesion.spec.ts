import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AvisoSucesion } from './aviso-sucesion';
import { RespuestaGrupo } from '../../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaPropuesta } from '../../../nucleo/sucesion/modelos-sucesion';
import { ServicioSucesion } from '../../../nucleo/sucesion/servicio-sucesion';
import { ServicioYo } from '../../../nucleo/usuarios/servicio-yo';

const ID_SALIENTE = 300;
const ID_CANDIDATO = 301;

function grupo(idGrupo: number, nombreGrupo = 'Familia Rojas'): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo,
    notificaCoordinador: true,
    idEstado: 1,
    miRol: 'COLABORADOR',
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function propuesta(idGrupo: number, datos: Partial<RespuestaPropuesta> = {}): RespuestaPropuesta {
  return {
    idPropuesta: 200 + idGrupo,
    idGrupo,
    saliente: { idUsuario: ID_SALIENTE, nombre: 'Ana' },
    candidato: { idUsuario: ID_CANDIDATO, nombre: 'Beto' },
    idEstado: 170,
    codigoEstado: 'PENDIENTE',
    fechaCreacion: '2026-11-02T08:00:00-03:00',
    fechaRespuesta: null,
    fechaCancelacion: null,
    fechaCompletado: null,
    motivoCancelacion: null,
    condicionesPendientes: [],
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  idUsuario?: number;
  activaImpl?: (idGrupo: number) => Observable<RespuestaPropuesta | null>;
  aceptarImpl?: () => Observable<RespuestaPropuesta>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(150),
  );
  const servicioSucesion = {
    activa: vi.fn(opciones.activaImpl ?? ((idGrupo: number) => of(propuesta(idGrupo)))),
    aceptar: vi.fn(
      opciones.aceptarImpl ?? (() => of(propuesta(150, { idEstado: 171, codigoEstado: 'ACEPTADA' }))),
    ),
    rechazar: vi.fn(() => of(propuesta(150, { idEstado: 172, codigoEstado: 'RECHAZADA' }))),
  };

  TestBed.configureTestingModule({
    imports: [AvisoSucesion],
    providers: [
      provideRouter([]),
      { provide: ServicioSucesion, useValue: servicioSucesion },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      {
        provide: ServicioYo,
        useValue: {
          obtener: () =>
            of({
              idUsuario: opciones.idUsuario ?? ID_CANDIDATO,
              nombre: 'Beto',
              email: 'beto@correo.cl',
              telefono: null,
              esAdministrador: false,
            }),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(AvisoSucesion);
  await fixture.whenStable();
  return { fixture, activo, servicioSucesion, elemento: fixture.nativeElement as HTMLElement };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find(
    (boton) => boton.textContent?.trim() === texto,
  );
}

describe('AvisoSucesion', () => {
  it('avisoSoloParaCandidatoDePendiente', async () => {
    const { elemento, servicioSucesion } = await configurar();

    expect(servicioSucesion.activa).toHaveBeenCalledWith(150);
    expect(elemento.textContent).toContain('Ana te propone como coordinador de Familia Rojas.');
    expect(botonConTexto(elemento, 'Aceptar')).toBeTruthy();
    expect(botonConTexto(elemento, 'Rechazar')).toBeTruthy();
  });

  it('noSeMuestraSiNoEresElCandidato', async () => {
    const { elemento } = await configurar({ idUsuario: ID_SALIENTE });

    expect(elemento.querySelector('section')).toBeFalsy();
  });

  it('noSeMuestraSiLaPropuestaEstaAceptada', async () => {
    const { elemento } = await configurar({
      activaImpl: (idGrupo) => of(propuesta(idGrupo, { idEstado: 171, codigoEstado: 'ACEPTADA' })),
    });

    expect(elemento.querySelector('section')).toBeFalsy();
  });

  it('noSeMuestraSinPropuestaNiSinGrupo', async () => {
    const sinPropuesta = await configurar({ activaImpl: () => of(null) });
    expect(sinPropuesta.elemento.querySelector('section')).toBeFalsy();

    TestBed.resetTestingModule();
    const sinGrupo = await configurar({ activo: null });
    expect(sinGrupo.servicioSucesion.activa).not.toHaveBeenCalled();
    expect(sinGrupo.elemento.querySelector('section')).toBeFalsy();
  });

  it('aceptarDesdeAvisoMuestraConfirmacionYOcultaLosBotones', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar();

    botonConTexto(elemento, 'Aceptar')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.aceptar).toHaveBeenCalledWith(150, 350);
    expect(botonConTexto(elemento, 'Aceptar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Rechazar')).toBeFalsy();
    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'Aceptaste la propuesta. La transferencia se completará cuando Ana la confirme.',
    );
  });

  it('rechazarDesdeAvisoMuestraConfirmacionYOcultaLosBotones', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar();

    botonConTexto(elemento, 'Rechazar')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.rechazar).toHaveBeenCalledWith(150, 350);
    expect(botonConTexto(elemento, 'Aceptar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Rechazar')).toBeFalsy();
    expect(elemento.querySelector('[role="status"]')?.textContent).toContain(
      'Rechazaste la propuesta.',
    );
  });

  it('errorAlAceptarSeMuestraEnRoleAlert', async () => {
    const { fixture, elemento } = await configurar({
      aceptarImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'El candidato debe ser integrante activo del grupo' },
            }),
        ),
    });

    botonConTexto(elemento, 'Aceptar')!.click();
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'El candidato debe ser integrante activo del grupo',
    );
    expect(botonConTexto(elemento, 'Aceptar')).toBeTruthy();
  });

  it('cambioDeGrupoDescartaRespuestaTardia', async () => {
    const respuestas = new Map<number, Subject<RespuestaPropuesta | null>>();
    const { fixture, activo, elemento } = await configurar({
      activaImpl: (idGrupo) => {
        const sujeto = new Subject<RespuestaPropuesta | null>();
        respuestas.set(idGrupo, sujeto);
        return sujeto;
      },
    });

    activo.set(grupo(151, 'Familia Díaz'));
    await fixture.whenStable();

    // Llega tarde la respuesta del grupo anterior: no debe mostrarse.
    respuestas.get(150)!.next(propuesta(150));
    await fixture.whenStable();
    expect(elemento.querySelector('section')).toBeFalsy();

    respuestas.get(151)!.next(propuesta(151));
    await fixture.whenStable();
    expect(elemento.textContent).toContain('Ana te propone como coordinador de Familia Díaz.');
  });

  it('aceptarEnVueloSeguidoDeUnCambioDeGrupoNoMuestraConfirmacionEnElGrupoNuevo', async () => {
    const sujetoAceptar = new Subject<RespuestaPropuesta>();
    const respuestas = new Map<number, Subject<RespuestaPropuesta | null>>();
    const { fixture, activo, elemento, servicioSucesion } = await configurar({
      activaImpl: (idGrupo) => {
        const sujeto = new Subject<RespuestaPropuesta | null>();
        respuestas.set(idGrupo, sujeto);
        return sujeto;
      },
      aceptarImpl: () => sujetoAceptar,
    });

    respuestas.get(150)!.next(propuesta(150));
    await fixture.whenStable();
    expect(botonConTexto(elemento, 'Aceptar')).toBeTruthy();

    botonConTexto(elemento, 'Aceptar')!.click();
    await fixture.whenStable();
    expect(servicioSucesion.aceptar).toHaveBeenCalledWith(150, 350);

    // Cambia de grupo antes de que responda "Aceptar".
    activo.set(grupo(151, 'Familia Díaz'));
    await fixture.whenStable();
    respuestas.get(151)!.next(null);
    await fixture.whenStable();

    // Llega tarde la respuesta de "Aceptar" del grupo anterior: no debe
    // mostrarse ninguna confirmación sobre el grupo nuevo.
    sujetoAceptar.next(propuesta(150, { idEstado: 171, codigoEstado: 'ACEPTADA' }));
    await fixture.whenStable();

    expect(elemento.querySelector('[role="status"]')).toBeFalsy();
    expect(elemento.querySelector('section')).toBeFalsy();
  });
});
