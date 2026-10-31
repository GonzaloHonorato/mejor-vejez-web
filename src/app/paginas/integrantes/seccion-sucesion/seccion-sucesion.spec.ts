import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SeccionSucesion } from './seccion-sucesion';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../../nucleo/catalogos/servicio-catalogos';
import { RespuestaIntegrante } from '../../../nucleo/grupos/modelos-grupos';
import { RespuestaPropuesta } from '../../../nucleo/sucesion/modelos-sucesion';
import { ServicioSucesion } from '../../../nucleo/sucesion/servicio-sucesion';
import { RespuestaTarea } from '../../../nucleo/tareas/modelos-tareas';

const ID_GRUPO = 150;
const ID_SALIENTE = 300;
const ID_CANDIDATO = 301;
const ID_OTRO = 302;
const ID_INACTIVO = 303;

const ID_PENDIENTE = 170;
const ID_ACEPTADA = 171;
const ID_RECHAZADA = 172;
const ID_CANCELADA = 173;
const ID_COMPLETADA = 174;
const ESTADOS: RespuestaEstadoCatalogo[] = [
  { idEstado: ID_PENDIENTE, codigo: 'PENDIENTE', descripcion: 'Pendiente de respuesta', orden: 1 },
  { idEstado: ID_ACEPTADA, codigo: 'ACEPTADA', descripcion: 'Aceptada por el candidato', orden: 2 },
  { idEstado: ID_RECHAZADA, codigo: 'RECHAZADA', descripcion: 'Rechazada por el candidato', orden: 3 },
  { idEstado: ID_CANCELADA, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 4 },
  { idEstado: ID_COMPLETADA, codigo: 'COMPLETADA', descripcion: 'Transferencia completada', orden: 5 },
];

function integrante(
  idUsuario: number,
  nombre: string,
  nombreRol: string,
  activo = true,
): RespuestaIntegrante {
  return {
    idIntegrante: idUsuario + 1000,
    idUsuario,
    nombre,
    email: `${nombre.toLowerCase()}@correo.cl`,
    idRol: nombreRol === 'COORDINADOR' ? 1 : 2,
    nombreRol,
    idEstado: activo ? 1 : 2,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: activo ? null : '2026-02-01T00:00:00-03:00',
  };
}

const INTEGRANTES: RespuestaIntegrante[] = [
  integrante(ID_SALIENTE, 'Ana', 'COORDINADOR'),
  integrante(ID_CANDIDATO, 'Beto', 'COLABORADOR'),
  integrante(ID_OTRO, 'Carla', 'COLABORADOR'),
  integrante(ID_INACTIVO, 'Diego', 'COLABORADOR', false),
];

function tarea(idTarea: number, titulo: string): RespuestaTarea {
  return {
    idTarea,
    tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
    idAdultoMayor: 5,
    nombreAdulto: 'Rosa González',
    idDetallePlan: null,
    titulo,
    descripcion: null,
    fechaHorario: '2026-11-03T10:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 1,
    atrasada: false,
    responsable: { idUsuario: ID_SALIENTE, nombre: 'Ana' },
    observacionCierre: null,
    nombreConfirmador: null,
    fechaConfirmacion: null,
    motivoCancelacion: null,
    compra: [],
    cita: null,
  };
}

function propuesta(datos: Partial<RespuestaPropuesta> = {}): RespuestaPropuesta {
  return {
    idPropuesta: 200,
    idGrupo: ID_GRUPO,
    saliente: { idUsuario: ID_SALIENTE, nombre: 'Ana' },
    candidato: { idUsuario: ID_CANDIDATO, nombre: 'Beto' },
    idEstado: ID_PENDIENTE,
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

function aceptada(datos: Partial<RespuestaPropuesta> = {}): RespuestaPropuesta {
  return propuesta({
    idEstado: ID_ACEPTADA,
    codigoEstado: 'ACEPTADA',
    fechaRespuesta: '2026-11-02T09:00:00-03:00',
    ...datos,
  });
}

interface Opciones {
  activa?: RespuestaPropuesta | null;
  historial?: RespuestaPropuesta[];
  idUsuarioActual?: number | null;
  soyCoordinador?: boolean;
  esAdministrador?: boolean;
  completarImpl?: () => Observable<RespuestaPropuesta>;
}

async function configurar(opciones: Opciones = {}) {
  const servicioSucesion = {
    activa: vi.fn(() => of(opciones.activa !== undefined ? opciones.activa : null)),
    historial: vi.fn(() => of(opciones.historial ?? [])),
    proponer: vi.fn(() => of(propuesta())),
    aceptar: vi.fn(() => of(aceptada())),
    rechazar: vi.fn(() => of(propuesta({ idEstado: ID_RECHAZADA, codigoEstado: 'RECHAZADA' }))),
    cancelar: vi.fn(() => of(propuesta({ idEstado: ID_CANCELADA, codigoEstado: 'CANCELADA' }))),
    completar: vi.fn(
      opciones.completarImpl ??
        (() => of(propuesta({ idEstado: ID_COMPLETADA, codigoEstado: 'COMPLETADA' }))),
    ),
    obtener: vi.fn(),
  };
  const servicioCatalogos = { estados: vi.fn(() => of(ESTADOS)) };

  TestBed.configureTestingModule({
    imports: [SeccionSucesion],
    providers: [
      { provide: ServicioSucesion, useValue: servicioSucesion },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
    ],
  });

  const fixture = TestBed.createComponent(SeccionSucesion);
  fixture.componentRef.setInput('idGrupo', ID_GRUPO);
  fixture.componentRef.setInput('integrantes', INTEGRANTES);
  fixture.componentRef.setInput(
    'idUsuarioActual',
    opciones.idUsuarioActual !== undefined ? opciones.idUsuarioActual : ID_SALIENTE,
  );
  fixture.componentRef.setInput('soyCoordinador', opciones.soyCoordinador ?? true);
  fixture.componentRef.setInput('esAdministrador', opciones.esAdministrador ?? false);
  let cambios = 0;
  fixture.componentInstance.cambio.subscribe(() => cambios++);
  await fixture.whenStable();
  return {
    fixture,
    servicioSucesion,
    servicioCatalogos,
    elemento: fixture.nativeElement as HTMLElement,
    cambios: () => cambios,
  };
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find(
    (boton) => boton.textContent?.trim() === texto,
  );
}

describe('SeccionSucesion', () => {
  it('coordinadorSinPropuestaVeSelectorSoloConActivosNoCoordinadores', async () => {
    const { elemento, servicioSucesion, servicioCatalogos } = await configurar();

    expect(servicioSucesion.activa).toHaveBeenCalledWith(ID_GRUPO);
    expect(servicioCatalogos.estados).toHaveBeenCalledWith('PROPUESTA_SUCESION', 'ESTADO');
    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-candidato')!;
    expect(selector).toBeTruthy();
    const opciones = Array.from(selector.options).map((opcion) => opcion.textContent?.trim());
    expect(opciones).toEqual(['Selecciona…', 'Beto', 'Carla']);
    const proponer = botonConTexto(elemento, 'Proponer sucesor')!;
    expect(proponer).toBeTruthy();
    expect(proponer.disabled).toBe(true);
  });

  it('colaboradorSinPropuestaNoVeElSelector', async () => {
    const { elemento } = await configurar({ idUsuarioActual: ID_OTRO, soyCoordinador: false });

    expect(elemento.querySelector('#sucesion-candidato')).toBeFalsy();
    expect(botonConTexto(elemento, 'Proponer sucesor')).toBeFalsy();
  });

  it('proponerLlamaAlServicioYMuestraPendiente', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar();
    servicioSucesion.activa.mockReturnValue(of(propuesta()));

    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-candidato')!;
    selector.value = selector.options[1].value;
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    botonConTexto(elemento, 'Proponer sucesor')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.proponer).toHaveBeenCalledWith(ID_GRUPO, ID_CANDIDATO);
    expect(elemento.textContent).toContain('Esperando la respuesta de Beto');
    expect(elemento.querySelector('#sucesion-candidato')).toBeFalsy();
  });

  it('pendienteMuestraEsperandoYCancelarAlSaliente', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar({ activa: propuesta() });

    expect(elemento.textContent).toContain('Esperando la respuesta de Beto');
    expect(botonConTexto(elemento, 'Aceptar')).toBeFalsy();
    expect(botonConTexto(elemento, 'Rechazar')).toBeFalsy();

    // Paso de confirmación inline: el primer clic no llama a la API.
    botonConTexto(elemento, 'Cancelar propuesta')!.click();
    await fixture.whenStable();
    expect(servicioSucesion.cancelar).not.toHaveBeenCalled();

    const motivo = elemento.querySelector<HTMLTextAreaElement>('#sucesion-motivo')!;
    motivo.value = '  Ya no es necesario  ';
    motivo.dispatchEvent(new Event('input'));
    botonConTexto(elemento, 'Confirmar cancelación')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.cancelar).toHaveBeenCalledWith(ID_GRUPO, 200, 'Ya no es necesario');
  });

  it('cancelarSinMotivoEnviaNuloYVolverNoCancela', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar({
      activa: propuesta(),
      idUsuarioActual: 999,
      soyCoordinador: false,
      esAdministrador: true,
    });

    botonConTexto(elemento, 'Cancelar propuesta')!.click();
    await fixture.whenStable();
    botonConTexto(elemento, 'Volver')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector('#sucesion-motivo')).toBeFalsy();
    expect(servicioSucesion.cancelar).not.toHaveBeenCalled();

    botonConTexto(elemento, 'Cancelar propuesta')!.click();
    await fixture.whenStable();
    botonConTexto(elemento, 'Confirmar cancelación')!.click();
    await fixture.whenStable();
    expect(servicioSucesion.cancelar).toHaveBeenCalledWith(ID_GRUPO, 200, null);
  });

  it('otroIntegranteNoVeCancelarNiResponder', async () => {
    const { elemento } = await configurar({
      activa: propuesta(),
      idUsuarioActual: ID_OTRO,
      soyCoordinador: false,
    });

    expect(elemento.textContent).toContain('Esperando la respuesta de Beto');
    expect(botonConTexto(elemento, 'Cancelar propuesta')).toBeFalsy();
    expect(botonConTexto(elemento, 'Aceptar')).toBeFalsy();
  });

  it('candidatoVeAceptarYRechazar', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar({
      activa: propuesta(),
      idUsuarioActual: ID_CANDIDATO,
      soyCoordinador: false,
    });

    expect(botonConTexto(elemento, 'Cancelar propuesta')).toBeFalsy();
    botonConTexto(elemento, 'Aceptar')!.click();
    await fixture.whenStable();
    expect(servicioSucesion.aceptar).toHaveBeenCalledWith(ID_GRUPO, 200);

    servicioSucesion.activa.mockReturnValue(of(propuesta()));
    // Recarga tras la acción: sigue PENDIENTE en este doble, así que se puede rechazar.
    await fixture.whenStable();
    botonConTexto(elemento, 'Rechazar')!.click();
    await fixture.whenStable();
    expect(servicioSucesion.rechazar).toHaveBeenCalledWith(ID_GRUPO, 200);
  });

  it('aceptadaMuestraCondicionesConSelectorPorTareaPorOmisionCandidato', async () => {
    const { elemento } = await configurar({
      activa: aceptada({ condicionesPendientes: [tarea(401, 'Comprar Losartán'), tarea(402, 'Control')] }),
    });

    expect(elemento.textContent).toContain('Condiciones pendientes');
    expect(elemento.textContent).toContain('Comprar Losartán');
    expect(elemento.textContent).toContain('3 nov 2026 · 10:00');
    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-401')!;
    const opciones = Array.from(selector.options).map((opcion) => opcion.textContent?.trim());
    // Integrantes ACTIVO menos el saliente.
    expect(opciones).toEqual(['Selecciona…', 'Beto', 'Carla']);
    expect(selector.options[selector.selectedIndex].textContent?.trim()).toBe('Beto');
    expect(elemento.querySelector('#sucesion-destino-402')).toBeTruthy();
    expect(botonConTexto(elemento, 'Completar transferencia')!.disabled).toBe(false);
    expect(botonConTexto(elemento, 'Cancelar propuesta')).toBeTruthy();
  });

  it('completarSinDestinoQuedaDeshabilitado', async () => {
    const { fixture, elemento } = await configurar({
      activa: aceptada({ condicionesPendientes: [tarea(401, 'Comprar Losartán')] }),
    });

    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-401')!;
    selector.value = selector.options[0].value;
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(botonConTexto(elemento, 'Completar transferencia')!.disabled).toBe(true);
  });

  it('completarEnviaTodasLasReasignaciones', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar({
      activa: aceptada({ condicionesPendientes: [tarea(401, 'Comprar Losartán'), tarea(402, 'Control')] }),
    });

    const selector = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-402')!;
    selector.value = selector.options[2].value;
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    botonConTexto(elemento, 'Completar transferencia')!.click();
    await fixture.whenStable();

    expect(servicioSucesion.completar).toHaveBeenCalledWith(ID_GRUPO, 200, [
      { idTarea: 401, idUsuario: ID_CANDIDATO },
      { idTarea: 402, idUsuario: ID_OTRO },
    ]);
  });

  it('sinCondicionesMuestraTextoYPermiteCompletar', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar({ activa: aceptada() });

    expect(elemento.textContent).toContain(
      'No quedan tareas por resolver. Puedes completar la transferencia.',
    );
    const completar = botonConTexto(elemento, 'Completar transferencia')!;
    expect(completar.disabled).toBe(false);
    completar.click();
    await fixture.whenStable();

    expect(servicioSucesion.completar).toHaveBeenCalledWith(ID_GRUPO, 200, []);
  });

  it('candidatoEnAceptadaNoVeCompletar', async () => {
    const { elemento } = await configurar({
      activa: aceptada({ condicionesPendientes: [tarea(401, 'Comprar Losartán')] }),
      idUsuarioActual: ID_CANDIDATO,
      soyCoordinador: false,
    });

    expect(elemento.textContent).toContain('Comprar Losartán');
    expect(elemento.querySelector('#sucesion-destino-401')).toBeFalsy();
    expect(botonConTexto(elemento, 'Completar transferencia')).toBeFalsy();
  });

  it('errorDeCompletarSeMuestraEnRoleAlert', async () => {
    const { fixture, elemento } = await configurar({
      activa: aceptada(),
      completarImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'Quedan 1 tareas por resolver o reasignar' },
            }),
        ),
    });

    botonConTexto(elemento, 'Completar transferencia')!.click();
    await fixture.whenStable();

    const alerta = elemento.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Quedan 1 tareas por resolver o reasignar');
  });

  it('estadoConDescripcionDelCatalogo', async () => {
    const { elemento } = await configurar({ activa: propuesta() });

    expect(elemento.textContent).toContain('Pendiente de respuesta');
    expect(elemento.textContent).not.toContain('PENDIENTE');
  });

  it('historialMuestraPropuestasCerradas', async () => {
    const { elemento } = await configurar({
      historial: [
        propuesta({
          idPropuesta: 201,
          idEstado: ID_COMPLETADA,
          codigoEstado: 'COMPLETADA',
          fechaRespuesta: '2026-10-01T09:00:00-03:00',
          fechaCompletado: '2026-10-02T11:30:00-03:00',
        }),
        propuesta({
          idPropuesta: 202,
          candidato: { idUsuario: ID_OTRO, nombre: 'Carla' },
          idEstado: ID_CANCELADA,
          codigoEstado: 'CANCELADA',
          fechaCancelacion: '2026-09-15T12:00:00-03:00',
        }),
      ],
    });

    const historial = elemento.querySelector('#sucesion-historial')!;
    expect(historial.textContent).toContain('Historial de propuestas');
    const filas = Array.from(historial.querySelectorAll('li'));
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Beto');
    expect(filas[0].textContent).toContain('Transferencia completada');
    expect(filas[0].textContent).toContain('2 oct 2026 · 11:30');
    expect(filas[0].textContent).not.toContain('→');
    expect(filas[0].querySelector('app-icono')?.getAttribute('aria-hidden')).toBe('true');
    expect(filas[0].querySelector('.oculto')?.textContent).toContain('propuso a');
    expect(filas[0].querySelector('.mv-chip')?.textContent).toContain('Transferencia completada');
    expect(filas[1].textContent).toContain('Carla');
    expect(filas[1].textContent).toContain('Cancelada');
    expect(filas[1].textContent).toContain('15 sep 2026 · 12:00');
    expect(historial.textContent).not.toContain('COMPLETADA');
  });

  it('cambioEmiteParaRecargarIntegrantes', async () => {
    const { fixture, servicioSucesion, elemento, cambios } = await configurar({ activa: aceptada() });
    const llamadasAntes = servicioSucesion.activa.mock.calls.length;
    servicioSucesion.activa.mockReturnValue(of(null));

    botonConTexto(elemento, 'Completar transferencia')!.click();
    await fixture.whenStable();

    expect(cambios()).toBe(1);
    expect(servicioSucesion.activa.mock.calls.length).toBe(llamadasAntes + 1);
    expect(servicioSucesion.historial).toHaveBeenCalledTimes(2);
  });

  it('errorAlEjecutarAccionTambienEmiteCambioYRecargaIntegrantes', async () => {
    const { fixture, elemento, servicioSucesion, cambios } = await configurar({
      activa: aceptada(),
      completarImpl: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'Quedan 1 tareas por resolver o reasignar' },
            }),
        ),
    });
    const llamadasActivaAntes = servicioSucesion.activa.mock.calls.length;

    botonConTexto(elemento, 'Completar transferencia')!.click();
    await fixture.whenStable();

    // Un 422 (la membresía pudo cambiar) también recarga y avisa a la página.
    expect(cambios()).toBe(1);
    expect(servicioSucesion.activa.mock.calls.length).toBe(llamadasActivaAntes + 1);
  });

  it('recargaConservaDestinosYaElegidosMientrasLaTareaSigaEnLasCondiciones', async () => {
    const { fixture, elemento } = await configurar({
      activa: aceptada({ condicionesPendientes: [tarea(401, 'Comprar Losartán'), tarea(402, 'Control')] }),
      completarImpl: () =>
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { detail: 'Quedan tareas' } }),
        ),
    });

    const selector401 = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-401')!;
    // Elige a Carla en vez del candidato (Beto), que es el destino por omisión.
    selector401.value = selector401.options[2].value;
    selector401.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    // El 422 recarga con la misma propuesta (mismas condiciones pendientes).
    botonConTexto(elemento, 'Completar transferencia')!.click();
    await fixture.whenStable();

    const destino401 = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-401')!;
    expect(destino401.options[destino401.selectedIndex].textContent?.trim()).toBe('Carla');
    const destino402 = elemento.querySelector<HTMLSelectElement>('#sucesion-destino-402')!;
    expect(destino402.options[destino402.selectedIndex].textContent?.trim()).toBe('Beto');
  });

  it('procesandoSigueActivoHastaQueTerminaLaRecargaCerrandoLaVentanaDeDobleEnvio', async () => {
    const sujetoActiva = new Subject<RespuestaPropuesta | null>();
    const { fixture, elemento, servicioSucesion } = await configurar({ activa: aceptada() });
    servicioSucesion.activa.mockReturnValue(sujetoActiva.asObservable());

    const completar = botonConTexto(elemento, 'Completar transferencia')!;
    completar.click();
    await fixture.whenStable();

    // La acción ya respondió con éxito, pero la recarga todavía no: sigue
    // deshabilitado (si no, un segundo clic dispararía la acción otra vez
    // sobre datos todavía viejos).
    expect(completar.disabled).toBe(true);
    expect(servicioSucesion.completar).toHaveBeenCalledTimes(1);

    sujetoActiva.next(aceptada());
    sujetoActiva.complete();
    await fixture.whenStable();

    expect(completar.disabled).toBe(false);
  });

  it('errorAlCargarSeMuestraConReintentar', async () => {
    const { fixture, elemento, servicioSucesion } = await configurar();
    servicioSucesion.activa.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    fixture.componentRef.setInput('idGrupo', ID_GRUPO + 1);
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos conectar con el servidor.',
    );
    servicioSucesion.activa.mockReturnValue(of(null));
    botonConTexto(elemento, 'Reintentar')!.click();
    await fixture.whenStable();
    expect(elemento.querySelector('#sucesion-candidato')).toBeTruthy();
  });
});
