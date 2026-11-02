import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccionesTarea } from './acciones-tarea';
import { RespuestaEstadoCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { QuienConfirma } from '../../../nucleo/tareas/estados-tarea';
import { RespuestaTarea } from '../../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../../nucleo/tareas/servicio-tareas';

const ESTADOS_TAREA: RespuestaEstadoCatalogo[] = [
  { idEstado: 10, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1 },
  { idEstado: 11, codigo: 'EN_CURSO', descripcion: 'En curso', orden: 2 },
  { idEstado: 12, codigo: 'COMPLETADA', descripcion: 'Completada', orden: 3 },
  { idEstado: 13, codigo: 'NO_REALIZADA', descripcion: 'No realizada', orden: 4 },
  { idEstado: 14, codigo: 'CANCELADA', descripcion: 'Cancelada', orden: 5 },
];

function tarea(datos: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 1,
    tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    idDetallePlan: null,
    titulo: 'Comprar Losartán',
    descripcion: null,
    fechaHorario: '2026-11-02T08:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 10,
    atrasada: false,
    responsable: null,
    observacionCierre: null,
    nombreConfirmador: null,
    fechaConfirmacion: null,
    motivoCancelacion: null,
    compra: [],
    cita: null,
    ...datos,
  };
}

const QUIEN_COORDINADOR: QuienConfirma = { idUsuario: 200, miRol: 'COORDINADOR', esAdministrador: false };

interface Opciones {
  tarea?: RespuestaTarea;
  quien?: QuienConfirma;
  estados?: RespuestaEstadoCatalogo[];
  cambiarEstadoImpl?: ReturnType<typeof vi.fn>;
}

async function configurar(opciones: Opciones = {}) {
  const servicioTareas = {
    cambiarEstado: opciones.cambiarEstadoImpl ?? vi.fn(() => of(tarea({ idEstado: 12 }))),
  };
  TestBed.configureTestingModule({
    imports: [AccionesTarea],
    providers: [{ provide: ServicioTareas, useValue: servicioTareas }],
  });
  const fixture = TestBed.createComponent(AccionesTarea);
  fixture.componentRef.setInput('tarea', opciones.tarea ?? tarea());
  fixture.componentRef.setInput('idGrupo', 1);
  fixture.componentRef.setInput('estados', opciones.estados ?? ESTADOS_TAREA);
  fixture.componentRef.setInput('quien', opciones.quien ?? QUIEN_COORDINADOR);
  await fixture.whenStable();
  return {
    fixture,
    servicioTareas,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

function principal(elemento: HTMLElement): HTMLButtonElement | null {
  return elemento.querySelector<HTMLButtonElement>('.mv-boton-dividido__principal');
}

function segmento(elemento: HTMLElement): HTMLButtonElement | null {
  return elemento.querySelector<HTMLButtonElement>('.mv-boton-dividido__segmento');
}

function itemsMenu(elemento: HTMLElement): HTMLButtonElement[] {
  return Array.from(elemento.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((boton) =>
    boton.textContent?.trim() === texto,
  );
}

describe('AccionesTarea', () => {
  it('completarLlamaCambiarEstadoConElIdEstadoDeCompletadaYEmiteActualizada', async () => {
    const tareaCompletada = tarea({ idEstado: 12 });
    const { fixture, elemento, servicioTareas } = await configurar({
      cambiarEstadoImpl: vi.fn(() => of(tareaCompletada)),
    });
    const emitidas: RespuestaTarea[] = [];
    fixture.componentInstance.actualizada.subscribe((valor) => emitidas.push(valor));

    const boton = botonConTexto(elemento, 'Completar')!;
    expect(boton.getAttribute('role')).toBe('menuitem');
    expect(principal(elemento)?.getAttribute('aria-label')).toBe('Iniciar: Comprar Losartán, Rosa González, 08:00');
    boton.click();
    await fixture.whenStable();

    expect(servicioTareas.cambiarEstado).toHaveBeenCalledWith(1, 1, { idEstado: 12, observacion: null });
    expect(emitidas).toEqual([tareaCompletada]);
  });

  it('noRealizadaExigeObservacionAntesDeLlamarALaApi', async () => {
    const { fixture, elemento, servicioTareas } = await configurar();

    const boton = botonConTexto(elemento, 'No realizada')!;
    boton.click();
    await fixture.whenStable();

    // Sin texto: "Confirmar" no debe llamar a la API, y debe mostrarse el aviso requerido.
    const confirmar = botonConTexto(elemento, 'Confirmar')!;
    confirmar.click();
    await fixture.whenStable();

    expect(servicioTareas.cambiarEstado).not.toHaveBeenCalled();
    const aviso = elemento.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('observación');

    const textarea = elemento.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'No había stock del medicamento';
    textarea.dispatchEvent(new Event('input'));
    confirmar.click();
    await fixture.whenStable();

    expect(servicioTareas.cambiarEstado).toHaveBeenCalledWith(1, 1, {
      idEstado: 13,
      observacion: 'No había stock del medicamento',
    });
  });

  it('un422SeMuestraEnRoleAlert', async () => {
    const { fixture, elemento, servicioTareas } = await configurar({
      cambiarEstadoImpl: vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'La tarea ya no está pendiente' },
            }),
        ),
      ),
    });

    const boton = botonConTexto(elemento, 'Completar')!;
    boton.click();
    await fixture.whenStable();

    expect(servicioTareas.cambiarEstado).toHaveBeenCalled();
    const aviso = elemento.querySelector('[role="alert"]');
    expect(aviso?.textContent).toContain('La tarea ya no está pendiente');
  });

  it('volverDescartaLaObservacionYVuelveALosBotones', async () => {
    const { fixture, elemento } = await configurar();

    const boton = botonConTexto(elemento, 'No realizada')!;
    boton.click();
    await fixture.whenStable();

    const textarea = elemento.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'Texto que se descarta';
    textarea.dispatchEvent(new Event('input'));

    const volver = botonConTexto(elemento, 'Volver')!;
    volver.click();
    await fixture.whenStable();

    expect(elemento.querySelector('textarea')).toBeNull();
    expect(botonConTexto(elemento, 'No realizada')).toBeDefined();
    expect(document.activeElement).toBe(segmento(elemento));
  });

  it('cancelarMuestraMotivoEnVezDeObservacionConMaximoDe200', async () => {
    const { fixture, elemento } = await configurar();

    const boton = botonConTexto(elemento, 'Cancelar')!;
    boton.click();
    await fixture.whenStable();

    expect(elemento.textContent).toContain('Motivo');
    const textarea = elemento.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.maxLength).toBe(200);
  });

  it('sinAccionesDisponiblesNoMuestraNingunBoton', async () => {
    const { elemento } = await configurar({
      tarea: tarea({ idEstado: 12 }), // COMPLETADA es final: sin transiciones.
    });

    expect(elemento.querySelectorAll('button').length).toBe(0);
  });

  it('pendienteMuestraIniciarComoAccionPrincipalYElRestoEnElMenuDelBotonCombinado', async () => {
    const { elemento } = await configurar();

    expect(elemento.querySelectorAll('app-boton-dividido')).toHaveLength(1);
    expect(principal(elemento)?.textContent?.trim()).toBe('Iniciar');
    expect(principal(elemento)?.getAttribute('aria-label')).toBe('Iniciar: Comprar Losartán, Rosa González, 08:00');
    expect(segmento(elemento)?.getAttribute('aria-label')).toBe(
      'Más acciones para Comprar Losartán, Rosa González, 08:00',
    );
    expect(segmento(elemento)?.getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector('details')).toBeNull();
    // El contexto ya va en los nombres del principal y del segmento: sin grupo que lo repita.
    expect(elemento.querySelector('[role="group"]')).toBeNull();

    const items = itemsMenu(elemento);
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Completar', 'No realizada', 'Cancelar']);
    expect(items.map((item) => item.classList.contains('mv-menu__item--peligro'))).toEqual([false, false, true]);
  });

  it('laAccionPrincipalLlamaCambiarEstadoConElSiguienteEstado', async () => {
    const { fixture, elemento, servicioTareas } = await configurar();

    principal(elemento)!.click();
    await fixture.whenStable();

    expect(servicioTareas.cambiarEstado).toHaveBeenCalledWith(1, 1, { idEstado: 11, observacion: null });
  });

  it('elegirNoRealizadaDelMenuLlevaElFocoAlCampoDeObservacion', async () => {
    const { fixture, elemento } = await configurar();

    segmento(elemento)!.click();
    await fixture.whenStable();
    botonConTexto(elemento, 'No realizada')!.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(elemento.querySelector('textarea'));
  });

  it('enCursoMuestraCompletarComoPrincipalYNoRealizadaEnElMenu', async () => {
    const { elemento } = await configurar({ tarea: tarea({ idEstado: 11 }) });

    expect(principal(elemento)?.textContent?.trim()).toBe('Completar');
    expect(itemsMenu(elemento).map((item) => item.textContent?.trim())).toEqual(['No realizada']);
  });

  it('colaboradorNoAsignadoNoVeNingunaAccion', async () => {
    const { elemento } = await configurar({
      tarea: tarea({ responsable: { idUsuario: 999, nombre: 'Otra persona' } }),
      quien: { idUsuario: 200, miRol: 'COLABORADOR', esAdministrador: false },
    });

    expect(elemento.querySelectorAll('button').length).toBe(0);
    expect(elemento.querySelector('app-boton-dividido')).toBeNull();
  });

  it('colaboradorSinAsignacionPuedeConfirmarPeroNoCancelar', async () => {
    const { elemento } = await configurar({
      quien: { idUsuario: 200, miRol: 'COLABORADOR', esAdministrador: false },
    });

    expect(principal(elemento)?.textContent?.trim()).toBe('Iniciar');
    expect(itemsMenu(elemento).map((item) => item.textContent?.trim())).toEqual(['Completar', 'No realizada']);
  });
});
