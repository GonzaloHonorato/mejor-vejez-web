import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icono, NombreIcono } from '../../icono/icono';

/** Entrada del panel "Más": a diferencia de las pestañas, su estado activo se decide por prefijo de ruta. */
export interface EntradaMas {
  etiqueta: string;
  ruta: string;
  icono: NombreIcono;
  /** Activo en esta ruta y en sus subrutas (`/grupos` cubre `/grupos/1/auditoria`). */
  prefijoActivo: string;
}

/** `true` si `url` (sin query ni fragmento) es `prefijo` o una subruta suya, por segmentos completos. */
export function rutaCoincide(url: string, prefijo: string): boolean {
  const ruta = url.split(/[?#]/)[0];
  return ruta === prefijo || ruta.startsWith(`${prefijo}/`);
}

/**
 * Hoja "Más" de la barra inferior móvil (ajustes post-F7): los accesos que
 * no caben en las 4 pestañas fijas, más el correo y "Cerrar sesión" (que
 * en móvil salen de la cabecera). Solo existe mientras está abierta (el
 * marco la monta con `@if`), así que al montarse enfoca el primer enlace.
 * No decide cuándo cerrarse: avisa con `cerrar` (Escape, clic en el fondo,
 * botón "Cerrar") y el marco la desmonta y devuelve el foco al botón
 * "Más"; al navegar, el marco la cierra por `NavigationEnd`.
 */
@Component({
  selector: 'app-panel-mas',
  imports: [RouterLink, Icono],
  templateUrl: './panel-mas.html',
  styleUrl: './panel-mas.scss',
  host: {
    '(document:keydown.escape)': 'cerrar.emit()',
  },
})
export class PanelMas {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly entradas = input.required<readonly EntradaMas[]>();
  readonly correo = input('');
  /** URL actual del router, para marcar con `aria-current` la entrada activa. */
  readonly urlActual = input('');

  readonly cerrar = output<void>();
  readonly cerrarSesion = output<void>();

  constructor() {
    afterNextRender(() => {
      this.elemento.nativeElement.querySelector<HTMLElement>('.panel-mas__enlace')?.focus();
    });
  }

  protected esActiva(entrada: EntradaMas): boolean {
    return rutaCoincide(this.urlActual(), entrada.prefijoActivo);
  }
}
