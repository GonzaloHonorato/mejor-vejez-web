import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ClaveTemporal } from '../../compartido/clave-temporal/clave-temporal';
import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaUsuario } from '../../nucleo/usuarios/modelos-usuarios';
import { ServicioUsuarios } from '../../nucleo/usuarios/servicio-usuarios';

const TAMANO_PAGINA = 10;

/** Lo que muestra el diálogo de clave temporal: cuenta creada o acceso reenviado. */
interface ClaveAMostrar {
  titulo: string;
  clave: string;
  correoEnviado: boolean;
}

/**
 * Página "Administración de usuarios" (`/administracion/usuarios`, solo
 * administradores, ver `guardAdministrador`): buscador, listado paginado y,
 * por usuario, edición de nombre/teléfono/administrador y cambio de estado.
 * Tiene además el enlace "Auditoría global" (`/administracion/auditoria`,
 * Tarea 7): esta página ya está detrás de `guardAdministrador`, así que no
 * hace falta ninguna condición extra para mostrarlo.
 */
@Component({
  selector: 'app-administracion-usuarios',
  imports: [ReactiveFormsModule, RouterLink, ClaveTemporal],
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

  /** "Crear usuario": abierto/cerrado, envío en curso, error y campos. */
  protected readonly creandoUsuario = signal(false);
  protected readonly guardandoCrear = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly erroresCamposCrear = signal<Record<string, string>>({});
  /** Usuario cuyo "Reenviar accesos" está en curso (bloquea un segundo clic sobre la misma fila). */
  protected readonly reenviando = signal<number | null>(null);
  /**
   * La clave temporal vive únicamente mientras este diálogo está montado
   * (ver `ClaveTemporal`): al cerrarlo se vuelve a `null` y se descarta, sin
   * quedar en ningún servicio, `localStorage` ni log.
   */
  protected readonly claveAMostrar = signal<ClaveAMostrar | null>(null);
  /**
   * Botón "Crear usuario" (toggle): se consulta de nuevo en cada lectura
   * (signal de `viewChild`), así que siempre apunta a la instancia vigente
   * aunque el `@if` la haya destruido y recreado mientras el formulario
   * estuvo abierto.
   */
  private readonly botonCrearUsuario = viewChild<ElementRef<HTMLButtonElement>>('botonCrearUsuario');
  /** Dónde devolver el foco al cerrar `ClaveTemporal`: se fija al abrir cada flujo. */
  private restaurarFoco: (() => void) | null = null;

  protected readonly formularioCrear = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
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

  protected abrirCrear(): void {
    this.restaurarFoco = () => this.botonCrearUsuario()?.nativeElement.focus();
    this.creandoUsuario.set(true);
    this.errorCrear.set(null);
    this.erroresCamposCrear.set({});
    this.formularioCrear.reset({ nombre: '', email: '', telefono: '' });
  }

  protected cancelarCrear(): void {
    this.creandoUsuario.set(false);
  }

  protected crear(): void {
    if (this.guardandoCrear()) return;
    if (this.formularioCrear.invalid) {
      this.formularioCrear.markAllAsTouched();
      this.errorCrear.set(null);
      this.erroresCamposCrear.set(this.erroresLocalesNombreCrear());
      return;
    }

    this.errorCrear.set(null);
    this.erroresCamposCrear.set({});
    const { nombre, email, telefono } = this.formularioCrear.getRawValue();
    this.guardandoCrear.set(true);
    this.servicioUsuarios
      .crear({ nombre, email, telefono: telefono.trim() === '' ? null : telefono })
      .subscribe({
        next: (respuesta) => {
          this.guardandoCrear.set(false);
          this.creandoUsuario.set(false);
          this.claveAMostrar.set({
            titulo: 'Cuenta creada',
            clave: respuesta.claveTemporal,
            correoEnviado: respuesta.correoEnviado,
          });
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardandoCrear.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCamposCrear.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorCrear.set(mensajeDeError(error));
          }
        },
      });
  }

  /** Mensaje local para "nombre" cuando el formulario es inválido del lado del cliente (antes de llamar a la API). */
  private erroresLocalesNombreCrear(): Record<string, string> {
    const control = this.formularioCrear.controls.nombre;
    if (control.hasError('required')) {
      return { nombre: 'El nombre es obligatorio.' };
    }
    if (control.hasError('maxlength')) {
      return { nombre: 'El nombre no puede superar los 160 caracteres.' };
    }
    return {};
  }

  /**
   * La API responde 422 a "Reenviar accesos" para un usuario que no está
   * ACTIVO: el botón ni se ofrece. El estado real se busca en el catálogo
   * cargado (`estados()`), no por un `idEstado` fijo (puede variar según
   * el entorno/seed).
   */
  protected puedeReenviarAcceso(usuario: RespuestaUsuario): boolean {
    return (
      this.estados().find((estado) => estado.idEstado === usuario.idEstado)?.codigo === 'ACTIVO'
    );
  }

  protected reenviarAcceso(usuarioObjetivo: RespuestaUsuario): void {
    if (this.reenviando() !== null) return;
    if (!window.confirm(`¿Reenviar los accesos a ${usuarioObjetivo.nombre}?`)) return;

    // El botón de la fila no se destruye mientras dura el pedido: guardar la
    // referencia directa (no hace falta volver a consultarla) basta.
    const origen = document.activeElement as HTMLElement | null;
    this.restaurarFoco = () => origen?.focus();
    this.error.set(null);
    this.reenviando.set(usuarioObjetivo.idUsuario);
    this.servicioUsuarios.reenviarAcceso(usuarioObjetivo.idUsuario).subscribe({
      next: (respuesta) => {
        this.reenviando.set(null);
        this.claveAMostrar.set({
          titulo: 'Acceso reenviado',
          clave: respuesta.claveTemporal,
          correoEnviado: respuesta.correoEnviado,
        });
      },
      error: (error: unknown) => {
        this.reenviando.set(null);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  /** Cierra `ClaveTemporal` y devuelve el foco a quien abrió el flujo que la mostró. */
  protected cerrarClave(): void {
    this.claveAMostrar.set(null);
    const restaurar = this.restaurarFoco;
    this.restaurarFoco = null;
    restaurar?.();
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
