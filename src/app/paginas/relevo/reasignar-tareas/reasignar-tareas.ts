import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, defer, from, map, of, tap } from 'rxjs';

import { RespuestaPersona } from '../../../nucleo/auditoria/modelos-auditoria';
import { mensajeDeError } from '../../../nucleo/http/mensaje-de-error';
import { RespuestaDetalleRelevo } from '../../../nucleo/relevos/modelos-relevos';
import { ServicioTareas } from '../../../nucleo/tareas/servicio-tareas';

/** `detail` del 422 de la reasignación cuando la tarea ya es de esa persona (`ServicioAsignacionTareas.MENSAJE_MISMO_RESPONSABLE`). */
const MENSAJE_MISMO_RESPONSABLE = 'ya está asignada a ese integrante';

/** Estados HTTP definitivos: reintentar no cambia el resultado, el botón queda deshabilitado. */
const ESTADOS_DEFINITIVOS = new Set([403, 404, 422]);

/**
 * Resultado de una fila: `enviando` (petición en curso), `ok` (reasignada),
 * `yaAsignada` (422 "mismo responsable", informativo), `error` (con
 * `definitivo` = 403/404/422).
 */
type EstadoFila =
  | { tipo: 'enviando' }
  | { tipo: 'ok' }
  | { tipo: 'yaAsignada' }
  | { tipo: 'error'; mensaje: string; definitivo: boolean };

/**
 * Tareas pendientes del relevo con la acción "Reasignar a {quien recibe}"
 * (decisión de Gonzalo 2026-10-27). El relevo sigue sin
 * modificar nada solo: cada reasignación es una acción explícita que usa
 * `ServicioTareas.asignar` (`PUT .../tareas/{id}/asignacion`) tal como
 * existe, así que la API aplica sus permisos, su auditoría
 * (`REASIGNAR_TAREA`) y sus 422.
 *
 * La página decide si se muestra (coordinador o administrador, relevo
 * COMPLETADA, con tareas). "Reasignar todas" pide confirmación en línea y
 * envía las peticiones de a una, en el orden de la lista (`concatMap`); el
 * error de una fila no detiene las demás.
 */
@Component({
  selector: 'app-reasignar-tareas',
  imports: [RouterLink],
  templateUrl: './reasignar-tareas.html',
  styleUrl: './reasignar-tareas.scss',
})
export class ReasignarTareas {
  private readonly servicioTareas = inject(ServicioTareas);
  private readonly destroyRef = inject(DestroyRef);

  readonly idGrupo = input.required<number>();
  readonly tareas = input.required<readonly RespuestaDetalleRelevo[]>();
  readonly entrante = input.required<RespuestaPersona>();
  /** "Relevo del dd-MM-yyyy HH:mm", con la fecha del relevo. */
  readonly motivo = input.required<string>();

  /** Estado por `idReferencia` (idTarea); sin entrada = todavía no se intentó. */
  protected readonly estados = signal<Readonly<Record<number, EstadoFila>>>({});
  protected readonly enLote = signal(false);
  protected readonly confirmandoTodas = signal(false);
  protected readonly resumenLote = signal<string | null>(null);

  /** Tareas a las que todavía se les puede ofrecer reasignar (sin resultado final ni error definitivo). */
  protected readonly reasignables = computed(() =>
    this.tareas().filter((tarea) => this.esReasignable(this.estados()[tarea.idReferencia])),
  );

  protected estado(idTarea: number): EstadoFila | undefined {
    return this.estados()[idTarea];
  }

  /** El botón se muestra mientras no haya un resultado final (ok o "ya asignada"). */
  protected muestraBoton(idTarea: number): boolean {
    const estado = this.estado(idTarea);
    return estado?.tipo !== 'ok' && estado?.tipo !== 'yaAsignada';
  }

  protected botonDeshabilitado(idTarea: number): boolean {
    const estado = this.estado(idTarea);
    return (
      this.enLote() ||
      estado?.tipo === 'enviando' ||
      (estado?.tipo === 'error' && estado.definitivo)
    );
  }

  protected reasignar(idTarea: number): void {
    if (this.botonDeshabilitado(idTarea)) return;
    this.resumenLote.set(null);
    this.peticion(idTarea).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected pedirReasignarTodas(): void {
    this.resumenLote.set(null);
    this.confirmandoTodas.set(true);
  }

  protected volverDeReasignarTodas(): void {
    this.confirmandoTodas.set(false);
  }

  protected confirmarReasignarTodas(): void {
    if (this.enLote()) return;
    const ids = this.reasignables().map((tarea) => tarea.idReferencia);
    this.confirmandoTodas.set(false);
    this.enLote.set(true);
    let reasignadas = 0;
    from(ids)
      .pipe(
        // De a una y en orden: la siguiente sale solo cuando respondió la anterior.
        concatMap((idTarea) => this.peticion(idTarea)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (ok) => {
          if (ok) reasignadas++;
        },
        complete: () => {
          this.enLote.set(false);
          this.resumenLote.set(`Se reasignaron ${reasignadas} de ${ids.length} tareas.`);
        },
      });
  }

  /** Una reasignación; nunca falla (el error queda en la fila). Emite `true` si quedó reasignada. */
  private peticion(idTarea: number): Observable<boolean> {
    return defer(() => {
      this.fijarEstado(idTarea, { tipo: 'enviando' });
      return this.servicioTareas.asignar(this.idGrupo(), idTarea, {
        idUsuario: this.entrante().idUsuario,
        motivo: this.motivo(),
      });
    }).pipe(
      tap(() => this.fijarEstado(idTarea, { tipo: 'ok' })),
      map(() => true),
      catchError((error: unknown) => {
        this.fijarEstado(idTarea, this.estadoDeError(error));
        return of(false);
      }),
    );
  }

  private estadoDeError(error: unknown): EstadoFila {
    const mensaje = mensajeDeError(error);
    const estadoHttp = error instanceof HttpErrorResponse ? error.status : null;
    if (estadoHttp === 422 && mensaje.includes(MENSAJE_MISMO_RESPONSABLE)) {
      return { tipo: 'yaAsignada' };
    }
    return {
      tipo: 'error',
      mensaje,
      definitivo: estadoHttp !== null && ESTADOS_DEFINITIVOS.has(estadoHttp),
    };
  }

  private esReasignable(estado: EstadoFila | undefined): boolean {
    if (!estado) return true;
    return estado.tipo === 'enviando' || (estado.tipo === 'error' && !estado.definitivo);
  }

  private fijarEstado(idTarea: number, estado: EstadoFila): void {
    this.estados.update((actuales) => ({ ...actuales, [idTarea]: estado }));
  }
}
