import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Icono } from '../../../compartido/icono/icono';

import {
  CodigoEstadoTarea,
  ETIQUETA_ACCION,
  QuienConfirma,
  accionesDisponibles,
  requiereObservacion,
} from '../../../nucleo/tareas/estados-tarea';
import { RespuestaEstadoCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { formatearHora } from '../../../nucleo/fechas';
import { mensajeDeCampo, mensajeDeError } from '../../../nucleo/http/mensaje-de-error';
import { RespuestaTarea } from '../../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../../nucleo/tareas/servicio-tareas';

/** Límite de caracteres del motivo de cancelación. */
const LARGO_MAXIMO_MOTIVO = 200;
/** Límite de caracteres de la observación de cierre (NO_REALIZADA y el resto). */
const LARGO_MAXIMO_OBSERVACION = 1000;

/** Siguiente paso natural de una tarea: se muestra como la única acción principal. */
const ACCIONES_PRINCIPALES: CodigoEstadoTarea[] = ['EN_CURSO', 'COMPLETADA'];

/**
 * Botones de acción de una tarea de cuidado (`PENDIENTE`/`EN_CURSO` → su
 * próximo estado), compartidos por la agenda (`Tareas`) y el detalle de la
 * tarea. Las acciones permitidas se calculan con `accionesDisponibles`:
 * nunca ofrece una transición que `quien` no pueda ejecutar. Se ve una sola
 * acción principal (Iniciar si está pendiente, Completar si está en curso);
 * el resto queda en "Más acciones".
 *
 * `NO_REALIZADA` y `CANCELADA` exigen una observación: el botón
 * no llama a la API de inmediato, abre un `<textarea>` en línea con
 * "Confirmar"/"Volver" (mismo patrón que "Desactivar" un contacto principal
 * en `ContactosAdulto`), y solo "Confirmar" con texto no vacío dispara
 * `ServicioTareas.cambiarEstado`.
 */
@Component({
  selector: 'app-acciones-tarea',
  imports: [ReactiveFormsModule, Icono],
  templateUrl: './acciones-tarea.html',
  styleUrl: './acciones-tarea.scss',
})
export class AccionesTarea {
  private readonly servicioTareas = inject(ServicioTareas);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tarea = input.required<RespuestaTarea>();
  readonly idGrupo = input.required<number>();
  readonly estados = input.required<RespuestaEstadoCatalogo[]>();
  readonly quien = input.required<QuienConfirma>();
  readonly actualizada = output<RespuestaTarea>();

  protected readonly etiquetaAccion = ETIQUETA_ACCION;
  protected readonly requiereObservacion = requiereObservacion;

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Acción (`NO_REALIZADA`/`CANCELADA`) que pide observación antes de confirmar; null si ninguna. */
  protected readonly accionPidiendoObservacion = signal<CodigoEstadoTarea | null>(null);
  /** Observación/motivo de la acción en curso; validadores (`required`/`maxLength`) se fijan al abrirla. */
  protected readonly controlObservacion = this.fb.control('', Validators.required);

  /** Código de estado actual de la tarea, resuelto contra el catálogo recibido. */
  protected readonly codigoActual = computed<CodigoEstadoTarea | null>(() => {
    const idEstado = this.tarea().idEstado;
    const estado = this.estados().find((candidato) => candidato.idEstado === idEstado);
    return (estado?.codigo as CodigoEstadoTarea | undefined) ?? null;
  });

  /** Acciones que `quien` puede ejecutar sobre la tarea actual. */
  protected readonly acciones = computed<CodigoEstadoTarea[]>(() => {
    const codigo = this.codigoActual();
    if (codigo === null) return [];
    return accionesDisponibles(codigo, this.tarea(), this.quien());
  });

  /** La acción destacada: el siguiente estado natural, o la primera disponible. */
  protected readonly principal = computed<CodigoEstadoTarea | null>(() => {
    const acciones = this.acciones();
    return acciones.find((accion) => ACCIONES_PRINCIPALES.includes(accion)) ?? acciones[0] ?? null;
  });

  /** Las demás acciones, en el orden de `accionesDisponibles`. */
  protected readonly secundarias = computed(() =>
    this.acciones().filter((accion) => accion !== this.principal()),
  );

  /** Nombre accesible del botón de una acción: título y hora de la tarea ("Iniciar: Losartán, 08:00"). */
  protected ariaLabelAccion(accion: CodigoEstadoTarea): string {
    return `${this.etiquetaAccion[accion]}: ${this.descripcionTarea()}`;
  }

  /** Nombre accesible de "Más acciones", con el mismo título y hora. */
  protected ariaLabelMas(): string {
    return `Más acciones: ${this.descripcionTarea()}`;
  }

  /** Título y hora de la tarea: distingue dos tareas con el mismo título en la agenda. */
  private descripcionTarea(): string {
    const tarea = this.tarea();
    return `${tarea.titulo}, ${formatearHora(tarea.fechaHorario)}`;
  }

  protected etiquetaObservacion(accion: CodigoEstadoTarea): string {
    return accion === 'CANCELADA' ? 'Motivo' : 'Observación';
  }

  protected largoMaximoObservacion(accion: CodigoEstadoTarea): number {
    return accion === 'CANCELADA' ? LARGO_MAXIMO_MOTIVO : LARGO_MAXIMO_OBSERVACION;
  }

  /** Mensaje de "campo requerido" vía el helper compartido; solo una vez tocado el control (evita ruido). */
  protected mensajeCampoObservacion(accion: CodigoEstadoTarea): string | null {
    return mensajeDeCampo(
      this.controlObservacion,
      {},
      'observacion',
      accion === 'CANCELADA' ? 'Ingresa el motivo de la cancelación' : 'Ingresa la observación',
    );
  }

  /** Click en un botón de acción: si exige observación, abre el textarea; si no, llama a la API. */
  protected elegir(accion: CodigoEstadoTarea): void {
    this.error.set(null);
    if (requiereObservacion(accion)) {
      this.accionPidiendoObservacion.set(accion);
      this.controlObservacion.setValidators([
        Validators.required,
        Validators.maxLength(this.largoMaximoObservacion(accion)),
      ]);
      this.controlObservacion.reset('');
      return;
    }
    this.enviar(accion, null);
  }

  /** "Confirmar" del textarea de observación: nunca llama a la API con el campo inválido (vacío o muy largo). */
  protected confirmar(): void {
    const accion = this.accionPidiendoObservacion();
    if (!accion) return;

    if (this.controlObservacion.invalid) {
      this.controlObservacion.markAsTouched();
      return;
    }

    this.enviar(accion, this.controlObservacion.value.trim());
  }

  /** "Volver" del textarea de observación: descarta lo escrito y vuelve a los botones. */
  protected volver(): void {
    this.accionPidiendoObservacion.set(null);
    this.controlObservacion.reset('');
  }

  private enviar(accion: CodigoEstadoTarea, observacion: string | null): void {
    const estado = this.estados().find((candidato) => candidato.codigo === accion);
    if (!estado) {
      this.error.set('No encontramos el estado de destino en el catálogo.');
      return;
    }

    this.enviando.set(true);
    this.servicioTareas
      .cambiarEstado(this.idGrupo(), this.tarea().idTarea, { idEstado: estado.idEstado, observacion })
      .subscribe({
        next: (tarea) => {
          this.enviando.set(false);
          this.accionPidiendoObservacion.set(null);
          this.controlObservacion.reset('');
          this.actualizada.emit(tarea);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
  }
}
