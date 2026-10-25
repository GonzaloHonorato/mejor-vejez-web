import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaUsuario } from '../../nucleo/usuarios/modelos-usuarios';
import { ServicioUsuarios } from '../../nucleo/usuarios/servicio-usuarios';

const TAMANO_PAGINA = 10;

/**
 * Página "Administración de usuarios" (`/administracion/usuarios`, solo
 * administradores, ver `guardAdministrador`): buscador, listado paginado y,
 * por usuario, edición de nombre/teléfono/administrador y cambio de estado.
 */
@Component({
  selector: 'app-administracion-usuarios',
  imports: [ReactiveFormsModule],
  templateUrl: './administracion-usuarios.html',
  styleUrl: './administracion-usuarios.scss',
})
export class AdministracionUsuarios implements OnInit {
  private readonly servicioUsuarios = inject(ServicioUsuarios);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);

  /**
   * Un `FormControl` por fila para el select de estado: a diferencia de
   * `[value]`/`[selected]`, `writeValue` de `SelectControlValueAccessor`
   * reaplica el valor real al <select> en cada carga (incluida la
   * reversión tras un 422), sin depender de la memoización de bindings
   * de Angular.
   */
  private readonly controlesEstado = new Map<number, FormControl<number>>();

  protected controlEstado(usuario: RespuestaUsuario): FormControl<number> {
    let control = this.controlesEstado.get(usuario.idUsuario);
    if (!control) {
      control = this.fb.control(usuario.idEstado);
      this.controlesEstado.set(usuario.idUsuario, control);
    }
    return control;
  }

  protected readonly usuarios = signal<RespuestaUsuario[]>([]);
  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly pagina = signal(0);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);

  protected readonly hayMasPaginas = computed(() => (this.pagina() + 1) * TAMANO_PAGINA < this.total());

  protected readonly editando = signal<RespuestaUsuario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  protected readonly formularioBusqueda = inject(NonNullableFormBuilder).group({
    texto: [''],
  });

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    telefono: [''],
    esAdministrador: [false],
  });

  ngOnInit(): void {
    this.servicioCatalogos.estados('USUARIO', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos cargar los estados.')),
    });
    this.cargar();
  }

  protected buscar(): void {
    this.pagina.set(0);
    this.cargar();
  }

  protected paginaAnterior(): void {
    if (this.pagina() === 0) return;
    this.pagina.set(this.pagina() - 1);
    this.cargar();
  }

  protected siguientePagina(): void {
    if (!this.hayMasPaginas()) return;
    this.pagina.set(this.pagina() + 1);
    this.cargar();
  }

  protected cambiarEstado(usuario: RespuestaUsuario, idEstado: number): void {
    this.error.set(null);
    this.servicioUsuarios.cambiarEstado(usuario.idUsuario, idEstado).subscribe({
      next: () => this.cargar(),
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.cargar();
      },
    });
  }

  protected editar(usuario: RespuestaUsuario): void {
    this.editando.set(usuario);
    this.errorEdicion.set(null);
    this.erroresCampos.set({});
    this.formulario.setValue({
      nombre: usuario.nombre,
      telefono: usuario.telefono ?? '',
      esAdministrador: usuario.esAdministrador,
    });
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
  }

  protected guardar(): void {
    const usuario = this.editando();
    if (!usuario || this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorEdicion.set(null);
      this.erroresCampos.set(
        this.formulario.controls.nombre.invalid ? { nombre: 'El nombre es obligatorio.' } : {},
      );
      return;
    }

    this.erroresCampos.set({});
    this.errorEdicion.set(null);
    const { nombre, telefono, esAdministrador } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioUsuarios
      .actualizar(usuario.idUsuario, {
        nombre,
        telefono: telefono.trim() === '' ? null : telefono,
        esAdministrador,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.editando.set(null);
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorEdicion.set(mensajeDeError(error));
          }
        },
      });
  }

  private cargar(): void {
    const { texto } = this.formularioBusqueda.getRawValue();
    this.servicioUsuarios
      .listar({
        texto: texto.trim() === '' ? undefined : texto.trim(),
        pagina: this.pagina(),
        tamano: TAMANO_PAGINA,
      })
      .subscribe({
        next: (respuesta) => {
          this.usuarios.set(respuesta.elementos);
          this.total.set(respuesta.total);
          // Sincroniza cada select con el valor real de la API: también revierte
          // una selección optimista que haya quedado desfasada tras un error.
          for (const usuario of respuesta.elementos) {
            this.controlEstado(usuario).setValue(usuario.idEstado);
          }
        },
        error: (error: unknown) => this.error.set(mensajeDeError(error)),
      });
  }
}
