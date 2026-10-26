import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaGrupo, RespuestaIntegrante, RespuestaRol } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Como `Validators.email`, pero ignora espacios al inicio/fin: sin esto, un
 * correo con espacios pegados (típico al copiar/pegar) queda inválido sin
 * mensaje visible (ver corrección final I2b).
 */
function validarCorreoConEspacios(control: AbstractControl<string>): ValidationErrors | null {
  return Validators.email({ value: control.value.trim() } as AbstractControl);
}

/**
 * Página "Integrantes" (`/grupos/:idGrupo`): lista de integrantes del grupo
 * y, si quien mira es COORDINADOR o admin, las acciones de administración
 * (agregar, cambiar rol, desactivar/reactivar, eliminar). Cualquier
 * integrante activo puede salir del grupo.
 */
@Component({
  selector: 'app-integrantes',
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe],
  templateUrl: './integrantes.html',
  styleUrl: './integrantes.scss',
})
export class Integrantes implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly grupoActivo = inject(ServicioGrupoActivo);

  private readonly idGrupo = Number(this.ruta.snapshot.paramMap.get('idGrupo'));

  protected readonly grupo = signal<RespuestaGrupo | null>(null);
  /** Falso mientras no sepamos si la carga del grupo fue exitosa: sin esto no mostramos acciones. */
  protected readonly grupoCargado = signal(false);
  protected readonly integrantes = signal<RespuestaIntegrante[]>([]);
  protected readonly roles = signal<RespuestaRol[]>([]);
  protected readonly esAdministrador = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly agregando = signal(false);
  /** Interruptor "Notificar las alertas al coordinador" (regla 7 del plan). */
  protected readonly cambiandoNotificaCoordinador = signal(false);

  /** Activos primero; estable dentro de cada grupo (JS garantiza sort estable). */
  protected readonly integrantesOrdenados = computed<RespuestaIntegrante[]>(() =>
    [...this.integrantes()].sort(
      (a, b) => Number(!this.estaActivo(a)) - Number(!this.estaActivo(b)),
    ),
  );

  /** Sin grupo cargado no hay acciones posibles, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(
    () => this.grupoCargado() && (this.grupo()?.miRol === 'COORDINADOR' || this.esAdministrador()),
  );

  /** Puede salir del grupo: tiene un rol asignado (membresía activa). */
  protected readonly esMiembroActivo = computed(
    () => this.grupoCargado() && this.grupo()?.miRol != null,
  );

  private readonly fb = inject(NonNullableFormBuilder);

  /**
   * Un `FormControl` por fila para el select de rol: a diferencia de
   * `[value]`/`[selected]`, `writeValue` de `SelectControlValueAccessor`
   * reaplica el valor real al <select> en cada carga (incluida la
   * reversión tras un 422), sin depender de la memoización de bindings
   * de Angular.
   */
  private readonly controlesRol = new Map<number, FormControl<number>>();

  protected controlRol(integrante: RespuestaIntegrante): FormControl<number> {
    let control = this.controlesRol.get(integrante.idIntegrante);
    if (!control) {
      control = this.fb.control(integrante.idRol);
      this.controlesRol.set(integrante.idIntegrante, control);
    }
    return control;
  }

  protected readonly formulario = this.fb.group({
    email: ['', [Validators.required, validarCorreoConEspacios]],
    // null hasta elegir/recibir un rol real: con Validators.required, 0 no sería válido
    // igual (no hay rol con idRol 0), pero null deja la intención explícita.
    idRol: this.fb.control<number | null>(null, Validators.required),
  });

  ngOnInit(): void {
    this.servicioGrupos.obtener(this.idGrupo).subscribe({
      next: (grupo) => {
        this.grupo.set(grupo);
        this.grupoCargado.set(true);
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
    this.cargarIntegrantes();
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
    this.servicioGrupos.roles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        if (roles.length > 0) {
          this.formulario.patchValue({ idRol: roles[0].idRol });
        }
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected estaActivo(integrante: RespuestaIntegrante): boolean {
    return integrante.fechaDesactivacion === null;
  }

  protected agregar(): void {
    if (this.agregando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error.set(null);
    const { email, idRol } = this.formulario.getRawValue();
    // El formulario es inválido (y agregar() retorna antes) mientras idRol sea null.
    this.agregando.set(true);
    this.servicioGrupos.incorporar(this.idGrupo, { email: email.trim(), idRol: idRol! }).subscribe({
      next: () => {
        this.agregando.set(false);
        this.formulario.patchValue({ email: '' });
        this.cargarIntegrantes();
      },
      error: (error: unknown) => {
        this.agregando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  protected cambiarRol(integrante: RespuestaIntegrante, idRol: number): void {
    this.error.set(null);
    this.servicioGrupos.cambiarRol(this.idGrupo, integrante.idIntegrante, idRol).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => {
        // Revertimos el select recargando el estado real desde la API.
        this.error.set(mensajeDeError(error));
        this.cargarIntegrantes();
      },
    });
  }

  protected desactivar(integrante: RespuestaIntegrante): void {
    this.error.set(null);
    this.servicioGrupos.desactivar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected reactivar(integrante: RespuestaIntegrante): void {
    this.error.set(null);
    this.servicioGrupos.reactivar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected eliminar(integrante: RespuestaIntegrante): void {
    if (!window.confirm('Solo si fue agregado por error.')) return;

    this.error.set(null);
    this.servicioGrupos.eliminar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected salir(): void {
    if (!window.confirm('¿Seguro que quieres salir del grupo?')) return;

    this.error.set(null);
    this.servicioGrupos.salir(this.idGrupo).subscribe({
      next: async () => {
        await this.grupoActivo.cargar();
        this.router.navigateByUrl('/grupos');
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  /**
   * Cambia "Notificar las alertas al coordinador" (sólo coordinador o
   * administrador, `puedeAdministrar()`). Envía el nombre actual del grupo
   * porque `PATCH /api/grupos/{idGrupo}` exige ambos campos, y refresca
   * `ServicioGrupoActivo` para que el resto de la app vea el cambio.
   */
  protected alternarNotificarCoordinador(evento: Event): void {
    const grupo = this.grupo();
    if (!grupo || this.cambiandoNotificaCoordinador()) return;

    this.error.set(null);
    this.cambiandoNotificaCoordinador.set(true);
    this.servicioGrupos
      .actualizar(this.idGrupo, {
        nombreGrupo: grupo.nombreGrupo,
        notificaCoordinador: !grupo.notificaCoordinador,
      })
      .subscribe({
        next: async (grupoActualizado) => {
          this.grupo.set(grupoActualizado);
          this.cambiandoNotificaCoordinador.set(false);
          await this.grupoActivo.cargar();
        },
        error: (error: unknown) => {
          this.cambiandoNotificaCoordinador.set(false);
          this.error.set(mensajeDeError(error));
          // El clic ya cambió el `checked` del DOM nativo, pero `grupo()` no
          // cambió: sin esto, Angular no repinta (el binding `[checked]` no
          // vio una expresión distinta) y el interruptor queda mostrando el
          // valor nuevo que NO se guardó (corrección M2).
          (evento.target as HTMLInputElement).checked = grupo.notificaCoordinador;
        },
      });
  }

  private cargarIntegrantes(): void {
    this.servicioGrupos.integrantes(this.idGrupo).subscribe({
      next: (integrantes) => {
        this.integrantes.set(integrantes);
        // Sincroniza cada select con el valor real de la API: también revierte
        // una selección optimista que haya quedado desfasada tras un error.
        for (const integrante of integrantes) {
          this.controlRol(integrante).setValue(integrante.idRol);
        }
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }
}
