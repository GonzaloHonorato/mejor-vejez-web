import { ElementRef, Injector, afterNextRender } from '@angular/core';

/**
 * Tras un envío con errores, lleva el foco al primer campo marcado con
 * `aria-invalid="true"` dentro de `contenedor` (normalmente el formulario).
 * Espera al próximo render, porque los atributos `aria-invalid` se pintan
 * después de `markAllAsTouched()` o de recibir los errores de la API.
 */
export function enfocarPrimerCampoInvalido(
  contenedor: () => ParentNode | null | undefined,
  injector: Injector,
): void {
  afterNextRender(
    () => contenedor()?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    { injector },
  );
}

/** El elemento de `selector` dentro del host del componente (o el host mismo si no hay selector). */
export function dentroDe(
  host: ElementRef<HTMLElement>,
  selector?: string,
): () => ParentNode | null {
  return () => (selector ? host.nativeElement.querySelector(selector) : host.nativeElement);
}
