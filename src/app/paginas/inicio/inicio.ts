import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { RespuestaYo, ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Cómo falló `GET /api/yo`:
 * - `reintentable`: error de red (status 0) o del servidor (5xx); vale la pena reintentar.
 * - `cuenta`: la API rechazó la cuenta (401/403/409/422...); reintentar no
 *   cambia nada, así que se muestra el motivo y se ofrece cerrar sesión.
 */
type Fallo = { tipo: 'reintentable' } | { tipo: 'cuenta'; mensaje: string };

const MENSAJE_CUENTA_GENERICO =
  'No pudimos validar tu cuenta. Cierra sesión e intenta ingresar de nuevo.';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  private readonly servicioYo = inject(ServicioYo);
  private readonly auth = inject(ServicioAutenticacion);
  private readonly router = inject(Router);
  private readonly grupoActivo = inject(ServicioGrupoActivo);

  protected readonly sinGrupos = computed(() => this.grupoActivo.grupos().length === 0);
  protected readonly yo = signal<RespuestaYo | null>(null);
  protected readonly cargando = signal(false);
  protected readonly fallo = signal<Fallo | null>(null);
  protected readonly falloCerrarSesion = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.yo.set(yo);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.fallo.set(clasificarFallo(error));
        this.cargando.set(false);
      },
    });
  }

  protected async cerrarSesion(): Promise<void> {
    this.falloCerrarSesion.set(false);
    try {
      await this.auth.cerrarSesion();
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      this.falloCerrarSesion.set(true);
      return;
    }
    await this.router.navigateByUrl('/ingreso');
  }
}

function clasificarFallo(error: unknown): Fallo {
  const estado = error instanceof HttpErrorResponse ? error.status : 0;
  if (estado === 0 || estado >= 500) {
    return { tipo: 'reintentable' };
  }
  const detalle = (error as HttpErrorResponse).error?.detail;
  return {
    tipo: 'cuenta',
    mensaje: typeof detalle === 'string' && detalle.trim() ? detalle : MENSAJE_CUENTA_GENERICO,
  };
}
