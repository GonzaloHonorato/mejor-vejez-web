import {
  Component,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Icono } from '../../compartido/icono/icono';
import { descripcionEstado } from '../../nucleo/catalogos/descripcion-estado';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { fechaConAnio } from '../../nucleo/fecha-legible';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { etiquetaRol } from '../../nucleo/grupos/etiqueta-rol';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Página "Grupos": mis grupos (con mi rol), creación plegada tras la acción
 * principal y, si soy admin, todos los grupos.
 */
@Component({
  selector: 'app-grupos',
  imports: [ReactiveFormsModule, RouterLink, Icono],
  templateUrl: './grupos.html',
  styleUrl: './grupos.scss',
})
export class Grupos implements OnInit {
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  private readonly injector = inject(Injector);

  protected readonly activo = this.grupoActivo.activo;
  protected readonly etiquetaRol = etiquetaRol;
  protected readonly esAdministrador = signal(false);
  protected readonly verTodos = signal(false);
  /** Catálogo de estados de GRUPO_FAMILIAR; vacío hasta que llega (la columna queda en blanco). */
  private readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly listaTodos = signal<RespuestaGrupo[]>([]);
  /** Lista a mostrar: mis grupos, o todos los grupos si el admin activó el interruptor. */
  protected readonly lista = computed<RespuestaGrupo[]>(() =>
    this.verTodos() ? this.listaTodos() : this.grupoActivo.grupos(),
  );

  /** Verdadero mientras llega la primera lista de mis grupos. */
  protected readonly cargando = signal(true);
  protected readonly formularioAbierto = signal(false);
  protected readonly creando = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombreGrupo: ['', Validators.required],
  });

  ngOnInit(): void {
    void this.cargarMisGrupos();
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos verificar tus permisos.')),
    });
    this.servicioCatalogos.estados('GRUPO_FAMILIAR', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      // Defensivo: sin el catálogo la columna Estado queda vacía.
      error: () => undefined,
    });
  }

  protected descripcionEstado(grupo: RespuestaGrupo): string {
    return descripcionEstado(this.estados(), grupo.idEstado);
  }

  protected estaActivo(grupo: RespuestaGrupo): boolean {
    return this.estados().find((estado) => estado.idEstado === grupo.idEstado)?.codigo === 'ACTIVO';
  }

  protected reintentar(): void {
    this.cargando.set(true);
    void this.cargarMisGrupos();
  }

  protected creadoEl(grupo: RespuestaGrupo): string {
    return `Creado el ${fechaConAnio(grupo.fechaCreacion)}`;
  }

  protected alternarFormulario(): void {
    if (this.formularioAbierto()) this.cerrarFormulario();
    else this.abrirFormulario();
  }

  protected abrirFormulario(): void {
    this.errorCrear.set(null);
    this.formularioAbierto.set(true);
    this.enfocar('grupo-nombre');
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.enfocar('grupos-abrir-crear');
  }

  protected usar(idGrupo: number): void {
    this.grupoActivo.seleccionar(idGrupo);
  }

  protected alternarVerTodos(): void {
    const siguiente = !this.verTodos();
    this.verTodos.set(siguiente);
    if (siguiente) {
      this.cargarTodos();
    }
  }

  protected async crear(): Promise<void> {
    if (this.formulario.invalid || this.creando()) return;

    this.errorCrear.set(null);
    const { nombreGrupo } = this.formulario.getRawValue();
    this.creando.set(true);
    this.servicioGrupos.crear(nombreGrupo).subscribe({
      next: async (grupo) => {
        this.formulario.reset({ nombreGrupo: '' });
        try {
          await this.grupoActivo.cargar();
          if (this.verTodos()) {
            this.cargarTodos();
          }
          this.grupoActivo.seleccionar(grupo.idGrupo);
          this.cerrarFormulario();
        } catch (error) {
          // Defensivo: ServicioGrupoActivo.cargar() ya no rechaza, pero si
          // algún día lo hiciera, el botón no debe quedar bloqueado para siempre.
          this.errorCrear.set(mensajeDeError(error));
        } finally {
          this.creando.set(false);
        }
      },
      error: (error: unknown) => {
        this.creando.set(false);
        this.errorCrear.set(mensajeDeError(error));
      },
    });
  }

  private async cargarMisGrupos(): Promise<void> {
    try {
      await this.grupoActivo.cargar();
    } finally {
      this.cargando.set(false);
    }
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  private cargarTodos(): void {
    this.servicioGrupos.listar(true).subscribe((grupos) => this.listaTodos.set(grupos));
  }
}
