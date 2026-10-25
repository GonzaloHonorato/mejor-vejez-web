import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaGrupo } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/** Página "Grupos": mis grupos (con mi rol), creación y, si soy admin, todos los grupos. */
@Component({
  selector: 'app-grupos',
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe],
  templateUrl: './grupos.html',
  styleUrl: './grupos.scss',
})
export class Grupos implements OnInit {
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioYo = inject(ServicioYo);
  protected readonly grupoActivo = inject(ServicioGrupoActivo);

  protected readonly activo = this.grupoActivo.activo;
  protected readonly esAdministrador = signal(false);
  protected readonly verTodos = signal(false);
  protected readonly listaTodos = signal<RespuestaGrupo[]>([]);
  /** Lista a mostrar: mis grupos, o todos los grupos si el admin activó el interruptor. */
  protected readonly lista = computed<RespuestaGrupo[]>(() =>
    this.verTodos() ? this.listaTodos() : this.grupoActivo.grupos(),
  );

  protected readonly creando = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombreGrupo: ['', Validators.required],
  });

  ngOnInit(): void {
    this.grupoActivo.cargar();
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos verificar tus permisos.')),
    });
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

  private cargarTodos(): void {
    this.servicioGrupos.listar(true).subscribe((grupos) => this.listaTodos.set(grupos));
  }
}
