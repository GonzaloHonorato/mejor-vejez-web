import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';

import { EstadoCarga } from '../../../nucleo/panel/estado-seccion';

/**
 * Marco de una sección del panel familiar: título (`<h3>`, porque cuelga
 * del `<h2>` "Tu panel"), los estados de `EstadoSeccion` (esqueleto al
 * cargar, aviso con "Reintentar" ante error, mensaje de vacío) y el aviso
 * "No se pudo actualizar." cuando un refresco falla. El contenido propio
 * se proyecta con `ng-content` y solo se muestra con datos.
 *
 * No orquesta nada: `Inicio` decide cuándo cargar, reintentar o refrescar.
 * Al reintentar, el foco pasa al título para que no caiga al `<body>`
 * cuando el botón desaparece.
 */
@Component({
  selector: 'app-seccion-panel',
  imports: [],
  templateUrl: './seccion-panel.html',
  styleUrl: './seccion-panel.scss',
})
export class SeccionPanel {
  readonly titulo = input.required<string>();
  readonly estado = input.required<EstadoCarga>();
  readonly mensajeVacio = input.required<string>();
  readonly desactualizada = input(false);
  readonly reintentar = output<void>();

  private readonly elementoTitulo = viewChild<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Id del `<h3>` para `aria-labelledby`: derivado del título, estable mientras no cambie. */
  protected readonly idTitulo = computed(
    () => `seccion-panel-${this.titulo().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  );

  /** Emite "reintentar" y mueve el foco al título, para que no se pierda. */
  protected alReintentar(): void {
    this.reintentar.emit();
    this.elementoTitulo()?.nativeElement.focus();
  }
}
