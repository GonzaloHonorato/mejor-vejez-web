import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';

/**
 * Bloque "GRUPO" del marco (opción C): muestra el grupo activo y permite
 * cambiarlo.
 * - `lateral` (barra lateral de escritorio): rótulo, nombre y botón
 *   "Cambiar" que despliega una lista simple de mis grupos.
 * - `cabecera` (encabezado móvil): nombre del grupo y enlace "Cambiar" a
 *   `/grupos` (una lista desplegable no cabe bien a 390px).
 */
@Component({
  selector: 'app-selector-grupo',
  imports: [RouterLink],
  templateUrl: './selector-grupo.html',
  styleUrl: './selector-grupo.scss',
})
export class SelectorGrupo {
  private readonly grupoActivo = inject(ServicioGrupoActivo);

  readonly variante = input<'lateral' | 'cabecera'>('lateral');

  protected readonly grupos = this.grupoActivo.grupos;
  protected readonly activo = this.grupoActivo.activo;
  protected readonly nombreActivo = computed(() => this.activo()?.nombreGrupo ?? 'Sin grupo');
  protected readonly menuAbierto = signal(false);

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  protected elegir(idGrupo: number): void {
    this.grupoActivo.seleccionar(idGrupo);
    this.menuAbierto.set(false);
  }
}
