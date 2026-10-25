import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

interface EntradaNavegacion {
  /** Texto en la barra lateral (escritorio). */
  etiqueta: string;
  /** Texto corto en la barra inferior (móvil). */
  etiquetaCorta: string;
  /** Sin ruta = todavía no existe en F0; se muestra deshabilitada. */
  ruta?: string;
}

const NAVEGACION: readonly EntradaNavegacion[] = [
  { etiqueta: 'Panel familiar', etiquetaCorta: 'Panel', ruta: '/' },
  { etiqueta: 'Tareas', etiquetaCorta: 'Tareas' },
  { etiqueta: 'Alertas', etiquetaCorta: 'Alertas' },
  { etiqueta: 'Medicamentos', etiquetaCorta: 'Remedios' },
  { etiqueta: 'Adultos mayores', etiquetaCorta: 'Personas' },
];

/**
 * Marco de la aplicación autenticada (opción C): barra lateral oscura en
 * escritorio y barra de pestañas inferior en móvil.
 */
@Component({
  selector: 'app-marco-app',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './marco-app.html',
  styleUrl: './marco-app.scss',
})
export class MarcoApp {
  private readonly auth = inject(ServicioAutenticacion);
  private readonly router = inject(Router);

  protected readonly navegacion = NAVEGACION;
  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    return usuario?.displayName || usuario?.email || '';
  });

  /** Navega a /ingreso solo si Firebase cerró la sesión; si falla, lo registra y no navega. */
  protected async cerrarSesion(): Promise<void> {
    try {
      await this.auth.cerrarSesion();
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      return;
    }
    await this.router.navigateByUrl('/ingreso');
  }
}
