import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaYo, ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { CanalesNotificacion } from './canales-notificacion/canales-notificacion';

/** Página "Mi perfil": correo de solo lectura, nombre y teléfono editables, y canales de notificación (Tarea 12). */
@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, CanalesNotificacion],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
})
export class MiPerfil implements OnInit {
  private readonly servicioYo = inject(ServicioYo);

  protected readonly yo = signal<RespuestaYo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly confirmacion = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    telefono: [''],
  });

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.yo.set(yo);
        this.formulario.patchValue({ nombre: yo.nombre, telefono: yo.telefono ?? '' });
      },
      error: (error: unknown) =>
        this.errorGeneral.set(mensajeDeError(error, 'No pudimos cargar tu perfil.')),
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.confirmacion.set(false);
      this.erroresCampos.set(
        this.formulario.controls.nombre.invalid ? { nombre: 'El nombre es obligatorio.' } : {},
      );
      return;
    }

    this.erroresCampos.set({});
    this.errorGeneral.set(null);
    this.confirmacion.set(false);

    const { nombre, telefono } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioYo
      .actualizar({ nombre, telefono: telefono.trim() === '' ? null : telefono })
      .subscribe({
        next: (yo) => {
          this.yo.set(yo);
          this.guardando.set(false);
          this.confirmacion.set(true);
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
}
