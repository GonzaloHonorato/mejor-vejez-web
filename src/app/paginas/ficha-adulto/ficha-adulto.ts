import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ContactosAdulto } from './contactos-adulto/contactos-adulto';
import { edadEnAnios } from '../../nucleo/adultos/edad';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { AVISO_OPERATIVO, puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { formatearFecha } from '../../nucleo/fechas';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { erroresDeCampos, mensajeDeCampo, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Página "Ficha del adulto mayor" (`/adultos/:idAdulto`): datos del perfil,
 * notas/observaciones, administración (editar en el lugar, desactivar/
 * reactivar, eliminar) y sus contactos de emergencia (`ContactosAdulto`).
 *
 * Siempre trabaja sobre el `idGrupo` del grupo activo en el momento en que
 * se entra a la ficha: si ese grupo cambia mientras se está viendo (no la
 * carga inicial), se vuelve a `/adultos` sin mostrar datos del grupo
 * anterior (Foco de revisión 5 de la Fase 2).
 */
@Component({
  selector: 'app-ficha-adulto',
  imports: [ReactiveFormsModule, RouterLink, ContactosAdulto],
  templateUrl: './ficha-adulto.html',
  styleUrl: './ficha-adulto.scss',
})
export class FichaAdulto implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly avisoOperativo = AVISO_OPERATIVO;
  protected readonly formatearFecha = formatearFecha;

  private readonly idAdulto = Number(this.ruta.snapshot.paramMap.get('idAdulto'));

  protected readonly adulto = signal<RespuestaAdultoMayor | null>(null);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly esAdministrador = signal(false);
  protected readonly editando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly confirmacionEdicion = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});
  protected readonly errorAccion = signal<string | null>(null);
  /** En vuelo "Desactivar"/"Reactivar": evita el doble tap mientras la API responde. */
  protected readonly cambiandoEstado = signal(false);
  /** Confirmación de "Desactivar"/"Reactivar" ya resuelto; se limpia al reintentar o editar. */
  protected readonly confirmacionEstado = signal<string | null>(null);

  /** idEstado de "INACTIVO" para ADULTO_MAYOR; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivo = signal<number | null>(null);
  /** true si `ServicioCatalogos.estados(...)` falló: sin el catálogo nunca se asume que el adulto está activo (lado seguro = no administrable). */
  private readonly catalogoEstadoFallo = signal(false);

  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  protected readonly adultoActivo = computed(() => {
    const adulto = this.adulto();
    if (!adulto) return false;
    if (this.catalogoEstadoFallo()) return false;
    const idInactivo = this.idEstadoInactivo();
    return idInactivo === null || adulto.idEstado !== idInactivo;
  });

  protected readonly formulario = this.fb.group({
    nombreCompleto: ['', Validators.required],
    codigoInterno: [''],
    fechaNacimiento: [''],
    notasEmergencia: [''],
    observacionesGenerales: [''],
  });

  /**
   * idGrupo con el que ya se cargó (o se intentó cargar) el perfil; null
   * mientras no haya llegado ningún grupo activo todavía. Se compara por
   * `idGrupo`, no por identidad de objeto: `ServicioGrupoActivo.cargar()`
   * puede reemplazar `activo()` por un objeto nuevo para el MISMO grupo
   * (`grupos.ts`/`integrantes.ts` lo hacen tras cada recarga) y eso nunca
   * debe verse como un cambio de grupo.
   *
   * En una recarga de página o un enlace directo, `activo()` empieza en
   * `null` (el `ServicioGrupoActivo` todavía no resolvió `listar()`): ese
   * `null` inicial NO cuenta como "el grupo cambió", porque todavía no se
   * había cargado nada con ningún grupo. Solo se navega a `/adultos`
   * cuando, habiendo ya cargado con un grupo, el grupo activo pasa a ser
   * otro distinto (o a `null`).
   */
  private idGrupoCargado: number | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (grupo) {
          this.idGrupoCargado = grupo.idGrupo;
          this.cargar(grupo.idGrupo);
        }
        // Sigue sin grupo activo (todavía cargando o no hay ninguno): se espera.
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        // El grupo activo cambió de verdad mientras se veía esta ficha:
        // nunca se muestran datos del grupo anterior, así que se vuelve a
        // la lista del nuevo.
        this.router.navigateByUrl('/adultos');
      }
      // Mismo idGrupo (aunque `activo()` sea un objeto nuevo): no es un cambio real, no se hace nada.
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('ADULTO_MAYOR', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivo.set(inactivo?.idEstado ?? null);
      },
      // Lado seguro: si falla el catálogo, nunca se asume que el adulto está
      // activo (ver `adultoActivo`), así no se ofrecen acciones de más.
      error: () => this.catalogoEstadoFallo.set(true),
    });
  }

  protected edad(adulto: RespuestaAdultoMayor): number | null {
    return edadEnAnios(adulto.fechaNacimiento);
  }

  protected editar(): void {
    const adulto = this.adulto();
    if (!adulto) return;
    this.confirmacionEdicion.set(false);
    this.confirmacionEstado.set(null);
    this.errorGeneral.set(null);
    this.erroresCampos.set({});
    this.rellenarFormulario(adulto);
    this.editando.set(true);
  }

  protected cancelarEdicion(): void {
    this.editando.set(false);
    this.erroresCampos.set({});
    this.errorGeneral.set(null);
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin completar el nombre. */
  protected mensajeCampoNombre(): string | null {
    return mensajeDeCampo(
      this.formulario.controls.nombreCompleto,
      this.erroresCampos(),
      'nombreCompleto',
      'Ingresa el nombre completo',
    );
  }

  protected guardar(): void {
    const grupo = this.activo();
    const adulto = this.adulto();
    if (!grupo || !adulto || this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.errorGeneral.set(null);
    this.erroresCampos.set({});
    const { nombreCompleto, codigoInterno, fechaNacimiento, notasEmergencia, observacionesGenerales } =
      this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioAdultos
      .actualizar(grupo.idGrupo, adulto.idAdultoMayor, {
        nombreCompleto: nombreCompleto.trim(),
        codigoInterno: codigoInterno.trim() === '' ? null : codigoInterno.trim(),
        fechaNacimiento: fechaNacimiento.trim() === '' ? null : fechaNacimiento,
        notasEmergencia: notasEmergencia.trim() === '' ? null : notasEmergencia.trim(),
        observacionesGenerales:
          observacionesGenerales.trim() === '' ? null : observacionesGenerales.trim(),
      })
      .subscribe({
        next: (actualizado) => {
          this.adulto.set(actualizado);
          this.guardando.set(false);
          this.editando.set(false);
          this.confirmacionEdicion.set(true);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorGeneral.set(mensajeDeError(error));
          }
        },
      });
  }

  protected desactivar(): void {
    const grupo = this.activo();
    const adulto = this.adulto();
    if (!grupo || !adulto || this.cambiandoEstado()) return;
    this.errorAccion.set(null);
    this.confirmacionEstado.set(null);
    this.cambiandoEstado.set(true);
    this.servicioAdultos.desactivar(grupo.idGrupo, adulto.idAdultoMayor).subscribe({
      next: (actualizado) => {
        this.adulto.set(actualizado);
        this.cambiandoEstado.set(false);
        this.confirmacionEstado.set('Perfil desactivado.');
      },
      error: (error: unknown) => {
        this.cambiandoEstado.set(false);
        this.errorAccion.set(mensajeDeError(error));
      },
    });
  }

  protected reactivar(): void {
    const grupo = this.activo();
    const adulto = this.adulto();
    if (!grupo || !adulto || this.cambiandoEstado()) return;
    this.errorAccion.set(null);
    this.confirmacionEstado.set(null);
    this.cambiandoEstado.set(true);
    this.servicioAdultos.reactivar(grupo.idGrupo, adulto.idAdultoMayor).subscribe({
      next: (actualizado) => {
        this.adulto.set(actualizado);
        this.cambiandoEstado.set(false);
        this.confirmacionEstado.set('Perfil reactivado.');
      },
      error: (error: unknown) => {
        this.cambiandoEstado.set(false);
        this.errorAccion.set(mensajeDeError(error));
      },
    });
  }

  protected eliminar(): void {
    const grupo = this.activo();
    const adulto = this.adulto();
    if (!grupo || !adulto) return;
    if (!window.confirm('Solo si fue creado por error. Si tiene historial, desactívalo.')) return;

    this.errorAccion.set(null);
    this.servicioAdultos.eliminar(grupo.idGrupo, adulto.idAdultoMayor).subscribe({
      next: () => this.router.navigateByUrl('/adultos'),
      error: (error: unknown) => this.errorAccion.set(mensajeDeError(error)),
    });
  }

  /** Se llama cuando `ContactosAdulto` emite `cambio`: refresca el adulto para que "Datos" muestre el principal real. */
  protected recargarPrincipal(): void {
    const grupo = this.activo();
    const adulto = this.adulto();
    if (!grupo || !adulto) return;
    this.servicioAdultos.obtener(grupo.idGrupo, adulto.idAdultoMayor).subscribe({
      next: (actualizado) => this.adulto.set(actualizado),
      error: () => undefined,
    });
  }

  private cargar(idGrupo: number): void {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.servicioAdultos.obtener(idGrupo, this.idAdulto).subscribe({
      next: (adulto) => {
        this.adulto.set(adulto);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.noEncontrado.set(true);
        } else {
          this.errorGeneral.set(mensajeDeError(error));
        }
      },
    });
  }

  private rellenarFormulario(adulto: RespuestaAdultoMayor): void {
    this.formulario.patchValue({
      nombreCompleto: adulto.nombreCompleto,
      codigoInterno: adulto.codigoInterno ?? '',
      fechaNacimiento: adulto.fechaNacimiento ?? '',
      notasEmergencia: adulto.notasEmergencia ?? '',
      observacionesGenerales: adulto.observacionesGenerales ?? '',
    });
  }
}
